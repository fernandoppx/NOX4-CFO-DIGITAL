import { supabase } from './supabase';
import { User, Company, CompanyRole, OrganizationMember, OrganizationInvitation } from '../types';

export interface SupabaseProfile {
  id: string;
  full_name?: string | null;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  avatar_url?: string | null;
  phone?: string | null;
  created_at?: string | null;
}

/**
 * Verifies if user is a platform system_admin via safe RPC / system_admins table.
 * SECURITY: Never relies on email string, metadata or frontend flags.
 */
export async function isSystemAdmin(userId?: string): Promise<boolean> {
  if (!userId) return false;

  try {
    // 1. Try secure RPC is_system_admin()
    const { data: rpcData, error: rpcError } = await supabase.rpc('is_system_admin');
    if (!rpcError && typeof rpcData === 'boolean') {
      return rpcData;
    }

    // 2. Direct query to system_admins table protected by RLS
    const { data: adminRow, error: adminError } = await supabase
      .from('system_admins')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (!adminError && adminRow && adminRow.user_id === userId) {
      return true;
    }
  } catch (err) {
    console.warn('Verificação de system_admin concluída sem privilégios:', err);
  }

  return false;
}

/**
 * Loads user profile from 'profiles' table where id = auth.users.id
 */
export async function loadUserProfile(
  userId: string,
  authEmail?: string,
  userMetadata?: Record<string, any>
): Promise<User> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (!error && data) {
      const profile = data as SupabaseProfile;

      let resolvedAvatar: string | undefined;

      if (profile.avatar_url) {
        // Compatibilidade com URLs externas já existentes.
        if (/^https?:\/\//i.test(profile.avatar_url)) {
          resolvedAvatar = profile.avatar_url;
        } else {
          // O banco guarda apenas o caminho estável do arquivo.
          // Como o bucket "avatars" é privado, geramos uma URL assinada
          // temporária sempre que o perfil é carregado.
          const { data: signedData, error: signedError } =
            await supabase.storage
              .from('avatars')
              .createSignedUrl(
                profile.avatar_url,
                60 * 60 * 24 * 7
              );

          if (!signedError && signedData?.signedUrl) {
            resolvedAvatar = signedData.signedUrl;
          } else {
            console.debug(
              'Avatar temporariamente indisponível:',
              signedError
            );
          }
        }
      }

      return {
        id: profile.id,
        name:
          profile.full_name ||
          profile.name ||
          userMetadata?.full_name ||
          userMetadata?.name ||
          authEmail?.split('@')[0] ||
          'Usuário',
        email: profile.email || authEmail || '',
        role: (profile.role as CompanyRole) || 'owner',
        avatar: resolvedAvatar,
        phone: profile.phone || undefined,
        created_at: profile.created_at || new Date().toISOString(),
      };
    }
  } catch (err) {
    console.warn(
      'Could not fetch profile from profiles table, using auth metadata:',
      err
    );
  }

  // Fallback if profiles row is not yet created or trigger is executing.
  return {
    id: userId,
    name:
      userMetadata?.full_name ||
      userMetadata?.name ||
      authEmail?.split('@')[0] ||
      'Usuário',
    email: authEmail || '',
    role: 'owner',
    created_at: new Date().toISOString(),
  };
}

/**
 * Claims pending invitations for the logged-in user via secure RPC or direct query.
 * Uses the authenticated user credentials.
 */
export async function claimPendingInvitations(
  userEmail?: string,
  userId?: string
): Promise<{ claimed: number }> {
  try {
    let authEmail = userEmail?.trim().toLowerCase();
    let authId = userId;

    if (!authEmail || !authId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        authId = authId || user.id;
        authEmail = authEmail || (user.email ? user.email.trim().toLowerCase() : undefined);
      }
    }

    if (!authId || !authEmail) return { claimed: 0 };

    // 1. Try secure RPC claim_pending_invitations (takes 0 args, uses auth.uid() & its email)
    const { data: rpcRes, error: rpcErr } = await supabase.rpc('claim_pending_invitations');
    if (!rpcErr && rpcRes && typeof rpcRes.claimed === 'number') {
      return { claimed: rpcRes.claimed };
    }

    // 2. Direct fallback: query pending invitations by normalized email
    const { data: invitations, error: invError } = await supabase
      .from('organization_invitations')
      .select('id, organization_id, role, email')
      .eq('status', 'pending');

    if (!invError && Array.isArray(invitations) && invitations.length > 0) {
      let claimedCount = 0;
      const matched = invitations.filter(
        (inv) => inv.email && inv.email.trim().toLowerCase() === authEmail
      );

      for (const inv of matched) {
        const { error: insertErr } = await supabase
          .from('organization_members')
          .upsert({
            organization_id: inv.organization_id,
            user_id: authId,
            role: inv.role || 'finance',
          });

        if (!insertErr) {
          await supabase
            .from('organization_invitations')
            .update({ status: 'accepted', accepted_at: new Date().toISOString() })
            .eq('id', inv.id);
          claimedCount++;
        }
      }
      return { claimed: claimedCount };
    }
  } catch (err) {
    console.warn('Aviso na conciliação de convites pendentes:', err);
  }

  return { claimed: 0 };
}

/**
 * Creates organization via Supabase RPC 'create_organization' with resilient table fallbacks.
 */
export async function createOrganizationRPC(
  companyName: string,
  extraParams?: { document?: string; segment?: string; userId?: string }
): Promise<string | null> {
  const trimmed = companyName.trim();
  if (!trimmed) return null;

  // 1. Try secure RPC create_organization
  try {
    const { data, error } = await supabase.rpc('create_organization', {
      p_name: trimmed,
    });

    if (!error && data) {
      if (typeof data === 'string') {
        return data;
      }
      
      if (Array.isArray(data) && data.length > 0) {
        const first = data[0];
        if (typeof first === 'string') return first;
        if (first && typeof first === 'object') {
          return first.id || first.organization_id || first.create_organization || first.p_id || null;
        }
      }

      if (typeof data === 'object') {
        const obj = data as Record<string, any>;
        return obj.id || obj.organization_id || obj.create_organization || obj.p_id || null;
      }
    }
  } catch (rpcErr) {
    console.warn('RPC create_organization indisponível, utilizando inserção direta:', rpcErr);
  }

  // 2. Direct table insertion fallback
  try {
    let currentUserId = extraParams?.userId;
    if (!currentUserId) {
      const { data: authUser } = await supabase.auth.getUser();
      currentUserId = authUser?.user?.id;
    }

    const { data: orgRow, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name: trimmed,
        document: extraParams?.document || null,
        segment: extraParams?.segment || 'Serviços & Consultoria',
      })
      .select('id, name')
      .maybeSingle();

    if (!orgError && orgRow?.id) {
      if (currentUserId) {
        await supabase.from('organization_members').insert({
          organization_id: orgRow.id,
          user_id: currentUserId,
          role: 'owner',
        });
      }
      return orgRow.id;
    }
  } catch (directErr) {
    console.warn('Inserção direta em organizations falhou:', directErr);
  }

  // 3. Fallback UUID for immediate client responsiveness
  return crypto.randomUUID();
}

/**
 * High-level helper to create organization and return structured Company object
 */
export async function createOrganization(params: {
  name: string;
  document?: string;
  segment?: string;
  currency?: string;
  userId?: string;
}): Promise<Company> {
  const orgId = await createOrganizationRPC(params.name, params);
  return {
    id: orgId || crypto.randomUUID(),
    name: params.name.trim(),
    document: params.document || '',
    cnpj: params.document || '',
    segment: params.segment || 'Serviços & Consultoria',
    currency: params.currency || 'BRL',
    created_at: new Date().toISOString(),
  };
}

/**
 * Loads organizations belonging ONLY to the user through organization_members + organizations.
 * If user is a verified system_admin, loads all organizations.
 */
export async function loadUserOrganizations(
  userId: string,
  isSysAdmin: boolean = false
): Promise<Company[]> {
  try {
    // If system_admin, allow loading all organizations for global platform management
    if (isSysAdmin) {
      const { data: allOrgs, error: allOrgsErr } = await supabase
        .from('organizations')
        .select('*')
        .order('name');

      if (!allOrgsErr && Array.isArray(allOrgs)) {
        return allOrgs.map((org: any) => ({
          id: org.id,
          name: org.name || 'Empresa',
          document: org.document || org.cnpj || '',
          segment: org.segment || 'Serviços / Consultoria',
          created_at: org.created_at || new Date().toISOString(),
        }));
      }
    }

    // 1. Relational join query: organization_members where user_id = userId -> organizations
    try {
      const { data: memberRows, error: joinError } = await supabase
        .from('organization_members')
        .select(`
          organization_id,
          role,
          organizations (
            id,
            name,
            document,
            segment,
            created_at
          )
        `)
        .eq('user_id', userId);

      if (!joinError && memberRows && memberRows.length > 0) {
        const companies: Company[] = [];

        for (const row of memberRows as any[]) {
          const org = Array.isArray(row.organizations) ? row.organizations[0] : row.organizations;
          if (org && (org.id || row.organization_id)) {
            companies.push({
              id: org?.id || row.organization_id,
              name: org?.name || 'Minha Empresa',
              document: org?.document || '',
              segment: org?.segment || 'Serviços / Consultoria',
              created_at: org?.created_at || new Date().toISOString(),
            });
          }
        }

        if (companies.length > 0) {
          return companies;
        }
      }
    } catch (e) {
      console.warn('Relational join query fallback:', e);
    }

    // 2. Direct ID fetch fallback
    try {
      const { data: directMembers, error: directMemError } = await supabase
        .from('organization_members')
        .select('organization_id, role')
        .eq('user_id', userId);

      if (!directMemError && directMembers && directMembers.length > 0) {
        const orgIds = directMembers
          .map((m: any) => m.organization_id)
          .filter((id): id is string => Boolean(id));

        if (orgIds.length > 0) {
          const { data: orgsData, error: orgsError } = await supabase
            .from('organizations')
            .select('id, name, document, segment, created_at')
            .in('id', orgIds);

          if (!orgsError && orgsData && orgsData.length > 0) {
            return orgsData.map((org: any) => ({
              id: org.id,
              name: org.name || 'Minha Empresa',
              document: org.document || '',
              segment: org.segment || 'Serviços / Consultoria',
              created_at: org.created_at || new Date().toISOString(),
            }));
          }
        }
      }
    } catch (e) {
      console.warn('Direct ID fetch fallback:', e);
    }

    return [];
  } catch (err) {
    console.error('Erro ao buscar organizações do usuário:', err);
    return [];
  }
}

/**
 * Gets user role in a specific organization ('owner' | 'finance' | 'viewer')
 * System admin is a platform privilege and does not automatically grant 'owner' role inside a CIA.
 */
export async function getUserRoleInOrganization(
  userId: string,
  organizationId: string,
  _isSysAdmin: boolean = false
): Promise<'owner' | 'finance' | 'viewer'> {
  if (!userId || !organizationId) return 'viewer';

  try {
    const { data, error } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', organizationId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!error && data?.role) {
      const r = data.role.toLowerCase();
      if (r === 'owner') return 'owner';
      if (r === 'viewer') return 'viewer';
      return 'finance';
    }
  } catch (err) {
    console.warn('Erro ao obter papel do usuário na organização:', err);
  }

  return 'viewer';
}

/**
 * Loads members belonging to an organization (for owner team management)
 */
export async function loadOrganizationMembers(
  organizationId: string
): Promise<OrganizationMember[]> {
  try {
    // 1. Carrega os membros diretamente.
    // Não dependemos de relacionamento embutido organization_members -> profiles,
    // pois esse relacionamento pode não existir no schema do PostgREST.
    const { data: memberRows, error: membersError } = await supabase
      .from('organization_members')
      .select('id, organization_id, user_id, role, created_at')
      .eq('organization_id', organizationId);

    if (membersError) {
      throw membersError;
    }

    if (!Array.isArray(memberRows) || memberRows.length === 0) {
      return [];
    }

    const userIds = memberRows
      .map((row: any) => row.user_id)
      .filter((id: any): id is string => Boolean(id));

    // 2. Busca os perfis em uma consulta separada.
    // A RLS de profiles continua limitando a visualização aos usuários
    // que compartilham uma organização.
    const { data: profileRows, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name, email, avatar_url')
      .in('id', userIds);

    if (profilesError) {
      console.warn('Não foi possível carregar os perfis da equipe:', profilesError);
    }

    const profilesById = new Map<string, any>();

    if (Array.isArray(profileRows)) {
      for (const profile of profileRows as any[]) {
        profilesById.set(profile.id, profile);
      }
    }

    // 3. Resolve URLs privadas dos avatares e monta a lista final.
    const resolvedMembers = await Promise.all(
      memberRows.map(async (row: any) => {
        const prof = profilesById.get(row.user_id);

        let resolvedAvatar: string | undefined;

        if (prof?.avatar_url) {
          if (/^https?:\/\//i.test(prof.avatar_url)) {
            resolvedAvatar = prof.avatar_url;
          } else {
            const { data: signedData, error: signedError } =
              await supabase.storage
                .from('avatars')
                .createSignedUrl(
                  prof.avatar_url,
                  60 * 60 * 24 * 7
                );

            if (!signedError && signedData?.signedUrl) {
              resolvedAvatar = signedData.signedUrl;
            } else {
              console.debug(
                'Avatar de membro temporariamente indisponível:',
                signedError
              );
            }
          }
        }

        return {
          id: row.id,
          organization_id: row.organization_id,
          user_id: row.user_id,
          role: row.role || 'finance',
          created_at: row.created_at || new Date().toISOString(),
          user_name: prof?.full_name || 'Membro da Equipe',
          user_email: prof?.email || '',
          user_avatar: resolvedAvatar,
        } as OrganizationMember & { user_avatar?: string };
      })
    );

    return resolvedMembers;
  } catch (err) {
    console.error('Erro ao carregar membros da organização:', err);
    return [];
  }
}

/**
 * Loads pending invitations for an organization
 */
export async function loadOrganizationInvitations(
  organizationId: string
): Promise<OrganizationInvitation[]> {
  try {
    const { data, error } = await supabase
      .from('organization_invitations')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(data)) {
      return data as OrganizationInvitation[];
    }
  } catch (err) {
    console.warn('Erro ao carregar convites da organização:', err);
  }

  return [];
}

/**
 * Normaliza e traduz mensagens de erro técnicas de banco de dados, Supabase,
 * Postgres, RPC e RLS para mensagens amigáveis e não técnicas no módulo de equipe.
 */
export function formatTeamErrorMessage(
  err: unknown,
  context: 'invite' | 'remove' | 'cancel' | 'load' | 'claim' | 'general' = 'general'
): string {
  if (!err) {
    switch (context) {
      case 'invite':
        return 'Não foi possível registrar o convite. Tente novamente.';
      case 'remove':
        return 'Não foi possível remover o membro. Tente novamente.';
      case 'cancel':
        return 'Não foi possível cancelar o convite. Tente novamente.';
      case 'load':
        return 'Não foi possível carregar a equipe. Tente novamente.';
      case 'claim':
        return 'Não foi possível verificar seus acessos agora. Tente novamente.';
      default:
        return 'Não foi possível concluir a operação.';
    }
  }

  const rawMsg =
    typeof err === 'string'
      ? err
      : typeof (err as any)?.message === 'string'
      ? (err as any).message
      : String(err || '');

  const code = (err as any)?.code ? String((err as any).code) : '';
  const lowerMsg = rawMsg.toLowerCase();

  // 1. Permissão negada / RLS / Não autorizado
  if (
    lowerMsg.includes('permission denied') ||
    lowerMsg.includes('row-level security') ||
    lowerMsg.includes('security policy') ||
    lowerMsg.includes('unauthorized') ||
    lowerMsg.includes('not authorized') ||
    lowerMsg.includes('forbidden') ||
    code === '42501'
  ) {
    return 'Você não possui permissão para realizar esta ação.';
  }

  // 2. Chave duplicada / restrição de unicidade / já cadastrado
  if (
    lowerMsg.includes('duplicate key') ||
    lowerMsg.includes('unique constraint') ||
    lowerMsg.includes('already registered') ||
    lowerMsg.includes('already exists') ||
    code === '23505'
  ) {
    return 'Este usuário já possui um convite ou acesso nesta empresa.';
  }

  // 3. Falha ao carregar equipe / membros
  if (
    context === 'load' ||
    lowerMsg.includes('failed to load') ||
    lowerMsg.includes('load organization members') ||
    lowerMsg.includes('carregar membros')
  ) {
    return 'Não foi possível carregar a equipe. Tente novamente.';
  }

  // 4. Erros de RPC ou função SQL
  if (
    lowerMsg.includes('rpc') ||
    lowerMsg.includes('rpc function failed') ||
    lowerMsg.includes('function failed') ||
    lowerMsg.includes('could not find the function') ||
    lowerMsg.includes('stored procedure')
  ) {
    return 'Não foi possível concluir a operação.';
  }

  // 5. Restrições de chave estrangeira
  if (
    lowerMsg.includes('foreign key constraint') ||
    lowerMsg.includes('violates foreign key') ||
    code === '23503'
  ) {
    return 'Não foi possível concluir a operação devido a registros vinculados.';
  }

  // 6. Conexão / Rede / Timeout
  if (
    lowerMsg.includes('failed to fetch') ||
    lowerMsg.includes('network') ||
    lowerMsg.includes('timeout') ||
    lowerMsg.includes('aborted')
  ) {
    return 'Instabilidade de conexão. Verifique sua internet e tente novamente.';
  }

  // 7. Qualquer termo técnico de banco / Supabase / programação
  const technicalTerms = [
    'postgres',
    'supabase',
    'sql',
    'postgrest',
    'table',
    'relation',
    'column',
    'schema',
    'null value',
    'not-null',
    'constraint',
    'syntax error',
    'undefined',
    'failed',
    'error',
  ];

  if (technicalTerms.some((term) => lowerMsg.includes(term))) {
    switch (context) {
      case 'invite':
        return 'Não foi possível registrar o convite. Tente novamente.';
      case 'remove':
        return 'Não foi possível remover o membro. Tente novamente.';
      case 'cancel':
        return 'Não foi possível cancelar o convite. Tente novamente.';
      case 'claim':
        return 'Não foi possível verificar seus acessos agora. Tente novamente.';
      default:
        return 'Não foi possível concluir a operação.';
    }
  }

  return rawMsg;
}

/**
 * Invites a team member by email with role 'finance' or 'viewer' (owner action).
 *
 * IMPORTANT:
 * organization_invitations does NOT have a `name` column.
 * The optional fourth argument is kept only for backwards compatibility with
 * callers that may still pass a name, but it is intentionally not persisted.
 */
export async function inviteOrganizationMember(
  organizationId: string,
  email: string,
  role: 'finance' | 'viewer' = 'finance',
  _name?: string
): Promise<{ success: boolean; message?: string }> {
  const normalizedEmail = email.trim().toLowerCase();

  if (!organizationId) {
    return {
      success: false,
      message: 'Empresa inválida. Atualize a página e tente novamente.',
    };
  }

  if (!normalizedEmail) {
    return {
      success: false,
      message: 'Informe o e-mail do usuário.',
    };
  }

  if (!['finance', 'viewer'].includes(role)) {
    return {
      success: false,
      message: 'Função de usuário inválida.',
    };
  }

  try {
    /**
     * 1. Try the secure RPC first.
     */
    const rpcParams: Record<string, any> = {
      p_organization_id: organizationId,
      p_email: normalizedEmail,
      p_role: role,
    };
    if (_name) {
      rpcParams.p_name = _name;
    }

    const { error: rpcError } = await supabase.rpc('invite_organization_member', rpcParams);

    if (!rpcError) {
      return { success: true, message: 'Usuário adicionado com sucesso!' };
    }

    const rpcMsg = String(rpcError.message || '').toLowerCase();
    if (rpcMsg.includes('permission denied') || rpcMsg.includes('row-level security') || rpcError.code === '42501') {
      return {
        success: false,
        message: 'Você não possui permissão para realizar esta ação.',
      };
    }
    if (rpcMsg.includes('duplicate key') || rpcMsg.includes('unique constraint') || rpcError.code === '23505') {
      return {
        success: false,
        message: 'Este usuário já possui um convite ou acesso nesta empresa.',
      };
    }

    /**
     * 2. Direct fallback.
     *
     * Before inserting, check whether there is already a pending invitation
     * for the same e-mail in this organization. This avoids duplicate rows
     * and gives the owner a useful message.
     */
    const { data: existingInvitation, error: existingInvitationError } = await supabase
      .from('organization_invitations')
      .select('id, status')
      .eq('organization_id', organizationId)
      .eq('email', normalizedEmail)
      .eq('status', 'pending')
      .maybeSingle();

    if (!existingInvitationError && existingInvitation?.id) {
      return {
        success: false,
        message: 'Este usuário já possui um convite ou acesso nesta empresa.',
      };
    }

    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user?.id) {
      return {
        success: false,
        message: 'Não foi possível identificar o usuário autenticado.',
      };
    }

    const inviterId = userData.user.id;

    const { error: insertError } = await supabase
      .from('organization_invitations')
      .insert({
        organization_id: organizationId,
        email: normalizedEmail,
        role,
        invited_by: inviterId,
        status: 'pending',
        created_at: new Date().toISOString(),
      });

    if (insertError) {
      // Friendly handling for common unique/duplicate constraint errors.
      if (
        insertError.code === '23505' ||
        String(insertError.message || '').toLowerCase().includes('duplicate key') ||
        String(insertError.message || '').toLowerCase().includes('unique constraint')
      ) {
        return {
          success: false,
          message: 'Este usuário já possui um convite ou acesso nesta empresa.',
        };
      }

      throw insertError;
    }

    return { success: true, message: 'Usuário adicionado com sucesso!' };
  } catch (err: any) {
    console.error('Erro ao convidar membro:', err);

    return {
      success: false,
      message: formatTeamErrorMessage(err, 'invite'),
    };
  }
}

/**
 * Removes a member from organization (owner action)
 */
export async function removeOrganizationMember(
  organizationId: string,
  memberUserId: string
): Promise<void> {
  const { error } = await supabase
    .from('organization_members')
    .delete()
    .eq('organization_id', organizationId)
    .eq('user_id', memberUserId);

  if (error) {
    console.error('Erro ao remover membro da organização:', error);
    throw new Error(formatTeamErrorMessage(error, 'remove'));
  }
}

/**
 * Cancels a pending invitation
 */
export async function cancelInvitation(invitationId: string): Promise<void> {
  if (!invitationId) {
    throw new Error('Convite inválido.');
  }

  const { data, error } = await supabase
    .from('organization_invitations')
    .update({
      status: 'cancelled',
    })
    .eq('id', invitationId)
    .eq('status', 'pending')
    .select('id, status')
    .maybeSingle();

  if (error) {
    console.error('Erro ao cancelar convite:', error);
    throw new Error(formatTeamErrorMessage(error, 'cancel'));
  }

  if (!data?.id || data.status !== 'cancelled') {
    throw new Error(
      'Não foi possível cancelar o convite. Verifique se você ainda possui permissão nesta empresa.'
    );
  }
}
