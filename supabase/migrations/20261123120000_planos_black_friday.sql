-- =====================================================================
-- NOX4 — Nova tabela de planos (Essencial, Profissional, Grupo)
--        + oferta de Black Friday válida até 31/12/2026
--
-- ORDEM DE APLICAÇÃO (importante):
--   1. Atualizar as Edge Functions do Asaas para ler promo_price/promo_cycles
--      (ver docs/asaas-black-friday.md). Sem isso, a tela mostra o preço
--      promocional mas o Asaas cobra o preço cheio.
--   2. Rodar este script no SQL Editor do Supabase.
--
-- Os planos antigos (NOX4 Mensal / NOX4 Anual) são DESATIVADOS, não apagados:
-- assinaturas existentes continuam apontando para eles e mantêm o preço atual.
-- O script pode ser rodado mais de uma vez sem duplicar planos.
-- =====================================================================

-- 1) Novas colunas
alter table public.plans add column if not exists tier text;
alter table public.plans add column if not exists tier_order integer;
alter table public.plans add column if not exists highlight boolean not null default false;
alter table public.plans add column if not exists extra_company_price numeric(10,2);
alter table public.plans add column if not exists promo_label text;
alter table public.plans add column if not exists promo_price numeric(10,2);
alter table public.plans add column if not exists promo_cycles integer;
alter table public.plans add column if not exists promo_starts_at timestamptz;
alter table public.plans add column if not exists promo_ends_at timestamptz;

comment on column public.plans.promo_price  is 'Valor cobrado por ciclo (mês ou ano) durante a promoção';
comment on column public.plans.promo_cycles is 'Quantidade de ciclos cobrados com promo_price; depois volta ao preço cheio';

-- 2) Desativa os planos antigos (sem tier)
update public.plans
   set active = false
 where tier is null
   and active = true;

-- 3) Novos planos
--    base_price  = valor mensal (no anual, o equivalente por mês, só para exibição)
--    annual_price = valor cobrado por ano (só nos anuais)
with novos (name, tier, tier_order, highlight, billing_cycle, base_price, annual_price,
            max_organizations, included_users, extra_user_price, extra_company_price,
            promo_price, promo_cycles) as (
  values
    ('NOX4 Essencial Mensal',     'essencial',    1, false, 'monthly', 149.00, null::numeric,   1,  2, 29.90, 99.00, 104.30, 3),
    ('NOX4 Essencial Anual',      'essencial',    1, false, 'yearly',  124.17, 1490.00,         1,  2, 29.90, 99.00, 894.00, 1),
    ('NOX4 Profissional Mensal',  'profissional', 2, true,  'monthly', 249.00, null::numeric,   1,  5, 29.90, 99.00, 174.30, 3),
    ('NOX4 Profissional Anual',   'profissional', 2, true,  'yearly',  207.50, 2490.00,         1,  5, 29.90, 99.00, 1494.00, 1),
    ('NOX4 Grupo Mensal',         'grupo',        3, false, 'monthly', 449.00, null::numeric,   3, 10, 29.90, 99.00, 314.30, 3),
    ('NOX4 Grupo Anual',          'grupo',        3, false, 'yearly',  374.17, 4490.00,         3, 10, 29.90, 99.00, 2694.00, 1)
)
insert into public.plans (name, tier, tier_order, highlight, billing_cycle, base_price, annual_price,
                          max_organizations, included_users, extra_user_price, extra_company_price,
                          promo_label, promo_price, promo_cycles, promo_starts_at, promo_ends_at, active)
select n.name, n.tier, n.tier_order, n.highlight, n.billing_cycle, n.base_price, n.annual_price,
       n.max_organizations, n.included_users, n.extra_user_price, n.extra_company_price,
       'Black Friday', n.promo_price, n.promo_cycles,
       '2026-11-24 00:00:00-03'::timestamptz, '2026-12-31 23:59:59-03'::timestamptz, true
  from novos n
 where not exists (select 1 from public.plans p where p.name = n.name);

-- Planos anuais herdam o dia de renovação usado pelo plano anual antigo
update public.plans novo
   set renewal_month = antigo.renewal_month,
       renewal_day   = antigo.renewal_day
  from (select renewal_month, renewal_day
          from public.plans
         where tier is null and billing_cycle = 'yearly'
         order by created_at
         limit 1) antigo
 where novo.tier is not null
   and novo.billing_cycle = 'yearly'
   and novo.renewal_month is null;

-- 4) Conferência
select name, billing_cycle, base_price, annual_price, included_users, max_organizations,
       promo_label, promo_price, promo_cycles, promo_ends_at, active
  from public.plans
 order by active desc, tier_order nulls last, billing_cycle;

-- Para encerrar a promoção antes do prazo:
--   update public.plans set promo_ends_at = now() where promo_label = 'Black Friday';
