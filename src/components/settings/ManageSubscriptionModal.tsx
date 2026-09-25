import React, { useEffect, useState } from 'react';
import {
  X,
  CreditCard,
  Building2,
  Users,
  Coins,
  Calendar,
  ExternalLink,
  FileText,
  AlertTriangle,
  RotateCw,
  Clock,
  Sparkles,
  ShieldCheck,
  Loader2,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import {
  AsaasManageSubscriptionResponse,
  AsaasPaymentItem,
  formatCurrencyBRL,
  formatAsaasBillingType,
  formatAsaasSubscriptionCycle,
  formatAsaasPaymentStatus,
  formatAsaasSubscriptionStatus,
  formatDateBR,
} from '../../lib/billingService';
import { formatBillingErrorMessage } from '../../lib/billingErrorMessages';

export interface ManageSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  isLoading: boolean;
  errorMessage: string | null;
  data: AsaasManageSubscriptionResponse | null;
  onRetry?: () => void;
  activeOrganizationId?: string;
  onRefreshData?: () => Promise<void> | void;
}

export const ManageSubscriptionModal: React.FC<ManageSubscriptionModalProps> = ({
  isOpen,
  onClose,
  isLoading,
  errorMessage,
  data,
  onRetry,
  activeOrganizationId,
  onRefreshData,
}) => {
  const [isConfirmationOpen, setIsConfirmationOpen] = useState<boolean>(false);
  const [selectedPaymentType, setSelectedPaymentType] = useState<'BOLETO' | 'CREDIT_CARD'>('BOLETO');
  const [isUpdatingPayment, setIsUpdatingPayment] = useState<boolean>(false);
  const [updatePaymentError, setUpdatePaymentError] = useState<string | null>(null);
  const [updatePaymentSuccess, setUpdatePaymentSuccess] = useState<string | null>(null);

  // Cancelamento de assinatura
  const [isCancelConfirmationOpen, setIsCancelConfirmationOpen] = useState<boolean>(false);
  const [isCancellingSubscription, setIsCancellingSubscription] = useState<boolean>(false);
  const [cancelSubscriptionError, setCancelSubscriptionError] = useState<string | null>(null);
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState<boolean>(false);
  const [cancellationRequestedAt, setCancellationRequestedAt] = useState<string | null>(null);
  const [cancellationEffectiveAt, setCancellationEffectiveAt] = useState<string | null>(null);

  // Estados temporários do Cartão de Crédito (NUNCA persistidos em storage, URL ou log)
  const [cardHolderName, setCardHolderName] = useState<string>('');
  const [cardNumber, setCardNumber] = useState<string>('');
  const [expiryMonth, setExpiryMonth] = useState<string>('');
  const [expiryYear, setExpiryYear] = useState<string>('');
  const [ccv, setCcv] = useState<string>('');

  // Estados temporários do Titular do Cartão
  const [holderFullName, setHolderFullName] = useState<string>('');
  const [holderCpfCnpj, setHolderCpfCnpj] = useState<string>('');
  const [holderEmail, setHolderEmail] = useState<string>('');
  const [postalCode, setPostalCode] = useState<string>('');
  const [addressNumber, setAddressNumber] = useState<string>('');
  const [addressComplement, setAddressComplement] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [mobilePhone, setMobilePhone] = useState<string>('');

  // Limpeza imediata de todos os campos sensíveis
  const clearSensitiveData = () => {
    setCardHolderName('');
    setCardNumber('');
    setExpiryMonth('');
    setExpiryYear('');
    setCcv('');
    setHolderFullName('');
    setHolderCpfCnpj('');
    setHolderEmail('');
    setPostalCode('');
    setAddressNumber('');
    setAddressComplement('');
    setPhone('');
    setMobilePhone('');
  };

  useEffect(() => {
    if (!isOpen || !activeOrganizationId) return;

    let cancelled = false;

    const loadCancellationState = async () => {
      const { data: subscriptionRow, error } = await supabase
        .from('subscriptions')
        .select(
          'cancel_at_period_end, cancellation_requested_at, cancellation_effective_at, status'
        )
        .eq('organization_id', activeOrganizationId)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        console.warn('Não foi possível carregar o estado de cancelamento:', error);
        return;
      }

      setCancelAtPeriodEnd(Boolean(subscriptionRow?.cancel_at_period_end));
      setCancellationRequestedAt(subscriptionRow?.cancellation_requested_at ?? null);
      setCancellationEffectiveAt(subscriptionRow?.cancellation_effective_at ?? null);
    };

    loadCancellationState();

    return () => {
      cancelled = true;
    };
  }, [isOpen, activeOrganizationId]);

  if (!isOpen) return null;

  const plan = data?.plan;
  const asaasSub = data?.asaasSubscription;
  const currentPayment = data?.currentPayment;

  const handleCloseModal = () => {
    if (isUpdatingPayment || isCancellingSubscription) return;
    clearSensitiveData();
    setIsConfirmationOpen(false);
    setIsCancelConfirmationOpen(false);
    setCancelSubscriptionError(null);
    onClose();
  };

  const handleOpenConfirmation = () => {
    clearSensitiveData();
    setSelectedPaymentType('BOLETO');
    setIsConfirmationOpen(true);
    setUpdatePaymentError(null);
    setUpdatePaymentSuccess(null);
  };

  const handleCloseConfirmation = () => {
    if (isUpdatingPayment) return;
    clearSensitiveData();
    setIsConfirmationOpen(false);
    setUpdatePaymentError(null);
    setUpdatePaymentSuccess(null);
  };

  const handleConfirmUpdatePaymentMethod = async () => {
    if (isUpdatingPayment) return;
    if (!activeOrganizationId) {
      setUpdatePaymentError('Identificador da organização não informado.');
      return;
    }

    setIsUpdatingPayment(true);
    setUpdatePaymentError(null);
    setUpdatePaymentSuccess(null);

    try {
      if (selectedPaymentType === 'BOLETO') {
        const { data: resData, error: resError } = await supabase.functions.invoke(
          'asaas-update-payment-method',
          {
            body: {
              organizationId: activeOrganizationId,
              paymentMethod: 'BOLETO',
            },
          }
        );

        if (resError) {
          setUpdatePaymentError(
            formatBillingErrorMessage(resError, 'update_payment_method')
          );
          return;
        }

        if (resData && resData.success === false) {
          setUpdatePaymentError(
            formatBillingErrorMessage(resData.error || resData.message, 'update_payment_method')
          );
          return;
        }

        if (resData && resData.success === true) {
          setUpdatePaymentSuccess('Forma de pagamento atualizada com sucesso.');

          setTimeout(async () => {
            clearSensitiveData();
            setIsConfirmationOpen(false);
            setUpdatePaymentSuccess(null);
            if (onRefreshData) {
              await onRefreshData();
            }
          }, 900);
        } else {
          setUpdatePaymentError(
            formatBillingErrorMessage(resData?.error || resData?.message, 'update_payment_method')
          );
        }
      } else {
        // Validação dos dados do cartão e do titular
        const trimmedHolder = cardHolderName.trim();
        if (trimmedHolder.length < 3) {
          setUpdatePaymentError('Informe o nome impresso no cartão.');
          setIsUpdatingPayment(false);
          return;
        }

        const rawCard = cardNumber.replace(/\D/g, '');
        if (rawCard.length < 13 || rawCard.length > 19) {
          setUpdatePaymentError('Informe um número de cartão de crédito válido.');
          setIsUpdatingPayment(false);
          return;
        }

        const rawMonth = expiryMonth.replace(/\D/g, '');
        const m = parseInt(rawMonth, 10);
        if (isNaN(m) || m < 1 || m > 12) {
          setUpdatePaymentError('Informe um mês de validade válido (01 a 12).');
          setIsUpdatingPayment(false);
          return;
        }

        const rawYear = expiryYear.replace(/\D/g, '');
        const y = parseInt(rawYear, 10);
        const currentYear = new Date().getFullYear();
        if (isNaN(y) || y < currentYear || y > currentYear + 30) {
          setUpdatePaymentError(`Informe um ano de validade válido com 4 dígitos (ex: ${currentYear}).`);
          setIsUpdatingPayment(false);
          return;
        }

        const rawCcv = ccv.replace(/\D/g, '');
        if (rawCcv.length < 3 || rawCcv.length > 4) {
          setUpdatePaymentError('Informe um código de segurança (CVV) válido com 3 ou 4 dígitos.');
          setIsUpdatingPayment(false);
          return;
        }

        const trimmedName = holderFullName.trim();
        if (trimmedName.length < 3) {
          setUpdatePaymentError('Informe o nome completo do titular.');
          setIsUpdatingPayment(false);
          return;
        }

        const rawDoc = holderCpfCnpj.replace(/\D/g, '');
        if (rawDoc.length !== 11 && rawDoc.length !== 14) {
          setUpdatePaymentError('Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido para o titular.');
          setIsUpdatingPayment(false);
          return;
        }

        const trimmedEmail = holderEmail.trim();
        if (!trimmedEmail || !trimmedEmail.includes('@') || !trimmedEmail.includes('.')) {
          setUpdatePaymentError('Informe um e-mail válido para o titular.');
          setIsUpdatingPayment(false);
          return;
        }

        const rawCep = postalCode.replace(/\D/g, '');
        if (rawCep.length !== 8) {
          setUpdatePaymentError('Informe um CEP válido com 8 dígitos.');
          setIsUpdatingPayment(false);
          return;
        }

        const trimmedNumber = addressNumber.trim();
        if (!trimmedNumber) {
          setUpdatePaymentError('Informe o número do endereço.');
          setIsUpdatingPayment(false);
          return;
        }

        const rawPhone = phone.replace(/\D/g, '');
        if (rawPhone.length < 10) {
          setUpdatePaymentError('Informe um telefone válido com DDD (mínimo 10 dígitos).');
          setIsUpdatingPayment(false);
          return;
        }

        const rawMobile = mobilePhone.replace(/\D/g, '');

        // Chamada segura para asaas-update-credit-card
        const { data: resData, error: resError } = await supabase.functions.invoke(
          'asaas-update-credit-card',
          {
            body: {
              organizationId: activeOrganizationId,
              creditCard: {
                holderName: trimmedHolder,
                number: rawCard,
                expiryMonth: String(m).padStart(2, '0'),
                expiryYear: String(y),
                ccv: rawCcv,
              },
              creditCardHolderInfo: {
                name: trimmedName,
                email: trimmedEmail,
                cpfCnpj: rawDoc,
                postalCode: rawCep,
                addressNumber: trimmedNumber,
                addressComplement: addressComplement.trim(),
                phone: rawPhone,
                mobilePhone: rawMobile,
              },
            },
          }
        );

        if (resError) {
          setUpdatePaymentError(
            formatBillingErrorMessage(resError, 'update_credit_card')
          );
          return;
        }

        if (resData && resData.success === false) {
          setUpdatePaymentError(
            formatBillingErrorMessage(resData.error || resData.message, 'update_credit_card')
          );
          return;
        }

        if (resData && resData.success === true) {
          setUpdatePaymentSuccess(
            'Forma de pagamento alterada para cartão de crédito com sucesso.'
          );

          // Limpeza imediata de memória e atualização
          setTimeout(async () => {
            clearSensitiveData();
            setIsConfirmationOpen(false);
            setUpdatePaymentSuccess(null);
            if (onRefreshData) {
              await onRefreshData();
            }
          }, 900);
        } else {
          setUpdatePaymentError(
            formatBillingErrorMessage(resData?.error || resData?.message, 'update_credit_card')
          );
        }
      }
    } catch (err: any) {
      if (selectedPaymentType === 'CREDIT_CARD') {
        setUpdatePaymentError(formatBillingErrorMessage(err, 'update_credit_card'));
      } else {
        setUpdatePaymentError(formatBillingErrorMessage(err, 'update_payment_method'));
      }
    } finally {
      setIsUpdatingPayment(false);
    }
  };


  const handleOpenCancelConfirmation = () => {
    if (!activeOrganizationId || cancelAtPeriodEnd || isCancellingSubscription) return;
    setCancelSubscriptionError(null);
    setIsCancelConfirmationOpen(true);
  };

  const handleCloseCancelConfirmation = () => {
    if (isCancellingSubscription) return;
    setCancelSubscriptionError(null);
    setIsCancelConfirmationOpen(false);
  };

  const handleConfirmCancelSubscription = async () => {
    if (isCancellingSubscription) return;

    if (!activeOrganizationId) {
      setCancelSubscriptionError('Identificador da organização não informado.');
      return;
    }

    setIsCancellingSubscription(true);
    setCancelSubscriptionError(null);

    try {
      const { data: resData, error: resError } = await supabase.functions.invoke(
        'asaas-cancel-subscription',
        {
          body: {
            organizationId: activeOrganizationId,
          },
        }
      );

      if (resError) {
        setCancelSubscriptionError(
          formatBillingErrorMessage(resError, 'cancel_subscription')
        );
        return;
      }

      if (!resData || resData.success !== true) {
        setCancelSubscriptionError(
          formatBillingErrorMessage(resData?.error || resData?.message, 'cancel_subscription')
        );
        return;
      }

      setCancelAtPeriodEnd(true);
      setCancellationRequestedAt(
        resData.cancellationRequestedAt ?? new Date().toISOString()
      );
      setCancellationEffectiveAt(
        resData.cancellationEffectiveAt ?? null
      );
      setIsCancelConfirmationOpen(false);

      // Não atualizamos imediatamente a consulta ao Asaas aqui.
      // A recorrência já foi encerrada no provedor; o NOX4 mantém o acesso
      // local ativo até cancellation_effective_at.
    } catch (err: any) {
      setCancelSubscriptionError(
        formatBillingErrorMessage(err, 'cancel_subscription')
      );
    } finally {
      setIsCancellingSubscription(false);
    }
  };

  // Ordena os pagamentos do histórico do mais recente para o mais antigo sem mutar o original
  const sortedPayments: AsaasPaymentItem[] = (data?.payments || []).slice().sort((a, b) => {
    const timeA = a.dueDate ? new Date(a.dueDate).getTime() : 0;
    const timeB = b.dueDate ? new Date(b.dueDate).getTime() : 0;
    return timeB - timeA;
  });

  const handleOpenExternal = (url?: string) => {
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const planBasePrice = plan?.basePrice ?? plan?.base_price ?? 0;
  const planExtraUserPrice = plan?.extraUserPrice ?? plan?.extra_user_price ?? 0;
  const planIncludedUsers = plan?.includedUsers ?? plan?.included_users ?? 0;
  const planMaxOrgs = plan?.maxOrganizations ?? plan?.max_organizations ?? 1;

  const subStatusInfo = formatAsaasSubscriptionStatus(asaasSub?.status);
  const currentStatusInfo = formatAsaasPaymentStatus(currentPayment?.status);

  return (
    <div
      id="modal-manage-subscription"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-sm overflow-y-auto"
    >
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] my-auto overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800/80 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white font-heading tracking-tight">
                  Gerenciar assinatura
                </h2>
                <span className="px-2 py-0.5 text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full font-medium flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  Owner
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Consulte os detalhes contratados, cobranças ativas e histórico financeiro oficial.
              </p>
            </div>
          </div>

          <button
            id="btn-close-manage-modal"
            type="button"
            onClick={handleCloseModal}
            aria-label="Fechar"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* ESTADO 1: LOADING */}
          {isLoading && (
            <div
              id="manage-loading-state"
              className="py-16 flex flex-col items-center justify-center space-y-3"
            >
              <div className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-medium text-slate-300">
                Consultando dados da assinatura...
              </p>
              <span className="text-xs text-slate-500">
                Aguarde enquanto recuperamos as cobranças atualizadas.
              </span>
            </div>
          )}

          {/* ESTADO 2: ERRO */}
          {!isLoading && errorMessage && (
            <div
              id="manage-error-state"
              className="py-12 flex flex-col items-center justify-center text-center space-y-4 max-w-md mx-auto"
            >
              <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">
                  Não foi possível carregar sua assinatura.
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {errorMessage}
                </p>
              </div>
              {onRetry && (
                <button
                  id="btn-retry-manage-subscription"
                  type="button"
                  onClick={onRetry}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors cursor-pointer"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Tentar novamente</span>
                </button>
              )}
            </div>
          )}

          {/* ESTADO 3: DADOS CARREGADOS */}
          {!isLoading && !errorMessage && data && (
            <div className="space-y-6">
              {cancelAtPeriodEnd && (
                <div
                  id="subscription-cancellation-scheduled"
                  className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200"
                >
                  <Clock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-amber-200">
                      Cancelamento agendado
                    </p>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      A renovação automática foi encerrada.
                      {cancellationEffectiveAt
                        ? ` Seu acesso ao NOX4 continuará ativo até ${formatDateBR(
                            cancellationEffectiveAt
                          )}.`
                        : ' Seu acesso continuará ativo até o fim do período já pago.'}
                    </p>
                    {cancellationRequestedAt && (
                      <p className="text-[11px] text-slate-500 mt-1">
                        Solicitação registrada em {formatDateBR(cancellationRequestedAt)}.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* SEÇÃO 1: DADOS DO PLANO */}
              <div
                id="manage-plan-section"
                className="bg-slate-900/80 border border-slate-800 rounded-xl p-5"
              >
                <div className="flex items-center gap-2 mb-4 text-xs font-bold uppercase tracking-wider text-slate-400 font-heading">
                  <Sparkles className="w-4 h-4 text-blue-400" />
                  <span>Plano Contratado</span>
                </div>

                {plan ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3.5">
                      <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                        Plano
                      </span>
                      <div id="manage-plan-name" className="text-base font-bold text-white mt-1">
                        {plan.name || 'Plano Personalizado'}
                      </div>
                    </div>

                    <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3.5">
                      <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                        Valor base
                      </span>
                      <div id="manage-plan-price" className="text-base font-bold text-blue-400 mt-1">
                        {formatCurrencyBRL(planBasePrice)}
                        <span className="text-xs font-normal text-slate-400 ml-1">/mês</span>
                      </div>
                    </div>

                    <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3.5">
                      <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold flex items-center gap-1">
                        <Users className="w-3 h-3 text-emerald-400" />
                        Usuários incluídos
                      </span>
                      <div id="manage-plan-users" className="text-base font-bold text-white mt-1">
                        {planIncludedUsers} licença{planIncludedUsers > 1 ? 's' : ''}
                      </div>
                    </div>

                    <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3.5">
                      <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold flex items-center gap-1">
                        <Coins className="w-3 h-3 text-cyan-400" />
                        Usuário adicional
                      </span>
                      <div id="manage-plan-extra-price" className="text-base font-bold text-white mt-1">
                        {formatCurrencyBRL(planExtraUserPrice)}
                        <span className="text-xs font-normal text-slate-400 ml-1">/membro</span>
                      </div>
                    </div>

                    <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3.5 sm:col-span-2 lg:col-span-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400 flex items-center gap-1.5 font-medium">
                          <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                          CIAs incluídas no contrato:
                        </span>
                        <span id="manage-plan-orgs" className="text-xs font-bold text-white">
                          {planMaxOrgs} empresa{planMaxOrgs > 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">Informações do plano base não disponíveis.</p>
                )}
              </div>

              {/* SEÇÃO 2: ASSINATURA E RECORRÊNCIA */}
              <div
                id="manage-asaas-section"
                className="bg-slate-900/80 border border-slate-800 rounded-xl p-5"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 font-heading">
                    <CreditCard className="w-4 h-4 text-emerald-400" />
                    <span>Assinatura e Recorrência</span>
                  </div>
                  {asaasSub?.status && (
                    <span
                      id="manage-asaas-status"
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${subStatusInfo.badgeBg} ${subStatusInfo.badgeText} ${subStatusInfo.badgeBorder}`}
                    >
                      {subStatusInfo.label}
                    </span>
                  )}
                </div>

                {asaasSub ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3.5">
                      <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                        Forma de pagamento
                      </span>
                      <div id="manage-asaas-billing-type" className="text-sm font-bold text-white mt-1">
                        {formatAsaasBillingType(asaasSub.billingType)}
                      </div>
                    </div>

                    <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3.5">
                      <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                        Valor da assinatura
                      </span>
                      <div id="manage-asaas-value" className="text-sm font-bold text-emerald-400 mt-1">
                        {formatCurrencyBRL(asaasSub.value ?? 0)}
                      </div>
                    </div>

                    <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3.5">
                      <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                        Ciclo
                      </span>
                      <div id="manage-asaas-cycle" className="text-sm font-bold text-white mt-1">
                        {formatAsaasSubscriptionCycle(asaasSub.cycle)}
                      </div>
                    </div>

                    <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3.5">
                      <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-blue-400" />
                        Próximo vencimento
                      </span>
                      <div id="manage-asaas-next-due-date" className="text-sm font-bold text-white mt-1">
                        {formatDateBR(asaasSub.nextDueDate)}
                      </div>
                    </div>

                    {asaasSub.description && (
                      <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3.5 sm:col-span-2 lg:col-span-4">
                        <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                          Descrição
                        </span>
                        <p className="text-xs text-slate-300 mt-1">
                          {asaasSub.description}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800/60 text-center text-xs text-slate-400">
                    Nenhuma assinatura ativa encontrada para esta organização.
                  </div>
                )}
              </div>

              {/* SEÇÃO 3: COBRANÇA ATUAL */}
              {currentPayment && (
                <div
                  id="manage-current-payment-section"
                  className="bg-slate-900/80 border border-slate-800 rounded-xl p-5"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 font-heading">
                      <Clock className="w-4 h-4 text-amber-400" />
                      <span>Cobrança Atual</span>
                    </div>
                    <span
                      id="manage-current-payment-status"
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${currentStatusInfo.badgeBg} ${currentStatusInfo.badgeText} ${currentStatusInfo.badgeBorder}`}
                    >
                      {currentStatusInfo.label}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3.5">
                      <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                        Valor
                      </span>
                      <div id="manage-current-payment-value" className="text-base font-bold text-white mt-1">
                        {formatCurrencyBRL(currentPayment.value ?? 0)}
                      </div>
                    </div>

                    <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3.5">
                      <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                        Vencimento
                      </span>
                      <div id="manage-current-payment-due-date" className="text-sm font-bold text-white mt-1">
                        {formatDateBR(currentPayment.dueDate)}
                      </div>
                    </div>

                    <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3.5">
                      <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                        Data de pagamento
                      </span>
                      <div id="manage-current-payment-pay-date" className="text-sm font-bold text-white mt-1">
                        {currentPayment.paymentDate || currentPayment.clientPaymentDate
                          ? formatDateBR(currentPayment.paymentDate || currentPayment.clientPaymentDate)
                          : 'Pendente'}
                      </div>
                    </div>

                    <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3.5">
                      <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                        Forma de pagamento
                      </span>
                      <div id="manage-current-payment-billing-type" className="text-sm font-bold text-white mt-1">
                        {formatAsaasBillingType(currentPayment.billingType)}
                      </div>
                    </div>
                  </div>

                  {/* Ações da cobrança atual (ABRIR COBRANÇA e/ou VER BOLETO) */}
                  {(currentPayment.invoiceUrl || currentPayment.bankSlipUrl) && (
                    <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t border-slate-800/80">
                      {currentPayment.invoiceUrl && (
                        <button
                          id="btn-open-current-invoice"
                          type="button"
                          onClick={() => handleOpenExternal(currentPayment.invoiceUrl)}
                          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-sm transition-colors cursor-pointer"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>ABRIR COBRANÇA</span>
                        </button>
                      )}

                      {currentPayment.bankSlipUrl && (
                        <button
                          id="btn-open-current-bankslip"
                          type="button"
                          onClick={() => handleOpenExternal(currentPayment.bankSlipUrl)}
                          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition-colors cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>VER BOLETO</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* SEÇÃO 4: HISTÓRICO DE COBRANÇAS */}
              <div
                id="manage-payments-history-section"
                className="bg-slate-900/80 border border-slate-800 rounded-xl p-5"
              >
                <div className="flex items-center gap-2 mb-4 text-xs font-bold uppercase tracking-wider text-slate-400 font-heading">
                  <FileText className="w-4 h-4 text-blue-400" />
                  <span>Histórico de Cobranças</span>
                </div>

                {sortedPayments.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table
                      id="manage-payments-history-table"
                      className="w-full text-left text-xs text-slate-300 border-collapse"
                    >
                      <thead>
                        <tr className="border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400 bg-slate-950/40">
                          <th className="py-2.5 px-3 font-semibold">Vencimento</th>
                          <th className="py-2.5 px-3 font-semibold">Valor</th>
                          <th className="py-2.5 px-3 font-semibold">Forma</th>
                          <th className="py-2.5 px-3 font-semibold">Status</th>
                          <th className="py-2.5 px-3 font-semibold">Pagamento</th>
                          <th className="py-2.5 px-3 font-semibold text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {sortedPayments.map((payment, idx) => {
                          const statusBadge = formatAsaasPaymentStatus(payment.status);
                          const payDate = payment.paymentDate || payment.clientPaymentDate;
                          return (
                            <tr
                              key={payment.id || idx}
                              className="hover:bg-slate-800/30 transition-colors"
                            >
                              <td className="py-2.5 px-3 font-medium text-white">
                                {formatDateBR(payment.dueDate)}
                              </td>
                              <td className="py-2.5 px-3 font-semibold text-white">
                                {formatCurrencyBRL(payment.value ?? 0)}
                              </td>
                              <td className="py-2.5 px-3 text-slate-300">
                                {formatAsaasBillingType(payment.billingType)}
                              </td>
                              <td className="py-2.5 px-3">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusBadge.badgeBg} ${statusBadge.badgeText} ${statusBadge.badgeBorder}`}
                                >
                                  {statusBadge.label}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-slate-400">
                                {payDate ? formatDateBR(payDate) : '-'}
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <div className="inline-flex items-center gap-2 justify-end">
                                  {payment.invoiceUrl && (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenExternal(payment.invoiceUrl)}
                                      title="Abrir Cobrança"
                                      className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-blue-300 text-[11px] font-medium border border-slate-700/60 transition-colors cursor-pointer"
                                    >
                                      <ExternalLink className="w-3 h-3" />
                                      <span>Cobrança</span>
                                    </button>
                                  )}
                                  {payment.bankSlipUrl && (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenExternal(payment.bankSlipUrl)}
                                      title="Ver Boleto"
                                      className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-medium border border-slate-700/60 transition-colors cursor-pointer"
                                    >
                                      <FileText className="w-3 h-3" />
                                      <span>Boleto</span>
                                    </button>
                                  )}
                                  {!payment.invoiceUrl && !payment.bankSlipUrl && (
                                    <span className="text-slate-500">-</span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800/60 text-center text-xs text-slate-400">
                    Nenhuma cobrança registrada até o momento.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Rodapé com botões */}
        <div className="px-6 py-4 border-t border-slate-800/80 bg-slate-900/90 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
            <button
              id="btn-change-payment-method"
              type="button"
              onClick={handleOpenConfirmation}
              className="px-3.5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-sm active:scale-[0.98] transition-all cursor-pointer"
            >
              ALTERAR FORMA DE PAGAMENTO
            </button>

            <button
              id="btn-cancel-subscription"
              type="button"
              disabled={
                isLoading ||
                !data ||
                !activeOrganizationId ||
                isCancellingSubscription ||
                cancelAtPeriodEnd
              }
              onClick={handleOpenCancelConfirmation}
              title={
                cancelAtPeriodEnd
                  ? 'Cancelamento já agendado.'
                  : 'Cancelar renovação automática ao fim do período pago.'
              }
              className={`px-3.5 py-2 text-xs font-semibold border rounded-lg transition-colors ${
                cancelAtPeriodEnd
                  ? 'bg-amber-500/10 text-amber-300 border-amber-500/30 cursor-default'
                  : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border-rose-500/30 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'
              }`}
            >
              {cancelAtPeriodEnd ? 'CANCELAMENTO AGENDADO' : 'CANCELAR ASSINATURA'}
            </button>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
            <span>
              {cancelAtPeriodEnd
                ? cancellationEffectiveAt
                  ? `Acesso ativo até ${formatDateBR(cancellationEffectiveAt)}.`
                  : 'Acesso ativo até o fim do período já pago.'
                : 'Cancelamento sem estorno automático; acesso mantido até o fim do período pago.'}
            </span>
            <button
              type="button"
              onClick={handleCloseModal}
              className="px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>

        {/* Modal de Confirmação de Cancelamento */}
        {isCancelConfirmationOpen && (
          <div
            id="cancel-subscription-confirmation-area"
            className="absolute inset-0 z-40 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6"
          >
            <div className="w-full max-w-lg bg-slate-900 border border-rose-500/30 rounded-xl p-5 sm:p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-start gap-3 pb-4 border-b border-slate-800">
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white font-heading">
                    Cancelar assinatura
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    A renovação automática será encerrada. O período já pago não será
                    estornado automaticamente.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800">
                  <div className="flex items-start gap-2.5">
                    <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Você continuará com acesso ao NOX4 até o fim do período já pago.
                      Depois dessa data, a assinatura será encerrada e não haverá nova
                      renovação automática.
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-lg bg-rose-950/20 border border-rose-900/40">
                  <p className="text-xs text-rose-200 leading-relaxed">
                    Esta ação encerra a renovação automática da assinatura. Para voltar a utilizar o
                    NOX4 após o término do período, será necessário reativar ou contratar um plano novamente.
                  </p>
                </div>
              </div>

              {cancelSubscriptionError && (
                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{cancelSubscriptionError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  id="btn-back-cancel-subscription"
                  type="button"
                  disabled={isCancellingSubscription}
                  onClick={handleCloseCancelConfirmation}
                  className="px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  VOLTAR
                </button>

                <button
                  id="btn-confirm-cancel-subscription"
                  type="button"
                  disabled={isCancellingSubscription}
                  onClick={handleConfirmCancelSubscription}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white rounded-lg shadow-md shadow-rose-600/20 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isCancellingSubscription ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Cancelando...</span>
                    </>
                  ) : (
                    <span>CONFIRMAR CANCELAMENTO</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Área / Modal de Confirmação de Alteração de Forma de Pagamento */}
        {isConfirmationOpen && (
          <div
            id="payment-method-confirmation-area"
            className="absolute inset-0 z-30 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6"
          >
            <div
              id="card-payment-confirmation"
              className="w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-xl p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-blue-400" />
                  <h3 className="text-sm font-bold text-white font-heading">
                    Alterar Forma de Pagamento
                  </h3>
                </div>
              </div>

              {/* Seleção da Forma de Pagamento */}
              <div className="space-y-2.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Forma de pagamento
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Opção 1: Boleto / Pix */}
                  <button
                    id="option-radio-boleto"
                    type="button"
                    onClick={() => {
                      setSelectedPaymentType('BOLETO');
                      setUpdatePaymentError(null);
                    }}
                    className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all cursor-pointer ${
                      selectedPaymentType === 'BOLETO'
                        ? 'bg-blue-950/40 border-blue-500/80 shadow-inner'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        selectedPaymentType === 'BOLETO' ? 'border-blue-500' : 'border-slate-600'
                      }`}
                    >
                      {selectedPaymentType === 'BOLETO' && (
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                      )}
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white block">Boleto / Pix</span>
                      <span className="text-[11px] text-slate-400 block">
                        QR Code e código de barras
                      </span>
                    </div>
                  </button>

                  {/* Opção 2: Cartão de crédito */}
                  <button
                    id="option-radio-credit-card"
                    type="button"
                    onClick={() => {
                      setSelectedPaymentType('CREDIT_CARD');
                      setUpdatePaymentError(null);
                    }}
                    className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all cursor-pointer ${
                      selectedPaymentType === 'CREDIT_CARD'
                        ? 'bg-blue-950/40 border-blue-500/80 shadow-inner'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        selectedPaymentType === 'CREDIT_CARD' ? 'border-blue-500' : 'border-slate-600'
                      }`}
                    >
                      {selectedPaymentType === 'CREDIT_CARD' && (
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                      )}
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white block">Cartão de crédito</span>
                      <span className="text-[11px] text-slate-400 block">
                        Cobrança mensal no cartão
                      </span>
                    </div>
                  </button>
                </div>

                {/* Auxiliar quando Boleto / Pix estiver selecionado */}
                {selectedPaymentType === 'BOLETO' && (
                  <p className="text-xs text-slate-400 leading-relaxed pt-1">
                    O boleto também poderá ser pago via Pix quando a cobrança disponibilizar QR Code.
                  </p>
                )}
              </div>

              {/* Formulário de Cartão de Crédito */}
              {selectedPaymentType === 'CREDIT_CARD' && (
                <div id="credit-card-form" className="space-y-4 pt-1">
                  {/* DADOS DO CARTÃO */}
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
                      <CreditCard className="w-3.5 h-3.5 text-blue-400" />
                      <span>Dados do Cartão</span>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">
                        Nome impresso no cartão *
                      </label>
                      <input
                        id="input-card-holder-name"
                        type="text"
                        value={cardHolderName}
                        onChange={(e) => setCardHolderName(e.target.value.toUpperCase())}
                        placeholder="Ex: JOAO M SILVA"
                        autoComplete="cc-name"
                        className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700/80 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 uppercase font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">
                        Número do cartão *
                      </label>
                      <input
                        id="input-card-number"
                        type="text"
                        inputMode="numeric"
                        autoComplete="cc-number"
                        value={cardNumber}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/\D/g, '').slice(0, 19);
                          const formatted = raw.replace(/(\d{4})(?=\d)/g, '$1 ');
                          setCardNumber(formatted);
                        }}
                        placeholder="0000 0000 0000 0000"
                        className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700/80 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 font-mono tracking-wider"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-400 mb-1">
                          Validade MM *
                        </label>
                        <input
                          id="input-card-expiry-month"
                          type="text"
                          inputMode="numeric"
                          autoComplete="cc-exp"
                          maxLength={2}
                          value={expiryMonth}
                          onChange={(e) =>
                            setExpiryMonth(e.target.value.replace(/\D/g, '').slice(0, 2))
                          }
                          placeholder="MM"
                          className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700/80 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 text-center font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-slate-400 mb-1">
                          Validade AAAA *
                        </label>
                        <input
                          id="input-card-expiry-year"
                          type="text"
                          inputMode="numeric"
                          autoComplete="cc-exp"
                          maxLength={4}
                          value={expiryYear}
                          onChange={(e) =>
                            setExpiryYear(e.target.value.replace(/\D/g, '').slice(0, 4))
                          }
                          placeholder="AAAA"
                          className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700/80 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 text-center font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-slate-400 mb-1">
                          CVV *
                        </label>
                        <input
                          id="input-card-ccv"
                          type="password"
                          inputMode="numeric"
                          autoComplete="cc-csc"
                          maxLength={4}
                          value={ccv}
                          onChange={(e) =>
                            setCcv(e.target.value.replace(/\D/g, '').slice(0, 4))
                          }
                          placeholder="•••"
                          className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700/80 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 text-center font-mono tracking-widest"
                        />
                      </div>
                    </div>
                  </div>

                  {/* DADOS DO TITULAR */}
                  <div className="space-y-2.5 pt-2 border-t border-slate-800">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
                      <Users className="w-3.5 h-3.5 text-blue-400" />
                      <span>Dados do Titular</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-400 mb-1">
                          Nome completo *
                        </label>
                        <input
                          id="input-holder-full-name"
                          type="text"
                          value={holderFullName}
                          onChange={(e) => setHolderFullName(e.target.value)}
                          placeholder="Nome completo do titular"
                          className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700/80 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-slate-400 mb-1">
                          CPF/CNPJ *
                        </label>
                        <input
                          id="input-holder-cpf-cnpj"
                          type="text"
                          inputMode="numeric"
                          value={holderCpfCnpj}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/\D/g, '').slice(0, 14);
                            if (raw.length <= 11) {
                              setHolderCpfCnpj(
                                raw.replace(
                                  /(\d{3})(\d{3})?(\d{3})?(\d{2})?/,
                                  (_, a, b, c, d) =>
                                    [a, b, c].filter(Boolean).join('.') + (d ? `-${d}` : '')
                                )
                              );
                            } else {
                              setHolderCpfCnpj(
                                raw.replace(
                                  /(\d{2})(\d{3})?(\d{3})?(\d{4})?(\d{2})?/,
                                  (_, a, b, c, d, e) =>
                                    [a, b, c].filter(Boolean).join('.') +
                                    (d ? `/${d}` : '') +
                                    (e ? `-${e}` : '')
                                )
                              );
                            }
                          }}
                          placeholder="000.000.000-00"
                          className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700/80 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-400 mb-1">
                          E-mail *
                        </label>
                        <input
                          id="input-holder-email"
                          type="email"
                          value={holderEmail}
                          onChange={(e) => setHolderEmail(e.target.value)}
                          placeholder="email@empresa.com.br"
                          className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700/80 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-slate-400 mb-1">
                          CEP *
                        </label>
                        <input
                          id="input-holder-cep"
                          type="text"
                          inputMode="numeric"
                          value={postalCode}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/\D/g, '').slice(0, 8);
                            setPostalCode(raw.length > 5 ? `${raw.slice(0, 5)}-${raw.slice(5)}` : raw);
                          }}
                          placeholder="00000-000"
                          className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700/80 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-400 mb-1">
                          Número *
                        </label>
                        <input
                          id="input-holder-address-number"
                          type="text"
                          value={addressNumber}
                          onChange={(e) => setAddressNumber(e.target.value)}
                          placeholder="123"
                          className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700/80 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-slate-400 mb-1">
                          Complemento (opcional)
                        </label>
                        <input
                          id="input-holder-address-complement"
                          type="text"
                          value={addressComplement}
                          onChange={(e) => setAddressComplement(e.target.value)}
                          placeholder="Sala 402, Bloco B"
                          className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700/80 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-400 mb-1">
                          Telefone *
                        </label>
                        <input
                          id="input-holder-phone"
                          type="tel"
                          inputMode="numeric"
                          value={phone}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/\D/g, '').slice(0, 11);
                            if (raw.length <= 10) {
                              setPhone(
                                raw.replace(
                                  /(\d{2})(\d{4})?(\d{4})?/,
                                  (_, a, b, c) =>
                                    a ? `(${a}` + (b ? `) ${b}` : '') + (c ? `-${c}` : '') : ''
                                )
                              );
                            } else {
                              setPhone(
                                raw.replace(
                                  /(\d{2})(\d{5})?(\d{4})?/,
                                  (_, a, b, c) =>
                                    a ? `(${a}` + (b ? `) ${b}` : '') + (c ? `-${c}` : '') : ''
                                )
                              );
                            }
                          }}
                          placeholder="(11) 3333-4444"
                          className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700/80 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-slate-400 mb-1">
                          Celular (opcional)
                        </label>
                        <input
                          id="input-holder-mobile-phone"
                          type="tel"
                          inputMode="numeric"
                          value={mobilePhone}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/\D/g, '').slice(0, 11);
                            setMobilePhone(
                              raw.replace(
                                /(\d{2})(\d{5})?(\d{4})?/,
                                (_, a, b, c) =>
                                  a ? `(${a}` + (b ? `) ${b}` : '') + (c ? `-${c}` : '') : ''
                              )
                            );
                          }}
                          placeholder="(11) 98888-7777"
                          className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700/80 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 font-mono"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Mensagem de Erro quando houver */}
              {updatePaymentError && (
                <div
                  id="update-payment-error"
                  className="flex items-start gap-2.5 p-3 rounded-lg bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300"
                >
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{updatePaymentError}</span>
                </div>
              )}

              {/* Mensagem de Sucesso quando houver */}
              {updatePaymentSuccess && (
                <div
                  id="update-payment-success"
                  className="flex items-start gap-2.5 p-3 rounded-lg bg-emerald-950/40 border border-emerald-800/60 text-xs text-emerald-300"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{updatePaymentSuccess}</span>
                </div>
              )}

              {/* Botões [ VOLTAR ] e [ CONFIRMAR ALTERAÇÃO ] */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  id="btn-back-payment-confirmation"
                  type="button"
                  disabled={isUpdatingPayment}
                  onClick={handleCloseConfirmation}
                  className="px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  VOLTAR
                </button>

                <button
                  id="btn-confirm-payment-update"
                  type="button"
                  disabled={isUpdatingPayment}
                  onClick={handleConfirmUpdatePaymentMethod}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-md shadow-blue-600/20 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isUpdatingPayment ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>
                        {selectedPaymentType === 'CREDIT_CARD'
                          ? 'Validando cartão...'
                          : 'Atualizando forma de pagamento...'}
                      </span>
                    </>
                  ) : (
                    <span>CONFIRMAR ALTERAÇÃO</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
