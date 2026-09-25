import React, { useState } from 'react';
import {
  PiggyBank,
  Plus,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Layers,
  Edit2,
  DollarSign,
} from 'lucide-react';
import { Budget, Category, CostCenter, Expense, Revenue } from '../../types';
import { formatCurrency, formatPercent } from '../../lib/utils';
import { MonthPickerFilter } from '../common/MonthPickerFilter';

interface BudgetViewProps {
  budgets: Budget[];
  categories: Category[];
  costCenters: CostCenter[];
  expenses: Expense[];
  revenues: Revenue[];
  selectedMonth: string;
  onSelectMonth?: (month: string) => void;
  onSaveBudget: (budget: Budget) => void;
}

export const BudgetView: React.FC<BudgetViewProps> = ({
  budgets,
  categories,
  costCenters,
  expenses,
  revenues,
  selectedMonth,
  onSelectMonth,
  onSaveBudget,
}) => {
  const [editingBudgetCategory, setEditingBudgetCategory] = useState<Category | null>(null);
  const [budgetInput, setBudgetInput] = useState<number>(0);

  // Group expenses by category for current month
  const categoryBudgetData = categories
    .filter((c) => c.type !== 'REVENUE')
    .map((cat) => {
      const budgetEntry = budgets.find(
        (b) => b.category_id === cat.id && b.year_month === selectedMonth
      );
      const budgetedAmount = budgetEntry ? budgetEntry.budgeted_amount : 0;

      const actualAmount = expenses
        .filter(
          (e) =>
            e.category_id === cat.id &&
            e.competence_date.startsWith(selectedMonth) &&
            !e.is_equity_movement
        )
        .reduce((sum, e) => sum + e.amount, 0);

      const varianceAmount = budgetedAmount - actualAmount;
      const usagePercent = budgetedAmount > 0 ? (actualAmount / budgetedAmount) * 100 : 0;
      const isOverBudget = actualAmount > budgetedAmount;

      return {
        category: cat,
        budgetedAmount,
        actualAmount,
        varianceAmount,
        usagePercent,
        isOverBudget,
        budgetEntry,
      };
    });

  const totalBudgeted = categoryBudgetData.reduce((sum, item) => sum + item.budgetedAmount, 0);
  const totalActual = categoryBudgetData.reduce((sum, item) => sum + item.actualAmount, 0);
  const totalVariance = totalBudgeted - totalActual;
  const overallUsagePercent = totalBudgeted > 0 ? (totalActual / totalBudgeted) * 100 : 0;

  const handleOpenEdit = (item: any) => {
    setEditingBudgetCategory(item.category);
    setBudgetInput(item.budgetedAmount);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBudgetCategory) return;

    const existing = budgets.find(
      (b) => b.category_id === editingBudgetCategory.id && b.year_month === selectedMonth
    );

    const newBudget: Budget = {
      id: existing ? existing.id : `bgt_${Date.now()}`,
      company_id: 'comp_nox4',
      year_month: selectedMonth,
      category_id: editingBudgetCategory.id,
      budgeted_amount: budgetInput,
      actual_amount: 0,
      created_at: new Date().toISOString(),
    };

    onSaveBudget(newBudget);
    setEditingBudgetCategory(null);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600 font-heading">
                Planejamento & Controle
              </span>
              <span className="px-2.5 py-0.5 text-[10px] bg-blue-50 text-blue-700 border border-blue-200 rounded-full font-medium">
                Orçado x Realizado (Mês {selectedMonth})
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-800 mt-1 font-heading tracking-tight">
              Orçamento Empresarial (Budget)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Defina metas de gastos por categoria e acompanhe desvios orçamentários em tempo real
            </p>
          </div>

          {onSelectMonth && (
            <div className="flex items-center gap-2 shrink-0">
              <MonthPickerFilter
                selectedMonth={selectedMonth}
                onSelectMonth={onSelectMonth}
              />
            </div>
          )}
        </div>

        {/* Global Budget Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-3 border-t border-slate-100">
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Teto Orçado Total</div>
            <div className="text-lg font-bold text-slate-800 font-heading mt-0.5">
              {formatCurrency(totalBudgeted)}
            </div>
          </div>
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Realizado no Mês</div>
            <div className="text-lg font-bold text-rose-600 font-heading mt-0.5">
              {formatCurrency(totalActual)}
            </div>
          </div>
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Saldo Orçamentário</div>
            <div className={`text-lg font-bold font-heading mt-0.5 ${totalVariance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {totalVariance >= 0 ? formatCurrency(totalVariance) : `(${formatCurrency(Math.abs(totalVariance))})`}
            </div>
          </div>
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">% Execução Orçamentária</div>
            <div className="text-lg font-bold text-blue-600 font-heading mt-0.5">
              {formatPercent(overallUsagePercent)}
            </div>
          </div>
        </div>
      </div>

      {/* Categories Budget Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 font-heading uppercase tracking-wider">
                <th className="py-3.5 px-4">Categoria DRE</th>
                <th className="py-3.5 px-4 text-right">Meta Orçada (R$)</th>
                <th className="py-3.5 px-4 text-right">Gasto Realizado (R$)</th>
                <th className="py-3.5 px-4 text-right">Desvio / Saldo (R$)</th>
                <th className="py-3.5 px-4 text-center">Consumo %</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {categoryBudgetData.map((item) => (
                <tr
                  key={item.category.id}
                  className="border-b border-slate-100 hover:bg-slate-50/80 text-xs transition-colors"
                >
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-800">{item.category.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      Grupo: {item.category.type}
                    </div>
                  </td>

                  <td className="py-3 px-4 text-right font-mono font-medium text-slate-700">
                    {formatCurrency(item.budgetedAmount)}
                  </td>

                  <td className="py-3 px-4 text-right font-mono font-bold text-rose-600">
                    {formatCurrency(item.actualAmount)}
                  </td>

                  <td className="py-3 px-4 text-right font-mono font-semibold">
                    <span className={item.varianceAmount >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                      {item.varianceAmount >= 0
                        ? `+${formatCurrency(item.varianceAmount)}`
                        : `(${formatCurrency(Math.abs(item.varianceAmount))})`}
                    </span>
                  </td>

                  {/* Progress bar */}
                  <td className="py-3 px-4 text-center w-36">
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          item.usagePercent > 100
                            ? 'bg-rose-500'
                            : item.usagePercent > 85
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(item.usagePercent, 100)}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 mt-1 block">
                      {formatPercent(item.usagePercent)}
                    </span>
                  </td>

                  <td className="py-3 px-4 text-center">
                    {item.isOverBudget ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                        <AlertTriangle className="w-3 h-3" /> Estourado
                      </span>
                    ) : item.usagePercent > 85 ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                        <AlertTriangle className="w-3 h-3" /> Atenção
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3" /> No Teto
                      </span>
                    )}
                  </td>

                  <td className="py-3 px-4 text-center">
                    <button
                      onClick={() => handleOpenEdit(item)}
                      className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium flex items-center gap-1 mx-auto transition-colors"
                    >
                      <Edit2 className="w-3 h-3 text-slate-500" /> Ajustar Meta
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Budget Modal */}
      {editingBudgetCategory && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-sm w-full p-5 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-slate-800 font-heading">
              Definir Orçamento Mensal
            </h3>
            <p className="text-xs text-slate-500">
              Categoria: <strong className="text-slate-800">{editingBudgetCategory.name}</strong> ({selectedMonth})
            </p>

            <form onSubmit={handleSave} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Teto Orçado (R$)</label>
                <input
                  type="number"
                  step="100"
                  required
                  value={budgetInput}
                  onChange={(e) => setBudgetInput(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 outline-none focus:border-blue-500 focus:bg-white font-mono text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingBudgetCategory(null)}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors shadow-xs"
                >
                  Salvar Meta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
