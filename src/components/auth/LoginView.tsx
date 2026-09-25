import React, { useState } from 'react';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  Building2,
  User as UserIcon,
  AlertCircle,
  TrendingUp,
  LineChart,
  Bot,
  Layers,
} from 'lucide-react';
import { NoxLogo } from '../brand/NoxLogo';
import { supabase } from '../../lib/supabase';
import { createOrganizationRPC } from '../../lib/supabaseAuth';

interface LoginViewProps {
  initialMode?: 'login' | 'register';
  onAuthSuccess?: () => void;
  onNavigateToVerifyEmail?: (email: string) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({
  initialMode = 'login',
  onAuthSuccess,
  onNavigateToVerifyEmail,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [existingAccountEmail, setExistingAccountEmail] = useState<string | null>(null);

  // Register state
  const [regFullName, setRegFullName] = useState<string>('');
  const [regEmail, setRegEmail] = useState<string>('');
  const [regPassword, setRegPassword] = useState<string>('');
  const [regConfirmPassword, setRegConfirmPassword] = useState<string>('');

  // Forgot password modal state
  const [isForgotModalOpen, setIsForgotModalOpen] = useState<boolean>(false);
  const [forgotEmail, setForgotEmail] = useState<string>('');
  const [forgotLoading, setForgotLoading] = useState<boolean>(false);

  const translateAuthError = (message?: string): string => {
    if (!message) return 'Ocorreu um erro na autenticação. Verifique os dados e tente novamente.';
    const lower = message.toLowerCase();
    if (lower.includes('invalid login credentials') || lower.includes('invalid_credentials')) {
      return 'E-mail ou senha incorretos.';
    }
    if (lower.includes('email not confirmed')) {
      return 'E-mail ainda não confirmado. Verifique o código enviado para o seu e-mail.';
    }
    if (lower.includes('user already registered') || lower.includes('already exists')) {
      return 'Este e-mail já está cadastrado. Faça login ou use outro e-mail.';
    }
    if (lower.includes('password should be at least 6 characters')) {
      return 'A senha deve conter no mínimo 6 caracteres.';
    }
    if (lower.includes('rate limit') || lower.includes('too many requests')) {
      return 'Muitas tentativas em sequência. Aguarde alguns instantes.';
    }
    return message;
  };

  const isExistingUserError = (error: any): boolean => {
    const code = String(error?.code || '').toLowerCase();
    const message = String(error?.message || '').toLowerCase();

    return (
      code === 'user_already_exists' ||
      code === 'email_exists' ||
      message.includes('user already registered') ||
      message.includes('user already exists') ||
      message.includes('email already exists') ||
      message.includes('already registered')
    );
  };

  const showExistingAccountNotice = (accountEmail: string) => {
    setExistingAccountEmail(accountEmail);
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const goToLoginWithExistingEmail = () => {
    if (existingAccountEmail) {
      setEmail(existingAccountEmail);
    }

    setPassword('');
    setMode('login');
    setExistingAccountEmail(null);
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const useAnotherRegistrationEmail = () => {
    setExistingAccountEmail(null);
    setRegEmail('');
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setExistingAccountEmail(null);
    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setErrorMessage(translateAuthError(error.message));
        setIsLoading(false);
        return;
      }

      if (data.session || data.user) {
        setSuccessMessage('Autenticação realizada com sucesso! Acessando...');
        if (onAuthSuccess) {
          onAuthSuccess();
        }
      }
    } catch (err: any) {
      console.error('Erro de login Supabase:', err);
      setErrorMessage(translateAuthError(err?.message));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setExistingAccountEmail(null);

    const trimmedName = regFullName.trim();
    const trimmedEmail = regEmail.trim();

    if (!trimmedName || !trimmedEmail || !regPassword || !regConfirmPassword) {
      setErrorMessage('Por favor, preencha todos os campos do cadastro.');
      return;
    }

    if (regPassword.length < 6) {
      setErrorMessage('A senha de acesso deve ter pelo menos 6 caracteres.');
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setErrorMessage('As senhas não coincidem. Verifique e tente novamente.');
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password: regPassword,
        options: {
          data: {
            full_name: trimmedName,
          },
        },
      });

      if (error) {
        if (isExistingUserError(error)) {
          showExistingAccountNotice(trimmedEmail);
          return;
        }

        setErrorMessage(translateAuthError(error.message));
        return;
      }

      /**
       * Com confirmação de e-mail habilitada, o Supabase pode devolver
       * um usuário ofuscado quando o e-mail já pertence a uma conta confirmada,
       * em vez de retornar "User already registered".
       *
       * No Supabase hospedado, esse objeto pode vir com identities = [].
       * Quando isso ocorrer, não seguimos para a tela de OTP.
       */
      const returnedIdentities = data?.user?.identities;
      const looksLikeExistingConfirmedAccount =
        !!data?.user &&
        Array.isArray(returnedIdentities) &&
        returnedIdentities.length === 0;

      if (looksLikeExistingConfirmedAccount) {
        if (data?.session) {
          try {
            await supabase.auth.signOut();
          } catch {
            // Não bloqueia a mensagem amigável caso o signOut falhe.
          }
        }

        showExistingAccountNotice(trimmedEmail);
        return;
      }

      // Se houver qualquer sessão transitória criada, encerra imediatamente pois confirmação é mandatória
      if (data?.session) {
        try {
          await supabase.auth.signOut();
        } catch (signOutErr) {
          console.warn('Sessão pós-registro encerrada:', signOutErr);
        }
      }

      // Navega para /auth/verify-email com estado temporário
      if (onNavigateToVerifyEmail) {
        onNavigateToVerifyEmail(trimmedEmail);
      } else {
        if (typeof window !== 'undefined' && window.history?.pushState) {
          window.history.pushState(null, '', '/auth/verify-email');
        }
      }
    } catch (err: any) {
      console.error('Erro de cadastro Supabase:', err);
      setErrorMessage(translateAuthError(err?.message));
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;

    setForgotLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim());
      if (error) {
        setErrorMessage(translateAuthError(error.message));
      } else {
        setIsForgotModalOpen(false);
        setSuccessMessage(`Instruções de redefinição de senha enviadas para ${forgotEmail.trim()}!`);
      }
    } catch (err: any) {
      console.error('Erro reset password:', err);
      setErrorMessage(translateAuthError(err?.message));
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col justify-between relative overflow-hidden font-sans select-none">
      {/* Background Ambience & Lighting */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-slate-950 to-slate-950 pointer-events-none" />
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 -right-40 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-slate-800/20 rounded-full blur-3xl pointer-events-none" />

      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(#ffffff 1px, transparent 1px)`,
          backgroundSize: '24px 24px',
        }}
      />

      {/* Top Header Bar */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <NoxLogo size="sm" layout="horizontal" theme="dark" showSubtitle={true} />
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-300">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Ambiente seguro
          </span>
        </div>
      </header>

      {/* Main Content Hero & Login Box */}
      <main className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 flex-1 flex flex-col lg:flex-row items-center justify-center gap-10 lg:gap-16 my-auto">
        {/* Left Side: Value Proposition */}
        <div className="flex-1 max-w-lg text-center lg:text-left space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Sistema Financeiro & Controladoria 360°</span>
          </div>

          <div className="space-y-3">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight font-heading leading-[1.15]">
              Gestão Financeira de <br className="hidden sm:inline" />
              <span className="bg-gradient-to-r from-blue-400 via-blue-500 to-indigo-400 bg-clip-text text-transparent">
                Alta Performance
              </span>
            </h1>
            <p className="text-sm sm:text-base text-slate-400 leading-relaxed max-w-md mx-auto lg:mx-0">
              DRE Gerencial em regime de competência, conciliação de fluxo de caixa, unit economics por cliente e segurança com proteção avançada de dados.
            </p>
          </div>

          {/* Feature Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 text-left">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0 mt-0.5">
                <LineChart className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <h2 className="text-xs font-bold text-slate-200">DRE & Margens Reais</h2>
                <p className="text-[11px] text-slate-400 mt-0.5">Visão vertical e horizontal do resultado operacional.</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 text-left">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-xs font-bold text-slate-200">Fluxo de Caixa Direto</h2>
                <p className="text-[11px] text-slate-400 mt-0.5">Previsibilidade diária, contas a receber e a pagar.</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 text-left">
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <h2 className="text-xs font-bold text-slate-200">CFO Digital com IA</h2>
                <p className="text-[11px] text-slate-400 mt-0.5">Análises de runway, CAC, LTV e alertas proativos.</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 text-left">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
                <Layers className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <h2 className="text-xs font-bold text-slate-200">Multi-Empresas</h2>
                <p className="text-[11px] text-slate-400 mt-0.5">Isolamento total de dados e centros de custo.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Auth Card */}
        <div className="w-full max-w-md bg-slate-900/90 border border-slate-800/90 rounded-2xl shadow-2xl backdrop-blur-xl p-6 sm:p-8 relative">
          <div className="absolute top-0 left-8 right-8 h-[2px] bg-gradient-to-r from-transparent via-blue-500 to-transparent" />

          {/* Form Header */}
          <div className="text-center mb-6">
            <div className="inline-flex justify-center mb-3">
              <NoxLogo size="md" layout="vertical" theme="dark" showSubtitle={false} />
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {mode === 'login'
                ? 'Insira suas credenciais corporativas para acessar'
                : 'Cadastre sua conta e comece a gerenciar suas finanças'}
            </p>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex p-1 bg-slate-950 border border-slate-800 rounded-xl mb-6">
            <button
              id="tab-login"
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMessage(null);
                setSuccessMessage(null);
                setExistingAccountEmail(null);
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                mode === 'login'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Acessar Conta
            </button>
            <button
              id="tab-register"
              type="button"
              onClick={() => {
                setMode('register');
                setErrorMessage(null);
                setSuccessMessage(null);
                setExistingAccountEmail(null);
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                mode === 'register'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Novo Cadastro
            </button>
          </div>

          {/* Existing Account Notice */}
          {existingAccountEmail && mode === 'register' && (
            <div className="mb-5 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-100">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs font-bold text-amber-200">
                    Este e-mail já está cadastrado
                  </p>
                  <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                    Já existe uma conta NOX4 vinculada a este e-mail. Faça login para acessar sua conta
                    ou utilize outro e-mail para criar um novo cadastro.
                  </p>

                  <div className="flex flex-col sm:flex-row gap-2 mt-3">
                    <button
                      id="btn-existing-email-login"
                      type="button"
                      onClick={goToLoginWithExistingEmail}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold transition-colors cursor-pointer"
                    >
                      <span>Ir para login</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>

                    <button
                      id="btn-existing-email-change"
                      type="button"
                      onClick={useAnotherRegistrationEmail}
                      className="inline-flex items-center justify-center px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white text-[11px] font-semibold transition-colors cursor-pointer"
                    >
                      Usar outro e-mail
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Error & Success Notifications */}
          {errorMessage && (
            <div className="mb-5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="mb-5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* ===================== LOGIN FORM ===================== */}
          {mode === 'login' ? (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  E-mail Corporativo
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    id="input-login-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu.email@empresa.com.br"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-slate-300">
                    Senha de Acesso
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotEmail(email);
                      setIsForgotModalOpen(true);
                    }}
                    className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
                  >
                    Esqueceu a senha?
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="input-login-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-10 py-2.5 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                id="btn-login-submit"
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-[0.99] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25 transition-all disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Entrar no Sistema</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          ) : (
            /* ===================== REGISTER FORM ===================== */
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Nome Completo
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <UserIcon className="w-4 h-4" />
                  </div>
                  <input
                    id="input-reg-name"
                    type="text"
                    required
                    autoComplete="name"
                    value={regFullName}
                    onChange={(e) => setRegFullName(e.target.value)}
                    placeholder="Ex: Gabriel Turíbia"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  E-mail
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    id="input-reg-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={regEmail}
                    onChange={(e) => {
                      setRegEmail(e.target.value);
                      if (existingAccountEmail) {
                        setExistingAccountEmail(null);
                      }
                    }}
                    placeholder="seu.email@empresa.com.br"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Senha
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="input-reg-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-10 py-2 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Confirmar Senha
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="input-reg-confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    placeholder="Repita sua senha"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-10 py-2 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                id="btn-register-submit"
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-[0.99] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25 transition-all disabled:opacity-50 mt-4 cursor-pointer"
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Criar conta</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </main>

      {/* Forgot Password Modal */}
      {isForgotModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl relative">
            <h2 className="text-base font-bold text-white font-heading">
              Recuperar Senha
            </h2>
            <p className="text-xs text-slate-400 mt-1 mb-4">
              Informe seu e-mail cadastrado para receber o link de redefinição de acesso.
            </p>
            <form onSubmit={handleForgotSubmit} className="space-y-3">
              <div>
                <input
                  type="email"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="seu.email@empresa.com.br"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsForgotModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {forgotLoading && <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  <span>Enviar Link</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-7xl mx-auto px-6 py-4 text-center text-xs text-slate-500">
        NOX4 CFO Digital &bull; Plataforma Corporativa de Gestão e Controladoria Financeira
      </footer>
    </div>
  );
};
