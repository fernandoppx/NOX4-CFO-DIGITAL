import React, { useState } from 'react';
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
  Layers,
  Users,
  Printer,
} from 'lucide-react';
import { DREStatement, DRELineItem, CostCenter, Client, Product } from '../../types';
import { formatCurrency, formatPercent, downloadCSV } from '../../lib/utils';
import { MonthPickerFilter } from '../common/MonthPickerFilter';

interface DREViewProps {
  currentDRE: DREStatement;
  previousDRE: DREStatement | null;
  costCenters: CostCenter[];
  clients: Client[];
  products: Product[];
  selectedCostCenterId: string;
  onSelectCostCenter: (id: string) => void;
  selectedClientId: string;
  onSelectClient: (id: string) => void;
  selectedMonth: string;
  onSelectMonth: (month: string) => void;
}

export const DREView: React.FC<DREViewProps> = ({
  currentDRE,
  previousDRE,
  costCenters,
  clients,
  products,
  selectedCostCenterId,
  onSelectCostCenter,
  selectedClientId,
  onSelectClient,
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

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleExportCSV = () => {
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
            {formatPercent(line.percentage_of_net)}
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
                {formatPercent(child.percentage_of_net)}
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

          {/* Cost Center Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs">
            <Layers className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={selectedCostCenterId}
              onChange={(e) => onSelectCostCenter(e.target.value)}
              className="bg-transparent text-slate-700 outline-none cursor-pointer"
            >
              <option value="" className="bg-white">Todos os Centros de Resultado</option>
              {costCenters.map((cc) => (
                <option key={cc.id} value={cc.id} className="bg-white">
                  {cc.name} ({cc.code})
                </option>
              ))}
            </select>
          </div>

          {/* Client Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs">
            <Users className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={selectedClientId}
              onChange={(e) => onSelectClient(e.target.value)}
              className="bg-transparent text-slate-700 outline-none cursor-pointer"
            >
              <option value="" className="bg-white">Todos os Clientes</option>
              {clients.map((cli) => (
                <option key={cli.id} value={cli.id} className="bg-white">
                  {cli.name}
                </option>
              ))}
            </select>
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
            Margem Bruta: {formatPercent(currentDRE.gross_margin)}
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">EBITDA / Res. Op.</div>
          <div className="text-xl font-bold text-slate-800 font-heading mt-1">
            {formatCurrency(currentDRE.operating_profit)}
          </div>
          <div className="text-[11px] text-blue-600 font-semibold mt-0.5">
            Margem Op: {formatPercent(currentDRE.operating_margin)}
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Lucro Líquido Final</div>
          <div className="text-xl font-bold text-emerald-600 font-heading mt-1">
            {formatCurrency(currentDRE.net_profit)}
          </div>
          <div className="text-[11px] text-emerald-600 font-semibold mt-0.5">
            Margem Líquida: {formatPercent(currentDRE.net_margin)}
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
    </div>
  );
};
