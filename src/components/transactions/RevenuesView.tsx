import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  MoreHorizontal,
  DollarSign,
  Building2,
  Package,
  Layers,
  Trash2,
  Edit2,
  Calendar,
  XCircle,
} from 'lucide-react';
import { Revenue, Client, Product, CostCenter, Category, TransactionStatus } from '../../types';
import { formatCurrency, formatDate } from '../../lib/utils';
import { normalizeTransactionStatus } from '../../lib/financialEngine';
import { MonthPickerFilter } from '../common/MonthPickerFilter';
import { formatFinancialErrorMessage, formatNullableText } from '../../lib/financialErrorMessages';

interface RevenuesViewProps {
  revenues: Revenue[];
  clients: Client[];
  products: Product[];
  costCenters: CostCenter[];
  categories: Category[];
  selectedMonth?: string;
  onSelectMonth?: (month: string) => void;
  onOpenNewRevenueModal: () => void;
  onEditRevenue: (revenue: Revenue) => void;
  onDeleteRevenue: (id: string) => void;
  onMarkAsReceived: (id: string) => void;
}

export const RevenuesView: React.FC<RevenuesViewProps> = ({
  revenues,
  clients,
  products,
  costCenters,
  categories,
  selectedMonth = '2026-08',
  onSelectMonth,
  onOpenNewRevenueModal,
  onEditRevenue,
  onDeleteRevenue,
  onMarkAsReceived,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [costCenterFilter, setCostCenterFilter] = useState<string>('ALL');
  const [monthFilter, setMonthFilter] = useState<string>(selectedMonth || 'ALL');
  const [revenueToDelete, setRevenueToDelete] = useState<Revenue | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  const handleConfirmDelete = () => {
    if (!revenueToDelete) return;
    try {
      onDeleteRevenue(revenueToDelete.id);
      setFeedbackError(null);
      setRevenueToDelete(null);
    } catch (err) {
      setFeedbackError(formatFinancialErrorMessage(err, 'delete', 'revenue'));
    }
  };

  const handleMarkAsReceivedSafe = (id: string) => {
    try {
      onMarkAsReceived(id);
      setFeedbackError(null);
    } catch (err) {
      setFeedbackError(formatFinancialErrorMessage(err, 'update', 'revenue'));
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

  const filteredRevenues = revenues.filter((rev) => {
    const client = clients.find((c) => c.id === rev.client_id);
    const product = products.find((p) => p.id === rev.product_id);
    const textMatch =
      rev.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (client && client.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (product && product.name.toLowerCase().includes(searchTerm.toLowerCase()));

    const normStatus = normalizeTransactionStatus(rev.status);
    const statusMatch = statusFilter === 'ALL' || normStatus === statusFilter;
    const costCenterMatch = costCenterFilter === 'ALL' || rev.cost_center_id === costCenterFilter;
    const monthMatch =
      monthFilter === 'ALL' ||
      (rev.competence_date && rev.competence_date.startsWith(monthFilter)) ||
      (rev.due_date && rev.due_date.startsWith(monthFilter));

    return textMatch && statusMatch && costCenterMatch && monthMatch;
  });

  const totalGross = filteredRevenues.reduce((acc, r) => acc + (r.gross_amount || 0), 0);
  const totalDeductions = filteredRevenues.reduce(
    (acc, r) => acc + (r.tax_amount || 0) + (r.commission_amount || 0) + (r.other_deductions || 0),
    0
  );
  const totalNet = filteredRevenues.reduce((acc, r) => acc + (r.net_amount || 0), 0);
  const totalReceived = filteredRevenues
    .filter((r) => normalizeTransactionStatus(r.status) === 'received')
    .reduce((acc, r) => acc + (r.net_amount || 0), 0);
  const totalPending = filteredRevenues
    .filter((r) => {
      const s = normalizeTransactionStatus(r.status);
      return s === 'pending' || s === 'overdue';
    })
    .reduce((acc, r) => acc + (r.net_amount || 0), 0);

  const getStatusBadge = (status: string) => {
    const s = normalizeTransactionStatus(status);
    switch (s) {
      case 'received':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" /> Recebido
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3" /> Pendente
          </span>
        );
      case 'overdue':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 animate-pulse">
            <AlertCircle className="w-3 h-3" /> Atrasado
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            <XCircle className="w-3 h-3" /> Cancelado
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            {status}
          </span>
        );
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
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600 font-heading">
                Gestão de Vendas & Entradas
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-800 mt-1 font-heading tracking-tight">
              Receitas & Contratos Operacionais
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Lançamento com cálculo automático de deduções fiscais, comissões e apuração de receita líquida
            </p>
          </div>

          <button
            id="btn-add-new-revenue"
            onClick={onOpenNewRevenueModal}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold font-heading shadow-sm transition-all self-start md:self-auto cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Nova Receita</span>
          </button>
        </div>

        {/* Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 border-t border-slate-100">
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Receita Bruta Total</div>
            <div className="text-lg font-bold text-slate-800 font-heading mt-0.5">
              {formatCurrency(totalGross)}
            </div>
          </div>
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Deduções Fiscais/Comissões</div>
            <div className="text-lg font-bold text-rose-600 font-heading mt-0.5">
              -{formatCurrency(totalDeductions)}
            </div>
          </div>
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Receita Líquida (DRE)</div>
            <div className={`text-lg font-bold font-heading mt-0.5 ${totalNet < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {formatCurrency(totalNet)}
            </div>
          </div>
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Recebido / Em Aberto</div>
            <div className="text-xs font-bold text-slate-700 font-mono mt-1">
              <span className="text-emerald-600">{formatCurrency(totalReceived)}</span> /{' '}
              <span className="text-amber-600">{formatCurrency(totalPending)}</span>
            </div>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por descrição, cliente ou produto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-blue-500 focus:bg-white transition-colors"
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
              <option value="received">Recebido</option>
              <option value="pending">Pendente</option>
              <option value="overdue">Atrasado</option>
              <option value="cancelled">Cancelado</option>
            </select>

            <select
              value={costCenterFilter}
              onChange={(e) => setCostCenterFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 outline-none cursor-pointer"
            >
              <option value="ALL">Todos os Centros</option>
              {costCenters.map((cc) => (
                <option key={cc.id} value={cc.id}>
                  {cc.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Revenues Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 font-heading uppercase tracking-wider">
                <th className="py-3 px-4">Descrição & Cliente</th>
                <th className="py-3 px-4">Produto & Centro</th>
                <th className="py-3 px-4">Competência / Venc.</th>
                <th className="py-3 px-4 text-right">Valor Bruto</th>
                <th className="py-3 px-4 text-right">Deduções</th>
                <th className="py-3 px-4 text-right">Valor Líquido</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredRevenues.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-xs text-slate-500">
                    Nenhuma receita encontrada para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredRevenues.map((rev) => {
                  const client = clients.find((c) => c.id === rev.client_id);
                  const product = products.find((p) => p.id === rev.product_id);
                  const costCenter = costCenters.find((c) => c.id === rev.cost_center_id);
                  const totalDed = (rev.tax_amount || 0) + (rev.commission_amount || 0) + (rev.other_deductions || 0);
                  const isReceived = normalizeTransactionStatus(rev.status) === 'received';

                  return (
                    <tr
                      key={rev.id}
                      className="border-b border-slate-100 hover:bg-slate-50/80 text-xs transition-colors"
                    >
                      {/* Descrição & Cliente */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800">{rev.description}</div>
                        <div className="text-[11px] text-blue-600 flex items-center gap-1 mt-0.5">
                          <Building2 className="w-3 h-3 text-slate-400" />
                          <span>{client ? client.name : 'Cliente Avulso'}</span>
                        </div>
                      </td>

                      {/* Produto & Centro */}
                      <td className="py-3 px-4">
                        <div className="text-slate-700 flex items-center gap-1">
                          <Package className="w-3 h-3 text-slate-400" />
                          <span>{formatNullableText(product?.name, 'Não informado')}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <Layers className="w-3 h-3" />
                          <span>{costCenter ? costCenter.name : 'Geral'}</span>
                        </div>
                      </td>

                      {/* Datas */}
                      <td className="py-3 px-4">
                        <div className="text-slate-700 font-mono text-[11px]">
                          Comp: {formatDate(rev.competence_date)}
                        </div>
                        <div className="text-slate-400 font-mono text-[10px] mt-0.5">
                          Venc: {formatDate(rev.due_date)}
                        </div>
                        {isReceived && rev.received_date && (
                          <div className="text-emerald-600 font-mono text-[10px] mt-0.5">
                            Rec: {formatDate(rev.received_date)}
                          </div>
                        )}
                      </td>

                      {/* Valores */}
                      <td className="py-3 px-4 text-right font-mono font-medium text-slate-700">
                        {formatCurrency(rev.gross_amount)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-rose-600">
                        {totalDed > 0 ? `-${formatCurrency(totalDed)}` : 'R$ 0,00'}
                      </td>
                      <td className={`py-3 px-4 text-right font-mono font-bold ${rev.net_amount < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {formatCurrency(rev.net_amount)}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center">
                        {getStatusBadge(rev.status)}
                      </td>

                      {/* Ações */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {!isReceived && (
                            <button
                              title="Marcar como Recebido"
                              onClick={() => handleMarkAsReceivedSafe(rev.id)}
                              className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-colors cursor-pointer"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            title="Editar Receita"
                            onClick={() => onEditRevenue(rev)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            title="Excluir"
                            onClick={() => setRevenueToDelete(rev)}
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

      {/* Modal de Confirmação de Exclusão de Receita */}
      {revenueToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800 font-heading">
                  Excluir Receita
                </h3>
                <p className="text-xs text-slate-500">
                  Esta ação removerá o título a receber selecionado.
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1.5">
              <div className="font-semibold text-slate-800">{revenueToDelete.description}</div>
              <div className="text-slate-600">
                Valor Líquido: <span className="font-bold text-slate-800">{formatCurrency(revenueToDelete.net_amount)}</span>
              </div>
            </div>

            <p className="text-xs text-slate-600">
              Deseja realmente excluir este lançamento financeiro? A exclusão afetará o cálculo de DRE e fluxo de caixa.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setRevenueToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition-colors cursor-pointer"
              >
                Sim, Excluir Receita
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
