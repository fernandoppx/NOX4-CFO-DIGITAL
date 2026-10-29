-- =====================================================================
-- NOX4 CFO Digital — Persistência financeira no banco
-- 2026-10-29
--
-- 1. Plano de contas e centro de resultado padrão para toda empresa
--    (novas e existentes), para o cliente conseguir lançar desde o 1º acesso.
-- 2. Tabelas bank_accounts e budgets (antes ficavam só no navegador).
-- 3. Segurança: funções SECURITY DEFINER deixam de ser executáveis
--    por quem não precisa (anon / usuários logados).
-- 4. Corrige a política de exclusão de empresa (comparava om.id).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Plano de contas padrão
-- ---------------------------------------------------------------------
create or replace function public.seed_company_financial_defaults(p_company_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if p_company_id is null then
    return;
  end if;

  if not exists (select 1 from public.revenue_categories where company_id = p_company_id) then
    insert into public.revenue_categories (company_id, name, type, active) values
      (p_company_id, 'Receita de Serviços Prestados', 'services', true),
      (p_company_id, 'Receita Recorrente (Assinatura / MRR)', 'recurring', true),
      (p_company_id, 'Receita de Consultorias / Setup', 'non_recurring', true),
      (p_company_id, 'Receita de Venda de Produtos', 'products', true),
      (p_company_id, 'Outras Receitas Operacionais', 'other_operational', true),
      (p_company_id, 'Receitas Financeiras & Rendimentos', 'financial', true);
  end if;

  if not exists (select 1 from public.expense_categories where company_id = p_company_id) then
    insert into public.expense_categories (company_id, name, "group", type, active) values
      (p_company_id, 'Impostos sobre Faturamento (Simples/ISS)', 'deductions', 'variable', true),
      (p_company_id, 'Taxas de Meios de Pagamento & Gateway', 'deductions', 'variable', true),
      (p_company_id, 'Descontos Concedidos', 'deductions', 'variable', true),
      (p_company_id, 'Custos Diretos com Prestadores & Freelancers', 'cost_of_services', 'variable', true),
      (p_company_id, 'Softwares & Ferramentas Diretas de Entrega', 'cost_of_services', 'fixed', true),
      (p_company_id, 'Tráfego Pago (Meta Ads & Google Ads)', 'commercial', 'variable', true),
      (p_company_id, 'Comissões Comerciais de Vendas', 'commercial', 'variable', true),
      (p_company_id, 'Ferramentas Comerciais & CRM', 'commercial', 'fixed', true),
      (p_company_id, 'Pró-labore dos Sócios', 'administrative', 'fixed', true),
      (p_company_id, 'Salários & Encargos Administrativos', 'administrative', 'fixed', true),
      (p_company_id, 'Contabilidade & Assessoria Jurídica', 'administrative', 'fixed', true),
      (p_company_id, 'Aluguel, Condomínio & Escritório', 'administrative', 'fixed', true),
      (p_company_id, 'Assinaturas & Softwares de Gestão', 'administrative', 'fixed', true),
      (p_company_id, 'Servidores em Nuvem & Infraestrutura Tech', 'operational', 'fixed', true),
      (p_company_id, 'Tarifas Bancárias & Encargos Financeiros', 'financial', 'variable', true),
      (p_company_id, 'Depreciação & Amortização', 'depreciation', 'fixed', true),
      (p_company_id, 'IRPJ & CSLL (Impostos sobre Lucro)', 'taxes_profit', 'variable', true),
      (p_company_id, 'Distribuição de Lucros / Dividendos aos Sócios', 'equity', 'variable', true),
      (p_company_id, 'Aporte de Capital Social / Empréstimo de Sócios', 'equity', 'variable', true);
  end if;

  if not exists (select 1 from public.cost_centers where company_id = p_company_id) then
    insert into public.cost_centers (company_id, name, code, type, description, active)
    values (p_company_id, 'Geral', 'CC00', 'shared', 'Centro de resultado padrão da empresa', true);
  end if;
end;
$$;

revoke all on function public.seed_company_financial_defaults(uuid) from public, anon, authenticated;

create or replace function public.trg_seed_company_financial_defaults()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  perform public.seed_company_financial_defaults(new.id);
  return new;
end;
$$;

revoke all on function public.trg_seed_company_financial_defaults() from public, anon, authenticated;

drop trigger if exists trg_organizations_seed_financial_defaults on public.organizations;
create trigger trg_organizations_seed_financial_defaults
  after insert on public.organizations
  for each row execute function public.trg_seed_company_financial_defaults();

-- Empresas que já existem
do $$
declare r record;
begin
  for r in select id from public.organizations loop
    perform public.seed_company_financial_defaults(r.id);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- 2. Contas bancárias e orçamento
-- ---------------------------------------------------------------------
create table if not exists public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  bank text,
  account_type text not null default 'checking',
  account_number text,
  opening_balance numeric(15,2) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.organizations(id) on delete cascade,
  category_id uuid not null,
  year_month text not null check (year_month ~ '^[0-9]{4}-[0-9]{2}$'),
  budgeted_amount numeric(15,2) not null default 0,
  name text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, category_id, year_month)
);

create index if not exists bank_accounts_company_idx on public.bank_accounts(company_id);
create index if not exists budgets_company_month_idx on public.budgets(company_id, year_month);
create index if not exists expenses_company_competence_idx on public.expenses(company_id, competence_date);
create index if not exists revenues_company_competence_idx on public.revenues(company_id, competence_date);

alter table public.bank_accounts enable row level security;
alter table public.budgets enable row level security;

do $$
declare t text;
begin
  foreach t in array array['bank_accounts','budgets'] loop
    execute format('drop policy if exists %I on public.%I', t||'_select_org', t);
    execute format('drop policy if exists %I on public.%I', t||'_insert_org', t);
    execute format('drop policy if exists %I on public.%I', t||'_update_org', t);
    execute format('drop policy if exists %I on public.%I', t||'_delete_org', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.can_access_org_data(company_id))', t||'_select_org', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.can_access_org_data(company_id))', t||'_insert_org', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.can_access_org_data(company_id)) with check (public.can_access_org_data(company_id))', t||'_update_org', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.can_access_org_data(company_id))', t||'_delete_org', t);
  end loop;
end;
$$;

grant select, insert, update, delete on public.bank_accounts, public.budgets to authenticated;

-- ---------------------------------------------------------------------
-- 3. Segurança: funções internas não podem ser chamadas pela API
-- ---------------------------------------------------------------------
-- Funções de gatilho e de cobrança: só o banco (e as edge functions com
-- service_role) chamam. Ninguém de fora precisa executar.
revoke execute on function public.dispatch_subscription_user_adjustment() from public, anon, authenticated;
revoke execute on function public.finalize_expired_cancellations() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_organization_member_billing_change() from public, anon, authenticated;
revoke execute on function public.recalculate_subscription_user_billing(uuid) from public, anon, authenticated;
revoke execute on function public.set_subscription_user_billing_before_write() from public, anon, authenticated;
revoke execute on function public.provision_paid_checkout(uuid) from public, anon, authenticated;

-- Funções usadas pelo app logado: só usuários autenticados.
revoke execute on function public.is_system_admin(uuid) from public, anon;
revoke execute on function public.can_access_org_data(uuid) from public, anon;
revoke execute on function public.can_view_profile(uuid) from public, anon;
revoke execute on function public.claim_pending_invitations() from public, anon;
revoke execute on function public.create_organization(text) from public, anon;
revoke execute on function public.is_org_member(uuid) from public, anon;
revoke execute on function public.is_org_admin(uuid) from public, anon;
revoke execute on function public.is_org_owner(uuid) from public, anon;
grant execute on function public.is_system_admin(uuid) to authenticated;
grant execute on function public.can_access_org_data(uuid) to authenticated;
grant execute on function public.can_view_profile(uuid) to authenticated;
grant execute on function public.claim_pending_invitations() to authenticated;
grant execute on function public.create_organization(text) to authenticated;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.is_org_admin(uuid) to authenticated;
grant execute on function public.is_org_owner(uuid) to authenticated;

-- service_role (edge functions) mantém acesso a tudo
grant execute on function public.provision_paid_checkout(uuid) to service_role;
grant execute on function public.recalculate_subscription_user_billing(uuid) to service_role;
grant execute on function public.finalize_expired_cancellations() to service_role;

-- ---------------------------------------------------------------------
-- 4. Política de exclusão de empresa (comparava om.organization_id = om.id)
-- ---------------------------------------------------------------------
drop policy if exists organizations_delete_owner on public.organizations;
create policy organizations_delete_owner on public.organizations
  for delete to authenticated
  using (public.is_org_owner(id));
