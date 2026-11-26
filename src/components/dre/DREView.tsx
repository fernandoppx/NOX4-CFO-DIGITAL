import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FileSpreadsheet,
  Download,
  Filter,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Info,
  Calendar,
  ListTree,
  Search,
  X,
  Printer,
} from 'lucide-react';
import { DREStatement, DRELineItem, Revenue, Expense, RevenueCategory, ExpenseCategory } from '../../types';
import { formatCurrency, formatPercent, downloadCSV, EXPENSE_GROUP_LABELS, getGroupLabel } from '../../lib/utils';
import { isCancelledStatus } from '../../lib/financialEngine';
import { MonthPickerFilter } from '../common/MonthPickerFilter';

interface DREViewProps {
  currentDRE: DREStatement;
  previousDRE: DREStatement | null;
  revenues: Revenue[];
  expenses: Expense[];
  revenueCategories: RevenueCategory[];
  expenseCategories: ExpenseCategory[];
  selectedMonth: string;
  onSelectMonth: (month: string) => void;
}

export const DREView: React.FC<DREViewProps> = ({
  currentDRE,
  previousDRE,
  revenues,
  expenses,
  revenueCategories,
  expenseCategories,
  selectedMonth,
  onSelectMonth,
}) => {
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({
    '1': true,
    '2': true,
    '4': true,
    '6': true,
    '7': true,
    '8': true,
    '12': true,
  });

  const [compareWithPrevious, setCompareWithPrevious] = useState(true);

  // ---------- Filtro por Plano de Contas ----------
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [accountSearch, setAccountSearch] = useState('');
  const accountMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!accountMenuOpen) return;
    const close = (ev: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(ev.target as Node)) setAccountMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [accountMenuOpen]);

  type AccountOption = { id: string; name: string; kind: 'revenue' | 'expense'; groupLabel: string };

  const accountOptions = useMemo<AccountOption[]>(() => {
    const revs: AccountOption[] = revenueCategories
      .filter((c) => c.active !== false)
      .map((c) => ({ id: c.id, name: c.name, kind: 'revenue', groupLabel: c.type === 'financial' ? 'Receitas Financeiras' : 'Receitas' }));
    const exps: AccountOption[] = expenseCategories
      .filter((c) => c.active !== false)
      .map((c) => ({ id: c.id, name: c.name, kind: 'expense', groupLabel: EXPENSE_GROUP_LABELS[c.group] || getGroupLabel(c.group) }));
    return [...revs, ...exps];
  }, [revenueCategories, expenseCategories]);

  const accountGroups = useMemo(() => {
    const term = accountSearch.trim().toLowerCase();
    const map = new Map<string, AccountOption[]>();
    accountOptions
      .filter((a) => !term || a.name.toLowerCase().includes(term) || a.groupLabel.toLowerCase().includes(term))
      .forEach((a) => {
        if (!map.has(a.groupLabel)) map.set(a.groupLabel, []);
        map.get(a.groupLabel)!.push(a);
      });
    return Array.from(map.entries());
  }, [accountOptions, accountSearch]);

  const toggleAccount = (id: string) =>
    setSelectedAccountIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const previousMonth = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, [selectedMonth]);

  // Mesmas regras da DRE: competência no mês, sem cancelados, sem movimentação patrimonial
  const accountRows = useMemo(() => {
    if (selectedAccountIds.length === 0) return [];
    const sumFor = (opt: AccountOption, month: string) => {
      if (opt.kind === 'revenue') {
        const list = revenues.filter(
          (r) => r.category_id === opt.id && !isCancelledStatus(r.status) && (r.competence_date || '').startsWith(month)
        );
        return { amount: list.reduce((s, r) => s + (r.gross_amount || 0), 0), count: list.length, outside: 0 };
      }
      const list = expenses.filter(
        (e) => e.category_id === opt.id && !isCancelledStatus(e.status) && (e.competence_date || '').startsWith(month)
      );
      const inDre = list.filter((e) => !e.is_equity_movement);
      return {
        amount: inDre.reduce((s, e) => s + (e.amount || 0), 0),
        count: inDre.length,
        outside: list.length - inDre.length,
      };
    };
    return selectedAccountIds
      .map((id) => accountOptions.find((a) => a.id === id))
      .filter((a): a is AccountOption => !!a)
      .map((opt) => {
        const cur = sumFor(opt, selectedMonth);
        const prev = sumFor(opt, previousMonth);
        return { ...opt, amount: cur.amount, count: cur.count, outside: cur.outside, previous: prev.amount };
      });
  }, [selectedAccountIds, accountOptions, revenues, expenses, selectedMonth, previousMonth]);

  const isAccountMode = accountRows.length > 0;
  const accountTotals = useMemo(() => {
    const rev = accountRows.filter((r) => r.kind === 'revenue');
    const exp = accountRows.filter((r) => r.kind === 'expense');
    const sum = (list: typeof accountRows, key: 'amount' | 'previous') => list.reduce((s, r) => s + r[key], 0);
    const onlyExp = rev.length === 0;
    const onlyRev = exp.length === 0;
    const current = onlyExp ? sum(exp, 'amount') : onlyRev ? sum(rev, 'amount') : sum(rev, 'amount') - sum(exp, 'amount');
    const previous = onlyExp ? sum(exp, 'previous') : onlyRev ? sum(rev, 'previous') : sum(rev, 'previous') - sum(exp, 'previous');
    const label = onlyExp ? 'Total das despesas' : onlyRev ? 'Total das receitas' : 'Receitas − despesas';
    const outside = accountRows.reduce((s, r) => s + r.outside, 0);
    const count = accountRows.reduce((s, r) => s + r.count, 0);
    return { current, previous, label, outside, count };
  }, [accountRows]);

  const pctOfNet = (v: number) => (currentDRE.net_revenue !== 0 ? formatPercent((v / currentDRE.net_revenue) * 100) : '—');
  const momText = (cur: number, prev: number) => (prev !== 0 ? `${(((cur - prev) / Math.abs(prev)) * 100).toFixed(1)}%` : '—');

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleExportCSV = () => {
    if (isAccountMode) {
      const rows: (string | number)[][] = [
        [`DRE GERENCIAL - ${currentDRE.period} - Contas selecionadas`, '', '', '', '', ''],
        ['Conta', 'Grupo', 'Valor Atual (R$)', '% Receita Líq.', 'Mês Anterior (R$)', 'Variação MoM'],
      ];
      accountRows.forEach((r) => {
        rows.push([r.name, r.groupLabel, r.amount.toFixed(2), pctOfNet(r.amount), r.previous.toFixed(2), momText(r.amount, r.previous)]);
      });
      rows.push([accountTotals.label, '', accountTotals.current.toFixed(2), pctOfNet(accountTotals.current), accountTotals.previous.toFixed(2), momText(accountTotals.current, accountTotals.previous)]);
      downloadCSV(`DRE_NOX4_${currentDRE.period}_contas.csv`, rows);
      return;
    }
    const headers = ['Código', 'Descrição da Conta', 'Valor Atual (R$)', '% Receita Líq.', 'Mês Anterior (R$)', 'Variação MoM'];
    const rows: (string | number)[][] = [
      [`DRE GERENCIAL - ${currentDRE.period}`, '', '', '', '', ''],
      headers,
    ];

    currentDRE.lines.forEach((line) => {
      const prevAmount = previousDRE?.lines.find((l) => l.code === line.code)?.amount || 0;
      const momVar = prevAmount > 0 ? ((line.amount - prevAmount) / prevAmount) * 100 : 0;
      rows.push([
        line.code,
        line.name,
        line.amount.toFixed(2),
        `${line.percentage_of_net.toFixed(1)}%`,
        prevAmount.toFixed(2),
        `${momVar.toFixed(1)}%`,
      ]);

      if (line.children && line.children.length > 0) {
        line.children.forEach((child) => {
          rows.push([
            child.code,
            `  ${child.name}`,
            child.amount.toFixed(2),
            `${child.percentage_of_net.toFixed(1)}%`,
            '-',
            '-',
          ]);
        });
      }
    });

    downloadCSV(`DRE_NOX4_${currentDRE.period}.csv`, rows);
  };

  const renderLineRow = (line: DRELineItem) => {
    const hasChildren = line.children && line.children.length > 0;
    const isExpanded = !!expandedRows[line.id];
    const prevLine = previousDRE?.lines.find((l) => l.code === line.code);
    const prevAmount = prevLine?.amount || 0;
    const momVar = prevAmount > 0 ? ((line.amount - prevAmount) / prevAmount) * 100 : 0;

    const isTotal = line.is_total;
    const isHeader = line.is_header;
    const isDeduction = line.is_deduction;

    return (
      <React.Fragment key={line.id}>
        <tr
          onClick={() => hasChildren && toggleRow(line.id)}
          className={`border-b border-slate-100 transition-colors ${
            hasChildren ? 'cursor-pointer hover:bg-slate-50' : 'hover:bg-slate-50/60'
          } ${
            isTotal
              ? 'bg-slate-100 font-bold text-slate-900'
              : isHeader
              ? 'bg-slate-50/80 font-bold text-blue-800'
              : 'text-slate-700'
          }`}
        >
          {/* Code & Name */}
          <td className="py-3 px-4 flex items-center gap-2">
            {hasChildren ? (
              <span className="text-slate-400 hover:text-slate-700">
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </span>
            ) : (
              <span className="w-4" />
            )}
            <span className="font-mono text-xs text-slate-400 mr-2">{line.code}</span>
            <span className={`text-xs ${isTotal ? 'font-heading tracking-wide' : ''}`}>
              {line.name}
            </span>
          </td>

          {/* Current Amount */}
          <td className="py-3 px-4 text-right font-mono text-xs font-semibold">
            <span className={isDeduction && line.amount > 0 ? 'text-rose-600' : isTotal ? (line.amount >= 0 ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold') : 'text-slate-800'}>
              {isDeduction && line.amount > 0 ? `(${formatCurrency(line.amount)})` : formatCurrency(line.amount)}
            </span>
          </td>

          {/* % of Net Revenue (AV) */}
          <td className="py-3 px-4 text-right font-mono text-xs text-slate-500">
            {currentDRE.net_revenue !== 0 ? formatPercent(line.percentage_of_net) : '—'}
          </td>

          {/* Previous Month Comparison */}
          {compareWithPrevious && (
            <>
              <td className="py-3 px-4 text-right font-mono text-xs text-slate-500">
                {formatCurrency(prevAmount)}
              </td>
              <td className="py-3 px-4 text-right font-mono text-xs">
                {prevAmount > 0 ? (
                  <span
                    className={`inline-flex items-center gap-0.5 font-semibold ${
                      momVar > 0 ? (isDeduction ? 'text-rose-600' : 'text-emerald-600') : momVar < 0 ? (isDeduction ? 'text-emerald-600' : 'text-rose-600') : 'text-slate-500'
                    }`}
                  >
                    {momVar > 0 ? <TrendingUp className="w-3 h-3" /> : momVar < 0 ? <TrendingDown className="w-3 h-3" /> : null}
                    {momVar > 0 ? `+${momVar.toFixed(1)}%` : `${momVar.toFixed(1)}%`}
                  </span>
                ) : (
                  <span className="text-slate-300">-</span>
                )}
              </td>
            </>
          )}
        </tr>

        {/* Children Sub-rows */}
        {hasChildren && isExpanded &&
          line.children?.map((child) => (
            <tr
              key={child.id}
              className="border-b border-slate-100 bg-slate-50/40 hover:bg-slate-50 text-xs text-slate-600 transition-colors"
            >
              <td className="py-2.5 px-4 pl-10 flex items-center gap-2">
                <span className="font-mono text-[10px] text-slate-400 mr-1">{child.code}</span>
                <span className="text-slate-700">{child.name}</span>
              </td>
              <td className="py-2.5 px-4 text-right font-mono text-slate-700">
                {isDeduction || line.code === '4' || line.code === '6' || line.code === '7' || line.code === '8' ? (
                  <span className="text-rose-600">({formatCurrency(child.amount)})</span>
                ) : (
                  formatCurrency(child.amount)
                )}
              </td>
              <td className="py-2.5 px-4 text-right font-mono text-slate-400">
                {currentDRE.net_revenue !== 0 ? formatPercent(child.percentage_of_net) : '—'}
              </td>
              {compareWithPrevious && (
                <>
                  <td className="py-2.5 px-4 text-right font-mono text-slate-400">-</td>
                  <td className="py-2.5 px-4 text-right font-mono text-slate-400">-</td>
                </>
              )}
            </tr>
          ))}
      </React.Fragment>
    );
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner & Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600 font-heading">
                Demonstrativo de Resultado do Exercício
              </span>
              <span className="px-2.5 py-0.5 text-[10px] bg-blue-50 text-blue-700 border border-blue-200 rounded-full font-semibold">
                Regime de Competência
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-800 mt-1 font-heading tracking-tight">
              DRE Gerencial Completa
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Estrutura hierárquica oficial: Receita Bruta → Deduções → Lucro Bruto → Despesas → EBITDA → Lucro Líquido
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar CSV</span>
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span>Imprimir / PDF</span>
            </button>
          </div>
        </div>

        {/* Filters Row */}
        <div className="flex items-center gap-3 pt-3 border-t border-slate-100 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
            <Filter className="w-3.5 h-3.5" />
            <span>Filtros:</span>
          </div>

          {/* Month Selector in DRE */}
          <MonthPickerFilter
            selectedMonth={selectedMonth}
            onSelectMonth={onSelectMonth}
            variant="minimal"
          />

          {/* Plano de Contas Filter */}
          <div className="relative" ref={accountMenuRef}>
            <button
              type="button"
              onClick={() => setAccountMenuOpen((o) => !o)}
              className={`flex items-center gap-1.5 border rounded-lg px-2.5 py-1 text-xs cursor-pointer ${
                isAccountMode ? 'bg-blue-50 border-blue-300 text-blue-800 font-semibold' : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}
            >
              <ListTree className="w-3.5 h-3.5" />
              <span>
                {selectedAccountIds.length === 0
                  ? 'Todo o Plano de Contas'
                  : selectedAccountIds.length === 1
                  ? accountOptions.find((a) => a.id === selectedAccountIds[0])?.name || '1 conta'
                  : `${selectedAccountIds.length} contas`}
              </span>
              <ChevronDown className="w-3.5 h-3.5 opacity-60" />
            </button>
            {isAccountMode && (
              <button
                type="button"
                onClick={() => setSelectedAccountIds([])}
                title="Limpar filtro"
                className="absolute -right-2 -top-2 bg-white border border-slate-300 rounded-full p-0.5 text-slate-500 hover:text-rose-600 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
            {accountMenuOpen && (
              <div className="absolute z-30 mt-1 w-80 max-w-[90vw] bg-white border border-slate-200 rounded-xl shadow-lg p-2">
                <div className="flex items-center gap-1.5 border border-slate-200 rounded-lg px-2 py-1.5 mb-2">
                  <Search className="w-3.5 h-3.5 text-slate-400" />
                  <input
                    autoFocus
                    value={accountSearch}
                    onChange={(e) => setAccountSearch(e.target.value)}
                    placeholder="Buscar conta ou grupo"
                    className="flex-1 text-xs outline-none bg-transparent"
                  />
                </div>
                <div className="max-h-72 overflow-y-auto pr-1">
                  {accountGroups.length === 0 && (
                    <p className="text-xs text-slate-500 px-2 py-3">Nenhuma conta encontrada.</p>
                  )}
                  {accountGroups.map(([group, items]) => (
                    <div key={group} className="mb-2">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 py-1">{group}</div>
                      {items.map((a) => (
                        <label key={a.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-50 text-xs text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedAccountIds.includes(a.id)}
                            onChange={() => toggleAccount(a.id)}
                            className="rounded border-slate-300 text-blue-600 focus:ring-0"
                          />
                          <span>{a.name}</span>
                        </label>
                      ))}
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-center border-t border-slate-100 pt-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setSelectedAccountIds([])}
                    className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    Limpar
                  </button>
                  <button
                    type="button"
                    onClick={() => setAccountMenuOpen(false)}
                    className="text-xs font-semibold bg-slate-900 text-white rounded-md px-3 py-1 cursor-pointer"
                  >
                    Aplicar
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Compare with previous toggle */}
          <label className="flex items-center gap-2 text-xs text-slate-600 ml-auto cursor-pointer select-none">
            <input
              type="checkbox"
              checked={compareWithPrevious}
              onChange={(e) => setCompareWithPrevious(e.target.checked)}
              className="rounded bg-white border-slate-300 text-blue-600 focus:ring-0"
            />
            <span>Comparar Mês Anterior (MoM)</span>
          </label>
        </div>
      </div>

      {isAccountMode ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{accountTotals.label}</div>
              <div className="text-xl font-bold text-slate-900 font-heading mt-1">{formatCurrency(accountTotals.current)}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {accountRows.length} {accountRows.length === 1 ? 'conta' : 'contas'} · {accountTotals.count} {accountTotals.count === 1 ? 'lançamento' : 'lançamentos'}
              </div>
            </div>
            <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">% da Receita Líquida</div>
              <div className="text-xl font-bold text-blue-600 font-heading mt-1">{pctOfNet(accountTotals.current)}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Receita líquida do mês: {formatCurrency(currentDRE.net_revenue)}</div>
            </div>
            <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Mês Anterior</div>
              <div className="text-xl font-bold text-slate-800 font-heading mt-1">{formatCurrency(accountTotals.previous)}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Mesmas contas, mês anterior</div>
            </div>
            <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Variação MoM</div>
              <div className="text-xl font-bold text-slate-800 font-heading mt-1">{momText(accountTotals.current, accountTotals.previous)}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Comparado ao mês anterior</div>
            </div>
          </div>

          {accountTotals.outside > 0 && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 text-xs">
              <Info className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                {accountTotals.outside} {accountTotals.outside === 1 ? 'lançamento destas contas é' : 'lançamentos destas contas são'} movimentação
                patrimonial (sócios ou principal de empréstimo) e não {accountTotals.outside === 1 ? 'entra' : 'entram'} na DRE. Para ver esses valores, use Gastos por Categoria.
              </span>
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 font-heading uppercase tracking-wider">
                    <th className="py-3.5 px-4 w-2/5">Conta do Plano de Contas</th>
                    <th className="py-3.5 px-4 text-right">Valor Atual</th>
                    <th className="py-3.5 px-4 text-right">% Rec. Líquida</th>
                    {compareWithPrevious && (
                      <>
                        <th className="py-3.5 px-4 text-right">Mês Anterior</th>
                        <th className="py-3.5 px-4 text-right">Variação MoM</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {accountRows.map((r) => (
                    <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50/60 text-sm">
                      <td className="py-3 px-4">
                        <div className="text-slate-800 font-medium">{r.name}</div>
                        <div className="text-[11px] text-slate-400">{r.groupLabel} · {r.count} {r.count === 1 ? 'lançamento' : 'lançamentos'}</div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono">
                        {r.kind === 'expense' ? (
                          <span className="text-rose-600">({formatCurrency(r.amount)})</span>
                        ) : (
                          <span className="text-slate-800">{formatCurrency(r.amount)}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-500">{pctOfNet(r.amount)}</td>
                      {compareWithPrevious && (
                        <>
                          <td className="py-3 px-4 text-right font-mono text-slate-500">{formatCurrency(r.previous)}</td>
                          <td className="py-3 px-4 text-right font-mono text-slate-500">{momText(r.amount, r.previous)}</td>
                        </>
                      )}
                    </tr>
                  ))}
                  <tr className="bg-slate-100 font-bold text-slate-900 text-sm">
                    <td className="py-3 px-4">{accountTotals.label}</td>
                    <td className="py-3 px-4 text-right font-mono">{formatCurrency(accountTotals.current)}</td>
                    <td className="py-3 px-4 text-right font-mono">{pctOfNet(accountTotals.current)}</td>
                    {compareWithPrevious && (
                      <>
                        <td className="py-3 px-4 text-right font-mono">{formatCurrency(accountTotals.previous)}</td>
                        <td className="py-3 px-4 text-right font-mono">{momText(accountTotals.current, accountTotals.previous)}</td>
                      </>
                    )}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <>
      {/* DRE Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Receita Líquida</div>
          <div className="text-xl font-bold text-slate-900 font-heading mt-1">
            {formatCurrency(currentDRE.net_revenue)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Base 100% da DRE</div>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Lucro Bruto</div>
          <div className="text-xl font-bold text-blue-600 font-heading mt-1">
            {formatCurrency(currentDRE.gross_profit)}
          </div>
          <div className="text-[11px] text-emerald-600 font-semibold mt-0.5">
            Margem Bruta: {currentDRE.net_revenue !== 0 ? formatPercent(currentDRE.gross_margin) : '—'}
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">EBITDA / Res. Op.</div>
          <div className="text-xl font-bold text-slate-800 font-heading mt-1">
            {formatCurrency(currentDRE.operating_profit)}
          </div>
          <div className="text-[11px] text-blue-600 font-semibold mt-0.5">
            Margem Op: {currentDRE.net_revenue !== 0 ? formatPercent(currentDRE.operating_margin) : '—'}
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Lucro Líquido Final</div>
          <div className="text-xl font-bold text-emerald-600 font-heading mt-1">
            {formatCurrency(currentDRE.net_profit)}
          </div>
          <div className="text-[11px] text-emerald-600 font-semibold mt-0.5">
            Margem Líquida: {currentDRE.net_revenue !== 0 ? formatPercent(currentDRE.net_margin) : '—'}
          </div>
        </div>
      </div>

      {/* DRE Hierarchical Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 font-heading uppercase tracking-wider">
                <th className="py-3.5 px-4 w-2/5">Plano de Contas DRE</th>
                <th className="py-3.5 px-4 text-right">Valor Atual</th>
                <th className="py-3.5 px-4 text-right">% Rec. Líquida</th>
                {compareWithPrevious && (
                  <>
                    <th className="py-3.5 px-4 text-right">Mês Anterior</th>
                    <th className="py-3.5 px-4 text-right">Variação MoM</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {currentDRE.lines.map((line) => renderLineRow(line))}
            </tbody>
          </table>
        </div>
      </div>
        </>
      )}
    </div>
  );
};
