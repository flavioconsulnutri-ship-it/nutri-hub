-- Separa as parcelas cobradas do cliente do repasse efetivo ao consultorio.
alter table public.sales
  add column if not exists settlement_mode text not null default 'integral'
    check (settlement_mode in ('integral', 'parcelado')),
  add column if not exists settlement_date date,
  add column if not exists card_fee_percent numeric(7,4) not null default 0,
  add column if not exists anticipation_fee_percent numeric(7,4) not null default 0,
  add column if not exists processing_fee_amount numeric(12,2) not null default 0,
  add column if not exists expected_cash_amount numeric(12,2) not null default 0;

comment on column public.sales.installments is
  'Quantidade de parcelas cobradas do cliente; nao define a agenda de repasse ao consultorio.';
comment on column public.sales.settlement_mode is
  'Forma como o consultorio recebe: integral em uma data ou parcelado conforme a agenda de repasse.';
comment on column public.sales.processing_fee_amount is
  'Taxas de cartao e antecipacao, registradas separadamente do desconto comercial.';
comment on column public.sales.expected_cash_amount is
  'Valor liquido previsto para entrar no caixa depois das taxas de processamento.';
