-- =====================================================================
-- NOX4 — Contrato de Licença de Uso: aceite, dados do cliente e PDF gerado
-- Rodar no SQL Editor do Supabase. Pode ser rodado mais de uma vez.
-- =====================================================================

-- Dados do cliente informados no checkout (vão preenchidos no contrato)
alter table public.subscriptions add column if not exists company_name text;
alter table public.subscriptions add column if not exists cpf_cnpj text;
alter table public.subscriptions add column if not exists billing_email text;
alter table public.subscriptions add column if not exists phone text;

-- Condição comercial contratada (congelada no momento da compra)
alter table public.subscriptions add column if not exists promo_label text;
alter table public.subscriptions add column if not exists promo_price numeric(10,2);
alter table public.subscriptions add column if not exists promo_cycles integer;
alter table public.subscriptions add column if not exists promo_cycles_remaining integer not null default 0;
alter table public.subscriptions add column if not exists regular_price numeric(10,2);

-- Aceite e documento gerado
alter table public.subscriptions add column if not exists contract_version text;
alter table public.subscriptions add column if not exists contract_accepted_at timestamptz;
alter table public.subscriptions add column if not exists contract_accepted_ip text;
alter table public.subscriptions add column if not exists contract_pdf_path text;
alter table public.subscriptions add column if not exists contract_pdf_sha256 text;
alter table public.subscriptions add column if not exists contract_email_sent_at timestamptz;

comment on column public.subscriptions.contract_accepted_at  is 'Data/hora do aceite eletrônico no checkout';
comment on column public.subscriptions.contract_pdf_path     is 'Caminho do PDF no bucket privado contracts';
comment on column public.subscriptions.contract_pdf_sha256   is 'Hash do PDF enviado ao cliente (integridade)';
comment on column public.subscriptions.contract_email_sent_at is 'Quando o contrato foi enviado (evita reenvio)';

-- Bucket privado para os contratos em PDF (só Edge Functions com service role acessam)
insert into storage.buckets (id, name, public)
values ('contracts', 'contracts', false)
on conflict (id) do nothing;
