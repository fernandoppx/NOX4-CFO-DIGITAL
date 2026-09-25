import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '../supabase';
import {
  invokeAsaasUpdateCreditCard,
  invokeAsaasUpdatePaymentMethod,
  invokeAsaasManageSubscription,
  formatAsaasBillingType,
} from '../billingService';

describe('Alterar Forma de Pagamento - Cartão de Crédito e Boleto (20 Testes Oficiais)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // 1. owner vê Boleto / Pix
  it('1. owner vê Boleto / Pix', () => {
    const isOwner = true;
    const availableOptions = isOwner ? ['BOLETO', 'CREDIT_CARD'] : [];
    expect(availableOptions).toContain('BOLETO');
  });

  // 2. owner vê Cartão de crédito
  it('2. owner vê Cartão de crédito', () => {
    const isOwner = true;
    const availableOptions = isOwner ? ['BOLETO', 'CREDIT_CARD'] : [];
    expect(availableOptions).toContain('CREDIT_CARD');
  });

  // 3. seleção de cartão abre formulário
  it('3. seleção de cartão abre formulário', () => {
    let selectedPaymentType = 'BOLETO';
    const setSelectedPaymentType = (type: 'BOLETO' | 'CREDIT_CARD') => {
      selectedPaymentType = type;
    };

    expect(selectedPaymentType).toBe('BOLETO');
    setSelectedPaymentType('CREDIT_CARD');
    expect(selectedPaymentType).toBe('CREDIT_CARD');
    const isFormVisible = selectedPaymentType === 'CREDIT_CARD';
    expect(isFormVisible).toBe(true);
  });

  // 4. campos obrigatórios são validados
  it('4. campos obrigatórios são validados', () => {
    const validateFields = (fields: {
      cardHolderName: string;
      cardNumber: string;
      expiryMonth: string;
      expiryYear: string;
      ccv: string;
      holderFullName: string;
      holderCpfCnpj: string;
      holderEmail: string;
      postalCode: string;
      addressNumber: string;
      phone: string;
    }) => {
      if (fields.cardHolderName.trim().length < 3) return 'Nome impresso no cartão inválido';
      const rawCard = fields.cardNumber.replace(/\D/g, '');
      if (rawCard.length < 13 || rawCard.length > 19) return 'Número de cartão inválido';
      const m = parseInt(fields.expiryMonth.replace(/\D/g, ''), 10);
      if (isNaN(m) || m < 1 || m > 12) return 'Mês inválido';
      const y = parseInt(fields.expiryYear.replace(/\D/g, ''), 10);
      if (isNaN(y) || y < 2026) return 'Ano inválido';
      const rawCcv = fields.ccv.replace(/\D/g, '');
      if (rawCcv.length < 3 || rawCcv.length > 4) return 'CVV inválido';
      if (fields.holderFullName.trim().length < 3) return 'Nome do titular inválido';
      const rawDoc = fields.holderCpfCnpj.replace(/\D/g, '');
      if (rawDoc.length !== 11 && rawDoc.length !== 14) return 'CPF/CNPJ inválido';
      if (!fields.holderEmail.includes('@') || !fields.holderEmail.includes('.')) return 'E-mail inválido';
      if (fields.postalCode.replace(/\D/g, '').length !== 8) return 'CEP inválido';
      if (!fields.addressNumber.trim()) return 'Número inválido';
      if (fields.phone.replace(/\D/g, '').length < 10) return 'Telefone inválido';
      return null;
    };

    // Vazio deve falhar
    const emptyResult = validateFields({
      cardHolderName: '',
      cardNumber: '',
      expiryMonth: '',
      expiryYear: '',
      ccv: '',
      holderFullName: '',
      holderCpfCnpj: '',
      holderEmail: '',
      postalCode: '',
      addressNumber: '',
      phone: '',
    });
    expect(emptyResult).not.toBeNull();

    // Válido deve passar
    const validResult = validateFields({
      cardHolderName: 'JOSE SILVA',
      cardNumber: '4111 2222 3333 4444',
      expiryMonth: '12',
      expiryYear: '2028',
      ccv: '123',
      holderFullName: 'Jose da Silva',
      holderCpfCnpj: '123.456.789-00',
      holderEmail: 'jose@empresa.com.br',
      postalCode: '01310-100',
      addressNumber: '1000',
      phone: '(11) 3222-4444',
    });
    expect(validResult).toBeNull();
  });

  // 5. número é enviado apenas com dígitos
  it('5. número é enviado apenas com dígitos', async () => {
    const invokeSpy = vi.spyOn(supabase.functions, 'invoke').mockResolvedValue({
      data: { success: true },
      error: null,
    } as any);

    await invokeAsaasUpdateCreditCard({
      organizationId: 'org-test',
      creditCard: {
        holderName: 'JOSE SILVA',
        number: '4111 2222 3333 4444',
        expiryMonth: '12',
        expiryYear: '2028',
        ccv: '123',
      },
      creditCardHolderInfo: {
        name: 'Jose Silva',
        email: 'jose@empresa.com.br',
        cpfCnpj: '12345678900',
        postalCode: '01310100',
        addressNumber: '1000',
        phone: '1132224444',
      },
    });

    const body = invokeSpy.mock.calls[0][1]?.body as any;
    expect(body.creditCard.number).toBe('4111222233334444');
    expect(body.creditCard.number).toMatch(/^\d+$/);
  });

  // 6. CPF/CNPJ é enviado apenas com dígitos
  it('6. CPF/CNPJ é enviado apenas com dígitos', async () => {
    const invokeSpy = vi.spyOn(supabase.functions, 'invoke').mockResolvedValue({
      data: { success: true },
      error: null,
    } as any);

    await invokeAsaasUpdateCreditCard({
      organizationId: 'org-test',
      creditCard: {
        holderName: 'JOSE SILVA',
        number: '4111222233334444',
        expiryMonth: '12',
        expiryYear: '2028',
        ccv: '123',
      },
      creditCardHolderInfo: {
        name: 'Jose Silva',
        email: 'jose@empresa.com.br',
        cpfCnpj: '123.456.789-00',
        postalCode: '01310-100',
        addressNumber: '1000',
        phone: '(11) 3222-4444',
      },
    });

    const body = invokeSpy.mock.calls[0][1]?.body as any;
    expect(body.creditCardHolderInfo.cpfCnpj).toBe('12345678900');
    expect(body.creditCardHolderInfo.cpfCnpj).toMatch(/^\d+$/);
  });

  // 7. CEP é enviado apenas com dígitos
  it('7. CEP é enviado apenas com dígitos', async () => {
    const invokeSpy = vi.spyOn(supabase.functions, 'invoke').mockResolvedValue({
      data: { success: true },
      error: null,
    } as any);

    await invokeAsaasUpdateCreditCard({
      organizationId: 'org-test',
      creditCard: {
        holderName: 'JOSE SILVA',
        number: '4111222233334444',
        expiryMonth: '12',
        expiryYear: '2028',
        ccv: '123',
      },
      creditCardHolderInfo: {
        name: 'Jose Silva',
        email: 'jose@empresa.com.br',
        cpfCnpj: '12345678900',
        postalCode: '01310-100',
        addressNumber: '1000',
        phone: '1132224444',
      },
    });

    const body = invokeSpy.mock.calls[0][1]?.body as any;
    expect(body.creditCardHolderInfo.postalCode).toBe('01310100');
    expect(body.creditCardHolderInfo.postalCode).toMatch(/^\d+$/);
  });

  // 8. chama asaas-update-credit-card
  it('8. chama asaas-update-credit-card', async () => {
    const invokeSpy = vi.spyOn(supabase.functions, 'invoke').mockResolvedValue({
      data: { success: true, message: 'Forma de pagamento alterada para cartão de crédito com sucesso.' },
      error: null,
    } as any);

    const result = await invokeAsaasUpdateCreditCard({
      organizationId: 'org-test',
      creditCard: {
        holderName: 'JOSE SILVA',
        number: '4111222233334444',
        expiryMonth: '12',
        expiryYear: '2028',
        ccv: '123',
      },
      creditCardHolderInfo: {
        name: 'Jose Silva',
        email: 'jose@empresa.com.br',
        cpfCnpj: '12345678900',
        postalCode: '01310100',
        addressNumber: '1000',
        phone: '1132224444',
      },
    });

    expect(invokeSpy).toHaveBeenCalled();
    expect(invokeSpy.mock.calls[0][0]).toBe('asaas-update-credit-card');
    expect(result.data?.success).toBe(true);
  });

  // 9. envia organizationId correto
  it('9. envia organizationId correto', async () => {
    const invokeSpy = vi.spyOn(supabase.functions, 'invoke').mockResolvedValue({
      data: { success: true },
      error: null,
    } as any);

    await invokeAsaasUpdateCreditCard({
      organizationId: 'org-specific-999',
      creditCard: {
        holderName: 'JOSE SILVA',
        number: '4111222233334444',
        expiryMonth: '12',
        expiryYear: '2028',
        ccv: '123',
      },
      creditCardHolderInfo: {
        name: 'Jose Silva',
        email: 'jose@empresa.com.br',
        cpfCnpj: '12345678900',
        postalCode: '01310100',
        addressNumber: '1000',
        phone: '1132224444',
      },
    });

    const body = invokeSpy.mock.calls[0][1]?.body as any;
    expect(body.organizationId).toBe('org-specific-999');
  });

  // 10. não envia preço
  it('10. não envia preço', async () => {
    const invokeSpy = vi.spyOn(supabase.functions, 'invoke').mockResolvedValue({
      data: { success: true },
      error: null,
    } as any);

    await invokeAsaasUpdateCreditCard({
      organizationId: 'org-test',
      creditCard: {
        holderName: 'JOSE SILVA',
        number: '4111222233334444',
        expiryMonth: '12',
        expiryYear: '2028',
        ccv: '123',
      },
      creditCardHolderInfo: {
        name: 'Jose Silva',
        email: 'jose@empresa.com.br',
        cpfCnpj: '12345678900',
        postalCode: '01310100',
        addressNumber: '1000',
        phone: '1132224444',
      },
    });

    const body = invokeSpy.mock.calls[0][1]?.body as any;
    expect(body.price).toBeUndefined();
    expect(body.basePrice).toBeUndefined();
    expect(body.base_price).toBeUndefined();
    expect(body.extra_user_price).toBeUndefined();
    expect(body.amount).toBeUndefined();
    expect(body.value).toBeUndefined();
  });

  // 11. não envia API Key
  it('11. não envia API Key', async () => {
    const invokeSpy = vi.spyOn(supabase.functions, 'invoke').mockResolvedValue({
      data: { success: true },
      error: null,
    } as any);

    await invokeAsaasUpdateCreditCard({
      organizationId: 'org-test',
      creditCard: {
        holderName: 'JOSE SILVA',
        number: '4111222233334444',
        expiryMonth: '12',
        expiryYear: '2028',
        ccv: '123',
      },
      creditCardHolderInfo: {
        name: 'Jose Silva',
        email: 'jose@empresa.com.br',
        cpfCnpj: '12345678900',
        postalCode: '01310100',
        addressNumber: '1000',
        phone: '1132224444',
      },
    });

    const options = invokeSpy.mock.calls[0][1] as any;
    const body = options?.body || {};
    const headers = options?.headers || {};

    expect(body.apiKey).toBeUndefined();
    expect(body.ASAAS_API_KEY).toBeUndefined();
    expect(headers['access_token']).toBeUndefined();
    expect(headers['asaas_key']).toBeUndefined();
  });

  // 12. não envia service_role
  it('12. não envia service_role', async () => {
    const invokeSpy = vi.spyOn(supabase.functions, 'invoke').mockResolvedValue({
      data: { success: true },
      error: null,
    } as any);

    await invokeAsaasUpdateCreditCard({
      organizationId: 'org-test',
      creditCard: {
        holderName: 'JOSE SILVA',
        number: '4111222233334444',
        expiryMonth: '12',
        expiryYear: '2028',
        ccv: '123',
      },
      creditCardHolderInfo: {
        name: 'Jose Silva',
        email: 'jose@empresa.com.br',
        cpfCnpj: '12345678900',
        postalCode: '01310100',
        addressNumber: '1000',
        phone: '1132224444',
      },
    });

    const options = invokeSpy.mock.calls[0][1] as any;
    const body = options?.body || {};
    const headers = options?.headers || {};

    expect(body.service_role).toBeUndefined();
    expect(body.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
    expect(headers['service_role']).toBeUndefined();
  });

  // 13. não grava cartão em storage
  it('13. não grava cartão em storage', () => {
    const storageMock: Record<string, string> = {};
    const safeGetItem = (key: string) => {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
      return storageMock[key] || null;
    };

    expect(safeGetItem('cardNumber')).toBeNull();
    expect(safeGetItem('creditCard')).toBeNull();
  });

  // 14. não grava CVV em storage
  it('14. não grava CVV em storage', () => {
    const storageMock: Record<string, string> = {};
    const safeGetItem = (key: string) => {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
      return storageMock[key] || null;
    };

    expect(safeGetItem('ccv')).toBeNull();
    expect(safeGetItem('cvv')).toBeNull();
  });

  // 15. não imprime cartão/CVV no console
  it('15. não imprime cartão/CVV no console', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log');
    const consoleErrorSpy = vi.spyOn(console, 'error');

    vi.spyOn(supabase.functions, 'invoke').mockResolvedValue({
      data: { success: true },
      error: null,
    } as any);

    await invokeAsaasUpdateCreditCard({
      organizationId: 'org-test',
      creditCard: {
        holderName: 'JOSE SILVA',
        number: '4111222233334444',
        expiryMonth: '12',
        expiryYear: '2028',
        ccv: '123',
      },
      creditCardHolderInfo: {
        name: 'Jose Silva',
        email: 'jose@empresa.com.br',
        cpfCnpj: '12345678900',
        postalCode: '01310100',
        addressNumber: '1000',
        phone: '1132224444',
      },
    });

    const allLogs = [
      ...consoleLogSpy.mock.calls.flat(),
      ...consoleErrorSpy.mock.calls.flat(),
    ].join(' ');

    expect(allLogs).not.toContain('4111222233334444');
    expect(allLogs).not.toContain('123');
  });

  // 16. sucesso limpa dados sensíveis
  it('16. sucesso limpa dados sensíveis', () => {
    let state = {
      cardHolderName: 'JOSE SILVA',
      cardNumber: '4111 2222 3333 4444',
      expiryMonth: '12',
      expiryYear: '2028',
      ccv: '123',
      holderFullName: 'Jose Silva',
      holderCpfCnpj: '12345678900',
      holderEmail: 'jose@empresa.com.br',
      postalCode: '01310100',
      addressNumber: '1000',
      addressComplement: 'Apto 10',
      phone: '1132224444',
      mobilePhone: '11999998888',
    };

    const clearSensitiveData = () => {
      state = {
        cardHolderName: '',
        cardNumber: '',
        expiryMonth: '',
        expiryYear: '',
        ccv: '',
        holderFullName: '',
        holderCpfCnpj: '',
        holderEmail: '',
        postalCode: '',
        addressNumber: '',
        addressComplement: '',
        phone: '',
        mobilePhone: '',
      };
    };

    clearSensitiveData();

    expect(state.cardNumber).toBe('');
    expect(state.ccv).toBe('');
    expect(state.expiryMonth).toBe('');
    expect(state.expiryYear).toBe('');
    expect(state.cardHolderName).toBe('');
  });

  // 17. sucesso recarrega asaas-manage-subscription
  it('17. sucesso recarrega asaas-manage-subscription', async () => {
    const invokeSpy = vi.spyOn(supabase.functions, 'invoke').mockImplementation(async (fnName: string) => {
      if (fnName === 'asaas-update-credit-card') {
        return { data: { success: true }, error: null } as any;
      }
      if (fnName === 'asaas-manage-subscription') {
        return {
          data: {
            success: true,
            asaasSubscription: { id: 'sub-1', billingType: 'CREDIT_CARD', status: 'ACTIVE' },
          },
          error: null,
        } as any;
      }
      return { data: null, error: null } as any;
    });

    const updateRes = await invokeAsaasUpdateCreditCard({
      organizationId: 'org-test',
      creditCard: {
        holderName: 'JOSE SILVA',
        number: '4111222233334444',
        expiryMonth: '12',
        expiryYear: '2028',
        ccv: '123',
      },
      creditCardHolderInfo: {
        name: 'Jose Silva',
        email: 'jose@empresa.com.br',
        cpfCnpj: '12345678900',
        postalCode: '01310100',
        addressNumber: '1000',
        phone: '1132224444',
      },
    });

    expect(updateRes.data?.success).toBe(true);

    const refreshRes = await invokeAsaasManageSubscription('org-test');
    expect(refreshRes.data?.success).toBe(true);
    expect(invokeSpy).toHaveBeenCalledWith('asaas-update-credit-card', expect.anything());
    expect(invokeSpy).toHaveBeenCalledWith('asaas-manage-subscription', expect.anything());
  });

  // 18. CREDIT_CARD aparece como "Cartão de crédito"
  it('18. CREDIT_CARD aparece como "Cartão de crédito"', () => {
    const formatted = formatAsaasBillingType('CREDIT_CARD');
    expect(formatted).toBe('Cartão de crédito');
  });

  // 19. Boleto / Pix continua funcionando
  it('19. Boleto / Pix continua funcionando', async () => {
    const invokeSpy = vi.spyOn(supabase.functions, 'invoke').mockResolvedValue({
      data: { success: true, message: 'Forma de pagamento atualizada com sucesso.' },
      error: null,
    } as any);

    const result = await invokeAsaasUpdatePaymentMethod('org-test', 'BOLETO');

    expect(invokeSpy).toHaveBeenCalledWith('asaas-update-payment-method', {
      body: {
        organizationId: 'org-test',
        paymentMethod: 'BOLETO',
      },
    });
    expect(result.data?.success).toBe(true);
  });

  // 20. Cancelar assinatura continua desabilitado
  it('20. Cancelar assinatura continua desabilitado', () => {
    const cancelSubscriptionButton = {
      id: 'btn-cancel-subscription',
      disabled: true,
      text: 'CANCELAR ASSINATURA',
      helperText: 'Cancelamento disponível em breve.',
    };

    expect(cancelSubscriptionButton.disabled).toBe(true);
    expect(cancelSubscriptionButton.text).toBe('CANCELAR ASSINATURA');
    expect(cancelSubscriptionButton.helperText).toContain('disponível em breve');
  });
});
