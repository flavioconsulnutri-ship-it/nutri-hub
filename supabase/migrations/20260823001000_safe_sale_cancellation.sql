alter table public.sales
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid,
  add column if not exists cancellation_reason text;

comment on column public.sales.cancellation_reason is
  'Motivo obrigatorio para preservar a auditoria do cancelamento da venda.';

create or replace function public.cancel_sale_safely(_sale_id uuid, _reason text)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_sale public.sales%rowtype;
  v_patient_status public.patient_status;
begin
  if length(trim(coalesce(_reason, ''))) < 5 then
    raise exception 'Informe um motivo com pelo menos 5 caracteres.';
  end if;

  select * into v_sale
  from public.sales
  where id = _sale_id
    and org_id = public.current_org_id()
  for update;

  if not found then
    raise exception 'Venda nao encontrada.';
  end if;
  if v_sale.cancelled then
    raise exception 'Esta venda ja esta cancelada.';
  end if;
  if exists (
    select 1 from public.receivables
    where sale_id = _sale_id
      and (received_amount > 0 or status in ('recebido', 'parcialmente_recebido'))
  ) then
    raise exception 'A venda possui valor recebido. Estorne o recebimento antes de cancelar.';
  end if;

  update public.sales
  set cancelled = true,
      cancelled_at = now(),
      cancelled_by = auth.uid(),
      cancellation_reason = trim(_reason)
  where id = _sale_id;

  update public.receivables
  set status = 'cancelado'
  where sale_id = _sale_id
    and status not in ('recebido', 'parcialmente_recebido', 'estornado');

  update public.revenue_recognition
  set cancelled = true
  where sale_id = _sale_id;

  update public.contracts
  set status = 'cancelado'
  where sale_id = _sale_id;

  if v_sale.opportunity_id is not null then
    update public.opportunities
    set stage = 'aguardando_pagamento',
        closed_at = null,
        plan_id = null,
        payment_method = null,
        amount = 0,
        next_action = 'Revisar condicoes e refazer venda',
        next_action_details = trim(_reason),
        next_action_date = current_date
    where id = v_sale.opportunity_id;

    update public.crm_tasks
    set status = 'cancelada', completed_at = now()
    where opportunity_id = v_sale.opportunity_id
      and status = 'pendente';

    insert into public.opportunity_activities (
      org_id, opportunity_id, kind, description, created_by
    ) values (
      v_sale.org_id,
      v_sale.opportunity_id,
      'venda_cancelada',
      'Venda cancelada e oportunidade reaberta. Motivo: ' || trim(_reason),
      auth.uid()
    );
  end if;

  update public.leads
  set converted_at = null
  where converted_patient_id = v_sale.patient_id;

  if not exists (
    select 1 from public.contracts
    where patient_id = v_sale.patient_id and status = 'ativo'
  ) then
    select status into v_patient_status
    from public.patients
    where id = v_sale.patient_id;

    if v_patient_status is distinct from 'lead'::public.patient_status then
      update public.patients
      set status = 'lead'
      where id = v_sale.patient_id;

      insert into public.patient_status_history (
        org_id, patient_id, from_status, to_status, changed_by, note
      ) values (
        v_sale.org_id,
        v_sale.patient_id,
        v_patient_status,
        'lead',
        auth.uid(),
        'Venda cancelada: ' || trim(_reason)
      );
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'opportunityId', v_sale.opportunity_id,
    'patientId', v_sale.patient_id
  );
end;
$$;

grant execute on function public.cancel_sale_safely(uuid, text) to authenticated;

notify pgrst, 'reload schema';
