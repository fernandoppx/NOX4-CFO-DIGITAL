import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Building2,
  CreditCard,
  CheckCircle2,
  ShieldCheck,
  AlertCircle,
  Users,
  UserPlus,
  RefreshCw,
  Lock,
  QrCode,
  Copy,
  ExternalLink,
  Clock,
} from 'lucide-react';
import { NoxLogo } from '../brand/NoxLogo';
import { Plan, User } from '../../types';
import { supabase } from '../../lib/supabase';
import { fetchPlanById, formatCurrencyBRL, AsaasStartCheckoutResponse } from '../../lib/billingService';
import { formatBillingErrorMessage } from '../../lib/billingErrorMessages';

// Conexão à Edge Function asaas-start-checkout
// Não utilizar asaas-create-customer porque ela exige
// organizationId e owner já existente.

interface CheckoutViewProps {
  currentUser?: User | null;
  selectedPlanId?: string;
  onNavigateToPlans: () => void;
  onNavigateToProcessing?: () => void;
  onNavigateToLogin?: () => void;
  onLogout?: () => void;
}

// Utilitários de máscara
const formatCNPJ = (value: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
};

const formatPhone = (value: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : '';
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
};

const formatDateBR = (dateStr?: string | null): string => {
  if (!dateStr) return '';
  const clean = String(dateStr).trim();
  const datePart = clean.includes('T') ? clean.split('T')[0] : clean;
  const parts = datePart.split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
  }
  try {
    const d = new Date(clean);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('pt-BR');
    }
  } catch {
    // fallback
  }
  return clean;
};

export const CheckoutView: React.FC<CheckoutViewProps> = ({
  currentUser,
  selectedPlanId: propPlanId,
  onNavigateToPlans,
  onNavigateToLogin,
  onLogout,
}) => {
  // Identifica o ID do plano (via prop ou sessionStorage temporário)
  const [effectivePlanId] = useState<string>(() => {
    if (propPlanId) return propPlanId;
    if (typeof window !== 'undefined' && window.sessionStorage) {
      return sessionStorage.getItem('nox4_selected_plan_id') || '';
    }
    return '';
  });

  const [plan, setPlan] = useState<Plan | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Forma de pagamento selecionada no checkout: 'BOLETO_PIX' ou 'CREDIT_CARD'
  const [paymentMethod, setPaymentMethod] = useState<'BOLETO_PIX' | 'CREDIT_CARD'>('BOLETO_PIX');

  // Formulário - Coluna Esquerda: "DADOS DA EMPRESA"
  const [companyName, setCompanyName] = useState<string>('');
  const [cnpjDisplay, setCnpjDisplay] = useState<string>('');
  const [billingEmail, setBillingEmail] = useState<string>(currentUser?.email || '');
  const [phoneDisplay, setPhoneDisplay] = useState<string>('');

  // Estados de submissão e resposta do checkout
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [checkoutErrorMessage, setCheckoutErrorMessage] = useState<string | null>(null);
  const [formValidationWarning, setFormValidationWarning] = useState<string | null>(null);
  const [checkoutResult, setCheckoutResult] = useState<AsaasStartCheckoutResponse | null>(null);
  const [isPixCopied, setIsPixCopied] = useState<boolean>(false);

  // Valores limpos para integração com a Edge Function
  const cleanCnpj = cnpjDisplay.replace(/\D/g, '');
  const cleanPhone = phoneDisplay.replace(/\D/g, '');

  // Busca o plano exclusivamente no Supabase para nunca confiar em preço do client
  const loadPlanFromDatabase = async (planId: string) => {
    if (!planId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const { data, error } = await fetchPlanById(planId);
      if (error) {
        setErrorMessage(formatBillingErrorMessage(error, 'load'));
        setPlan(null);
      } else if (!data) {
        setErrorMessage('O plano selecionado não foi encontrado ou não está mais ativo.');
        setPlan(null);
      } else {
        setPlan(data);
      }
    } catch (err: any) {
      setErrorMessage(formatBillingErrorMessage(err, 'load'));
      setPlan(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!effectivePlanId) {
      // Se não houver ID de plano selecionado, redireciona para a lista de planos
      onNavigateToPlans();
      return;
    }
    loadPlanFromDatabase(effectivePlanId);
  }, [effectivePlanId]);

  // Atualiza email caso o usuário logado mude
  useEffect(() => {
    if (currentUser?.email && !billingEmail) {
      setBillingEmail(currentUser.email);
    }
  }, [currentUser?.email]);

  /**
   * Tratamento amigável de erros da Edge Function
   * Não expõe stack trace, API Key ou dados sensíveis
   */
  const getFriendlyErrorMessage = (rawError: any, responseData?: any): string => {
    const candidate = responseData || rawError;
    return formatBillingErrorMessage(candidate, 'checkout');
  };

  /**
   * CONTINUAR PARA PAGAMENTO:
   * Conecta à Edge Function asaas-start-checkout
   * 
   * Não envia:
   * - preço
   * - base_price
   * - extra_user_price
   * - amount
   * - userId
   * - organizationId
   */
  const handleContinueToPayment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setFormValidationWarning(null);
    setCheckoutErrorMessage(null);

    if (!companyName.trim()) {
      setFormValidationWarning('Por favor, informe a Razão Social ou Nome da Empresa.');
      return;
    }

    if (!billingEmail.trim()) {
      setFormValidationWarning('Por favor, informe o e-mail de cobrança.');
      return;
    }

    if (isSubmitting) return;

    // 2. AUTENTICAÇÃO
    // A chamada deve usar a sessão Supabase atual do usuário.
    // Se o usuário não estiver autenticado, redirecionar para /login.
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session && !currentUser) {
      if (onNavigateToLogin) {
        onNavigateToLogin();
      } else if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      return;
    }

    // 3. ESTADO DE PROCESSAMENTO
    setIsSubmitting(true);

    try {
      const planId = plan?.id || effectivePlanId;
      const cpfCnpj = cleanCnpj || cnpjDisplay.trim();
      const phone = cleanPhone || phoneDisplay.trim();

      // 1. CHAMADA DA EDGE FUNCTION
      // O preço e ciclo são determinados exclusivamente pela Edge Function na tabela plans.
      const { data, error } = await supabase.functions.invoke(
        'asaas-start-checkout',
        {
          body: {
            planId,
            companyName: companyName.trim(),
            cpfCnpj,
            billingEmail: billingEmail.trim(),
            phone,
          },
        }
      );

      if (error) {
        setCheckoutErrorMessage(getFriendlyErrorMessage(error, data));
        return;
      }

      if (data && data.success === false) {
        setCheckoutErrorMessage(getFriendlyErrorMessage(null, data));
        return;
      }

      if (data && data.success === true) {
        // NÃO criar CIA
        // NÃO entrar no dashboard
        // NÃO marcar assinatura como paga
        setCheckoutResult(data as AsaasStartCheckoutResponse);
      } else {
        setCheckoutErrorMessage('Não foi possível iniciar o pagamento.');
      }
    } catch (err: any) {
      setCheckoutErrorMessage(getFriendlyErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Copia o payload do Pix Copia e Cola para a área de transferência
   */
  const handleCopyPix = async (pixPayload: string) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(pixPayload);
      } else if (typeof document !== 'undefined') {
        const textArea = document.createElement('textarea');
        textArea.value = pixPayload;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setIsPixCopied(true);
      setTimeout(() => {
        setIsPixCopied(false);
      }, 3000);
    } catch (err) {
      console.error('Falha ao copiar código PIX', err);
    }
  };

  // Identificação do ciclo do plano a partir do banco de dados
  const isYearly =
    plan?.billing_cycle === 'yearly' ||
    plan?.name?.toLowerCase().includes('anual') ||
    Boolean(plan?.annual_price && plan.annual_price > 0 && plan.billing_cycle !== 'monthly');

  // Valores reais do plano (carregados do banco, sem hardcoding)
  const basePrice = plan?.base_price ?? (isYearly ? 89.90 : 109.90);
  const annualPrice = plan?.annual_price ?? (isYearly ? 1078.80 : 0);
  const annualMonthlyEquivalent = annualPrice > 0 ? annualPrice / 12 : basePrice;

  // 8. VALOR:
  // Mostrar o valor usando: data.plan.basePrice formatado em BRL.
  // Não utilizar o valor previamente exibido pelo frontend para considerar a cobrança criada.
  const responsePlanPrice = checkoutResult?.plan?.basePrice ?? checkoutResult?.plan?.base_price;
  const pixFormattedPrice = typeof responsePlanPrice === 'number'
    ? formatCurrencyBRL(responsePlanPrice)
    : formatCurrencyBRL(isYearly ? (annualPrice || 1078.80) : (basePrice || 109.90));

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col justify-between relative overflow-x-hidden font-sans">
      {/* Background Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-slate-950 to-slate-950 pointer-events-none" />
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between border-b border-slate-800/80">
        <div className="flex items-center gap-4">
          <button
            id="btn-checkout-back-to-plans"
            type="button"
            onClick={onNavigateToPlans}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white hover:border-slate-700 transition-all cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Mudar plano</span>
          </button>
          <NoxLogo size="sm" layout="horizontal" theme="dark" showSubtitle={true} />
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400">
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span>Ambiente Seguro</span>
          </div>
          {onLogout && (
            <button
              id="btn-checkout-logout"
              type="button"
              onClick={onLogout}
              className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-rose-400 hover:border-rose-500/30 transition-all cursor-pointer"
            >
              Sair
            </button>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 flex-1 flex flex-col justify-center">
        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-3">
            <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            <p className="text-xs">Consultando plano selecionado...</p>
          </div>
        )}

        {/* Error State */}
        {!isLoading && (errorMessage || !plan) && (
          <div className="w-full max-w-md mx-auto bg-slate-900/90 border border-slate-800 rounded-2xl p-8 text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-rose-500/20 flex items-center justify-center text-rose-400 mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white">Plano indisponível</h3>
              <p className="text-xs text-slate-400">
                {errorMessage || 'O plano selecionado não foi encontrado.'}
              </p>
            </div>
            <button
              id="btn-return-to-plans"
              type="button"
              onClick={onNavigateToPlans}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white transition-all cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Ver todos os planos</span>
            </button>
          </div>
        )}

        {/* Loaded Checkout: Two Columns in Desktop, One in Mobile */}
        {!isLoading && plan && (
          <div className="space-y-6">
            {/* Title */}
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-heading">
                Finalizar Contratação
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                {checkoutResult?.success
                  ? 'Realize o pagamento via Pix para concluir a assinatura.'
                  : 'Informe os dados cadastrais da sua empresa para prosseguir com a assinatura.'}
              </p>
            </div>

            {/* Error Message from Edge Function */}
            {checkoutErrorMessage && (
              <div
                id="checkout-error-banner"
                className="p-4 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs flex items-start gap-3 shadow-lg"
              >
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-white">Atenção</p>
                  <p className="leading-relaxed">{checkoutErrorMessage}</p>
                </div>
              </div>
            )}

            {/* Validation Warning */}
            {formValidationWarning && (
              <div
                id="checkout-form-warning"
                className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs flex items-center gap-2.5"
              >
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>{formValidationWarning}</span>
              </div>
            )}

            {/* Two Column Layout */}
            <form onSubmit={handleContinueToPayment} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* COLUNA ESQUERDA: "DADOS DA EMPRESA" e "FORMA DE PAGAMENTO" (7 colunas em lg) */}
              <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800/90 rounded-2xl p-6 sm:p-7 shadow-xl space-y-5">
                <div className="flex items-center gap-2.5 pb-4 border-b border-slate-800">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white tracking-tight">
                      DADOS DA EMPRESA
                    </h2>
                    <p className="text-[11px] text-slate-400">
                      Informações fiscais e de contato da sua organização
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Razão Social / Nome da Empresa */}
                  <div>
                    <label htmlFor="company-name" className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Razão Social / Nome da Empresa <span className="text-rose-400">*</span>
                    </label>
                    <input
                      id="company-name"
                      type="text"
                      required
                      disabled={isSubmitting || !!checkoutResult?.success}
                      placeholder="Ex: Minha Empresa Tecnologia Ltda"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-inner"
                    />
                  </div>

                  {/* CNPJ */}
                  <div>
                    <label htmlFor="company-cnpj" className="block text-xs font-semibold text-slate-300 mb-1.5">
                      CNPJ
                    </label>
                    <input
                      id="company-cnpj"
                      type="text"
                      disabled={isSubmitting || !!checkoutResult?.success}
                      placeholder="00.000.000/0000-00"
                      maxLength={18}
                      value={cnpjDisplay}
                      onChange={(e) => setCnpjDisplay(formatCNPJ(e.target.value))}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-xs font-mono focus:outline-none focus:border-blue-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-inner"
                    />
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      Apenas números. Formatação automática.
                    </span>
                  </div>

                  {/* E-mail de cobrança */}
                  <div>
                    <label htmlFor="billing-email" className="block text-xs font-semibold text-slate-300 mb-1.5">
                      E-mail de cobrança <span className="text-rose-400">*</span>
                    </label>
                    <input
                      id="billing-email"
                      type="email"
                      required
                      disabled={isSubmitting || !!checkoutResult?.success}
                      placeholder="financeiro@empresa.com.br"
                      value={billingEmail}
                      onChange={(e) => setBillingEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-inner"
                    />
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      Iniciado com o seu e-mail de acesso. Você pode alterá-lo se preferir.
                    </span>
                  </div>

                  {/* Telefone */}
                  <div>
                    <label htmlFor="company-phone" className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Telefone
                    </label>
                    <input
                      id="company-phone"
                      type="text"
                      disabled={isSubmitting || !!checkoutResult?.success}
                      placeholder="(00) 00000-0000"
                      maxLength={15}
                      value={phoneDisplay}
                      onChange={(e) => setPhoneDisplay(formatPhone(e.target.value))}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-xs font-mono focus:outline-none focus:border-blue-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-inner"
                    />
                  </div>
                </div>

                {/* FORMA DE PAGAMENTO (Boleto / Pix vs Cartão de crédito) */}
                <div id="section-payment-method" className="pt-4 border-t border-slate-800 space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-white tracking-wider uppercase">
                      FORMA DE PAGAMENTO
                    </label>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Escolha como deseja realizar o pagamento
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Opção Boleto / Pix */}
                    <button
                      id="btn-payment-method-pix"
                      type="button"
                      disabled={isSubmitting || !!checkoutResult?.success}
                      onClick={() => setPaymentMethod('BOLETO_PIX')}
                      className={`flex items-center gap-3 p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                        paymentMethod === 'BOLETO_PIX'
                          ? 'bg-blue-950/40 border-blue-500/80 ring-1 ring-blue-500/50 shadow-md'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          paymentMethod === 'BOLETO_PIX' ? 'border-blue-500' : 'border-slate-600'
                        }`}
                      >
                        {paymentMethod === 'BOLETO_PIX' && (
                          <div className="w-2 h-2 rounded-full bg-blue-500" />
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <QrCode className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs font-bold text-white">Boleto / Pix</span>
                      </div>
                    </button>

                    {/* Opção Cartão de crédito */}
                    <button
                      id="btn-payment-method-credit-card"
                      type="button"
                      disabled={isSubmitting || !!checkoutResult?.success}
                      onClick={() => setPaymentMethod('CREDIT_CARD')}
                      className={`flex items-center gap-3 p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                        paymentMethod === 'CREDIT_CARD'
                          ? 'bg-blue-950/40 border-blue-500/80 ring-1 ring-blue-500/50 shadow-md'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          paymentMethod === 'CREDIT_CARD' ? 'border-blue-500' : 'border-slate-600'
                        }`}
                      >
                        {paymentMethod === 'CREDIT_CARD' && (
                          <div className="w-2 h-2 rounded-full bg-blue-500" />
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-blue-400" />
                        <span className="text-xs font-bold text-white">Cartão de crédito</span>
                      </div>
                    </button>
                  </div>
                </div>

                <div className="pt-2 text-[11px] text-slate-500 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Seus dados são protegidos com isolamento estrito de segurança.</span>
                </div>
              </div>

              {/* COLUNA DIREITA: 
                  Quando checkoutResult?.success === true: "PAGAMENTO VIA PIX"
                  Caso contrário: "RESUMO DA ASSINATURA" (5 colunas em lg) */}
              <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800/90 rounded-2xl p-6 sm:p-7 shadow-xl space-y-5">
                {checkoutResult?.success ? (
                  /* ETAPA: PAGAMENTO VIA PIX */
                  <div className="space-y-5">
                    <div className="flex items-center gap-2.5 pb-4 border-b border-slate-800">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                        <QrCode className="w-4 h-4" />
                      </div>
                      <div>
                        <h2 className="text-base font-bold text-white tracking-tight">
                          PAGAMENTO VIA PIX
                        </h2>
                        <p className="text-[11px] text-slate-400">
                          Cobrança gerada com sucesso
                        </p>
                      </div>
                    </div>

                    {/* Resumo do Plano, Cobrança de Hoje e Próxima Cobrança */}
                    {checkoutResult.firstPayment ? (
                      <div className="space-y-3">
                        {/* PAGAMENTO DE HOJE */}
                        <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs uppercase font-bold text-slate-400 tracking-wider">
                              PAGAMENTO DE HOJE
                            </span>
                            <span className="text-xs font-semibold text-emerald-400">
                              {checkoutResult.plan?.name || plan.name}
                            </span>
                          </div>
                          <div className="flex items-baseline justify-between pt-1">
                            <span className="text-2xl font-extrabold text-white">
                              {formatCurrencyBRL(checkoutResult.firstPayment.amount)}
                            </span>
                          </div>
                          {checkoutResult.firstPayment.periodEnd && (
                            <p className="text-xs text-slate-400 leading-relaxed pt-1.5 border-t border-slate-800/70">
                              Valor proporcional referente ao período até{' '}
                              <span className="font-semibold text-slate-200">
                                {formatDateBR(checkoutResult.firstPayment.periodEnd)}
                              </span>.
                            </p>
                          )}
                        </div>

                        {/* PRÓXIMA COBRANÇA */}
                        {checkoutResult.recurring && (
                          <div className="p-3.5 rounded-xl bg-slate-950/50 border border-slate-800/60 space-y-1 text-xs">
                            <span className="uppercase font-bold text-slate-400 tracking-wider block text-[11px]">
                              PRÓXIMA COBRANÇA
                            </span>
                            <div className="flex items-baseline justify-between">
                              <span className="text-base font-bold text-white">
                                {formatCurrencyBRL(checkoutResult.recurring.amount)}
                              </span>
                              {checkoutResult.recurring.nextDueDate && (
                                <span className="text-slate-300">
                                  em {formatDateBR(checkoutResult.recurring.nextDueDate)}
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-400 block">
                              {(checkoutResult.recurring.cycle === 'yearly' ||
                                checkoutResult.billingCycle === 'yearly' ||
                                isYearly)
                                ? 'Ciclo anual'
                                : 'Ciclo mensal'}
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Fallback para compatibilidade */
                      <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-400">Plano</span>
                          <span className="text-xs font-bold text-white">
                            {checkoutResult.plan?.name || plan.name}
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between pt-1 border-t border-slate-850">
                          <span className="text-xs text-slate-400">Valor</span>
                          <div className="flex items-baseline gap-1">
                            <span className="text-xl font-extrabold text-white">
                              {pixFormattedPrice}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {isYearly ? '/ ano' : '/ mês'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 9. STATUS: Aguardando pagamento enquanto PENDING */}
                    <div className="flex items-center justify-between p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs">
                      <span className="text-slate-300 font-semibold">Status:</span>
                      <span id="payment-status-badge" className="inline-flex items-center gap-1.5 font-bold text-amber-400">
                        <Clock className="w-3.5 h-3.5" />
                        Aguardando pagamento
                      </span>
                    </div>

                    {/* 6. QR CODE PIX */}
                    {checkoutResult.pix?.encodedImage && (
                      <div className="flex flex-col items-center justify-center p-5 bg-white rounded-2xl border border-slate-700 shadow-inner space-y-3">
                        <div className="text-center">
                          <h3 className="text-sm font-bold text-slate-900">Escaneie o QR Code</h3>
                          <p className="text-[11px] text-slate-600 mt-0.5">
                            Abra o aplicativo do seu banco e escaneie o código para realizar o pagamento.
                          </p>
                        </div>
                        <div className="p-2 bg-white rounded-xl shadow-md border border-slate-200">
                          <img
                            id="pix-qr-code-img"
                            src={`data:image/png;base64,${checkoutResult.pix.encodedImage}`}
                            alt="QR Code Pix"
                            className="w-48 h-48 object-contain"
                          />
                        </div>
                      </div>
                    )}

                    {/* 7. PIX COPIA E COLA */}
                    {checkoutResult.pix?.payload && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label htmlFor="pix-payload-input" className="text-xs font-semibold text-slate-300">
                            PIX COPIA E COLA
                          </label>
                          {isPixCopied && (
                            <span id="pix-copied-message" className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Código Pix copiado.
                            </span>
                          )}
                        </div>
                        <div className="relative">
                          <input
                            id="pix-payload-input"
                            type="text"
                            readOnly
                            value={checkoutResult.pix.payload}
                            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 text-xs font-mono select-all focus:outline-none focus:border-blue-500"
                          />
                        </div>
                        <button
                          id="btn-copy-pix"
                          type="button"
                          onClick={() => handleCopyPix(checkoutResult.pix!.payload!)}
                          className="w-full py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <Copy className="w-4 h-4 text-emerald-400" />
                          <span>{isPixCopied ? 'Código Pix copiado.' : 'COPIAR CÓDIGO PIX'}</span>
                        </button>
                      </div>
                    )}

                    {/* 12. SEM PIX AINDA */}
                    {(!checkoutResult.pix || (!checkoutResult.pix.encodedImage && !checkoutResult.pix.payload)) && (
                      <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-center space-y-3">
                        <div className="w-10 h-10 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center mx-auto">
                          <RefreshCw className={`w-5 h-5 ${isSubmitting ? 'animate-spin' : ''}`} />
                        </div>
                        <div>
                          <p id="pix-pending-message" className="text-xs font-semibold text-white">
                            Assinatura criada. Estamos gerando sua cobrança.
                          </p>
                          <p className="text-[11px] text-slate-400 mt-1">
                            Aguarde alguns instantes e atualize para visualizar o QR Code Pix.
                          </p>
                        </div>
                        <button
                          id="btn-refresh-pix"
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => handleContinueToPayment()}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-xs font-bold text-white transition-all cursor-pointer"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isSubmitting ? 'animate-spin' : ''}`} />
                          <span>ATUALIZAR</span>
                        </button>
                      </div>
                    )}

                    {/* 11. INVOICE URL */}
                    {checkoutResult.invoiceUrl && (
                      <button
                        id="btn-open-invoice"
                        type="button"
                        onClick={() => window.open(checkoutResult.invoiceUrl, '_blank', 'noopener,noreferrer')}
                        className="w-full py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-blue-400" />
                        <span>ABRIR COBRANÇA</span>
                      </button>
                    )}

                    {/* 10. AVISO IMPORTANTE */}
                    <div className="pt-2 text-center">
                      <p id="checkout-pix-notice" className="text-[11px] text-slate-400 leading-relaxed">
                        Após a confirmação do pagamento, sua empresa será criada automaticamente.
                      </p>
                    </div>

                    {/* Voltar / Re-editar */}
                    <div className="text-center pt-2 border-t border-slate-800">
                      <button
                        id="btn-edit-checkout-data"
                        type="button"
                        onClick={() => {
                          setCheckoutResult(null);
                          setCheckoutErrorMessage(null);
                        }}
                        className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
                      >
                        Editar dados da empresa
                      </button>
                    </div>
                  </div>
                ) : (
                  /* ETAPA INICIAL: RESUMO DA ASSINATURA */
                  <div className="space-y-6">
                    <div className="flex items-center gap-2.5 pb-4 border-b border-slate-800">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                        <CreditCard className="w-4 h-4" />
                      </div>
                      <div>
                        <h2 className="text-base font-bold text-white tracking-tight">
                          RESUMO DA ASSINATURA
                        </h2>
                        <p className="text-[11px] text-slate-400">
                          Valores consultados diretamente na base oficial
                        </p>
                      </div>
                    </div>

                    {/* Linhas de Detalhe */}
                    <div className="space-y-3.5 text-xs">
                      {/* Plano Escolhido */}
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Plano</span>
                        <span className="font-bold text-white text-sm">{plan.name}</span>
                      </div>

                      {/* Ciclo do Plano */}
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Ciclo</span>
                        <span className="font-bold text-white">
                          {isYearly ? 'Anual' : 'Mensal'}
                        </span>
                      </div>

                      {/* Preço de acordo com o plano */}
                      {!isYearly ? (
                        <>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Valor</span>
                            <span className="font-semibold text-slate-200">
                              {formatCurrencyBRL(plan.base_price ?? 109.90)}/mês
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Cobrança</span>
                            <span className="font-medium text-slate-300">Cobrança recorrente mensal.</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Vencimento</span>
                            <span className="font-medium text-slate-300">Vencimentos recorrentes no dia 10.</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Valor equivalente</span>
                            <span className="font-semibold text-slate-200">
                              {formatCurrencyBRL(plan.base_price ?? (plan.annual_price ? plan.annual_price / 12 : 89.90))}/mês equivalente
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Valor cobrado anualmente</span>
                            <span className="font-semibold text-slate-200">
                              {formatCurrencyBRL(plan.annual_price ?? 1078.80)} cobrado anualmente
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Renovação</span>
                            <span className="font-medium text-slate-300">Renovação anual em 10 de janeiro.</span>
                          </div>
                        </>
                      )}

                      {/* CIAs Incluídas */}
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-slate-400 flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-blue-400" />
                          Empresas (CIAs) incluídas
                        </span>
                        <span className="font-semibold text-white">
                          {plan.max_organizations} {plan.max_organizations === 1 ? 'CIA' : 'CIAs'}
                        </span>
                      </div>

                      {/* Usuários Incluídos */}
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-emerald-400" />
                          Usuários incluídos
                        </span>
                        <span className="font-semibold text-white">
                          {plan.included_users} {plan.included_users === 1 ? 'usuário' : 'usuários'}
                        </span>
                      </div>

                      {/* Preço por Usuário Adicional */}
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 flex items-center gap-1.5">
                          <UserPlus className="w-3.5 h-3.5 text-amber-400" />
                          Usuário adicional
                        </span>
                        <span className="font-semibold text-slate-200">
                          {formatCurrencyBRL(plan.extra_user_price)} / mês
                        </span>
                      </div>

                      <div className="pt-2">
                        <p className="text-[10px] text-slate-500 italic">
                          * Usuários adicionais só são cobrados caso você adicione membros acima do limite na área de Equipe.
                        </p>
                      </div>
                    </div>

                    {/* TOTAL INICIAL */}
                    <div className="pt-4 border-t border-slate-800 space-y-1">
                      <div className="flex items-baseline justify-between">
                        <span className="text-xs uppercase font-bold text-slate-400 tracking-wider">
                          Total Inicial
                        </span>
                        <div className="text-right">
                          {!isYearly ? (
                            <div className="flex items-baseline gap-1">
                              <span className="text-2xl font-extrabold text-white">
                                {formatCurrencyBRL(plan.base_price ?? 109.90)}
                              </span>
                              <span className="text-[11px] text-slate-400">/ mês</span>
                            </div>
                          ) : (
                            <div className="flex items-baseline gap-1">
                              <span className="text-2xl font-extrabold text-white">
                                {formatCurrencyBRL(plan.annual_price ?? 1078.80)}
                              </span>
                              <span className="text-[11px] text-slate-400">/ ano</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-500 text-right">
                        {!isYearly
                          ? 'Cobrança recorrente mensal'
                          : 'Cobrança recorrente anual'}
                      </p>
                    </div>

                    {/* 3. Botão CONTINUAR PARA PAGAMENTO */}
                    <div className="pt-2">
                      <button
                        id="btn-continue-to-payment"
                        type="submit"
                        disabled={isSubmitting || isLoading}
                        className="w-full py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99] text-white font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {isSubmitting ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Gerando sua cobrança...</span>
                          </>
                        ) : paymentMethod === 'BOLETO_PIX' ? (
                          <>
                            <QrCode className="w-4 h-4" />
                            <span>Continuar para Pagamento via Pix</span>
                          </>
                        ) : (
                          <>
                            <CreditCard className="w-4 h-4" />
                            <span>Continuar para Pagamento via Cartão</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Link de troca de plano */}
                    <div className="text-center pt-2">
                      <p className="text-xs text-slate-400">
                        Para trocar mensal por anual ou vice-versa,{' '}
                        <button
                          type="button"
                          onClick={onNavigateToPlans}
                          className="text-blue-400 hover:text-blue-300 underline font-medium cursor-pointer"
                        >
                          volte para os planos e escolha outro plano
                        </button>
                        .
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </form>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 text-center text-xs text-slate-500 border-t border-slate-800/80">
        NOX4 CFO • Segurança Financeira e Gestão Corporativa
      </footer>
    </div>
  );
};

