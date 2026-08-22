-- Enriquece o cadastro comercial sem alterar os registros existentes.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS temperature text NOT NULL DEFAULT 'morno'
    CHECK (temperature IN ('frio', 'morno', 'quente'));

ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS next_action_details text;

CREATE TABLE IF NOT EXISTS public.crm_action_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, name)
);

ALTER TABLE public.crm_action_catalog ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_action_catalog TO authenticated;
GRANT ALL ON public.crm_action_catalog TO service_role;

CREATE POLICY "crm action catalog read"
  ON public.crm_action_catalog FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() AND public.can_view_commercial());

CREATE POLICY "crm action catalog manage"
  ON public.crm_action_catalog FOR ALL TO authenticated
  USING (org_id = public.current_org_id() AND public.can_view_commercial())
  WITH CHECK (org_id = public.current_org_id() AND public.can_view_commercial());
