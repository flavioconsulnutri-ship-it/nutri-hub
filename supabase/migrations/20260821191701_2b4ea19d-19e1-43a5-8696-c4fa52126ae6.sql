-- =========================
-- ENUMS
-- =========================
CREATE TYPE public.app_role AS ENUM ('admin','nutricionista','atendimento','financeiro','estagiario');
CREATE TYPE public.patient_status AS ENUM ('lead','avaliacao_comercial','ativo','pausado','encerrado','ex_paciente','inadimplente');
CREATE TYPE public.funnel_stage AS ENUM ('novo_lead','contato_iniciado','qualificacao','reuniao_agendada','proposta_enviada','follow_up','negociacao','ganha','perdida','reativacao_futura');
CREATE TYPE public.payment_method AS ENUM ('pix','cartao_credito','cartao_debito','dinheiro','boleto','transferencia','cortesia','permuta');
CREATE TYPE public.receivable_status AS ENUM ('previsto','pendente','parcialmente_recebido','recebido','vencido','cancelado','estornado');
CREATE TYPE public.payable_status AS ENUM ('previsto','pendente','parcialmente_pago','pago','vencido','cancelado','estornado');
CREATE TYPE public.appointment_status AS ENUM ('agendada','confirmada','realizada','remarcada','cancelada','falta');
CREATE TYPE public.appointment_mode AS ENUM ('presencial','online');
CREATE TYPE public.account_type AS ENUM ('banco','cartao','dinheiro','outra');
CREATE TYPE public.dre_group AS ENUM ('receita_bruta','deducoes','custos_diretos','despesas_operacionais','despesas_administrativas','despesas_comerciais','despesas_equipe','impostos','outras');
CREATE TYPE public.contract_status AS ENUM ('ativo','concluido','cancelado','renovado');

-- =========================
-- ORG / USERS
-- =========================
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_profiles_org ON public.profiles(org_id);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_id uuid,
  table_name text NOT NULL,
  record_id uuid,
  action text NOT NULL,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_org_created ON public.audit_log(org_id, created_at DESC);

-- =========================
-- HELPERS (security definer)
-- =========================
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT org_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.can_view_financial()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'financeiro');
$$;

CREATE OR REPLACE FUNCTION public.can_view_clinical()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'nutricionista') OR public.has_role(auth.uid(),'estagiario');
$$;

CREATE OR REPLACE FUNCTION public.can_view_commercial()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'financeiro') OR public.has_role(auth.uid(),'atendimento') OR public.has_role(auth.uid(),'nutricionista');
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(),'admin');
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- new user: first user creates the org and becomes admin; others join as estagiario
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _org uuid;
BEGIN
  SELECT id INTO _org FROM public.organizations ORDER BY created_at LIMIT 1;
  IF _org IS NULL THEN
    INSERT INTO public.organizations(name) VALUES ('Meu Consultório') RETURNING id INTO _org;
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'estagiario');
  END IF;
  INSERT INTO public.profiles(id, org_id, full_name, email)
  VALUES (NEW.id, _org, COALESCE(NEW.raw_user_meta_data->>'full_name',''), NEW.email);
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================
-- PATIENTS
-- =========================
CREATE TABLE public.patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  phone text,
  email text,
  birth_date date,
  profession text,
  city text,
  source text,
  referred_by text,
  status public.patient_status NOT NULL DEFAULT 'lead',
  entry_date date NOT NULL DEFAULT current_date,
  notes text,
  emergency_contact text,
  emergency_phone text,
  consent_accepted boolean NOT NULL DEFAULT false,
  consent_accepted_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_patients_org_status ON public.patients(org_id, status);
CREATE INDEX idx_patients_org_name ON public.patients(org_id, full_name);

CREATE TABLE public.patient_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  from_status public.patient_status,
  to_status public.patient_status NOT NULL,
  changed_by uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_psh_patient ON public.patient_status_history(patient_id, created_at DESC);

CREATE TABLE public.clinical_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  appointment_id uuid,
  record_type text NOT NULL DEFAULT 'evolucao',
  record_date date NOT NULL DEFAULT current_date,
  objective text,
  anamnesis text,
  clinical_history text,
  medications text,
  supplements text,
  exams text,
  restrictions text,
  routine text,
  sleep text,
  training text,
  symptoms text,
  evolution text,
  strategies text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_clinical_patient ON public.clinical_records(patient_id, record_date DESC);

CREATE TABLE public.anthropometry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  measured_at date NOT NULL DEFAULT current_date,
  weight_kg numeric(6,2),
  height_cm numeric(6,2),
  body_fat_pct numeric(5,2),
  lean_mass_kg numeric(6,2),
  waist_cm numeric(6,2),
  hip_cm numeric(6,2),
  abdomen_cm numeric(6,2),
  arm_cm numeric(6,2),
  thigh_cm numeric(6,2),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_anthro_patient ON public.anthropometry(patient_id, measured_at DESC);

-- =========================
-- COMMERCIAL
-- =========================
CREATE TABLE public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  line text NOT NULL,
  duration_months integer NOT NULL CHECK (duration_months > 0),
  consultations integer NOT NULL DEFAULT 0,
  installment_count integer NOT NULL DEFAULT 1,
  installment_price numeric(12,2) NOT NULL DEFAULT 0,
  card_total numeric(12,2) NOT NULL DEFAULT 0,
  pix_price numeric(12,2) NOT NULL DEFAULT 0,
  benefits text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_plans_org ON public.plans(org_id, active);

CREATE TABLE public.opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  title text NOT NULL,
  stage public.funnel_stage NOT NULL DEFAULT 'novo_lead',
  source text,
  owner_id uuid,
  plan_id uuid REFERENCES public.plans(id) ON DELETE SET NULL,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  payment_method public.payment_method,
  probability integer NOT NULL DEFAULT 50 CHECK (probability BETWEEN 0 AND 100),
  next_action text,
  next_action_date date,
  loss_reason text,
  notes text,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_opp_org_stage ON public.opportunities(org_id, stage);

CREATE TABLE public.opportunity_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'contato',
  description text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_oppact_opp ON public.opportunity_activities(opportunity_id, created_at DESC);

CREATE TABLE public.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.plans(id) ON DELETE SET NULL,
  opportunity_id uuid REFERENCES public.opportunities(id) ON DELETE SET NULL,
  sale_date date NOT NULL DEFAULT current_date,
  gross_amount numeric(12,2) NOT NULL DEFAULT 0,
  discount_amount numeric(12,2) NOT NULL DEFAULT 0,
  net_amount numeric(12,2) NOT NULL DEFAULT 0,
  payment_method public.payment_method NOT NULL DEFAULT 'pix',
  installments integer NOT NULL DEFAULT 1,
  down_payment numeric(12,2) NOT NULL DEFAULT 0,
  is_renewal boolean NOT NULL DEFAULT false,
  cancelled boolean NOT NULL DEFAULT false,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sales_org_date ON public.sales(org_id, sale_date DESC);
CREATE INDEX idx_sales_patient ON public.sales(patient_id);

CREATE TABLE public.contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.plans(id) ON DELETE SET NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  months integer NOT NULL,
  consultations_included integer NOT NULL DEFAULT 0,
  status public.contract_status NOT NULL DEFAULT 'ativo',
  expected_renewal_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_contracts_org ON public.contracts(org_id, status);
CREATE INDEX idx_contracts_patient ON public.contracts(patient_id);

-- =========================
-- FINANCE
-- =========================
CREATE TABLE public.financial_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  account_type public.account_type NOT NULL DEFAULT 'banco',
  initial_balance numeric(14,2) NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_accounts_org ON public.financial_accounts(org_id);

CREATE TABLE public.cost_centers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'despesa',
  dre_group public.dre_group NOT NULL DEFAULT 'despesas_operacionais',
  parent_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_categories_org ON public.categories(org_id, kind);

CREATE TABLE public.receivables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  sale_id uuid REFERENCES public.sales(id) ON DELETE CASCADE,
  contract_id uuid REFERENCES public.contracts(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  account_id uuid REFERENCES public.financial_accounts(id) ON DELETE SET NULL,
  description text NOT NULL,
  installment_number integer NOT NULL DEFAULT 1,
  installment_total integer NOT NULL DEFAULT 1,
  due_date date NOT NULL,
  expected_amount numeric(12,2) NOT NULL DEFAULT 0,
  received_amount numeric(12,2) NOT NULL DEFAULT 0,
  status public.receivable_status NOT NULL DEFAULT 'previsto',
  payment_method public.payment_method,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_recv_org_due ON public.receivables(org_id, due_date);
CREATE INDEX idx_recv_patient ON public.receivables(patient_id);

CREATE TABLE public.payables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  cost_center_id uuid REFERENCES public.cost_centers(id) ON DELETE SET NULL,
  account_id uuid REFERENCES public.financial_accounts(id) ON DELETE SET NULL,
  description text NOT NULL,
  supplier text,
  competence_date date NOT NULL DEFAULT current_date,
  due_date date NOT NULL DEFAULT current_date,
  expected_amount numeric(12,2) NOT NULL DEFAULT 0,
  paid_amount numeric(12,2) NOT NULL DEFAULT 0,
  status public.payable_status NOT NULL DEFAULT 'previsto',
  payment_method public.payment_method,
  recurrence text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pay_org_due ON public.payables(org_id, due_date);

CREATE TABLE public.cash_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.financial_accounts(id) ON DELETE CASCADE,
  receivable_id uuid REFERENCES public.receivables(id) ON DELETE SET NULL,
  payable_id uuid REFERENCES public.payables(id) ON DELETE SET NULL,
  patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  direction text NOT NULL CHECK (direction IN ('entrada','saida')),
  settled_at date NOT NULL DEFAULT current_date,
  amount numeric(12,2) NOT NULL,
  description text NOT NULL,
  payment_method public.payment_method,
  is_reversal boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cash_org_date ON public.cash_transactions(org_id, settled_at);

CREATE TABLE public.revenue_recognition (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contract_id uuid REFERENCES public.contracts(id) ON DELETE CASCADE,
  sale_id uuid REFERENCES public.sales(id) ON DELETE CASCADE,
  patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  competence_date date NOT NULL,
  gross_amount numeric(12,2) NOT NULL DEFAULT 0,
  deduction_amount numeric(12,2) NOT NULL DEFAULT 0,
  cancelled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_rev_org_comp ON public.revenue_recognition(org_id, competence_date);

-- =========================
-- AGENDA
-- =========================
CREATE TABLE public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  professional_id uuid,
  starts_at timestamptz NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 60,
  mode public.appointment_mode NOT NULL DEFAULT 'presencial',
  appointment_type text NOT NULL DEFAULT 'consulta',
  status public.appointment_status NOT NULL DEFAULT 'agendada',
  notes text,
  reminder_sent boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_appt_org_start ON public.appointments(org_id, starts_at);
CREATE INDEX idx_appt_patient ON public.appointments(patient_id, starts_at DESC);

ALTER TABLE public.clinical_records
  ADD CONSTRAINT clinical_records_appointment_fkey
  FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE SET NULL;

-- =========================
-- GRANTS
-- =========================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations, public.profiles, public.user_roles,
  public.audit_log, public.patients, public.patient_status_history, public.clinical_records,
  public.anthropometry, public.plans, public.opportunities, public.opportunity_activities,
  public.sales, public.contracts, public.financial_accounts, public.cost_centers, public.categories,
  public.receivables, public.payables, public.cash_transactions, public.revenue_recognition,
  public.appointments TO authenticated;
GRANT ALL ON public.organizations, public.profiles, public.user_roles,
  public.audit_log, public.patients, public.patient_status_history, public.clinical_records,
  public.anthropometry, public.plans, public.opportunities, public.opportunity_activities,
  public.sales, public.contracts, public.financial_accounts, public.cost_centers, public.categories,
  public.receivables, public.payables, public.cash_transactions, public.revenue_recognition,
  public.appointments TO service_role;

-- =========================
-- RLS
-- =========================
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anthropometry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receivables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revenue_recognition ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org visible to members" ON public.organizations FOR SELECT TO authenticated
  USING (id = public.current_org_id());
CREATE POLICY "org admin update" ON public.organizations FOR UPDATE TO authenticated
  USING (id = public.current_org_id() AND public.is_admin());

CREATE POLICY "profiles same org read" ON public.profiles FOR SELECT TO authenticated
  USING (org_id = public.current_org_id());
CREATE POLICY "profiles self update" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "roles read self" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "roles admin manage" ON public.user_roles FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "audit read admin" ON public.audit_log FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() AND public.is_admin());
CREATE POLICY "audit insert members" ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org_id());

-- patients: any member of the org can read/write, delete admin only
CREATE POLICY "patients read" ON public.patients FOR SELECT TO authenticated
  USING (org_id = public.current_org_id());
CREATE POLICY "patients insert" ON public.patients FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org_id());
CREATE POLICY "patients update" ON public.patients FOR UPDATE TO authenticated
  USING (org_id = public.current_org_id()) WITH CHECK (org_id = public.current_org_id());
CREATE POLICY "patients delete admin" ON public.patients FOR DELETE TO authenticated
  USING (org_id = public.current_org_id() AND public.is_admin());

CREATE POLICY "psh read" ON public.patient_status_history FOR SELECT TO authenticated
  USING (org_id = public.current_org_id());
CREATE POLICY "psh insert" ON public.patient_status_history FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org_id());

-- clinical: restricted to clinical roles
CREATE POLICY "clinical read" ON public.clinical_records FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() AND public.can_view_clinical());
CREATE POLICY "clinical insert" ON public.clinical_records FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org_id() AND public.can_view_clinical());
CREATE POLICY "clinical update" ON public.clinical_records FOR UPDATE TO authenticated
  USING (org_id = public.current_org_id() AND public.can_view_clinical())
  WITH CHECK (org_id = public.current_org_id() AND public.can_view_clinical());
CREATE POLICY "clinical delete admin" ON public.clinical_records FOR DELETE TO authenticated
  USING (org_id = public.current_org_id() AND public.is_admin());

CREATE POLICY "anthro read" ON public.anthropometry FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() AND public.can_view_clinical());
CREATE POLICY "anthro write" ON public.anthropometry FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org_id() AND public.can_view_clinical());
CREATE POLICY "anthro update" ON public.anthropometry FOR UPDATE TO authenticated
  USING (org_id = public.current_org_id() AND public.can_view_clinical())
  WITH CHECK (org_id = public.current_org_id() AND public.can_view_clinical());
CREATE POLICY "anthro delete admin" ON public.anthropometry FOR DELETE TO authenticated
  USING (org_id = public.current_org_id() AND public.is_admin());

-- plans / opportunities / sales / contracts: commercial roles
CREATE POLICY "plans read" ON public.plans FOR SELECT TO authenticated
  USING (org_id = public.current_org_id());
CREATE POLICY "plans manage" ON public.plans FOR ALL TO authenticated
  USING (org_id = public.current_org_id() AND public.can_view_commercial())
  WITH CHECK (org_id = public.current_org_id() AND public.can_view_commercial());

CREATE POLICY "opp read" ON public.opportunities FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() AND public.can_view_commercial());
CREATE POLICY "opp manage" ON public.opportunities FOR ALL TO authenticated
  USING (org_id = public.current_org_id() AND public.can_view_commercial())
  WITH CHECK (org_id = public.current_org_id() AND public.can_view_commercial());

CREATE POLICY "oppact read" ON public.opportunity_activities FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() AND public.can_view_commercial());
CREATE POLICY "oppact manage" ON public.opportunity_activities FOR ALL TO authenticated
  USING (org_id = public.current_org_id() AND public.can_view_commercial())
  WITH CHECK (org_id = public.current_org_id() AND public.can_view_commercial());

CREATE POLICY "sales read" ON public.sales FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() AND public.can_view_commercial());
CREATE POLICY "sales manage" ON public.sales FOR ALL TO authenticated
  USING (org_id = public.current_org_id() AND public.can_view_commercial())
  WITH CHECK (org_id = public.current_org_id() AND public.can_view_commercial());

CREATE POLICY "contracts read" ON public.contracts FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() AND public.can_view_commercial());
CREATE POLICY "contracts manage" ON public.contracts FOR ALL TO authenticated
  USING (org_id = public.current_org_id() AND public.can_view_commercial())
  WITH CHECK (org_id = public.current_org_id() AND public.can_view_commercial());

-- finance: financial roles only
CREATE POLICY "accounts read" ON public.financial_accounts FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() AND public.can_view_financial());
CREATE POLICY "accounts manage" ON public.financial_accounts FOR ALL TO authenticated
  USING (org_id = public.current_org_id() AND public.can_view_financial())
  WITH CHECK (org_id = public.current_org_id() AND public.can_view_financial());

CREATE POLICY "cc read" ON public.cost_centers FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() AND public.can_view_financial());
CREATE POLICY "cc manage" ON public.cost_centers FOR ALL TO authenticated
  USING (org_id = public.current_org_id() AND public.can_view_financial())
  WITH CHECK (org_id = public.current_org_id() AND public.can_view_financial());

CREATE POLICY "cat read" ON public.categories FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() AND public.can_view_financial());
CREATE POLICY "cat manage" ON public.categories FOR ALL TO authenticated
  USING (org_id = public.current_org_id() AND public.can_view_financial())
  WITH CHECK (org_id = public.current_org_id() AND public.can_view_financial());

CREATE POLICY "recv read" ON public.receivables FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() AND public.can_view_financial());
CREATE POLICY "recv manage" ON public.receivables FOR ALL TO authenticated
  USING (org_id = public.current_org_id() AND public.can_view_financial())
  WITH CHECK (org_id = public.current_org_id() AND public.can_view_financial());

CREATE POLICY "pay read" ON public.payables FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() AND public.can_view_financial());
CREATE POLICY "pay manage" ON public.payables FOR ALL TO authenticated
  USING (org_id = public.current_org_id() AND public.can_view_financial())
  WITH CHECK (org_id = public.current_org_id() AND public.can_view_financial());

CREATE POLICY "cash read" ON public.cash_transactions FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() AND public.can_view_financial());
CREATE POLICY "cash manage" ON public.cash_transactions FOR ALL TO authenticated
  USING (org_id = public.current_org_id() AND public.can_view_financial())
  WITH CHECK (org_id = public.current_org_id() AND public.can_view_financial());

CREATE POLICY "rev read" ON public.revenue_recognition FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() AND public.can_view_financial());
CREATE POLICY "rev manage" ON public.revenue_recognition FOR ALL TO authenticated
  USING (org_id = public.current_org_id() AND public.can_view_financial())
  WITH CHECK (org_id = public.current_org_id() AND public.can_view_financial());

CREATE POLICY "appt read" ON public.appointments FOR SELECT TO authenticated
  USING (org_id = public.current_org_id());
CREATE POLICY "appt insert" ON public.appointments FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org_id());
CREATE POLICY "appt update" ON public.appointments FOR UPDATE TO authenticated
  USING (org_id = public.current_org_id()) WITH CHECK (org_id = public.current_org_id());
CREATE POLICY "appt delete admin" ON public.appointments FOR DELETE TO authenticated
  USING (org_id = public.current_org_id() AND public.is_admin());

-- =========================
-- updated_at triggers
-- =========================
CREATE TRIGGER t_profiles_upd BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_patients_upd BEFORE UPDATE ON public.patients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_clinical_upd BEFORE UPDATE ON public.clinical_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_plans_upd BEFORE UPDATE ON public.plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_opp_upd BEFORE UPDATE ON public.opportunities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_sales_upd BEFORE UPDATE ON public.sales FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_contracts_upd BEFORE UPDATE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_recv_upd BEFORE UPDATE ON public.receivables FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_pay_upd BEFORE UPDATE ON public.payables FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_appt_upd BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- audit trigger for critical tables
-- =========================
CREATE OR REPLACE FUNCTION public.audit_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _org uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN _org := OLD.org_id; ELSE _org := NEW.org_id; END IF;
  INSERT INTO public.audit_log(org_id, actor_id, table_name, record_id, action, before_data, after_data)
  VALUES (_org, auth.uid(), TG_TABLE_NAME,
    CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END, TG_OP,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END);
  RETURN NULL;
END; $$;

CREATE TRIGGER a_clinical AFTER INSERT OR UPDATE OR DELETE ON public.clinical_records FOR EACH ROW EXECUTE FUNCTION public.audit_changes();
CREATE TRIGGER a_sales AFTER INSERT OR UPDATE OR DELETE ON public.sales FOR EACH ROW EXECUTE FUNCTION public.audit_changes();
CREATE TRIGGER a_recv AFTER INSERT OR UPDATE OR DELETE ON public.receivables FOR EACH ROW EXECUTE FUNCTION public.audit_changes();
CREATE TRIGGER a_cash AFTER INSERT OR UPDATE OR DELETE ON public.cash_transactions FOR EACH ROW EXECUTE FUNCTION public.audit_changes();
CREATE TRIGGER a_contracts AFTER INSERT OR UPDATE OR DELETE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.audit_changes();
CREATE TRIGGER a_patients AFTER UPDATE OR DELETE ON public.patients FOR EACH ROW EXECUTE FUNCTION public.audit_changes();
