import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Building2,
  Users,
  UserPlus,
  ArrowRight,
  ArrowLeft,
  LogOut,
  AlertCircle,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { NoxLogo } from '../brand/NoxLogo';
import { Plan, User } from '../../types';
import { fetchActivePlans, formatCurrencyBRL, getActivePromo } from '../../lib/billingService';
import { formatBillingErrorMessage } from '../../lib/billingErrorMessages';

interface PlansViewProps {
  currentUser?: User | null;
  onSelectPlan: (plan: Plan) => void;
  onBack?: () => void;
  onLogout?: () => void;
}

// Recursos inclusos na plataforma conforme especificação comercial
const CORE_FEATURES = [
  'Gestão financeira',
  'DRE',
  'Fluxo de Caixa',
  'CFO Digital',
  'Indicadores e dashboards',
];

export const PlansView: React.FC<PlansViewProps> = ({
  currentUser,
  onSelectPlan,
  onBack,
  onLogout,
}) => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadPlans = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const { data, error } = await fetchActivePlans();
      if (error) {
        setErrorMessage(formatBillingErrorMessage(error, 'load'));
        setPlans([]);
      } else {
        setPlans(data || []);
      }
    } catch (err: any) {
      setErrorMessage(formatBillingErrorMessage(err, 'load'));
      setPlans([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPlans();
  }, []);

  const handleChoosePlan = (plan: Plan) => {
    // Preserva temporariamente em sessionStorage sem usar localStorage como banco
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        sessionStorage.setItem('nox4_selected_plan_id', plan.id);
      }
    } catch {
      // Ignora falhas de storage em ambientes restritos
    }

    onSelectPlan(plan);
  };

  const isYearlyPlan = (p: Plan) =>
    p.billing_cycle === 'yearly' ||
    p.name?.toLowerCase().includes('anual') ||
    Boolean(p.annual_price && p.annual_price > 0 && p.billing_cycle !== 'monthly');

  // Nova tabela de planos: cada plano (tier) tem versão mensal e anual
  const hasTiers = plans.some((p) => Boolean(p.tier));
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('yearly');

  const visiblePlans = [...plans]
    .filter((p) => !hasTiers || (cycle === 'yearly' ? isYearlyPlan(p) : !isYearlyPlan(p)))
    .sort((a, b) => {
      if (hasTiers) return (a.tier_order ?? 99) - (b.tier_order ?? 99);
      // Tabela antiga: Mensal à esquerda, Anual à direita
      const ay = isYearlyPlan(a);
      const by = isYearlyPlan(b);
      if (!ay && by) return -1;
      if (ay && !by) return 1;
      return (b.base_price ?? 0) - (a.base_price ?? 0);
    });

  const activePromos = plans.map((p) => getActivePromo(p)).filter(Boolean) as NonNullable<ReturnType<typeof getActivePromo>>[];
  const anyPromo = activePromos[0] || null;
  const maxPercentOff = activePromos.reduce((m, p) => Math.max(m, p.percentOff), 0);
  const displayName = (p: Plan) => (hasTiers ? p.name.replace(/\s+(Mensal|Anual)$/i, '') : p.name);
  const formatDateShort = (d: Date) =>
    d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' });

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col justify-between relative overflow-x-hidden font-sans">
      {/* Ambience Background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-slate-950 to-slate-950 pointer-events-none" />
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between border-b border-slate-800/80">
        <div className="flex items-center gap-4">
          {onBack && (
            <button
              id="btn-back-to-home"
              type="button"
              onClick={onBack}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white hover:border-slate-700 transition-all cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Voltar</span>
            </button>
          )}
          <NoxLogo size="sm" layout="horizontal" theme="dark" showSubtitle={true} />
        </div>

        <div className="flex items-center gap-3">
          {currentUser?.email && (
            <span className="hidden sm:inline-block text-xs text-slate-400 font-mono">
              {currentUser.email}
            </span>
          )}
          {onLogout && (
            <button
              id="btn-plans-logout"
              type="button"
              onClick={onLogout}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-rose-400 hover:border-rose-500/30 transition-all cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sair</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-14 flex-1 flex flex-col items-center">
        {/* Title Section */}
        <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-14 space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Planos Empresariais NOX4 CFO</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight font-heading">
            Escolha seu plano
          </h1>

          <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
            Comece com sua empresa e aumente sua equipe conforme sua operação crescer.
          </p>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-3">
            <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            <p className="text-xs">Carregando planos disponíveis...</p>
          </div>
        )}

        {/* Error State */}
        {!isLoading && errorMessage && (
          <div className="w-full max-w-md bg-rose-500/10 border border-rose-500/30 rounded-2xl p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-500/20 flex items-center justify-center text-rose-400 mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white">Não foi possível carregar os planos</h3>
              <p className="text-xs text-rose-300">{errorMessage}</p>
            </div>
            <button
              id="btn-retry-plans"
              type="button"
              onClick={loadPlans}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-bold text-white cursor-pointer transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Tentar novamente</span>
            </button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !errorMessage && plans.length === 0 && (
          <div className="w-full max-w-md bg-slate-900/60 border border-slate-800 rounded-2xl p-8 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 mx-auto">
              <Building2 className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white">Nenhum plano ativo disponível</h3>
              <p className="text-xs text-slate-400">
                Novas opções de contratação estarão disponíveis em breve. Entre em contato com o suporte caso necessite de acesso imediato.
              </p>
            </div>
            <button
              id="btn-refresh-plans"
              type="button"
              onClick={loadPlans}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white cursor-pointer transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Atualizar</span>
            </button>
          </div>
        )}

        {/* Black Friday / promoção vigente */}
        {!isLoading && !errorMessage && anyPromo && (
          <div className="w-full max-w-5xl mx-auto mb-6 rounded-2xl border border-amber-400/40 bg-amber-400/10 px-5 py-3 text-center text-sm text-amber-200">
            <strong className="text-amber-300">{anyPromo.label}:</strong> até {maxPercentOff}% de desconto nos planos
            {anyPromo.endsAt ? `, válido até ${formatDateShort(anyPromo.endsAt)}` : ''}.
          </div>
        )}

        {/* Mensal x Anual */}
        {!isLoading && !errorMessage && hasTiers && (
          <div className="mb-10 inline-flex rounded-xl border border-slate-800 bg-slate-900 p-1" role="group" aria-label="Forma de pagamento">
            {(['monthly', 'yearly'] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCycle(c)}
                aria-pressed={cycle === c}
                className={`min-h-[40px] px-5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  cycle === c ? 'bg-blue-600 text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                {c === 'monthly' ? 'Mensal' : 'Anual · 2 meses grátis'}
              </button>
            ))}
          </div>
        )}

        {/* Plans Grid */}
        {!isLoading && !errorMessage && visiblePlans.length > 0 && (
          <div
            className={`w-full mx-auto grid grid-cols-1 gap-6 lg:gap-8 items-stretch ${
              visiblePlans.length >= 3 ? 'max-w-6xl md:grid-cols-3' : 'max-w-4xl md:grid-cols-2'
            }`}
          >
            {visiblePlans.map((plan) => {
              const isYearly = isYearlyPlan(plan);
              const promo = getActivePromo(plan);
              const cyclePrice = isYearly
                ? plan.annual_price ?? (plan.base_price ? plan.base_price * 12 : 0)
                : plan.base_price ?? 0;
              const monthlyEquivalent = isYearly ? cyclePrice / 12 : cyclePrice;
              const featured = hasTiers ? Boolean(plan.highlight) : isYearly;

              return (
                <div
                  key={plan.id}
                  id={`plan-card-${plan.id}`}
                  className={`flex flex-col justify-between rounded-2xl p-6 sm:p-8 transition-all duration-200 relative ${
                    featured
                      ? 'bg-gradient-to-b from-slate-900 via-slate-900 to-blue-950/20 border-2 border-blue-500/60 shadow-2xl shadow-blue-950/50 ring-1 ring-blue-500/30'
                      : 'bg-slate-900/90 border border-slate-800 hover:border-slate-700 shadow-xl'
                  }`}
                >
                  {featured && (
                    <div
                      id="badge-more-advantageous"
                      className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3.5 py-1 rounded-full bg-blue-600 text-white text-[11px] font-extrabold uppercase tracking-wider shadow-lg"
                    >
                      {hasTiers ? 'Recomendado' : 'Mais vantajoso'}
                    </div>
                  )}

                  <div className="space-y-5">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="text-2xl font-bold text-white tracking-tight font-heading">{displayName(plan)}</h2>
                      {promo && (
                        <span className="shrink-0 px-2 py-0.5 rounded-md bg-amber-400 text-slate-950 text-[11px] font-extrabold">
                          -{promo.percentOff}%
                        </span>
                      )}
                    </div>

                    {/* Pricing */}
                    <div className="py-3 border-y border-slate-800/80 space-y-1.5">
                      {promo ? (
                        <>
                          <p className="text-xs text-slate-400 line-through">
                            {formatCurrencyBRL(monthlyEquivalent)}/mês
                          </p>
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                              {formatCurrencyBRL(isYearly ? promo.price / 12 : promo.price)}
                            </span>
                            <span className="text-xs font-semibold text-slate-400">/mês</span>
                          </div>
                          <p className="text-xs font-medium text-amber-200">
                            {isYearly
                              ? `${formatCurrencyBRL(promo.price)} no 1º ano. Depois, ${formatCurrencyBRL(cyclePrice)}/ano.`
                              : `Nos ${promo.cycles} primeiros meses. Depois, ${formatCurrencyBRL(cyclePrice)}/mês.`}
                          </p>
                        </>
                      ) : (
                        <>
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                              {formatCurrencyBRL(monthlyEquivalent)}
                            </span>
                            <span className="text-xs font-semibold text-slate-400">
                              {isYearly ? '/mês equivalente' : '/mês'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400">
                            {isYearly ? `${formatCurrencyBRL(cyclePrice)} cobrado anualmente.` : 'Cobrança mensal, cancele quando quiser.'}
                          </p>
                        </>
                      )}
                    </div>

                    {/* Operational Limits and Features */}
                    <div className="space-y-2.5 text-xs text-slate-300">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span className="font-medium text-slate-200">
                          {plan.max_organizations} {plan.max_organizations === 1 ? 'empresa' : 'empresas'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span className="font-medium text-slate-200">
                          {plan.included_users} {plan.included_users === 1 ? 'usuário incluído' : 'usuários incluídos'}
                        </span>
                      </div>

                      {CORE_FEATURES.map((feat) => (
                        <div key={feat} className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
                          <span className="text-slate-300">{feat}</span>
                        </div>
                      ))}
                    </div>

                    <div className="pt-3 border-t border-slate-800/60 text-xs space-y-1">
                      <div>
                        <span className="text-slate-400">Usuário adicional: </span>
                        <strong className="text-slate-200">{formatCurrencyBRL(plan.extra_user_price)}/mês</strong>
                      </div>
                      {plan.extra_company_price ? (
                        <div>
                          <span className="text-slate-400">Empresa adicional: </span>
                          <strong className="text-slate-200">{formatCurrencyBRL(plan.extra_company_price)}/mês</strong>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="pt-6 mt-6 border-t border-slate-800/80">
                    <button
                      id={isYearly ? 'btn-select-plan-yearly' : 'btn-select-plan-monthly'}
                      type="button"
                      onClick={() => handleChoosePlan(plan)}
                      className={`w-full py-3.5 px-4 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        featured
                          ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30'
                          : 'bg-slate-800 hover:bg-slate-700 text-white'
                      }`}
                    >
                      <span>{hasTiers ? `Contratar ${displayName(plan).replace(/^NOX4\s+/i, '')}` : isYearly ? 'Contratar anual' : 'Contratar mensal'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 text-center text-xs text-slate-500 border-t border-slate-800/80">
        NOX4 CFO • Plataforma de Inteligência Financeira e Governança Corporativa
      </footer>
    </div>
  );
};
