import {
  Company,
  User,
  Client,
  Product,
  CostCenter,
  RevenueCategory,
  ExpenseCategory,
  Revenue,
  Expense,
  AccountsReceivable,
  AccountsPayable,
  Partner,
  PartnerTransaction,
  Budget,
  BankAccount,
  Transaction,
} from '../types';
import { normalizeTransactionStatus } from './financialEngine';

export interface DatabaseState {
  currentCompanyId: string;
  currentUser: User | null;
  users: User[];
  companies: Company[];
  clients: Client[];
  products: Product[];
  costCenters: CostCenter[];
  revenueCategories: RevenueCategory[];
  expenseCategories: ExpenseCategory[];
  revenues: Revenue[];
  expenses: Expense[];
  accountsReceivable: AccountsReceivable[];
  accountsPayable: AccountsPayable[];
  partners: Partner[];
  partnerTransactions: PartnerTransaction[];
  budgets: Budget[];
  bankAccounts: BankAccount[];
  transactions: Transaction[];
}

const STORAGE_KEY = 'nox4_financial_clean_db_v3';

// Default categories available for standard accounting
export const DEFAULT_REV_CATEGORIES: Omit<RevenueCategory, 'id' | 'company_id'>[] = [
  { name: 'Receita de Serviços Prestados', type: 'services', active: true },
  { name: 'Receita Recorrente (Assinatura / MRR)', type: 'recurring', active: true },
  { name: 'Receita de Consultorias / Setup', type: 'non_recurring', active: true },
  { name: 'Receita de Venda de Produtos', type: 'products', active: true },
  { name: 'Outras Receitas Operacionais', type: 'other_operational', active: true },
  { name: 'Receitas Financeiras & Rendimentos', type: 'financial', active: true },
];

export const DEFAULT_EXP_CATEGORIES: Omit<ExpenseCategory, 'id' | 'company_id'>[] = [
  // Deductions
  { name: 'Impostos sobre Faturamento (Simples/ISS)', group: 'deductions', type: 'variable', active: true },
  { name: 'Taxas de Meios de Pagamento & Gateway', group: 'deductions', type: 'variable', active: true },
  { name: 'Descontos Concedidos', group: 'deductions', type: 'variable', active: true },

  // Cost of Services (CSP)
  { name: 'Custos Diretos com Prestadores & Freelancers', group: 'cost_of_services', type: 'variable', active: true },
  { name: 'Softwares & Ferramentas Diretas de Entrega', group: 'cost_of_services', type: 'fixed', active: true },

  // Commercial / CAC
  { name: 'Tráfego Pago (Meta Ads & Google Ads)', group: 'commercial', type: 'variable', active: true },
  { name: 'Comissões Comerciais de Vendas', group: 'commercial', type: 'variable', active: true },
  { name: 'Ferramentas Comerciais & CRM', group: 'commercial', type: 'fixed', active: true },

  // Administrative
  { name: 'Pró-labore dos Sócios', group: 'administrative', type: 'fixed', active: true },
  { name: 'Salários & Encargos Administrativos', group: 'administrative', type: 'fixed', active: true },
  { name: 'Contabilidade & Assessoria Jurídica', group: 'administrative', type: 'fixed', active: true },
  { name: 'Assinaturas & Softwares de Gestão', group: 'administrative', type: 'fixed', active: true },

  // Operational
  { name: 'Servidores em Nuvem & Infraestrutura Tech', group: 'operational', type: 'fixed', active: true },

  // Financial
  { name: 'Tarifas Bancárias & Encargos Financeiros', group: 'financial', type: 'variable', active: true },

  // Depreciation
  { name: 'Depreciação & Amortização', group: 'depreciation', type: 'fixed', active: true },

  // Taxes on profit
  { name: 'IRPJ & CSLL (Impostos sobre Lucro)', group: 'taxes_profit', type: 'variable', active: true },

  // Equity movements
  { name: 'Distribuição de Lucros / Dividendos aos Sócios', group: 'equity', type: 'variable', active: true },
  { name: 'Aporte de Capital Social / Empréstimo de Sócios', group: 'equity', type: 'variable', active: true },
];

/**
 * Generates an empty database state for authenticated real users.
 * STRICT ZERO MOCK DATA: All tables and collections start empty.
 */
export function createEmptyDatabase(companyId: string = '', user: User | null = null): DatabaseState {
  const revCats: RevenueCategory[] = companyId
    ? DEFAULT_REV_CATEGORIES.map((c, i) => ({
        id: `rc_${companyId}_${i}`,
        company_id: companyId,
        name: c.name,
        type: c.type,
        active: c.active,
      }))
    : [];

  const expCats: ExpenseCategory[] = companyId
    ? DEFAULT_EXP_CATEGORIES.map((c, i) => ({
        id: `ec_${companyId}_${i}`,
        company_id: companyId,
        name: c.name,
        group: c.group,
        type: c.type,
        active: c.active,
      }))
    : [];

  return {
    currentCompanyId: companyId,
    currentUser: user,
    users: user ? [user] : [],
    companies: [],
    clients: [],
    products: [],
    costCenters: [],
    revenueCategories: revCats,
    expenseCategories: expCats,
    revenues: [],
    expenses: [],
    accountsReceivable: [],
    accountsPayable: [],
    partners: [],
    partnerTransactions: [],
    budgets: [],
    bankAccounts: [],
    transactions: [],
  };
}

export function migrateDatabaseData(state: DatabaseState): DatabaseState {
  if (!state) return createEmptyDatabase();

  const migratedRevenues: Revenue[] = (state.revenues || []).map((rev) => {
    const normStatus = normalizeTransactionStatus(rev.status);
    const receivedDate =
      rev.received_date ||
      (normStatus === 'received' ? (rev.payment_date || rev.due_date || rev.competence_date) : undefined);

    return {
      ...rev,
      status: normStatus,
      received_date: receivedDate,
    };
  });

  const migratedExpenses: Expense[] = (state.expenses || []).map((exp) => {
    const normStatus = normalizeTransactionStatus(exp.status);
    const paidDate =
      exp.paid_date ||
      (normStatus === 'paid' ? (exp.payment_date || exp.due_date || exp.competence_date) : undefined);

    return {
      ...exp,
      status: normStatus,
      paid_date: paidDate,
    };
  });

  const migratedReceivables: AccountsReceivable[] = (state.accountsReceivable || []).map((ar) => ({
    ...ar,
    status: (normalizeTransactionStatus(ar.status) === 'received'
      ? 'received'
      : normalizeTransactionStatus(ar.status) === 'overdue'
      ? 'overdue'
      : normalizeTransactionStatus(ar.status) === 'cancelled'
      ? 'cancelled'
      : 'pending') as 'pending' | 'received' | 'overdue' | 'cancelled',
  }));

  const migratedPayables: AccountsPayable[] = (state.accountsPayable || []).map((ap) => ({
    ...ap,
    status: (normalizeTransactionStatus(ap.status) === 'paid'
      ? 'paid'
      : normalizeTransactionStatus(ap.status) === 'overdue'
      ? 'overdue'
      : normalizeTransactionStatus(ap.status) === 'cancelled'
      ? 'cancelled'
      : 'pending') as 'pending' | 'paid' | 'overdue' | 'cancelled',
  }));

  return {
    ...state,
    revenues: migratedRevenues,
    expenses: migratedExpenses,
    accountsReceivable: migratedReceivables,
    accountsPayable: migratedPayables,
  };
}

export function loadDatabase(): DatabaseState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object') {
        const migrated = migrateDatabaseData(parsed);
        return migrated;
      }
    }
  } catch (e) {
    console.error('Error loading database from localStorage:', e);
  }
  const initial = createEmptyDatabase();
  saveDatabase(initial);
  return initial;
}

export function saveDatabase(state: DatabaseState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Error saving database to localStorage:', e);
  }
}

export function resetDatabaseToDefault(): DatabaseState {
  const fresh = createEmptyDatabase();
  saveDatabase(fresh);
  return fresh;
}
