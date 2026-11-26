import React, { useMemo, useState } from 'react';
import { PieChart as PieIcon, Download, Search, ChevronDown, ChevronRight, X, Filter } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Expense, Category, CostCenter } from '../../types';
import { formatCurrency, formatDate, getCurrentYearMonth, EXPENSE_GROUP_LABELS, getGroupLabel } from '../../lib/utils';
import { normalizeTransactionStatus } from '../../lib/financialEngine';
import { PAYMENT_METHOD_OPTIONS, PAYMENT_METHOD_NONE, getPaymentMethodLabel } from '../../lib/paymentMethods';

interface ExpenseBreakdownViewProps {
  expenses: Expense[];
  categories: Category[];
  costCenters: CostCenter[];
  selectedMonth?: string;
  onEditExpense?: (expense: Expense) => void;
}

type DateBase = 'competence' | 'payment';
type StatusFilter = 'ALL' | 'paid' | 'open' | 'overdue';

const BAR_COLORS = ['#2563EB', '#0EA5E9', '#14B8A6', '#8B5CF6', '#F59E0B', '#EC4899', '#64748B', '#22C55E'];

const monthOf = (d?: string | null) => (d ? String(d).slice(0, 7) : '');
const addMonths = (ym: string, n: number) => {
  const [y, m] = ym.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`;
};
const todayIso = () => new Date().toISOString().slice(0, 10);

/** Situação real do lançamento: pendente com vencimento passado conta como vencido. */
function situationOf(e: Expense): 'paid' | 'open' | 'overdue' | 'cancelled' {
  const s = normalizeTransactionStatus(e.status);
  if (s === 'cancelled') return 'cancelled';
  if (s === 'paid' || s === 'received') return 'paid';
  if (s === 'overdue') return 'overdue';
  if (e.due_date && e.due_date < todayIso()) return 'overdue';
  return 'open';
}

const SITUATION_LABEL: Record<string, string> = { paid: 'Pago', open: 'A pagar', overdue: 'Vencido', cancelled: 'Cancelado' };
const SITUATION_CLASS: Record<string, string> = {
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  open: 'bg-amber-50 text-amber-700 border-amber-200',
  overdue: 'bg-rose-50 text-rose-700 border-rose-200',
  cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
};

export const ExpenseBreakdownView: React.FC<ExpenseBreakdownViewProps> = ({
  expenses,
  categories,
  costCenters,
  selectedMonth = getCurrentYearMonth(),
  onEditExpense,
}) => {
  const [fromMonth, setFromMonth] = useState(selectedMonth);
  const [toMonth, setToMonth] = useState(selectedMonth);
  const [dateBase, setDateBase] = useState<DateBase>('competence');
  const [groupFilter, setGroupFilter] = useState('ALL');
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [catSearch, setCatSearch] = useState('');
  const [catOpen, setCatOpen] = useState(false);
  const [paymentFilter, setPaymentFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [costCenterFilter, setCostCenterFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const expenseCategories = useMemo(
    () => categories.filter((c) => String(c.type) !== 'REVENUE' && c.group !== 'revenue'),
    [categories]
  );
  const catById = useMemo(() => new Map(expenseCategories.map((c) => [c.id, c])), [expenseCategories]);
  const ccById = useMemo(() => new Map(costCenters.map((c) => [c.id, c])), [costCenters]);
  const groupsInUse = useMemo(
    () => Array.from(new Set(expenseCategories.map((c) => c.group).filter(Boolean))) as string[],
    [expenseCategories]
  );

  const quickRange = (kind: 'month' | '3m' | 'year') => {
    const cur = getCurrentYearMonth();
    if (kind === 'month') { setFromMonth(cur); setToMonth(cur); }
    if (kind === '3m') { setFromMonth(addMonths(cur, -2)); setToMonth(cur); }
    if (kind === 'year') { setFromMonth(`${cur.slice(0, 4)}-01`); setToMonth(cur); }
  };

  const from = fromMonth <= toMonth ? fromMonth : toMonth;
  const to = fromMonth <= toMonth ? toMonth : fromMonth;

  // Lançamentos dentro do período (base de data escolhida), sem os cancelados
  const inPeriod = useMemo(
    () =>
      expenses.filter((e) => {
        if (situationOf(e) === 'cancelled') return false;
        const ref = dateBase === 'competence' ? e.competence_date : e.paid_date || e.payment_date;
        if (dateBase === 'payment' && !ref) return false;
        const m = monthOf(ref);
        return m >= from && m <= to;
      }),
    [expenses, dateBase, from, to]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return inPeriod.filter((e) => {
      const cat = catById.get(e.category_id);
      if (groupFilter !== 'ALL' && (cat?.group || '') !== groupFilter) return false;
      if (selectedCats.length && !selectedCats.includes(e.category_id)) return false;
      if (paymentFilter === PAYMENT_METHOD_NONE && e.payment_method) return false;
      if (paymentFilter !== 'ALL' && paymentFilter !== PAYMENT_METHOD_NONE && e.payment_method !== paymentFilter) return false;
      if (statusFilter !== 'ALL' && situationOf(e) !== statusFilter) return false;
      if (costCenterFilter !== 'ALL' && (e.cost_center_id || '') !== costCenterFilter) return false;
      if (q && !`${e.description} ${e.supplier || ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [inPeriod, catById, groupFilter, selectedCats, paymentFilter, statusFilter, costCenterFilter, search]);

  const totalPeriod = inPeriod.reduce((s, e) => s + Number(e.amount || 0), 0);
  const totalFiltered = filtered.reduce((s, e) => s + Number(e.amount || 0), 0);

  const byCategory = useMemo(() => {
    const map = new Map<string, { id: string; name: string; group: string; total: number; count: number; items: Expense[] }>();
    for (const e of filtered) {
      const cat = catById.get(e.category_id);
      const key = e.category_id || 'sem';
      const row = map.get(key) || { id: key, name: cat?.name || 'Sem categoria', group: getGroupLabel(cat?.group), total: 0, count: 0, items: [] };
      row.total += Number(e.amount || 0);
      row.count += 1;
      row.items.push(e);
      map.set(key, row);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filtered, catById]);

  const byPayment = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of filtered) map.set(e.payment_method || PAYMENT_METHOD_NONE, (map.get(e.payment_method || PAYMENT_METHOD_NONE) || 0) + Number(e.amount || 0));
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const activeFilters =
    (groupFilter !== 'ALL' ? 1 : 0) + (selectedCats.length ? 1 : 0) + (paymentFilter !== 'ALL' ? 1 : 0) +
    (statusFilter !== 'ALL' ? 1 : 0) + (costCenterFilter !== 'ALL' ? 1 : 0) + (search.trim() ? 1 : 0);

  const clearFilters = () => {
    setGroupFilter('ALL'); setSelectedCats([]); setPaymentFilter('ALL');
    setStatusFilter('ALL'); setCostCenterFilter('ALL'); setSearch('');
  };

  const exportCsv = () => {
    const header = ['Data competência', 'Vencimento', 'Pago em', 'Descrição', 'Fornecedor', 'Categoria', 'Grupo DRE', 'Forma de pagamento', 'Centro de resultado', 'Situação', 'Valor'];
    const rows = filtered.map((e) => {
      const cat = catById.get(e.category_id);
      return [
        e.competence_date, e.due_date, e.paid_date || e.payment_date || '', e.description, e.supplier || '',
        cat?.name || '', getGroupLabel(cat?.group), getPaymentMethodLabel(e.payment_method),
        ccById.get(e.cost_center_id || '')?.name || '', SITUATION_LABEL[situationOf(e)],
        Number(e.amount || 0).toFixed(2).replace('.', ','),
      ];
    });
    const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gastos-por-categoria_${from}_a_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const visibleCats = expenseCategories.filter((c) => c.name.toLowerCase().includes(catSearch.trim().toLowerCase()));
  const chartData = byCategory.slice(0, 8).map((r) => ({ name: r.name.length > 34 ? r.name.slice(0, 33) + '…' : r.name, total: Math.round(r.total * 100) / 100 }));
  const selectCls = 'w-full px-2.5 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 outline-none focus:border-blue-500 cursor-pointer';
  const labelCls = 'block text-[11px] font-semibold text-slate-500 mb-1';

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 font-heading flex items-center gap-2">
            <PieIcon className="w-5 h-5 text-blue-600" /> Gastos por Categoria
          </h2>
          <p className="text-xs text-slate-500">
            Veja para onde vai o dinheiro. Filtre por categoria, grupo da DRE, forma de pagamento, situação ou fornecedor.
          </p>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          disabled={!filtered.length}
          className="self-start md:self-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
        >
          <Download className="w-4 h-4" /> Exportar CSV
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <span className={labelCls}>De</span>
            <input type="month" value={fromMonth} onChange={(e) => e.target.value && setFromMonth(e.target.value)} className={selectCls} />
          </div>
          <div>
            <span className={labelCls}>Até</span>
            <input type="month" value={toMonth} onChange={(e) => e.target.value && setToMonth(e.target.value)} className={selectCls} />
          </div>
          <div className="flex gap-1.5">
            {([['month', 'Mês atual'], ['3m', 'Últimos 3 meses'], ['year', 'Ano atual']] as const).map(([k, l]) => (
              <button key={k} type="button" onClick={() => quickRange(k)} className="px-2.5 py-2 rounded-lg border border-slate-200 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer">
                {l}
              </button>
            ))}
          </div>
          <div>
            <span className={labelCls}>Considerar a data de</span>
            <div className="flex rounded-lg border border-slate-200 overflow-hidden text-[11px] font-semibold">
              <button type="button" onClick={() => setDateBase('competence')} className={`px-2.5 py-2 cursor-pointer ${dateBase === 'competence' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600'}`}>Competência (DRE)</button>
              <button type="button" onClick={() => setDateBase('payment')} className={`px-2.5 py-2 cursor-pointer ${dateBase === 'payment' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600'}`}>Pagamento (caixa)</button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="relative lg:col-span-2">
            <span className={labelCls}>Categorias</span>
            <button type="button" onClick={() => setCatOpen((o) => !o)} className={`${selectCls} flex items-center justify-between text-left`}>
              <span className="truncate">
                {selectedCats.length === 0 ? 'Todas as categorias' : selectedCats.length === 1 ? catById.get(selectedCats[0])?.name : `${selectedCats.length} categorias`}
              </span>
              <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
            </button>
            {catOpen && (
              <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg p-2 space-y-1">
                <input value={catSearch} onChange={(e) => setCatSearch(e.target.value)} placeholder="Buscar categoria..." className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs outline-none" />
                <div className="max-h-56 overflow-y-auto">
                  {visibleCats.map((c) => (
                    <label key={c.id} className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-slate-50 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedCats.includes(c.id)}
                        onChange={() => setSelectedCats((cur) => (cur.includes(c.id) ? cur.filter((x) => x !== c.id) : [...cur, c.id]))}
                      />
                      <span className="truncate">{c.name}</span>
                    </label>
                  ))}
                  {!visibleCats.length && <p className="text-[11px] text-slate-400 px-1.5 py-1">Nenhuma categoria encontrada.</p>}
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-100">
                  <button type="button" onClick={() => setSelectedCats([])} className="text-[11px] text-slate-500 hover:text-slate-800 cursor-pointer">Limpar</button>
                  <button type="button" onClick={() => setCatOpen(false)} className="text-[11px] font-semibold text-blue-600 cursor-pointer">Aplicar</button>
                </div>
              </div>
            )}
          </div>
          <div>
            <span className={labelCls}>Grupo da DRE</span>
            <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)} className={selectCls}>
              <option value="ALL">Todos os grupos</option>
              {groupsInUse.map((g) => <option key={g} value={g}>{EXPENSE_GROUP_LABELS[g] || getGroupLabel(g)}</option>)}
            </select>
          </div>
          <div>
            <span className={labelCls}>Forma de pagamento</span>
            <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)} className={selectCls}>
              <option value="ALL">Todas</option>
              {PAYMENT_METHOD_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              <option value={PAYMENT_METHOD_NONE}>Não informada</option>
            </select>
          </div>
          <div>
            <span className={labelCls}>Situação</span>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)} className={selectCls}>
              <option value="ALL">Todas</option>
              <option value="paid">Pago</option>
              <option value="open">A pagar</option>
              <option value="overdue">Vencido</option>
            </select>
          </div>
          <div>
            <span className={labelCls}>Centro de resultado</span>
            <select value={costCenterFilter} onChange={(e) => setCostCenterFilter(e.target.value)} className={selectCls}>
              <option value="ALL">Todos</option>
              {costCenters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por descrição ou fornecedor..." className={`${selectCls} pl-8 cursor-text`} />
          </div>
          {activeFilters > 0 && (
            <button type="button" onClick={clearFilters} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer">
              <X className="w-3.5 h-3.5" /> Limpar {activeFilters} filtro{activeFilters > 1 ? 's' : ''}
            </button>
          )}
        </div>
      </div>

      {/* Indicadores */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <p className="text-[11px] font-semibold text-slate-500">Total filtrado</p>
          <p className="text-xl font-extrabold text-rose-600 mt-1">{formatCurrency(totalFiltered)}</p>
          <p className="text-[11px] text-slate-400">{filtered.length} lançamento{filtered.length === 1 ? '' : 's'}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <p className="text-[11px] font-semibold text-slate-500">% do total de despesas</p>
          <p className="text-xl font-extrabold text-slate-900 mt-1">{totalPeriod > 0 ? `${((totalFiltered / totalPeriod) * 100).toFixed(1).replace('.', ',')}%` : '—'}</p>
          <p className="text-[11px] text-slate-400">de {formatCurrency(totalPeriod)} no período</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <p className="text-[11px] font-semibold text-slate-500">Maior categoria</p>
          <p className="text-sm font-bold text-slate-900 mt-1 truncate">{byCategory[0]?.name || '—'}</p>
          <p className="text-[11px] text-slate-400">{byCategory[0] ? formatCurrency(byCategory[0].total) : ''}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <p className="text-[11px] font-semibold text-slate-500">Por forma de pagamento</p>
          <div className="mt-1 space-y-0.5">
            {byPayment.slice(0, 3).map(([k, v]) => (
              <div key={k} className="flex justify-between text-[11px] text-slate-600">
                <span className="truncate">{k === PAYMENT_METHOD_NONE ? 'Não informada' : getPaymentMethodLabel(k)}</span>
                <span className="font-semibold">{formatCurrency(v)}</span>
              </div>
            ))}
            {!byPayment.length && <p className="text-sm text-slate-400">—</p>}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center shadow-sm">
          <Filter className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-sm font-semibold text-slate-700 mt-2">Nenhuma despesa com esses filtros</p>
          <p className="text-xs text-slate-500">Mude o período ou limpe os filtros.</p>
        </div>
      ) : (
        <>
          {/* Gráfico */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <p className="text-xs font-bold text-slate-700 mb-2">Maiores categorias</p>
            <div style={{ width: '100%', height: Math.max(160, chartData.length * 38) }}>
              <ResponsiveContainer>
                <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={240} tick={{ fontSize: 11, fill: '#475569' }} />
                  <Tooltip formatter={(v: any) => formatCurrency(Number(v))} />
                  <Bar dataKey="total" radius={[0, 6, 6, 0]}>
                    {chartData.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Tabela por categoria */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-4 py-2.5">Categoria</th>
                    <th className="text-left px-4 py-2.5 hidden md:table-cell">Grupo da DRE</th>
                    <th className="text-right px-4 py-2.5">Lançamentos</th>
                    <th className="text-right px-4 py-2.5">% do filtro</th>
                    <th className="text-right px-4 py-2.5">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {byCategory.map((row) => (
                    <React.Fragment key={row.id}>
                      <tr onClick={() => setExpanded((cur) => (cur === row.id ? null : row.id))} className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer">
                        <td className="px-4 py-2.5 font-semibold text-slate-800">
                          <span className="inline-flex items-center gap-1.5">
                            {expanded === row.id ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                            {row.name}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-slate-500 hidden md:table-cell">{row.group}</td>
                        <td className="px-4 py-2.5 text-right text-slate-600">{row.count}</td>
                        <td className="px-4 py-2.5 text-right text-slate-600">{totalFiltered > 0 ? `${((row.total / totalFiltered) * 100).toFixed(1).replace('.', ',')}%` : '—'}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-rose-600">{formatCurrency(row.total)}</td>
                      </tr>
                      {expanded === row.id &&
                        row.items
                          .slice()
                          .sort((a, b) => String(b.competence_date).localeCompare(String(a.competence_date)))
                          .map((e) => {
                            const sit = situationOf(e);
                            return (
                              <tr key={e.id} className="bg-slate-50/60 border-t border-slate-100">
                                <td className="pl-10 pr-4 py-2 text-slate-700">
                                  <div className="font-medium">{e.description}</div>
                                  <div className="text-[11px] text-slate-400">
                                    {e.supplier ? `${e.supplier} · ` : ''}{getPaymentMethodLabel(e.payment_method)}
                                  </div>
                                </td>
                                <td className="px-4 py-2 text-slate-500 hidden md:table-cell">
                                  {formatDate(dateBase === 'competence' ? e.competence_date : e.paid_date || e.payment_date)}
                                </td>
                                <td className="px-4 py-2 text-right">
                                  <span className={`inline-block px-2 py-0.5 rounded-full border text-[10px] font-semibold ${SITUATION_CLASS[sit]}`}>{SITUATION_LABEL[sit]}</span>
                                </td>
                                <td className="px-4 py-2 text-right">
                                  {onEditExpense && (
                                    <button type="button" onClick={(ev) => { ev.stopPropagation(); onEditExpense(e); }} className="text-[11px] font-semibold text-blue-600 hover:underline cursor-pointer">
                                      Editar
                                    </button>
                                  )}
                                </td>
                                <td className="px-4 py-2 text-right font-semibold text-slate-700">{formatCurrency(Number(e.amount || 0))}</td>
                              </tr>
                            );
                          })}
                    </React.Fragment>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-50">
                    <td className="px-4 py-2.5 font-bold text-slate-800" colSpan={2}>Total</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-slate-600">{filtered.length}</td>
                    <td className="px-4 py-2.5 text-right text-slate-600">100%</td>
                    <td className="px-4 py-2.5 text-right font-extrabold text-rose-600">{formatCurrency(totalFiltered)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}

      {paymentFilter !== 'ALL' && byPayment.some(([k]) => k === PAYMENT_METHOD_NONE) === false && inPeriod.some((e) => !e.payment_method) && (
        <p className="text-[11px] text-slate-500">
          Lançamentos antigos sem forma de pagamento não entram no filtro de forma de pagamento. Edite o lançamento para informar.
        </p>
      )}
    </div>
  );
};
