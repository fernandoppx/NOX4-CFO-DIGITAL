import React from 'react';
import { ArrowLeft, Clock, ShieldCheck, Sparkles } from 'lucide-react';
import { NoxLogo } from '../brand/NoxLogo';

interface SubscriptionProcessingViewProps {
  onBackToAccount: () => void;
  onLogout?: () => void;
}

export const SubscriptionProcessingView: React.FC<SubscriptionProcessingViewProps> = ({
  onBackToAccount,
  onLogout,
}) => {
  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col justify-between relative overflow-hidden font-sans select-none">
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-slate-950 to-slate-950 pointer-events-none" />
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-6 py-5 flex items-center justify-between border-b border-slate-800/80">
        <NoxLogo size="sm" layout="horizontal" theme="dark" showSubtitle={true} />
        {onLogout && (
          <button
            id="btn-processing-logout"
            type="button"
            onClick={onLogout}
            className="px-3.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-rose-400 hover:border-rose-500/30 transition-all cursor-pointer"
          >
            Sair
          </button>
        )}
      </header>

      {/* Center Card */}
      <main className="relative z-10 w-full max-w-lg mx-auto px-4 py-8 flex-1 flex flex-col items-center justify-center">
        <div className="w-full bg-slate-900/90 border border-slate-800/90 rounded-2xl p-8 sm:p-10 shadow-2xl backdrop-blur-xl text-center space-y-6">
          {/* Animated Spinner with Glow */}
          <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-blue-500/20 blur-xl animate-pulse" />
            <div className="w-16 h-16 border-4 border-slate-800 border-t-blue-500 rounded-full animate-spin" />
            <Clock className="w-7 h-7 text-blue-400 absolute" />
          </div>

          {/* Texts strictly following requirements */}
          <div className="space-y-2.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Confirmação em Andamento</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-heading">
              Estamos confirmando sua assinatura
            </h1>
            <p className="text-sm text-slate-400 leading-relaxed max-w-md mx-auto">
              Assim que o pagamento for confirmado, sua empresa será criada automaticamente.
            </p>
          </div>

          {/* Information box */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-left space-y-2 text-xs text-slate-300">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold">
              <ShieldCheck className="w-4 h-4" />
              <span>Confirmação segura de pagamento</span>
            </div>
            <p className="text-slate-400 leading-relaxed text-[11px]">
              O NOX4 receberá a confirmação da instituição de pagamento de forma instantânea e liberará os acessos da sua empresa automaticamente.
            </p>
          </div>

          {/* Action Button: VOLTAR PARA MINHA CONTA */}
          <div className="pt-2">
            <button
              id="btn-back-to-account"
              type="button"
              onClick={onBackToAccount}
              className="w-full py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-[0.99] text-white font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar para Minha Conta</span>
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-7xl mx-auto px-6 py-4 text-center text-xs text-slate-500">
        NOX4 CFO • Notificação de Pagamento e Provisionamento Seguro
      </footer>
    </div>
  );
};
