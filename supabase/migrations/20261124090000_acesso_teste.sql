-- =====================================================================
-- NOX4 CFO Digital — Acesso de teste sem cobrança
-- 2026-11-24
--
-- Permite que o System Admin libere uma empresa para um cliente de teste
-- sem passar pelo checkout do Asaas.
--   * Cria a empresa (o gatilho já cria o plano de contas e o centro padrão).
--   * Se o e-mail já tem conta no NOX4: vira Proprietário na hora.
--   * Se ainda não tem: fica um convite de Proprietário pendente, aceito
--     automaticamente quando a pessoa criar a conta com esse e-mail.
--   * Marca a empresa como teste (coluna is_test_account) para separar
--     dos clientes pagantes nos relatórios.
-- Rode no Supabase: SQL Editor > New query > colar > Run.
-- =====================================================================

alter table public.organizations add column if not exists is_test_account boolean not null default false;
alter table public.organizations add column if not exists test_access_until date;

create or replace function public.admin_grant_test_access(
  p_email text,
  p_company_name text,
  p_document text default null,
  p_segment text default 'Serviços / Consultoria',
  p_days integer default 30
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_email text := lower(trim(coalesce(p_email, '')));
  v_org_id uuid;
  v_user_id uuid;
begin
  if v_caller is null or not exists (select 1 from public.system_admins where user_id = v_caller) then
    raise exception 'Apenas o System Admin pode liberar acesso de teste.';
  end if;

  if v_email = '' or position('@' in v_email) = 0 then
    raise exception 'Informe um e-mail válido.';
  end if;

  if coalesce(trim(p_company_name), '') = '' then
    raise exception 'Informe o nome da empresa.';
  end if;

  insert into public.organizations (name, document, segment, is_test_account, test_access_until)
  values (
    trim(p_company_name),
    nullif(trim(coalesce(p_document, '')), ''),
    coalesce(nullif(trim(p_segment), ''), 'Serviços / Consultoria'),
    true,
    (current_date + greatest(coalesce(p_days, 30), 1))
  )
  returning id into v_org_id;

  select id into v_user_id from auth.users where lower(email) = v_email limit 1;

  if v_user_id is not null then
    insert into public.organization_members (organization_id, user_id, role, created_at)
    values (v_org_id, v_user_id, 'owner', now())
    on conflict (organization_id, user_id) do update set role = 'owner';

    return jsonb_build_object('success', true, 'organization_id', v_org_id, 'mode', 'member');
  end if;

  insert into public.organization_invitations (organization_id, email, name, role, invited_by, status, created_at)
  values (v_org_id, v_email, null, 'owner', v_caller, 'pending', now());

  return jsonb_build_object('success', true, 'organization_id', v_org_id, 'mode', 'invitation');
end;
$$;

revoke all on function public.admin_grant_test_access(text, text, text, text, integer) from public, anon;
grant execute on function public.admin_grant_test_access(text, text, text, text, integer) to authenticated;
