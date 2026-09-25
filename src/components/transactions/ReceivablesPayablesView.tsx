import React, { useState, useEffect } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  AlertCircle,
  Search,
  Filter,
  DollarSign,
  Building2,
  Download,
  Plus,
  Edit2,
} from 'lucide-react';
import { Revenue, Expense, Client, CostCenter, TransactionStatus } from '../../types';
import { formatCurrency, formatDate, downloadCSV } from '../../lib/utils';
import { normalizeTransactionStatus } from '../../lib/financialEngine';
import { MonthPickerFilter } from '../common/MonthPickerFilter';
import { formatFinancialErrorMessage } from '../../lib/financialErrorMessages';

interface ReceivablesPayablesViewProps {
  type: 'receivables' | 'payables';
  revenues: Revenue[];
  expenses: Expense[];
  clients: Client[];
  costCenters: CostCenter[];
  selectedMonth?: string;
  onSelectMonth?: (month: string) => void;
  onMarkAsReceived: (id: string) => void;
  onMarkAsPaid: (id: string) => void;
  onOpenNewTransaction?: () => void;
  onEditReceivable?: (revenue: Revenue) => void;
  onEditPayable?: (expense: Expense) => void;
}

export const ReceivablesPayablesView: React.FC<ReceivablesPayablesViewProps> = ({
  type,
  revenues,
  expenses,
  clients,
  costCenters,
  selectedMonth = '2026-08',
  onSelectMonth,
  onMarkAsReceived,
  onMarkAsPaid,
  onOpenNewTransaction,
  onEditReceivable,
  onEditPayable,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [monthFilter, setMonthFilter] = useState<string>(selectedMonth || 'ALL');
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

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

  const isReceivables = type === 'receivables';

  const handleSafeMarkAsReceived = (id: string) => {
    try {
      setFeedbackError(null);
      onMarkAsReceived(id);
    } catch (err) {
      setFeedbackError(formatFinancialErrorMessage(err, 'update', 'revenue'));
    }
  };

  const handleSafeMarkAsPaid = (id: string) => {
    try {
      setFeedbackError(null);
      onMarkAsPaid(id);
    } catch (err) {
      setFeedbackError(formatFinancialErrorMessage(err, 'update', 'expense'));
    }
  };

  // Receivables items
  const receivableItems = revenues.map((r) => {
    const client = clients.find((c) => c.id === r.client_id);
    const normStatus = normalizeTransactionStatus(r.status);
    const isSettled = normStatus === 'received';
    const isOverdue =
      normStatus === 'overdue' ||
      (!isSettled && normStatus !== 'cancelled' && r.due_date && new Date(r.due_date + 'T23:59:59') < new Date());

    return {
      id: r.id,
      title: r.description,
      counterpart: client ? client.name : 'Cliente Avulso',
      dueDate: r.due_date,
      competenceDate: r.competence_date,
      amount: r.net_amount,
      grossAmount: r.gross_amount,
      status: normStatus,
      isOverdue,
      isSettled,
      paymentDate: r.received_date || r.payment_date,
    };
  });

  // Payables items
  const payableItems = expenses.map((e) => {
    const normStatus = normalizeTransactionStatus(e.status);
    const isSettled = normStatus === 'paid';
    const isOverdue =
      normStatus === 'overdue' ||
      (!isSettled && normStatus !== 'cancelled' && e.due_date && new Date(e.due_date + 'T23:59:59') < new Date());

    return {
      id: e.id,
      title: e.description,
      counterpart: e.supplier || 'Fornecedor',
      dueDate: e.due_date,
      competenceDate: e.competence_date,
      amount: e.amount,
      grossAmount: e.amount,
      status: normStatus,
      isOverdue,
      isSettled,
      paymentDate: e.paid_date || e.payment_date,
    };
  });

  const rawItems = isReceivables ? receivableItems : payableItems;

  const items = rawItems.filter((it) => {
    const matchSearch =
      it.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      it.counterpart.toLowerCase().includes(searchTerm.toLowerCase());

    const matchStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'pending' && (it.status === 'pending' || (it.isOverdue && !it.isSettled))) ||
      (statusFilter === 'settled' && it.isSettled) ||
      (statusFilter === 'overdue' && it.isOverdue && !it.isSettled);

    const matchMonth =
      monthFilter === 'ALL' ||
      (it.dueDate && it.dueDate.startsWith(monthFilter)) ||
      (it.competenceDate && it.competenceDate.startsWith(monthFilter));

    return matchSearch && matchStatus && matchMonth;
  });

  const totalAmount = rawItems.reduce((acc, it) => acc + (it.amount || 0), 0);
  const totalSettled = rawItems
    .filter((it) => it.isSettled)
    .reduce((acc, it) => acc + (it.amount || 0), 0);
  const totalPending = rawItems
    .filter((it) => !it.isSettled && !it.isOverdue)
    .reduce((acc, it) => acc + (it.amount || 0), 0);
  const totalOverdue = rawItems
    .filter((it) => it.isOverdue && !it.isSettled)
    .reduce((acc, it) => acc + (it.amount || 0), 0);

  const handleExportCSV = () => {
    const headers = ['Título', isReceivables ? 'Cliente' : 'Fornecedor', 'Competência', 'Vencimento', 'Valor (R$)', 'Status'];
    const rows = items.map((it) => [
      it.title,
      it.counterpart,
      it.competenceDate,
      it.dueDate,
      it.amount.toFixed(2),
      it.status,
    ]);
    downloadCSV(
      `${isReceivables ? 'Contas_Receber' : 'Contas_Pagar'}_NOX4.csv`,
      [headers, ...rows]
    );
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span
                className={`text-xs font-bold uppercase tracking-wider font-heading ${
                  isReceivables ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {isReceivables ? 'Gestão de Recebíveis & Cobrança' : 'Gestão de Obrigações & Pagamentos'}
              </span>
              <span className="px-2.5 py-0.5 text-[10px] bg-slate-100 text-slate-700 rounded-full font-medium">
                Aging & Controle de Vencimentos
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-800 mt-1 font-heading tracking-tight">
              {isReceivables ? 'Contas a Receber' : 'Contas a Pagar'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isReceivables
                ? 'Monitore parcelas, prazos de recebimento, faturas pendentes e controle de inadimplência.'
                : 'Programe quitações a fornecedores, salários, tributos e despesas para evitar juros.'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {onOpenNewTransaction && (
              <button
                id={isReceivables ? 'btn-add-receivable' : 'btn-add-payable'}
                onClick={onOpenNewTransaction}
                className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white rounded-lg shadow-xs transition-colors font-heading cursor-pointer ${
                  isReceivables
                    ? 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800'
                    : 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isReceivables ? '+ Novo Título a Receber' : '+ Nova Conta a Pagar'}</span>
              </button>
            )}

            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Exportar</span>
            </button>
          </div>
        </div>

        {/* Feedback Error Banner */}
        {feedbackError && (
          <div className="flex items-start justify-between gap-3 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs shadow-xs animate-in fade-in">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <div className="font-medium">{feedbackError}</div>
            </div>
            <button
              onClick={() => setFeedbackError(null)}
              className="text-rose-500 hover:text-rose-800 text-xs font-bold px-1.5 py-0.5 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* 4 Financial Strips: Total, Liquidado, A Vencer, Vencido */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 border-t border-slate-100">
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Volume Total</div>
            <div className="text-lg font-bold text-slate-800 font-heading mt-0.5">
              {formatCurrency(totalAmount)}
            </div>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              {isReceivables ? 'Total Recebido' : 'Total Quitado'}
            </div>
            <div className="text-lg font-bold text-emerald-600 font-heading mt-0.5">
              {formatCurrency(totalSettled)}
            </div>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">A Vencer (No Prazo)</div>
            <div className="text-lg font-bold text-amber-600 font-heading mt-0.5">
              {formatCurrency(totalPending)}
            </div>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              {isReceivables ? 'Inadimplente / Vencido' : 'Vencido em Aberto'}
            </div>
            <div className="text-lg font-bold text-rose-600 font-heading mt-0.5">
              {formatCurrency(totalOverdue)}
            </div>
          </div>
        </div>

        {/* Search & Status Filter */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={`Buscar por título, ${isReceivables ? 'cliente' : 'fornecedor'}...`}
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
              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700 outline-none cursor-pointer w-full sm:w-auto"
            >
              <option value="ALL">Todos os Títulos</option>
              <option value="pending">A Vencer / Pendentes</option>
              <option value="overdue">Vencidos (Atrasados)</option>
              <option value="settled">{isReceivables ? 'Recebidos' : 'Pagos'}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 font-heading uppercase tracking-wider">
                <th className="py-3 px-4">Título & Descrição</th>
                <th className="py-3 px-4">{isReceivables ? 'Cliente' : 'Fornecedor'}</th>
                <th className="py-3 px-4">Vencimento</th>
                <th className="py-3 px-4 text-right">Valor</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Liquidação</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                        {isReceivables ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                      </div>
                      <p className="text-xs font-medium text-slate-600">
                        Nenhum título encontrado com os filtros selecionados.
                      </p>
                      {onOpenNewTransaction && (
                        <button
                          onClick={onOpenNewTransaction}
                          className={`mt-1 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white ${
                            isReceivables ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                          } transition-colors cursor-pointer shadow-xs`}
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>{isReceivables ? 'Adicionar Novo Título a Receber' : 'Adicionar Nova Conta a Pagar'}</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((it) => {
                  const isSettled = it.isSettled;
                  return (
                    <tr
                      key={it.id}
                      className="border-b border-slate-100 hover:bg-slate-50/80 text-xs transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800">{it.title}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          Competência: {formatDate(it.competenceDate)}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="text-slate-700 font-medium">{it.counterpart}</div>
                      </td>

                      <td className="py-3 px-4 font-mono">
                        <span className={it.isOverdue && !isSettled ? 'text-rose-600 font-bold' : 'text-slate-700'}>
                          {formatDate(it.dueDate)}
                        </span>
                      </td>

                      <td className={`py-3 px-4 text-right font-mono font-bold ${it.amount < 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                        {formatCurrency(it.amount)}
                      </td>

                      <td className="py-3 px-4 text-center">
                        {isSettled ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" /> {isReceivables ? 'Recebido' : 'Pago'}
                          </span>
                        ) : it.isOverdue ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 animate-pulse">
                            <AlertTriangle className="w-3 h-3" /> Vencido
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3 h-3" /> A Vencer
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {!isSettled ? (
                            <button
                              title={isReceivables ? 'Baixar Recebimento' : 'Baixar Pagamento'}
                              onClick={() =>
                                isReceivables ? handleSafeMarkAsReceived(it.id) : handleSafeMarkAsPaid(it.id)
                              }
                              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                                isReceivables
                                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                                  : 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs'
                              }`}
                            >
                              {isReceivables ? 'Baixar' : 'Pagar'}
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-mono">
                              {it.paymentDate ? formatDate(it.paymentDate) : 'Liquidado'}
                            </span>
                          )}

                          {isReceivables && onEditReceivable && (
                            <button
                              title="Editar Título a Receber"
                              type="button"
                              onClick={() => {
                                const originalRev = revenues.find((r) => r.id === it.id);
                                if (originalRev) onEditReceivable(originalRev);
                              }}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {!isReceivables && onEditPayable && (
                            <button
                              title="Editar Conta a Pagar"
                              type="button"
                              onClick={() => {
                                const originalExp = expenses.find((e) => e.id === it.id);
                                if (originalExp) onEditPayable(originalExp);
                              }}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}
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
    </div>
  );
};
