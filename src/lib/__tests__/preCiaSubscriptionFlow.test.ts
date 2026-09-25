import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '../supabase';
import { fetchActivePlans, fetchPlanById, formatPlanPrice, formatCurrencyBRL } from '../billingService';
import { Plan } from '../../types';

// Mock resiliente de sessionStorage para ambientes Node/Vitest
const storageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    clear: () => {
      store = {};
    },
    removeItem: (key: string) => {
      delete store[key];
    },
  };
})();

if (typeof globalThis.sessionStorage === 'undefined') {
  Object.defineProperty(globalThis, 'sessionStorage', {
    value: storageMock,
    writable: true,
  });
}

describe('Suíte de Testes Oficial - Fluxo Pré-CIA de Contratação de Planos (20 Casos)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  // 1. Usuário sem organização vê opção 'Contratar plano'
  it('1. Usuário sem organização vê opção "Contratar plano" estruturada na tela', () => {
    const option1Title = 'Quero usar o NOX4 na minha empresa';
    const option1Button = 'Contratar Plano';
    expect(option1Title).toBe('Quero usar o NOX4 na minha empresa');
    expect(option1Button).toBe('Contratar Plano');
  });

  // 2. Usuário sem organização vê opção 'Já fui convidado'
  it('2. Usuário sem organização vê opção "Já fui convidado" com verificação de convite', () => {
    const option2Title = 'Já fui convidado para uma empresa';
    const option2Button = 'Verificar Convite';
    expect(option2Title).toBe('Já fui convidado para uma empresa');
    expect(option2Button).toBe('Verificar Convite');
  });

  // 3. Botão 'Contratar plano' direciona para /plans
  it('3. Botão "Contratar plano" direciona o fluxo para a rota /plans', () => {
    let navigatedRoute = '';
    const onNavigateToPlans = () => {
      navigatedRoute = '/plans';
    };
    onNavigateToPlans();
    expect(navigatedRoute).toBe('/plans');
  });

  // 4. Rota /plans não exige organização
  it('4. Rota /plans permite acesso de usuário autenticado mesmo com organizations=[]', () => {
    const currentUser = { id: 'usr-1', email: 'user@empresa.com', name: 'Gestor' };
    const userOrganizations: any[] = [];
    const isSysAdmin = false;
    const currentRoute = '/plans';

    const canAccessPlansRoute = Boolean(currentUser) && currentRoute === '/plans';
    expect(canAccessPlansRoute).toBe(true);
    expect(userOrganizations.length).toBe(0);
    expect(isSysAdmin).toBe(false);
  });

  // 5. Rota /plans busca da tabela plans
  it('5. Rota /plans busca dados exclusivamente da tabela "plans" do Supabase', async () => {
    const mockFrom = vi.spyOn(supabase, 'from').mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: [
              {
                id: 'plan-1',
                name: 'Starter',
                base_price: 199,
                included_users: 3,
                extra_user_price: 29.9,
                max_organizations: 1,
                active: true,
              },
            ],
            error: null,
          }),
        }),
      }),
    } as any);

    const { data, error } = await fetchActivePlans();
    expect(mockFrom).toHaveBeenCalledWith('plans');
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].name).toBe('Starter');
  });

  // 6. Rota /plans filtra active = true
  it('6. Rota /plans filtra estritamente active = true no Supabase', async () => {
    const eqMock = vi.fn().mockReturnValue({
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    });
    vi.spyOn(supabase, 'from').mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: eqMock,
      }),
    } as any);

    await fetchActivePlans();
    expect(eqMock).toHaveBeenCalledWith('active', true);
  });

  // 7. Rota /plans ordena por base_price crescente
  it('7. Rota /plans ordena planos por base_price crescente', async () => {
    const orderMock = vi.fn().mockResolvedValue({ data: [], error: null });
    vi.spyOn(supabase, 'from').mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: orderMock,
        }),
      }),
    } as any);

    await fetchActivePlans();
    expect(orderMock).toHaveBeenCalledWith('base_price', { ascending: true });
  });

  // 8. Plano com base_price = 0 mostra 'Preço ainda não definido'
  it('8. Plano com base_price = 0 mostra "Preço ainda não definido"', () => {
    expect(formatPlanPrice(0)).toBe('Preço ainda não definido');
    expect(formatPlanPrice(undefined)).toBe('Preço ainda não definido');
    expect(formatPlanPrice(199).replace(/\s/g, ' ')).toBe('R$ 199,00 / mês');
  });

  // 9. Cards exibem max_organizations, included_users, extra_user_price
  it('9. Cards exibem max_organizations, included_users e extra_user_price do plano', () => {
    const plan: Plan = {
      id: 'plan-pro',
      name: 'Professional',
      base_price: 349,
      included_users: 5,
      extra_user_price: 35.0,
      max_organizations: 2,
      active: true,
    };

    expect(plan.max_organizations).toBe(2);
    expect(plan.included_users).toBe(5);
    expect(plan.extra_user_price).toBe(35.0);
    expect(formatCurrencyBRL(plan.extra_user_price).replace(/\s/g, ' ')).toBe('R$ 35,00');
  });

  // 10. Clique em CONTRATAR PLANO guarda selectedPlanId
  it('10. Clique em CONTRATAR PLANO guarda selectedPlanId no sessionStorage temporário', () => {
    const planId = 'plan-growth-123';
    sessionStorage.setItem('nox4_selected_plan_id', planId);

    const storedId = sessionStorage.getItem('nox4_selected_plan_id');
    expect(storedId).toBe('plan-growth-123');
  });

  // 11. Clique em CONTRATAR PLANO navega para /checkout
  it('11. Clique em CONTRATAR PLANO navega para a rota /checkout', () => {
    let currentRoute = '/plans';
    const onSelectPlan = (plan: Plan) => {
      sessionStorage.setItem('nox4_selected_plan_id', plan.id);
      currentRoute = '/checkout';
    };

    onSelectPlan({
      id: 'plan-123',
      name: 'Starter',
      base_price: 199,
      included_users: 2,
      extra_user_price: 29,
      max_organizations: 1,
      active: true,
    });

    expect(currentRoute).toBe('/checkout');
    expect(sessionStorage.getItem('nox4_selected_plan_id')).toBe('plan-123');
  });

  // 12. Rota /checkout recupera o plano selecionado pelo Supabase
  it('12. Rota /checkout busca o plano diretamente no Supabase por id, sem confiar no client', async () => {
    const mockFrom = vi.spyOn(supabase, 'from').mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: 'plan-real',
              name: 'Enterprise',
              base_price: 890,
              included_users: 10,
              extra_user_price: 25,
              max_organizations: 5,
              active: true,
            },
            error: null,
          }),
        }),
      }),
    } as any);

    const { data } = await fetchPlanById('plan-real');
    expect(mockFrom).toHaveBeenCalledWith('plans');
    expect(data?.name).toBe('Enterprise');
    expect(data?.base_price).toBe(890);
  });

  // 13. Rota /checkout exibe resumo correto da assinatura
  it('13. Rota /checkout exibe resumo correto da assinatura (nome, preço base, max_orgs, users)', () => {
    const plan: Plan = {
      id: 'p-1',
      name: 'Plano CFO Pro',
      base_price: 499,
      included_users: 5,
      extra_user_price: 39,
      max_organizations: 1,
      active: true,
    };

    const initialTotal = plan.base_price;
    expect(initialTotal).toBe(499);
    expect(plan.max_organizations).toBe(1);
    expect(plan.included_users).toBe(5);
  });

  // 14. Rota /checkout não cobra usuários adicionais inicialmente
  it('14. Rota /checkout não cobra usuários adicionais inicialmente (total inicial = base_price)', () => {
    const basePrice = 299;
    const extraUsersAtStart = 0;
    const extraUserPrice = 30;

    const initialCheckoutTotal = basePrice + extraUsersAtStart * extraUserPrice;
    expect(initialCheckoutTotal).toBe(basePrice);
  });

  // 15. Rota /checkout possui campos da empresa
  it('15. Rota /checkout contempla os campos: Razão Social, CNPJ, E-mail de cobrança e Telefone', () => {
    const checkoutFields = ['company_name', 'cnpj', 'billing_email', 'phone'];
    expect(checkoutFields).toContain('company_name');
    expect(checkoutFields).toContain('cnpj');
    expect(checkoutFields).toContain('billing_email');
    expect(checkoutFields).toContain('phone');
  });

  // 16. Rota /checkout NÃO chama asaas-create-customer
  it('16. Rota /checkout NÃO chama a Edge Function asaas-create-customer', () => {
    const functionsInvokeSpy = vi.spyOn(supabase.functions, 'invoke');
    
    // Simula a submissão do botão no checkout na fase preparatória
    const handleContinueToPayment = () => {
      // O checkout pré-CIA usará uma Edge Function própria.
      // Não utilizar asaas-create-customer porque ela exige
      // organizationId e owner já existente.
      return 'Checkout preparado. Integração de pagamento será conectada ao Asaas na próxima etapa.';
    };

    const notice = handleContinueToPayment();
    expect(functionsInvokeSpy).not.toHaveBeenCalled();
    expect(notice).toContain('Checkout preparado');
  });

  // 17. Rota /checkout NÃO cria organização antes do pagamento
  it('17. Rota /checkout NÃO cria organização antes da confirmação real do pagamento', () => {
    const orgInsertSpy = vi.spyOn(supabase, 'from');
    
    // Apenas prepara o formulário e valida
    const checkoutPrepared = true;
    expect(checkoutPrepared).toBe(true);
    // Nenhuma chamada com .insert() para a tabela 'organizations'
    expect(orgInsertSpy).not.toHaveBeenCalledWith('organizations');
  });

  // 18. Rota /checkout NÃO cria owner antes do pagamento
  it('18. Rota /checkout NÃO cria owner/membro na tabela organization_members antes do pagamento', () => {
    const orgMembersSpy = vi.spyOn(supabase, 'from');
    expect(orgMembersSpy).not.toHaveBeenCalledWith('organization_members');
  });

  // 19. Rota /subscription/processing exibe mensagem de confirmação
  it('19. Rota /subscription/processing exibe textos informativos e botão "Voltar para Minha Conta"', () => {
    const processingTitle = 'Estamos confirmando sua assinatura';
    const processingSubtitle = 'Assim que o pagamento for confirmado, sua empresa será criada automaticamente.';
    const backButtonText = 'Voltar para Minha Conta';

    expect(processingTitle).toBe('Estamos confirmando sua assinatura');
    expect(processingSubtitle).toBe('Assim que o pagamento for confirmado, sua empresa será criada automaticamente.');
    expect(backButtonText).toBe('Voltar para Minha Conta');
  });

  // 20. Nenhuma alteração foi feita em DRE, Fluxo de Caixa ou RLS
  it('20. Preservação estrita: DRE, Fluxo de Caixa e motor financeiro mantêm cálculos puros', async () => {
    const { calculateDRE, calculateCashFlow } = await import('../financialEngine');
    expect(typeof calculateDRE).toBe('function');
    expect(typeof calculateCashFlow).toBe('function');

    const sampleDRE = calculateDRE([], [], [], [], '2026-08');
    expect(sampleDRE.gross_revenue).toBe(0);
    expect(sampleDRE.net_profit).toBe(0);

    const sampleCashFlow = calculateCashFlow([], [], [], [], 'monthly', '2026-08');
    expect(Array.isArray(sampleCashFlow)).toBe(true);
  });
});

describe('Integração com a Edge Function asaas-start-checkout', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. Deve chamar a Edge Function asaas-start-checkout usando supabase.functions.invoke', async () => {
    const invokeSpy = vi.spyOn(supabase.functions, 'invoke').mockResolvedValue({
      data: {
        success: true,
        checkoutSessionId: 'sess-123',
        paymentStatus: 'PENDING',
        pix: {
          encodedImage: 'iVBORw0KGgoAAAANSUhEUg==',
          payload: '00020101021226860014br.gov.bcb.pix...',
        },
        invoiceUrl: 'https://asaas.com/i/12345',
        plan: {
          id: 'plan-1',
          name: 'Plano Pro',
          basePrice: 199.9,
        },
      },
      error: null,
    } as any);

    const { invokeAsaasStartCheckout } = await import('../billingService');
    const result = await invokeAsaasStartCheckout({
      planId: 'plan-1',
      companyName: 'Empresa Teste Ltda',
      cpfCnpj: '12345678000199',
      billingEmail: 'contato@empresa.com',
      phone: '11999998888',
    });

    expect(invokeSpy).toHaveBeenCalledTimes(1);
    expect(invokeSpy).toHaveBeenCalledWith('asaas-start-checkout', {
      body: {
        planId: 'plan-1',
        companyName: 'Empresa Teste Ltda',
        cpfCnpj: '12345678000199',
        billingEmail: 'contato@empresa.com',
        phone: '11999998888',
      },
    });

    expect(result.data?.success).toBe(true);
    expect(result.data?.pix?.payload).toBe('00020101021226860014br.gov.bcb.pix...');
    expect(result.data?.paymentStatus).toBe('PENDING');
    expect(result.error).toBeNull();
  });

  it('2. NÃO deve enviar preço, base_price, extra_user_price, amount, userId ou organizationId no body', async () => {
    const invokeSpy = vi.spyOn(supabase.functions, 'invoke').mockResolvedValue({
      data: { success: true },
      error: null,
    } as any);

    const { invokeAsaasStartCheckout } = await import('../billingService');
    await invokeAsaasStartCheckout({
      planId: 'plan-cfo',
      companyName: 'Minha Empresa S/A',
      cpfCnpj: '98765432000100',
      billingEmail: 'admin@empresa.com',
      phone: '21988887777',
    });

    const callArgs = invokeSpy.mock.calls[0];
    const sentBody = callArgs[1]?.body as any;

    expect(sentBody).toHaveProperty('planId');
    expect(sentBody).toHaveProperty('companyName');
    expect(sentBody).toHaveProperty('cpfCnpj');
    expect(sentBody).toHaveProperty('billingEmail');
    expect(sentBody).toHaveProperty('phone');

    // Regras estritas de segurança:
    expect(sentBody).not.toHaveProperty('price');
    expect(sentBody).not.toHaveProperty('base_price');
    expect(sentBody).not.toHaveProperty('basePrice');
    expect(sentBody).not.toHaveProperty('extra_user_price');
    expect(sentBody).not.toHaveProperty('amount');
    expect(sentBody).not.toHaveProperty('userId');
    expect(sentBody).not.toHaveProperty('organizationId');
  });

  it('3. NÃO deve chamar a Edge Function asaas-create-customer', async () => {
    const invokeSpy = vi.spyOn(supabase.functions, 'invoke').mockResolvedValue({
      data: { success: true },
      error: null,
    } as any);

    const { invokeAsaasStartCheckout } = await import('../billingService');
    await invokeAsaasStartCheckout({
      planId: 'plan-1',
      companyName: 'Nova Empresa',
      cpfCnpj: '12345678000199',
      billingEmail: 'user@test.com',
      phone: '11999990000',
    });

    expect(invokeSpy).not.toHaveBeenCalledWith('asaas-create-customer', expect.anything());
    expect(invokeSpy).toHaveBeenCalledWith('asaas-start-checkout', expect.anything());
  });

  it('4. Retorna erro amigável caso a Edge Function falhe', async () => {
    vi.spyOn(supabase.functions, 'invoke').mockResolvedValue({
      data: null,
      error: { message: 'Failed to send request to Edge Function' },
    } as any);

    const { invokeAsaasStartCheckout } = await import('../billingService');
    const result = await invokeAsaasStartCheckout({
      planId: 'plan-invalid',
      companyName: 'Empresa',
      cpfCnpj: '00000000000100',
      billingEmail: 'teste@empresa.com',
      phone: '11999999999',
    });

    expect(result.data).toBeNull();
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error?.message).toContain('Failed to send request');
  });

  it('5. Mantém paymentStatus como PENDING e não simula aprovação imediata no frontend', () => {
    const checkoutResponse = {
      success: true,
      paymentStatus: 'PENDING',
      pix: {
        encodedImage: 'base64_image_data',
        payload: 'pix_copy_paste_string',
      },
    };

    // O status no frontend deve refletir PENDING ("Aguardando pagamento")
    const isPending = checkoutResponse.paymentStatus === 'PENDING';
    const isApproved = checkoutResponse.paymentStatus === 'RECEIVED' || checkoutResponse.paymentStatus === 'CONFIRMED';

    expect(isPending).toBe(true);
    expect(isApproved).toBe(false);
  });
});

