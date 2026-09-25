import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '../supabase';
import {
  fetchActivePlans,
  invokeAsaasStartCheckout,
  formatCurrencyBRL,
} from '../billingService';
import { Plan } from '../../types';

describe('Fluxo Comercial de Planos e Checkout do NOX4 (Dois Planos Distintos)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockMonthlyPlan: Plan = {
    id: 'plan-monthly-uuid',
    name: 'NOX4 Mensal',
    description: 'Mais flexibilidade, cobrança mensal.',
    billing_cycle: 'monthly',
    base_price: 109.90,
    annual_price: null,
    max_organizations: 1,
    included_users: 3,
    extra_user_price: 19.90,
    active: true,
  };

  const mockYearlyPlan: Plan = {
    id: 'plan-yearly-uuid',
    name: 'NOX4 Anual',
    description: 'Melhor valor. Pagamento anual com desconto.',
    billing_cycle: 'yearly',
    base_price: 89.90,
    annual_price: 1078.80,
    max_organizations: 1,
    included_users: 3,
    extra_user_price: 19.90,
    active: true,
  };

  it('1. Deve calcular economia dinâmica entre os dois planos sem hardcode de R$ 240', () => {
    const monthlyTotalAnnual = (mockMonthlyPlan.base_price ?? 0) * 12; // 109.90 * 12 = 1318.80
    const yearlyTotal = mockYearlyPlan.annual_price ?? 0; // 1078.80

    expect(monthlyTotalAnnual).toBeCloseTo(1318.80, 2);
    expect(yearlyTotal).toBe(1078.80);

    const calculatedSavings = monthlyTotalAnnual - yearlyTotal;
    expect(calculatedSavings).toBeCloseTo(240.00, 2);
    expect(formatCurrencyBRL(calculatedSavings).replace(/\s/g, ' ')).toBe('R$ 240,00');

    // Valor equivalente mensal do plano anual
    const yearlyMonthlyEquivalent = yearlyTotal / 12;
    expect(yearlyMonthlyEquivalent).toBeCloseTo(89.90, 2);
    expect(formatCurrencyBRL(yearlyMonthlyEquivalent).replace(/\s/g, ' ')).toBe('R$ 89,90');
  });

  it('2. fetchActivePlans deve selecionar billing_cycle e carregar os dois planos ativos', async () => {
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: [mockMonthlyPlan, mockYearlyPlan],
          error: null,
        }),
      }),
    });

    vi.spyOn(supabase, 'from').mockReturnValue({
      select: mockSelect,
    } as any);

    const { data: plans, error } = await fetchActivePlans();
    expect(error).toBeNull();
    expect(mockSelect).toHaveBeenCalledWith(
      expect.stringContaining('billing_cycle')
    );
    expect(plans).toHaveLength(2);
    expect(plans![0].billing_cycle).toBe('monthly');
    expect(plans![1].billing_cycle).toBe('yearly');
    expect(plans![1].annual_price).toBe(1078.80);
  });

  it('3. REGRA DE SEGURANÇA: invokeAsaasStartCheckout NÃO deve enviar billingCycle nem preços no body', async () => {
    const invokeSpy = vi.spyOn(supabase.functions, 'invoke').mockResolvedValue({
      data: {
        success: true,
        billingCycle: 'monthly',
        plan: {
          id: 'plan-monthly-uuid',
          name: 'NOX4 Mensal',
          basePrice: 109.90,
        },
        firstPayment: {
          amount: 36.63,
          periodEnd: '2026-04-10',
        },
        recurring: {
          amount: 109.90,
          nextDueDate: '2026-04-10',
          cycle: 'monthly',
        },
        pix: {
          encodedImage: 'base64pix...',
          payload: '00020126580014br.gov.bcb.pix...',
        },
      },
      error: null,
    });

    const input = {
      planId: 'plan-monthly-uuid',
      companyName: 'Minha Empresa Ltda',
      cpfCnpj: '12345678000199',
      billingEmail: 'financeiro@empresa.com.br',
      phone: '11999999999',
    };

    const { data: response, error } = await invokeAsaasStartCheckout(input);

    expect(error).toBeNull();
    expect(invokeSpy).toHaveBeenCalledWith('asaas-start-checkout', {
      body: {
        planId: 'plan-monthly-uuid',
        companyName: 'Minha Empresa Ltda',
        cpfCnpj: '12345678000199',
        billingEmail: 'financeiro@empresa.com.br',
        phone: '11999999999',
      },
    });

    // Verificação estrita de segurança:
    const callBody = invokeSpy.mock.calls[0][1]?.body as any;
    expect(callBody.billingCycle).toBeUndefined(); // NÃO enviar billingCycle!
    expect(callBody.price).toBeUndefined();
    expect(callBody.amount).toBeUndefined();
    expect(callBody.basePrice).toBeUndefined();
    expect(callBody.annualPrice).toBeUndefined();
    expect(callBody.userId).toBeUndefined();
    expect(callBody.subscriptionId).toBeUndefined();
    expect(callBody.ASAAS_API_KEY).toBeUndefined();
    expect(callBody.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();

    expect(response?.success).toBe(true);
    expect(response?.firstPayment?.amount).toBe(36.63);
    expect(response?.firstPayment?.periodEnd).toBe('2026-04-10');
    expect(response?.recurring?.cycle).toBe('monthly');
  });

  it('4. Contratação do Plano Anual envia apenas o planId anual para o backend', async () => {
    const invokeSpy = vi.spyOn(supabase.functions, 'invoke').mockResolvedValue({
      data: {
        success: true,
        billingCycle: 'yearly',
        plan: {
          id: 'plan-yearly-uuid',
          name: 'NOX4 Anual',
          basePrice: 89.90,
          annualPrice: 1078.80,
        },
        firstPayment: {
          amount: 1078.80,
          periodEnd: '2027-01-10',
        },
        recurring: {
          amount: 1078.80,
          nextDueDate: '2027-01-10',
          cycle: 'yearly',
        },
        pix: {
          encodedImage: 'base64pix...',
          payload: '00020126580014br.gov.bcb.pix...',
        },
      },
      error: null,
    });

    const input = {
      planId: 'plan-yearly-uuid',
      companyName: 'Organização Anual S.A.',
      cpfCnpj: '98765432000100',
      billingEmail: 'admin@anual.com.br',
      phone: '11988887777',
    };

    const { data: response, error } = await invokeAsaasStartCheckout(input);

    expect(error).toBeNull();
    const callBody = invokeSpy.mock.calls[0][1]?.body as any;
    expect(callBody.planId).toBe('plan-yearly-uuid');
    expect(callBody.billingCycle).toBeUndefined();
    expect(callBody.amount).toBeUndefined();

    expect(response?.success).toBe(true);
    expect(response?.billingCycle).toBe('yearly');
    expect(response?.firstPayment?.amount).toBe(1078.80);
  });

  it('5. Consumo dos dados de resposta sem cálculo de pró-rata no frontend', () => {
    const edgeFunctionResponse = {
      firstPayment: {
        amount: 36.63,
        periodEnd: '2026-04-10',
      },
      recurring: {
        amount: 109.90,
        nextDueDate: '2026-04-10',
        cycle: 'monthly' as const,
      },
    };

    const formatDateBR = (dateStr?: string | null): string => {
      if (!dateStr) return '';
      const [year, month, day] = dateStr.split('-');
      return `${day}/${month}/${year}`;
    };

    const formattedFirstPayment = formatCurrencyBRL(edgeFunctionResponse.firstPayment.amount).replace(/\s/g, ' ');
    const formattedPeriodEnd = formatDateBR(edgeFunctionResponse.firstPayment.periodEnd);
    const formattedRecurringAmount = formatCurrencyBRL(edgeFunctionResponse.recurring.amount).replace(/\s/g, ' ');
    const formattedNextDueDate = formatDateBR(edgeFunctionResponse.recurring.nextDueDate);

    expect(formattedFirstPayment).toBe('R$ 36,63');
    expect(formattedPeriodEnd).toBe('10/04/2026');
    expect(formattedRecurringAmount).toBe('R$ 109,90');
    expect(formattedNextDueDate).toBe('10/04/2026');
  });
});
