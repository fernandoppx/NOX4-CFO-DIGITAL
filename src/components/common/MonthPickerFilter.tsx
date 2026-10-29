import React from 'react';
import { ChevronLeft, ChevronRight, Calendar, Sparkles } from 'lucide-react';
import { formatMonthYear, getPreviousMonth, getNextMonth, getCurrentYearMonth, formatShortMonth } from '../../lib/utils';

interface MonthPickerFilterProps {
  selectedMonth: string; // 'YYYY-MM' or 'ALL'
  onSelectMonth: (month: string) => void;
  allowAllMonths?: boolean;
  labelAllMonths?: string;
  size?: 'sm' | 'md';
  variant?: 'badge' | 'card' | 'minimal';
  className?: string;
}

const MONTH_NAMES = [
  { value: '01', label: 'Janeiro' },
  { value: '02', label: 'Fevereiro' },
  { value: '03', label: 'Março' },
  { value: '04', label: 'Abril' },
  { value: '05', label: 'Maio' },
  { value: '06', label: 'Junho' },
  { value: '07', label: 'Julho' },
  { value: '08', label: 'Agosto' },
  { value: '09', label: 'Setembro' },
  { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },
  { value: '12', label: 'Dezembro' },
];

const buildYears = () => {
  const y = parseInt(getCurrentYearMonth().slice(0, 4), 10);
  return [y - 3, y - 2, y - 1, y, y + 1, y + 2].map(String);
};

export const MonthPickerFilter: React.FC<MonthPickerFilterProps> = ({
  selectedMonth,
  onSelectMonth,
  allowAllMonths = false,
  labelAllMonths = 'Ano Todo (Todos os Meses)',
  size = 'md',
  variant = 'badge',
  className = '',
}) => {
  const isAll = selectedMonth === 'ALL';
  const todayMonth = getCurrentYearMonth();

  // Parse current year and month
  let currentYear = todayMonth.slice(0, 4);
  let currentMonth = todayMonth.slice(5, 7);

  if (!isAll && selectedMonth && selectedMonth.includes('-')) {
    const parts = selectedMonth.split('-');
    currentYear = parts[0] || currentYear;
    currentMonth = parts[1] || currentMonth;
  }

  // Ensure year is in available list or prepend/append
  const AVAILABLE_YEARS = buildYears();
  const years = AVAILABLE_YEARS.includes(currentYear)
    ? AVAILABLE_YEARS
    : [...AVAILABLE_YEARS, currentYear].sort();

  const handleYearChange = (newYear: string) => {
    if (isAll) {
      onSelectMonth('ALL');
    } else {
      onSelectMonth(`${newYear}-${currentMonth}`);
    }
  };

  const handleMonthChange = (newMonthValue: string) => {
    if (newMonthValue === 'ALL') {
      onSelectMonth('ALL');
    } else {
      onSelectMonth(`${currentYear}-${newMonthValue}`);
    }
  };

  const handlePrev = () => {
    if (isAll) {
      onSelectMonth(todayMonth);
    } else {
      onSelectMonth(getPreviousMonth(selectedMonth));
    }
  };

  const handleNext = () => {
    if (isAll) {
      onSelectMonth(todayMonth);
    } else {
      onSelectMonth(getNextMonth(selectedMonth));
    }
  };

  const handleCurrentMonth = () => {
    onSelectMonth(todayMonth);
  };

  if (variant === 'minimal') {
    return (
      <div className={`inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl p-1 shadow-2xs ${className}`}>
        <button
          type="button"
          onClick={handlePrev}
          title="Mês Anterior"
          className="p-1 rounded-lg hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Simple Month Select */}
        <select
          value={isAll ? 'ALL' : currentMonth}
          onChange={(e) => handleMonthChange(e.target.value)}
          className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 outline-none focus:border-blue-500 cursor-pointer"
        >
          {allowAllMonths && <option value="ALL">{labelAllMonths}</option>}
          {MONTH_NAMES.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>

        {/* Simple Year Select */}
        {!isAll && (
          <select
            value={currentYear}
            onChange={(e) => handleYearChange(e.target.value)}
            className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 outline-none focus:border-blue-500 cursor-pointer"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        )}

        <button
          type="button"
          onClick={handleNext}
          title="Próximo Mês"
          className="p-1 rounded-lg hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div
      className={`inline-flex flex-wrap items-center gap-1.5 bg-white border border-slate-200 rounded-xl p-1.5 shadow-xs hover:border-slate-300 transition-all ${className}`}
    >
      {/* Previous Button */}
      <button
        type="button"
        onClick={handlePrev}
        title="Mês Anterior"
        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {/* Month Dropdown */}
      <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/90 rounded-lg px-2.5 py-1">
        <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider hidden sm:inline">
          Mês:
        </span>
        <select
          value={isAll ? 'ALL' : currentMonth}
          onChange={(e) => handleMonthChange(e.target.value)}
          className="bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer py-0.5"
        >
          {allowAllMonths && <option value="ALL">★ {labelAllMonths}</option>}
          {MONTH_NAMES.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      {/* Year Dropdown */}
      {!isAll && (
        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/90 rounded-lg px-2.5 py-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider hidden sm:inline">
            Ano:
          </span>
          <select
            value={currentYear}
            onChange={(e) => handleYearChange(e.target.value)}
            className="bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer py-0.5"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Next Button */}
      <button
        type="button"
        onClick={handleNext}
        title="Próximo Mês"
        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
      >
        <ChevronRight className="w-4 h-4" />
      </button>

      {/* Atalho para voltar ao mês atual */}
      {selectedMonth !== todayMonth && (
        <button
          type="button"
          onClick={handleCurrentMonth}
          title={`Voltar para o mês atual (${formatShortMonth(todayMonth)})`}
          className="hidden sm:inline-flex px-2.5 py-1 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors cursor-pointer shrink-0"
        >
          Mês atual
        </button>
      )}
    </div>
  );
};
