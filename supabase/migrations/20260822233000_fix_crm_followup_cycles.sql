-- Garante uma nova régua sempre que a negociação entra em uma etapa.
-- O índice único anterior impedia a recriação dos lembretes ao retornar
-- para uma etapa já visitada.
DROP INDEX IF EXISTS public.idx_crm_tasks_sequence;

CREATE INDEX IF NOT EXISTS idx_crm_tasks_sequence
  ON public.crm_tasks(opportunity_id, sequence_key)
  WHERE sequence_key IS NOT NULL;

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

  -- Ao sair de uma etapa, preserva o histórico e cancela somente o que
  -- ainda estava pendente. A nova entrada sempre recebe uma régua nova.
  UPDATE public.crm_tasks
     SET status = 'cancelada'
   WHERE opportunity_id = NEW.id
     AND status = 'pendente';

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
      ('follow_up', 1, 'Follow-up ativo - tentativa D1', 'follow-up-d1'),
      ('follow_up', 3, 'Follow-up ativo - tentativa D3', 'follow-up-d3'),
      ('follow_up', 5, 'Follow-up ativo - tentativa D5', 'follow-up-d5'),
      ('follow_up', 7, 'Follow-up ativo - tentativa D7', 'follow-up-d7'),
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
      NEW.org_id,
      NEW.id,
      item.title,
      current_date + item.days_after,
      item.sequence_key,
      NEW.owner_id
    );
  END LOOP;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.schedule_crm_followups() FROM PUBLIC, anon, authenticated;

-- Repara as réguas ausentes dos leads que já estão no funil, sem duplicar
-- tarefas pendentes ou já concluídas da etapa atual.
WITH rules(stage, days_after, title, sequence_key) AS (
  VALUES
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
    ('follow_up', 1, 'Follow-up ativo - tentativa D1', 'follow-up-d1'),
    ('follow_up', 3, 'Follow-up ativo - tentativa D3', 'follow-up-d3'),
    ('follow_up', 5, 'Follow-up ativo - tentativa D5', 'follow-up-d5'),
    ('follow_up', 7, 'Follow-up ativo - tentativa D7', 'follow-up-d7'),
    ('aguardando_pagamento', 1, 'Cobrar pagamento pendente - 24h', 'pagamento-24h'),
    ('aguardando_pagamento', 2, 'Cobrar pagamento pendente - 48h', 'pagamento-48h'),
    ('aguardando_pagamento', 3, 'Última tentativa de pagamento - 72h', 'pagamento-72h'),
    ('reativacao_futura', 30, 'Reativar negociação - 30 dias', 'reativacao-30'),
    ('reativacao_futura', 60, 'Reativar negociação - 60 dias', 'reativacao-60'),
    ('reativacao_futura', 90, 'Reativar negociação - 90 dias', 'reativacao-90')
)
INSERT INTO public.crm_tasks(
  org_id, opportunity_id, title, due_date, sequence_key, assigned_to
)
SELECT
  opportunity.org_id,
  opportunity.id,
  rule.title,
  current_date + rule.days_after,
  rule.sequence_key,
  opportunity.owner_id
FROM public.opportunities AS opportunity
JOIN rules AS rule ON rule.stage = opportunity.stage::text
WHERE NOT EXISTS (
  SELECT 1
  FROM public.crm_tasks AS existing
  WHERE existing.opportunity_id = opportunity.id
    AND existing.sequence_key = rule.sequence_key
    AND existing.status IN ('pendente', 'concluida')
);
