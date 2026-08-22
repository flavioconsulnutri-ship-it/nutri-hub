-- Mantém um histórico estruturado de todas as mudanças do funil.
-- O registro acontece no banco para cobrir alterações manuais e automáticas.

create table if not exists public.opportunity_stage_history (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  from_stage public.funnel_stage,
  to_stage public.funnel_stage not null,
  changed_by uuid,
  changed_at timestamptz not null default now()
);

create index if not exists idx_opportunity_stage_history_timeline
  on public.opportunity_stage_history(opportunity_id, changed_at desc);

alter table public.opportunity_stage_history enable row level security;

drop policy if exists "opportunity stage history read" on public.opportunity_stage_history;
create policy "opportunity stage history read"
  on public.opportunity_stage_history
  for select
  to authenticated
  using (
    org_id = public.current_org_id()
    and public.can_view_commercial()
  );

grant select on public.opportunity_stage_history to authenticated;

create or replace function public.track_opportunity_stage_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.opportunity_stage_history (
      org_id,
      opportunity_id,
      from_stage,
      to_stage,
      changed_by,
      changed_at
    ) values (
      new.org_id,
      new.id,
      null,
      new.stage,
      auth.uid(),
      new.created_at
    );
  elsif old.stage is distinct from new.stage then
    insert into public.opportunity_stage_history (
      org_id,
      opportunity_id,
      from_stage,
      to_stage,
      changed_by
    ) values (
      new.org_id,
      new.id,
      old.stage,
      new.stage,
      auth.uid()
    );
  end if;

  return new;
end;
$$;

revoke all on function public.track_opportunity_stage_change() from public, anon, authenticated;

drop trigger if exists trg_track_opportunity_stage_change on public.opportunities;
create trigger trg_track_opportunity_stage_change
after insert or update of stage on public.opportunities
for each row
execute function public.track_opportunity_stage_change();

-- Cria o ponto inicial para oportunidades existentes, sem inventar etapas anteriores.
insert into public.opportunity_stage_history (
  org_id,
  opportunity_id,
  from_stage,
  to_stage,
  changed_by,
  changed_at
)
select
  opportunity.org_id,
  opportunity.id,
  null,
  opportunity.stage,
  opportunity.owner_id,
  opportunity.created_at
from public.opportunities as opportunity
where not exists (
  select 1
  from public.opportunity_stage_history as history
  where history.opportunity_id = opportunity.id
);
