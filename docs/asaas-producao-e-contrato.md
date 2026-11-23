# Asaas em produção + contrato por e-mail

Passo a passo para sair do sandbox e começar a cobrar de verdade, com o contrato aceito no checkout e enviado por e-mail.
Complementa `docs/asaas-black-friday.md`.

## Antes de tudo

- [ ] Supabase reativado (o sistema não abre sem ele).
- [ ] Contrato revisado por advogado e campos `[RAZÃO SOCIAL]`, `[CNPJ]`, `[ENDEREÇO]`, `[E-MAIL]`, `[CIDADE/UF]` preenchidos em `docs/contrato-licenca-nox4.md` **e** em `public/contrato.html` (a página pública que o checkout e o e-mail abrem).

## 1. Conta Asaas de produção

1. Criar ou acessar a conta em https://www.asaas.com com o CNPJ da empresa vendedora.
2. Enviar a documentação pedida e aguardar a **aprovação da conta** (sem aprovação, a API de produção recusa cobranças).
3. Em *Integrações > Chave de API*, gerar a chave de **produção**. Ela começa com `$aact_prod_`.
   - Nunca colar a chave no código, no GitHub, em chat ou em planilha.

## 2. Trocar sandbox por produção nas Edge Functions

No Supabase: *Edge Functions > Secrets*.

| Secret | Sandbox (hoje) | Produção |
|---|---|---|
| Chave da API (nome usado nas funções, ex.: `ASAAS_API_KEY`) | `$aact_hmlg_...` | `$aact_prod_...` |
| URL da API (ex.: `ASAAS_API_URL` / `ASAAS_BASE_URL`) | `https://api-sandbox.asaas.com/v3` | `https://api.asaas.com/v3` |

- Conferir no código das funções `asaas-*` o nome exato dos secrets e se a URL está fixa no código (se estiver, trocar para ler do secret).
- Clientes e assinaturas criados no sandbox **não existem** em produção. Assinaturas de teste gravadas na tabela `subscriptions` devem ser canceladas/limpas antes de abrir as vendas.

## 3. Webhook de produção

1. No Asaas de produção: *Integrações > Webhooks > Adicionar*.
2. URL: a função de webhook do Supabase (`https://<projeto>.supabase.co/functions/v1/<nome-da-funcao-de-webhook>`).
3. Eventos: `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`, `PAYMENT_OVERDUE`, `PAYMENT_REFUNDED`, `SUBSCRIPTION_DELETED`.
4. Definir um **token de autenticação** e guardar o mesmo valor no secret da função (ex.: `ASAAS_WEBHOOK_TOKEN`). A função deve recusar chamadas sem o header `asaas-access-token` igual a ele.

## 4. Contrato no checkout e por e-mail

O que já está no código (PR #1):

- O checkout só deixa continuar com a caixa **"Li e aceito o Contrato de Licença de Uso"** marcada, com link para `/contrato.html`.
- O checkout envia `acceptedContractVersion: "1.0"` para `asaas-start-checkout`.
- Função nova `supabase/functions/send-contract-email` (envia o e-mail com o link do contrato, dados do plano e data do aceite; não reenvia).
- Migração `supabase/migrations/20261123180000_aceite_contrato.sql` (colunas do aceite em `subscriptions`).

O que precisa ser feito no Supabase:

1. Rodar a migração do aceite.
2. Em `asaas-start-checkout`: ao criar a assinatura, gravar `contract_version = body.acceptedContractVersion`, `contract_accepted_at = now()`, `contract_accepted_ip` (header `x-forwarded-for`), `billing_email` e `company_name`. **Recusar** o checkout se `acceptedContractVersion` não vier.
3. Criar conta no [Resend](https://resend.com), verificar o domínio de envio e cadastrar os secrets `RESEND_API_KEY`, `CONTRACT_FROM_EMAIL` e `APP_URL`.
4. Publicar a função: `supabase functions deploy send-contract-email --no-verify-jwt`.
5. No webhook, no **primeiro** pagamento confirmado da assinatura, chamar `send-contract-email` com `{ subscriptionId }` (exemplo no topo do arquivo da função).

## 5. Teste antes de abrir as vendas

- [ ] Comprar o plano mais barato (Essencial mensal) com cartão real da empresa.
- [ ] Conferir: cobrança no painel do Asaas, assinatura ativa no NOX4, e-mail com o contrato recebido.
- [ ] Estornar a cobrança pelo painel do Asaas e cancelar a assinatura de teste.
- [ ] Só então divulgar a landing page e a Black Friday.
