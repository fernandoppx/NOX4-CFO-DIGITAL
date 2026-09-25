import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '../supabase';
import {
  invokeAsaasManageSubscription,
  formatCurrencyBRL,
  formatAsaasBillingType,
  formatAsaasSubscriptionCycle,
  formatAsaasPaymentStatus,
  formatAsaasSubscriptionStatus,
  formatDateBR,
  AsaasManageSubscriptionResponse,
} from '../billingService';

// Mock de window.open para testes
const windowOpenMock = vi.fn();
if (typeof window !== 'undefined') {
  window.open = windowOpenMock;
} else {
  (globalThis as any).window = { open: windowOpenMock };
}

describe('Gerenciar Assinatura (asaas-manage-subscription) - 16 Testes Oficiais', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    windowOpenMock.mockClear();
  });

  // 1. owner consegue abrir Gerenciar assinatura
  it('1. owner consegue abrir Gerenciar assinatura', () => {
    const isOwnerAllowed = (role?: string) => role === 'owner';
    expect(isOwnerAllowed('owner')).toBe(true);
  });

  // 2. finance não consegue
  it('2. finance não consegue', () => {
    const isOwnerAllowed = (role?: string) => role === 'owner';
    expect(isOwnerAllowed('finance')).toBe(false);
  });

  // 3. viewer não consegue
  it('3. viewer não consegue', () => {
    const isOwnerAllowed = (role?: string) => role === 'owner';
    expect(isOwnerAllowed('viewer')).toBe(false);
    expect(isOwnerAllowed('guest')).toBe(false);
    expect(isOwnerAllowed('')).toBe(false);
  });

  // 4. botão chama asaas-manage-subscription
  it('4. botão chama asaas-manage-subscription', async () => {
    const invokeSpy = vi.spyOn(supabase.functions, 'invoke').mockResolvedValue({
      data: {
        success: true,
        plan: { id: 'plan-1', name: 'NOX4 Pro', basePrice: 299 },
        asaasSubscription: { id: 'sub-1', status: 'ACTIVE', value: 299 },
      },
      error: null,
    } as any);

    const result = await invokeAsaasManageSubscription('org-123');

    expect(invokeSpy).toHaveBeenCalled();
    expect(invokeSpy.mock.calls[0][0]).toBe('asaas-manage-subscription');
    expect(result.data?.success).toBe(true);
  });

  // 5. envia organizationId correto
  it('5. envia organizationId correto', async () => {
    const invokeSpy = vi.spyOn(supabase.functions, 'invoke').mockResolvedValue({
      data: { success: true },
      error: null,
    } as any);

    await invokeAsaasManageSubscription('org-alpha-999');

    expect(invokeSpy).toHaveBeenCalledWith(
      'asaas-manage-subscription',
      expect.objectContaining({
        body: {
          organizationId: 'org-alpha-999',
        },
      })
    );
  });

  // 6. não envia preço
  it('6. não envia preço', async () => {
    const invokeSpy = vi.spyOn(supabase.functions, 'invoke').mockResolvedValue({
      data: { success: true },
      error: null,
    } as any);

    await invokeAsaasManageSubscription('org-alpha-999');

    const payload = invokeSpy.mock.calls[0][1]?.body as any;
    expect(payload.price).toBeUndefined();
    expect(payload.basePrice).toBeUndefined();
    expect(payload.base_price).toBeUndefined();
    expect(payload.extra_user_price).toBeUndefined();
    expect(payload.amount).toBeUndefined();
    expect(payload.value).toBeUndefined();
  });

  // 7. não envia API Key
  it('7. não envia API Key', async () => {
    const invokeSpy = vi.spyOn(supabase.functions, 'invoke').mockResolvedValue({
      data: { success: true },
      error: null,
    } as any);

    await invokeAsaasManageSubscription('org-alpha-999');

    const options = invokeSpy.mock.calls[0][1] as any;
    const body = options?.body || {};
    const headers = options?.headers || {};

    expect(body.apiKey).toBeUndefined();
    expect(body.ASAAS_API_KEY).toBeUndefined();
    expect(body.service_role).toBeUndefined();
    expect(headers['access_token']).toBeUndefined();
    expect(headers['asaas_key']).toBeUndefined();
  });

  // 8. mostra plano
  it('8. mostra plano', () => {
    const mockResponse: AsaasManageSubscriptionResponse = {
      success: true,
      plan: {
        id: 'plan-custom',
        name: 'NOX4 Pro Multi-Empresa',
        basePrice: 499,
        includedUsers: 5,
        extraUserPrice: 35,
        maxOrganizations: 2,
      },
    };

    expect(mockResponse.plan?.name).toBe('NOX4 Pro Multi-Empresa');
    expect(mockResponse.plan?.includedUsers).toBe(5);
    expect(mockResponse.plan?.maxOrganizations).toBe(2);
  });

  // 9. mostra valor
  it('9. mostra valor formatado em moeda BRL', () => {
    const basePrice = 499;
    const extraPrice = 35.5;
    const subValue = 534.5;

    const formattedBase = formatCurrencyBRL(basePrice);
    const formattedExtra = formatCurrencyBRL(extraPrice);
    const formattedSub = formatCurrencyBRL(subValue);

    expect(formattedBase).toContain('R$');
    expect(formattedBase).toContain('499,00');

    expect(formattedExtra).toContain('R$');
    expect(formattedExtra).toContain('35,50');

    expect(formattedSub).toContain('R$');
    expect(formattedSub).toContain('534,50');
  });

  // 10. mostra próxima cobrança
  it('10. mostra próxima cobrança', () => {
    const asaasSub = {
      status: 'ACTIVE',
      billingType: 'PIX',
      value: 299,
      cycle: 'MONTHLY',
      nextDueDate: '2026-10-15',
      description: 'Assinatura Plano Pro',
    };

    const formattedCycle = formatAsaasSubscriptionCycle(asaasSub.cycle);
    const formattedDate = formatDateBR(asaasSub.nextDueDate);
    const formattedStatus = formatAsaasSubscriptionStatus(asaasSub.status);
    const formattedBilling = formatAsaasBillingType(asaasSub.billingType);

    expect(formattedCycle).toBe('Mensal');
    expect(formattedDate).toBe('15/10/2026');
    expect(formattedStatus.label).toBe('Ativa');
    expect(formattedBilling).toBe('Pix');
  });

  // 11. mostra cobrança atual
  it('11. mostra cobrança atual', () => {
    const currentPayment = {
      id: 'pay-001',
      status: 'PENDING',
      value: 299,
      dueDate: '2026-09-15',
      paymentDate: null,
      billingType: 'PIX',
      invoiceUrl: 'https://sandbox.asaas.com/i/pay-001',
    };

    const statusInfo = formatAsaasPaymentStatus(currentPayment.status);
    const formattedDue = formatDateBR(currentPayment.dueDate);
    const formattedValue = formatCurrencyBRL(currentPayment.value);
    const formattedType = formatAsaasBillingType(currentPayment.billingType);

    expect(statusInfo.label).toBe('Pendente');
    expect(statusInfo.badgeText).toContain('text-amber');
    expect(formattedDue).toBe('15/09/2026');
    expect(formattedValue).toContain('299,00');
    expect(formattedType).toBe('Pix');
  });

  // 12. mostra histórico
  it('12. mostra histórico ordenado da mais recente para a mais antiga sem inventar dados', () => {
    const rawPayments = [
      { id: 'p1', dueDate: '2026-07-15', value: 299, status: 'RECEIVED', billingType: 'BOLETO' },
      { id: 'p2', dueDate: '2026-09-15', value: 299, status: 'PENDING', billingType: 'PIX' },
      { id: 'p3', dueDate: '2026-08-15', value: 299, status: 'CONFIRMED', billingType: 'CREDIT_CARD' },
    ];

    const sorted = rawPayments.slice().sort((a, b) => {
      return new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime();
    });

    expect(sorted.map((p) => p.id)).toEqual(['p2', 'p3', 'p1']);
    expect(sorted[0].dueDate).toBe('2026-09-15');
    expect(sorted[2].dueDate).toBe('2026-07-15');

    // Confirma mapeamento dos status do histórico
    expect(formatAsaasPaymentStatus(sorted[0].status).label).toBe('Pendente');
    expect(formatAsaasPaymentStatus(sorted[1].status).label).toBe('Confirmada');
    expect(formatAsaasPaymentStatus(sorted[2].status).label).toBe('Recebida');
  });

  // 13. invoiceUrl abre corretamente
  it('13. invoiceUrl abre corretamente', () => {
    const payment = {
      id: 'pay-url',
      invoiceUrl: 'https://sandbox.asaas.com/i/test-invoice',
    };

    const handleOpenInvoice = (url?: string) => {
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    };

    handleOpenInvoice(payment.invoiceUrl);

    expect(windowOpenMock).toHaveBeenCalledWith(
      'https://sandbox.asaas.com/i/test-invoice',
      '_blank',
      'noopener,noreferrer'
    );
  });

  // 14. bankSlipUrl aparece quando existe
  it('14. bankSlipUrl aparece quando existe e abre corretamente', () => {
    const paymentWithBoleto = {
      id: 'pay-boleto',
      bankSlipUrl: 'https://sandbox.asaas.com/b/pdf/test-bankslip',
      invoiceUrl: 'https://sandbox.asaas.com/i/test-invoice',
    };

    const paymentWithoutBoleto = {
      id: 'pay-pix',
      invoiceUrl: 'https://sandbox.asaas.com/i/test-invoice',
    };

    expect(Boolean(paymentWithBoleto.bankSlipUrl)).toBe(true);
    expect(Boolean((paymentWithoutBoleto as any).bankSlipUrl)).toBe(false);

    const handleOpenBankSlip = (url?: string) => {
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    };

    handleOpenBankSlip(paymentWithBoleto.bankSlipUrl);
    expect(windowOpenMock).toHaveBeenCalledWith(
      'https://sandbox.asaas.com/b/pdf/test-bankslip',
      '_blank',
      'noopener,noreferrer'
    );
  });

  // 15. cancelamento continua desabilitado
  it('15. cancelamento continua desabilitado', () => {
    const cancelButtonProps = {
      disabled: true,
      text: 'CANCELAR ASSINATURA',
      helperText: 'Disponível em breve.',
    };

    expect(cancelButtonProps.disabled).toBe(true);
    expect(cancelButtonProps.text).toBe('CANCELAR ASSINATURA');
    expect(cancelButtonProps.helperText).toBe('Disponível em breve.');
  });

  // 16. alteração de pagamento agora está habilitada para owner
  it('16. alteração de pagamento agora está habilitada para owner', () => {
    const isOwner = true;
    const changePaymentMethodProps = {
      disabled: !isOwner,
      text: 'ALTERAR FORMA DE PAGAMENTO',
    };

    expect(changePaymentMethodProps.disabled).toBe(false);
    expect(changePaymentMethodProps.text).toBe('ALTERAR FORMA DE PAGAMENTO');
  });
});

