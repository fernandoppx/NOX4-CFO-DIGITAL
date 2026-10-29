import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Sparkles, Send, Loader2, FileText, AlertCircle, RotateCcw, Bot, User as UserIcon } from 'lucide-react';
import { CashFlowPeriod, DREStatement, Expense, ExpenseCategory, FinancialIndicators } from '../../types';
import { supabase } from '../../lib/supabase';
import { formatMonthYear, getGroupLabel } from '../../lib/utils';

interface CfoAiViewProps {
  companyName: string;
  selectedMonth: string;
  currentDRE: DREStatement;
  previousDRE: DREStatement | null;
  indicators: FinancialIndicators;
  cashFlowPeriods: CashFlowPeriod[];
  alerts: Array<{ title: string; content: string; severity: string }>;
  clientsProfitability: Array<{ client: { name: string }; netRevenue: number }>;
  expenseCategories: ExpenseCategory[];
  expenses: Expense[];
}

type ChatMessage = { role: 'user' | 'assistant'; content: string };

const SUGGESTIONS = [
  'Por que meu lucro mudou em relação ao mês passado?',
  'Quanto preciso faturar para ter R$ 20 mil de lucro por mês?',
  'Onde posso cortar custos sem afetar a operação?',
  'Meu caixa aguenta quantos meses no ritmo atual?',
];

const round = (n: number | null | undefined) => (n === null || n === undefined || !isFinite(n) ? null : Math.round(n * 100) / 100);

/** Markdown mínimo: títulos, listas, negrito. Escapa HTML antes. */
function renderMarkdown(md: string): React.ReactNode {
  const lines = md.replace(/\r/g, '').split('\n');
  const out: React.ReactNode[] = [];
  let list: string[] = [];
  const inline = (text: string, key: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return (
      <React.Fragment key={key}>
        {parts.map((p, i) =>
          p.startsWith('**') && p.endsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : <React.Fragment key={i}>{p}</React.Fragment>
        )}
      </React.Fragment>
    );
  };
  const flush = () => {
    if (list.length) {
      out.push(
        <ul key={`ul-${out.length}`} className="list-disc pl-5 space-y-1 my-2">
          {list.map((li, i) => (
            <li key={i}>{inline(li, `li-${i}`)}</li>
          ))}
        </ul>
      );
      list = [];
    }
  };
  lines.forEach((raw, idx) => {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/);
    if (bullet) {
      list.push(bullet[1]);
      return;
    }
    flush();
    if (!line.trim()) return;
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      out.push(
        <h4 key={idx} className="font-bold text-slate-900 mt-3 mb-1 text-sm">
          {inline(h[2], `h-${idx}`)}
        </h4>
      );
      return;
    }
    out.push(
      <p key={idx} className="my-1.5">
        {inline(line, `p-${idx}`)}
      </p>
    );
  });
  flush();
  return out;
}

export const CfoAiView: React.FC<CfoAiViewProps> = ({
  companyName,
  selectedMonth,
  currentDRE,
  previousDRE,
  indicators,
  cashFlowPeriods,
  alerts,
  clientsProfitability,
  expenseCategories,
  expenses,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [insight, setInsight] = useState<string | null>(null);
  const [isGeneratingInsight, setIsGeneratingInsight] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isSending]);

  // Limpa a conversa ao trocar de empresa ou de mês
  useEffect(() => {
    setMessages([]);
    setInsight(null);
    setError(null);
  }, [companyName, selectedMonth]);

  const financialContext = useMemo(() => {
    const dreSummary = (d: DREStatement | null) =>
      d && {
        periodo: d.period,
        receita_bruta: round(d.gross_revenue),
        deducoes: round(d.deductions_total ?? d.deductions),
        receita_liquida: round(d.net_revenue),
        custos_servicos: round(d.cost_of_services),
        lucro_bruto: round(d.gross_profit),
        margem_bruta_pct: round(d.gross_margin),
        despesas_comerciais: round(d.commercial_expenses),
        despesas_administrativas: round(d.administrative_expenses),
        despesas_operacionais: round(d.operational_expenses),
        ebitda: round(d.operating_profit),
        resultado_financeiro: round(d.financial_result),
        impostos_sobre_lucro: round(d.taxes_on_profit),
        lucro_liquido: round(d.net_profit),
        margem_liquida_pct: round(d.net_margin),
      };

    const catMap = new Map<string, ExpenseCategory>(expenseCategories.map((c) => [c.id, c] as [string, ExpenseCategory]));
    const byCategory = new Map<string, number>();
    expenses
      .filter((e) => e.competence_date?.startsWith(selectedMonth) && !e.is_equity_movement && String(e.status) !== 'cancelled')
      .forEach((e) => {
        const cat = catMap.get(e.category_id);
        const label = cat ? `${cat.name} (${getGroupLabel(cat.group)})` : 'Sem categoria';
        byCategory.set(label, (byCategory.get(label) || 0) + (e.amount || 0));
      });

    return {
      empresa: companyName,
      mes_analisado: formatMonthYear(selectedMonth),
      dre_mes: dreSummary(currentDRE),
      dre_mes_anterior: dreSummary(previousDRE),
      indicadores: {
        saldo_caixa_hoje: round(indicators.cash_balance),
        queima_mensal_despesas: round(indicators.burn_rate),
        runway_meses: indicators.runway_months === null ? 'sem queima de caixa' : round(indicators.runway_months),
        margem_contribuicao_pct: round(indicators.contribution_margin),
        custos_fixos_mes: round(indicators.fixed_costs_total),
        ponto_equilibrio_mes: round(indicators.break_even_point),
        contas_a_receber_em_aberto: round(indicators.accounts_receivable_total),
        contas_a_pagar_em_aberto: round(indicators.accounts_payable_total),
        inadimplencia_pct: round(indicators.default_rate_percent),
        prazo_medio_recebimento_dias: indicators.pmr_days ?? null,
        prazo_medio_pagamento_dias: indicators.pmp_days ?? null,
        clientes_ativos: indicators.active_clients,
        ticket_medio: round(indicators.average_ticket),
        mrr: round(indicators.mrr),
        churn_pct: round(indicators.churn_rate),
        cac: round(indicators.cac) || null,
        payback_cac_meses: indicators.cac_payback_months ?? null,
        ltv_cac: indicators.ltv_cac_ratio > 0 ? round(indicators.ltv_cac_ratio) : null,
        crescimento_vs_mes_anterior_pct: round(indicators.mom_growth),
        score_saude_0_100: indicators.health_score ?? null,
      },
      despesas_do_mes_por_categoria: Array.from(byCategory.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12)
        .map(([categoria, valor]) => ({ categoria, valor: round(valor) })),
      top_clientes_receita_liquida_mes: clientsProfitability
        .filter((c) => c.netRevenue > 0)
        .sort((a, b) => b.netRevenue - a.netRevenue)
        .slice(0, 8)
        .map((c) => ({ cliente: c.client.name, receita_liquida: round(c.netRevenue) })),
      fluxo_caixa_mensal: cashFlowPeriods.map((p) => ({
        periodo: p.period_label,
        entradas: round(p.operational_inflows),
        saidas: round(p.operational_outflows),
        socios: round(p.financing_flows),
        saldo_final: round(p.closing_balance),
      })),
      alertas_do_sistema: alerts.map((a) => `${a.severity}: ${a.title}`),
    };
  }, [
    companyName,
    selectedMonth,
    currentDRE,
    previousDRE,
    indicators,
    cashFlowPeriods,
    alerts,
    clientsProfitability,
    expenseCategories,
    expenses,
  ]);

  const callApi = async (payload: Record<string, unknown>) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error('Sua sessão expirou. Entre novamente.');
    const r = await fetch('/api/cfo-ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...payload, financialContext }),
    });
    const json = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(json.error || 'A IA não respondeu agora. Tente de novo.');
    return json;
  };

  const sendMessage = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || isSending) return;
    setError(null);
    const history = messages;
    setMessages([...history, { role: 'user', content }]);
    setInput('');
    setIsSending(true);
    try {
      const json = await callApi({ action: 'chat', message: content, history });
      setMessages((prev) => [...prev, { role: 'assistant', content: json.reply }]);
    } catch (e: any) {
      setError(e?.message || 'Erro ao falar com a IA.');
    } finally {
      setIsSending(false);
    }
  };

  const generateInsight = async () => {
    setError(null);
    setIsGeneratingInsight(true);
    try {
      const json = await callApi({ action: 'insights' });
      setInsight(json.insight);
    } catch (e: any) {
      setError(e?.message || 'Erro ao gerar o diagnóstico.');
    } finally {
      setIsGeneratingInsight(false);
    }
  };

  const hasData = currentDRE.gross_revenue > 0 || indicators.burn_rate > 0;

  return (
    <div className="space-y-4 sm:space-y-6 pb-12">
      <div className="bg-gradient-to-br from-slate-900 to-blue-950 text-white rounded-xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-blue-300 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-4 h-4" /> CFO Digital com IA
            </div>
            <h2 className="text-xl font-bold mt-1 font-heading">Análise de {formatMonthYear(selectedMonth)}</h2>
            <p className="text-xs text-slate-300 mt-1 max-w-xl">
              A IA lê os números já calculados pelo sistema (DRE, caixa e indicadores) e explica o que eles significam.
              Ela não altera nenhum lançamento.
            </p>
          </div>
          <button
            type="button"
            onClick={generateInsight}
            disabled={isGeneratingInsight}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-white text-slate-900 text-xs font-bold hover:bg-blue-50 disabled:opacity-70 shrink-0"
          >
            {isGeneratingInsight ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            {isGeneratingInsight ? 'Gerando diagnóstico...' : insight ? 'Gerar de novo' : 'Gerar diagnóstico do mês'}
          </button>
        </div>
      </div>

      {!hasData && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            Ainda não há receitas nem despesas em {formatMonthYear(selectedMonth)}. A IA vai responder, mas a análise fica
            muito melhor depois dos primeiros lançamentos do mês.
          </span>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs" role="alert">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {insight && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm text-xs text-slate-700 leading-relaxed">
          <div className="flex items-center gap-2 mb-2 text-slate-900 font-bold text-sm font-heading">
            <FileText className="w-4 h-4 text-blue-600" /> Diagnóstico executivo
          </div>
          {renderMarkdown(insight)}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800 font-heading">Pergunte ao CFO</h3>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => setMessages([])}
              className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Nova conversa
            </button>
          )}
        </div>

        <div className="p-4 sm:p-5 space-y-4 min-h-[220px] max-h-[55vh] overflow-y-auto">
          {messages.length === 0 && !isSending && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500">Sugestões para começar:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => sendMessage(s)}
                    className="text-left text-xs p-3 rounded-lg border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-200 text-slate-700"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex gap-2.5 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {m.role === 'assistant' && (
                <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                  m.role === 'user' ? 'bg-slate-900 text-white' : 'bg-slate-50 border border-slate-200 text-slate-700'
                }`}
              >
                {m.role === 'assistant' ? renderMarkdown(m.content) : m.content}
              </div>
              {m.role === 'user' && (
                <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center shrink-0">
                  <UserIcon className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}

          {isSending && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin" /> Analisando seus números...
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
          className="p-3 border-t border-slate-100 flex items-center gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={2000}
            placeholder="Ex: Por que minha margem caiu?"
            aria-label="Pergunta para o CFO Digital"
            className="flex-1 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-500 focus:bg-white"
          />
          <button
            type="submit"
            disabled={isSending || !input.trim()}
            aria-label="Enviar pergunta"
            className="p-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:bg-slate-300"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
