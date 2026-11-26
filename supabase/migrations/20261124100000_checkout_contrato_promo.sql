-- =====================================================================
-- NOX4 — Checkout: plano legado visível, aceite do contrato e promoção
-- 2026-11-24 · Pode ser rodado mais de uma vez.
-- =====================================================================

-- 1) Assinante continua vendo o plano que contratou, mesmo que o plano tenha
--    sido desativado para novas vendas (ex.: NOX4 Mensal / NOX4 Anual).
drop policy if exists plans_select_subscribed on public.plans;
create policy plans_select_subscribed on public.plans
  for select to authenticated
  using (
    exists (
      select 1
        from public.subscriptions s
        join public.organization_members m on m.organization_id = s.organization_id
       where s.plan_id = plans.id
         and m.user_id = auth.uid()
    )
  );

-- 2) Dados do aceite e da condição comercial gravados no início do checkout.
--    No pagamento, o webhook copia para a tabela subscriptions.
alter table public.checkout_sessions add column if not exists contract_version text;
alter table public.checkout_sessions add column if not exists contract_accepted_at timestamptz;
alter table public.checkout_sessions add column if not exists contract_accepted_ip text;
alter table public.checkout_sessions add column if not exists promo_label text;
alter table public.checkout_sessions add column if not exists promo_price numeric(10,2);
alter table public.checkout_sessions add column if not exists promo_cycles integer;
alter table public.checkout_sessions add column if not exists regular_price numeric(10,2);

-- 3) Pagamentos já processados pelo webhook (o Asaas pode reenviar o mesmo evento).
create table if not exists public.asaas_processed_payments (
  payment_id text primary key,
  event text,
  processed_at timestamptz not null default now()
);
alter table public.asaas_processed_payments enable row level security;
