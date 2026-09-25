import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Initialize GoogleGenAI SDK safely
let ai: GoogleGenAI | null = null;
function getAIClient(): GoogleGenAI {
  if (!ai) {
    ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return ai;
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// CFO AI Chat endpoint
app.post('/api/cfo-ai/chat', async (req, res) => {
  try {
    const { message, history, financialContext } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Mensagem é obrigatória' });
    }

    const systemPrompt = `Você é o "CFO Digital" da NOX4 Aceleradora de Resultados (Aceleradora de Negócios Fitness & Marketing Digital) e do ecossistema financeiro.

DIRETRIZES CRÍTICAS & OBRIGATÓRIAS:
1. NÃO REALIZE CÁLCULOS FINANCEIROS ARBITRÁRIOS OU ALUCINADOS. Todos os números oficiais (DRE, Fluxo de Caixa, Margens, Ponto de Equilíbrio, CAC, LTV, Runway, Folha, Despesas) já foram calculados de forma 100% determinística pelo backend e estão fornecidos abaixo no bloco de contexto financeiro estruturado.
2. TODA resposta com análise numérica DEVE citar os valores exatos fornecidos no contexto.
3. Se o usuário perguntar "Por que meu lucro caiu?", explique detalhadamente a variação comparativa com o período anterior detalhando: Receita, Folha, Custos de Serviços, Despesas Comerciais e Administrativas.
4. Se o usuário perguntar sobre simulações (ex: "Quanto preciso faturar para ter R$ 50 mil de lucro?"), utilize a fórmula clássica: Faturamento Necessário = (Custos Fixos + Lucro Desejado) / Margem de Contribuição %, aplicando os valores exatos de Margem de Contribuição e Custos Fixos fornecidos no contexto.
5. Se não houver dados suficientes para responder a uma pergunta específica, declare com clareza e elegância que não há lançamentos registrados para aquele parâmetro.
6. Mantenha tom executivo, confiante, estratégico, objetivo e embasado em dados, no estilo de um Diretor Financeiro (CFO) de alto nível. Responda em Português do Brasil com formatação clara em Markdown (tópicos, negrito, valores em R$).

DADOS FINANCEIROS OFICIAIS CALCULADOS DETERMINISTICAMENTE:
${JSON.stringify(financialContext, null, 2)}
`;

    const client = getAIClient();

    // Prepare contents array with history and current prompt
    const contents: any[] = [];
    if (history && Array.isArray(history)) {
      history.slice(-6).forEach((h: { role: string; content: string }) => {
        contents.push({
          role: h.role === 'user' ? 'user' : 'model',
          parts: [{ text: h.content }],
        });
      });
    }
    contents.push({
      role: 'user',
      parts: [{ text: message }],
    });

    const response = await client.models.generateContent({
      model: 'gemini-3.7-flash',
      contents,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.3, // low temperature for grounded analysis
      },
    });

    const responseText = response.text || 'Não foi possível gerar a análise no momento.';
    res.json({ reply: responseText });
  } catch (error: any) {
    console.error('Error in /api/cfo-ai/chat:', error);
    res.status(500).json({
      error: 'Erro ao processar análise do CFO IA',
      details: error?.message || String(error),
    });
  }
});

// CFO AI Proactive Monthly Diagnostic
app.post('/api/cfo-ai/insights', async (req, res) => {
  try {
    const { financialContext } = req.body;

    const prompt = `Analise os dados financeiros determinísticos da empresa e gere um relatório de Diagnóstico Executivo Mensal estruturado com:
1. Síntese Geral da Saúde Financeira (Lucro Líquido, Margem Líquida, Runway e Ponto de Equilíbrio).
2. 3 Principais Pontos de Atenção ou Riscos (Queda de margem, concentração de receitas, despesas em alta).
3. 3 Recomendações Estratégicas de Alto Impacto para o próximo mês (otimização de CAC, revisão de custos fixos, precificação).

DADOS FINANCEIROS CALCULADOS:
${JSON.stringify(financialContext, null, 2)}
`;

    const client = getAIClient();
    const response = await client.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        systemInstruction:
          'Você é o CFO Digital executivo. Seja direto, cirúrgico e utilize estritamente os números fornecidos. Responda em Português com formatação Markdown executiva.',
        temperature: 0.2,
      },
    });

    res.json({ insight: response.text });
  } catch (error: any) {
    console.error('Error in /api/cfo-ai/insights:', error);
    res.status(500).json({
      error: 'Erro ao gerar insights proativos do CFO IA',
      details: error?.message || String(error),
    });
  }
});

// Vite & Static Asset Handling
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`NOX4 Financial ERP Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
