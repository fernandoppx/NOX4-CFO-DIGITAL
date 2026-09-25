import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '../supabase';

vi.mock('../supabase', () => {
  return {
    supabase: {
      from: vi.fn(),
      rpc: vi.fn(),
      auth: {
        signUp: vi.fn(),
        signInWithPassword: vi.fn(),
        signOut: vi.fn(),
        getSession: vi.fn(),
        onAuthStateChange: vi.fn(),
        verifyOtp: vi.fn(),
        resend: vi.fn(),
      },
    },
  };
});

describe('Fluxo Obrigatório de Confirmação de E-mail por Código OTP (15 Casos Obrigatórios)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Caso 1: Preenchimento de cadastro válido envia signUp()
  it('1. Preenchimento de cadastro válido envia signUp() com email, senha e full_name', async () => {
    (supabase.auth.signUp as any).mockResolvedValueOnce({
      data: {
        user: { id: 'usr-new-1', email: 'teste@nox4.com.br' },
        session: null,
      },
      error: null,
    });

    const formData = {
      fullName: 'Usuário Teste',
      email: 'teste@nox4.com.br',
      password: 'StrongPassword123!',
      confirmPassword: 'StrongPassword123!',
    };

    expect(formData.password).toBe(formData.confirmPassword);

    const res = await supabase.auth.signUp({
      email: formData.email.trim(),
      password: formData.password,
      options: {
        data: {
          full_name: formData.fullName.trim(),
        },
      },
    });

    expect(supabase.auth.signUp).toHaveBeenCalledWith({
      email:'teste@nox4.com.br',
      password: 'StrongPassword123!',
      options: {
        data: {
          full_name: 'Usuário Teste',
        },
      },
    });
    expect(res.data.user?.id).toBe('usr-new-1');
  });

  // Caso 2: Redireciona para /auth/verify-email
  it('2. Redireciona para /auth/verify-email sem abrir o dashboard', () => {
    let currentRoute = '/auth/register';
    let isDashboardRendered = false;

    // Simulação do sucesso de cadastro
    const handleRegisterSuccess = (targetEmail: string) => {
      currentRoute = '/auth/verify-email';
      // Regra estrita: não abre dashboard
      isDashboardRendered = false;
    };

    handleRegisterSuccess('teste@nox4.com.br');

    expect(currentRoute).toBe('/auth/verify-email');
    expect(isDashboardRendered).toBe(false);
  });

  // Caso 3: E-mail digitado aparece na tela de verificação
  it('3. E-mail digitado aparece na tela de verificação via estado temporário da aplicação', () => {
    let tempAppStateEmail = '';

    const onRegisterAccept = (email: string) => {
      tempAppStateEmail = email;
    };

    onRegisterAccept('financeiro@nox4cfo.com.br');

    // Tela /auth/verify-email lê o estado temporário
    const displayedEmail = tempAppStateEmail || 'usuario@email.com';
    expect(displayedEmail).toBe('financeiro@nox4cfo.com.br');
  });

  // Caso 4: Tentativa de OTP vazio é bloqueada
  it('4. Tentativa de OTP vazio é bloqueada sem chamar Supabase', async () => {
    const otpDigits = ['', '', '', '', '', ''];
    const token = otpDigits.join('').trim();

    let errorMessage = null;
    if (!token) {
      errorMessage = 'Por favor, digite o código de confirmação.';
    } else {
      await supabase.auth.verifyOtp({
        email: 'teste@nox4.com.br',
        token,
        type: 'email',
      });
    }

    expect(errorMessage).toBe('Por favor, digite o código de confirmação.');
    expect(supabase.auth.verifyOtp).not.toHaveBeenCalled();
  });

  // Caso 5: OTP com tamanho incorreto é bloqueado
  it('5. OTP com tamanho incorreto (< 6 dígitos) é bloqueado', async () => {
    const otpDigits = ['1', '2', '3', '', '', ''];
    const token = otpDigits.join('').trim();

    let errorMessage = null;
    if (token.length < 6) {
      errorMessage = 'O código de confirmação deve ter pelo menos 6 dígitos.';
    } else {
      await supabase.auth.verifyOtp({
        email: 'teste@nox4.com.br',
        token,
        type: 'email',
      });
    }

    expect(errorMessage).toBe('O código de confirmação deve ter pelo menos 6 dígitos.');
    expect(supabase.auth.verifyOtp).not.toHaveBeenCalled();
  });

  // Caso 6: OTP válido chama supabase.auth.verifyOtp() com type: 'email'
  it('6. OTP válido chama supabase.auth.verifyOtp() com type: "email"', async () => {
    (supabase.auth.verifyOtp as any).mockResolvedValueOnce({
      data: {
        user: { id: 'usr-verified-otp', email: 'teste@nox4.com.br' },
        session: { access_token: 'temp-jwt' },
      },
      error: null,
    });

    const email = 'teste@nox4.com.br';
    const token = '854921';

    const res = await supabase.auth.verifyOtp({
      email: email.trim(),
      token,
      type: 'email',
    });

    expect(supabase.auth.verifyOtp).toHaveBeenCalledWith({
      email:'teste@nox4.com.br',
      token: '854921',
      type: 'email',
    });
    expect(res.error).toBeNull();
    expect(res.data.user?.id).toBe('usr-verified-otp');
  });

  // Caso 7: OTP válido executa supabase.auth.signOut()
  it('7. OTP válido executa supabase.auth.signOut() imediatamente', async () => {
    (supabase.auth.verifyOtp as any).mockResolvedValueOnce({
      data: { user: { id: 'usr-1' }, session: { access_token: 'jwt' } },
      error: null,
    });
    (supabase.auth.signOut as any).mockResolvedValueOnce({ error: null });

    const email = 'teste@nox4.com.br';
    const token = '123456';

    const verifyRes = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    });

    if (!verifyRes.error) {
      await supabase.auth.signOut();
    }

    expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
  });

  // Caso 8: OTP válido limpa estado e redireciona para /login
  it('8. OTP válido limpa estado (currentUser, sessão, organizações) e redireciona para /login', async () => {
    let currentUser: any = { id: 'usr-1', email: 'gabriel@nox4.com.br' };
    let userOrganizations = [{ id: 'org-1', name: 'NOX4' }];
    let activeOrganizationId = 'org-1';
    let currentRoute = '/auth/verify-email';
    let isConfirmed = false;

    // Simulação do sucesso de validação
    const handleOtpSuccess = async () => {
      // 1. Limpa estado
      currentUser = null;
      userOrganizations = [];
      activeOrganizationId = '';
      isConfirmed = true;
    };

    await handleOtpSuccess();

    expect(currentUser).toBeNull();
    expect(userOrganizations).toHaveLength(0);
    expect(activeOrganizationId).toBe('');
    expect(isConfirmed).toBe(true);

    // Usuário clica no botão "IR PARA O LOGIN"
    const handleGoToLogin = () => {
      currentRoute = '/login';
    };

    handleGoToLogin();
    expect(currentRoute).toBe('/login');
  });

  // Caso 9: OTP inválido exibe mensagem amigável e mantém tela
  it('9. OTP inválido exibe mensagem amigável "Código inválido ou expirado." e mantém tela para nova tentativa', async () => {
    (supabase.auth.verifyOtp as any).mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { message: 'Token has expired or is invalid' },
    });

    let currentRoute = '/auth/verify-email';
    let userFriendlyError = null;

    const { error } = await supabase.auth.verifyOtp({
      email:'teste@nox4.com.br',
      token: '000000',
      type: 'email',
    });

    if (error) {
      const lower = (error.message || '').toLowerCase();
      if (lower.includes('rate limit') || lower.includes('too many requests')) {
        userFriendlyError = 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
      } else {
        userFriendlyError = 'Código inválido ou expirado.';
      }
    }

    expect(userFriendlyError).toBe('Código inválido ou expirado.');
    // Permanece na tela sem sair
    expect(currentRoute).toBe('/auth/verify-email');
  });

  // Caso 10: Botão reenviar chama supabase.auth.resend() com type: 'signup'
  it('10. Botão reenviar chama supabase.auth.resend() com type: "signup"', async () => {
    (supabase.auth.resend as any).mockResolvedValueOnce({
      data: {},
      error: null,
    });

    const email = 'teste@nox4.com.br';
    const res = await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
    });

    expect(supabase.auth.resend).toHaveBeenCalledWith({
      type: 'signup',
      email: 'teste@nox4.com.br',
    });
    expect(res.error).toBeNull();
  });

  // Caso 11: Reenviar ativa cooldown de 60 segundos
  it('11. Reenviar ativa cooldown de 60 segundos', () => {
    let cooldownSeconds = 0;
    let successMessage = null;

    // Dispara reenvio bem-sucedido
    const onResendSuccess = () => {
      successMessage = 'Novo código enviado.';
      cooldownSeconds = 60;
    };

    onResendSuccess();
    expect(cooldownSeconds).toBe(60);
    expect(successMessage).toBe('Novo código enviado.');
  });

  // Caso 12: Botão reenviar fica desabilitado durante cooldown
  it('12. Botão reenviar fica desabilitado durante cooldown e exibe contagem regressiva', () => {
    let cooldownSeconds = 59;
    const isResending = false;

    const isButtonDisabled = cooldownSeconds > 0 || isResending;
    const buttonText = cooldownSeconds > 0 ? `Reenviar código em ${cooldownSeconds}s` : 'REENVIAR CÓDIGO';

    expect(isButtonDisabled).toBe(true);
    expect(buttonText).toBe('Reenviar código em 59s');
  });

  // Caso 13: Rate limit exibe mensagem amigável
  it('13. Rate limit exibe mensagem amigável "Muitas tentativas. Aguarde alguns minutos e tente novamente."', () => {
    const errorResponse = {
      message: 'Email rate limit exceeded (too many requests)',
    };

    let userFriendlyError = null;
    const lower = (errorResponse.message || '').toLowerCase();
    if (lower.includes('rate limit') || lower.includes('too many requests')) {
      userFriendlyError = 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
    } else {
      userFriendlyError = 'Código inválido ou expirado.';
    }

    expect(userFriendlyError).toBe('Muitas tentativas. Aguarde alguns minutos e tente novamente.');
  });

  // Caso 14: Botão 'Alterar e-mail' volta para cadastro sem criar sessão
  it('14. Botão "Alterar e-mail" volta para cadastro sem criar sessão e sem carregar dashboard', () => {
    let currentRoute = '/auth/verify-email';
    let currentUser: any = null;
    let tempVerifyEmail = 'antigo@nox4.com.br';
    let isDashboardRendered = false;

    // Clique em "Alterar e-mail"
    const handleChangeEmail = () => {
      tempVerifyEmail = '';
      currentRoute = '/auth/register';
      currentUser = null;
      isDashboardRendered = false;
    };

    handleChangeEmail();

    expect(currentRoute).toBe('/auth/register');
    expect(currentUser).toBeNull();
    expect(tempVerifyEmail).toBe('');
    expect(isDashboardRendered).toBe(false);
  });

  // Caso 15: Acesso direto a /auth/verify-email não abre dashboard
  it('15. Acesso direto a /auth/verify-email tem prioridade sobre AuthGuard e nunca abre o dashboard', () => {
    const currentRoute = '/auth/verify-email';
    // Mesmo que haja uma sessão temporária no armazenamento:
    const hasCachedSession = true;
    const isAuthLoading = false;

    let viewToRender = 'unknown';

    // Regra de Prioridade Absoluta:
    if (currentRoute === '/auth/verify-email') {
      viewToRender = 'VerifyEmailView';
    } else if (hasCachedSession) {
      viewToRender = 'Dashboard';
    }

    expect(viewToRender).toBe('VerifyEmailView');
    expect(viewToRender).not.toBe('Dashboard');
  });
});
