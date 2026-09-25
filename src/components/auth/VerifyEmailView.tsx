import React, { useState, useEffect, useRef } from 'react';
import {
  Mail,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  RotateCw,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { NoxLogo } from '../brand/NoxLogo';

interface VerifyEmailViewProps {
  email: string;
  onSuccessGoToLogin: () => void;
  onChangeEmail: () => void;
  onClearSessionAndState?: () => Promise<void> | void;
}

export const VerifyEmailView: React.FC<VerifyEmailViewProps> = ({
  email,
  onSuccessGoToLogin,
  onChangeEmail,
  onClearSessionAndState,
}) => {
  const OTP_LENGTH = 8;

const [otpDigits, setOtpDigits] = useState<string[]>(
  Array(OTP_LENGTH).fill('')
);

const [isVerifying, setIsVerifying] = useState<boolean>(false);
const [isResending, setIsResending] = useState<boolean>(false);
const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);
const [errorMessage, setErrorMessage] = useState<string | null>(null);
const [successMessage, setSuccessMessage] = useState<string | null>(null);
const [isConfirmed, setIsConfirmed] = useState<boolean>(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const interval = setInterval(() => {
      setCooldownSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldownSeconds]);

  // Handle single digit input change
  const handleDigitChange = (index: number, value: string) => {
    setErrorMessage(null);
    const cleanValue = value.replace(/\D/g, ''); // keep numbers only or first char
    const newDigits = [...otpDigits];

    if (!cleanValue) {
      newDigits[index] = '';
      setOtpDigits(newDigits);
      return;
    }

    // If pasted or typed multiple digits
    if (cleanValue.length > 1) {
    const chars = cleanValue.slice(0, OTP_LENGTH).split('');      chars.forEach((c, i) => {
      if (index + i < OTP_LENGTH) {
          newDigits[index + i] = c;
        }
      });
      setOtpDigits(newDigits);
const nextIdx = Math.min(index + chars.length, OTP_LENGTH - 1);      inputRefs.current[nextIdx]?.focus();
      return;
    }

    newDigits[index] = cleanValue;
    setOtpDigits(newDigits);

    // Auto advance focus
    if (cleanValue && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // Handle backspace navigation
  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // Handle paste across all boxes
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    const pasted = e.clipboardData
    .getData('text')
     .replace(/\D/g, '')
     .slice(0, OTP_LENGTH);
    if (!pasted) return;

    const newDigits = [...otpDigits];
    pasted.split('').forEach((char, idx) => {
      if (idx < OTP_LENGTH) {
        newDigits[idx] = char;
      }
    });
    setOtpDigits(newDigits);
    const targetIndex = Math.min(pasted.length, OTP_LENGTH - 1);
    inputRefs.current[targetIndex]?.focus();
  };

  // Submit OTP for validation via Supabase Auth
  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const token = otpDigits.join('').trim();
    if (!token) {
      setErrorMessage('Por favor, digite o código de confirmação.');
      return;
    }

   if (token.length !== OTP_LENGTH) {
  setErrorMessage(
    `O código de confirmação deve ter ${OTP_LENGTH} dígitos.`
  );
  return;
  }

    setIsVerifying(true);

    try {
      // Validação estrita via Supabase Auth com type: 'email'
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token,
        type: 'email',
      });

      if (error) {
        const lower = (error.message || '').toLowerCase();
        if (lower.includes('rate limit') || lower.includes('too many requests')) {
          setErrorMessage('Muitas tentativas. Aguarde alguns minutos e tente novamente.');
        } else {
          setErrorMessage('Código inválido ou expirado.');
        }
        setIsVerifying(false);
        return;
      }

      // OTP CORRETO:
      // Executar imediatamente: await supabase.auth.signOut()
      try {
        await supabase.auth.signOut();
      } catch (signOutErr) {
        console.warn('Sessão encerrada pós-confirmação:', signOutErr);
      }

      // Limpar qualquer estado de currentUser, sessão, organizações, activeOrganizationId
      if (onClearSessionAndState) {
        await onClearSessionAndState();
      }

      setIsConfirmed(true);
    } catch (err: any) {
      const lower = (err?.message || '').toLowerCase();
      if (lower.includes('rate limit') || lower.includes('too many requests')) {
        setErrorMessage('Muitas tentativas. Aguarde alguns minutos e tente novamente.');
      } else {
        setErrorMessage('Código inválido ou expirado.');
      }
    } finally {
      setIsVerifying(false);
    }
  };

  // Resend OTP via Supabase Auth
  const handleResendOtp = async () => {
    if (cooldownSeconds > 0 || isResending) return;
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsResending(true);

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
      });

      if (error) {
        const lower = (error.message || '').toLowerCase();
        if (lower.includes('rate limit') || lower.includes('too many requests')) {
          setErrorMessage('Muitas tentativas. Aguarde alguns minutos e tente novamente.');
        } else {
          setErrorMessage('Muitas tentativas. Aguarde alguns minutos e tente novamente.');
        }
        return;
      }

      setSuccessMessage('Novo código enviado.');
      setCooldownSeconds(60);
    } catch (err: any) {
      const lower = (err?.message || '').toLowerCase();
      if (lower.includes('rate limit') || lower.includes('too many requests')) {
        setErrorMessage('Muitas tentativas. Aguarde alguns minutos e tente novamente.');
      } else {
        setErrorMessage('Muitas tentativas. Aguarde alguns minutos e tente novamente.');
      }
    } finally {
      setIsResending(false);
    }
  };

  const handleGoToLogin = () => {
    if (typeof window !== 'undefined' && window.history?.pushState) {
      window.history.pushState(null, '', '/login');
    }
    onSuccessGoToLogin();
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
        <NoxLogo size="sm" layout="horizontal" theme="dark" showSubtitle={true} />
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-300">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
            Verificação segura
          </span>
        </div>
      </header>

      {/* Main Content Card */}
      <main className="relative z-10 w-full max-w-md mx-auto px-4 py-8 flex-1 flex flex-col items-center justify-center">
        <div className="w-full bg-slate-900/90 border border-slate-800/90 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative">
          <div className="absolute top-0 left-8 right-8 h-[2px] bg-gradient-to-r from-transparent via-blue-500 to-transparent" />

          {/* ===================== SUCCESS SCREEN (OTP CORRETO) ===================== */}
          {isConfirmed ? (
            <div className="text-center space-y-6">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400 shadow-lg shadow-emerald-500/10">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div className="space-y-2">
                <h1 className="text-2xl font-bold text-white tracking-tight font-heading">
                  E-mail confirmado com sucesso.
                </h1>
                <p className="text-base text-slate-300 font-medium">
                  Sua conta NOX4 foi criada.
                </p>
                <p className="text-sm text-slate-400 pt-1">
                  Agora faça login com seu e-mail e senha.
                </p>
              </div>

              <div className="pt-4">
                <button
                  id="btn-go-to-login"
                  type="button"
                  onClick={handleGoToLogin}
                  className="w-full py-3.5 px-5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm tracking-wide transition-all shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 group cursor-pointer"
                >
                  <span>IR PARA O LOGIN</span>
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </button>
              </div>
            </div>
          ) : (
            /* ===================== OTP ENTRY SCREEN ===================== */
            <div className="space-y-6">
              {/* Header */}
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto text-blue-400 mb-2">
                  <Mail className="w-6 h-6" />
                </div>
                <h1 className="text-2xl font-black text-white tracking-tight font-heading uppercase">
                  CONFIRME SEU E-MAIL
                </h1>
                <p className="text-xs text-slate-400">
                  Enviamos um código para:
                </p>
                <p className="text-sm font-semibold text-blue-400 font-mono break-all">
                  {email || 'seu.email@empresa.com.br'}
                </p>
              </div>

              {/* Error & Success Messages */}
              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5 text-left">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {successMessage && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2.5 text-left">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{successMessage}</span>
                </div>
              )}

              {/* OTP Input Form */}
              <form onSubmit={handleVerifyOtp} className="space-y-5">
                <div>
                  <label className="block text-center text-xs text-slate-400 mb-2">
                    Digite o código numérico recebido:
                  </label>

              {/* OTP visual layout com 8 dígitos */}                  <div className="flex items-center justify-center gap-2 sm:gap-2.5">
                    {otpDigits.map((digit, idx) => (
                      <input
                        key={idx}
                        ref={(el) => (inputRefs.current[idx] = el)}
                        id={`otp-box-${idx}`}
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleDigitChange(idx, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(idx, e)}
                        onPaste={handlePaste}
                        autoFocus={idx === 0}
                        className="w-10 h-12 sm:w-12 sm:h-14 text-center text-xl font-mono font-bold bg-slate-950 border border-slate-700/80 rounded-xl text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all shadow-inner"
                      />
                    ))}
                  </div>
                </div>

                <button
                  id="btn-verify-otp"
                  type="submit"
                  disabled={
                       isVerifying ||
                      otpDigits.join('').length !== OTP_LENGTH
                  }
                  className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-[0.99] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25 transition-all disabled:opacity-50 cursor-pointer uppercase tracking-wider"
                >
                  {isVerifying ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>CONFIRMAR CÓDIGO</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Resend & Change Email Actions */}
              <div className="pt-2 border-t border-slate-800/80 space-y-4 text-center">
                <div className="flex flex-col sm:flex-row items-center justify-center gap-2 text-xs text-slate-400">
                  <span>Não recebeu o código?</span>
                  <button
                    id="btn-resend-otp"
                    type="button"
                    disabled={cooldownSeconds > 0 || isResending}
                    onClick={handleResendOtp}
                    className="font-bold text-blue-400 hover:text-blue-300 disabled:text-slate-500 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    {isResending ? (
                      <>
                        <RotateCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Enviando...</span>
                      </>
                    ) : cooldownSeconds > 0 ? (
                      <span>Reenviar código em {cooldownSeconds}s</span>
                    ) : (
                      <span>REENVIAR CÓDIGO</span>
                    )}
                  </button>
                </div>

                <div>
                  <button
                    id="btn-change-email"
                    type="button"
                    onClick={onChangeEmail}
                    className="text-xs text-slate-400 hover:text-slate-200 transition-colors cursor-pointer inline-flex items-center gap-1.5 py-1 px-2.5 rounded-lg hover:bg-slate-800/50"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>ALTERAR E-MAIL</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-7xl mx-auto px-6 py-4 text-center text-xs text-slate-500">
        NOX4 CFO • Plataforma de Gestão Financeira e Controladoria
      </footer>
    </div>
  );
};
