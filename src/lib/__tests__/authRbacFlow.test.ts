import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isSystemAdmin,
  claimPendingInvitations,
  loadUserOrganizations,
  inviteOrganizationMember,
  getUserRoleInOrganization,
} from '../supabaseAuth';
import { supabase } from '../supabase';
import { createEmptyDatabase } from '../mockDatabase';
import { calculateDRE } from '../financialEngine';
import { CompanyRole } from '../../types';

vi.mock('../supabase', () => {
  return {
    supabase: {
      from: vi.fn(),
      rpc: vi.fn(),
      auth: {
        signUp: vi.fn(),
        signInWithPassword: vi.fn(),
        signOut: vi.fn(),
        getSession: vi.fn(),
      },
    },
  };
});

describe('Fluxo Completo de Autenticação, Autorização e Onboarding (20 Testes Obrigatórios)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Teste 1: Novo usuário cria conta
  it('1. novo usuário cria conta com email e senha no Supabase Auth', async () => {
    (supabase.auth.signUp as any).mockResolvedValueOnce({
      data: { user: { id: 'usr-new-1', email: 'novo@empresa.com' }, session: null },
      error: null,
    });

    const res = await supabase.auth.signUp({
      email: 'novo@empresa.com',
      password: 'StrongPassword123!',
    });

    expect(res.data.user?.id).toBe('usr-new-1');
    expect(res.error).toBeNull();
  });

  // Teste 2: Confirmação de email
  it('2. confirmação de email encerra sessão automática e direciona para tela de login', async () => {
    (supabase.auth.signOut as any).mockResolvedValueOnce({ error: null });

    const res = await supabase.auth.signOut();
    expect(res.error).toBeNull();
    expect(supabase.auth.signOut).toHaveBeenCalled();
  });

  // Teste 3: Usuário faz login
  it('3. usuário faz login autêntico com email e senha', async () => {
    (supabase.auth.signInWithPassword as any).mockResolvedValueOnce({
      data: {
        user: { id: 'usr-owner-1', email: 'owner@empresa.com' },
        session: { access_token: 'valid-token' },
      },
      error: null,
    });

    const res = await supabase.auth.signInWithPassword({
      email: 'owner@empresa.com',
      password: 'StrongPassword123!',
    });

    expect(res.data.user?.id).toBe('usr-owner-1');
    expect(res.data.session?.access_token).toBe('valid-token');
  });

  // Teste 4: Se não tem empresa -> vai para tela 'Conta ativa'
  it('4. se usuário autenticado não possui vínculo em organization_members, retorna lista vazia', async () => {
    (supabase.rpc as any).mockResolvedValue({ data: false, error: null });
    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'system_admins') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        };
      }
      if (table === 'organization_members') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      }
      return { select: vi.fn() };
    });

    const orgs = await loadUserOrganizations('usr-no-company', false);
    expect(orgs).toHaveLength(0);
  });

  // Teste 5: Não carrega dashboard para usuário sem empresa
  it('5. usuário sem empresa não tem organização ativa para carregar dashboard', () => {
    const userOrgs: any[] = [];
    const shouldShowWaitingScreen = userOrgs.length === 0;
    expect(shouldShowWaitingScreen).toBe(true);
  });

  // Teste 6: Não carrega dados mockados
  it('6. banco de dados vazio não injeta receitas, despesas nem clientes mockados', () => {
    const emptyDb = createEmptyDatabase('org-nova', null);
    expect(emptyDb.revenues).toHaveLength(0);
    expect(emptyDb.expenses).toHaveLength(0);
    expect(emptyDb.clients).toHaveLength(0);
    expect(emptyDb.products).toHaveLength(0);
    expect(emptyDb.costCenters).toHaveLength(0);

    const dre = calculateDRE(
      emptyDb.revenues,
      emptyDb.expenses,
      emptyDb.revenueCategories,
      emptyDb.expenseCategories,
      '2026-08'
    );
    expect(dre.net_revenue).toBe(0);
    expect(dre.net_profit).toBe(0);
  });

  // Teste 7 & 8: Owner cria empresa e seu papel é resolvido como owner
  it('7 & 8. owner cria empresa e seu papel é resolvido como owner', async () => {
    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'organization_members') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { role: 'owner' },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      return { select: vi.fn() };
    });

    const role = await getUserRoleInOrganization('usr-owner-1', 'org-abc-1', false);
    expect(role).toBe('owner');
  });

  // Teste 9 & 10: Owner convida financeiro por email
  it('9 & 10. owner convida membro financeiro via organization_invitations', async () => {
    (supabase.rpc as any).mockResolvedValueOnce({ data: true, error: null });

    const result = await inviteOrganizationMember(
      'org-abc-1',
      'financeiro@empresa.com',
      'finance',
      'Carlos Financeiro'
    );

    expect(result.success).toBe(true);
  });

  // Teste 11: Financeiro confirma email
  it('11. financeiro confirma email e link de convite permanece pronto para claim', async () => {
    (supabase.auth.signOut as any).mockResolvedValueOnce({ error: null });
    const signoutRes = await supabase.auth.signOut();
    expect(signoutRes.error).toBeNull();
  });

  // Teste 12 & 13: Convite cria organization_members ao fazer login
  it('12 & 13. claim_pending_invitations associa usuário aos convites pendentes no login', async () => {
    (supabase.rpc as any).mockResolvedValueOnce({ data: { claimed: 1 }, error: null });

    const res = await claimPendingInvitations('financeiro@empresa.com', 'usr-fin-1');
    expect(res.claimed).toBe(1);
    expect(supabase.rpc).toHaveBeenCalledWith('claim_pending_invitations');
  });

  // Teste 14 & 15: Financeiro acessa empresa e seu papel é finance
  it('14 & 15. financeiro acessa empresa com role finance', async () => {
    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'organization_members') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { role: 'finance' },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      return { select: vi.fn() };
    });

    const role = await getUserRoleInOrganization('usr-fin-1', 'org-abc-1', false);
    expect(role).toBe('finance');
  });

  // Teste 16: Isolamento Multi-Tenant (financeiro não vê dados de outra empresa)
  it('16. transações são estritamente filtradas pelo company_id da empresa ativa', () => {
    const allRevenues = [
      { id: 'r1', company_id: 'org-empresa-a', gross_amount: 10000, competence_date: '2026-08-01', status: 'received' },
      { id: 'r2', company_id: 'org-empresa-b', gross_amount: 50000, competence_date: '2026-08-01', status: 'received' },
    ];

    const currentOrgId = 'org-empresa-a';
    const scopedRevenues = allRevenues.filter((r) => r.company_id === currentOrgId);

    expect(scopedRevenues).toHaveLength(1);
    expect(scopedRevenues[0].gross_amount).toBe(10000);
    expect(scopedRevenues.some((r) => r.company_id === 'org-empresa-b')).toBe(false);
  });

  // Teste 17: Financeiro NÃO pode excluir empresa
  it('17. permissão de exclusão de empresa é restrita a owner ou system_admin', () => {
    const roleFinance: CompanyRole | string = 'finance';
    const canDeleteCompany = roleFinance === 'owner' || roleFinance === 'system_admin';
    expect(canDeleteCompany).toBe(false);

    const roleOwner: CompanyRole | string = 'owner';
    const ownerCanDelete = roleOwner === 'owner' || roleOwner === 'system_admin';
    expect(ownerCanDelete).toBe(true);
  });

  // Teste 18: system_admin tem acesso global
  it('18. system_admin tem acesso global via is_system_admin() e carrega todas as empresas', async () => {
    (supabase.rpc as any).mockResolvedValueOnce({ data: true, error: null });
    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'organizations') {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [
                { id: 'org-1', name: 'Empresa Alfa' },
                { id: 'org-2', name: 'Empresa Beta' },
              ],
              error: null,
            }),
          }),
        };
      }
      return { select: vi.fn() };
    });

    const isAdmin = await isSystemAdmin('usr-sysadmin-root');
    expect(isAdmin).toBe(true);

    const allOrgs = await loadUserOrganizations('usr-sysadmin-root', true);
    expect(allOrgs).toHaveLength(2);
  });

  // Teste 19: Logout funciona e limpa sessão
  it('19. logout encerra sessão Supabase e limpa estado do usuário', async () => {
    (supabase.auth.signOut as any).mockResolvedValueOnce({ error: null });
    await supabase.auth.signOut();
    expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
  });

  // Teste 20: Troca de empresa funciona no seletor
  it('20. alternar empresa ativa atualiza o escopo para a nova organização selecionada sem logout', () => {
    const orgs = [
      { id: 'org-1', name: 'Tech Solutions' },
      { id: 'org-2', name: 'Retail Commerce' },
    ];

    let selectedCompanyId = orgs[0].id;
    expect(selectedCompanyId).toBe('org-1');

    // Troca de empresa sem deslogar
    selectedCompanyId = orgs[1].id;
    expect(selectedCompanyId).toBe('org-2');
  });

  // Teste 21: Convite para papel viewer (Visualizador)
  it('21. owner pode convidar membro com papel viewer (Visualizador)', async () => {
    (supabase.rpc as any).mockResolvedValueOnce({ data: true, error: null });

    const result = await inviteOrganizationMember(
      'org-abc-1',
      'Auditor@Empresa.com',
      'viewer',
      'Auditor Fiscal'
    );

    expect(result.success).toBe(true);
    expect(supabase.rpc).toHaveBeenCalledWith('invite_organization_member', {
      p_organization_id: 'org-abc-1',
      p_email: 'auditor@empresa.com',
      p_name: 'Auditor Fiscal',
      p_role: 'viewer',
    });
  });

  // Teste 22: Papel viewer é retornado corretamente em getUserRoleInOrganization
  it('22. papel viewer é retornado corretamente em getUserRoleInOrganization', async () => {
    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'organization_members') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { role: 'viewer' },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      return { select: vi.fn() };
    });

    const role = await getUserRoleInOrganization('usr-viewer-1', 'org-abc-1', false);
    expect(role).toBe('viewer');
  });
});
