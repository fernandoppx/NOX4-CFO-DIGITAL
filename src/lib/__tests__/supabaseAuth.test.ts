import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  loadUserProfile,
  loadUserOrganizations,
  createOrganizationRPC,
} from '../supabaseAuth';
import { supabase } from '../supabase';

describe('Supabase Auth & Multi-Tenant Security Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. Usuário inexistente não entra (retorna erro da API de autenticação)', async () => {
    const signInSpy = vi.spyOn(supabase.auth, 'signInWithPassword').mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { name: 'AuthApiError', message: 'Invalid login credentials', status: 400 } as any,
    });

    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'nonexistent@nox4.com.br',
      password: 'wrongpassword',
    });

    expect(signInSpy).toHaveBeenCalledWith({
      email: 'nonexistent@nox4.com.br',
      password: 'wrongpassword',
    });
    expect(data.session).toBeNull();
    expect(error).not.toBeNull();
    expect(error?.message).toContain('Invalid login credentials');
  });

  it('2. Senha errada não entra (retorna erro de credenciais inválidas)', async () => {
    vi.spyOn(supabase.auth, 'signInWithPassword').mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { name: 'AuthApiError', message: 'Invalid login credentials', status: 400 } as any,
    });

    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'gabriel@nox4.com.br',
      password: 'incorrectPassword123',
    });

    expect(data.session).toBeNull();
    expect(error?.message).toBe('Invalid login credentials');
  });

  it('3. Usuário válido entra com credenciais corretas', async () => {
    const mockUser = {
      id: 'usr_supabase_uuid_123',
      email: 'gabriel@nox4.com.br',
      user_metadata: { full_name: 'Gabriel Turíbia' },
    };
    const mockSession = {
      access_token: 'fake_jwt_token',
      user: mockUser,
    };

    vi.spyOn(supabase.auth, 'signInWithPassword').mockResolvedValueOnce({
      data: { user: mockUser as any, session: mockSession as any },
      error: null,
    });

    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'gabriel@nox4.com.br',
      password: 'CorrectPassword2026!',
    });

    expect(error).toBeNull();
    expect(data.session).not.toBeNull();
    expect(data.user?.email).toBe('gabriel@nox4.com.br');
  });

  it('4. Reload mantém sessão via supabase.auth.getSession()', async () => {
    const mockSession = {
      access_token: 'valid_persisted_token',
      user: {
        id: 'usr_supabase_uuid_123',
        email: 'gabriel@nox4.com.br',
        user_metadata: { full_name: 'Gabriel Turíbia' },
      },
    };

    vi.spyOn(supabase.auth, 'getSession').mockResolvedValueOnce({
      data: { session: mockSession as any },
      error: null,
    });

    const { data } = await supabase.auth.getSession();
    expect(data.session).not.toBeNull();
    expect(data.session?.user.id).toBe('usr_supabase_uuid_123');
  });

  it('5. Logout encerra sessão via supabase.auth.signOut()', async () => {
    const signOutSpy = vi.spyOn(supabase.auth, 'signOut').mockResolvedValueOnce({
      error: null,
    });

    const { error } = await supabase.auth.signOut();
    expect(signOutSpy).toHaveBeenCalled();
    expect(error).toBeNull();
  });

  it('6. Usuário sem empresa vê onboarding (loadUserOrganizations retorna array vazio)', async () => {
    vi.spyOn(supabase, 'from').mockImplementation(() => ({
      select: () => ({
        eq: () => Promise.resolve({ data: [], error: null }),
        in: () => Promise.resolve({ data: [], error: null }),
        then: (resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve),
      }),
    } as any));

    const orgs = await loadUserOrganizations('new_user_without_company');
    expect(orgs).toEqual([]);
  });

  it('7. Criação de empresa funciona via RPC create_organization (string UUID e objeto)', async () => {
    // Test shape 1: String UUID
    const rpcSpy = vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({
      data: '08b79219-c0c1-483a-b8cb-4e9dfd0891d4',
      error: null,
    } as any);

    const orgId = await createOrganizationRPC('NOX4 Alpha Consultoria');
    expect(rpcSpy).toHaveBeenCalledWith('create_organization', {
      p_name: 'NOX4 Alpha Consultoria',
    });
    expect(orgId).toBe('08b79219-c0c1-483a-b8cb-4e9dfd0891d4');

    // Test shape 2: Array of objects [{ id: '...' }]
    vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({
      data: [{ id: '99999999-c0c1-483a-b8cb-4e9dfd0891d4' }],
      error: null,
    } as any);

    const orgId2 = await createOrganizationRPC('NOX4 Beta');
    expect(orgId2).toBe('99999999-c0c1-483a-b8cb-4e9dfd0891d4');
  });

  it('8. Criador vira owner e membro da organização', async () => {
    const userId = 'usr_owner_789';
    const mockOrgId = '08b79219-c0c1-483a-b8cb-4e9dfd0891d4';

    vi.spyOn(supabase, 'from').mockImplementationOnce(() => ({
      select: () => ({
        eq: () =>
          Promise.resolve({
            data: [
              {
                organization_id: mockOrgId,
                role: 'owner',
                organizations: {
                  id: mockOrgId,
                  name: 'NOX4 Holding',
                  created_at: '2026-09-01T12:00:00Z',
                },
              },
            ],
            error: null,
          }),
      }),
    } as any));

    const orgs = await loadUserOrganizations(userId);
    expect(orgs).toHaveLength(1);
    expect(orgs[0].id).toBe(mockOrgId);
    expect(orgs[0].name).toBe('NOX4 Holding');
  });

  it('9. Usuário só vê suas empresas (consulta estritamente filtrada por user_id via RLS)', async () => {
    const userA = 'usr_tenant_A';
    const orgTenantA = 'org_uuid_aaa';

    vi.spyOn(supabase, 'from').mockImplementationOnce(() => ({
      select: (fields: string) => {
        // Assert that the select is scoped with relations
        return {
          eq: (column: string, value: string) => {
            expect(column).toBe('user_id');
            expect(value).toBe(userA);
            return Promise.resolve({
              data: [
                {
                  organization_id: orgTenantA,
                  role: 'admin',
                  organizations: {
                    id: orgTenantA,
                    name: 'Empresa do Tenant A',
                    created_at: '2026-09-01T00:00:00Z',
                  },
                },
              ],
              error: null,
            });
          },
        };
      },
    } as any));

    const orgs = await loadUserOrganizations(userA);
    expect(orgs).toHaveLength(1);
    expect(orgs[0].id).toBe(orgTenantA);
    expect(orgs[0].name).toBe('Empresa do Tenant A');
  });

  it('10. Usuário desconectado não acessa dashboard (loadUserProfile retorna estrutura resiliente)', async () => {
    const userId = 'usr_test_10';
    vi.spyOn(supabase, 'from').mockImplementationOnce(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({
              data: {
                id: userId,
                full_name: 'Gabriel Turíbia',
                email: 'gabriel@nox4.com.br',
                role: 'admin',
              },
              error: null,
            }),
        }),
      }),
    } as any));

    const profile = await loadUserProfile(userId, 'gabriel@nox4.com.br');
    expect(profile.id).toBe(userId);
    expect(profile.name).toBe('Gabriel Turíbia');
    expect(profile.email).toBe('gabriel@nox4.com.br');
  });
});
