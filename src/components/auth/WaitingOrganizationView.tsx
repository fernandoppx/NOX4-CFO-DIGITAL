import React, { useState } from 'react';
import {
  UserCheck,
  LogOut,
  RefreshCw,
  Mail,
  Building2,
  UserPlus,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { NoxLogo } from '../brand/NoxLogo';
import { claimPendingInvitations } from '../../lib/supabaseAuth';

interface WaitingOrganizationViewProps {
  userEmail: string;
  userName?: string;
  onRefresh: () => void | Promise<void>;
  onLogout: () => void;
  onNavigateToPlans: () => void;
}

export const WaitingOrganizationView: React.FC<WaitingOrganizationViewProps> = ({
  userEmail,
  onRefresh,
  onLogout,
  onNavigateToPlans,
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [checkMessage, setCheckMessage] = useState<string | null>(null);
  const [checkSuccess, setCheckSuccess] = useState(false);

  const handleRefreshClick = async () => {
    if (isRefreshing) return;

    setIsRefreshing(true);
    setCheckMessage(null);
    setCheckSuccess(false);

    try {
      // 1. Tenta reivindicar convites pendentes vinculados
      // ao e-mail REAL do usuário autenticado.
      const result = await claimPendingInvitations(userEmail);

      // 2. Recarrega as organizações/membros no App.
      await onRefresh();

      if (result.claimed > 0) {
        setCheckSuccess(true);
        setCheckMessage(
          result.claimed === 1
            ? 'Acesso encontrado! Sua empresa está sendo carregada.'
            : `${result.claimed} acessos encontrados! Suas empresas estão sendo carregadas.`
        );
      } else {
        setCheckSuccess(false);
        setCheckMessage(
          'Nenhum novo acesso foi encontrado para este e-mail. Confirme com o responsável pela empresa se o convite foi criado.'
        );
      }
    } catch (err) {
      console.error('Erro ao verificar acessos:', err);

      setCheckSuccess(false);
      setCheckMessage(
        'Não foi possível verificar seus acessos agora. Tente novamente em alguns instantes.'
      );
    } finally {
      setTimeout(() => {
        setIsRefreshing(false);
      }, 600);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col justify-between relative overflow-hidden font-sans select-none">
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-slate-950 to-slate-950 pointer-events-none" />
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
        <NoxLogo
          size="sm"
          layout="horizontal"
          theme="dark"
          showSubtitle={true}
        />

        <button
          id="btn-waiting-top-logout"
          type="button"
          onClick={onLogout}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-rose-400 hover:border-rose-500/30 transition-all cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sair</span>
        </button>
      </header>

      {/* Center Card */}
      <main className="relative z-10 w-full max-w-2xl mx-auto px-4 py-8 flex-1 flex flex-col items-center justify-center">
        <div className="w-full bg-slate-900/90 border border-slate-800/90 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl text-center space-y-6">

          {/* Status Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
            <UserCheck className="w-4 h-4" />
            <span>Conta ativa</span>
          </div>

          {/* Header Title */}
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-heading">
              Você ainda não possui acesso a nenhuma empresa.
            </h1>

            <p className="text-sm text-slate-400 leading-relaxed max-w-lg mx-auto">
              Escolha abaixo como deseja começar no NOX4 CFO:
            </p>
          </div>

          {/* User Email Info Card */}
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 text-left flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
              <Mail className="w-4 h-4" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                E-mail autenticado
              </p>

              <p className="text-xs sm:text-sm font-semibold text-slate-200 truncate">
                {userEmail}
              </p>
            </div>
          </div>

          {/* Resultado da verificação */}
          {checkMessage && (
            <div
              className={`p-3.5 rounded-xl border text-left flex items-start gap-2.5 ${
                checkSuccess
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-200'
              }`}
            >
              {checkSuccess ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
              )}

              <p className="text-xs leading-relaxed">
                {checkMessage}
              </p>
            </div>
          )}

          {/* Duas Opções */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left pt-2">

            {/* OPÇÃO 1 */}
            <div className="flex flex-col justify-between p-5 rounded-xl bg-slate-950/70 border border-blue-500/30 hover:border-blue-500/60 transition-all group shadow-lg shadow-blue-500/5">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <Building2 className="w-5 h-5" />
                </div>

                <div>
                  <h2 className="text-base font-bold text-white group-hover:text-blue-300 transition-colors">
                    Quero usar o NOX4 na minha empresa
                  </h2>

                  <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                    Contrate um plano para criar sua empresa e começar a usar o NOX4.
                  </p>
                </div>
              </div>

              <div className="pt-5 mt-auto">
                <button
                  id="btn-subscribe-plan"
                  type="button"
                  onClick={onNavigateToPlans}
                  className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-[0.99] text-white font-bold text-xs tracking-wider uppercase transition-all shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Contratar Plano</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* OPÇÃO 2 */}
            <div className="flex flex-col justify-between p-5 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition-all group">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-lg bg-slate-800/80 border border-slate-700/80 flex items-center justify-center text-slate-300">
                  <UserPlus className="w-5 h-5" />
                </div>

                <div>
                  <h2 className="text-base font-bold text-white">
                    Já fui convidado para uma empresa
                  </h2>

                  <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                    Se o responsável pela empresa já adicionou seu e-mail na área
                    Equipe, clique abaixo para verificar e ativar seu acesso.
                  </p>
                </div>
              </div>

              <div className="pt-5 mt-auto">
                <button
                  id="btn-check-invitations"
                  type="button"
                  disabled={isRefreshing}
                  onClick={handleRefreshClick}
                  className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${
                      isRefreshing ? 'animate-spin' : ''
                    }`}
                  />

                  <span>
                    {isRefreshing ? 'Verificando...' : 'Verificar Acessos'}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Logout */}
          <div className="pt-3 border-t border-slate-800/80 flex items-center justify-center">
            <button
              id="btn-waiting-logout"
              type="button"
              onClick={onLogout}
              className="py-2.5 px-6 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800/60 font-semibold text-xs transition-all flex items-center gap-2 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Sair da conta</span>
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-7xl mx-auto px-6 py-4 text-center text-xs text-slate-500">
        NOX4 CFO • Gestão Financeira Estratégica & Governança Corporativa
      </footer>
    </div>
  );
};