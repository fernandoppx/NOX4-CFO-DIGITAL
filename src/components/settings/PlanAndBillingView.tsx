import React, { useEffect, useState, useCallback } from 'react';
import {
  CreditCard,
  Building2,
  Users,
  UserCheck,
  UserPlus,
  Coins,
  Receipt,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  RotateCw,
  Clock,
  CheckCircle2,
} from 'lucide-react';

import {
  fetchSubscriptionByOrganization,
  fetchPlanById,
  countActiveOrganizationMembers,
  calculateExtraUsers,
  calculateExtraMonthlyCost,
  formatCurrencyBRL,
  interpretSubscriptionStatus,
  AsaasManageSubscriptionResponse,
} from '../../lib/billingService';
import { formatBillingErrorMessage } from '../../lib/billingErrorMessages';
import { supabase } from '../../lib/supabase';
import { Plan, Subscription } from '../../types';
import { ManageSubscriptionModal } from './ManageSubscriptionModal';

interface PlanAndBillingViewProps {
  activeOrganizationId?: string;
  currentUserRole?:
    | 'owner'
    | 'finance'
    | 'viewer'
    | 'system_admin'
    | string;
  isPreviewMode?: boolean;
  previewData?: {
    subscription: Subscription;
    plan: Plan;
    activeUsersCount: number;
  };
}

export const PlanAndBillingView: React.FC<
  PlanAndBillingViewProps
> = ({
  activeOrganizationId,
  currentUserRole = 'owner',
  isPreviewMode = false,
  previewData,
}) => {
  const [isLoading, setIsLoading] =
    useState<boolean>(true);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const [subscription, setSubscription] =
    useState<Subscription | null>(null);

  const [plan, setPlan] =
    useState<Plan | null>(null);

  const [activeUsersCount, setActiveUsersCount] =
    useState<number>(0);

  // Estados do Modal Gerenciar Assinatura
  const [isManageModalOpen, setIsManageModalOpen] = useState<boolean>(false);
  const [isLoadingManageData, setIsLoadingManageData] = useState<boolean>(false);
  const [manageErrorMessage, setManageErrorMessage] = useState<string | null>(null);
  const [manageSubscriptionData, setManageSubscriptionData] = useState<AsaasManageSubscriptionResponse | null>(null);

  // Somente owner acessa informações de plano e cobrança.
  const isOwner = currentUserRole === 'owner';

  const handleOpenManageSubscription = async () => {
    setIsManageModalOpen(true);
    setIsLoadingManageData(true);
    setManageErrorMessage(null);

    try {
      const { data, error } = await supabase.functions.invoke(
        'asaas-manage-subscription',
        {
          body: {
            organizationId: activeOrganizationId,
          },
        }
      );

      if (error) {
        setManageErrorMessage(formatBillingErrorMessage(error, 'sync'));
        return;
      }

      if (data && data.success === false) {
        setManageErrorMessage(formatBillingErrorMessage(data.message || data.error, 'sync'));
        return;
      }

      setManageSubscriptionData(data as AsaasManageSubscriptionResponse);
    } catch (err: any) {
      setManageErrorMessage(formatBillingErrorMessage(err, 'sync'));
    } finally {
      setIsLoadingManageData(false);
    }
  };

  const loadBillingData = useCallback(async () => {
    // Preview isolado: utiliza apenas fixtures.
    if (isPreviewMode && previewData) {
      setSubscription(previewData.subscription);
      setPlan(previewData.plan);
      setActiveUsersCount(
        previewData.activeUsersCount,
      );
      setIsLoading(false);
      return;
    }

    if (!activeOrganizationId) {
      setIsLoading(false);
      return;
    }

    // Finance/viewer não consultam dados de cobrança.
    if (!isOwner) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      // 1. Assinatura da CIA ativa.
      const subResult =
        await fetchSubscriptionByOrganization(
          activeOrganizationId,
        );

      if (subResult.error) {
        throw subResult.error;
      }

      setSubscription(subResult.data);

      // CIA sem assinatura.
      if (!subResult.data) {
        setPlan(null);
        setActiveUsersCount(0);
        setIsLoading(false);
        return;
      }

      // 2. Plano associado à assinatura.
      const planResult = await fetchPlanById(
        subResult.data.plan_id,
      );

      if (planResult.error) {
        throw planResult.error;
      }

      setPlan(planResult.data);

      // 3. Usuários ativos da CIA.
      const membersResult =
        await countActiveOrganizationMembers(
          activeOrganizationId,
        );

      if (membersResult.error) {
        throw membersResult.error;
      }

      setActiveUsersCount(
        membersResult.count,
      );
    } catch (err: any) {
      console.error(
        '[PlanAndBillingView] Erro ao carregar dados:',
        err,
      );

      setErrorMessage(
        formatBillingErrorMessage(err, 'load')
      );
    } finally {
      setIsLoading(false);
    }
  }, [
    activeOrganizationId,
    isOwner,
    isPreviewMode,
    previewData,
  ]);

  // Recarrega ao trocar de CIA.
  useEffect(() => {
    void loadBillingData();
  }, [loadBillingData]);

  // =========================================================
  // ACESSO RESTRITO
  // =========================================================

  if (!isOwner) {
    return (
      <div
        id="billing-access-denied"
        className="min-h-[500px] flex items-center justify-center p-6"
      >
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-xl p-8 text-center shadow-xl">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
            <ShieldAlert className="w-7 h-7" />
          </div>

          <h2 className="text-lg font-bold text-white mb-2 font-heading tracking-tight">
            Acesso Restrito ao Proprietário
          </h2>

          <p className="text-sm text-slate-400 mb-6 leading-relaxed">
            A tela de{' '}
            <strong className="text-slate-200">
              Plano e Cobrança
            </strong>{' '}
            é restrita exclusivamente ao
            proprietário da empresa.
          </p>

          <div className="text-xs text-slate-500 border-t border-slate-800/80 pt-4">
            Contate o proprietário da conta para
            solicitar alterações no plano da empresa.
          </div>
        </div>
      </div>
    );
  }

  // =========================================================
  // LOADING
  // =========================================================

  if (isLoading) {
    return (
      <div
        id="billing-loading-state"
        className="min-h-[400px] flex flex-col items-center justify-center p-8 space-y-4"
      >
        <div className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />

        <p className="text-sm text-slate-400 font-medium">
          Carregando dados de plano e assinatura...
        </p>
      </div>
    );
  }

  // =========================================================
  // ERRO
  // =========================================================

  if (errorMessage) {
    return (
      <div
        id="billing-error-state"
        className="p-6 max-w-2xl mx-auto my-8 bg-slate-900 border border-rose-900/40 rounded-xl text-center space-y-4 shadow-lg"
      >
        <div className="w-12 h-12 mx-auto rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
          <AlertTriangle className="w-6 h-6" />
        </div>

        <h3 className="text-base font-bold text-white">
          Falha ao carregar informações de faturamento
        </h3>

        <p className="text-xs text-slate-400 max-w-md mx-auto">
          {errorMessage}
        </p>

        <button
          id="btn-billing-retry"
          type="button"
          onClick={() => void loadBillingData()}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors cursor-pointer"
        >
          <RotateCw className="w-3.5 h-3.5" />
          <span>Tentar novamente</span>
        </button>
      </div>
    );
  }

  // =========================================================
  // EMPRESA SEM ASSINATURA
  // =========================================================

  if (!subscription) {
    return (
      <div className="space-y-6 pb-12">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 font-heading">
                Configurações & Gestão
              </span>

              <h1 className="text-xl font-bold text-white mt-1 font-heading tracking-tight">
                Plano e Cobrança
              </h1>

              <p className="text-xs text-slate-400 mt-1">
                Gerencie seu plano e acompanhe o uso
                da sua empresa.
              </p>
            </div>
          </div>
        </div>

        <div
          id="billing-empty-subscription"
          className="bg-slate-900/60 border border-slate-800 rounded-xl p-12 text-center max-w-xl mx-auto space-y-4"
        >
          <div className="w-14 h-14 mx-auto rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400">
            <CreditCard className="w-7 h-7" />
          </div>

          <h2 className="text-base font-bold text-white">
            Esta empresa ainda não possui uma
            assinatura configurada.
          </h2>

          <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
            Não encontramos uma assinatura vinculada
            à organização atual.
          </p>

          <div className="pt-2">
            <button
              disabled
              id="btn-manage-subscription-empty"
              type="button"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-500 border border-slate-700/60 cursor-not-allowed"
            >
              <span>Gerenciar assinatura</span>
            </button>

            <p className="text-[11px] text-slate-500 mt-1.5 font-medium">
              Disponível em breve.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================
  // PLANO NÃO ENCONTRADO
  // =========================================================

  if (!plan) {
    return (
      <div className="space-y-6 pb-12">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
          <h1 className="text-xl font-bold text-white font-heading tracking-tight">
            Plano e Cobrança
          </h1>

          <p className="text-xs text-slate-400 mt-1">
            Gerencie seu plano e acompanhe o uso da
            sua empresa.
          </p>
        </div>

        <div
          id="billing-plan-not-found"
          className="bg-slate-900/60 border border-amber-900/30 rounded-xl p-8 text-center max-w-lg mx-auto space-y-3"
        >
          <div className="w-12 h-12 mx-auto rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <AlertTriangle className="w-6 h-6" />
          </div>

          <h2 className="text-base font-bold text-white">
            Plano associado não localizado
          </h2>

          <p className="text-xs text-slate-400">
            A assinatura foi encontrada, porém o
            plano associado não está disponível.
          </p>
        </div>
      </div>
    );
  }

  // =========================================================
  // CÁLCULOS
  // =========================================================

  const activeUsers = activeUsersCount;

  const extraUsers =
    calculateExtraUsers(
      activeUsers,
      plan.included_users,
    );

  const extraMonthlyCost =
    calculateExtraMonthlyCost(
      extraUsers,
      plan.extra_user_price,
    );

  const statusInfo =
    interpretSubscriptionStatus(
      subscription.status,
    );

  // =========================================================
  // VIEW PRINCIPAL
  // =========================================================

  return (
    <div
      id="billing-view-container"
      className="space-y-6 pb-12"
    >
      {/* HEADER */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 font-heading">
                Configurações & Cobrança
              </span>

              <span className="px-2 py-0.5 text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full font-medium flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                Exclusivo Owner
              </span>
            </div>

            <h1 className="text-xl font-bold text-white mt-1 font-heading tracking-tight">
              Plano e Cobrança
            </h1>

            <p className="text-xs text-slate-400 mt-1">
              Gerencie seu plano e acompanhe o uso
              da sua empresa.
            </p>
          </div>

          <div className="flex flex-col items-start md:items-end">
            <button
              id="btn-manage-subscription"
              type="button"
              onClick={handleOpenManageSubscription}
              title="Gerenciar detalhes da assinatura e cobranças"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20 active:scale-[0.98] transition-all cursor-pointer"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Gerenciar assinatura</span>
            </button>
          </div>
        </div>

        {/* ALERTAS DE STATUS */}

        {subscription.status === 'past_due' && (
          <div
            id="billing-alert-past-due"
            className="mt-4 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center gap-3 text-orange-300 text-xs"
          >
            <AlertTriangle className="w-4 h-4 shrink-0 text-orange-400" />

            <span>
              <strong>Atenção:</strong> Há faturas
              pendentes de pagamento. Regularize o
              faturamento para garantir a
              continuidade do acesso.
            </span>
          </div>
        )}

        {subscription.status === 'suspended' && (
          <div
            id="billing-alert-suspended"
            className="mt-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center gap-3 text-rose-300 text-xs"
          >
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />

            <span>
              <strong>Assinatura Suspensa:</strong>{' '}
              os recursos desta organização estão
              bloqueados por pendência financeira.
            </span>
          </div>
        )}

        {subscription.status === 'trialing' && (
          <div
            id="billing-alert-trialing"
            className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center gap-3 text-amber-300 text-xs"
          >
            <Clock className="w-4 h-4 shrink-0 text-amber-400" />

            <span>
              Você está utilizando o{' '}
              <strong>período de teste</strong> do
              NOX4 CFO.
            </span>
          </div>
        )}
      </div>

      {/* CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* PLANO ATUAL */}
        <div
          id="card-billing-plan-name"
          className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm flex flex-col justify-between hover:border-slate-700 transition-colors"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider font-heading">
              Plano Atual
            </span>

            <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <CreditCard className="w-3.5 h-3.5" />
            </div>
          </div>

          <div>
            <div className="text-xl font-bold text-white tracking-tight">
              {plan.name}
            </div>

            <p className="text-[11px] text-slate-400 mt-0.5">
              Plano base corporativo
            </p>
          </div>
        </div>

        {/* STATUS */}
        <div
          id="card-billing-status"
          className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm flex flex-col justify-between hover:border-slate-700 transition-colors"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider font-heading">
              Status
            </span>

            <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mt-1">
              <span
                id="badge-subscription-status"
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${statusInfo.badgeBg} ${statusInfo.badgeText} ${statusInfo.badgeBorder}`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotColor}`}
                />

                {statusInfo.label}
              </span>
            </div>

            <p className="text-[11px] text-slate-400 mt-1.5">
              {statusInfo.description}
            </p>
          </div>
        </div>

        {/* CIAS */}
        <div
          id="card-billing-max-orgs"
          className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm flex flex-col justify-between hover:border-slate-700 transition-colors"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider font-heading">
              CIAs Incluídas
            </span>

            <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Building2 className="w-3.5 h-3.5" />
            </div>
          </div>

          <div>
            <div className="text-xl font-bold text-white tracking-tight">
              {plan.max_organizations}
            </div>

            <p className="text-[11px] text-slate-400 mt-0.5">
              Empresa
              {plan.max_organizations > 1
                ? 's'
                : ''}{' '}
              no contrato
            </p>
          </div>
        </div>

        {/* USUÁRIOS INCLUÍDOS */}
        <div
          id="card-billing-included-users"
          className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm flex flex-col justify-between hover:border-slate-700 transition-colors"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider font-heading">
              Usuários Incluídos
            </span>

            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Users className="w-3.5 h-3.5" />
            </div>
          </div>

          <div>
            <div className="text-xl font-bold text-white tracking-tight">
              {plan.included_users}
            </div>

            <p className="text-[11px] text-slate-400 mt-0.5">
              Licenças no plano base
            </p>
          </div>
        </div>

        {/* USUÁRIOS ATIVOS */}
        <div
          id="card-billing-active-users"
          className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm flex flex-col justify-between hover:border-slate-700 transition-colors"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider font-heading">
              Usuários Ativos
            </span>

            <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <UserCheck className="w-3.5 h-3.5" />
            </div>
          </div>

          <div>
            <div className="text-xl font-bold text-white tracking-tight">
              {activeUsers}
            </div>

            <p className="text-[11px] text-slate-400 mt-0.5">
              Membros cadastrados na CIA
            </p>
          </div>
        </div>

        {/* USUÁRIOS EXTRAS */}
        <div
          id="card-billing-extra-users"
          className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm flex flex-col justify-between hover:border-slate-700 transition-colors"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider font-heading">
              Usuários Adicionais
            </span>

            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                extraUsers > 0
                  ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
                  : 'bg-slate-800 border border-slate-700 text-slate-400'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
            </div>
          </div>

          <div>
            <div
              className={`text-xl font-bold tracking-tight ${
                extraUsers > 0
                  ? 'text-amber-400'
                  : 'text-white'
              }`}
            >
              {extraUsers}
            </div>

            <p className="text-[11px] text-slate-400 mt-0.5">
              {extraUsers > 0
                ? 'Usuários excedentes'
                : 'Dentro do limite incluído'}
            </p>
          </div>
        </div>

        {/* VALOR EXTRA */}
        <div
          id="card-billing-extra-price"
          className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm flex flex-col justify-between hover:border-slate-700 transition-colors"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider font-heading">
              Valor por Usuário Adicional
            </span>

            <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Coins className="w-3.5 h-3.5" />
            </div>
          </div>

          <div>
            <div className="text-xl font-bold text-white tracking-tight">
              {formatCurrencyBRL(
                plan.extra_user_price,
              )}
            </div>

            <p className="text-[11px] text-slate-400 mt-0.5">
              Preço por membro extra
            </p>
          </div>
        </div>

        {/* ADICIONAL MENSAL */}
        <div
          id="card-billing-extra-cost"
          className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm flex flex-col justify-between hover:border-slate-700 transition-colors"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider font-heading">
              Adicional Mensal
            </span>

            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                extraMonthlyCost > 0
                  ? 'bg-blue-500/10 border border-blue-500/20 text-blue-400'
                  : 'bg-slate-800 border border-slate-700 text-slate-400'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
            </div>
          </div>

          <div>
            <div
              className={`text-xl font-bold tracking-tight ${
                extraMonthlyCost > 0
                  ? 'text-blue-400'
                  : 'text-white'
              }`}
            >
              {formatCurrencyBRL(
                extraMonthlyCost,
              )}
            </div>

            <p className="text-[11px] text-slate-400 mt-0.5">
              Total adicional por usuários extras
            </p>
          </div>
        </div>
      </div>

      {/* Modal de Gestão de Assinatura Asaas */}
      <ManageSubscriptionModal
        isOpen={isManageModalOpen}
        onClose={() => setIsManageModalOpen(false)}
        isLoading={isLoadingManageData}
        errorMessage={manageErrorMessage}
        data={manageSubscriptionData}
        onRetry={handleOpenManageSubscription}
        activeOrganizationId={activeOrganizationId}
        onRefreshData={handleOpenManageSubscription}
      />
    </div>
  );
};