import React from 'react';
import {
  LineChart as ChartIcon,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShieldAlert,
  Percent,
  Clock,
  Target,
  Users,
  Wallet,
  Zap,
  Info,
} from 'lucide-react';
import { FinancialIndicators, DREStatement } from '../../types';
import { formatCurrency, formatPercent } from '../../lib/utils';
import { MonthPickerFilter } from '../common/MonthPickerFilter';

interface IndicatorsViewProps {
  indicators: FinancialIndicators;
  currentDRE: DREStatement;
  selectedMonth?: string;
  onSelectMonth?: (month: string) => void;
}

export const IndicatorsView: React.FC<IndicatorsViewProps> = ({
  indicators,
  currentDRE,
  selectedMonth = '2026-08',
  onSelectMonth,
}) => {
  const indicatorSections = [
    {
      title: 'MARGENS & RENTABILIDADE',
      description: 'Eficiência de conversão de faturamento em lucro',
      cards: [
        {
          label: 'Margem Bruta',
          value: formatPercent(indicators.gross_margin_percent),
          subtext: `Lucro Bruto: ${formatCurrency(currentDRE.gross_profit)}`,
          status: indicators.gross_margin_percent >= 50 ? 'EXCELENTE' : 'ATENÇÃO',
          explanation: 'Percentual restante após deduzir os custos diretos de entrega (CSP).',
        },
        {
          label: 'Margem de Contribuição',
          value: formatPercent(indicators.contribution_margin_percent),
          subtext: `Sobra para cobrir custos fixos`,
          status: indicators.contribution_margin_percent >= 40 ? 'EXCELENTE' : 'ATENÇÃO',
          explanation: 'Receita Líquida menos Custos e Despesas Variáveis.',
        },
        {
          label: 'Margem Operacional (EBITDA)',
          value: formatPercent(indicators.operating_margin_percent),
          subtext: `EBITDA: ${formatCurrency(currentDRE.operating_profit)}`,
          status: indicators.operating_margin_percent >= 20 ? 'EXCELENTE' : 'ATENÇÃO',
          explanation: 'Geração de caixa estritamente operacional da empresa.',
        },
        {
          label: 'Margem Líquida Final',
          value: formatPercent(indicators.net_margin_percent),
          subtext: `Lucro Líquido: ${formatCurrency(currentDRE.net_profit)}`,
          status: indicators.net_margin_percent >= 15 ? 'EXCELENTE' : indicators.net_margin_percent >= 5 ? 'REGULAR' : 'CRÍTICO',
          explanation: 'Percentual final que sobra para sócios e reinvestimento após impostos.',
        },
      ],
    },
    {
      title: 'PONTOS DE EQUILÍBRIO (BREAK-EVEN)',
      description: 'Faturamento mínimo necessário para não ter prejuízo',
      cards: [
        {
          label: 'Break-even Operacional',
          value: formatCurrency(indicators.breakeven_point_monthly),
          subtext: `Custos Fixos Totais: ${formatCurrency(indicators.fixed_costs_total)}`,
          status: currentDRE.net_revenue > indicators.breakeven_point_monthly ? 'SUPERADO' : 'ABAIXO',
          explanation: 'Faturamento para cobrir exatamente todos os custos e despesas fixas.',
        },
        {
          label: 'Margem de Segurança',
          value: formatPercent(
            indicators.breakeven_point_monthly > 0
              ? ((currentDRE.net_revenue - indicators.breakeven_point_monthly) / currentDRE.net_revenue) * 100
              : 0
          ),
          subtext: `Gordura antes de entrar no vermelho`,
          status: 'EXCELENTE',
          explanation: 'Quanto o faturamento pode cair antes da empresa entrar em prejuízo.',
        },
        {
          label: 'Ticket Médio por Cliente',
          value: formatCurrency(indicators.average_ticket),
          subtext: `Faturamento médio por conta ativa`,
          status: 'NORMAL',
          explanation: 'Receita líquida total dividida pelo número de clientes faturados.',
        },
      ],
    },
    {
      title: 'MÉTRICAS DE CRESCIMENTO, CAC & LTV',
      description: 'Eficiência de aquisição, retenção e valor do cliente',
      cards: [
        {
          label: 'CAC (Custo de Aquisição)',
          value: formatCurrency(indicators.cac),
          subtext: `Investimento Comercial & Mkt por novo cliente`,
          status: 'NORMAL',
          explanation: 'Total de despesas comerciais e marketing dividido por novos clientes.',
        },
        {
          label: 'LTV (Lifetime Value)',
          value: formatCurrency(indicators.ltv),
          subtext: `Receita total esperada por cliente no ciclo de vida`,
          status: 'EXCELENTE',
          explanation: 'Ticket Médio x Tempo de Permanência do cliente (Retention).',
        },
        {
          label: 'LTV / CAC Ratio',
          value: `${indicators.ltv_cac_ratio.toFixed(1)}x`,
          subtext: `Benchmark ideal > 3.0x`,
          status: indicators.ltv_cac_ratio >= 3.0 ? 'EXCELENTE' : 'ATENÇÃO',
          explanation: 'Relação entre o valor gerado pelo cliente e o custo para adquiri-lo.',
        },
        {
          label: 'Payback do CAC',
          value: `${indicators.cac_payback_months.toFixed(1)} meses`,
          subtext: `Tempo para recuperar o custo de venda`,
          status: indicators.cac_payback_months <= 6 ? 'EXCELENTE' : 'ATENÇÃO',
          explanation: 'Quantos meses de margem de contribuição pagam o investimento de aquisição.',
        },
      ],
    },
    {
      title: 'LIQUIDEZ, TESOURARIA & CICLO FINANCEIRO',
      description: 'Solvência de curto prazo, prazos médios e fôlego de caixa',
      cards: [
        {
          label: 'Runway de Caixa',
          value: `${indicators.runway_months.toFixed(1)} meses`,
          subtext: `Saldo: ${formatCurrency(indicators.cash_balance)}`,
          status: indicators.runway_months >= 6 ? 'EXCELENTE' : indicators.runway_months >= 3 ? 'REGULAR' : 'CRÍTICO',
          explanation: 'Tempo em meses que a empresa sobrevive sem novas entradas de receita.',
        },
        {
          label: 'Burn Rate Mensal',
          value: formatCurrency(indicators.burn_rate_monthly),
          subtext: `Consumo médio de caixa por mês`,
          status: 'NORMAL',
          explanation: 'Total de saídas fixas e operacionais mensais.',
        },
        {
          label: 'Taxa de Inadimplência',
          value: formatPercent(indicators.default_rate_percent),
          subtext: `Títulos vencidos sobre faturamento total`,
          status: indicators.default_rate_percent <= 5 ? 'EXCELENTE' : 'ATENÇÃO',
          explanation: 'Percentual de receitas vencidas e não pagas pelos clientes.',
        },
        {
          label: 'PMR (Prazo Médio Recebimento)',
          value: `${indicators.pmr_days} dias`,
          subtext: `Tempo médio para o cliente pagar`,
          status: 'NORMAL',
          explanation: 'Média de dias entre a emissão da cobrança e a liquidação em conta.',
        },
        {
          label: 'PMP (Prazo Médio Pagamento)',
          value: `${indicators.pmp_days} dias`,
          subtext: `Prazo concedido por fornecedores`,
          status: 'NORMAL',
          explanation: 'Média de dias entre o compromisso e o efetivo pagamento aos fornecedores.',
        },
      ],
    },
  ];

  return (
    <div className="space-y-8 pb-12">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600 font-heading">
                Painel Analítico de Indicadores
              </span>
              <span className="px-2.5 py-0.5 text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full font-medium">
                Cálculos 100% Determinísticos
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-800 mt-1 font-heading tracking-tight">
              KPIs & Indicadores Financeiros Estratégicos
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Todos os índices fundamentais de rentabilidade, liquidez, solvência, unit economics e tração
            </p>
          </div>

          {onSelectMonth && (
            <div className="flex items-center gap-2 shrink-0">
              <MonthPickerFilter
                selectedMonth={selectedMonth}
                onSelectMonth={onSelectMonth}
              />
            </div>
          )}
        </div>
      </div>

      {/* Sections */}
      {indicatorSections.map((sec, idx) => (
        <div key={idx} className="space-y-3">
          <div>
            <h3 className="text-sm font-bold text-slate-800 font-heading tracking-wide uppercase flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-600" />
              {sec.title}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">{sec.description}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {sec.cards.map((c, cIdx) => (
              <div
                key={cIdx}
                className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm hover:border-slate-300 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700">{c.label}</span>
                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        c.status === 'EXCELENTE' || c.status === 'SUPERADO'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : c.status === 'CRÍTICO' || c.status === 'ABAIXO'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : c.status === 'ATENÇÃO'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-blue-50 text-blue-700 border border-blue-200'
                      }`}
                    >
                      {c.status}
                    </span>
                  </div>

                  <div className="text-2xl font-bold text-slate-800 font-heading tracking-tight mt-2">
                    {c.value}
                  </div>

                  <div className="text-[11px] text-slate-500 mt-1 font-mono">{c.subtext}</div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-100 text-[10px] text-slate-400 leading-tight">
                  {c.explanation}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
