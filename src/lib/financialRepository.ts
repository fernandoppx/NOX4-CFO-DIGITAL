/**
 * Camada de acesso aos dados financeiros no Supabase.
 *
 * Tudo que o cliente lança (despesas, plano de contas, centros de resultado,
 * orçamento, contas bancárias, clientes) é gravado no banco, com isolamento
 * por empresa garantido pelas políticas RLS (can_access_org_data).
 * Nada de dado financeiro fica salvo só no navegador.
 */
import { supabase } from './supabase';
import {
  BankAccount,
  Budget,
  Client,
  CostCenter,
  Expense,
  ExpenseCategory,
  ExpenseGroup,
  RevenueCategory,
} from '../types';
import { normalizeTransactionStatus } from './financialEngine';

export interface CompanyFinancialData {
  revenueCategories: RevenueCategory[];
  expenseCategories: ExpenseCategory[];
  costCenters: CostCenter[];
  expenses: Expense[];
  budgets: Budget[];
  bankAccounts: BankAccount[];
}

type Result<T> = { data: T | null; error: string | null };

const isUuid = (v: unknown): v is string =>
  typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

const emptyToNull = <T,>(v: T | '' | undefined | null): T | null =>
  v === '' || v === undefined || v === null ? null : v;

const toNumber = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '0'));
  return isFinite(n) ? n : 0;
};

function errMsg(error: any): string {
  return String(error?.message || error || 'Erro desconhecido ao acessar o banco de dados.');
}

// ---------------------------------------------------------------------------
// Mapeamentos banco -> tipos do app
// ---------------------------------------------------------------------------
export function mapExpenseRow(row: any): Expense {
  return {
    id: row.id,
    company_id: row.company_id,
    cost_center_id: row.cost_center_id || undefined,
    category_id: row.category_id,
    supplier: row.supplier || '',
    description: row.description,
    competence_date: row.competence_date,
    due_date: row.due_date,
    paid_date: row.paid_date || undefined,
    payment_date: row.payment_date || undefined,
    amount: toNumber(row.amount),
    cost_nature: row.cost_nature || undefined,
    status: normalizeTransactionStatus(row.status),
    payment_method: row.payment_method || undefined,
    is_recurring: Boolean(row.is_recurring),
    is_equity_movement: Boolean(row.is_equity_movement),
    notes: row.notes || undefined,
    created_at: row.created_at,
  };
}

function mapBudgetRow(row: any): Budget {
  return {
    id: row.id,
    company_id: row.company_id,
    category_id: row.category_id,
    year_month: row.year_month,
    reference_month: row.year_month,
    budgeted_amount: toNumber(row.budgeted_amount),
    name: row.name || undefined,
    status: row.status || 'active',
    created_at: row.created_at,
  };
}

function mapBankAccountRow(row: any): BankAccount {
  const opening = toNumber(row.opening_balance);
  return {
    id: row.id,
    company_id: row.company_id,
    name: row.name,
    bank: row.bank || '',
    account_type: row.account_type || 'checking',
    account_number: row.account_number || '',
    opening_balance: opening,
    initial_balance: opening,
    current_balance: opening,
    active: row.active !== false,
  };
}

function mapCostCenterRow(row: any): CostCenter {
  return {
    id: row.id,
    company_id: row.company_id,
    name: row.name,
    code: row.code || '',
    type: row.type || 'operational',
    description: row.description || '',
    active: row.active !== false,
    created_at: row.created_at,
  };
}

// ---------------------------------------------------------------------------
// Carga completa da empresa
// ---------------------------------------------------------------------------
export async function loadCompanyFinancialData(companyId: string): Promise<Result<CompanyFinancialData>> {
  if (!companyId) return { data: null, error: 'Empresa não selecionada.' };

  const [rc, ec, cc, ex, bu, ba] = await Promise.all([
    supabase.from('revenue_categories').select('*').eq('company_id', companyId).order('created_at'),
    supabase.from('expense_categories').select('*').eq('company_id', companyId).order('created_at'),
    supabase.from('cost_centers').select('*').eq('company_id', companyId).order('created_at'),
    supabase.from('expenses').select('*').eq('company_id', companyId),
    supabase.from('budgets').select('*').eq('company_id', companyId),
    supabase.from('bank_accounts').select('*').eq('company_id', companyId).order('created_at'),
  ]);

  const firstError = [rc, ec, cc, ex, bu, ba].find((r) => r.error)?.error;
  if (firstError) {
    console.error('Erro ao carregar dados financeiros da empresa:', firstError);
  }

  return {
    data: {
      revenueCategories: ((rc.data as any[]) || []).map((r) => ({
        id: r.id,
        company_id: r.company_id,
        name: r.name,
        type: r.type,
        active: r.active !== false,
      })),
      expenseCategories: ((ec.data as any[]) || []).map((r) => ({
        id: r.id,
        company_id: r.company_id,
        name: r.name,
        group: r.group as ExpenseGroup,
        type: r.type,
        active: r.active !== false,
      })),
      costCenters: ((cc.data as any[]) || []).map(mapCostCenterRow),
      expenses: ((ex.data as any[]) || []).map(mapExpenseRow),
      budgets: ((bu.data as any[]) || []).map(mapBudgetRow),
      bankAccounts: ((ba.data as any[]) || []).map(mapBankAccountRow),
    },
    error: firstError ? errMsg(firstError) : null,
  };
}

// ---------------------------------------------------------------------------
// Despesas
// ---------------------------------------------------------------------------
function expensePayload(exp: Partial<Expense>, companyId: string) {
  const status = normalizeTransactionStatus(exp.status || 'pending');
  const paid = status === 'paid' ? emptyToNull(exp.paid_date || exp.payment_date) : null;
  return {
    company_id: companyId,
    cost_center_id: isUuid(exp.cost_center_id) ? exp.cost_center_id : null,
    category_id: exp.category_id,
    supplier: emptyToNull(exp.supplier?.trim?.() ?? exp.supplier),
    description: exp.description,
    competence_date: exp.competence_date,
    due_date: exp.due_date || exp.competence_date,
    paid_date: paid,
    payment_date: paid,
    amount: toNumber(exp.amount),
    cost_nature: exp.cost_nature ? String(exp.cost_nature).toUpperCase() : null,
    status,
    payment_method: emptyToNull(exp.payment_method),
    is_recurring: Boolean(exp.is_recurring),
    is_equity_movement: Boolean(exp.is_equity_movement),
    notes: emptyToNull(exp.notes),
  };
}

export async function insertExpense(exp: Omit<Expense, 'id' | 'created_at'>, companyId: string): Promise<Result<Expense>> {
  if (!isUuid(exp.category_id)) {
    return { data: null, error: 'Selecione uma categoria de despesa válida do plano de contas.' };
  }
  const { data, error } = await supabase.from('expenses').insert(expensePayload(exp, companyId)).select().single();
  if (error) return { data: null, error: errMsg(error) };
  return { data: mapExpenseRow(data), error: null };
}

export async function updateExpense(exp: Expense, companyId: string): Promise<Result<Expense>> {
  const { data, error } = await supabase
    .from('expenses')
    .update({ ...expensePayload(exp, companyId), updated_at: new Date().toISOString() })
    .eq('id', exp.id)
    .eq('company_id', companyId)
    .select()
    .single();
  if (error) return { data: null, error: errMsg(error) };
  return { data: mapExpenseRow(data), error: null };
}

export async function deleteExpense(id: string, companyId: string): Promise<Result<true>> {
  const { error } = await supabase.from('expenses').delete().eq('id', id).eq('company_id', companyId);
  if (error) return { data: null, error: errMsg(error) };
  return { data: true, error: null };
}

// ---------------------------------------------------------------------------
// Plano de contas
// ---------------------------------------------------------------------------
export async function insertRevenueCategory(
  cat: { name: string; type?: string; active?: boolean },
  companyId: string
): Promise<Result<RevenueCategory>> {
  const { data, error } = await supabase
    .from('revenue_categories')
    .insert({ company_id: companyId, name: cat.name.trim(), type: cat.type || 'services', active: cat.active ?? true })
    .select()
    .single();
  if (error) return { data: null, error: errMsg(error) };
  return { data: { id: data.id, company_id: data.company_id, name: data.name, type: data.type, active: data.active !== false }, error: null };
}

export async function insertExpenseCategory(
  cat: { name: string; group: string; type?: string; active?: boolean },
  companyId: string
): Promise<Result<ExpenseCategory>> {
  const { data, error } = await supabase
    .from('expense_categories')
    .insert({
      company_id: companyId,
      name: cat.name.trim(),
      group: cat.group || 'operational',
      type: cat.type || 'fixed',
      active: cat.active ?? true,
    })
    .select()
    .single();
  if (error) return { data: null, error: errMsg(error) };
  return {
    data: { id: data.id, company_id: data.company_id, name: data.name, group: data.group, type: data.type, active: data.active !== false },
    error: null,
  };
}

export async function updateRevenueCategory(cat: RevenueCategory, companyId: string): Promise<Result<true>> {
  const { error } = await supabase
    .from('revenue_categories')
    .update({ name: cat.name, type: cat.type, active: cat.active, updated_at: new Date().toISOString() })
    .eq('id', cat.id)
    .eq('company_id', companyId);
  return error ? { data: null, error: errMsg(error) } : { data: true, error: null };
}

export async function updateExpenseCategory(cat: ExpenseCategory, companyId: string): Promise<Result<true>> {
  const { error } = await supabase
    .from('expense_categories')
    .update({ name: cat.name, group: cat.group, type: cat.type, active: cat.active, updated_at: new Date().toISOString() })
    .eq('id', cat.id)
    .eq('company_id', companyId);
  return error ? { data: null, error: errMsg(error) } : { data: true, error: null };
}

export async function deleteCategory(
  catId: string,
  kind: 'revenue' | 'expense',
  companyId: string
): Promise<Result<true>> {
  // Não apagar categoria que já tem lançamentos: desativa.
  const table = kind === 'revenue' ? 'revenue_categories' : 'expense_categories';
  const usageTable = kind === 'revenue' ? 'revenues' : 'expenses';
  const { count } = await supabase
    .from(usageTable)
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('category_id', catId);

  if ((count || 0) > 0) {
    const { error } = await supabase.from(table).update({ active: false }).eq('id', catId).eq('company_id', companyId);
    if (error) return { data: null, error: errMsg(error) };
    return { data: true, error: 'Esta conta tem lançamentos e foi desativada em vez de excluída.' };
  }

  const { error } = await supabase.from(table).delete().eq('id', catId).eq('company_id', companyId);
  return error ? { data: null, error: errMsg(error) } : { data: true, error: null };
}

// ---------------------------------------------------------------------------
// Centros de resultado
// ---------------------------------------------------------------------------
export async function insertCostCenter(cc: Omit<CostCenter, 'id'>, companyId: string): Promise<Result<CostCenter>> {
  const { data, error } = await supabase
    .from('cost_centers')
    .insert({
      company_id: companyId,
      name: cc.name.trim(),
      code: emptyToNull(cc.code),
      type: emptyToNull(cc.type),
      description: emptyToNull(cc.description),
      active: cc.active ?? true,
    })
    .select()
    .single();
  if (error) return { data: null, error: errMsg(error) };
  return { data: mapCostCenterRow(data), error: null };
}

export async function updateCostCenter(cc: CostCenter, companyId: string): Promise<Result<CostCenter>> {
  const { data, error } = await supabase
    .from('cost_centers')
    .update({
      name: cc.name,
      code: emptyToNull(cc.code),
      type: emptyToNull(cc.type),
      description: emptyToNull(cc.description),
      active: cc.active,
      updated_at: new Date().toISOString(),
    })
    .eq('id', cc.id)
    .eq('company_id', companyId)
    .select()
    .single();
  if (error) return { data: null, error: errMsg(error) };
  return { data: mapCostCenterRow(data), error: null };
}

export async function deleteCostCenter(id: string, companyId: string): Promise<Result<true>> {
  const { error } = await supabase.from('cost_centers').delete().eq('id', id).eq('company_id', companyId);
  return error ? { data: null, error: errMsg(error) } : { data: true, error: null };
}

// ---------------------------------------------------------------------------
// Clientes
// ---------------------------------------------------------------------------
export async function updateClient(client: Client, companyId: string): Promise<Result<Client>> {
  const { id, created_at, ...rest } = client as any;
  const { data, error } = await supabase
    .from('clients')
    .update({
      name: rest.name,
      document: emptyToNull(rest.document),
      email: emptyToNull(rest.email),
      phone: emptyToNull(rest.phone),
      status: rest.status || 'active',
      segment: emptyToNull(rest.segment),
      contract_start_date: emptyToNull(rest.contract_start_date),
      contract_value: rest.contract_value ?? null,
      mrr: rest.mrr ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('company_id', companyId)
    .select()
    .single();
  if (error) return { data: null, error: errMsg(error) };
  return { data: data as Client, error: null };
}

export async function deleteClient(id: string, companyId: string): Promise<Result<true>> {
  const { error } = await supabase.from('clients').delete().eq('id', id).eq('company_id', companyId);
  return error ? { data: null, error: errMsg(error) } : { data: true, error: null };
}

// ---------------------------------------------------------------------------
// Orçamento
// ---------------------------------------------------------------------------
export async function upsertBudget(budget: Budget, companyId: string): Promise<Result<Budget>> {
  const yearMonth = budget.year_month || budget.reference_month;
  if (!isUuid(budget.category_id) || !yearMonth) {
    return { data: null, error: 'Orçamento inválido: categoria ou mês ausente.' };
  }
  const { data, error } = await supabase
    .from('budgets')
    .upsert(
      {
        company_id: companyId,
        category_id: budget.category_id,
        year_month: yearMonth,
        budgeted_amount: toNumber(budget.budgeted_amount),
        name: emptyToNull(budget.name),
        status: budget.status || 'active',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'company_id,category_id,year_month' }
    )
    .select()
    .single();
  if (error) return { data: null, error: errMsg(error) };
  return { data: mapBudgetRow(data), error: null };
}

// ---------------------------------------------------------------------------
// Contas bancárias
// ---------------------------------------------------------------------------
export async function insertBankAccount(
  acc: { name: string; bank?: string; account_type?: string; account_number?: string; opening_balance: number },
  companyId: string
): Promise<Result<BankAccount>> {
  const { data, error } = await supabase
    .from('bank_accounts')
    .insert({
      company_id: companyId,
      name: acc.name.trim(),
      bank: emptyToNull(acc.bank),
      account_type: acc.account_type || 'checking',
      account_number: emptyToNull(acc.account_number),
      opening_balance: toNumber(acc.opening_balance),
    })
    .select()
    .single();
  if (error) return { data: null, error: errMsg(error) };
  return { data: mapBankAccountRow(data), error: null };
}

export async function updateBankAccount(acc: BankAccount, companyId: string): Promise<Result<BankAccount>> {
  const { data, error } = await supabase
    .from('bank_accounts')
    .update({
      name: acc.name,
      bank: emptyToNull(acc.bank),
      account_type: acc.account_type,
      account_number: emptyToNull(acc.account_number),
      opening_balance: toNumber(acc.opening_balance),
      active: acc.active,
      updated_at: new Date().toISOString(),
    })
    .eq('id', acc.id)
    .eq('company_id', companyId)
    .select()
    .single();
  if (error) return { data: null, error: errMsg(error) };
  return { data: mapBankAccountRow(data), error: null };
}

export async function deleteBankAccount(id: string, companyId: string): Promise<Result<true>> {
  const { error } = await supabase.from('bank_accounts').delete().eq('id', id).eq('company_id', companyId);
  return error ? { data: null, error: errMsg(error) } : { data: true, error: null };
}

// ---------------------------------------------------------------------------
// Migração única dos dados que ficaram salvos só no navegador
// ---------------------------------------------------------------------------
const LEGACY_STORAGE_KEY = 'nox4_financial_clean_db_v3';
const MIGRATION_FLAG_PREFIX = 'nox4_migrated_to_db_v1_';
const migrationsInFlight = new Set<string>();

const normalizeName = (s: string) =>
  (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/**
 * Leva para o banco as despesas, contas do plano de contas, orçamentos e contas
 * bancárias que versões anteriores do sistema gravaram apenas no navegador.
 * Roda uma vez por empresa e por navegador. Retorna quantos itens foram migrados.
 */
export async function migrateLegacyLocalData(
  companyId: string,
  current: CompanyFinancialData
): Promise<{ migrated: number; error: string | null }> {
  if (!companyId || typeof window === 'undefined') return { migrated: 0, error: null };
  // Evita duas migrações simultâneas da mesma empresa (o que duplicaria lançamentos)
  if (migrationsInFlight.has(companyId)) return { migrated: 0, error: null };
  migrationsInFlight.add(companyId);
  try {
    return await runLegacyMigration(companyId, current);
  } finally {
    migrationsInFlight.delete(companyId);
  }
}

async function runLegacyMigration(
  companyId: string,
  current: CompanyFinancialData
): Promise<{ migrated: number; error: string | null }> {
  const flagKey = MIGRATION_FLAG_PREFIX + companyId;
  let legacy: any = null;
  try {
    if (localStorage.getItem(flagKey)) return { migrated: 0, error: null };
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    legacy = raw ? JSON.parse(raw) : null;
  } catch {
    return { migrated: 0, error: null };
  }

  const markDone = () => {
    try {
      localStorage.setItem(flagKey, new Date().toISOString());
    } catch {
      // ignore
    }
  };

  if (!legacy || typeof legacy !== 'object') {
    markDone();
    return { migrated: 0, error: null };
  }

  const byCompany = (arr: any[]) => (Array.isArray(arr) ? arr.filter((x) => x && x.company_id === companyId) : []);
  const legacyExpCats = byCompany(legacy.expenseCategories);
  const legacyRevCats = byCompany(legacy.revenueCategories);
  const legacyExpenses = byCompany(legacy.expenses);
  const legacyBudgets = byCompany(legacy.budgets);
  const legacyBanks = byCompany(legacy.bankAccounts);

  let migrated = 0;
  let lastError: string | null = null;

  // 1. Categorias: casa pelo nome; cria as que não existem.
  const expCatIdMap = new Map<string, string>();
  const dbExpByName = new Map(current.expenseCategories.map((c) => [normalizeName(c.name), c.id]));
  for (const c of legacyExpCats) {
    if (isUuid(c.id) && current.expenseCategories.some((x) => x.id === c.id)) {
      expCatIdMap.set(c.id, c.id);
      continue;
    }
    const existing = dbExpByName.get(normalizeName(c.name));
    if (existing) {
      expCatIdMap.set(c.id, existing);
      continue;
    }
    const res = await insertExpenseCategory({ name: c.name, group: c.group || 'operational', type: c.type }, companyId);
    if (res.data) {
      expCatIdMap.set(c.id, res.data.id);
      dbExpByName.set(normalizeName(c.name), res.data.id);
      migrated++;
    } else if (res.error) lastError = res.error;
  }

  const dbRevByName = new Map(current.revenueCategories.map((c) => [normalizeName(c.name), c.id]));
  for (const c of legacyRevCats) {
    if (isUuid(c.id) && current.revenueCategories.some((x) => x.id === c.id)) continue;
    if (dbRevByName.has(normalizeName(c.name))) continue;
    // Só migra contas criadas pelo usuário (as padrão já existem no banco).
    if (String(c.id).startsWith('rc_')) continue;
    const res = await insertRevenueCategory({ name: c.name, type: c.type }, companyId);
    if (res.data) {
      dbRevByName.set(normalizeName(c.name), res.data.id);
      migrated++;
    } else if (res.error) lastError = res.error;
  }

  // 2. Despesas que ainda não estão no banco.
  const fallbackExpCat =
    current.expenseCategories.find((c) => c.group === 'operational')?.id || current.expenseCategories[0]?.id;
  const ccIds = new Set(current.costCenters.map((c) => c.id));
  for (const e of legacyExpenses) {
    if (isUuid(e.id) && current.expenses.some((x) => x.id === e.id)) continue;
    const catId = expCatIdMap.get(e.category_id) || (isUuid(e.category_id) ? e.category_id : fallbackExpCat);
    if (!catId) continue;
    const res = await insertExpense(
      {
        ...e,
        category_id: catId,
        cost_center_id: ccIds.has(e.cost_center_id) ? e.cost_center_id : undefined,
      },
      companyId
    );
    if (res.data) migrated++;
    else if (res.error) lastError = res.error;
  }

  // 3. Orçamentos.
  for (const b of legacyBudgets) {
    const catId = expCatIdMap.get(b.category_id) || (isUuid(b.category_id) ? b.category_id : null);
    if (!catId) continue;
    const res = await upsertBudget({ ...b, category_id: catId }, companyId);
    if (res.data) migrated++;
    else if (res.error) lastError = res.error;
  }

  // 4. Contas bancárias (só se a empresa ainda não tem nenhuma no banco).
  if (current.bankAccounts.length === 0) {
    for (const b of legacyBanks) {
      const res = await insertBankAccount(
        {
          name: b.name || 'Conta principal',
          bank: b.bank,
          account_type: b.account_type,
          account_number: b.account_number,
          opening_balance: toNumber(b.opening_balance ?? b.initial_balance ?? 0),
        },
        companyId
      );
      if (res.data) migrated++;
      else if (res.error) lastError = res.error;
    }
  }

  if (!lastError) markDone();
  return { migrated, error: lastError };
}

/** Remove do navegador a cópia antiga dos dados financeiros (já migrados). */
export function clearLegacyLocalDataIfFullyMigrated(companyIds: string[]) {
  try {
    if (!companyIds.length) return;
    const allDone = companyIds.every((id) => localStorage.getItem(MIGRATION_FLAG_PREFIX + id));
    if (allDone) localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // ignore
  }
}
