/**
 * Utilitário central de UX para mensagens de erro e feedback no Módulo de Assinatura, Cobrança e Planos (Billing) do NOX4.
 *
 * Garante que nenhum usuário final visualize termos técnicos de banco de dados (PostgreSQL, Supabase, RLS, SQL, RPC, constraints),
 * provedores de pagamento (Asaas, webhooks) ou programação (null, undefined, failed, error, stack traces).
 *
 * Mantém todos os logs técnicos detalhados exclusivamente no console para diagnóstico da equipe técnica.
 */

export type BillingAction =
  | 'checkout'
  | 'payment'
  | 'update_payment_method'
  | 'update_credit_card'
  | 'cancel_subscription'
  | 'reactivate_subscription'
  | 'change_users'
  | 'upgrade'
  | 'downgrade'
  | 'sync'
  | 'load';

/**
 * Formata mensagens de erro técnicas do gateway de pagamento, banco, Supabase, webhooks
 * ou funções serverless em mensagens claras, orientadas à ação e em português para o usuário.
 */
export function formatBillingErrorMessage(
  err: unknown,
  action: BillingAction = 'payment'
): string {
  // Mantém registro técnico no console exclusivamente para depuração dos desenvolvedores
  if (err) {
    console.error(`[Billing/Assinatura] Erro detectado na operação "${action}":`, err);
  }

  const rawMsg =
    typeof err === 'string'
      ? err
      : err && typeof err === 'object' && 'message' in err
      ? String((err as any).message || '')
      : err && typeof err === 'object' && 'error' in err
      ? String((err as any).error || '')
      : err && typeof err === 'object' && 'error_description' in err
      ? String((err as any).error_description || '')
      : '';

  const rawCode =
    err && typeof err === 'object' && 'code' in err
      ? String((err as any).code || '')
      : '';

  const lower = (rawMsg + ' ' + rawCode).toLowerCase();

  // 1. Webhooks e sincronizações de evento
  if (
    lower.includes('webhook') ||
    lower.includes('webhook failed') ||
    lower.includes('event dispatch') ||
    lower.includes('hook error')
  ) {
    return 'Não foi possível atualizar sua assinatura. Nossa equipe será notificada.';
  }

  // 2. Permissão Negada e Row-Level Security (RLS)
  if (
    lower.includes('permission denied') ||
    lower.includes('row-level security') ||
    lower.includes('violates row-level security') ||
    lower.includes('not authorized') ||
    lower.includes('unauthorized') ||
    lower.includes('insufficient_privilege') ||
    rawCode === '42501'
  ) {
    return 'Você não possui permissão para esta ação.';
  }

  // 3. Falhas na geração de cobrança / criação de pagamento
  if (
    lower.includes('payment creation failed') ||
    lower.includes('create payment failed') ||
    lower.includes('failed to create payment') ||
    lower.includes('payment could not be created')
  ) {
    return 'Não foi possível gerar a cobrança. Tente novamente.';
  }

  // 4. Cartão de Crédito e Recusa Bancária
  if (
    lower.includes('card declined') ||
    lower.includes('not authorized') ||
    lower.includes('unauthorized') ||
    lower.includes('recusad') ||
    lower.includes('não autorizad') ||
    lower.includes('cartão não autorizado')
  ) {
    return 'Transação não autorizada pela emissora do cartão. Verifique o limite disponível ou tente outro cartão.';
  }

  if (
    lower.includes('insufficient funds') ||
    lower.includes('saldo insuficiente') ||
    lower.includes('sem limite')
  ) {
    return 'Pagamento não aprovado por limite ou saldo insuficiente. Verifique com seu banco ou tente outro cartão.';
  }

  if (
    lower.includes('expired card') ||
    lower.includes('card expired') ||
    lower.includes('validade expirada') ||
    lower.includes('cartão expirado')
  ) {
    return 'O cartão informado está vencido. Por favor, utilize um cartão válido.';
  }

  if (
    lower.includes('invalid ccv') ||
    lower.includes('invalid cvv') ||
    lower.includes('código de segurança') ||
    lower.includes('cvv inválido')
  ) {
    return 'Código de segurança (CVV) incorreto. Verifique os números no verso do cartão.';
  }

  if (
    lower.includes('invalid card number') ||
    lower.includes('invalid number') ||
    lower.includes('número de cartão inválido')
  ) {
    return 'Número de cartão de crédito inválido. Verifique os dados digitados.';
  }

  // 5. Autenticação e Sessão
  if (
    lower.includes('session') ||
    lower.includes('jwt') ||
    lower.includes('token') ||
    lower.includes('sessão expirada') ||
    lower.includes('expir')
  ) {
    return 'Sua sessão expirou. Por favor, faça login novamente para prosseguir.';
  }

  // 6. Restrições de Chaves / Duplicidades
  if (
    lower.includes('duplicate key') ||
    lower.includes('unique constraint') ||
    rawCode === '23505'
  ) {
    if (action === 'checkout' || action === 'upgrade' || action === 'downgrade') {
      return 'Já existe uma solicitação ou assinatura ativa para esta organização.';
    }
    return 'Esta operação já foi registrada anteriormente.';
  }

  // 7. Erros de RPC / Função / Servidor
  if (
    lower.includes('rpc') ||
    lower.includes('function error') ||
    lower.includes('internal server error') ||
    lower.includes('gateway timeout') ||
    lower.includes('500') ||
    lower.includes('502') ||
    lower.includes('503') ||
    lower.includes('504')
  ) {
    return 'Instabilidade temporária nos serviços de cobrança. Tente novamente em instantes.';
  }

  // 8. Falha de rede / Conexão
  if (
    lower.includes('failed to fetch') ||
    lower.includes('network') ||
    lower.includes('timeout') ||
    lower.includes('conexão') ||
    lower.includes('offline')
  ) {
    return 'Falha de conexão com os serviços de faturamento. Verifique sua internet e tente novamente.';
  }

  // 9. Alteração de quantidade de usuários / Limites
  if (action === 'change_users') {
    if (lower.includes('limit') || lower.includes('exceeded') || lower.includes('máximo')) {
      return 'O limite de membros permitidos pelo seu plano foi atingido. Realize um upgrade para adicionar mais licenças.';
    }
    return 'Não foi possível atualizar a quantidade de membros da organização. Tente novamente.';
  }

  // 10. Upgrade & Downgrade
  if (action === 'upgrade') {
    return 'Não foi possível concluir a alteração de plano. Verifique a forma de pagamento e tente novamente.';
  }

  if (action === 'downgrade') {
    if (lower.includes('users') || lower.includes('members') || lower.includes('membros')) {
      return 'A organização possui mais membros ativos do que o permitido no novo plano. Reduza o número de membros antes de mudar de plano.';
    }
    if (lower.includes('organizations') || lower.includes('empresas')) {
      return 'Você possui mais empresas cadastradas do que o permitido no novo plano. Ajuste suas empresas antes de prosseguir.';
    }
    return 'Não foi possível alterar para o plano selecionado. Tente novamente ou contate o suporte.';
  }

  // 11. Cancelamento e Reativação
  if (action === 'cancel_subscription') {
    return 'Não foi possível processar o cancelamento da assinatura. Tente novamente ou contate o suporte.';
  }

  if (action === 'reactivate_subscription') {
    return 'Não foi possível reativar sua assinatura. Tente novamente ou contate o suporte.';
  }

  // 12. Alteração de Forma de Pagamento
  if (action === 'update_payment_method' || action === 'update_credit_card') {
    return 'Não foi possível atualizar a forma de pagamento. Verifique os dados fornecidos e tente novamente.';
  }

  // 13. Sincronização / Carregamento
  if (action === 'sync' || action === 'load') {
    return 'Não foi possível carregar as informações da sua assinatura. Tente novamente em instantes.';
  }

  // 14. Checkout Geral
  if (action === 'checkout') {
    return 'Não foi possível iniciar a contratação do plano. Tente novamente em alguns instantes.';
  }

  // 15. Mensagem Padrão Amigável (Evita qualquer vazamento de texto técnico)
  if (
    lower.includes('asaas') ||
    lower.includes('supabase') ||
    lower.includes('postgres') ||
    lower.includes('null') ||
    lower.includes('undefined') ||
    lower.includes('failed') ||
    lower.includes('error')
  ) {
    return 'Ocorreu um erro no processamento da sua solicitação. Tente novamente.';
  }

  // Se já for uma mensagem limpa em português sem termos técnicos
  if (rawMsg && rawMsg.length > 5 && !rawMsg.includes(';') && !rawMsg.includes('{') && !rawMsg.includes('}')) {
    return rawMsg;
  }

  return 'Não foi possível concluir a operação de faturamento. Tente novamente.';
}

/**
 * Sanitiza valores nulos ou indefinidos para textos de exibição seguros em tabelas e cards.
 */
export function formatNullableBillingText(
  value: string | number | null | undefined,
  fallback = 'Não informado'
): string {
  if (value === null || value === undefined) {
    return fallback;
  }
  const str = String(value).trim();
  if (str === '' || str.toLowerCase() === 'null' || str.toLowerCase() === 'undefined') {
    return fallback;
  }
  return str;
}
