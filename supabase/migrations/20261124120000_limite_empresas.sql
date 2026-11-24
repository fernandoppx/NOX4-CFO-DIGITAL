-- =====================================================================
-- NOX4 — Só cria empresa quem tem direito pelo plano
-- 2026-11-24
--
-- Antes: qualquer usuário logado (inclusive convidado como Financeiro ou
-- Visualizador, ou quem nunca pagou) chamava create_organization e virava
-- Proprietário de uma empresa nova, sem passar pelo checkout.
--
-- Agora:
--   * System Admin: pode criar.
--   * Demais: precisa ser Proprietário de uma empresa com assinatura ativa,
--     e o total de empresas de que é Proprietário não pode passar do
--     max_organizations do plano (Essencial/Profissional 1, Grupo 3).
-- Empresas vendidas pelo checkout continuam sendo criadas pelo
-- provision_paid_checkout (não passa por esta função).
-- =====================================================================

create or replace function public.create_organization(p_name text)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user_id uuid;
  v_org_id uuid;
  v_limit integer;
  v_count integer;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  if nullif(trim(p_name), '') is null then
    raise exception 'Nome da empresa é obrigatório';
  end if;

  if not exists (select 1 from public.system_admins sa where sa.user_id = v_user_id) then
    select max(p.max_organizations)
      into v_limit
      from public.subscriptions s
      join public.plans p on p.id = s.plan_id
      join public.organization_members m
        on m.organization_id = s.organization_id
       and m.user_id = v_user_id
       and m.role = 'owner'
     where s.status in ('active', 'trialing');

    select count(*)
      into v_count
      from public.organization_members m
     where m.user_id = v_user_id
       and m.role = 'owner';

    if v_limit is null then
      raise exception 'Somente o Proprietário de uma empresa com assinatura ativa pode cadastrar novas empresas.';
    end if;

    if v_count >= v_limit then
      raise exception 'Seu plano permite % empresa(s). Para cadastrar outra, fale com o suporte e contrate uma empresa adicional.', v_limit;
    end if;
  end if;

  -- Garante profile para usuários antigos
  insert into public.profiles (id) values (v_user_id) on conflict (id) do nothing;

  insert into public.organizations (name) values (trim(p_name)) returning id into v_org_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (v_org_id, v_user_id, 'owner');

  return v_org_id;
end;
$function$;
