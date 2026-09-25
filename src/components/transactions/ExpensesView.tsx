import React, { useState, useEffect } from 'react';
import {
  TrendingDown,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  Building2,
  Layers,
  Trash2,
  Edit2,
  Calendar,
  ShieldCheck,
  Tag,
  XCircle,
} from 'lucide-react';
import { Expense, CostCenter, Category, TransactionStatus } from '../../types';
import { formatCurrency, formatDate } from '../../lib/utils';
import { normalizeTransactionStatus } from '../../lib/financialEngine';
import { MonthPickerFilter } from '../common/MonthPickerFilter';
import { formatFinancialErrorMessage, formatNullableText } from '../../lib/financialErrorMessages';

interface ExpensesViewProps {
  expenses: Expense[];
  costCenters: CostCenter[];
  categories: Category[];
  selectedMonth?: string;
  onSelectMonth?: (month: string) => void;
  onOpenNewExpenseModal: () => void;
  onEditExpense: (expense: Expense) => void;
  onDeleteExpense: (id: string) => void;
  onMarkAsPaid: (id: string) => void;
}

export const ExpensesView: React.FC<ExpensesViewProps> = ({
  expenses,
  costCenters,
  categories,
  selectedMonth = '2026-08',
  onSelectMonth,
  onOpenNewExpenseModal,
  onEditExpense,
  onDeleteExpense,
  onMarkAsPaid,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [categoryTypeFilter, setCategoryTypeFilter] = useState<string>('ALL');
  const [monthFilter, setMonthFilter] = useState<string>(selectedMonth || 'ALL');
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  const handleConfirmDelete = () => {
    if (!expenseToDelete) return;
    try {
      onDeleteExpense(expenseToDelete.id);
      setFeedbackError(null);
      setExpenseToDelete(null);
    } catch (err) {
      setFeedbackError(formatFinancialErrorMessage(err, 'delete', 'expense'));
    }
  };

  const handleMarkAsPaidSafe = (id: string) => {
    try {
      onMarkAsPaid(id);
      setFeedbackError(null);
    } catch (err) {
      setFeedbackError(formatFinancialErrorMessage(err, 'update', 'expense'));
    }
  };

  // Synchronize internal month filter if prop changes
  useEffect(() => {
    if (selectedMonth) {
      setMonthFilter(selectedMonth);
    }
  }, [selectedMonth]);

  const handleMonthChange = (newMonth: string) => {
    setMonthFilter(newMonth);
    if (onSelectMonth && newMonth !== 'ALL') {
      onSelectMonth(newMonth);
    }
  };

  const filteredExpenses = expenses.filter((exp) => {
    const category = categories.find((c) => c.id === exp.category_id);
    const textMatch =
      exp.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (exp.supplier && exp.supplier.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (category && category.name.toLowerCase().includes(searchTerm.toLowerCase()));

    const normStatus = normalizeTransactionStatus(exp.status);
    const statusMatch = statusFilter === 'ALL' || normStatus === statusFilter;
    const typeMatch = categoryTypeFilter === 'ALL' || (category && (category.type === categoryTypeFilter || category.group === categoryTypeFilter));
    const monthMatch =
      monthFilter === 'ALL' ||
      (exp.competence_date && exp.competence_date.startsWith(monthFilter)) ||
      (exp.due_date && exp.due_date.startsWith(monthFilter));

    return textMatch && statusMatch && typeMatch && monthMatch;
  });

  const totalExpenses = filteredExpenses.reduce((acc, e) => acc + (e.amount || 0), 0);
  const totalFixed = filteredExpenses
    .filter((e) => e.cost_nature === 'FIXED')
    .reduce((acc, e) => acc + (e.amount || 0), 0);
  const totalVariable = filteredExpenses
    .filter((e) => e.cost_nature === 'VARIABLE')
    .reduce((acc, e) => acc + (e.amount || 0), 0);
  const totalPaid = filteredExpenses
    .filter((e) => normalizeTransactionStatus(e.status) === 'paid')
    .reduce((acc, e) => acc + (e.amount || 0), 0);
  const totalPending = filteredExpenses
    .filter((e) => {
      const s = normalizeTransactionStatus(e.status);
      return s === 'pending' || s === 'overdue';
    })
    .reduce((acc, e) => acc + (e.amount || 0), 0);

  const getStatusBadge = (status: string) => {
    const s = normalizeTransactionStatus(status);
    switch (s) {
      case 'paid':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" /> Pago
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3" /> A Pagar
          </span>
        );
      case 'overdue':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 animate-pulse">
            <AlertCircle className="w-3 h-3" /> Vencido
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            <XCircle className="w-3 h-3" /> Cancelado
          </span>
        );
      default:
        return <span className="text-slate-500 text-xs">{status}</span>;
    }
  };

  const getCategoryTypeBadge = (type: string, isEquity?: boolean) => {
    if (isEquity) {
      return (
        <span className="px-2 py-0.5 text-[9px] font-semibold bg-purple-50 text-purple-700 border border-purple-200 rounded">
          Patrimônio / Sócios (Fora DRE)
        </span>
      );
    }
    switch (type) {
      case 'COST_OF_SERVICE':
      case 'direct_cost':
      case 'cost_of_service':
        return <span className="px-2 py-0.5 text-[9px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded">CSP (Custo Direto)</span>;
      case 'COMMERCIAL':
      case 'commercial':
        return <span className="px-2 py-0.5 text-[9px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded">Comercial / Mkt</span>;
      case 'ADMINISTRATIVE':
      case 'administrative':
        return <span className="px-2 py-0.5 text-[9px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 rounded">Administrativo</span>;
      case 'OPERATIONAL':
      case 'operational':
        return <span className="px-2 py-0.5 text-[9px] font-semibold bg-cyan-50 text-cyan-700 border border-cyan-200 rounded">Operacional</span>;
      default:
        return <span className="px-2 py-0.5 text-[9px] font-semibold bg-slate-100 text-slate-700 rounded">{type}</span>;
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Feedback Error Banner */}
      {feedbackError && (
        <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs shadow-xs animate-in fade-in duration-200">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
          <div className="flex-1 font-medium">{feedbackError}</div>
          <button
            onClick={() => setFeedbackError(null)}
            className="text-rose-500 hover:text-rose-700 text-xs font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-600 font-heading">
                Gestão de Custos & Despesas
              </span>
              <span className="px-2.5 py-0.5 text-[10px] bg-slate-100 text-slate-700 rounded-full font-medium">
                Fixos x Variáveis & Segregação Patrimonial
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-800 mt-1 font-heading tracking-tight">
              Despesas & Custos Operacionais
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Classificação estruturada por grupo DRE, centro de resultado e natureza de custo
            </p>
          </div>

          <button
            id="btn-add-new-expense"
            onClick={onOpenNewExpenseModal}
            className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold font-heading shadow-sm transition-all self-start md:self-auto cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Nova Despesa</span>
          </button>
        </div>

        {/* Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 border-t border-slate-100">
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Despesas</div>
            <div className="text-lg font-bold text-slate-800 font-heading mt-0.5">
              {formatCurrency(totalExpenses)}
            </div>
          </div>
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Custos Fixos / Variáveis</div>
            <div className="text-xs font-bold text-slate-700 font-mono mt-1">
              <span className="text-blue-600">Fixos: {formatCurrency(totalFixed)}</span> |{' '}
              <span className="text-amber-600">Var: {formatCurrency(totalVariable)}</span>
            </div>
          </div>
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Pago</div>
            <div className="text-lg font-bold text-emerald-600 font-heading mt-0.5">
              {formatCurrency(totalPaid)}
            </div>
          </div>
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">A Pagar / Pendente</div>
            <div className="text-lg font-bold text-amber-600 font-heading mt-0.5">
              {formatCurrency(totalPending)}
            </div>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por descrição, fornecedor ou categoria..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-rose-500 focus:bg-white transition-colors"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
            {/* Month Filter */}
            <MonthPickerFilter
              selectedMonth={monthFilter}
              onSelectMonth={handleMonthChange}
              allowAllMonths={true}
              labelAllMonths="Todos os Meses"
              variant="badge"
              className="bg-white"
            />

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 outline-none cursor-pointer"
            >
              <option value="ALL">Todos os Status</option>
              <option value="paid">Pago</option>
              <option value="pending">A Pagar</option>
              <option value="overdue">Vencido</option>
              <option value="cancelled">Cancelado</option>
            </select>

            <select
              value={categoryTypeFilter}
              onChange={(e) => setCategoryTypeFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 outline-none cursor-pointer"
            >
              <option value="ALL">Todas as Categorias</option>
              <option value="COST_OF_SERVICE">Custos dos Serviços (CSP)</option>
              <option value="COMMERCIAL">Comerciais & Marketing</option>
              <option value="ADMINISTRATIVE">Administrativas</option>
              <option value="OPERATIONAL">Operacionais</option>
            </select>
          </div>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 font-heading uppercase tracking-wider">
                <th className="py-3 px-4">Descrição & Fornecedor</th>
                <th className="py-3 px-4">Categoria DRE & Centro</th>
                <th className="py-3 px-4">Natureza</th>
                <th className="py-3 px-4">Competência / Venc.</th>
                <th className="py-3 px-4 text-right">Valor</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs text-slate-500">
                    Nenhuma despesa encontrada para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((exp) => {
                  const category = categories.find((c) => c.id === exp.category_id);
                  const costCenter = costCenters.find((c) => c.id === exp.cost_center_id);
                  const isPaid = normalizeTransactionStatus(exp.status) === 'paid';

                  return (
                    <tr
                      key={exp.id}
                      className="border-b border-slate-100 hover:bg-slate-50/80 text-xs transition-colors"
                    >
                      {/* Descrição & Fornecedor */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800">{exp.description}</div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <Building2 className="w-3 h-3 text-slate-400" />
                          <span>{formatNullableText(exp.supplier, 'Fornecedor não informado')}</span>
                        </div>
                      </td>

                      {/* Categoria DRE & Centro */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {getCategoryTypeBadge(category?.type || category?.group || 'OPERATIONAL', exp.is_equity_movement)}
                        </div>
                        <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-1">
                          <Layers className="w-3 h-3 text-slate-400" />
                          <span>{costCenter ? costCenter.name : 'Geral'}</span>
                        </div>
                      </td>

                      {/* Natureza */}
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            exp.cost_nature === 'FIXED'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {exp.cost_nature === 'FIXED' ? 'Fixo' : 'Variável'}
                        </span>
                      </td>

                      {/* Datas */}
                      <td className="py-3 px-4">
                        <div className="text-slate-700 font-mono text-[11px]">
                          Comp: {formatDate(exp.competence_date)}
                        </div>
                        <div className="text-slate-400 font-mono text-[10px] mt-0.5">
                          Venc: {formatDate(exp.due_date)}
                        </div>
                        {isPaid && (exp.paid_date || exp.payment_date) && (
                          <div className="text-emerald-600 font-mono text-[10px] mt-0.5">
                            Pago: {formatDate(exp.paid_date || exp.payment_date)}
                          </div>
                        )}
                      </td>

                      {/* Valor */}
                      <td className="py-3 px-4 text-right font-mono font-bold text-rose-600">
                        {formatCurrency(exp.amount)}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center">
                        {getStatusBadge(exp.status)}
                      </td>

                      {/* Ações */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {!isPaid && (
                            <button
                              title="Marcar como Pago"
                              onClick={() => handleMarkAsPaidSafe(exp.id)}
                              className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-colors cursor-pointer"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            title="Editar"
                            onClick={() => onEditExpense(exp)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            title="Excluir"
                            onClick={() => setExpenseToDelete(exp)}
                            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Confirmação de Exclusão de Despesa */}
      {expenseToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800 font-heading">
                  Excluir Despesa
                </h3>
                <p className="text-xs text-slate-500">
                  Esta ação removerá a conta a pagar selecionada.
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1.5">
              <div className="font-semibold text-slate-800">{expenseToDelete.description}</div>
              <div className="text-slate-600">
                Valor: <span className="font-bold text-rose-600">{formatCurrency(expenseToDelete.amount)}</span>
              </div>
            </div>

            <p className="text-xs text-slate-600">
              Deseja realmente excluir este lançamento financeiro? A exclusão afetará o cálculo de DRE e fluxo de caixa.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setExpenseToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition-colors cursor-pointer"
              >
                Sim, Excluir Despesa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
