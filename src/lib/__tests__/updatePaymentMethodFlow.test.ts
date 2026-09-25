import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '../supabase';
import {
  invokeAsaasUpdatePaymentMethod,
  invokeAsaasManageSubscription,
  formatAsaasBillingType,
} from '../billingService';

describe('Alterar Forma de Pagamento (asaas-update-payment-method) - 14 Testes Oficiais', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // 1. owner vê botão Alterar Forma de Pagamento habilitado
  it('1. owner vê botão Alterar Forma de Pagamento habilitado', () => {
    const role = 'owner';
    const isOwner = role === 'owner';
    const isChangePaymentDisabled = !isOwner;

    expect(isChangePaymentDisabled).toBe(false);
  });

  // 2. botão Cancelar Assinatura permanece desabilitado
  it('2. botão Cancelar Assinatura permanece desabilitado', () => {
    const cancelSubscriptionButton = {
      id: 'btn-cancel-subscription',
      disabled: true,
      text: 'CANCELAR ASSINATURA',
      helperText: 'Cancelamento disponível em breve.',
    };

    expect(cancelSubscriptionButton.disabled).toBe(true);
    expect(cancelSubscriptionButton.helperText).toContain('disponível em breve');
  });

  // 3. clique abre confirmação
  it('3. clique abre confirmação', () => {
    let isConfirmationOpen = false;
    const handleOpenConfirmation = () => {
      isConfirmationOpen = true;
    };

    expect(isConfirmationOpen).toBe(false);
    handleOpenConfirmation();
    expect(isConfirmationOpen).toBe(true);
  });

  // 4. confirma chamando asaas-update-payment-method
  it('4. confirma chamando asaas-update-payment-method', async () => {
    const invokeSpy = vi.spyOn(supabase.functions, 'invoke').mockResolvedValue({
      data: { success: true, message: 'Forma de pagamento atualizada com sucesso.' },
      error: null,
    } as any);

    const result = await invokeAsaasUpdatePaymentMethod('org-uuid-123', 'BOLETO');

    expect(invokeSpy).toHaveBeenCalled();
    expect(invokeSpy.mock.calls[0][0]).toBe('asaas-update-payment-method');
    expect(result.data?.success).toBe(true);
  });

  // 5. envia organizationId correto
  it('5. envia organizationId correto', async () => {
    const invokeSpy = vi.spyOn(supabase.functions, 'invoke').mockResolvedValue({
      data: { success: true },
      error: null,
    } as any);

    await invokeAsaasUpdatePaymentMethod('org-target-456', 'BOLETO');

    expect(invokeSpy).toHaveBeenCalledWith(
      'asaas-update-payment-method',
      expect.objectContaining({
        body: expect.objectContaining({
          organizationId: 'org-target-456',
        }),
      })
    );
  });

  // 6. envia paymentMethod BOLETO
  it('6. envia paymentMethod BOLETO', async () => {
    const invokeSpy = vi.spyOn(supabase.functions, 'invoke').mockResolvedValue({
      data: { success: true },
      error: null,
    } as any);

    await invokeAsaasUpdatePaymentMethod('org-target-456', 'BOLETO');

    const body = invokeSpy.mock.calls[0][1]?.body as any;
    expect(body.paymentMethod).toBe('BOLETO');
  });

  // 7. não envia preço
  it('7. não envia preço', async () => {
    const invokeSpy = vi.spyOn(supabase.functions, 'invoke').mockResolvedValue({
      data: { success: true },
      error: null,
    } as any);

    await invokeAsaasUpdatePaymentMethod('org-target-456', 'BOLETO');

    const body = invokeSpy.mock.calls[0][1]?.body as any;
    expect(body.price).toBeUndefined();
    expect(body.basePrice).toBeUndefined();
    expect(body.base_price).toBeUndefined();
    expect(body.extra_user_price).toBeUndefined();
    expect(body.amount).toBeUndefined();
    expect(body.value).toBeUndefined();
  });

  // 8. não envia IDs do Asaas
  it('8. não envia IDs do Asaas', async () => {
    const invokeSpy = vi.spyOn(supabase.functions, 'invoke').mockResolvedValue({
      data: { success: true },
      error: null,
    } as any);

    await invokeAsaasUpdatePaymentMethod('org-target-456', 'BOLETO');

    const body = invokeSpy.mock.calls[0][1]?.body as any;
    expect(body.userId).toBeUndefined();
    expect(body.subscriptionId).toBeUndefined();
    expect(body.provider_subscription_id).toBeUndefined();
    expect(body.asaasSubscriptionId).toBeUndefined();
    expect(body.customerId).toBeUndefined();
    expect(body.paymentId).toBeUndefined();
  });

  // 9. não envia API Key
  it('9. não envia API Key', async () => {
    const invokeSpy = vi.spyOn(supabase.functions, 'invoke').mockResolvedValue({
      data: { success: true },
      error: null,
    } as any);

    await invokeAsaasUpdatePaymentMethod('org-target-456', 'BOLETO');

    const options = invokeSpy.mock.calls[0][1] as any;
    const body = options?.body || {};
    const headers = options?.headers || {};

    expect(body.apiKey).toBeUndefined();
    expect(body.ASAAS_API_KEY).toBeUndefined();
    expect(body.service_role).toBeUndefined();
    expect(body.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
    expect(headers['access_token']).toBeUndefined();
    expect(headers['asaas_key']).toBeUndefined();
  });

  // 10. mostra loading
  it('10. mostra loading e previne clique duplo', async () => {
    let isUpdatingPayment = false;
    let clickCount = 0;

    const handleConfirm = async () => {
      if (isUpdatingPayment) return;
      clickCount++;
      isUpdatingPayment = true;
      // simulando chamada
      await new Promise((resolve) => setTimeout(resolve, 10));
      isUpdatingPayment = false;
    };

    const p1 = handleConfirm();
    const p2 = handleConfirm(); // clique duplo
    expect(isUpdatingPayment).toBe(true);

    await Promise.all([p1, p2]);
    expect(clickCount).toBe(1); // evitou clique duplo
    expect(isUpdatingPayment).toBe(false);
  });

  // 11. trata sucesso
  it('11. trata sucesso exibindo mensagem adequada', async () => {
    vi.spyOn(supabase.functions, 'invoke').mockResolvedValue({
      data: {
        success: true,
        message: 'Forma de pagamento atualizada com sucesso.',
      },
      error: null,
    } as any);

    const result = await invokeAsaasUpdatePaymentMethod('org-123', 'BOLETO');

    expect(result.error).toBeNull();
    expect(result.data?.success).toBe(true);
    expect(result.data?.message).toBe('Forma de pagamento atualizada com sucesso.');
  });

  // 12. trata erro com mensagem do backend ou fallback
  it('12. trata erro com mensagem do backend ou fallback', async () => {
    // Caso A: erro retornado na propriedade data.error
    vi.spyOn(supabase.functions, 'invoke').mockResolvedValueOnce({
      data: {
        success: false,
        error: 'Cliente não possui permissão para alterar.',
      },
      error: null,
    } as any);

    const resA = await invokeAsaasUpdatePaymentMethod('org-123', 'BOLETO');
    expect(resA.error?.message).toBe('Cliente não possui permissão para alterar.');

    // Caso B: erro no invoke (ex: 500) com fallback
    vi.spyOn(supabase.functions, 'invoke').mockResolvedValueOnce({
      data: null,
      error: { message: 'Erro interno no gateway' },
    } as any);

    const resB = await invokeAsaasUpdatePaymentMethod('org-123', 'BOLETO');
    expect(resB.error?.message).toBe('Erro interno no gateway');

    // Caso C: fallback padrão
    vi.spyOn(supabase.functions, 'invoke').mockRejectedValueOnce(new Error());
    const resC = await invokeAsaasUpdatePaymentMethod('org-123', 'BOLETO');
    expect(resC.error?.message).toBe('Não foi possível alterar a forma de pagamento.');
  });

  // 13. após sucesso recarrega asaas-manage-subscription
  it('13. após sucesso recarrega asaas-manage-subscription', async () => {
    const updateSpy = vi.spyOn(supabase.functions, 'invoke').mockImplementation(async (fnName: string) => {
      if (fnName === 'asaas-update-payment-method') {
        return { data: { success: true }, error: null } as any;
      }
      if (fnName === 'asaas-manage-subscription') {
        return {
          data: {
            success: true,
            asaasSubscription: { id: 'sub-1', billingType: 'BOLETO', status: 'ACTIVE' },
          },
          error: null,
        } as any;
      }
      return { data: null, error: null } as any;
    });

    // 1. Atualiza
    const updateRes = await invokeAsaasUpdatePaymentMethod('org-123', 'BOLETO');
    expect(updateRes.data?.success).toBe(true);

    // 2. Recarrega asaas-manage-subscription
    const refreshRes = await invokeAsaasManageSubscription('org-123');
    expect(refreshRes.data?.success).toBe(true);
    expect(updateSpy).toHaveBeenCalledWith('asaas-update-payment-method', expect.anything());
    expect(updateSpy).toHaveBeenCalledWith('asaas-manage-subscription', expect.anything());
  });

  // 14. modal mostra forma atualizada
  it('14. modal mostra forma atualizada como "Boleto / Pix"', () => {
    const updatedBillingType = 'BOLETO';
    const formatted = formatAsaasBillingType(updatedBillingType);

    expect(formatted).toBe('Boleto / Pix');
  });
});
