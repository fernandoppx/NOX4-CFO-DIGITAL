import { supabase } from './supabase';
import { Plan, Subscription, SubscriptionStatus } from '../types';

export interface BillingOverviewData {
  subscription: Subscription | null;
  plan: Plan | null;
  activeUsers: number;
  extraUsers: number;
  extraMonthlyCost: number;
}

/**
 * Busca a assinatura ativa da organização atual na tabela subscriptions.
 * Query: supabase.from('subscriptions').select('*').eq('organization_id', organizationId).maybeSingle()
 */
export async function fetchSubscriptionByOrganization(
  organizationId: string
): Promise<{ data: Subscription | null; error: Error | null }> {
  if (!organizationId) {
    return { data: null, error: null };
  }

  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: data as Subscription | null, error: null };
  } catch (err: any) {
    return { data: null, error: new Error(err.message || 'Erro ao carregar assinatura') };
  }
}

/**
 * Busca o plano na tabela plans através do plan_id da assinatura.
 * Query: supabase.from('plans').select('*').eq('id', planId).maybeSingle()
 */
export async function fetchPlanById(
  planId: string
): Promise<{ data: Plan | null; error: Error | null }> {
  if (!planId) {
    return { data: null, error: null };
  }

  try {
    const { data, error } = await supabase
      .from('plans')
      .select('*')
      .eq('id', planId)
      .maybeSingle();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: data as Plan | null, error: null };
  } catch (err: any) {
    return { data: null, error: new Error(err.message || 'Erro ao carregar plano') };
  }
}

/**
 * Conta os membros reais da organização ativa em organization_members.
 * Considera apenas membros da organization_id atual com roles 'owner', 'finance' ou 'viewer'.
 * Convites pendentes (organization_invitations) não são contados.
 * Query: supabase.from('organization_members').select('id, role', { count: 'exact' }).eq('organization_id', organizationId).in('role', ['owner', 'finance', 'viewer'])
 */
export async function countActiveOrganizationMembers(
  organizationId: string
): Promise<{ count: number; error: Error | null }> {
  if (!organizationId) {
    return { count: 0, error: null };
  }

  try {
    const { count, data, error } = await supabase
      .from('organization_members')
      .select('id, role', { count: 'exact' })
      .eq('organization_id', organizationId)
      .in('role', ['owner', 'finance', 'viewer']);

    if (error) {
      return { count: 0, error: new Error(error.message) };
    }

    // Caso o adapter retorne count direto ou lista de registros
    const membersList = (data as unknown as any[]) || [];
    const activeCount = typeof count === 'number' ? count : membersList.length;
    return { count: activeCount, error: null };
  } catch (err: any) {
    return { count: 0, error: new Error(err.message || 'Erro ao contar membros') };
  }
}

/**
 * Calcula quantidade de usuários adicionais que excedem os incluídos no plano.
 * extraUsers = Math.max(0, activeUsers - included_users)
 */
export function calculateExtraUsers(activeUsers: number, includedUsers: number): number {
  const safeActive = Math.max(0, Number(activeUsers) || 0);
  const safeIncluded = Math.max(0, Number(includedUsers) || 0);
  return Math.max(0, safeActive - safeIncluded);
}

/**
 * Calcula o custo adicional mensal baseado nos usuários excedentes.
 * extraMonthlyCost = extraUsers * extra_user_price
 */
export function calculateExtraMonthlyCost(extraUsers: number, extraUserPrice: number): number {
  const safeExtra = Math.max(0, Number(extraUsers) || 0);
  const safePrice = Math.max(0, Number(extraUserPrice) || 0);
  return Number((safeExtra * safePrice).toFixed(2));
}

/**
 * Formata um valor numérico em Real Brasileiro (BRL)
 */
export function formatCurrencyBRL(value: number): string {
  const safeVal = Number(value) || 0;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safeVal);
}

export interface StatusPresentation {
  label: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  dotColor: string;
  description: string;
}

/**
 * Interpretação estrita de status da assinatura:
 * trialing   → "Período de teste"
 * active     → "Ativo"
 * past_due   → "Pagamento pendente"
 * cancelled  → "Cancelado"
 * suspended  → "Suspenso"
 */
export function interpretSubscriptionStatus(status?: SubscriptionStatus | string | null): StatusPresentation {
  switch (status) {
    case 'trialing':
      return {
        label: 'Período de teste',
        badgeBg: 'bg-amber-500/10',
        badgeText: 'text-amber-400',
        badgeBorder: 'border-amber-500/20',
        dotColor: 'bg-amber-400',
        description: 'Assinatura em período de avaliação gratuita.',
      };
    case 'active':
      return {
        label: 'Ativo',
        badgeBg: 'bg-emerald-500/10',
        badgeText: 'text-emerald-400',
        badgeBorder: 'border-emerald-500/20',
        dotColor: 'bg-emerald-400',
        description: 'Assinatura regular e em pleno funcionamento.',
      };
    case 'past_due':
      return {
        label: 'Pagamento pendente',
        badgeBg: 'bg-orange-500/10',
        badgeText: 'text-orange-400',
        badgeBorder: 'border-orange-500/20',
        dotColor: 'bg-orange-400',
        description: 'Há uma cobrança pendente. Regularize para evitar suspensão.',
      };
    case 'cancelled':
      return {
        label: 'Cancelado',
        badgeBg: 'bg-slate-500/10',
        badgeText: 'text-slate-400',
        badgeBorder: 'border-slate-500/20',
        dotColor: 'bg-slate-400',
        description: 'Assinatura encerrada.',
      };
    case 'suspended':
      return {
        label: 'Suspenso',
        badgeBg: 'bg-rose-500/10',
        badgeText: 'text-rose-400',
        badgeBorder: 'border-rose-500/20',
        dotColor: 'bg-rose-400',
        description: 'Acesso suspenso por pendências financeiras.',
      };
    default:
      return {
        label: status || 'Desconhecido',
        badgeBg: 'bg-slate-800',
        badgeText: 'text-slate-300',
        badgeBorder: 'border-slate-700',
        dotColor: 'bg-slate-400',
        description: 'Status não identificado.',
      };
  }
}

/**
 * Busca exclusivamente no Supabase os planos ativos da tabela plans.
 * Campos: id, name, base_price, included_users, extra_user_price, max_organizations, active
 * Query: somente active = true, ordenar por base_price crescente.
 *
 * Não hardcodar preço.
 * Não hardcodar quantidade de usuários.
 * Não criar mocks.
 */
export async function fetchActivePlans(): Promise<{ data: Plan[] | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('plans')
      .select(`
        id,
        name,
        base_price,
        annual_price,
        billing_cycle,
        included_users,
        extra_user_price,
        max_organizations,
        active
      `)
      .eq('active', true)
      .order('base_price', { ascending: true });

    if (error) {
      console.error('Erro ao carregar planos:', error);

      return {
        data: null,
        error: new Error(error.message),
      };
    }

    return {
      data: (data as Plan[]) || [],
      error: null,
    };

  } catch (err: any) {
    console.error('Erro inesperado ao carregar planos:', err);

    return {
      data: null,
      error: new Error(err.message || 'Erro ao carregar planos'),
    };
  }
}

/**
 * Formata o preço base do plano para exibição.
 * Regra 5: Se base_price for 0 ou nulo, mostrar "Preço ainda não definido" em vez de "R$ 0,00 / mês".
 */
export function formatPlanPrice(price?: number | null): string {
  if (price === undefined || price === null || price === 0) {
    return 'Preço ainda não definido';
  }
  return `${formatCurrencyBRL(price)} / mês`;
}

// Conexão à Edge Function asaas-start-checkout
// Não utilizar asaas-create-customer porque ela exige
// organizationId e owner já existente.

export interface StartCheckoutInput {
  planId: string;
  companyName: string;
  cpfCnpj: string;
  billingEmail: string;
  phone: string;
}

export interface PixDetails {
  encodedImage?: string;
  payload?: string;
  expirationDate?: string;
}

export interface AsaasStartCheckoutResponse {
  success: boolean;
  checkoutSessionId?: string;
  paymentId?: string;
  subscriptionId?: string;
  paymentStatus?: string;
  invoiceUrl?: string;
  billingCycle?: 'monthly' | 'yearly';
  pix?: PixDetails | null;
  plan?: {
    id?: string;
    name?: string;
    basePrice?: number;
    base_price?: number;
    monthlyPrice?: number;
    annualPrice?: number;
    annualMonthlyEquivalent?: number;
    [key: string]: any;
  };
  firstPayment?: {
    amount: number;
    dueDate?: string;
    periodEnd?: string;
    [key: string]: any;
  };
  recurring?: {
    amount: number;
    nextDueDate?: string;
    cycle?: string;
    [key: string]: any;
  };
  error?: string;
  message?: string;
}

/**
 * Interfaces para consulta e gerenciamento de assinatura via asaas-manage-subscription
 */
export interface AsaasPaymentItem {
  id: string;
  status: string;
  value: number;
  netValue?: number;
  billingType: string;
  dueDate: string;
  paymentDate?: string | null;
  clientPaymentDate?: string | null;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  description?: string;
  [key: string]: any;
}

export interface AsaasSubscriptionData {
  id?: string;
  status?: string;
  billingType?: string;
  value?: number;
  cycle?: string;
  nextDueDate?: string;
  description?: string;
  dateCreated?: string;
  [key: string]: any;
}

export interface AsaasManageSubscriptionResponse {
  success?: boolean;
  plan?: {
    id?: string;
    name?: string;
    basePrice?: number;
    base_price?: number;
    includedUsers?: number;
    included_users?: number;
    extraUserPrice?: number;
    extra_user_price?: number;
    maxOrganizations?: number;
    max_organizations?: number;
    [key: string]: any;
  };
  asaasSubscription?: AsaasSubscriptionData | null;
  currentPayment?: AsaasPaymentItem | null;
  payments?: AsaasPaymentItem[];
  error?: string;
  message?: string;
}

export function formatAsaasBillingType(type?: string | null): string {
  if (!type) return 'Não informado';
  const upper = type.toUpperCase();
  switch (upper) {
    case 'PIX':
      return 'Pix';
    case 'BOLETO':
    case 'BOLETO_PIX':
      return 'Boleto / Pix';
    case 'CREDIT_CARD':
      return 'Cartão de crédito';
    case 'DEBIT_CARD':
      return 'Cartão de débito';
    case 'UNDEFINED':
      return 'A definir';
    default:
      return type;
  }
}

export function formatAsaasSubscriptionCycle(cycle?: string | null): string {
  if (!cycle) return 'Mensal';
  const upper = cycle.toUpperCase();
  switch (upper) {
    case 'MONTHLY':
      return 'Mensal';
    case 'WEEKLY':
      return 'Semanal';
    case 'BIWEEKLY':
      return 'Quinzenal';
    case 'QUARTERLY':
      return 'Trimestral';
    case 'SEMIANNUALLY':
      return 'Semestral';
    case 'ANNUALLY':
    case 'YEARLY':
      return 'Anual';
    default:
      return cycle;
  }
}

export interface AsaasPaymentStatusInfo {
  label: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
}

export function formatAsaasPaymentStatus(status?: string | null): AsaasPaymentStatusInfo {
  if (!status) {
    return {
      label: 'Desconhecido',
      badgeBg: 'bg-slate-800',
      badgeText: 'text-slate-400',
      badgeBorder: 'border-slate-700',
    };
  }
  const upper = status.toUpperCase();
  switch (upper) {
    case 'PENDING':
      return {
        label: 'Pendente',
        badgeBg: 'bg-amber-500/10',
        badgeText: 'text-amber-400',
        badgeBorder: 'border-amber-500/20',
      };
    case 'RECEIVED':
    case 'RECEIVED_IN_CASH':
      return {
        label: 'Recebida',
        badgeBg: 'bg-emerald-500/10',
        badgeText: 'text-emerald-400',
        badgeBorder: 'border-emerald-500/20',
      };
    case 'CONFIRMED':
      return {
        label: 'Confirmada',
        badgeBg: 'bg-emerald-500/10',
        badgeText: 'text-emerald-400',
        badgeBorder: 'border-emerald-500/20',
      };
    case 'OVERDUE':
      return {
        label: 'Vencida',
        badgeBg: 'bg-rose-500/10',
        badgeText: 'text-rose-400',
        badgeBorder: 'border-rose-500/20',
      };
    case 'REFUNDED':
      return {
        label: 'Reembolsada',
        badgeBg: 'bg-purple-500/10',
        badgeText: 'text-purple-400',
        badgeBorder: 'border-purple-500/20',
      };
    case 'REFUND_REQUESTED':
      return {
        label: 'Estorno Solicitado',
        badgeBg: 'bg-indigo-500/10',
        badgeText: 'text-indigo-400',
        badgeBorder: 'border-indigo-500/20',
      };
    case 'CHARGEBACK_REQUESTED':
      return {
        label: 'Chargeback Solicitado',
        badgeBg: 'bg-rose-500/10',
        badgeText: 'text-rose-400',
        badgeBorder: 'border-rose-500/20',
      };
    default:
      return {
        label: status,
        badgeBg: 'bg-slate-800',
        badgeText: 'text-slate-300',
        badgeBorder: 'border-slate-700',
      };
  }
}

export function formatAsaasSubscriptionStatus(status?: string | null): AsaasPaymentStatusInfo {
  if (!status) {
    return {
      label: 'Desconhecido',
      badgeBg: 'bg-slate-800',
      badgeText: 'text-slate-400',
      badgeBorder: 'border-slate-700',
    };
  }
  const upper = status.toUpperCase();
  switch (upper) {
    case 'ACTIVE':
      return {
        label: 'Ativa',
        badgeBg: 'bg-emerald-500/10',
        badgeText: 'text-emerald-400',
        badgeBorder: 'border-emerald-500/20',
      };
    case 'INACTIVE':
      return {
        label: 'Inativa',
        badgeBg: 'bg-slate-500/10',
        badgeText: 'text-slate-400',
        badgeBorder: 'border-slate-500/20',
      };
    case 'EXPIRED':
      return {
        label: 'Expirada',
        badgeBg: 'bg-rose-500/10',
        badgeText: 'text-rose-400',
        badgeBorder: 'border-rose-500/20',
      };
    default:
      return {
        label: status,
        badgeBg: 'bg-slate-800',
        badgeText: 'text-slate-300',
        badgeBorder: 'border-slate-700',
      };
  }
}

export function formatDateBR(dateStr?: string | null): string {
  if (!dateStr) return '-';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  }
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('pt-BR');
  } catch {
    return dateStr;
  }
}

/**
 * Consulta a assinatura e cobranças reais da organização via Edge Function asaas-manage-subscription.
 * 
 * Regra de segurança:
 * Nunca expõe ASAAS_API_KEY ou segredos no cliente.
 * A chamada usa a sessão ativa do usuário no Supabase.
 */
export async function invokeAsaasManageSubscription(
  organizationId: string
): Promise<{ data: AsaasManageSubscriptionResponse | null; error: Error | null }> {
  try {
    const { data, error } = await supabase.functions.invoke('asaas-manage-subscription', {
      body: {
        organizationId,
      },
    });

    if (error) {
      return { data: data as AsaasManageSubscriptionResponse | null, error: new Error(error.message) };
    }

    return { data: data as AsaasManageSubscriptionResponse | null, error: null };
  } catch (err: any) {
    return { data: null, error: new Error(err.message || 'Falha ao consultar assinatura') };
  }
}

/**
 * Dispara a Edge Function asaas-start-checkout para iniciar a contratação.
 * 
 * Regra estrita de segurança:
 * NUNCA envia preço, base_price, extra_user_price, amount, userId ou organizationId.
 * O preço é obtido exclusivamente pela Edge Function na tabela plans.
 */
export async function invokeAsaasStartCheckout(
  params: StartCheckoutInput
): Promise<{ data: AsaasStartCheckoutResponse | null; error: Error | null }> {
  try {
    const body: Record<string, any> = {
      planId: params.planId,
      companyName: params.companyName,
      cpfCnpj: params.cpfCnpj,
      billingEmail: params.billingEmail,
      phone: params.phone,
    };

    const { data, error } = await supabase.functions.invoke('asaas-start-checkout', {
      body,
    });

    if (error) {
      return { data: data as AsaasStartCheckoutResponse | null, error: new Error(error.message) };
    }

    return { data: data as AsaasStartCheckoutResponse | null, error: null };
  } catch (err: any) {
    return { data: null, error: new Error(err.message || 'Falha ao iniciar checkout') };
  }
}

export interface AsaasUpdatePaymentMethodResponse {
  success?: boolean;
  message?: string;
  error?: string;
  [key: string]: any;
}

/**
 * Atualiza a forma de pagamento da assinatura no Asaas via Edge Function asaas-update-payment-method.
 * 
 * Regra de segurança:
 * NUNCA envia preço, userId, subscriptionId, provider_subscription_id, API Key ou service_role.
 * Apenas organizationId e paymentMethod ('BOLETO').
 */
export async function invokeAsaasUpdatePaymentMethod(
  organizationId: string,
  paymentMethod: 'BOLETO' = 'BOLETO'
): Promise<{ data: AsaasUpdatePaymentMethodResponse | null; error: Error | null }> {
  try {
    const { data, error } = await supabase.functions.invoke('asaas-update-payment-method', {
      body: {
        organizationId,
        paymentMethod,
      },
    });

    if (error) {
      return {
        data: data as AsaasUpdatePaymentMethodResponse | null,
        error: new Error(error.message || 'Não foi possível alterar a forma de pagamento.'),
      };
    }

    if (data && data.success === false && (data.error || data.message)) {
      return {
        data: data as AsaasUpdatePaymentMethodResponse | null,
        error: new Error(data.error || data.message),
      };
    }

    return { data: data as AsaasUpdatePaymentMethodResponse | null, error: null };
  } catch (err: any) {
    return {
      data: null,
      error: new Error(err.message || 'Não foi possível alterar a forma de pagamento.'),
    };
  }
}

export interface AsaasUpdateCreditCardPayload {
  organizationId: string;
  creditCard: {
    holderName: string;
    number: string;
    expiryMonth: string;
    expiryYear: string;
    ccv: string;
  };
  creditCardHolderInfo: {
    name: string;
    email: string;
    cpfCnpj: string;
    postalCode: string;
    addressNumber: string;
    addressComplement?: string;
    phone: string;
    mobilePhone?: string;
  };
}

export interface AsaasUpdateCreditCardResponse {
  success?: boolean;
  message?: string;
  error?: string;
  [key: string]: any;
}

/**
 * Atualiza o cartão de crédito da assinatura no Asaas via Edge Function asaas-update-credit-card.
 * 
 * Regra de segurança:
 * NUNCA envia preço, userId, provider_subscription_id, provider_customer_id, API Key ou service_role.
 * Sanitiza número, CPF/CNPJ, CEP e telefones para conter apenas dígitos.
 */
export async function invokeAsaasUpdateCreditCard(
  payload: AsaasUpdateCreditCardPayload
): Promise<{ data: AsaasUpdateCreditCardResponse | null; error: Error | null }> {
  try {
    const { data, error } = await supabase.functions.invoke('asaas-update-credit-card', {
      body: {
        organizationId: payload.organizationId,
        creditCard: {
          holderName: payload.creditCard.holderName.trim(),
          number: payload.creditCard.number.replace(/\D/g, ''),
          expiryMonth: payload.creditCard.expiryMonth.replace(/\D/g, '').padStart(2, '0'),
          expiryYear: payload.creditCard.expiryYear.replace(/\D/g, ''),
          ccv: payload.creditCard.ccv.replace(/\D/g, ''),
        },
        creditCardHolderInfo: {
          name: payload.creditCardHolderInfo.name.trim(),
          email: payload.creditCardHolderInfo.email.trim(),
          cpfCnpj: payload.creditCardHolderInfo.cpfCnpj.replace(/\D/g, ''),
          postalCode: payload.creditCardHolderInfo.postalCode.replace(/\D/g, ''),
          addressNumber: payload.creditCardHolderInfo.addressNumber.trim(),
          addressComplement: payload.creditCardHolderInfo.addressComplement?.trim() || '',
          phone: payload.creditCardHolderInfo.phone.replace(/\D/g, ''),
          mobilePhone: payload.creditCardHolderInfo.mobilePhone?.replace(/\D/g, '') || '',
        },
      },
    });

    if (error) {
      return {
        data: data as AsaasUpdateCreditCardResponse | null,
        error: new Error(error.message || 'Não foi possível validar ou atualizar o cartão.'),
      };
    }

    if (data && data.success === false) {
      return {
        data: data as AsaasUpdateCreditCardResponse | null,
        error: new Error(data.error || data.message || 'Não foi possível validar ou atualizar o cartão.'),
      };
    }

    return { data: data as AsaasUpdateCreditCardResponse | null, error: null };
  } catch (err: any) {
    return {
      data: null,
      error: new Error(err.message || 'Não foi possível validar ou atualizar o cartão.'),
    };
  }
}



