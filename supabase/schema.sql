-- ==============================================================================
-- NOX4 CFO - Supabase SQL Schema, RLS Policies & Security Functions
-- Arquitetura: system_admin (Global) | owner (Sócio) | finance (Financeiro)
-- ==============================================================================

-- 1. TABELA SYSTEM ADMINS (Administradores Globais da Plataforma NOX4)
-- Somente registros existentes nesta tabela possuem acesso administrativo global.
-- Nenhum signup, formulário ou metadata do frontend pode conceder privilégios de system_admin.
CREATE TABLE IF NOT EXISTS public.system_admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.system_admins ENABLE ROW LEVEL SECURITY;

-- 2. FUNÇÃO SEGURA is_system_admin() (SECURITY DEFINER)
-- Retorna true apenas se auth.uid() estiver explicitamente registrado em system_admins.
CREATE OR REPLACE FUNCTION public.is_system_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.system_admins
    WHERE user_id = auth.uid()
  );
$$;

-- Política para leitura de system_admins: apenas o próprio usuário pode verificar se é admin
CREATE POLICY "Users can check their own system_admin status"
  ON public.system_admins
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- 3. TABELA ORGANIZATION_INVITATIONS (Convites de Equipe por Email)
CREATE TABLE IF NOT EXISTS public.organization_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'finance' CHECK (role IN ('finance', 'viewer', 'owner')),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  accepted_at TIMESTAMPTZ
);

ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;

-- 4. POLÍTICAS RLS PARA ORGANIZATIONS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- System Admin: visualiza todas as organizações para fins de auditoria/suporte
-- Owner / Finance: visualiza somente organizações às quais pertence via organization_members
CREATE POLICY "Organizations select policy"
  ON public.organizations
  FOR SELECT
  TO authenticated
  USING (
    public.is_system_admin()
    OR EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = organizations.id
      AND organization_members.user_id = auth.uid()
    )
  );

-- Owner: pode atualizar sua própria organização
CREATE POLICY "Organizations update policy"
  ON public.organizations
  FOR UPDATE
  TO authenticated
  USING (
    public.is_system_admin()
    OR EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = organizations.id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role = 'owner'
    )
  );

-- 5. POLÍTICAS RLS PARA ORGANIZATION_MEMBERS
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organization members select policy"
  ON public.organization_members
  FOR SELECT
  TO authenticated
  USING (
    public.is_system_admin()
    OR user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.organization_members AS om
      WHERE om.organization_id = organization_members.organization_id
      AND om.user_id = auth.uid()
      AND om.role = 'owner'
    )
  );

-- Owner: pode remover membros financeiros da organização
CREATE POLICY "Organization members delete policy"
  ON public.organization_members
  FOR DELETE
  TO authenticated
  USING (
    public.is_system_admin()
    OR EXISTS (
      SELECT 1 FROM public.organization_members AS om
      WHERE om.organization_id = organization_members.organization_id
      AND om.user_id = auth.uid()
      AND om.role = 'owner'
    )
  );

-- 6. POLÍTICAS RLS PARA ORGANIZATION_INVITATIONS
CREATE POLICY "Invitations select policy"
  ON public.organization_invitations
  FOR SELECT
  TO authenticated
  USING (
    public.is_system_admin()
    OR lower(email) = lower(auth.jwt()->>'email')
    OR EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = organization_invitations.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role = 'owner'
    )
  );

CREATE POLICY "Invitations insert/update policy"
  ON public.organization_invitations
  FOR ALL
  TO authenticated
  USING (
    public.is_system_admin()
    OR EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = organization_invitations.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role = 'owner'
    )
  );

-- 7. FUNÇÃO RPC: claim_pending_invitations() (SECURITY DEFINER)
-- Processa convites pendentes associados ao e-mail do usuário autenticado no login
CREATE OR REPLACE FUNCTION public.claim_pending_invitations()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_user_email TEXT;
  v_invitation RECORD;
  v_count INT := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'claimed', 0, 'error', 'Não autenticado');
  END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

  IF v_user_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'claimed', 0, 'error', 'Email de usuário não encontrado');
  END IF;

  FOR v_invitation IN
    SELECT * FROM public.organization_invitations
    WHERE lower(email) = lower(v_user_email)
    AND status = 'pending'
  LOOP
    -- Insere o usuário em organization_members com a role do convite (padrão finance)
    INSERT INTO public.organization_members (organization_id, user_id, role, created_at)
    VALUES (v_invitation.organization_id, v_user_id, COALESCE(v_invitation.role, 'finance'), now())
    ON CONFLICT (organization_id, user_id) 
    DO UPDATE SET role = EXCLUDED.role;

    -- Atualiza o status do convite para accepted
    UPDATE public.organization_invitations
    SET status = 'accepted', accepted_at = now()
    WHERE id = v_invitation.id;

    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'claimed', v_count);
END;
$$;

-- 8. FUNÇÃO RPC: invite_organization_member() (SECURITY DEFINER)
-- Permite que o owner convide membros (Financeiro ou Visualizador) pelo email
CREATE OR REPLACE FUNCTION public.invite_organization_member(
  p_organization_id UUID,
  p_email TEXT,
  p_name TEXT DEFAULT NULL,
  p_role TEXT DEFAULT 'finance'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_is_owner BOOLEAN := false;
  v_invitation_id UUID;
  v_norm_email TEXT;
  v_valid_role TEXT;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Acesso negado: usuário não autenticado';
  END IF;

  IF p_email IS NULL OR trim(p_email) = '' THEN
    RAISE EXCEPTION 'O e-mail é obrigatório';
  END IF;

  v_norm_email := lower(trim(p_email));
  v_valid_role := CASE WHEN lower(p_role) = 'viewer' THEN 'viewer' ELSE 'finance' END;

  -- Apenas o proprietário (owner) da organização pode administrar a equipe
  -- system_admin é administração global da plataforma, não se torna owner de organizações individuais
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = p_organization_id
    AND user_id = v_caller_id
    AND role = 'owner'
  ) INTO v_is_owner;

  IF NOT v_is_owner THEN
    RAISE EXCEPTION 'Apenas o proprietário (owner) da empresa pode administrar a equipe.';
  END IF;

  -- Cria ou atualiza o registro de convite com status pending
  INSERT INTO public.organization_invitations (
    organization_id,
    email,
    name,
    role,
    invited_by,
    status,
    created_at,
    accepted_at
  )
  VALUES (
    p_organization_id,
    v_norm_email,
    p_name,
    v_valid_role,
    v_caller_id,
    'pending',
    now(),
    NULL
  )
  RETURNING id INTO v_invitation_id;

  RETURN jsonb_build_object(
    'success', true,
    'invitation_id', v_invitation_id,
    'role', v_valid_role,
    'status', 'pending'
  );
END;
$$;

-- 9. FUNÇÃO RPC: create_organization() (SECURITY DEFINER)
-- Cria organização atomicamente e associa o criador como 'owner'
CREATE OR REPLACE FUNCTION public.create_organization(
  p_name TEXT,
  p_document TEXT DEFAULT NULL,
  p_segment TEXT DEFAULT 'Serviços / Consultoria'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_org_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Acesso negado: usuário não autenticado';
  END IF;

  IF p_name IS NULL OR trim(p_name) = '' THEN
    RAISE EXCEPTION 'O nome da empresa é obrigatório';
  END IF;

  -- Insere a organização
  INSERT INTO public.organizations (name, document, segment)
  VALUES (trim(p_name), p_document, COALESCE(p_segment, 'Serviços / Consultoria'))
  RETURNING id INTO v_org_id;

  -- Adiciona o criador como owner da organização
  INSERT INTO public.organization_members (organization_id, user_id, role, created_at)
  VALUES (v_org_id, v_user_id, 'owner', now())
  ON CONFLICT (organization_id, user_id)
  DO UPDATE SET role = 'owner';

  RETURN jsonb_build_object(
    'success', true,
    'organization_id', v_org_id,
    'role', 'owner'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_organization(TEXT, TEXT, TEXT) TO authenticated;
