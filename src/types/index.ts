export type AppRole = 'system_admin' | 'owner' | 'finance';

export type OrgRole = 'owner' | 'finance' | 'viewer';

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'cancelled'
  | 'suspended';

export interface Plan {
  id: string;
  name: string;
  description?: string;
  max_organizations: number;
  included_users: number;
  extra_user_price: number;
  price?: number;
  base_price?: number;
  annual_price?: number;
  billing_cycle?: 'monthly' | 'yearly' | string;
  active?: boolean;
  created_at?: string;
}

export interface Subscription {
  id: string;
  organization_id: string;
  plan_id: string;
  status: SubscriptionStatus;
  current_period_end?: string | null;
  created_at?: string;
  plan?: Plan;
}

export type CompanyRole =
  | 'owner'
  | 'finance'
  | 'viewer'
  | 'admin'
  | 'manager'
  | 'financial_analyst';

export interface OrganizationInvitation {
  id: string;
  organization_id: string;
  email: string;
  role: 'finance' | 'viewer' | string;
  name?: string;
  invited_by?: string;
  status: 'pending' | 'accepted' | 'cancelled';
  created_at: string;
  accepted_at?: string | null;
}

export interface OrganizationMember {
  id?: string;
  organization_id: string;
  user_id: string;
  role: 'owner' | 'finance' | 'viewer' | CompanyRole;
  created_at?: string;
  user_email?: string;
  user_name?: string;
}

export interface Company {
  id: string;
  name: string;
  document: string; // CNPJ / CPF
  cnpj?: string;
  segment: string;
  currency?: string;
  created_at: string;
  logo?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: CompanyRole;
  avatar?: string;
  company_id?: string;
  company_ids?: string[];
  status?: 'active' | 'inactive' | 'pending';
  phone?: string;
  created_at: string;
}

export interface Client {
  id: string;
  company_id: string;
  name: string;
  document: string;
  email: string;
  phone: string;
  status: 'active' | 'inactive' | 'ACTIVE' | 'INACTIVE' | 'CHURNED' | 'PROSPECT';
  segment?: string;
  contract_start_date: string;
  contract_value?: number;
  mrr?: number;
  created_at: string;
}

export interface Product {
  id: string;
  company_id: string;
  name: string;
  type: 'service' | 'product' | 'subscription' | 'consulting' | string;
  description: string;
  price: number;
  cost_estimate?: number;
  is_recurring?: boolean;
  active: boolean;
  cost_center_id?: string;
  created_at: string;
}

export interface CostCenter {
  id: string;
  company_id: string;
  name: string;
  type: 'operational' | 'commercial' | 'administrative' | 'shared' | string;
  code: string;
  description?: string;
  active: boolean;
  created_at?: string;
}

export type TransactionStatus =
  | 'pending'
  | 'received'
  | 'paid'
  | 'overdue'
  | 'cancelled';

export interface RevenueCategory {
  id: string;
  company_id: string;
  name: string;
  type: 'services' | 'products' | 'recurring' | 'non_recurring' | 'other_operational' | 'financial' | string;
  active: boolean;
}

export type ExpenseGroup =
  | 'deductions'
  | 'cost_of_services'
  | 'commercial'
  | 'administrative'
  | 'operational'
  | 'depreciation'
  | 'financial'
  | 'taxes_profit'
  | 'equity';

export interface ExpenseCategory {
  id: string;
  company_id: string;
  name: string;
  group: ExpenseGroup;
  type: 'fixed' | 'variable' | string;
  active: boolean;
}

export type CategoryType =
  | 'REVENUE'
  | 'VARIABLE_COST'
  | 'OPERATIONAL_EXPENSE'
  | 'FINANCIAL'
  | 'TAX'
  | string;

export interface Category {
  id: string;
  company_id?: string;
  name: string;
  type: CategoryType;
  code?: string;
  group?: ExpenseGroup | string;
  description?: string;
  active?: boolean;
}

export interface Revenue {
  id: string;
  company_id: string;
  client_id?: string;
  product_id?: string;
  cost_center_id?: string;
  category_id: string;
  description: string;
  /** Regime de Competência (YYYY-MM-DD): Determina a competência contábil na DRE */
  competence_date: string;
  /** Data de Vencimento do Título (YYYY-MM-DD) */
  due_date: string;
  /** Regime de Caixa (YYYY-MM-DD): Data em que o recurso entrou no banco / Fluxo de Caixa */
  received_date?: string;
  /** Campo espelho para compatibilidade legada */
  payment_date?: string;
  gross_amount: number;
  discount_amount?: number;
  tax_amount: number;
  fee_amount?: number;
  commission_amount?: number;
  other_deductions?: number;
  net_amount: number;
  status: TransactionStatus;
  payment_method?: 'pix' | 'boleto' | 'credit_card' | 'wire_transfer' | 'other' | string;
  is_recurring?: boolean;
  is_financial?: boolean;
  notes?: string;
  created_at: string;
}

export interface Expense {
  id: string;
  company_id: string;
  cost_center_id?: string;
  category_id: string;
  supplier: string;
  description: string;
  /** Regime de Competência (YYYY-MM-DD): Determina a competência contábil na DRE */
  competence_date: string;
  /** Data de Vencimento do Título (YYYY-MM-DD) */
  due_date: string;
  /** Regime de Caixa (YYYY-MM-DD): Data em que o recurso saiu do banco / Fluxo de Caixa */
  paid_date?: string;
  /** Campo espelho para compatibilidade legada */
  payment_date?: string;
  amount: number;
  cost_nature?: 'FIXED' | 'VARIABLE' | 'fixed' | 'variable';
  status: TransactionStatus;
  payment_method?: 'pix' | 'boleto' | 'credit_card' | 'wire_transfer' | 'debit' | 'other' | string;
  is_recurring?: boolean;
  is_equity_movement?: boolean; // Se true, movimento patrimonial (sócios/capital), fora do DRE
  notes?: string;
  created_at: string;
}

export interface AccountsReceivable {
  id: string;
  company_id: string;
  client_id?: string;
  revenue_id?: string;
  description: string;
  amount: number;
  due_date: string;
  received_date?: string;
  status: 'pending' | 'received' | 'overdue' | 'cancelled';
}

export interface AccountsPayable {
  id: string;
  company_id: string;
  expense_id?: string;
  supplier: string;
  description: string;
  amount: number;
  due_date: string;
  paid_date?: string;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
}

export interface Partner {
  id: string;
  company_id: string;
  name: string;
  document: string;
  ownership_percentage?: number;
  equity_percentage?: number;
  prolabore_amount?: number;
  role?: string;
  active?: boolean;
  email?: string;
  phone?: string;
  created_at?: string;
}

export interface PartnerTransaction {
  id: string;
  company_id: string;
  partner_id: string;
  type: 'pro_labore' | 'profit_distribution' | 'capital_contribution' | 'capital_withdrawal';
  description: string;
  amount: number;
  date: string;
}

export interface Budget {
  id: string;
  company_id: string;
  name?: string;
  reference_month?: string; // YYYY-MM
  year_month?: string;
  category_id?: string;
  budgeted_amount?: number;
  actual_amount?: number;
  status?: 'draft' | 'active' | 'closed';
  items?: BudgetItem[];
  created_at?: string;
}

export interface BudgetItem {
  id: string;
  budget_id: string;
  category_id: string;
  category_name: string;
  group: ExpenseGroup | 'revenue';
  type: 'revenue' | 'expense';
  planned_amount: number;
  actual_amount?: number;
  variance_amount?: number;
  variance_percent?: number;
}

export interface BankAccount {
  id: string;
  company_id: string;
  name: string;
  bank: string;
  account_type: 'checking' | 'investment' | 'cash';
  account_number: string;
  opening_balance: number;
  initial_balance?: number;
  current_balance: number;
  active: boolean;
}

export interface Transaction {
  id: string;
  company_id: string;
  bank_account_id: string;
  type: 'inflow' | 'outflow' | 'transfer';
  category_id?: string;
  description: string;
  amount: number;
  date: string;
  status: 'cleared' | 'pending';
  is_equity?: boolean;
}

export interface AIInsight {
  id: string;
  company_id: string;
  reference_date: string;
  type: 'cash_risk' | 'margin_drop' | 'cost_spike' | 'concentration' | 'budget_deviation' | 'growth' | 'general';
  title: string;
  content: string;
  severity: 'INFO' | 'ATENÇÃO' | 'CRÍTICO';
  metrics?: Record<string, number | string>;
  created_at: string;
}

// DRE Line Item Representation
export interface DRELineItem {
  id: string;
  code: string;
  name: string;
  level: number;
  amount: number;
  percentage_of_net: number; // % sobre Receita Líquida
  percentage_of_gross?: number; // % sobre Receita Bruta
  is_header?: boolean;
  is_total?: boolean;
  is_deduction?: boolean;
  children?: DRELineItem[];
  previous_amount?: number;
  mom_growth_percent?: number;
  budgeted_amount?: number;
  budget_variance_percent?: number;
}

// Complete DRE Structure
export interface DREStatement {
  company_id: string;
  period: string; // YYYY-MM
  period_label: string;
  gross_revenue: number;
  deductions: number;
  deductions_total?: number;
  net_revenue: number;
  cost_of_services: number;
  gross_profit: number;
  gross_margin: number;
  commercial_expenses: number;
  administrative_expenses: number;
  operational_expenses: number;
  total_operating_expenses: number;
  operating_profit: number; // EBITDA
  operating_margin: number;
  depreciation: number;
  ebit: number;
  financial_income: number;
  financial_expenses: number;
  financial_result: number;
  profit_before_taxes: number;
  taxes_on_profit: number;
  net_profit: number;
  net_margin: number;
  lines: DRELineItem[];
}

// Cash Flow Statement Structure
export interface CashFlowPeriod {
  period_key: string; // YYYY-MM-DD or YYYY-MM or Week
  period_label: string;
  opening_balance: number;
  operational_inflows: number;
  operational_outflows: number;
  net_operational: number;
  investment_flows: number;
  financing_flows: number;
  net_period_change: number;
  closing_balance: number;
  inflows_details: Array<{ description: string; amount: number; category: string }>;
  outflows_details: Array<{ description: string; amount: number; category: string }>;
}

export interface FinancialIndicators {
  gross_revenue: number;
  net_revenue: number;
  mom_growth: number;
  yoy_growth: number;
  gross_margin: number;
  gross_margin_percent?: number;
  contribution_margin: number;
  contribution_margin_percent?: number;
  contribution_margin_value: number;
  operating_margin: number;
  operating_margin_percent?: number;
  net_margin: number;
  net_margin_percent?: number;
  average_ticket: number;
  active_clients: number;
  mrr: number;
  arr: number;
  churn_rate: number;
  cac: number;
  cac_payback_months?: number;
  ltv: number;
  ltv_cac_ratio: number;
  break_even_point: number;
  breakeven_point_monthly?: number;
  fixed_costs_total: number;
  variable_costs_total?: number;
  burn_rate: number;
  burn_rate_monthly?: number;
  runway_months: number;
  payroll_to_revenue_percent: number;
  expenses_to_revenue_percent: number;
  costs_to_revenue_percent: number;
  cash_balance: number;
  accounts_receivable_total: number;
  accounts_payable_total: number;
  default_rate_percent: number;
  pmr_days?: number;
  pmp_days?: number;
}
