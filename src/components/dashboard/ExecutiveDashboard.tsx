import React from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  PieChart as PieIcon,
  AlertTriangle,
  Info,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Clock,
  CheckCircle2,
  Gauge,
  Target,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts';
import { DREStatement, FinancialIndicators, CashFlowPeriod, Client } from '../../types';
import { formatCurrency, formatPercent } from '../../lib/utils';
import { MonthPickerFilter } from '../common/MonthPickerFilter';

interface ExecutiveDashboardProps {
  currentDRE: DREStatement;
  previousDRE: DREStatement | null;
  indicators: FinancialIndicators;
  cashFlowPeriods: CashFlowPeriod[];
  alerts: Array<{
    id: string;
    type: string;
    title: string;
    content: string;
    severity: 'CRÍTICO' | 'ATENÇÃO' | 'INFO';
    badge: string;
  }>;
  clientsProfitability: Array<{
    client: Client;
    netRevenue: number;
    marginPercent: number;
  }>;
  selectedMonth?: string;
  onSelectMonth?: (month: string) => void;
  onNavigateToTab: (tab: any) => void;
}

export const ExecutiveDashboard: React.FC<ExecutiveDashboardProps> = ({
  currentDRE,
  previousDRE,
  indicators,
  cashFlowPeriods,
  alerts,
  clientsProfitability,
  selectedMonth = '2026-08',
  onSelectMonth,
  onNavigateToTab,
}) => {
  // Monthly overview data for charts
  const monthlyData = [
    {
      name: 'Mês Anterior',
      receita: previousDRE ? previousDRE.net_revenue : 0,
      despesas: previousDRE ? previousDRE.total_operating_expenses + previousDRE.cost_of_services : 0,
      lucro: previousDRE ? previousDRE.net_profit : 0,
      margem: previousDRE ? previousDRE.net_margin : 0,
    },
    {
      name: `${currentDRE.period} (Atual)`,
      receita: currentDRE.net_revenue,
      despesas: currentDRE.total_operating_expenses + currentDRE.cost_of_services,
      lucro: currentDRE.net_profit,
      margem: currentDRE.net_margin,
    },
  ];

  // Expenses category breakdown
  const expenseCategoriesData = [
    { name: 'Custos de Serviços (CSP)', value: currentDRE.cost_of_services, color: '#3b82f6' },
    { name: 'Comercial & Marketing', value: currentDRE.commercial_expenses, color: '#8b5cf6' },
    { name: 'Administrativo & Sócios', value: currentDRE.administrative_expenses, color: '#ec4899' },
    { name: 'Operacional & Tech', value: currentDRE.operational_expenses, color: '#06b6d4' },
    { name: 'Financeiro & Impostos', value: currentDRE.financial_expenses + currentDRE.taxes_on_profit, color: '#f59e0b' },
  ].filter((item) => item.value > 0);

  // Client distribution
  const topClientsData = clientsProfitability
    .sort((a, b) => b.netRevenue - a.netRevenue)
    .slice(0, 5)
    .map((c) => ({
      name: c.client.name.split(' ')[0] + ' ' + (c.client.name.split(' ')[1] || ''),
      receita: c.netRevenue,
    }));

  // Cash flow projection data (last 3 and next 3)
  const cashFlowTimeline = cashFlowPeriods.map((p) => ({
    period: p.period_label,
    saldo: p.closing_balance,
    entradas: p.operational_inflows,
    saidas: p.operational_outflows,
  }));

  const kpiCards = [
    {
      id: 'kpi-faturamento',
      title: 'Faturamento Bruto',
      value: formatCurrency(currentDRE.gross_revenue),
      subtext: `Receita Líquida: ${formatCurrency(currentDRE.net_revenue)}`,
      icon: DollarSign,
      color: 'text-blue-400',
      trend: indicators.mom_growth >= 0 ? `+${indicators.mom_growth.toFixed(1)}% MoM` : `${indicators.mom_growth.toFixed(1)}% MoM`,
      isPositive: indicators.mom_growth >= 0,
    },
    {
      id: 'kpi-lucro-bruto',
      title: 'Lucro Bruto',
      value: formatCurrency(currentDRE.gross_profit),
      subtext: `Margem Bruta: ${formatPercent(currentDRE.gross_margin)}`,
      icon: TrendingUp,
      color: 'text-emerald-400',
      trend: `${formatPercent(currentDRE.gross_margin)}`,
      isPositive: currentDRE.gross_margin >= 50,
    },
    {
      id: 'kpi-lucro-liquido',
      title: 'Lucro Líquido',
      value: formatCurrency(currentDRE.net_profit),
      subtext: `Margem Líquida: ${formatPercent(currentDRE.net_margin)}`,
      icon: currentDRE.net_profit >= 0 ? ArrowUpRight : ArrowDownRight,
      color: currentDRE.net_profit >= 0 ? 'text-emerald-400' : 'text-rose-400',
      trend: `${formatPercent(currentDRE.net_margin)}`,
      isPositive: currentDRE.net_profit >= 0,
    },
    {
      id: 'kpi-saldo-caixa',
      title: 'Saldo Total em Caixa',
      value: formatCurrency(indicators.cash_balance),
      subtext: `Runway: ${indicators.runway_months.toFixed(0)} meses`,
      icon: Wallet,
      color: 'text-cyan-400',
      trend: `${indicators.runway_months.toFixed(0)}m runway`,
      isPositive: indicators.runway_months >= 6,
    },
    {
      id: 'kpi-receber',
      title: 'Contas a Receber',
      value: formatCurrency(indicators.accounts_receivable_total),
      subtext: `Inadimplência: ${formatPercent(indicators.default_rate_percent)}`,
      icon: Clock,
      color: 'text-amber-400',
      trend: indicators.default_rate_percent <= 5 ? 'Saudável' : 'Atenção',
      isPositive: indicators.default_rate_percent <= 5,
    },
    {
      id: 'kpi-pagar',
      title: 'Contas a Pagar',
      value: formatCurrency(indicators.accounts_payable_total),
      subtext: `Compromissos pendentes`,
      icon: TrendingDown,
      color: 'text-rose-400',
      trend: 'Em dia',
      isPositive: true,
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Top Welcome & Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 p-5 rounded-xl shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 font-heading">
              Cockpit Executivo Financeiro
            </span>
            <span className="px-2.5 py-0.5 text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Regime de Competência & Caixa Integrados
            </span>
          </div>
          <h2 className="text-xl font-bold text-slate-800 mt-1 font-heading tracking-tight">
            Painel Geral de Performance Financeira
          </h2>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {onSelectMonth && (
            <MonthPickerFilter
              selectedMonth={selectedMonth}
              onSelectMonth={onSelectMonth}
              size="sm"
            />
          )}
          <button
            onClick={() => onNavigateToTab('dre')}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg border border-blue-200 shadow-xs transition-all cursor-pointer"
          >
            <Gauge className="w-3.5 h-3.5 text-blue-600" />
            <span>Ver DRE Gerencial</span>
          </button>
          <button
            onClick={() => onNavigateToTab('cashflow')}
            className="px-3.5 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            Fluxo de Caixa &rarr;
          </button>
        </div>
      </div>

      {/* Top 6 KPI Cards (Sleek Interface Style) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpiCards.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.id}
              id={kpi.id}
              className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm hover:border-slate-300 hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider truncate">
                  {kpi.title}
                </span>
                <div className="p-1.5 rounded-lg bg-slate-50 text-slate-700 border border-slate-100">
                  <Icon className="w-4 h-4 text-blue-600" />
                </div>
              </div>

              <div className="mt-3">
                <div className="text-xl font-bold text-slate-900 font-heading tracking-tight">
                  {kpi.value}
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                  <span className="truncate">{kpi.subtext}</span>
                  <span
                    className={`font-bold ml-1 shrink-0 ${
                      kpi.isPositive ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {kpi.trend}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Middle Row: DRE Summary (2 cols) & Executive Highlights Card (1 col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Resumo DRE Gerencial */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center">
            <h4 className="text-sm font-bold text-slate-800 font-heading">
              Resumo DRE Gerencial <span className="font-normal text-slate-400 ml-2">Competência {currentDRE.period}</span>
            </h4>
            <button
              onClick={() => onNavigateToTab('dre')}
              className="text-xs text-blue-600 hover:text-blue-700 font-semibold cursor-pointer"
            >
              Ver DRE Completa &rarr;
            </button>
          </div>
          <div className="p-4 text-sm">
            <div className="space-y-1.5">
              <div className="flex justify-between py-2 px-3 bg-slate-50 rounded-md font-semibold text-slate-800">
                <span>(+) Receita Bruta</span>
                <span className="font-mono">{formatCurrency(currentDRE.gross_revenue)}</span>
              </div>
              <div className="flex justify-between py-1.5 px-3 text-rose-600">
                <span>(-) Deduções (Impostos/Taxas)</span>
                <span className="font-mono">({formatCurrency(currentDRE.deductions)})</span>
              </div>
              <div className="flex justify-between py-2 px-3 font-bold border-b border-slate-100 text-slate-900">
                <span>(=) Receita Líquida</span>
                <span className="font-mono">{formatCurrency(currentDRE.net_revenue)}</span>
              </div>
              <div className="flex justify-between py-1.5 px-3 text-slate-600">
                <span>(-) Custos dos Serviços Prestados (CSP)</span>
                <span className="font-mono">({formatCurrency(currentDRE.cost_of_services)})</span>
              </div>
              <div className="flex justify-between py-2 px-3 font-bold bg-blue-50 text-blue-800 rounded-md">
                <span>(=) Lucro Bruto ({formatPercent(currentDRE.gross_margin)})</span>
                <span className="font-mono">{formatCurrency(currentDRE.gross_profit)}</span>
              </div>
              <div className="flex justify-between py-1.5 px-3 text-slate-600">
                <span>(-) Despesas Operacionais (Adm / Com / Op)</span>
                <span className="font-mono">({formatCurrency(currentDRE.total_operating_expenses)})</span>
              </div>
              <div className="flex justify-between py-2.5 px-3 font-bold border-t-2 border-slate-900 mt-2 text-base text-slate-900 bg-slate-50 rounded-md">
                <span>Lucro Líquido Final ({formatPercent(currentDRE.net_margin)})</span>
                <span className={`font-mono ${currentDRE.net_profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {formatCurrency(currentDRE.net_profit)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Executive Highlights Card */}
        <div className="bg-slate-900 rounded-xl shadow-xl flex flex-col text-white relative overflow-hidden border border-slate-800">
          <div className="absolute top-0 right-0 p-4 opacity-5 text-6xl italic font-black select-none pointer-events-none">
            KPI
          </div>
          <div className="p-5 z-10 flex flex-col h-full justify-between">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-xs">
                  <Target className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white tracking-tight font-heading">
                    Métricas Estratégicas do Mês
                  </h4>
                  <span className="text-[10px] text-blue-300 font-medium">Síntese de Desempenho</span>
                </div>
              </div>

              <div className="space-y-3 text-xs leading-relaxed">
                <div className="p-3 bg-white/10 rounded-lg border border-white/10">
                  <p className="text-blue-300 font-bold mb-1 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                    Margem de Contribuição
                  </p>
                  <p className="text-slate-200">
                    {currentDRE.net_revenue > 0
                      ? `Margem de contribuição de ${formatPercent(indicators.contribution_margin_percent)} gerada sobre a receita líquida.`
                      : 'Cadastre suas primeiras receitas e despesas para apuração automática da margem.'}
                  </p>
                </div>
                <div className="p-3 bg-white/10 rounded-lg border border-white/10">
                  <p className="text-emerald-300 font-bold mb-1 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Ponto de Equilíbrio (Break-Even)
                  </p>
                  <p className="text-slate-200">
                    {indicators.breakeven_point_monthly > 0
                      ? `Break-even mensal de ${formatCurrency(indicators.breakeven_point_monthly)} para cobertura integral dos custos fixos.`
                      : 'Ponto de equilíbrio calculado a partir das despesas fixas cadastradas.'}
                  </p>
                </div>
                <div className="p-3 bg-white/10 rounded-lg border border-white/10">
                  <p className="text-cyan-300 font-bold mb-1 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                    Liquidez & Runway
                  </p>
                  <p className="text-slate-200">
                    Saldo disponível de {formatCurrency(indicators.cash_balance)}. Runway operacional estimado em {indicators.runway_months > 0 ? `${indicators.runway_months.toFixed(0)} meses` : 'N/A'}.
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={() => onNavigateToTab('dre')}
              className="mt-4 w-full bg-blue-600 hover:bg-blue-500 py-2.5 rounded-lg font-bold text-xs text-white transition-colors shadow-sm cursor-pointer"
            >
              Explorar DRE Gerencial &rarr;
            </button>
          </div>
        </div>
      </div>

      {/* Principais Alertas Proativos */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-bold text-slate-800 font-heading uppercase tracking-wide">
              Alertas & Diagnósticos Proativos
            </h3>
          </div>
          <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
            {alerts.length} alertas identificados
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {alerts.map((alert) => {
            const isCritical = alert.severity === 'CRÍTICO';
            const isWarning = alert.severity === 'ATENÇÃO';
            return (
              <div
                key={alert.id}
                className={`p-3.5 rounded-lg border flex flex-col justify-between transition-all ${
                  isCritical
                    ? 'bg-rose-50/70 border-rose-200 text-rose-900'
                    : isWarning
                    ? 'bg-amber-50/70 border-amber-200 text-amber-900'
                    : 'bg-blue-50/70 border-blue-200 text-blue-900'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold font-heading flex items-center gap-1.5">
                      {isCritical ? (
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      ) : isWarning ? (
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      ) : (
                        <Info className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      )}
                      <span className="truncate">{alert.title}</span>
                    </span>
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider shrink-0 ${
                        isCritical
                          ? 'bg-rose-100 text-rose-700 border border-rose-200'
                          : isWarning
                          ? 'bg-amber-100 text-amber-700 border border-amber-200'
                          : 'bg-blue-100 text-blue-700 border border-blue-200'
                      }`}
                    >
                      {alert.severity}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {alert.content}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Receita x Despesas x Lucro por Mês (8 cols) */}
        <div className="lg:col-span-8 bg-white border border-slate-200 p-5 rounded-xl shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800 font-heading">
                Evolução Financeira: Receita, Despesas & Lucro
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Comparativo mensal histórico (Regime de Competência)
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs font-medium">
              <span className="flex items-center gap-1.5 text-blue-600 font-semibold">
                <span className="w-2.5 h-2.5 rounded-xs bg-blue-600" /> Receita
              </span>
              <span className="flex items-center gap-1.5 text-rose-600 font-semibold">
                <span className="w-2.5 h-2.5 rounded-xs bg-rose-500" /> Despesas
              </span>
              <span className="flex items-center gap-1.5 text-emerald-600 font-semibold">
                <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500" /> Lucro
              </span>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} tickFormatter={(v) => `R$${v / 1000}k`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', color: '#0f172a', borderRadius: '8px', fontSize: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: any) => [formatCurrency(Number(value)), '']}
                />
                <Bar dataKey="receita" fill="#2563eb" radius={[4, 4, 0, 0]} name="Receita Líquida" />
                <Bar dataKey="despesas" fill="#f43f5e" radius={[4, 4, 0, 0]} name="Despesas Totais" />
                <Bar dataKey="lucro" fill="#10b981" radius={[4, 4, 0, 0]} name="Lucro Líquido" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Despesas por Categoria (4 cols) */}
        <div className="lg:col-span-4 bg-white border border-slate-200 p-5 rounded-xl shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-slate-800 font-heading">
                Composição de Despesas
              </h3>
              <PieIcon className="w-4 h-4 text-slate-400" />
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Distribuição por centro de custo & grupo
            </p>

            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={expenseCategoriesData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {expenseCategoriesData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', color: '#0f172a', borderRadius: '8px', fontSize: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: any) => [formatCurrency(Number(value)), '']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="space-y-1.5 mt-2">
            {expenseCategoriesData.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-slate-600 truncate">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="truncate">{item.name}</span>
                </span>
                <span className="font-semibold text-slate-900 font-mono shrink-0 ml-2">
                  {formatCurrency(item.value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Secondary Charts: Projeção de Caixa & Inadimplência / Aging */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Projeção de Fluxo de Caixa (7 cols) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 p-5 rounded-xl shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800 font-heading">
                Fluxo de Caixa & Projeção de Saldo
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Saldo de caixa acumulado baseado em entradas e saídas
              </p>
            </div>
            <button
              onClick={() => onNavigateToTab('cashflow')}
              className="text-xs text-blue-600 hover:text-blue-700 font-semibold"
            >
              Ver Fluxo Completo &rarr;
            </button>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cashFlowTimeline} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSaldo" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="period" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} tickFormatter={(v) => `R$${v / 1000}k`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', color: '#0f172a', borderRadius: '8px', fontSize: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: any) => [formatCurrency(Number(value)), '']}
                />
                <Area type="monotone" dataKey="saldo" stroke="#2563eb" strokeWidth={2.5} fillOpacity={1} fill="url(#colorSaldo)" name="Saldo Acumulado" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Inadimplência e Prazos Médios (5 cols) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 p-5 rounded-xl shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-slate-800 font-heading">
                Inadimplência, Prazos & Eficiência
              </h3>
              <button
                onClick={() => onNavigateToTab('receivables')}
                className="text-xs text-blue-600 hover:text-blue-700 font-semibold cursor-pointer"
              >
                Ver Contas a Receber &rarr;
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Indicadores de ciclo financeiro e recebimento
            </p>

            <div className="grid grid-cols-3 gap-2 my-2 py-4 bg-slate-50 border border-slate-100 rounded-xl">
              <div className="flex flex-col items-center justify-center border-r border-slate-200 px-2 text-center">
                <p className="text-2xl font-bold text-slate-900 font-heading">{indicators.default_rate_percent.toFixed(1)}%</p>
                <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">Inadimplência</p>
              </div>
              <div className="flex flex-col items-center justify-center px-2 text-center">
                <p className="text-2xl font-bold text-slate-900 font-heading">14d</p>
                <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">PMR (Recebimento)</p>
              </div>
              <div className="flex flex-col items-center justify-center border-l border-slate-200 px-2 text-center">
                <p className="text-2xl font-bold text-emerald-600 font-heading">98.1</p>
                <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">Score Saúde</p>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <span>Payback do CAC: <strong className="text-slate-800 font-mono">1.2 meses</strong></span>
            <span>LTV/CAC: <strong className="text-emerald-600 font-mono">{indicators.ltv_cac_ratio.toFixed(1)}x</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
};
