-- Metas comerciais mensais essenciais: faturamento vendido e quantidade de vendas.

create table if not exists public.commercial_goals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  month date not null,
  revenue_target numeric(12, 2) not null check (revenue_target > 0),
  sales_target integer not null check (sales_target > 0),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, month),
  check (month = date_trunc('month', month)::date)
);

alter table public.commercial_goals enable row level security;

grant select, insert, update, delete on public.commercial_goals to authenticated;
grant all on public.commercial_goals to service_role;

drop policy if exists "commercial goals read" on public.commercial_goals;
create policy "commercial goals read"
  on public.commercial_goals
  for select
  to authenticated
  using (
    org_id = public.current_org_id()
    and public.can_view_commercial()
  );

drop policy if exists "commercial goals manage" on public.commercial_goals;
create policy "commercial goals manage"
  on public.commercial_goals
  for all
  to authenticated
  using (
    org_id = public.current_org_id()
    and public.can_view_commercial()
  )
  with check (
    org_id = public.current_org_id()
    and public.can_view_commercial()
  );

drop trigger if exists t_commercial_goals_upd on public.commercial_goals;
create trigger t_commercial_goals_upd
before update on public.commercial_goals
for each row
execute function public.update_updated_at_column();
