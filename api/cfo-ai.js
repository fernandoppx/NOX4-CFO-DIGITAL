/**
 * NOX4 CFO Digital — IA (função serverless da Vercel)
 *
 * POST /api/cfo-ai
 *   Authorization: Bearer <access_token do Supabase do usuário logado>
 *   body: { action: 'chat' | 'insights', message?, history?, financialContext }
 *
 * Os números são calculados pelo sistema (motor financeiro determinístico) e
 * enviados em `financialContext`. A IA só interpreta: não inventa valores.
 *
 * Variáveis de ambiente (Vercel):
 *   GEMINI_API_KEY                obrigatória
 *   GEMINI_MODEL                  opcional (padrão: gemini-3.8-flash)
 *   VITE_SUPABASE_URL / SUPABASE_URL
 *   VITE_SUPABASE_PUBLISHABLE_KEY / SUPABASE_PUBLISHABLE_KEY
 */

const DEFAULT_MODEL = 'gemini-3.8-flash';
const FALLBACK_MODEL = 'gemini-flash-latest';
const MAX_MESSAGE_CHARS = 2000;
const MAX_HISTORY = 8;
const MAX_CONTEXT_CHARS = 60000;

const CHAT_SYSTEM_PROMPT = `Você é o "CFO Digital" da NOX4, um diretor financeiro experiente que atende pequenas e médias empresas brasileiras.

REGRAS OBRIGATÓRIAS:
1. Não invente números. Todos os valores oficiais (DRE, fluxo de caixa, margens, ponto de equilíbrio, CAC, LTV, runway, contas a pagar e a receber) já foram calculados pelo sistema e estão no bloco DADOS FINANCEIROS. Cite os valores exatos de lá.
2. Se um indicador estiver como null, "—" ou ausente, diga que ainda não há dados suficientes para ele e explique o que o usuário precisa lançar para ter esse número.
3. Para simulações (ex.: "quanto preciso faturar para ter R$ 50 mil de lucro?"), use: Faturamento necessário = (Custos fixos + Lucro desejado) / Margem de contribuição %. Mostre a conta com os números do contexto.
4. Para "por que meu lucro caiu?", compare com o mês anterior linha a linha (receita, deduções, custos, despesas comerciais, administrativas e operacionais).
5. Tom executivo, direto e prático. Responda em português do Brasil, em Markdown curto: tópicos, negrito e valores em R$ (formato 1.234,56).
6. Você não é contador nem consultor de investimentos: para decisões tributárias ou jurídicas, recomende confirmar com o contador.`;

const INSIGHTS_PROMPT = `Com base nos DADOS FINANCEIROS abaixo, escreva o Diagnóstico Executivo do mês em Markdown, em português do Brasil, com exatamente estas seções:

## Síntese
2 a 3 frases com lucro líquido, margem líquida, saldo de caixa e runway (ou "sem queima de caixa").

## 3 pontos de atenção
Riscos concretos citando os números (queda de margem, concentração em clientes, despesas em alta, inadimplência, caixa).

## 3 recomendações para o próximo mês
Ações práticas e específicas, cada uma com o número que ela pretende mover.

Use somente os números fornecidos. Se faltarem dados (ex.: sem receitas no mês, sem saldo inicial de caixa), diga isso na Síntese e transforme o cadastro desses dados na primeira recomendação.`;

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

async function getAuthenticatedUser(token) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('Supabase não configurado no servidor.');
  const r = await fetch(`${url.replace(/\/$/, '')}/auth/v1/user`, {
    headers: { apikey: key, Authorization: `Bearer ${token}` },
  });
  if (!r.ok) return null;
  const user = await r.json();
  return user && user.id ? user : null;
}

async function callGemini({ model, systemInstruction, contents, temperature }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const err = new Error('GEMINI_API_KEY não configurada.');
    err.status = 500;
    throw err;
  }
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents,
        generationConfig: { temperature, maxOutputTokens: 2048 },
      }),
    }
  );
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error((data && data.error && data.error.message) || `Gemini respondeu ${r.status}`);
    err.status = r.status;
    throw err;
  }
  const text = (data.candidates || [])
    .flatMap((c) => (c.content && c.content.parts) || [])
    .map((p) => p.text || '')
    .join('')
    .trim();
  return text;
}

async function generate(args) {
  const primary = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  try {
    return await callGemini({ ...args, model: primary });
  } catch (err) {
    // Modelo inexistente/aposentado: tenta o alias estável mais recente
    if ((err.status === 404 || err.status === 400) && primary !== FALLBACK_MODEL) {
      return await callGemini({ ...args, model: FALLBACK_MODEL });
    }
    throw err;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return send(res, 405, { error: 'Método não permitido.' });
  }

  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return send(res, 401, { error: 'Faça login para usar o CFO Digital.' });

  let user;
  try {
    user = await getAuthenticatedUser(token);
  } catch (e) {
    return send(res, 500, { error: 'Servidor sem configuração de autenticação.' });
  }
  if (!user) return send(res, 401, { error: 'Sessão expirada. Entre novamente.' });

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  body = body || {};

  const action = body.action === 'insights' ? 'insights' : 'chat';
  const contextJson = JSON.stringify(body.financialContext || {}, null, 1);
  if (contextJson.length > MAX_CONTEXT_CHARS) {
    return send(res, 413, { error: 'Contexto financeiro grande demais.' });
  }
  const dataBlock = `\n\nDADOS FINANCEIROS (calculados pelo sistema):\n${contextJson}`;

  try {
    if (action === 'insights') {
      const text = await generate({
        systemInstruction: CHAT_SYSTEM_PROMPT,
        contents: [{ role: 'user', parts: [{ text: INSIGHTS_PROMPT + dataBlock }] }],
        temperature: 0.2,
      });
      return send(res, 200, { insight: text || 'Não foi possível gerar o diagnóstico agora.' });
    }

    const message = String(body.message || '').trim().slice(0, MAX_MESSAGE_CHARS);
    if (!message) return send(res, 400, { error: 'Escreva uma pergunta.' });

    const history = Array.isArray(body.history) ? body.history.slice(-MAX_HISTORY) : [];
    const contents = history
      .filter((h) => h && typeof h.content === 'string' && h.content.trim())
      .map((h) => ({
        role: h.role === 'user' ? 'user' : 'model',
        parts: [{ text: String(h.content).slice(0, MAX_MESSAGE_CHARS * 2) }],
      }));
    contents.push({ role: 'user', parts: [{ text: message }] });

    const text = await generate({
      systemInstruction: CHAT_SYSTEM_PROMPT + dataBlock,
      contents,
      temperature: 0.3,
    });
    return send(res, 200, { reply: text || 'Não consegui gerar uma resposta agora. Tente reformular a pergunta.' });
  } catch (err) {
    console.error('[cfo-ai] erro:', err && err.message);
    const status = err && err.status === 429 ? 429 : 502;
    return send(res, status, {
      error:
        status === 429
          ? 'Limite de uso da IA atingido no momento. Tente de novo em alguns minutos.'
          : 'A IA não respondeu agora. Tente de novo em instantes.',
    });
  }
}
