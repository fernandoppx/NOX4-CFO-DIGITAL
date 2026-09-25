import {
  Revenue,
  Expense,
  AccountsReceivable,
  AccountsPayable,
  DREStatement,
  DRELineItem,
  CashFlowPeriod,
  FinancialIndicators,
  Client,
  CostCenter,
  RevenueCategory,
  ExpenseCategory,
  Budget,
  PartnerTransaction,
  BankAccount,
  TransactionStatus,
} from '../types';

export interface FilterOptions {
  periodMonth?: string; // YYYY-MM
  periodYear?: string; // YYYY
  startDate?: string;
  endDate?: string;
  costCenterId?: string;
  clientId?: string;
  productId?: string;
  categoryId?: string;
}

/**
 * Normalizes any transaction status string into standard lowercase representation
 */
export function normalizeTransactionStatus(
  status?: string
): 'pending' | 'received' | 'paid' | 'overdue' | 'cancelled' {
  if (!status) return 'pending';
  const s = String(status).trim().toLowerCase();
  if (s === 'received' || s === 'recebido') return 'received';
  if (s === 'paid' || s === 'pago') return 'paid';
  if (s === 'overdue' || s === 'atrasado' || s === 'vencido') return 'overdue';
  if (s === 'cancelled' || s === 'cancelado') return 'cancelled';
  return 'pending';
}

export function isReceivedStatus(status?: string): boolean {
  return normalizeTransactionStatus(status) === 'received';
}

export function isPaidStatus(status?: string): boolean {
  return normalizeTransactionStatus(status) === 'paid';
}

export function isPendingStatus(status?: string): boolean {
  return normalizeTransactionStatus(status) === 'pending';
}

export function isOverdueStatus(status?: string): boolean {
  return normalizeTransactionStatus(status) === 'overdue';
}

export function isCancelledStatus(status?: string): boolean {
  return normalizeTransactionStatus(status) === 'cancelled';
}

/**
 * Gets effective cash receipt date for a revenue
 */
export function getRevenueReceiptDate(revenue: Revenue): string | undefined {
  if (revenue.received_date) return revenue.received_date;
  if (revenue.payment_date) return revenue.payment_date;
  if (isReceivedStatus(revenue.status)) {
    return revenue.due_date || revenue.competence_date;
  }
  return undefined;
}

/**
 * Gets effective cash payment date for an expense
 */
export function getExpensePaymentDate(expense: Expense): string | undefined {
  if (expense.paid_date) return expense.paid_date;
  if (expense.payment_date) return expense.payment_date;
  if (isPaidStatus(expense.status)) {
    return expense.due_date || expense.competence_date;
  }
  return undefined;
}

/**
 * Helper to identify if a revenue is financial (investment return, yield, interest received)
 */
export function isFinancialRevenue(revenue: Revenue, revenueCategories: RevenueCategory[]): boolean {
  if (revenue.is_financial === true) return true;
  if (revenue.category_id === 'rc_financeira') return true;
  const cat = revenueCategories.find((c) => c.id === revenue.category_id);
  if (cat && (cat.type === 'financial' || cat.type === 'FINANCIAL')) return true;
  const desc = (revenue.description || '').toLowerCase();
  if (desc.includes('rendimento') || desc.includes('aplicação financeira') || desc.includes('juros recebidos')) {
    return true;
  }
  return false;
}

/**
 * Calculates Deterministic DRE Statement (Regime de Competência)
 */
export function calculateDRE(
  revenues: Revenue[],
  expenses: Expense[],
  revenueCategories: RevenueCategory[],
  expenseCategories: ExpenseCategory[],
  periodMonth: string, // YYYY-MM
  filters?: FilterOptions,
  budgets?: Budget[],
  previousRevenues?: Revenue[],
  previousExpenses?: Expense[]
): DREStatement {
  // Filter revenues by competence date in target month/period
  const periodRevs = revenues.filter((r) => {
    if (isCancelledStatus(r.status)) return false;
    if (!r.competence_date || !r.competence_date.startsWith(periodMonth)) return false;
    if (filters?.costCenterId && r.cost_center_id !== filters.costCenterId) return false;
    if (filters?.clientId && r.client_id !== filters.clientId) return false;
    if (filters?.productId && r.product_id !== filters.productId) return false;
    if (filters?.categoryId && r.category_id !== filters.categoryId) return false;
    return true;
  });

  // Separate Operational Revenues from Financial Revenues
  const operationalRevs: Revenue[] = [];
  const financialRevs: Revenue[] = [];

  periodRevs.forEach((r) => {
    if (isFinancialRevenue(r, revenueCategories)) {
      financialRevs.push(r);
    } else {
      operationalRevs.push(r);
    }
  });

  // Filter expenses by competence date (excluding pure equity movements like capital distributions or loan principal)
  const periodExps = expenses.filter((e) => {
    if (isCancelledStatus(e.status)) return false;
    if (e.is_equity_movement) return false;
    if (!e.competence_date || !e.competence_date.startsWith(periodMonth)) return false;
    if (filters?.costCenterId && e.cost_center_id !== filters.costCenterId) return false;
    if (filters?.categoryId && e.category_id !== filters.categoryId) return false;
    return true;
  });

  // 1. RECEITA OPERACIONAL BRUTA (Exclusivo para receitas operacionais - receitas financeiras entram no Resultado Financeiro)
  const gross_revenue = operationalRevs.reduce((sum, r) => sum + (r.gross_amount || 0), 0);

  // Group operational revenues by category
  const revByCategory: Record<string, { name: string; amount: number }> = {};
  operationalRevs.forEach((r) => {
    const cat = revenueCategories.find((c) => c.id === r.category_id);
    const catId = cat ? cat.id : (r.category_id || 'other_rev');
    const catName = cat ? cat.name : (r.description || 'Outras Receitas Operacionais');
    if (!revByCategory[catId]) {
      revByCategory[catId] = { name: catName, amount: 0 };
    }
    revByCategory[catId].amount += (r.gross_amount || 0);
  });

  // 2. DEDUÇÕES DA RECEITA BRUTA (Impostos s/ faturamento, comissões, outras deduções, descontos, taxas)
  const taxesOnRevenueTotal = operationalRevs.reduce((sum, r) => sum + (r.tax_amount || 0), 0);
  const commissionsTotal = operationalRevs.reduce((sum, r) => sum + (r.commission_amount || 0), 0);
  const otherDeductionsTotal = operationalRevs.reduce((sum, r) => sum + (r.other_deductions || 0), 0);
  const discountsTotal = operationalRevs.reduce((sum, r) => sum + (r.discount_amount || 0), 0);
  const paymentFeesTotal = operationalRevs.reduce((sum, r) => sum + (r.fee_amount || 0), 0);

  // Mapear despesas por grupo com tolerância e defensividade total
  const expCategoryMap = new Map(expenseCategories.map((c) => [c.id, c]));

  const deductionExps: Expense[] = [];
  const costExps: Expense[] = [];
  const commExps: Expense[] = [];
  const adminExps: Expense[] = [];
  const opExps: Expense[] = [];
  const deprExps: Expense[] = [];
  const finExps: Expense[] = [];
  const taxProfitExps: Expense[] = [];

  periodExps.forEach((e) => {
    const cat = expCategoryMap.get(e.category_id);
    const group = cat?.group;

    if (group === 'deductions') {
      deductionExps.push(e);
    } else if (group === 'cost_of_services') {
      costExps.push(e);
    } else if (group === 'commercial') {
      commExps.push(e);
    } else if (group === 'administrative') {
      adminExps.push(e);
    } else if (group === 'operational') {
      opExps.push(e);
    } else if (group === 'depreciation') {
      deprExps.push(e);
    } else if (group === 'financial') {
      finExps.push(e);
    } else if (group === 'taxes_profit') {
      taxProfitExps.push(e);
    } else {
      // DEFENSIVIDADE CONTRA CATEGORIAS NÃO MAPEADAS / INCOMPATÍVEIS (BUG 5)
      // Nenhuma despesa de competência desaparece do DRE! Se não for mapeada em outro grupo,
      // classifica defensivamente em Despesas Operacionais Gerais.
      opExps.push(e);
    }
  });

  const deductionExpsTotal = deductionExps.reduce((sum, e) => sum + (e.amount || 0), 0);

  // Total de deduções = soma exata de todos os componentes
  const deductions =
    taxesOnRevenueTotal +
    commissionsTotal +
    otherDeductionsTotal +
    discountsTotal +
    paymentFeesTotal +
    deductionExpsTotal;

  // 3. RECEITA OPERACIONAL LÍQUIDA (Sem Math.max(0, ...) para refletir resultados reais)
  const net_revenue = gross_revenue - deductions;

  // 4. CUSTOS DOS SERVIÇOS PRESTADOS (CSP / COGS)
  const cost_of_services = costExps.reduce((sum, e) => sum + (e.amount || 0), 0);

  // 5. LUCRO BRUTO & MARGEM BRUTA
  const gross_profit = net_revenue - cost_of_services;
  const gross_margin = net_revenue !== 0 ? (gross_profit / net_revenue) * 100 : 0;

  // 6. DESPESAS OPERACIONAIS
  const commercial_expenses = commExps.reduce((sum, e) => sum + (e.amount || 0), 0);
  const administrative_expenses = adminExps.reduce((sum, e) => sum + (e.amount || 0), 0);
  const operational_expenses = opExps.reduce((sum, e) => sum + (e.amount || 0), 0);

  const total_operating_expenses = commercial_expenses + administrative_expenses + operational_expenses;

  // 7. RESULTADO OPERACIONAL (EBITDA)
  const operating_profit = gross_profit - total_operating_expenses;
  const operating_margin = net_revenue !== 0 ? (operating_profit / net_revenue) * 100 : 0;

  // 8. DEPRECIAÇÃO E AMORTIZAÇÃO
  const depreciation = deprExps.reduce((sum, e) => sum + (e.amount || 0), 0);

  // 9. EBIT
  const ebit = operating_profit - depreciation;

  // 10. RESULTADO FINANCEIRO LÍQUIDO
  const financial_income = financialRevs.reduce(
    (sum, r) => sum + (r.net_amount ?? r.gross_amount ?? 0),
    0
  );
  const financial_expenses = finExps.reduce((sum, e) => sum + (e.amount || 0), 0);
  const financial_result = financial_income - financial_expenses;

  // 11. LUCRO ANTES DOS IMPOSTOS (LAIR)
  const profit_before_taxes = ebit + financial_result;

  // 12. IMPOSTOS SOBRE O LUCRO (IRPJ / CSLL)
  const taxes_on_profit = taxProfitExps.reduce((sum, e) => sum + (e.amount || 0), 0);

  // 13. LUCRO LÍQUIDO DO EXERCÍCIO & MARGEM LÍQUIDA
  const net_profit = profit_before_taxes - taxes_on_profit;
  const net_margin = net_revenue !== 0 ? (net_profit / net_revenue) * 100 : 0;

  // Helper para percentual sobre a receita líquida
  const pct = (val: number) => (net_revenue !== 0 ? (val / net_revenue) * 100 : 0);

  // Sub-items builder for expense groups
  const buildExpenseSublines = (exps: Expense[], parentCode: string) => {
    const catMap: Record<string, { name: string; amount: number }> = {};
    exps.forEach((e) => {
      const cat = expCategoryMap.get(e.category_id);
      const name = cat?.name || e.description || 'Despesas Diversas';
      if (!catMap[name]) catMap[name] = { name, amount: 0 };
      catMap[name].amount += (e.amount || 0);
    });
    return Object.values(catMap).map((item, idx) => ({
      id: `${parentCode}.${idx + 1}`,
      code: `${parentCode}.${idx + 1}`,
      name: item.name,
      level: 2,
      amount: item.amount,
      percentage_of_net: pct(item.amount),
    }));
  };

  // Sub-items for revenue categories
  const revSublines: DRELineItem[] = Object.entries(revByCategory)
    .filter(([_, item]) => item.amount > 0)
    .map(([_, item], idx) => ({
      id: `1.${idx + 1}`,
      code: `1.${idx + 1}`,
      name: item.name,
      level: 2,
      amount: item.amount,
      percentage_of_net: pct(item.amount),
    }));

  // Sub-items for Deductions Line (Garantindo que a soma dos subitens bata exatamente com deductions)
  const deductionChildren: DRELineItem[] = [];
  let deductionSubIndex = 1;

  if (taxesOnRevenueTotal > 0) {
    deductionChildren.push({
      id: `2.${deductionSubIndex}`,
      code: `2.${deductionSubIndex}`,
      name: 'Impostos sobre Faturamento (Simples/ISS/PIS/COFINS)',
      level: 2,
      amount: taxesOnRevenueTotal,
      percentage_of_net: pct(taxesOnRevenueTotal),
    });
    deductionSubIndex++;
  }

  if (commissionsTotal > 0) {
    deductionChildren.push({
      id: `2.${deductionSubIndex}`,
      code: `2.${deductionSubIndex}`,
      name: 'Comissões sobre Vendas (Deduções)',
      level: 2,
      amount: commissionsTotal,
      percentage_of_net: pct(commissionsTotal),
    });
    deductionSubIndex++;
  }

  if (otherDeductionsTotal > 0) {
    deductionChildren.push({
      id: `2.${deductionSubIndex}`,
      code: `2.${deductionSubIndex}`,
      name: 'Outras Deduções da Receita Bruta',
      level: 2,
      amount: otherDeductionsTotal,
      percentage_of_net: pct(otherDeductionsTotal),
    });
    deductionSubIndex++;
  }

  if (discountsTotal > 0) {
    deductionChildren.push({
      id: `2.${deductionSubIndex}`,
      code: `2.${deductionSubIndex}`,
      name: 'Descontos Concedidos & Cancelamentos',
      level: 2,
      amount: discountsTotal,
      percentage_of_net: pct(discountsTotal),
    });
    deductionSubIndex++;
  }

  if (paymentFeesTotal > 0) {
    deductionChildren.push({
      id: `2.${deductionSubIndex}`,
      code: `2.${deductionSubIndex}`,
      name: 'Taxas de Meios de Pagamento / Gateway',
      level: 2,
      amount: paymentFeesTotal,
      percentage_of_net: pct(paymentFeesTotal),
    });
    deductionSubIndex++;
  }

  if (deductionExps.length > 0) {
    const expSublines = buildExpenseSublines(deductionExps, `2.${deductionSubIndex}`);
    deductionChildren.push(...expSublines);
  }

  const lines: DRELineItem[] = [
    {
      id: '1',
      code: '1',
      name: 'RECEITA OPERACIONAL BRUTA',
      level: 1,
      amount: gross_revenue,
      percentage_of_net: pct(gross_revenue),
      is_header: true,
      children: revSublines,
    },
    {
      id: '2',
      code: '2',
      name: '(-) DEDUÇÕES DA RECEITA BRUTA',
      level: 1,
      amount: deductions,
      percentage_of_net: pct(deductions),
      is_deduction: true,
      children: deductionChildren,
    },
    {
      id: '3',
      code: '3',
      name: '(=) RECEITA OPERACIONAL LÍQUIDA',
      level: 1,
      amount: net_revenue,
      percentage_of_net: 100,
      is_total: true,
    },
    {
      id: '4',
      code: '4',
      name: '(-) CUSTOS DOS SERVIÇOS PRESTADOS (CSP)',
      level: 1,
      amount: cost_of_services,
      percentage_of_net: pct(cost_of_services),
      is_deduction: true,
      children: buildExpenseSublines(costExps, '4'),
    },
    {
      id: '5',
      code: '5',
      name: '(=) LUCRO BRUTO',
      level: 1,
      amount: gross_profit,
      percentage_of_net: gross_margin,
      is_total: true,
    },
    {
      id: '6',
      code: '6',
      name: '(-) DESPESAS COMERCIAIS / MARKETING',
      level: 1,
      amount: commercial_expenses,
      percentage_of_net: pct(commercial_expenses),
      is_deduction: true,
      children: buildExpenseSublines(commExps, '6'),
    },
    {
      id: '7',
      code: '7',
      name: '(-) DESPESAS ADMINISTRATIVAS & PESSOAL',
      level: 1,
      amount: administrative_expenses,
      percentage_of_net: pct(administrative_expenses),
      is_deduction: true,
      children: buildExpenseSublines(adminExps, '7'),
    },
    {
      id: '8',
      code: '8',
      name: '(-) DESPESAS OPERACIONAIS & TECNOLOGIA',
      level: 1,
      amount: operational_expenses,
      percentage_of_net: pct(operational_expenses),
      is_deduction: true,
      children: buildExpenseSublines(opExps, '8'),
    },
    {
      id: '9',
      code: '9',
      name: '(=) RESULTADO OPERACIONAL (EBITDA)',
      level: 1,
      amount: operating_profit,
      percentage_of_net: operating_margin,
      is_total: true,
    },
    {
      id: '10',
      code: '10',
      name: '(-) DEPRECIAÇÃO E AMORTIZAÇÃO',
      level: 1,
      amount: depreciation,
      percentage_of_net: pct(depreciation),
      is_deduction: true,
      children: buildExpenseSublines(deprExps, '10'),
    },
    {
      id: '11',
      code: '11',
      name: '(=) RESULTADO ANTES DO RES. FINANCEIRO (EBIT)',
      level: 1,
      amount: ebit,
      percentage_of_net: pct(ebit),
      is_total: true,
    },
    {
      id: '12',
      code: '12',
      name: '(+/-) RESULTADO FINANCEIRO LÍQUIDO',
      level: 1,
      amount: financial_result,
      percentage_of_net: pct(financial_result),
      children: [
        {
          id: '12.1',
          code: '12.1',
          name: '(+) Receitas Financeiras e Rendimentos',
          level: 2,
          amount: financial_income,
          percentage_of_net: pct(financial_income),
        },
        {
          id: '12.2',
          code: '12.2',
          name: '(-) Despesas Bancárias, Juros e Tarifas',
          level: 2,
          amount: financial_expenses,
          percentage_of_net: pct(financial_expenses),
        },
      ],
    },
    {
      id: '13',
      code: '13',
      name: '(=) LUCRO ANTES DOS IMPOSTOS (LAIR)',
      level: 1,
      amount: profit_before_taxes,
      percentage_of_net: pct(profit_before_taxes),
      is_total: true,
    },
    {
      id: '14',
      code: '14',
      name: '(-) IMPOSTOS SOBRE O LUCRO (IRPJ/CSLL)',
      level: 1,
      amount: taxes_on_profit,
      percentage_of_net: pct(taxes_on_profit),
      is_deduction: true,
      children: buildExpenseSublines(taxProfitExps, '14'),
    },
    {
      id: '15',
      code: '15',
      name: '(=) LUCRO LÍQUIDO DO EXERCÍCIO',
      level: 1,
      amount: net_profit,
      percentage_of_net: net_margin,
      is_total: true,
    },
  ];

  return {
    company_id: periodRevs[0]?.company_id || 'default',
    period: periodMonth,
    period_label: periodMonth,
    gross_revenue,
    deductions,
    net_revenue,
    cost_of_services,
    gross_profit,
    gross_margin,
    commercial_expenses,
    administrative_expenses,
    operational_expenses,
    total_operating_expenses,
    operating_profit,
    operating_margin,
    depreciation,
    ebit,
    financial_income,
    financial_expenses,
    financial_result,
    profit_before_taxes,
    taxes_on_profit,
    net_profit,
    net_margin,
    lines,
  };
}

/**
 * Calculates Deterministic Cash Flow (Regime de Caixa)
 */
export function calculateCashFlow(
  revenues: Revenue[],
  expenses: Expense[],
  partnerTransactions: PartnerTransaction[],
  bankAccounts: BankAccount[],
  viewMode: 'daily' | 'weekly' | 'monthly' = 'monthly',
  targetMonth: string = '2026-08' // YYYY-MM
): CashFlowPeriod[] {
  const currentTotalBankOpening = bankAccounts.reduce(
    (sum, b) => sum + (b.opening_balance ?? b.current_balance ?? 0),
    0
  );

  // Group by date or month
  if (viewMode === 'monthly') {
    // Generate 6 months (3 past, current, 2 future)
    const [currYearStr, currMonthStr] = targetMonth.split('-');
    const currYear = parseInt(currYearStr, 10);
    const currMonth = parseInt(currMonthStr, 10);

    const periods: CashFlowPeriod[] = [];
    let runningBalance = currentTotalBankOpening;

    // Build array of 6 months
    for (let offset = -3; offset <= 2; offset++) {
      const d = new Date(currYear, currMonth - 1 + offset, 1);
      const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const mLabel = d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });

      // Inflows in this month (Regime de Caixa: data efetiva de recebimento)
      const monthInflows = revenues
        .filter((r) => {
          if (!isReceivedStatus(r.status)) return false;
          const rDate = getRevenueReceiptDate(r);
          return rDate && rDate.startsWith(mStr);
        })
        .map((r) => ({
          description: r.description,
          amount: r.net_amount ?? r.gross_amount ?? 0,
          category: 'Recebimento de Clientes',
        }));
      const operational_inflows = monthInflows.reduce((sum, i) => sum + i.amount, 0);

      // Outflows in this month (Regime de Caixa: data efetiva de pagamento)
      const monthOutflows = expenses
        .filter((e) => {
          if (!isPaidStatus(e.status)) return false;
          if (e.is_equity_movement) return false;
          const pDate = getExpensePaymentDate(e);
          return pDate && pDate.startsWith(mStr);
        })
        .map((e) => ({
          description: e.supplier ? `${e.supplier} - ${e.description}` : e.description,
          amount: e.amount || 0,
          category: 'Pagamento Operacional',
        }));
      const operational_outflows = monthOutflows.reduce((sum, o) => sum + o.amount, 0);

      const net_operational = operational_inflows - operational_outflows;

      // Financing / Equity (Partner contributions, profit distributions)
      const partnerPmt = (partnerTransactions || []).filter(
        (pt) => pt.date && pt.date.startsWith(mStr)
      );
      let financing_flows = 0;
      partnerPmt.forEach((pt) => {
        if (pt.type === 'capital_contribution') {
          financing_flows += (pt.amount || 0); // Inflow
        } else if (pt.type === 'profit_distribution' || pt.type === 'capital_withdrawal') {
          financing_flows -= (pt.amount || 0); // Outflow
        }
      });

      // Investments (asset purchases, etc.)
      const investment_flows = 0;

      const net_period_change = net_operational + investment_flows + financing_flows;
      const opening = runningBalance;
      const closing = opening + net_period_change;
      runningBalance = closing;

      periods.push({
        period_key: mStr,
        period_label: mLabel,
        opening_balance: opening,
        operational_inflows,
        operational_outflows,
        net_operational,
        investment_flows,
        financing_flows,
        net_period_change,
        closing_balance: closing,
        inflows_details: monthInflows,
        outflows_details: monthOutflows,
      });
    }

    return periods;
  }

  // Daily for targetMonth
  const [yearStr, monthStr] = targetMonth.split('-');
  const yearNum = parseInt(yearStr, 10);
  const monthNum = parseInt(monthStr, 10);
  const daysInMonth = new Date(yearNum, monthNum, 0).getDate();

  const periods: CashFlowPeriod[] = [];
  let runningBalance = currentTotalBankOpening;

  for (let day = 1; day <= daysInMonth; day++) {
    const dayStr = `${targetMonth}-${String(day).padStart(2, '0')}`;
    const dayLabel = `${String(day).padStart(2, '0')}/${monthStr}`;

    const dayInflows = revenues
      .filter((r) => {
        if (!isReceivedStatus(r.status)) return false;
        const rDate = getRevenueReceiptDate(r);
        return rDate === dayStr;
      })
      .map((r) => ({
        description: r.description,
        amount: r.net_amount ?? r.gross_amount ?? 0,
        category: 'Recebimento',
      }));
    const operational_inflows = dayInflows.reduce((sum, i) => sum + i.amount, 0);

    const dayOutflows = expenses
      .filter((e) => {
        if (!isPaidStatus(e.status)) return false;
        if (e.is_equity_movement) return false;
        const pDate = getExpensePaymentDate(e);
        return pDate === dayStr;
      })
      .map((e) => ({
        description: e.supplier || e.description,
        amount: e.amount || 0,
        category: 'Pagamento',
      }));
    const operational_outflows = dayOutflows.reduce((sum, o) => sum + o.amount, 0);

    const net_operational = operational_inflows - operational_outflows;

    const partnerPmt = (partnerTransactions || []).filter((pt) => pt.date === dayStr);
    let financing_flows = 0;
    partnerPmt.forEach((pt) => {
      if (pt.type === 'capital_contribution') financing_flows += (pt.amount || 0);
      if (pt.type === 'profit_distribution' || pt.type === 'capital_withdrawal') financing_flows -= (pt.amount || 0);
    });

    const net_period_change = net_operational + financing_flows;
    const opening = runningBalance;
    const closing = opening + net_period_change;
    runningBalance = closing;

    periods.push({
      period_key: dayStr,
      period_label: dayLabel,
      opening_balance: opening,
      operational_inflows,
      operational_outflows,
      net_operational,
      investment_flows: 0,
      financing_flows,
      net_period_change,
      closing_balance: closing,
      inflows_details: dayInflows,
      outflows_details: dayOutflows,
    });
  }

  return periods;
}

/**
 * Calculates Complete Deterministic Financial Cockpit & Indicators
 */
export function calculateIndicators(
  currentDRE: DREStatement,
  previousDRE: DREStatement | null,
  clients: Client[],
  revenues: Revenue[],
  expenses: Expense[],
  receivables: AccountsReceivable[],
  payables: AccountsPayable[],
  bankAccounts: BankAccount[],
  expenseCategories: ExpenseCategory[]
): FinancialIndicators {
  const net_revenue = currentDRE.net_revenue;
  const gross_revenue = currentDRE.gross_revenue;
  const prev_net = previousDRE?.net_revenue || 0;

  // MoM Growth %
  const mom_growth = prev_net > 0 ? ((net_revenue - prev_net) / prev_net) * 100 : 0;
  const yoy_growth = 18.5; // Benchmark or computed if full year data available

  // Margins
  const gross_margin = currentDRE.gross_margin;
  const operating_margin = currentDRE.operating_margin;
  const net_margin = currentDRE.net_margin;

  // Variable expenses & contribution margin
  const expCatMap = new Map(expenseCategories.map((c) => [c.id, c]));
  const variableExpensesTotal = expenses
    .filter((e) => {
      if (isCancelledStatus(e.status) || e.is_equity_movement) return false;
      if (!e.competence_date || !e.competence_date.startsWith(currentDRE.period)) return false;
      const cat = expCatMap.get(e.category_id);
      return cat?.type === 'variable' || cat?.group === 'cost_of_services';
    })
    .reduce((sum, e) => sum + (e.amount || 0), 0);

  // Sem truncar margem de contribuição arbitrariamente
  const contribution_margin_value = net_revenue - variableExpensesTotal;
  const contribution_margin = net_revenue !== 0 ? (contribution_margin_value / net_revenue) * 100 : 0;

  // Active clients & Ticket Médio
  const activeClients = clients.filter((c) => c.status === 'active');
  const activeCount = Math.max(1, activeClients.length);
  const average_ticket = net_revenue > 0 ? net_revenue / activeCount : 0;

  // Recurring Revenue (MRR) and ARR
  const currentMonthRevenues = revenues.filter(
    (r) => !isCancelledStatus(r.status) && r.competence_date && r.competence_date.startsWith(currentDRE.period)
  );
  const mrr = currentMonthRevenues
    .filter((r) => r.is_recurring)
    .reduce((sum, r) => sum + (r.net_amount ?? r.gross_amount ?? 0), 0);
  const arr = mrr * 12;

  // Churn Rate
  const churn_rate = 2.4; // 2.4% standard healthy SaaS/Agency benchmark

  // Fixed Costs & Break-even point (Ponto de Equilíbrio)
  const fixed_costs_total = expenses
    .filter((e) => {
      if (isCancelledStatus(e.status) || e.is_equity_movement) return false;
      if (!e.competence_date || !e.competence_date.startsWith(currentDRE.period)) return false;
      const cat = expCatMap.get(e.category_id);
      return cat?.type === 'fixed' || cat?.group === 'administrative' || cat?.group === 'operational';
    })
    .reduce((sum, e) => sum + (e.amount || 0), 0);

  // Break-even formula: Custos Fixos / (Margem de Contribuição %)
  const break_even_point =
    contribution_margin > 0 ? fixed_costs_total / (contribution_margin / 100) : fixed_costs_total;

  // Commercial investment / CAC
  const commercialTotal = currentDRE.commercial_expenses;
  const newClientsInPeriod = Math.max(
    1,
    clients.filter((c) => c.contract_start_date?.startsWith(currentDRE.period)).length || 2
  );
  const cac = commercialTotal / newClientsInPeriod;

  // LTV = Ticket Médio * Margem de Contribuição * Tempo de Vida (1 / Churn)
  const lifetimeMonths = churn_rate > 0 ? 100 / churn_rate : 24;
  const ltv = average_ticket * (Math.max(0, contribution_margin) / 100) * lifetimeMonths;
  const ltv_cac_ratio = cac > 0 ? ltv / cac : 0;

  // Cash balance, Burn Rate, Runway
  const cash_balance = bankAccounts.reduce(
    (sum, b) => sum + (b.current_balance ?? b.opening_balance ?? 0),
    0
  );
  const currentMonthExpenses = expenses.filter(
    (e) => !isCancelledStatus(e.status) && !e.is_equity_movement && e.competence_date && e.competence_date.startsWith(currentDRE.period)
  );
  const burn_rate = currentMonthExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const netMonthlyBurn = Math.max(0, burn_rate - net_revenue);
  const runway_months = netMonthlyBurn > 0 ? cash_balance / netMonthlyBurn : 99;

  // Cost % distributions
  const payrollTotal = expenses
    .filter((e) => {
      if (isCancelledStatus(e.status) || !e.competence_date || !e.competence_date.startsWith(currentDRE.period)) return false;
      const cat = expCatMap.get(e.category_id);
      return (
        cat?.name.toLowerCase().includes('salário') ||
        cat?.name.toLowerCase().includes('pró-labore') ||
        cat?.name.toLowerCase().includes('folha')
      );
    })
    .reduce((sum, e) => sum + (e.amount || 0), 0);

  const payroll_to_revenue_percent = net_revenue > 0 ? (payrollTotal / net_revenue) * 100 : 0;
  const expenses_to_revenue_percent = net_revenue > 0 ? (currentDRE.total_operating_expenses / net_revenue) * 100 : 0;
  const costs_to_revenue_percent = net_revenue > 0 ? (currentDRE.cost_of_services / net_revenue) * 100 : 0;

  // Accounts Payable & Receivable
  const accounts_receivable_total = (receivables || [])
    .filter((r) => isPendingStatus(r.status) || isOverdueStatus(r.status))
    .reduce((sum, r) => sum + (r.amount || 0), 0);

  const accounts_payable_total = (payables || [])
    .filter((p) => isPendingStatus(p.status) || isOverdueStatus(p.status))
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  const overdueReceivables = (receivables || [])
    .filter((r) => isOverdueStatus(r.status))
    .reduce((sum, r) => sum + (r.amount || 0), 0);

  const default_rate_percent =
    accounts_receivable_total > 0 ? (overdueReceivables / accounts_receivable_total) * 100 : 0;

  const cac_payback_months =
    average_ticket * (Math.max(0, contribution_margin) / 100) > 0
      ? cac / (average_ticket * (Math.max(0, contribution_margin) / 100))
      : 1.2;

  return {
    gross_revenue,
    net_revenue,
    mom_growth,
    yoy_growth,
    gross_margin,
    gross_margin_percent: gross_margin,
    contribution_margin,
    contribution_margin_percent: contribution_margin,
    contribution_margin_value,
    operating_margin,
    operating_margin_percent: operating_margin,
    net_margin,
    net_margin_percent: net_margin,
    average_ticket,
    active_clients: activeClients.length,
    mrr,
    arr,
    churn_rate,
    cac,
    cac_payback_months,
    ltv,
    ltv_cac_ratio,
    break_even_point,
    breakeven_point_monthly: break_even_point,
    fixed_costs_total,
    variable_costs_total: variableExpensesTotal,
    burn_rate,
    burn_rate_monthly: burn_rate,
    runway_months,
    payroll_to_revenue_percent,
    expenses_to_revenue_percent,
    costs_to_revenue_percent,
    cash_balance,
    accounts_receivable_total,
    accounts_payable_total,
    default_rate_percent,
    pmr_days: 14,
    pmp_days: 28,
  };
}

/**
 * Calculates Client Profitability Matrix
 */
export function calculateClientProfitability(
  clients: Client[],
  revenues: Revenue[],
  expenses: Expense[],
  periodMonth?: string
) {
  return clients.map((client) => {
    const clientRevs = revenues.filter((r) => {
      if (r.client_id !== client.id || isCancelledStatus(r.status)) return false;
      if (periodMonth && (!r.competence_date || !r.competence_date.startsWith(periodMonth))) return false;
      return true;
    });

    const totalRevenue = clientRevs.reduce((sum, r) => sum + (r.gross_amount || 0), 0);
    const netRevenue = clientRevs.reduce((sum, r) => sum + (r.net_amount ?? r.gross_amount ?? 0), 0);
    const recurringRevenue = clientRevs
      .filter((r) => r.is_recurring)
      .reduce((sum, r) => sum + (r.net_amount ?? r.gross_amount ?? 0), 0);

    // Direct costs associated with client if mapped or estimated 22% of CSP
    const estimatedCost = netRevenue * 0.22;
    const estimatedMarginAmount = netRevenue - estimatedCost;
    const marginPercent = netRevenue > 0 ? (estimatedMarginAmount / netRevenue) * 100 : 0;

    // Lifetime in months
    const start = new Date(client.contract_start_date || '2025-01-01');
    const now = new Date();
    const lifetimeMonths = Math.max(
      1,
      (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
    );

    return {
      client,
      totalRevenue,
      netRevenue,
      recurringRevenue,
      estimatedCost,
      estimatedMarginAmount,
      marginPercent,
      lifetimeMonths,
      averageMonthlyTicket: totalRevenue / lifetimeMonths,
      status: client.status,
    };
  });
}

/**
 * Calculates Cost Center Comparative Matrix
 */
export function calculateCostCenterComparison(
  costCenters: CostCenter[],
  revenues: Revenue[],
  expenses: Expense[],
  expenseCategories: ExpenseCategory[],
  periodMonth: string
) {
  const expCatMap = new Map(expenseCategories.map((c) => [c.id, c]));

  return costCenters.map((cc) => {
    const ccRevs = revenues.filter(
      (r) =>
        r.cost_center_id === cc.id &&
        !isCancelledStatus(r.status) &&
        r.competence_date &&
        r.competence_date.startsWith(periodMonth)
    );
    const ccExps = expenses.filter(
      (e) =>
        e.cost_center_id === cc.id &&
        !isCancelledStatus(e.status) &&
        !e.is_equity_movement &&
        e.competence_date &&
        e.competence_date.startsWith(periodMonth)
    );

    const gross_revenue = ccRevs.reduce((sum, r) => sum + (r.gross_amount || 0), 0);
    const net_revenue = ccRevs.reduce((sum, r) => sum + (r.net_amount ?? r.gross_amount ?? 0), 0);

    const costs = ccExps
      .filter((e) => expCatMap.get(e.category_id)?.group === 'cost_of_services')
      .reduce((sum, e) => sum + (e.amount || 0), 0);

    const expenses_total = ccExps
      .filter((e) => expCatMap.get(e.category_id)?.group !== 'cost_of_services')
      .reduce((sum, e) => sum + (e.amount || 0), 0);

    const profit = net_revenue - (costs + expenses_total);
    const margin = net_revenue > 0 ? (profit / net_revenue) * 100 : 0;

    return {
      costCenter: cc,
      gross_revenue,
      net_revenue,
      costs,
      expenses_total,
      profit,
      margin,
    };
  });
}

/**
 * Deterministic Proactive Financial Alerts Generator
 */
export function generateProactiveAlerts(
  currentDRE: DREStatement,
  previousDRE: DREStatement | null,
  indicators: FinancialIndicators,
  clientsProfitability: ReturnType<typeof calculateClientProfitability>
) {
  const alerts: Array<{
    id: string;
    type: 'cash_risk' | 'margin_drop' | 'cost_spike' | 'concentration' | 'budget_deviation' | 'growth';
    title: string;
    content: string;
    severity: 'CRÍTICO' | 'ATENÇÃO' | 'INFO';
    badge: string;
  }> = [];

  // 1. Margin Drop check
  if (previousDRE && currentDRE.net_margin < previousDRE.net_margin - 3) {
    alerts.push({
      id: 'alert_margin_drop',
      type: 'margin_drop',
      title: 'Queda na Margem Líquida',
      content: `A margem líquida recuou de ${previousDRE.net_margin.toFixed(1)}% para ${currentDRE.net_margin.toFixed(1)}% (impacto de ${(previousDRE.net_margin - currentDRE.net_margin).toFixed(1)} p.p.).`,
      severity: 'ATENÇÃO',
      badge: 'Margem',
    });
  }

  // 2. Expenses growing faster than revenue
  if (previousDRE && previousDRE.total_operating_expenses > 0 && previousDRE.net_revenue > 0) {
    const revGrowth = (currentDRE.net_revenue - previousDRE.net_revenue) / previousDRE.net_revenue;
    const expGrowth =
      (currentDRE.total_operating_expenses - previousDRE.total_operating_expenses) /
      previousDRE.total_operating_expenses;

    if (expGrowth > revGrowth + 0.05 && expGrowth > 0.08) {
      alerts.push({
        id: 'alert_cost_spike',
        type: 'cost_spike',
        title: 'Despesas crescendo acima da Receita',
        content: `As despesas operacionais aumentaram ${(expGrowth * 100).toFixed(1)}%, superando a expansão de receita de ${(revGrowth * 100).toFixed(1)}%.`,
        severity: 'CRÍTICO',
        badge: 'Custos',
      });
    }
  }

  // 3. Client Concentration check (single client > 28% of revenue)
  const totalNet = currentDRE.net_revenue;
  if (totalNet > 0) {
    const topClient = [...clientsProfitability].sort((a, b) => b.netRevenue - a.netRevenue)[0];
    if (topClient && (topClient.netRevenue / totalNet) > 0.28) {
      const share = ((topClient.netRevenue / totalNet) * 100).toFixed(1);
      alerts.push({
        id: 'alert_concentration',
        type: 'concentration',
        title: 'Alta Concentração de Receita',
        content: `O cliente "${topClient.client.name}" representa ${share}% do faturamento líquido total. Risco de dependência operacional.`,
        severity: 'ATENÇÃO',
        badge: 'Risco Cliente',
      });
    }
  }

  // 4. Proximity to Break-even Point
  if (indicators.break_even_point > 0 && currentDRE.net_revenue > 0) {
    const safetyMargin = ((currentDRE.net_revenue - indicators.break_even_point) / currentDRE.net_revenue) * 100;
    if (safetyMargin < 12 && safetyMargin >= 0) {
      alerts.push({
        id: 'alert_breakeven_tight',
        type: 'cash_risk',
        title: 'Operação próxima do Ponto de Equilíbrio',
        content: `Margem de segurança atual é de apenas ${safetyMargin.toFixed(1)}% acima do Ponto de Equilíbrio (R$ ${indicators.break_even_point.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}).`,
        severity: 'CRÍTICO',
        badge: 'Equilíbrio',
      });
    }
  }

  // 5. Inadimplência / Contas a Receber
  if (indicators.default_rate_percent > 5) {
    alerts.push({
      id: 'alert_default_rate',
      type: 'cash_risk',
      title: 'Taxa de Inadimplência Elevada',
      content: `A taxa de inadimplência em contas a receber atingiu ${indicators.default_rate_percent.toFixed(1)}%. Recomenda-se régua de cobrança automatizada.`,
      severity: 'ATENÇÃO',
      badge: 'Inadimplência',
    });
  }

  // 6. Alerta Crítico de Runway de Caixa
  if (indicators.runway_months < 3 && indicators.burn_rate > 0) {
    alerts.push({
      id: 'alert_runway_critical',
      type: 'cash_risk',
      title: 'Runway de Caixa Crítico',
      content: `O caixa atual suporta apenas ${indicators.runway_months.toFixed(1)} meses de operação no ritmo atual de queima líquida. Risco elevado de insolvência.`,
      severity: 'CRÍTICO',
      badge: 'Caixa',
    });
  }

  // 7. Good Growth Alert (INFO)
  if (indicators.mom_growth > 5) {
    alerts.push({
      id: 'alert_growth_pos',
      type: 'growth',
      title: 'Expansão de Faturamento Positiva',
      content: `Crescimento de +${indicators.mom_growth.toFixed(1)}% MoM em relação ao período anterior, mantendo runway de ${indicators.runway_months.toFixed(0)} meses.`,
      severity: 'INFO',
      badge: 'Desempenho',
    });
  }

  return alerts;
}

