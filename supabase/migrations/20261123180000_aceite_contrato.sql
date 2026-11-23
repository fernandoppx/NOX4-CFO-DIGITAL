-- =====================================================================
-- NOX4 — Registro do aceite do Contrato de Licença de Uso e do envio por e-mail
-- Rodar no SQL Editor do Supabase. Pode ser rodado mais de uma vez.
-- =====================================================================

alter table public.subscriptions add column if not exists billing_email text;
alter table public.subscriptions add column if not exists company_name text;
alter table public.subscriptions add column if not exists contract_version text;
alter table public.subscriptions add column if not exists contract_accepted_at timestamptz;
alter table public.subscriptions add column if not exists contract_accepted_ip text;
alter table public.subscriptions add column if not exists contract_email_sent_at timestamptz;

comment on column public.subscriptions.contract_version     is 'Versão do contrato aceita no checkout (ex.: 1.0)';
comment on column public.subscriptions.contract_accepted_at is 'Data/hora do aceite eletrônico no checkout';
comment on column public.subscriptions.contract_email_sent_at is 'Quando o contrato foi enviado por e-mail (evita reenvio)';
