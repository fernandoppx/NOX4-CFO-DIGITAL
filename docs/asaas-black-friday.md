# Asaas: cobrança dos novos planos e da Black Friday

O front-end já mostra os novos planos e o preço promocional. **Quem cobra é a Edge Function `asaas-start-checkout`**, que fica só no Supabase (o código não está neste repositório). Ela precisa dos ajustes abaixo **antes** de rodar `supabase/migrations/20261123120000_planos_black_friday.sql`; senão a tela mostra o desconto e o Asaas cobra o preço cheio.

## 1. Valor da assinatura no checkout (`asaas-start-checkout`)

Ao ler o plano no banco (nunca o preço enviado pelo navegador):

```ts
const now = new Date();
const promoAtiva =
  plan.promo_price != null &&
  plan.promo_price > 0 &&
  (!plan.promo_starts_at || now >= new Date(plan.promo_starts_at)) &&
  (!plan.promo_ends_at || now <= new Date(plan.promo_ends_at));

const precoCheio = plan.billing_cycle === 'yearly' ? plan.annual_price : plan.base_price;
const valorInicial = promoAtiva ? plan.promo_price : precoCheio;
const ciclosPromo = promoAtiva ? (plan.promo_cycles ?? 1) : 0;
```

- Criar a assinatura no Asaas (`POST /v3/subscriptions`) com `value: valorInicial` e `cycle: 'MONTHLY' | 'YEARLY'`.
- Gravar na tabela `subscriptions` (colunas novas, abaixo): `promo_cycles_remaining = ciclosPromo`, `regular_price = precoCheio`, `promo_label = plan.promo_label`.
- Devolver na resposta `firstPayment.amount = valorInicial` e `recurring.amount = precoCheio` quando houver promoção (o checkout já exibe esses campos).

```sql
alter table public.subscriptions add column if not exists promo_cycles_remaining integer not null default 0;
alter table public.subscriptions add column if not exists regular_price numeric(10,2);
alter table public.subscriptions add column if not exists promo_label text;
```

## 2. Voltar ao preço cheio (webhook do Asaas)

No webhook de pagamento (eventos `PAYMENT_RECEIVED` e `PAYMENT_CONFIRMED`), além de ativar a assinatura:

1. Se `promo_cycles_remaining > 0`, diminuir 1.
2. Se chegou a 0 e `regular_price` existe: `POST /v3/subscriptions/{id}` com `{ "value": regular_price, "updatePendingPayments": true }`.
   - Anual (1 ciclo): o 2º ano já sai pelo preço cheio.
   - Mensal (3 ciclos): a partir da 4ª cobrança.
3. Tratar o mesmo pagamento recebido duas vezes (o Asaas pode reenviar o evento): guardar o `payment.id` processado e ignorar repetidos.

## 3. Checklist de publicação

- [ ] Supabase reativado.
- [ ] Conferir se a conta Asaas está em produção (`https://api.asaas.com`) ou sandbox (`https://api-sandbox.asaas.com`).
- [ ] Chave de API configurada só nos *secrets* das Edge Functions (nunca no front-end nem no GitHub).
- [ ] Webhook cadastrado no painel do Asaas apontando para a função de webhook, com token de autenticação.
- [ ] Ajustes 1 e 2 publicados nas Edge Functions.
- [ ] SQL dos planos rodado; conferir a consulta final do script.
- [ ] Teste em sandbox: assinar Profissional Anual e Mensal com Pix e cartão de teste; conferir valor da 1ª cobrança e, no mensal, a troca de valor após o 3º pagamento.
- [ ] Assinantes antigos (NOX4 Mensal/Anual) seguem nos planos antigos, que ficam inativos para novas vendas.
