import { describe, it, expect } from 'vitest';
import {
  calculateDRE,
  calculateCashFlow,
  calculateIndicators,
  calculateClientProfitability,
  calculateCostCenterComparison,
  generateProactiveAlerts,
  normalizeTransactionStatus,
  isReceivedStatus,
  isPaidStatus,
  getRevenueReceiptDate,
  getExpensePaymentDate,
  isFinancialRevenue,
} from '../financialEngine';
import { migrateDatabaseData } from '../mockDatabase';
import {
  Revenue,
  Expense,
  RevenueCategory,
  ExpenseCategory,
  CostCenter,
  Client,
  BankAccount,
} from '../../types';

describe('Financial Engine - NOX4 CFO Calculations & Integrity Suite (20 Scenarios)', () => {
  const mockRevCategories: RevenueCategory[] = [
    { id: 'rc_servicos', company_id: 'comp_1', name: 'Receita de Serviços', type: 'services', active: true },
    { id: 'rc_recorrente', company_id: 'comp_1', name: 'Receita Recorrente', type: 'recurring', active: true },
    { id: 'rc_produtos', company_id: 'comp_1', name: 'Venda de Produtos', type: 'products', active: true },
    { id: 'rc_financeira', company_id: 'comp_1', name: 'Receitas Financeiras & Rendimentos', type: 'financial', active: true },
  ];

  const mockExpCategories: ExpenseCategory[] = [
    { id: 'ec_impostos_fat', company_id: 'comp_1', name: 'Impostos sobre Faturamento', group: 'deductions', type: 'variable', active: true },
    { id: 'ec_csp', company_id: 'comp_1', name: 'Custos Diretos (CSP)', group: 'cost_of_services', type: 'variable', active: true },
    { id: 'ec_comercial', company_id: 'comp_1', name: 'Comercial & Marketing', group: 'commercial', type: 'variable', active: true },
    { id: 'ec_adm', company_id: 'comp_1', name: 'Administrativo & Salários', group: 'administrative', type: 'fixed', active: true },
    { id: 'ec_depreciacao', company_id: 'comp_1', name: 'Depreciação & Amortização', group: 'depreciation', type: 'fixed', active: true },
    { id: 'ec_financeira', company_id: 'comp_1', name: 'Tarifas & Juros Bancários', group: 'financial', type: 'variable', active: true },
    { id: 'ec_irpj_csll', company_id: 'comp_1', name: 'IRPJ & CSLL', group: 'taxes_profit', type: 'variable', active: true },
    { id: 'ec_dividendos', company_id: 'comp_1', name: 'Distribuição de Lucros', group: 'equity', type: 'variable', active: true },
  ];

  const mockCostCenters: CostCenter[] = [
    { id: 'cc_1', company_id: 'comp_1', name: 'Operação', code: 'CC-01', type: 'operational', active: true },
    { id: 'cc_2', company_id: 'comp_1', name: 'Comercial', code: 'CC-02', type: 'commercial', active: true },
  ];

  const mockClients: Client[] = [
    { id: 'cli_1', company_id: 'comp_1', name: 'Cliente Alfa', email: 'alfa@empresa.com', document: '11.111.111/0001-11', phone: '11999998888', contract_start_date: '2026-01-01', status: 'active', created_at: '2026-01-01' },
    { id: 'cli_2', company_id: 'comp_1', name: 'Cliente Beta', email: 'beta@empresa.com', document: '22.222.222/0001-22', phone: '11999997777', contract_start_date: '2026-01-01', status: 'active', created_at: '2026-01-01' },
  ];

  const mockBankAccounts: BankAccount[] = [
    { id: 'bank_1', company_id: 'comp_1', name: 'Itaú Empresas', bank: 'Itaú', account_type: 'checking', account_number: '1234-5', opening_balance: 100000, current_balance: 100000, active: true },
  ];

  // Cenário 1
  it('1. Faturamento Bruto e Deduções Reais (Impostos, Comissões e Deduções Diretas)', () => {
    const revenues: Revenue[] = [
      {
        id: 'r1',
        company_id: 'comp_1',
        description: 'Serviço de Consultoria',
        gross_amount: 100000,
        tax_amount: 6000,
        commission_amount: 4000,
        other_deductions: 1000,
        net_amount: 89000,
        competence_date: '2026-08-10',
        due_date: '2026-08-20',
        category_id: 'rc_servicos',
        cost_center_id: 'cc_1',
        status: 'received',
        created_at: '2026-08-01',
      },
    ];

    const dre = calculateDRE(revenues, [], mockRevCategories, mockExpCategories, '2026-08');

    expect(dre.gross_revenue).toBe(100000);
    expect(dre.deductions).toBe(11000);
    expect(dre.net_revenue).toBe(89000);
  });

  // Cenário 2
  it('2. Lucro Bruto e Margem Bruta com Custos Diretos (CSP)', () => {
    const revenues: Revenue[] = [
      {
        id: 'r1',
        company_id: 'comp_1',
        description: 'Serviço',
        gross_amount: 100000,
        tax_amount: 10000,
        commission_amount: 0,
        other_deductions: 0,
        net_amount: 90000,
        competence_date: '2026-08-01',
        due_date: '2026-08-01',
        category_id: 'rc_servicos',
        cost_center_id: 'cc_1',
        status: 'received',
        created_at: '2026-08-01',
      },
    ];

    const expenses: Expense[] = [
      {
        id: 'e1',
        company_id: 'comp_1',
        supplier: 'AWS Cloud Services',
        description: 'Custos de Terceiros e Servidores de Entrega',
        amount: 30000,
        cost_nature: 'VARIABLE',
        competence_date: '2026-08-05',
        due_date: '2026-08-05',
        category_id: 'ec_csp',
        cost_center_id: 'cc_1',
        status: 'paid',
        created_at: '2026-08-01',
      },
    ];

    const dre = calculateDRE(revenues, expenses, mockRevCategories, mockExpCategories, '2026-08');

    expect(dre.net_revenue).toBe(90000);
    expect(dre.cost_of_services).toBe(30000);
    expect(dre.gross_profit).toBe(60000);
    expect(dre.gross_margin).toBeCloseTo((60000 / 90000) * 100, 2);
  });

  // Cenário 3
  it('3. Margem de Contribuição segregando Custos/Despesas Variáveis de Fixos', () => {
    const revenues: Revenue[] = [
      {
        id: 'r1',
        company_id: 'comp_1',
        description: 'Vendas',
        gross_amount: 100000,
        tax_amount: 10000,
        commission_amount: 0,
        other_deductions: 0,
        net_amount: 90000,
        competence_date: '2026-08-01',
        due_date: '2026-08-01',
        category_id: 'rc_servicos',
        cost_center_id: 'cc_1',
        status: 'received',
        created_at: '2026-08-01',
      },
    ];

    const expenses: Expense[] = [
      {
        id: 'e1',
        company_id: 'comp_1',
        supplier: 'Google Ads',
        description: 'Tráfego Pago Variável',
        amount: 20000,
        cost_nature: 'VARIABLE',
        competence_date: '2026-08-05',
        due_date: '2026-08-05',
        category_id: 'ec_comercial',
        cost_center_id: 'cc_2',
        status: 'paid',
        created_at: '2026-08-01',
      },
      {
        id: 'e2',
        company_id: 'comp_1',
        supplier: 'Imobiliária Central',
        description: 'Aluguel Fixo',
        amount: 15000,
        cost_nature: 'FIXED',
        competence_date: '2026-08-05',
        due_date: '2026-08-05',
        category_id: 'ec_adm',
        cost_center_id: 'cc_1',
        status: 'paid',
        created_at: '2026-08-01',
      },
    ];

    const dre = calculateDRE(revenues, expenses, mockRevCategories, mockExpCategories, '2026-08');
    const indicators = calculateIndicators(dre, null, mockClients, revenues, expenses, [], [], mockBankAccounts, mockExpCategories);

    // Margem de Contribuição = Receita Líquida (90.000) - Custos/Despesas Variáveis (20.000) = 70.000
    expect(indicators.contribution_margin_value).toBe(70000);
    expect(indicators.contribution_margin).toBeCloseTo((70000 / 90000) * 100, 2);
  });

  // Cenário 4
  it('4. EBITDA (LAIDA), EBIT e Resultado Financeiro calculados com precisão', () => {
    const revenues: Revenue[] = [
      {
        id: 'r1',
        company_id: 'comp_1',
        description: 'Assinaturas',
        gross_amount: 100000,
        tax_amount: 0,
        commission_amount: 0,
        other_deductions: 0,
        net_amount: 100000,
        competence_date: '2026-08-01',
        due_date: '2026-08-01',
        category_id: 'rc_servicos',
        cost_center_id: 'cc_1',
        status: 'received',
        created_at: '2026-08-01',
      },
    ];

    const expenses: Expense[] = [
      {
        id: 'e1',
        company_id: 'comp_1',
        supplier: 'Folha de Pagamento',
        description: 'Salários Administrativos',
        amount: 30000,
        cost_nature: 'FIXED',
        competence_date: '2026-08-01',
        due_date: '2026-08-01',
        category_id: 'ec_adm',
        cost_center_id: 'cc_1',
        status: 'paid',
        created_at: '2026-08-01',
      },
      {
        id: 'e2',
        company_id: 'comp_1',
        supplier: 'Contabilidade',
        description: 'Depreciação de Equipamentos',
        amount: 5000,
        cost_nature: 'FIXED',
        competence_date: '2026-08-01',
        due_date: '2026-08-01',
        category_id: 'ec_depreciacao',
        cost_center_id: 'cc_1',
        status: 'paid',
        created_at: '2026-08-01',
      },
      {
        id: 'e3',
        company_id: 'comp_1',
        supplier: 'Banco Itaú',
        description: 'Juros e Encargos Bancários',
        amount: 3000,
        cost_nature: 'VARIABLE',
        competence_date: '2026-08-01',
        due_date: '2026-08-01',
        category_id: 'ec_financeira',
        cost_center_id: 'cc_1',
        status: 'paid',
        created_at: '2026-08-01',
      },
    ];

    const dre = calculateDRE(revenues, expenses, mockRevCategories, mockExpCategories, '2026-08');

    // EBITDA = Receita Líquida (100.000) - Despesas Administrativas (30.000) = 70.000
    expect(dre.operating_profit).toBe(70000);
    // EBIT = EBITDA (70.000) - Depreciação (5.000) = 65.000
    expect(dre.ebit).toBe(65000);
    // Resultado Financeiro = -3.000 -> EBT = 62.000
    expect(dre.financial_result).toBe(-3000);
    expect(dre.profit_before_taxes).toBe(62000);
    expect(dre.net_profit).toBe(62000);
  });

  // Cenário 5
  it('5. Não mascara prejuízos operacionais reais (sem Math.max artificial)', () => {
    const revenues: Revenue[] = [
      {
        id: 'r1',
        company_id: 'comp_1',
        description: 'Serviço',
        gross_amount: 20000,
        tax_amount: 0,
        commission_amount: 0,
        other_deductions: 0,
        net_amount: 20000,
        competence_date: '2026-08-01',
        due_date: '2026-08-01',
        category_id: 'rc_servicos',
        cost_center_id: 'cc_1',
        status: 'received',
        created_at: '2026-08-01',
      },
    ];

    const expenses: Expense[] = [
      {
        id: 'e1',
        company_id: 'comp_1',
        supplier: 'Fornecedores Gerais',
        description: 'Custos Elevados de Estrutura',
        amount: 50000,
        cost_nature: 'FIXED',
        competence_date: '2026-08-01',
        due_date: '2026-08-01',
        category_id: 'ec_adm',
        cost_center_id: 'cc_1',
        status: 'paid',
        created_at: '2026-08-01',
      },
    ];

    const dre = calculateDRE(revenues, expenses, mockRevCategories, mockExpCategories, '2026-08');

    expect(dre.net_profit).toBe(-30000);
    expect(dre.net_margin).toBeCloseTo((-30000 / 20000) * 100, 2);
  });

  // Cenário 6
  it('6. Segregação Patrimonial: Distribuição de lucros aos sócios fora da DRE Operacional', () => {
    const revenues: Revenue[] = [
      {
        id: 'r1',
        company_id: 'comp_1',
        description: 'Serviços',
        gross_amount: 50000,
        tax_amount: 0,
        commission_amount: 0,
        other_deductions: 0,
        net_amount: 50000,
        competence_date: '2026-08-01',
        due_date: '2026-08-01',
        category_id: 'rc_servicos',
        cost_center_id: 'cc_1',
        status: 'received',
        created_at: '2026-08-01',
      },
    ];

    const expenses: Expense[] = [
      {
        id: 'e1',
        company_id: 'comp_1',
        supplier: 'Sócios',
        description: 'Distribuição de Dividendos',
        amount: 25000,
        cost_nature: 'VARIABLE',
        competence_date: '2026-08-01',
        due_date: '2026-08-01',
        category_id: 'ec_dividendos',
        cost_center_id: 'cc_1',
        status: 'paid',
        is_equity_movement: true,
        created_at: '2026-08-01',
      },
    ];

    const dre = calculateDRE(revenues, expenses, mockRevCategories, mockExpCategories, '2026-08');

    // O lucro líquido contábil da DRE não é distorcido pela retirada de dividendos
    expect(dre.net_profit).toBe(50000);
    expect(dre.operating_profit).toBe(50000);
  });

  // Cenário 7
  it('7. DRE por Competência vs Fluxo de Caixa Direto Real', () => {
    const revenues: Revenue[] = [
      // Competência em Agosto, mas vence/recebe em Setembro (Pendente)
      {
        id: 'r1',
        company_id: 'comp_1',
        description: 'Fatura a prazo',
        gross_amount: 60000,
        tax_amount: 0,
        commission_amount: 0,
        other_deductions: 0,
        net_amount: 60000,
        competence_date: '2026-08-15',
        due_date: '2026-09-15',
        category_id: 'rc_servicos',
        cost_center_id: 'cc_1',
        status: 'pending',
        created_at: '2026-08-01',
      },
      // Competência em Julho, mas efetivamente quitado/recebido no dia 2026-08-10
      {
        id: 'r2',
        company_id: 'comp_1',
        description: 'Recebimento de Julho recebido em Agosto',
        gross_amount: 40000,
        tax_amount: 0,
        commission_amount: 0,
        other_deductions: 0,
        net_amount: 40000,
        competence_date: '2026-07-20',
        due_date: '2026-08-10',
        received_date: '2026-08-10',
        payment_date: '2026-08-10',
        category_id: 'rc_servicos',
        cost_center_id: 'cc_1',
        status: 'received',
        created_at: '2026-07-20',
      },
    ];

    // DRE de Agosto considera competência de Agosto (r1 = 60.000)
    const dreAgosto = calculateDRE(revenues, [], mockRevCategories, mockExpCategories, '2026-08');
    expect(dreAgosto.net_revenue).toBe(60000);

    // Fluxo de Caixa do mês 2026-08: verifica as entradas diárias do mês
    const dailyPeriods = calculateCashFlow(revenues, [], [], mockBankAccounts, 'daily', '2026-08');
    const day10 = dailyPeriods.find((p) => p.period_key === '2026-08-10');
    expect(day10?.operational_inflows).toBe(40000);
  });

  // Cenário 8
  it('8. Unit Economics por Cliente', () => {
    const revenues: Revenue[] = [
      {
        id: 'r1',
        company_id: 'comp_1',
        client_id: 'cli_1',
        description: 'Projeto Alfa',
        gross_amount: 50000,
        tax_amount: 3000,
        commission_amount: 2000,
        other_deductions: 0,
        net_amount: 45000,
        competence_date: '2026-08-01',
        due_date: '2026-08-01',
        category_id: 'rc_servicos',
        cost_center_id: 'cc_1',
        status: 'received',
        created_at: '2026-08-01',
      },
    ];

    const clientProfitability = calculateClientProfitability(mockClients, revenues, [], '2026-08');
    const alfa = clientProfitability.find((c) => c.client.id === 'cli_1');

    expect(alfa).toBeDefined();
    expect(alfa?.totalRevenue).toBe(50000);
    expect(alfa?.netRevenue).toBe(45000);
    expect(alfa?.estimatedCost).toBeCloseTo(45000 * 0.22, 2);
    expect(alfa?.estimatedMarginAmount).toBeCloseTo(45000 - 45000 * 0.22, 2);
  });

  // Cenário 9
  it('9. Comparativo por Centro de Resultado', () => {
    const revenues: Revenue[] = [
      {
        id: 'r1',
        company_id: 'comp_1',
        description: 'Receita Operação',
        gross_amount: 80000,
        tax_amount: 0,
        commission_amount: 0,
        other_deductions: 0,
        net_amount: 80000,
        competence_date: '2026-08-01',
        due_date: '2026-08-01',
        category_id: 'rc_servicos',
        cost_center_id: 'cc_1',
        status: 'received',
        created_at: '2026-08-01',
      },
    ];

    const expenses: Expense[] = [
      {
        id: 'e1',
        company_id: 'comp_1',
        supplier: 'Geral',
        description: 'Despesa Operação',
        amount: 30000,
        cost_nature: 'FIXED',
        competence_date: '2026-08-01',
        due_date: '2026-08-01',
        category_id: 'ec_adm',
        cost_center_id: 'cc_1',
        status: 'paid',
        created_at: '2026-08-01',
      },
    ];

    const ccComparison = calculateCostCenterComparison(mockCostCenters, revenues, expenses, mockExpCategories, '2026-08');
    const cc1 = ccComparison.find((c) => c.costCenter.id === 'cc_1');

    expect(cc1).toBeDefined();
    expect(cc1?.gross_revenue).toBe(80000);
    expect(cc1?.net_revenue).toBe(80000);
    expect(cc1?.expenses_total).toBe(30000);
    expect(cc1?.profit).toBe(50000);
    expect(cc1?.margin).toBeCloseTo((50000 / 80000) * 100, 2);
  });

  // Cenário 10
  it('10. Indicadores Financeiros e Alertas Proativos', () => {
    const dre = calculateDRE([], [], mockRevCategories, mockExpCategories, '2026-08');
    const indicators = calculateIndicators(dre, null, mockClients, [], [], [], [], mockBankAccounts, mockExpCategories);
    const clientProfitability = calculateClientProfitability(mockClients, [], []);
    const alerts = generateProactiveAlerts(dre, null, indicators, clientProfitability);

    expect(indicators).toBeDefined();
    expect(Array.isArray(alerts)).toBe(true);
  });

  // Cenário 11: Normalização de Status
  it('11. Normalização de Status de Transações', () => {
    expect(normalizeTransactionStatus('RECEBIDO')).toBe('received');
    expect(normalizeTransactionStatus('pago')).toBe('paid');
    expect(normalizeTransactionStatus('ATRASADO')).toBe('overdue');
    expect(normalizeTransactionStatus('PENDENTE')).toBe('pending');
    expect(normalizeTransactionStatus('RECEIVED')).toBe('received');
    expect(normalizeTransactionStatus('PAID')).toBe('paid');
    expect(normalizeTransactionStatus('OVERDUE')).toBe('overdue');
    expect(normalizeTransactionStatus('CANCELLED')).toBe('cancelled');
    expect(isReceivedStatus('received')).toBe(true);
    expect(isReceivedStatus('RECEIVED')).toBe(true);
    expect(isPaidStatus('paid')).toBe(true);
    expect(isPaidStatus('PAID')).toBe(true);
  });

  // Cenário 12: Extração de Data de Recebimento de Caixa
  it('12. Resolução Correta de Data de Recebimento Efetivo', () => {
    const rev1: Revenue = {
      id: 'r1',
      company_id: 'comp_1',
      description: 'Teste',
      gross_amount: 1000,
      tax_amount: 0,
      net_amount: 1000,
      competence_date: '2026-08-01',
      due_date: '2026-08-10',
      received_date: '2026-08-12',
      category_id: 'rc_servicos',
      status: 'received',
      created_at: '2026-08-01',
    };
    expect(getRevenueReceiptDate(rev1)).toBe('2026-08-12');
  });

  // Cenário 13: Extração de Data de Pagamento Efetivo
  it('13. Resolução Correta de Data de Pagamento Efetivo', () => {
    const exp1: Expense = {
      id: 'e1',
      company_id: 'comp_1',
      supplier: 'Fornecedor',
      description: 'Teste',
      amount: 500,
      competence_date: '2026-08-01',
      due_date: '2026-08-05',
      paid_date: '2026-08-07',
      category_id: 'ec_adm',
      status: 'paid',
      created_at: '2026-08-01',
    };
    expect(getExpensePaymentDate(exp1)).toBe('2026-08-07');
  });

  // Cenário 14: Identificação de Receita Financeira
  it('14. Identificação Precisa de Receitas Financeiras vs Operacionais', () => {
    const revFin: Revenue = {
      id: 'r_fin',
      company_id: 'comp_1',
      description: 'Rendimento de Aplicação Financeira CDB',
      gross_amount: 2500,
      tax_amount: 0,
      net_amount: 2500,
      competence_date: '2026-08-01',
      due_date: '2026-08-01',
      category_id: 'rc_financeira',
      status: 'received',
      created_at: '2026-08-01',
    };
    expect(isFinancialRevenue(revFin, mockRevCategories)).toBe(true);
  });

  // Cenário 15: Ponto de Equilíbrio (Break-even Point)
  it('15. Cálculo do Ponto de Equilíbrio Operacional', () => {
    const revenues: Revenue[] = [
      {
        id: 'r1',
        company_id: 'comp_1',
        description: 'Vendas',
        gross_amount: 100000,
        tax_amount: 0,
        net_amount: 100000,
        competence_date: '2026-08-01',
        due_date: '2026-08-01',
        category_id: 'rc_servicos',
        cost_center_id: 'cc_1',
        status: 'received',
        created_at: '2026-08-01',
      },
    ];

    const expenses: Expense[] = [
      {
        id: 'e1',
        company_id: 'comp_1',
        supplier: 'Marketing',
        description: 'Despesa Variável (50%)',
        amount: 50000,
        cost_nature: 'VARIABLE',
        competence_date: '2026-08-01',
        due_date: '2026-08-01',
        category_id: 'ec_comercial',
        cost_center_id: 'cc_1',
        status: 'paid',
        created_at: '2026-08-01',
      },
      {
        id: 'e2',
        company_id: 'comp_1',
        supplier: 'Aluguel',
        description: 'Custo Fixo (25.000)',
        amount: 25000,
        cost_nature: 'FIXED',
        competence_date: '2026-08-01',
        due_date: '2026-08-01',
        category_id: 'ec_adm',
        cost_center_id: 'cc_1',
        status: 'paid',
        created_at: '2026-08-01',
      },
    ];

    const dre = calculateDRE(revenues, expenses, mockRevCategories, mockExpCategories, '2026-08');
    const indicators = calculateIndicators(dre, null, mockClients, revenues, expenses, [], [], mockBankAccounts, mockExpCategories);

    // Margem de Contribuição = 50%
    // Break-even = 25.000 / 0.50 = 50.000
    expect(indicators.contribution_margin).toBe(50);
    expect(indicators.break_even_point).toBe(50000);
  });

  // Cenário 16: Impostos sobre Lucro (IRPJ & CSLL)
  it('16. Segregação de IRPJ & CSLL no Resultado antes e depois dos impostos', () => {
    const revenues: Revenue[] = [
      {
        id: 'r1',
        company_id: 'comp_1',
        description: 'Serviço',
        gross_amount: 100000,
        tax_amount: 0,
        net_amount: 100000,
        competence_date: '2026-08-01',
        due_date: '2026-08-01',
        category_id: 'rc_servicos',
        cost_center_id: 'cc_1',
        status: 'received',
        created_at: '2026-08-01',
      },
    ];

    const expenses: Expense[] = [
      {
        id: 'e1',
        company_id: 'comp_1',
        supplier: 'Receita Federal',
        description: 'IRPJ e CSLL Apurados',
        amount: 15000,
        cost_nature: 'VARIABLE',
        competence_date: '2026-08-01',
        due_date: '2026-08-01',
        category_id: 'ec_irpj_csll',
        cost_center_id: 'cc_1',
        status: 'paid',
        created_at: '2026-08-01',
      },
    ];

    const dre = calculateDRE(revenues, expenses, mockRevCategories, mockExpCategories, '2026-08');

    expect(dre.profit_before_taxes).toBe(100000);
    expect(dre.taxes_on_profit).toBe(15000);
    expect(dre.net_profit).toBe(85000);
  });

  // Cenário 17: Tratamento de Categorias não cadastradas (Defensividade)
  it('17. Resiliência e Tolerância a Categorias Não Mapeadas', () => {
    const revenues: Revenue[] = [
      {
        id: 'r1',
        company_id: 'comp_1',
        description: 'Receita sem categoria cadastrada',
        gross_amount: 10000,
        tax_amount: 0,
        net_amount: 10000,
        competence_date: '2026-08-01',
        due_date: '2026-08-01',
        category_id: 'cat_inexistente',
        cost_center_id: 'cc_1',
        status: 'received',
        created_at: '2026-08-01',
      },
    ];

    const dre = calculateDRE(revenues, [], mockRevCategories, mockExpCategories, '2026-08');
    expect(dre.gross_revenue).toBe(10000);
    expect(dre.net_revenue).toBe(10000);
  });

  // Cenário 18: Transações Canceladas ignoradas na DRE e Caixa
  it('18. Transações Canceladas São Rigorosamente Desconsideradas', () => {
    const revenues: Revenue[] = [
      {
        id: 'r_canc',
        company_id: 'comp_1',
        description: 'Venda Cancelada',
        gross_amount: 50000,
        tax_amount: 0,
        net_amount: 50000,
        competence_date: '2026-08-01',
        due_date: '2026-08-01',
        category_id: 'rc_servicos',
        cost_center_id: 'cc_1',
        status: 'cancelled',
        created_at: '2026-08-01',
      },
    ];

    const dre = calculateDRE(revenues, [], mockRevCategories, mockExpCategories, '2026-08');
    expect(dre.gross_revenue).toBe(0);
    expect(dre.net_revenue).toBe(0);
  });

  // Cenário 19: Runway e Queima de Caixa em Meses
  it('19. Cálculo de Runway e Saldo em Caixa', () => {
    const revenues: Revenue[] = [
      {
        id: 'r1',
        company_id: 'comp_1',
        description: 'Receita',
        gross_amount: 10000,
        tax_amount: 0,
        net_amount: 10000,
        competence_date: '2026-08-01',
        due_date: '2026-08-01',
        category_id: 'rc_servicos',
        cost_center_id: 'cc_1',
        status: 'received',
        created_at: '2026-08-01',
      },
    ];

    const expenses: Expense[] = [
      {
        id: 'e1',
        company_id: 'comp_1',
        supplier: 'Geral',
        description: 'Despesa Geral',
        amount: 30000,
        cost_nature: 'FIXED',
        competence_date: '2026-08-01',
        due_date: '2026-08-01',
        category_id: 'ec_adm',
        cost_center_id: 'cc_1',
        status: 'paid',
        created_at: '2026-08-01',
      },
    ];

    const dre = calculateDRE(revenues, expenses, mockRevCategories, mockExpCategories, '2026-08');
    // Saldo em caixa: 100.000. Despesas: 30.000. Receita: 10.000. Queima líquida: 20.000/mês. Runway = 100.000 / 20.000 = 5 meses
    const indicators = calculateIndicators(dre, null, mockClients, revenues, expenses, [], [], mockBankAccounts, mockExpCategories);

    expect(indicators.cash_balance).toBe(100000);
    expect(indicators.burn_rate).toBe(30000);
    expect(indicators.runway_months).toBe(5);
  });

  // Cenário 20: Alertas de Risco de Caixa quando runway é curto
  it('20. Alertas Automáticos quando há Risco de Caixa', () => {
    const lowBankAccounts: BankAccount[] = [
      { id: 'bank_low', company_id: 'comp_1', name: 'Caixa Baixo', bank: 'Itaú', account_type: 'checking', account_number: '1', opening_balance: 10000, current_balance: 10000, active: true },
    ];

    const revenues: Revenue[] = [];
    const expenses: Expense[] = [
      {
        id: 'e1',
        company_id: 'comp_1',
        supplier: 'RH',
        description: 'Salários',
        amount: 20000,
        cost_nature: 'FIXED',
        competence_date: '2026-08-01',
        due_date: '2026-08-01',
        category_id: 'ec_adm',
        cost_center_id: 'cc_1',
        status: 'paid',
        created_at: '2026-08-01',
      },
    ];

    const dre = calculateDRE(revenues, expenses, mockRevCategories, mockExpCategories, '2026-08');
    const indicators = calculateIndicators(dre, null, mockClients, revenues, expenses, [], [], lowBankAccounts, mockExpCategories);
    const clientProfitability = calculateClientProfitability(mockClients, revenues, expenses);
    const alerts = generateProactiveAlerts(dre, null, indicators, clientProfitability);

    const cashAlert = alerts.find((a) => a.type === 'cash_risk');
    expect(cashAlert).toBeDefined();
    expect(cashAlert?.severity).toBe('CRÍTICO');
  });

  // Suíte adicional: Migração de dados e normalização de status legados
  describe('Data Migration & Legacy Normalization Suite', () => {
    it('migrates legacy uppercase statuses and missing settlement dates properly', () => {
      const legacyState: any = {
        currentCompanyId: 'comp_1',
        revenues: [
          {
            id: 'r_legacy_1',
            description: 'Legacy Revenue',
            gross_amount: 1000,
            net_amount: 1000,
            status: 'RECEIVED',
            payment_date: '2026-08-05',
          },
          {
            id: 'r_legacy_2',
            description: 'Legacy Pending',
            gross_amount: 500,
            net_amount: 500,
            status: 'PENDING',
          },
        ],
        expenses: [
          {
            id: 'e_legacy_1',
            description: 'Legacy Expense',
            amount: 300,
            status: 'PAID',
            payment_date: '2026-08-06',
          },
          {
            id: 'e_legacy_2',
            description: 'Legacy Overdue',
            amount: 200,
            status: 'OVERDUE',
          },
        ],
        accountsReceivable: [
          { id: 'ar_1', status: 'RECEIVED' },
        ],
        accountsPayable: [
          { id: 'ap_1', status: 'PAID' },
        ],
      };

      const migrated = migrateDatabaseData(legacyState);

      expect(migrated.revenues[0].status).toBe('received');
      expect(migrated.revenues[0].received_date).toBe('2026-08-05');
      expect(migrated.revenues[1].status).toBe('pending');

      expect(migrated.expenses[0].status).toBe('paid');
      expect(migrated.expenses[0].paid_date).toBe('2026-08-06');
      expect(migrated.expenses[1].status).toBe('overdue');

      expect(migrated.accountsReceivable[0].status).toBe('received');
      expect(migrated.accountsPayable[0].status).toBe('paid');
    });

    it('calculates cash flow accurately with normalized lowercase statuses', () => {
      const revenues: Revenue[] = [
        {
          id: 'r_norm_1',
          company_id: 'comp_1',
          description: 'Recebimento de Agosto',
          gross_amount: 15000,
          tax_amount: 0,
          net_amount: 15000,
          competence_date: '2026-08-01',
          due_date: '2026-08-15',
          received_date: '2026-08-15',
          category_id: 'rc_servicos',
          status: 'received',
          created_at: '2026-08-01',
        },
      ];

      const expenses: Expense[] = [
        {
          id: 'e_norm_1',
          company_id: 'comp_1',
          supplier: 'Fornecedor XYZ',
          description: 'Pagamento de Agosto',
          amount: 5000,
          competence_date: '2026-08-01',
          due_date: '2026-08-15',
          paid_date: '2026-08-15',
          category_id: 'ec_adm',
          status: 'paid',
          created_at: '2026-08-01',
        },
      ];

      const flow = calculateCashFlow(revenues, expenses, [], mockBankAccounts, 'monthly');
      const august = flow.find((p) => p.period_key === '2026-08');

      expect(august).toBeDefined();
      expect(august?.operational_inflows).toBe(15000);
      expect(august?.operational_outflows).toBe(5000);
      expect(august?.net_period_change).toBe(10000);
    });
  });
});
