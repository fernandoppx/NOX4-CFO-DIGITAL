import React, { useState } from 'react';
import {
  Layers,
  Plus,
  Search,
  Building2,
  TrendingUp,
  DollarSign,
  Edit2,
  Trash2,
  AlertCircle,
  ShieldAlert,
} from 'lucide-react';
import { CostCenter, Revenue, Expense } from '../../types';
import { formatCurrency, formatPercent } from '../../lib/utils';
import {
  formatFinancialErrorMessage,
  formatNullableText,
} from '../../lib/financialErrorMessages';

interface CostCentersViewProps {
  costCenters: CostCenter[];
  revenues: Revenue[];
  expenses: Expense[];
  onAddCostCenter: (cc: Omit<CostCenter, 'id' | 'created_at'>) => void;
  onUpdateCostCenter: (cc: CostCenter) => void;
  onDeleteCostCenter: (id: string) => void;
}

export const CostCentersView: React.FC<CostCentersViewProps> = ({
  costCenters,
  revenues,
  expenses,
  onAddCostCenter,
  onUpdateCostCenter,
  onDeleteCostCenter,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCC, setEditingCC] = useState<CostCenter | null>(null);
  const [costCenterToDelete, setCostCenterToDelete] = useState<CostCenter | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    active: true,
  });

  const handleOpenModal = (cc?: CostCenter) => {
    setModalError(null);
    if (cc) {
      setEditingCC(cc);
      setFormData({
        name: cc.name,
        code: cc.code,
        description: cc.description || '',
        active: cc.active,
      });
    } else {
      setEditingCC(null);
      setFormData({
        name: '',
        code: `CC0${costCenters.length + 1}`,
        description: '',
        active: true,
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    const trimmedName = formData.name.trim();
    if (!trimmedName) {
      setModalError('Por favor, informe o nome do centro de resultado.');
      return;
    }

    const trimmedCode = formData.code.trim();
    if (!trimmedCode) {
      setModalError('Por favor, defina um código para o centro de resultado.');
      return;
    }

    try {
      if (editingCC) {
        onUpdateCostCenter({
          ...editingCC,
          name: trimmedName,
          code: trimmedCode,
          description: formData.description.trim(),
          active: formData.active,
        });
      } else {
        onAddCostCenter({
          name: trimmedName,
          code: trimmedCode,
          description: formData.description.trim(),
          active: formData.active,
          company_id: 'comp_nox4',
        });
      }
      setIsModalOpen(false);
    } catch (err) {
      setModalError(
        formatFinancialErrorMessage(
          err,
          editingCC ? 'update' : 'create',
          'cost_center'
        )
      );
    }
  };

  const handleConfirmDelete = () => {
    if (!costCenterToDelete) return;
    setFeedbackError(null);

    // Check if there are transactions linked
    const hasRevenues = revenues.some(
      (r) => r.cost_center_id === costCenterToDelete.id
    );
    const hasExpenses = expenses.some(
      (e) => e.cost_center_id === costCenterToDelete.id
    );

    if (hasRevenues || hasExpenses) {
      setFeedbackError(
        `Não é possível excluir o centro "${costCenterToDelete.name}" porque existem ${
          hasRevenues && hasExpenses
            ? 'receitas e despesas vinculadas'
            : hasRevenues
            ? 'receitas vinculadas'
            : 'despesas vinculadas'
        } a ele. Reatribua os lançamentos antes de excluir.`
      );
      setCostCenterToDelete(null);
      return;
    }

    try {
      onDeleteCostCenter(costCenterToDelete.id);
      setCostCenterToDelete(null);
    } catch (err) {
      setFeedbackError(
        formatFinancialErrorMessage(err, 'delete', 'cost_center')
      );
      setCostCenterToDelete(null);
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
            className="text-rose-500 hover:text-rose-700 text-xs font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600 font-heading">
                Estrutura Organizacional
              </span>
              <span className="px-2.5 py-0.5 text-[10px] bg-blue-50 text-blue-700 border border-blue-200 rounded-full font-medium">
                Centros de Custo & Unidades de Negócio
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-800 mt-1 font-heading tracking-tight">
              Centros de Resultado (BU's)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Acompanhe a receita, despesas diretas e contribuição líquida de cada unidade de negócio
            </p>
          </div>

          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold font-heading shadow-xs transition-all self-start md:self-auto"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Novo Centro de Resultado</span>
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {costCenters.map((cc) => {
          const ccRevenues = revenues.filter((r) => r.cost_center_id === cc.id);
          const ccExpenses = expenses.filter((e) => e.cost_center_id === cc.id);

          const totalNetRevenue = ccRevenues.reduce((s, r) => s + r.net_amount, 0);
          const totalExpenseAmount = ccExpenses.reduce((s, e) => s + e.amount, 0);
          const netContribution = totalNetRevenue - totalExpenseAmount;
          const contributionMargin = totalNetRevenue > 0 ? (netContribution / totalNetRevenue) * 100 : 0;

          return (
            <div
              key={cc.id}
              className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm hover:border-slate-300 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
                      <Layers className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-800 font-heading">{cc.name}</h3>
                      <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                        {cc.code}
                      </span>
                    </div>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                      cc.active
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-slate-100 text-slate-500 border border-slate-200'
                    }`}
                  >
                    {cc.active ? 'Ativo' : 'Inativo'}
                  </span>
                </div>

                {cc.description && (
                  <p className="text-xs text-slate-500 mt-3">
                    {cc.description}
                  </p>
                )}

                <div className="mt-4 pt-3 border-t border-slate-100 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Receita Líquida:</span>
                    <span className="font-mono font-semibold text-emerald-600">
                      {formatCurrency(totalNetRevenue)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Despesas Alocadas:</span>
                    <span className="font-mono font-semibold text-rose-600">
                      {formatCurrency(totalExpenseAmount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                    <span className="text-slate-700 font-bold">Resultado da BU:</span>
                    <span
                      className={`font-mono font-bold ${
                        netContribution >= 0 ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {formatCurrency(netContribution)} ({formatPercent(contributionMargin)})
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  onClick={() => handleOpenModal(cc)}
                  className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Edit2 className="w-3 h-3 text-slate-500" /> Editar
                </button>
                <button
                  onClick={() => setCostCenterToDelete(cc)}
                  title="Excluir Centro de Resultado"
                  className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Add/Edit Cost Center */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-5 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-slate-800 font-heading">
              {editingCC ? 'Editar Centro de Resultado' : 'Novo Centro de Resultado'}
            </h3>

            {/* Modal Error */}
            {modalError && (
              <div className="flex items-start gap-2.5 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs shadow-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <div className="flex-1 font-medium">{modalError}</div>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Nome da Unidade *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
                  placeholder="Ex: NOX4 Performance & Tráfego"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Código (Ex: CC01, BU_MKT)</label>
                <input
                  type="text"
                  required
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Descrição</label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="cc-active"
                  checked={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                  className="rounded bg-slate-50 border-slate-300 text-blue-600 focus:ring-0"
                />
                <label htmlFor="cc-active" className="text-slate-700 cursor-pointer">
                  Centro de Resultado Ativo
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors shadow-xs cursor-pointer"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Cost Center Confirmation Modal */}
      {costCenterToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center mx-auto shadow-xs">
              <ShieldAlert className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-800 font-heading">
                Excluir Centro de Resultado?
              </h3>
              <p className="text-xs text-slate-500">
                Tem certeza que deseja apagar a unidade{' '}
                <strong className="text-slate-800">{costCenterToDelete.name}</strong> ({costCenterToDelete.code})?
              </p>
            </div>

            <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-[11px] text-rose-700 leading-relaxed">
              <strong>Atenção:</strong> A exclusão de um centro de resultado é permanente e impacta relatórios gerenciais e apuração de margem.
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setCostCenterToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold text-xs hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Sim, Apagar Unidade</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
