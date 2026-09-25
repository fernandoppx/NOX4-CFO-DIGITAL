import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Brazilian Currency Formatter: R$ 10.000,00
export function formatCurrency(value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(value)) {
    return 'R$ 0,00';
  }
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

// Brazilian Percentage Formatter: 10,5%
export function formatPercent(value: number | undefined | null, decimals: number = 1): string {
  if (value === undefined || value === null || isNaN(value)) {
    return '0,0%';
  }
  return `${value.toFixed(decimals).replace('.', ',')}%`;
}

// Brazilian Date Formatter: DD/MM/YYYY
export function formatDate(dateString: string | undefined | null): string {
  if (!dateString) return '-';
  try {
    const parts = dateString.split('-');
    if (parts.length === 3) {
      // YYYY-MM-DD
      const [year, month, day] = parts;
      return `${day}/${month}/${year}`;
    }
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString('pt-BR');
  } catch {
    return dateString;
  }
}

// Month format: "Agosto / 2026"
export function formatMonthYear(yearMonth: string): string {
  if (!yearMonth) return '';
  const [year, month] = yearMonth.split('-');
  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  const mIndex = parseInt(month, 10) - 1;
  return `${monthNames[mIndex] || month} / ${year}`;
}

// Short Month format: "Ago/26"
export function formatShortMonth(yearMonth: string): string {
  if (!yearMonth) return '';
  const [year, month] = yearMonth.split('-');
  const shortMonths = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const mIndex = parseInt(month, 10) - 1;
  return `${shortMonths[mIndex] || month}/${year ? year.slice(-2) : ''}`;
}

export function getPreviousMonth(yearMonth: string): string {
  if (!yearMonth || !yearMonth.includes('-')) return '2026-08';
  const [year, month] = yearMonth.split('-').map(Number);
  const prevDate = new Date(year, month - 2, 1);
  return `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
}

export function getNextMonth(yearMonth: string): string {
  if (!yearMonth || !yearMonth.includes('-')) return '2026-08';
  const [year, month] = yearMonth.split('-').map(Number);
  const nextDate = new Date(year, month, 1);
  return `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;
}

export function getMonthOptions(): Array<{ value: string; label: string; shortLabel: string }> {
  const months = [
    { num: '01', name: 'Janeiro', short: 'Jan' },
    { num: '02', name: 'Fevereiro', short: 'Fev' },
    { num: '03', name: 'Março', short: 'Mar' },
    { num: '04', name: 'Abril', short: 'Abr' },
    { num: '05', name: 'Maio', short: 'Mai' },
    { num: '06', name: 'Junho', short: 'Jun' },
    { num: '07', name: 'Julho', short: 'Jul' },
    { num: '08', name: 'Agosto', short: 'Ago' },
    { num: '09', name: 'Setembro', short: 'Set' },
    { num: '10', name: 'Outubro', short: 'Out' },
    { num: '11', name: 'Novembro', short: 'Nov' },
    { num: '12', name: 'Dezembro', short: 'Dez' },
  ];

  const years = [2027, 2026, 2025, 2024];
  const list: Array<{ value: string; label: string; shortLabel: string }> = [];

  years.forEach((yr) => {
    // List months in reverse or chronologic order
    for (let i = 11; i >= 0; i--) {
      const m = months[i];
      list.push({
        value: `${yr}-${m.num}`,
        label: `${m.name} / ${yr}`,
        shortLabel: `${m.short}/${String(yr).slice(-2)}`,
      });
    }
  });

  return list;
}

export function parseBRL(valueStr: string): number {
  if (!valueStr) return 0;
  const clean = valueStr.replace(/[^\d,-]/g, '').replace(',', '.');
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}

export function downloadCSV(filename: string, rows: (string | number)[][]) {
  const processRow = (row: (string | number)[]) => {
    return row
      .map((val) => {
        let str = String(val ?? '');
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          str = `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      })
      .join(';');
  };

  const csvContent = '\uFEFF' + rows.map(processRow).join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
