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
  Plus,
  Pencil,
  Trash2,
  Info,
  Check,
  X,
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
import { formatCurrency, formatPercent, formatAxisCurrency, parseDecimalInput, formatDate, getTodayISO } from '../../lib/utils';
import { MonthPickerFilter } from '../common/MonthPickerFilter';

interface CashFlowViewProps {
  cashFlowPeriods: CashFlowPeriod[];
  bankAccounts: BankAccount[];
  viewMode: 'daily' | 'weekly' | 'monthly';
  onChangeViewMode: (mode: 'daily' | 'weekly' | 'monthly') => void;
  selectedMonth: string;
  onSelectMonth?: (month: string) => void;
  /** Saldo em caixa hoje (saldo inicial + recebimentos − pagamentos) */
  currentCashBalance?: number;
  canEdit?: boolean;
  onAddBankAccount?: (acc: { name: string; bank?: string; opening_balance: number }) => Promise<boolean>;
  onUpdateBankAccount?: (acc: BankAccount) => Promise<boolean>;
  onDeleteBankAccount?: (id: string) => Promise<boolean>;
}

const emptyAccForm = { name: '', bank: '', opening_balance: '' };

export const CashFlowView: React.FC<CashFlowViewProps> = ({
  cashFlowPeriods,
  bankAccounts,
  viewMode,
  onChangeViewMode,
  selectedMonth,
  onSelectMonth,
  currentCashBalance,
  canEdit = true,
  onAddBankAccount,
  onUpdateBankAccount,
  onDeleteBankAccount,
}) => {
  const [selectedPeriodKey, setSelectedPeriodKey] = useState<string | null>(null);
  const [accForm, setAccForm] = useState(emptyAccForm);
  const [editingAccId, setEditingAccId] = useState<string | null>(null);
  const [isAccFormOpen, setIsAccFormOpen] = useState(false);
  const [accSaving, setAccSaving] = useState(false);

  const totalOpening = bankAccounts.filter((b) => b.active !== false).reduce((sum, b) => sum + (b.opening_balance || 0), 0);
  const totalBankBalance = currentCashBalance ?? totalOpening;

  const openNewAccount = () => {
    setEditingAccId(null);
    setAccForm(emptyAccForm);
    setIsAccFormOpen(true);
  };
  const openEditAccount = (b: BankAccount) => {
    setEditingAccId(b.id);
    setAccForm({ name: b.name, bank: b.bank || '', opening_balance: String(b.opening_balance ?? 0).replace('.', ',') });
    setIsAccFormOpen(true);
  };
  const saveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accForm.name.trim()) return;
    setAccSaving(true);
    const opening = parseDecimalInput(accForm.opening_balance);
    let ok = false;
    if (editingAccId) {
      const current = bankAccounts.find((b) => b.id === editingAccId);
      if (current && onUpdateBankAccount) {
        ok = await onUpdateBankAccount({ ...current, name: accForm.name.trim(), bank: accForm.bank, opening_balance: opening });
      }
    } else if (onAddBankAccount) {
      ok = await onAddBankAccount({ name: accForm.name.trim(), bank: accForm.bank, opening_balance: opening });
    }
    setAccSaving(false);
    if (ok) {
      setIsAccFormOpen(false);
      setAccForm(emptyAccForm);
      setEditingAccId(null);
    }
  };
  const removeAccount = async (b: BankAccount) => {
    if (!onDeleteBankAccount) return;
    if (window.confirm(`Excluir a conta "${b.name}"? O saldo inicial dela deixa de entrar no caixa.`)) {
      await onDeleteBankAccount(b.id);
    }
  };

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

      {/* Saldo em caixa e contas bancárias */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Saldo em caixa hoje
            </div>
            <div className={`text-xl font-bold font-heading mt-1 ${totalBankBalance < 0 ? 'text-rose-600' : 'text-slate-900'}`}>
              {formatCurrency(totalBankBalance)}
            </div>
            <div className="text-[11px] text-slate-500 font-medium mt-0.5">
              Saldo inicial {formatCurrency(totalOpening)} + recebido − pago até {formatDate(getTodayISO())}
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
            <Wallet className="w-5 h-5" />
          </div>
        </div>

        <div className="lg:col-span-2 bg-white border border-slate-200 p-4 rounded-xl shadow-sm space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-800 font-heading">Contas bancárias e saldo inicial</h3>
              <p className="text-[11px] text-slate-500">
                Informe quanto havia em cada conta antes do primeiro lançamento no sistema.
              </p>
            </div>
            {canEdit && onAddBankAccount && !isAccFormOpen && (
              <button
                type="button"
                onClick={openNewAccount}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Adicionar conta
              </button>
            )}
          </div>

          {bankAccounts.length === 0 && !isAccFormOpen && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Nenhuma conta cadastrada: o caixa começa em R$ 0,00. Cadastre suas contas com o saldo inicial para o saldo,
                o runway e os alertas ficarem corretos.
              </span>
            </div>
          )}

          {isAccFormOpen && (
            <form onSubmit={saveAccount} className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
              <div className="sm:col-span-1">
                <label className="block font-semibold text-slate-700 mb-1">Nome da conta *</label>
                <input
                  required
                  autoFocus
                  placeholder="Ex: Itaú PJ"
                  value={accForm.name}
                  onChange={(e) => setAccForm({ ...accForm, name: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Banco</label>
                <input
                  placeholder="Ex: Itaú"
                  value={accForm.bank}
                  onChange={(e) => setAccForm({ ...accForm, bank: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Saldo inicial (R$)</label>
                <input
                  inputMode="decimal"
                  placeholder="Ex: 25.000,00"
                  value={accForm.opening_balance}
                  onChange={(e) => setAccForm({ ...accForm, opening_balance: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 font-mono"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={accSaving}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 text-white font-semibold disabled:opacity-60 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" /> {accSaving ? 'Salvando...' : 'Salvar'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsAccFormOpen(false)}
                  aria-label="Cancelar"
                  className="px-2 py-1.5 rounded-lg bg-slate-200 text-slate-700 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          )}

          {bankAccounts.length > 0 && (
            <div className="divide-y divide-slate-100 border border-slate-100 rounded-lg">
              {bankAccounts.map((b) => (
                <div key={b.id} className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-800 truncate">{b.name}</div>
                      {b.bank && <div className="text-[10px] text-slate-400 truncate">{b.bank}</div>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-slate-400 hidden sm:inline">Saldo inicial</span>
                    <span className="font-mono font-semibold text-slate-700">{formatCurrency(b.opening_balance)}</span>
                    {canEdit && onUpdateBankAccount && (
                      <button type="button" onClick={() => openEditAccount(b)} aria-label={`Editar ${b.name}`} className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 cursor-pointer">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {canEdit && onDeleteBankAccount && (
                      <button type="button" onClick={() => removeAccount(b)} aria-label={`Excluir ${b.name}`} className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
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
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" stroke="#64748b" fontSize={11} interval={viewMode === 'monthly' ? 0 : 'preserveStartEnd'} />
              <YAxis stroke="#64748b" fontSize={11} width={78} tickFormatter={(v) => formatAxisCurrency(Number(v))} />
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
