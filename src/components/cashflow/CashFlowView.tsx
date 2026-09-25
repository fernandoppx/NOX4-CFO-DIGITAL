import React, { useState } from 'react';
import {
  Calculator,
  Calendar,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  Wallet,
  Building2,
  PieChart as PieIcon,
  ChevronRight,
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
  AreaChart,
  Area,
} from 'recharts';
import { CashFlowPeriod, BankAccount } from '../../types';
import { formatCurrency, formatPercent } from '../../lib/utils';
import { MonthPickerFilter } from '../common/MonthPickerFilter';

interface CashFlowViewProps {
  cashFlowPeriods: CashFlowPeriod[];
  bankAccounts: BankAccount[];
  viewMode: 'daily' | 'weekly' | 'monthly';
  onChangeViewMode: (mode: 'daily' | 'weekly' | 'monthly') => void;
  selectedMonth: string;
  onSelectMonth?: (month: string) => void;
}

export const CashFlowView: React.FC<CashFlowViewProps> = ({
  cashFlowPeriods,
  bankAccounts,
  viewMode,
  onChangeViewMode,
  selectedMonth,
  onSelectMonth,
}) => {
  const [selectedPeriodKey, setSelectedPeriodKey] = useState<string | null>(null);

  const totalBankBalance = bankAccounts.reduce((sum, b) => sum + b.current_balance, 0);

  // Active period details
  const activePeriod =
    cashFlowPeriods.find((p) => p.period_key === selectedPeriodKey) ||
    cashFlowPeriods[cashFlowPeriods.length - 1] ||
    cashFlowPeriods[0];

  const chartData = cashFlowPeriods.map((p) => ({
    label: p.period_label,
    entradas: p.operational_inflows,
    saidas: p.operational_outflows,
    saldo: p.closing_balance,
    resultado: p.net_period_change,
  }));

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Controls */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600 font-heading">
                Gestão de Tesouraria & Liquidez
              </span>
              <span className="px-2.5 py-0.5 text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full font-semibold">
                Regime de Caixa
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-800 mt-1 font-heading tracking-tight">
              Fluxo de Caixa Operacional & Projeções
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Acompanhamento de entradas e saídas efetivas e projeção de liquidez futura
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {onSelectMonth && (
              <MonthPickerFilter
                selectedMonth={selectedMonth}
                onSelectMonth={onSelectMonth}
                size="sm"
              />
            )}

            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
              <button
                onClick={() => onChangeViewMode('daily')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  viewMode === 'daily'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Diário
              </button>
              <button
                onClick={() => onChangeViewMode('monthly')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  viewMode === 'monthly'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Mensal (Histórico + Projeção)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bank Balances Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Saldo Total Consolidado
            </div>
            <div className="text-xl font-bold text-slate-900 font-heading mt-1">
              {formatCurrency(totalBankBalance)}
            </div>
            <div className="text-[11px] text-blue-600 font-medium mt-0.5">Disponível em contas</div>
          </div>
          <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
            <Wallet className="w-5 h-5" />
          </div>
        </div>

        {bankAccounts.map((b) => (
          <div key={b.id} className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider truncate">
                {b.name}
              </div>
              <div className="text-lg font-bold text-slate-800 font-heading mt-1">
                {formatCurrency(b.current_balance)}
              </div>
              <div className="text-[10px] text-slate-400 truncate">{b.account_number}</div>
            </div>
            <div className="p-2 rounded-lg bg-slate-50 text-slate-600 border border-slate-100">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
        ))}
      </div>

      {/* Cash Flow Main Chart: Inflows vs Outflows and Balance Line */}
      <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-800 font-heading">
              Movimentação de Caixa & Saldo Final
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Entradas (Recebimentos), Saídas (Pagamentos) e Linha de Saldo Disponível
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold">
            <span className="flex items-center gap-1.5 text-emerald-600">
              <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500" /> Entradas
            </span>
            <span className="flex items-center gap-1.5 text-rose-600">
              <span className="w-2.5 h-2.5 rounded-xs bg-rose-500" /> Saídas
            </span>
          </div>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={11} tickFormatter={(v) => `R$${v / 1000}k`} />
              <Tooltip
                contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', color: '#0f172a', borderRadius: '8px', fontSize: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                formatter={(value: any) => [formatCurrency(Number(value)), '']}
              />
              <Bar dataKey="entradas" fill="#10b981" radius={[4, 4, 0, 0]} name="Entradas" />
              <Bar dataKey="saidas" fill="#f43f5e" radius={[4, 4, 0, 0]} name="Saídas" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Cash Flow Statement Breakdown Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <h3 className="text-sm font-bold text-slate-800 font-heading">
            Demonstrativo de Fluxo de Caixa (Visão Tabular)
          </h3>
          <span className="text-xs font-medium text-slate-500">
            {cashFlowPeriods.length} períodos analisados
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 font-heading uppercase tracking-wider">
                <th className="py-3 px-4">Período</th>
                <th className="py-3 px-4 text-right">Saldo Inicial</th>
                <th className="py-3 px-4 text-right text-emerald-700">(+) Entradas Operacionais</th>
                <th className="py-3 px-4 text-right text-rose-700">(-) Saídas Operacionais</th>
                <th className="py-3 px-4 text-right">(=) Saldo Operacional</th>
                <th className="py-3 px-4 text-right">(+/-) Financiamentos/Sócios</th>
                <th className="py-3 px-4 text-right">(=) Saldo Final</th>
              </tr>
            </thead>
            <tbody>
              {cashFlowPeriods.map((p, idx) => (
                <tr
                  key={idx}
                  onClick={() => setSelectedPeriodKey(p.period_key)}
                  className={`border-b border-slate-100 text-xs transition-colors cursor-pointer ${
                    activePeriod.period_key === p.period_key
                      ? 'bg-blue-50/80 text-blue-900 font-semibold'
                      : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <td className="py-3 px-4 font-mono flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    <span>{p.period_label}</span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-slate-500">
                    {formatCurrency(p.opening_balance)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-emerald-600 font-semibold">
                    {formatCurrency(p.operational_inflows)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-rose-600 font-semibold">
                    {p.operational_outflows > 0 ? `(${formatCurrency(p.operational_outflows)})` : 'R$ 0,00'}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold">
                    <span className={p.net_operational >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                      {formatCurrency(p.net_operational)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-slate-500">
                    {p.financing_flows !== 0 ? formatCurrency(p.financing_flows) : '-'}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                    {formatCurrency(p.closing_balance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
