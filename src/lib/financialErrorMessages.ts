/**
 * Utilitário central de UX para mensagens de erro e formatação de textos nulos no Módulo Financeiro do NOX4.
 *
 * Garante que nenhuma mensagem técnica de banco (PostgreSQL, Supabase, RLS, SQL, RPC, constraints)
 * ou termos de programação (null, undefined, failed, error) cheguem ao usuário final.
 *
 * Mantém todos os logs técnicos via console.error / console.warn para desenvolvimento.
 */

export type FinancialEntity =
  | 'revenue'
  | 'expense'
  | 'category'
  | 'cost_center'
  | 'costCenter'
  | 'partner'
  | 'supplier'
  | 'client'
  | 'product'
  | 'transaction'
  | 'general';

export type FinancialAction = 'create' | 'update' | 'delete' | 'load' | 'general';

/**
 * Retorna o nome amigável da entidade financeira em português.
 */
export function getFinancialEntityLabel(entity: FinancialEntity, plural = false): string {
  switch (entity) {
    case 'revenue':
      return plural ? 'receitas' : 'receita';
    case 'expense':
      return plural ? 'despesas' : 'despesa';
    case 'category':
      return plural ? 'categorias' : 'categoria';
    case 'cost_center':
    case 'costCenter':
      return plural ? 'centros de custo' : 'centro de resultado';
    case 'partner':
      return plural ? 'sócios e fornecedores' : 'sócio/fornecedor';
    case 'supplier':
      return plural ? 'fornecedores' : 'fornecedor';
    case 'client':
      return plural ? 'clientes' : 'cliente';
    case 'product':
      return plural ? 'produtos e serviços' : 'produto/serviço';
    case 'transaction':
      return plural ? 'lançamentos' : 'lançamento financeiro';
    case 'general':
    default:
      return plural ? 'registros' : 'registro';
  }
}

/**
 * Formata mensagens de erro técnicas do banco, Supabase e JavaScript em mensagens
 * claras, profissionais e humanizadas para o módulo financeiro.
 */
export function formatFinancialErrorMessage(
  err: unknown,
  action: FinancialAction = 'general',
  entity: FinancialEntity = 'general'
): string {
  // Mantém log no console para depuração técnica dos desenvolvedores
  if (err) {
    console.error(`[Módulo Financeiro] Erro detectado na ação "${action}" para a entidade "${entity}":`, err);
  }

  const rawMsg =
    typeof err === 'string'
      ? err
      : err && typeof err === 'object' && 'message' in err
      ? String((err as any).message || '')
      : err && typeof err === 'object' && 'error_description' in err
      ? String((err as any).error_description || '')
      : '';

  const rawCode =
    err && typeof err === 'object' && 'code' in err
      ? String((err as any).code || '')
      : '';

  const lowerMsg = rawMsg.toLowerCase();
  const lowerCode = rawCode.toLowerCase();

  // 1. Permissão Negada e Row-Level Security (RLS)
  if (
    lowerCode === '42501' ||
    lowerMsg.includes('permission denied') ||
    lowerMsg.includes('row-level security') ||
    lowerMsg.includes('violates row-level security') ||
    lowerMsg.includes('not authorized') ||
    lowerMsg.includes('unauthorized') ||
    lowerMsg.includes('insufficient_privilege')
  ) {
    switch (entity) {
      case 'expense':
        return 'Você não possui permissão para alterar despesas.';
      case 'revenue':
        return 'Você não possui permissão para alterar receitas.';
      case 'category':
        return 'Você não possui permissão para alterar categorias.';
      case 'cost_center':
      case 'costCenter':
        return 'Você não possui permissão para alterar centros de custo.';
      case 'partner':
      case 'supplier':
        return 'Você não possui permissão para alterar fornecedores ou sócios.';
      case 'client':
        return 'Você não possui permissão para alterar clientes.';
      case 'product':
        return 'Você não possui permissão para alterar produtos e serviços.';
      case 'transaction':
        return 'Você não possui permissão para alterar lançamentos financeiros.';
      default:
        return 'Você não possui permissão para realizar esta ação no módulo financeiro.';
    }
  }

  // 2. Chave duplicada / Unique constraint
  if (
    lowerCode === '23505' ||
    lowerMsg.includes('duplicate key') ||
    lowerMsg.includes('unique constraint') ||
    lowerMsg.includes('already exists') ||
    lowerMsg.includes('já existe')
  ) {
    switch (entity) {
      case 'client':
        return 'Já existe um cliente cadastrado com este documento ou nome.';
      case 'product':
        return 'Já existe um produto ou serviço cadastrado com este nome.';
      case 'category':
        return 'Já existe uma categoria ou conta DRE com este nome ou código.';
      case 'cost_center':
      case 'costCenter':
        return 'Já existe um centro de resultado com este código ou nome.';
      case 'partner':
      case 'supplier':
        return 'Já existe um sócio ou parceiro cadastrado com estas informações.';
      default:
        return 'Já existe um registro com essas informações.';
    }
  }

  // 3. Restrição de chave estrangeira (Foreign Key) / Registros Vinculados
  if (
    lowerCode === '23503' ||
    lowerMsg.includes('foreign key') ||
    lowerMsg.includes('violates foreign key constraint') ||
    lowerMsg.includes('is still referenced') ||
    lowerMsg.includes('update or delete on table')
  ) {
    const entityLabel = getFinancialEntityLabel(entity);
    return `Não foi possível excluir ${entity === 'expense' || entity === 'revenue' || entity === 'category' ? 'a' : 'o'} ${entityLabel} pois existem registros vinculados a este item.`;
  }

  // 4. Campos obrigatórios / Not-null constraint
  if (
    lowerCode === '23502' ||
    lowerMsg.includes('not-null constraint') ||
    lowerMsg.includes('null value in column') ||
    lowerMsg.includes('violates not-null')
  ) {
    return 'Por favor, preencha todos os campos obrigatórios antes de continuar.';
  }

  // 5. Instabilidade de conexão / Timeout de rede
  if (
    lowerMsg.includes('failed to fetch') ||
    lowerMsg.includes('network error') ||
    lowerMsg.includes('networkrequestfailed') ||
    lowerMsg.includes('timeout') ||
    lowerMsg.includes('econnrefused')
  ) {
    return 'Instabilidade de conexão. Verifique sua internet e tente novamente.';
  }

  // 6. Mensagens explícitas de falha de exclusão (Delete)
  if (action === 'delete' || lowerMsg.includes('failed to delete') || lowerMsg.includes('erro ao excluir')) {
    switch (entity) {
      case 'expense':
        return 'Não foi possível excluir a despesa. Tente novamente.';
      case 'revenue':
        return 'Não foi possível excluir a receita. Tente novamente.';
      case 'category':
        return 'Não foi possível excluir a categoria. Tente novamente.';
      case 'cost_center':
      case 'costCenter':
        return 'Não foi possível excluir o centro de resultado. Tente novamente.';
      case 'partner':
      case 'supplier':
        return 'Não foi possível excluir o parceiro/fornecedor. Tente novamente.';
      case 'client':
        return 'Não foi possível excluir o cliente. Tente novamente.';
      case 'product':
        return 'Não foi possível excluir o produto/serviço. Tente novamente.';
      default:
        return 'Não foi possível excluir o registro. Tente novamente.';
    }
  }

  // 7. Mensagens explícitas de falha ao salvar/criar/editar
  if (
    action === 'create' ||
    action === 'update' ||
    lowerMsg.includes('failed to save') ||
    lowerMsg.includes('failed to create') ||
    lowerMsg.includes('failed to update') ||
    lowerMsg.includes('erro ao salvar')
  ) {
    switch (entity) {
      case 'expense':
        return 'Não foi possível salvar a despesa. Tente novamente.';
      case 'revenue':
        return 'Não foi possível salvar a receita. Tente novamente.';
      case 'category':
        return 'Não foi possível salvar a categoria. Tente novamente.';
      case 'cost_center':
      case 'costCenter':
        return 'Não foi possível salvar o centro de resultado. Tente novamente.';
      case 'partner':
      case 'supplier':
        return 'Não foi possível salvar o parceiro/fornecedor. Tente novamente.';
      case 'client':
        return 'Não foi possível salvar o cliente. Tente novamente.';
      case 'product':
        return 'Não foi possível salvar o produto/serviço. Tente novamente.';
      default:
        return 'Não foi possível salvar as informações. Tente novamente.';
    }
  }

  // 8. Falha de carregamento
  if (action === 'load' || lowerMsg.includes('failed to load') || lowerMsg.includes('erro ao carregar')) {
    const pluralLabel = getFinancialEntityLabel(entity, true);
    return `Não foi possível carregar ${entity === 'revenue' || entity === 'expense' || entity === 'category' ? 'as' : 'os'} ${pluralLabel}. Tente novamente.`;
  }

  // 9. Sanitização geral contra vazamento de termos técnicos (PostgreSQL, Supabase, RPC, SQL, table, column, syntax error)
  const technicalPatterns = [
    'postgres',
    'supabase',
    'sql',
    'rpc',
    'postgrest',
    'column',
    'relation',
    'syntax error',
    'schema',
    'undefined',
    'null',
    'failed',
    'error',
    'exception',
  ];

  const containsTechnicalWord = technicalPatterns.some((w) => lowerMsg.includes(w));
  if (containsTechnicalWord || !rawMsg) {
    const entityLabel = getFinancialEntityLabel(entity);
    return `Não foi possível concluir a operação para ${entity === 'expense' || entity === 'revenue' || entity === 'category' ? 'a' : 'o'} ${entityLabel}. Tente novamente.`;
  }

  // Se for uma mensagem já limpa e amigável em português, retorna ela
  return rawMsg;
}

/**
 * Substitui valores nulos, indefinidos ou literais 'null'/'undefined' por um texto
 * amigável para exibição visual ao usuário.
 */
export function formatNullableText(
  value: string | number | null | undefined,
  fallback = 'Informação não preenchida.'
): string {
  if (value === null || value === undefined) {
    return fallback;
  }

  const str = String(value).trim();
  if (!str || str.toLowerCase() === 'null' || str.toLowerCase() === 'undefined') {
    return fallback;
  }

  return str;
}
