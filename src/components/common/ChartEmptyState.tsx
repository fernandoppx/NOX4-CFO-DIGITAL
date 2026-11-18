import React from 'react';
import { BarChart3 } from 'lucide-react';

/** Mensagem exibida no lugar de um gráfico sem dados (evita eixo falso de R$ 0 a R$ 4). */
export const ChartEmptyState: React.FC<{ message?: string; actionLabel?: string; onAction?: () => void }> = ({
  message = 'Ainda não há lançamentos neste período.',
  actionLabel,
  onAction,
}) => (
  <div className="h-full w-full flex flex-col items-center justify-center text-center gap-2 border border-dashed border-slate-200 rounded-lg bg-slate-50/60 px-4">
    <BarChart3 className="w-6 h-6 text-slate-300" />
    <p className="text-xs text-slate-500 max-w-[260px]">{message}</p>
    {actionLabel && onAction && (
      <button
        type="button"
        onClick={onAction}
        className="text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
      >
        {actionLabel} &rarr;
      </button>
    )}
  </div>
);
