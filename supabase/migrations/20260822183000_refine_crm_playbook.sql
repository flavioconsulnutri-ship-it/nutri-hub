-- CRM refinado a partir do playbook comercial.
-- Leads permanecem separados de pacientes; pagamento confirmado converte o lead.

ALTER TYPE public.funnel_stage ADD VALUE IF NOT EXISTS 'pre_consulta';
ALTER TYPE public.funnel_stage ADD VALUE IF NOT EXISTS 'proposta';
ALTER TYPE public.funnel_stage ADD VALUE IF NOT EXISTS 'follow_up_infinito';
ALTER TYPE public.funnel_stage ADD VALUE IF NOT EXISTS 'aguardando_pagamento';

CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  phone text NOT NULL,
  email text,
  lead_type text NOT NULL DEFAULT 'lead_novo'
    CHECK (lead_type IN ('lead_novo', 'ex_paciente', 'indicacao')),
  source text,
  referred_by text,
  main_goal text,
  notes text,
  converted_patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  converted_at timestamptz,
  owner_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_leads_org_name ON public.leads(org_id, full_name);
CREATE INDEX idx_leads_org_phone ON public.leads(org_id, phone);

ALTER TABLE public.opportunities
  ADD COLUMN lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  ADD COLUMN stalled_from_stage public.funnel_stage,
  ADD COLUMN objection text,
  ADD COLUMN paralysis_reason text;
CREATE INDEX idx_opportunities_lead ON public.opportunities(lead_id);

CREATE TABLE public.crm_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  title text NOT NULL,
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'concluida', 'cancelada')),
  sequence_key text,
  assigned_to uuid,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_crm_tasks_org_due ON public.crm_tasks(org_id, status, due_date);
CREATE UNIQUE INDEX idx_crm_tasks_sequence
  ON public.crm_tasks(opportunity_id, sequence_key)
  WHERE sequence_key IS NOT NULL;

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_tasks ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads, public.crm_tasks TO authenticated;
GRANT ALL ON public.leads, public.crm_tasks TO service_role;

CREATE POLICY "leads read" ON public.leads FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() AND public.can_view_commercial());
CREATE POLICY "leads manage" ON public.leads FOR ALL TO authenticated
  USING (org_id = public.current_org_id() AND public.can_view_commercial())
  WITH CHECK (org_id = public.current_org_id() AND public.can_view_commercial());

CREATE POLICY "crm tasks read" ON public.crm_tasks FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() AND public.can_view_commercial());
CREATE POLICY "crm tasks manage" ON public.crm_tasks FOR ALL TO authenticated
  USING (org_id = public.current_org_id() AND public.can_view_commercial())
  WITH CHECK (org_id = public.current_org_id() AND public.can_view_commercial());

CREATE TRIGGER t_leads_upd BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.schedule_crm_followups()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item record;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.stage IS NOT DISTINCT FROM OLD.stage THEN
    RETURN NEW;
  END IF;

  UPDATE public.crm_tasks
     SET status = 'cancelada'
   WHERE opportunity_id = NEW.id AND status = 'pendente';

  FOR item IN
    SELECT * FROM (VALUES
      ('novo_lead'::text, 1, 'Responder lead novo - tentativa D1', 'lead-d1'),
      ('novo_lead', 3, 'Responder lead novo - tentativa D3', 'lead-d3'),
      ('novo_lead', 7, 'Responder lead novo - tentativa D7', 'lead-d7'),
      ('qualificacao', 1, 'Retomar qualificação - tentativa D1', 'qualificacao-d1'),
      ('qualificacao', 3, 'Retomar qualificação - tentativa D3', 'qualificacao-d3'),
      ('qualificacao', 5, 'Retomar qualificação - tentativa D5', 'qualificacao-d5'),
      ('qualificacao', 7, 'Retomar qualificação - tentativa D7', 'qualificacao-d7'),
      ('pre_consulta', 0, 'Contato após ausência na pré-consulta', 'pre-consulta-d0'),
      ('pre_consulta', 1, 'Contato após ausência - tentativa D1', 'pre-consulta-d1'),
      ('pre_consulta', 3, 'Contato após ausência - tentativa D3', 'pre-consulta-d3'),
      ('proposta', 1, 'Follow-up da proposta - D1', 'proposta-d1'),
      ('proposta', 3, 'Follow-up da proposta - D3', 'proposta-d3'),
      ('proposta', 5, 'Follow-up da proposta - D5', 'proposta-d5'),
      ('proposta', 7, 'Follow-up da proposta - D7', 'proposta-d7'),
      ('aguardando_pagamento', 1, 'Cobrar pagamento pendente - 24h', 'pagamento-24h'),
      ('aguardando_pagamento', 2, 'Cobrar pagamento pendente - 48h', 'pagamento-48h'),
      ('aguardando_pagamento', 3, 'Última tentativa de pagamento - 72h', 'pagamento-72h'),
      ('reativacao_futura', 30, 'Reativar negociação - 30 dias', 'reativacao-30'),
      ('reativacao_futura', 60, 'Reativar negociação - 60 dias', 'reativacao-60'),
      ('reativacao_futura', 90, 'Reativar negociação - 90 dias', 'reativacao-90')
    ) AS rules(stage, days_after, title, sequence_key)
    WHERE rules.stage = NEW.stage::text
  LOOP
    INSERT INTO public.crm_tasks(
      org_id, opportunity_id, title, due_date, sequence_key, assigned_to
    ) VALUES (
      NEW.org_id, NEW.id, item.title, current_date + item.days_after,
      item.sequence_key, NEW.owner_id
    )
    ON CONFLICT DO NOTHING;
  END LOOP;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.schedule_crm_followups() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER t_schedule_crm_followups
AFTER INSERT OR UPDATE OF stage ON public.opportunities
FOR EACH ROW EXECUTE FUNCTION public.schedule_crm_followups();

