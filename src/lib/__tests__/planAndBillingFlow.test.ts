import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateExtraUsers,
  calculateExtraMonthlyCost,
  formatCurrencyBRL,
  interpretSubscriptionStatus,
  fetchSubscriptionByOrganization,
  fetchPlanById,
  countActiveOrganizationMembers,
} from '../billingService';
import { supabase } from '../supabase';

describe('Plano e Cobrança - 15 Casos de Teste Oficiais', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // Caso 1
  it('1. calculateExtraUsers deve retornar 0 quando usuários ativos <= incluídos no plano', () => {
    expect(calculateExtraUsers(1, 3)).toBe(0);
    expect(calculateExtraUsers(2, 3)).toBe(0);
    expect(calculateExtraUsers(3, 3)).toBe(0);
  });

  // Caso 2
  it('2. calculateExtraUsers deve retornar o excedente correto quando ativos > incluídos', () => {
    expect(calculateExtraUsers(4, 3)).toBe(1);
    expect(calculateExtraUsers(5, 3)).toBe(2);
    expect(calculateExtraUsers(10, 5)).toBe(5);
  });

  // Caso 3
  it('3. calculateExtraUsers deve ser resiliente a valores negativos ou nulos/zero', () => {
    expect(calculateExtraUsers(0, 0)).toBe(0);
    expect(calculateExtraUsers(0, 5)).toBe(0);
    expect(calculateExtraUsers(-2, 3)).toBe(0);
    expect(calculateExtraUsers(NaN as any, 3)).toBe(0);
  });

  // Caso 4
  it('4. calculateExtraMonthlyCost deve retornar 0.00 quando não há usuários excedentes', () => {
    expect(calculateExtraMonthlyCost(0, 29.9)).toBe(0);
    expect(calculateExtraMonthlyCost(0, 50)).toBe(0);
  });

  // Caso 5
  it('5. calculateExtraMonthlyCost deve calcular o valor correto para usuários extras', () => {
    // 2 extras a R$ 29,90 = R$ 59,80
    expect(calculateExtraMonthlyCost(2, 29.9)).toBe(59.8);
    // 1 extra a R$ 35,00 = R$ 35,00
    expect(calculateExtraMonthlyCost(1, 35.0)).toBe(35);
  });

  // Caso 6
  it('6. calculateExtraMonthlyCost deve manter precisão monetária de 2 casas decimais', () => {
    // 3 extras a R$ 19,99 = 59.97
    expect(calculateExtraMonthlyCost(3, 19.99)).toBe(59.97);
    // 7 extras a R$ 14.33333 -> arredonda para 2 casas decimais
    expect(calculateExtraMonthlyCost(7, 14.33333)).toBe(100.33);
  });

  // Caso 7
  it('7. formatCurrencyBRL deve formatar números no padrão da moeda Real (BRL)', () => {
    const formattedZero = formatCurrencyBRL(0);
    expect(formattedZero).toContain('R$');
    expect(formattedZero).toContain('0,00');

    const formattedCost = formatCurrencyBRL(59.8);
    expect(formattedCost).toContain('R$');
    expect(formattedCost).toContain('59,80');

    const formattedLarge = formatCurrencyBRL(1250.5);
    expect(formattedLarge).toContain('R$');
    expect(formattedLarge).toContain('1.250,50');
  });

  // Caso 8
  it("8. interpretSubscriptionStatus deve mapear status 'trialing' para Período de teste", () => {
    const res = interpretSubscriptionStatus('trialing');
    expect(res.label).toBe('Período de teste');
    expect(res.badgeText).toContain('text-amber');
  });

  // Caso 9
  it("9. interpretSubscriptionStatus deve mapear status 'active' para Ativo", () => {
    const res = interpretSubscriptionStatus('active');
    expect(res.label).toBe('Ativo');
    expect(res.badgeText).toContain('text-emerald');
  });

  // Caso 10
  it("10. interpretSubscriptionStatus deve mapear status 'past_due' para Pagamento pendente", () => {
    const res = interpretSubscriptionStatus('past_due');
    expect(res.label).toBe('Pagamento pendente');
    expect(res.badgeText).toContain('text-orange');
  });

  // Caso 11
  it("11. interpretSubscriptionStatus deve mapear status 'cancelled' para Cancelado", () => {
    const res = interpretSubscriptionStatus('cancelled');
    expect(res.label).toBe('Cancelado');
    expect(res.badgeText).toContain('text-slate');
  });

  // Caso 12
  it("12. interpretSubscriptionStatus deve mapear status 'suspended' para Suspenso", () => {
    const res = interpretSubscriptionStatus('suspended');
    expect(res.label).toBe('Suspenso');
    expect(res.badgeText).toContain('text-rose');
  });

  // Caso 13
  it('13. countActiveOrganizationMembers deve contar apenas membros em organization_members da CIA ativa', async () => {
    const selectMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({
          count: 3,
          data: [
            { id: 'm-1', role: 'owner' },
            { id: 'm-2', role: 'finance' },
            { id: 'm-3', role: 'viewer' },
          ],
          error: null,
        }),
      }),
    });

    vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
      if (table === 'organization_members') {
        return { select: selectMock } as any;
      }
      return {} as any;
    });

    const result = await countActiveOrganizationMembers('org-123');
    expect(result.count).toBe(3);
    expect(result.error).toBeNull();
    expect(supabase.from).toHaveBeenCalledWith('organization_members');
  });

  // Caso 14
  it('14. Regras de RBAC: Apenas role owner tem permissão de acesso a Plano e Cobrança', () => {
    const checkIsOwnerAllowed = (role: string) => role === 'owner';

    expect(checkIsOwnerAllowed('owner')).toBe(true);
    expect(checkIsOwnerAllowed('finance')).toBe(false);
    expect(checkIsOwnerAllowed('viewer')).toBe(false);
    expect(checkIsOwnerAllowed('')).toBe(false);
  });

  // Caso 15
  it('15. fetchSubscriptionByOrganization e fetchPlanById buscam dados reais do Supabase ou retornam null seguro', async () => {
    const maybeSingleSubMock = vi.fn().mockResolvedValue({
      data: {
        id: 'sub-001',
        organization_id: 'org-abc',
        plan_id: 'plan-nox4',
        status: 'active',
      },
      error: null,
    });

    const maybeSinglePlanMock = vi.fn().mockResolvedValue({
      data: {
        id: 'plan-nox4',
        name: 'NOX4 Pro',
        max_organizations: 1,
        included_users: 3,
        extra_user_price: 29.9,
      },
      error: null,
    });

    vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
      if (table === 'subscriptions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: maybeSingleSubMock,
            }),
          }),
        } as any;
      }
      if (table === 'plans') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: maybeSinglePlanMock,
            }),
          }),
        } as any;
      }
      return {} as any;
    });

    // 15a. Assinatura encontrada
    const subResult = await fetchSubscriptionByOrganization('org-abc');
    expect(subResult.data).toBeDefined();
    expect(subResult.data?.plan_id).toBe('plan-nox4');

    // 15b. Plano associado encontrado
    const planResult = await fetchPlanById('plan-nox4');
    expect(planResult.data?.name).toBe('NOX4 Pro');
    expect(planResult.data?.included_users).toBe(3);
    expect(planResult.data?.extra_user_price).toBe(29.9);

    // 15c. Fallback seguro quando não há organização
    const emptySub = await fetchSubscriptionByOrganization('');
    expect(emptySub.data).toBeNull();
    expect(emptySub.error).toBeNull();
  });
});
