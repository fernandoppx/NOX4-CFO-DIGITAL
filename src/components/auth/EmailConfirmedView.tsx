import React, { useEffect, useState } from 'react';
import { CheckCircle2, ArrowRight, ShieldCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { NoxLogo } from '../brand/NoxLogo';

interface EmailConfirmedViewProps {
  onGoToLogin: () => void;
}

export const EmailConfirmedView: React.FC<EmailConfirmedViewProps> = ({ onGoToLogin }) => {
  const [isSigningOut, setIsSigningOut] = useState<boolean>(true);

  useEffect(() => {
    // Garante que qualquer sessão gerada automaticamente no clique do link seja encerrada
    const ensureSessionTerminated = async () => {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('Sessão limpa pós-confirmação:', err);
      } finally {
        // Remove hash e tokens da URL mantendo rota limpa
        if (typeof window !== 'undefined' && window.history?.replaceState) {
          window.history.replaceState(null, '', '/auth/confirmed');
        }
        setIsSigningOut(false);
      }
    };

    ensureSessionTerminated();
  }, []);

  const handleNavigateToLogin = () => {
    // Navega para /login e limpa parâmetros residuais
    if (typeof window !== 'undefined' && window.history?.replaceState) {
      window.history.replaceState(null, '', '/login');
    }
    onGoToLogin();
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col justify-between relative overflow-hidden font-sans select-none">
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-slate-950 to-slate-950 pointer-events-none" />
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 -right-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(#ffffff 1px, transparent 1px)`,
          backgroundSize: '24px 24px',
        }}
      />

      {/* Top Header */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
        <NoxLogo size="sm" layout="horizontal" theme="dark" showSubtitle={true} />
        <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs text-slate-300">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          Validação Concluída
        </span>
      </header>

      {/* Center Card */}
      <main className="relative z-10 w-full max-w-md mx-auto px-4 py-8 flex-1 flex flex-col items-center justify-center">
        <div className="w-full bg-slate-900/90 border border-slate-800/90 rounded-2xl p-8 shadow-2xl backdrop-blur-xl text-center space-y-6">
          {/* Success Icon */}
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400 shadow-lg shadow-emerald-500/10">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          {/* Texts strictly following requirements */}
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-white tracking-tight font-heading">
              E-mail confirmado com sucesso.
            </h1>
            <p className="text-base text-slate-300 font-medium">
              Seu cadastro foi validado.
            </p>
            <p className="text-sm text-slate-400 pt-1">
              Agora volte ao NOX4 e faça login com seu e-mail e senha.
            </p>
          </div>

          {/* Action Button */}
          <div className="pt-4">
            <button
              id="btn-go-to-login"
              type="button"
              disabled={isSigningOut}
              onClick={handleNavigateToLogin}
              className="w-full py-3.5 px-5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm tracking-wide transition-all shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 group cursor-pointer disabled:opacity-50"
            >
              <span>IR PARA O LOGIN</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-7xl mx-auto px-6 py-4 text-center text-xs text-slate-500">
        NOX4 CFO • Plataforma de Gestão Financeira e Controladoria
      </footer>
    </div>
  );
};
