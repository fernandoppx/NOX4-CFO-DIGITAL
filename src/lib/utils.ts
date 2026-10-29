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
  if (!yearMonth || !yearMonth.includes('-')) return getCurrentYearMonth();
  const [year, month] = yearMonth.split('-').map(Number);
  const prevDate = new Date(year, month - 2, 1);
  return `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
}

export function getNextMonth(yearMonth: string): string {
  if (!yearMonth || !yearMonth.includes('-')) return getCurrentYearMonth();
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

/** Mês atual no fuso de São Paulo, no formato YYYY-MM. */
export function getCurrentYearMonth(now: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
    }).formatToParts(now);
    const y = parts.find((p) => p.type === 'year')?.value;
    const m = parts.find((p) => p.type === 'month')?.value;
    if (y && m) return `${y}-${m}`;
  } catch {
    // fallback abaixo
  }
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/** Data de hoje no fuso de São Paulo, no formato YYYY-MM-DD. */
export function getTodayISO(now: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

/** Soma dias a uma data YYYY-MM-DD. */
export function addDaysISO(dateISO: string, days: number): string {
  const [y, m, d] = dateISO.split('-').map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** Nome em português dos grupos do plano de contas. */
export const EXPENSE_GROUP_LABELS: Record<string, string> = {
  revenue: 'Receita',
  deductions: 'Deduções da Receita',
  cost_of_services: 'Custos dos Serviços (CSP)',
  commercial: 'Despesas Comerciais',
  administrative: 'Despesas Administrativas',
  operational: 'Despesas Operacionais',
  depreciation: 'Depreciação',
  financial: 'Resultado Financeiro',
  taxes_profit: 'Impostos sobre o Lucro',
  equity: 'Movimentação de Sócios',
};

export function getGroupLabel(group?: string | null): string {
  if (!group) return '';
  const key = String(group).toLowerCase();
  if (key === 'revenue' || group === 'REVENUE') return 'Receita';
  return EXPENSE_GROUP_LABELS[key] || group;
}

/** Converte texto de campo numérico (aceita vírgula) em número. Vazio = 0. */
export function parseDecimalInput(value: string | number | null | undefined): number {
  if (typeof value === 'number') return isFinite(value) ? value : 0;
  if (!value) return 0;
  const cleaned = String(value).trim().replace(/\s/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return isFinite(n) ? n : 0;
}

/** Formatação compacta para eixos de gráficos: R$ 950, R$ 1,2 mil, R$ 3,4 mi. */
export function formatAxisCurrency(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}R$ ${(abs / 1_000_000).toFixed(1).replace('.', ',')} mi`;
  if (abs >= 1_000) return `${sign}R$ ${(abs / 1_000).toFixed(abs >= 10_000 ? 0 : 1).replace('.', ',')} mil`;
  return `${sign}R$ ${Math.round(abs)}`;
}
