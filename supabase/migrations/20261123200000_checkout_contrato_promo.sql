-- =====================================================================
-- NOX4 — Aceite do contrato, promoção e contrato em PDF na sessão de checkout
-- (fonte usada por asaas-start-checkout, asaas-webhook e generate-contract)
-- Pode ser rodado mais de uma vez.
-- =====================================================================

alter table public.checkout_sessions add column if not exists contract_version text;
alter table public.checkout_sessions add column if not exists contract_accepted_at timestamptz;
alter table public.checkout_sessions add column if not exists contract_accepted_ip text;
alter table public.checkout_sessions add column if not exists contract_pdf_path text;
alter table public.checkout_sessions add column if not exists contract_pdf_sha256 text;
alter table public.checkout_sessions add column if not exists contract_email_sent_at timestamptz;

alter table public.checkout_sessions add column if not exists regular_price numeric(10,2);
alter table public.checkout_sessions add column if not exists promo_label text;
alter table public.checkout_sessions add column if not exists promo_price numeric(10,2);
alter table public.checkout_sessions add column if not exists promo_cycles integer;
alter table public.checkout_sessions add column if not exists promo_cycles_remaining integer not null default 0;
alter table public.checkout_sessions add column if not exists promo_paid_payment_ids text[] not null default '{}';

comment on column public.checkout_sessions.promo_cycles_remaining is 'Ciclos completos que ainda serão cobrados com promo_price';
comment on column public.checkout_sessions.promo_paid_payment_ids is 'Pagamentos já contados na promoção (idempotência do webhook)';
