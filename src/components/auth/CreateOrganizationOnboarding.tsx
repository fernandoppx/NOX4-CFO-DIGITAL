import React, { useState } from 'react';
import { Building2, Sparkles, ArrowRight, LogOut, AlertCircle, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { NoxLogo } from '../brand/NoxLogo';
import { User } from '../../types';
import { createOrganizationRPC } from '../../lib/supabaseAuth';

interface CreateOrganizationOnboardingProps {
  currentUser: User;
  onOrganizationCreated: (newOrgId?: string, companyName?: string) => Promise<void> | void;
  onLogout: () => Promise<void> | void;
  onCancel?: () => void;
}

export const CreateOrganizationOnboarding: React.FC<CreateOrganizationOnboardingProps> = ({
  currentUser,
  onOrganizationCreated,
  onLogout,
  onCancel,
}) => {
  const [companyName, setCompanyName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmed = companyName.trim();
    if (!trimmed) {
      setErrorMessage('Por favor, informe o nome da sua empresa.');
      return;
    }

    setIsLoading(true);
    try {
      const createdOrgId = await createOrganizationRPC(trimmed, {
        userId: currentUser.id,
      });
      await onOrganizationCreated(createdOrgId || undefined, trimmed);
    } catch (err: any) {
      console.error('Erro ao criar organização:', err);
      setErrorMessage(
        err?.message || 'Não foi possível criar a empresa no momento. Tente novamente.'
      );
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col justify-between relative overflow-hidden font-sans select-none">
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-slate-950 to-slate-950 pointer-events-none" />
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 -right-40 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Grid Pattern */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(#ffffff 1px, transparent 1px)`,
          backgroundSize: '24px 24px',
        }}
      />

      {/* Header */}
      <header className="relative z-10 w-full max-w-5xl mx-auto px-6 py-6 flex items-center justify-between">
        <NoxLogo size="sm" layout="horizontal" theme="dark" showSubtitle={true} />
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">
            Conectado como <strong className="text-slate-200">{currentUser.name || currentUser.email}</strong>
          </span>
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sair</span>
          </button>
        </div>
      </header>

      {/* Main Form */}
      <main className="relative z-10 w-full max-w-md mx-auto px-4 py-8 flex-1 flex flex-col justify-center">
        <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl shadow-2xl backdrop-blur-xl p-6 sm:p-8 relative">
          <div className="absolute top-0 left-8 right-8 h-[2px] bg-gradient-to-r from-transparent via-blue-500 to-transparent" />

          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-2xl bg-blue-600/10 border border-blue-500/20 text-blue-400 mx-auto flex items-center justify-center mb-3">
              <Building2 className="w-6 h-6" />
            </div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[11px] font-semibold mb-2">
              <Sparkles className="w-3 h-3" />
              <span>Boas-vindas ao NOX4 CFO</span>
            </div>
            <h1 className="text-2xl font-black text-white font-heading tracking-tight">
              Crie sua empresa
            </h1>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              Você ainda não está vinculado a nenhuma organização. Informe a razão social ou nome da sua empresa para configurar seu ambiente de controladoria.
            </p>
          </div>

          {errorMessage && (
            <div className="mb-5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Nome da Empresa / Razão Social
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Building2 className="w-4 h-4" />
                </div>
                <input
                  id="input-company-name"
                  type="text"
                  required
                  autoFocus
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Ex: NOX4 Aceleradora de Resultados"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Você será configurado automaticamente como Owner (Proprietário) desta empresa.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <button
                id="btn-create-organization"
                type="submit"
                disabled={isLoading || !companyName.trim()}
                className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-[0.99] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25 transition-all disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Criar Empresa e Acessar</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="w-full py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-xs font-medium transition-colors cursor-pointer"
                >
                  Voltar para tela de espera
                </button>
              )}
            </div>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-center gap-2 text-[11px] text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Ambiente seguro com proteção e isolamento de dados</span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-5xl mx-auto px-6 py-4 text-center text-[11px] text-slate-500">
        NOX4 CFO Digital &copy; 2026 &bull; Controladoria Financeira de Alta Performance
      </footer>
    </div>
  );
};
