// Edge Function: generate-contract
//
// Gera o Contrato de Licença de Uso do NOX4 em PDF, preenchido com os dados que o
// cliente informou no checkout (razão social/nome, CPF/CNPJ, e-mail, telefone), o
// endereço oficial do CNPJ (BrasilAPI / Receita Federal), o plano e o preço contratados
// e o registro do aceite. Guarda o PDF no Storage (bucket privado "contracts") e envia
// por e-mail ao cliente, com o PDF anexado.
//
// Chamada pelo webhook do Asaas no PRIMEIRO pagamento confirmado da assinatura
// (eventos PAYMENT_CONFIRMED / PAYMENT_RECEIVED), servidor para servidor:
//
//   await fetch(`${SUPABASE_URL}/functions/v1/generate-contract`, {
//     method: 'POST',
//     headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
//     body: JSON.stringify({ subscriptionId }),
//   });
//
// Secrets (Supabase > Edge Functions > Secrets):
//   RESEND_API_KEY       chave da conta Resend (https://resend.com)
//   CONTRACT_FROM_EMAIL  remetente de domínio verificado, ex.: "NOX4 <contratos@nox4.com.br>"
//   APP_URL              ex.: https://nox4-cfo-digital.vercel.app
//   CONTRACT_BCC_EMAIL   (opcional) cópia oculta para o arquivo da NOX4
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (já existem)
//
// Idempotente: se contract_email_sent_at já estiver preenchido, não gera nem envia de novo
// (para reenviar, limpe esse campo).
//
// Deploy: supabase functions deploy generate-contract --no-verify-jwt

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import * as PDFLib from 'https://esm.sh/pdf-lib@1.17.1';
import { buildContract, CONTRACT_VERSION, formatBRL } from '../_shared/contractTemplate.ts';
import { renderContractPdf } from '../_shared/contractPdf.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM = Deno.env.get('CONTRACT_FROM_EMAIL');
const BCC = Deno.env.get('CONTRACT_BCC_EMAIL');
const APP_URL = (Deno.env.get('APP_URL') || '').replace(/\/$/, '');
const BUCKET = 'contracts';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

const toBase64 = (bytes: Uint8Array) => {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};

const sha256Hex = async (bytes: Uint8Array) =>
  Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

/** Endereço oficial do CNPJ na Receita Federal (via BrasilAPI). Falha silenciosa: o contrato sai sem endereço. */
async function lookupCnpjAddress(cnpj: string): Promise<{ name?: string; address?: string } | null> {
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length !== 14) return null;
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const d = await res.json();
    const cep = String(d.cep || '').replace(/^(\d{5})(\d{3})$/, '$1-$2');
    const parts = [
      [d.descricao_tipo_de_logradouro, d.logradouro].filter(Boolean).join(' '),
      d.numero,
      d.complemento,
      d.bairro,
      d.municipio && d.uf ? `${d.municipio}/${d.uf}` : d.municipio,
      cep ? `CEP ${cep}` : '',
    ].filter((p: string) => p && String(p).trim());
    return { name: d.razao_social, address: parts.join(', ') };
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  if ((req.headers.get('Authorization') || '') !== `Bearer ${SERVICE_ROLE}`) return json(401, { error: 'unauthorized' });
  if (!RESEND_API_KEY || !FROM || !APP_URL) return json(500, { error: 'email_not_configured' });

  const { subscriptionId } = await req.json().catch(() => ({}));
  if (!subscriptionId) return json(400, { error: 'subscriptionId_required' });

  const db = createClient(SUPABASE_URL, SERVICE_ROLE);

  const { data: sub, error } = await db
    .from('subscriptions')
    .select(
      'id, organization_id, billing_email, company_name, cpf_cnpj, phone, contract_version, contract_accepted_at, contract_accepted_ip, contract_email_sent_at, promo_label, promo_price, promo_cycles, regular_price, plan:plans(name, billing_cycle, base_price, annual_price, max_organizations, included_users, extra_user_price, extra_company_price)'
    )
    .eq('id', subscriptionId)
    .maybeSingle();

  if (error) return json(500, { error: error.message });
  if (!sub) return json(404, { error: 'subscription_not_found' });
  if (sub.contract_email_sent_at) return json(200, { ok: true, alreadySent: true });
  if (!sub.billing_email || !sub.company_name || !sub.cpf_cnpj) return json(422, { error: 'customer_data_missing' });
  if (!sub.contract_accepted_at) return json(422, { error: 'contract_not_accepted' });

  // deno-lint-ignore no-explicit-any
  const plan: any = Array.isArray(sub.plan) ? sub.plan[0] : sub.plan;
  if (!plan) return json(422, { error: 'plan_missing' });
  const cycle = plan.billing_cycle === 'yearly' ? 'yearly' : 'monthly';
  const regularPrice = Number(sub.regular_price ?? (cycle === 'yearly' ? plan.annual_price : plan.base_price));

  const cnpjInfo = await lookupCnpjAddress(sub.cpf_cnpj);

  const doc = buildContract({
    customer: {
      // Mantém o nome digitado pelo cliente; o endereço vem da Receita quando é CNPJ
      name: sub.company_name,
      document: sub.cpf_cnpj,
      email: sub.billing_email,
      phone: sub.phone,
      address: cnpjInfo?.address || null,
    },
    purchase: {
      planName: String(plan.name || '').replace(/\s+(Mensal|Anual)$/i, ''),
      cycle,
      regularPrice,
      maxCompanies: plan.max_organizations,
      includedUsers: plan.included_users,
      extraUserPrice: Number(plan.extra_user_price || 0),
      extraCompanyPrice: plan.extra_company_price,
      promo:
        sub.promo_price && sub.promo_cycles
          ? { label: sub.promo_label || 'Condição promocional', price: Number(sub.promo_price), cycles: sub.promo_cycles }
          : null,
    },
    acceptance: {
      acceptedAt: sub.contract_accepted_at,
      ip: sub.contract_accepted_ip,
      reference: sub.id,
    },
  });

  const pdfBytes = await renderContractPdf(doc, PDFLib);
  const hash = await sha256Hex(pdfBytes);
  const fileName = `Contrato-NOX4-v${CONTRACT_VERSION}-${String(sub.cpf_cnpj).replace(/\D/g, '')}.pdf`;
  const path = `${sub.organization_id || 'sem-organizacao'}/${sub.id}/${fileName}`;

  const { error: upErr } = await db.storage
    .from(BUCKET)
    .upload(path, pdfBytes, { contentType: 'application/pdf', upsert: true });
  if (upErr) return json(500, { error: 'storage_upload_failed', detail: upErr.message });

  const promoLine = sub.promo_price
    ? `<tr><td style="padding:6px 0;color:#475569">Condição</td><td style="padding:6px 0">${escapeHtml(sub.promo_label || 'Promoção')}: ${formatBRL(Number(sub.promo_price))} ${cycle === 'yearly' ? 'no 1º ano' : `nos ${sub.promo_cycles} primeiros meses`}. Depois, ${formatBRL(regularPrice)}${cycle === 'yearly' ? '/ano' : '/mês'}.</td></tr>`
    : '';

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#0F172A;line-height:1.6">
    <h2 style="margin:0 0 12px">Bem-vindo ao NOX4</h2>
    <p>Olá, ${escapeHtml(sub.company_name)}. Seu pagamento foi confirmado e sua assinatura está ativa.</p>
    <table style="border-collapse:collapse;width:100%;font-size:14px;margin:16px 0">
      <tr><td style="padding:6px 0;color:#475569">Plano</td><td style="padding:6px 0"><strong>${escapeHtml(String(plan.name || ''))}</strong></td></tr>
      ${promoLine}
      <tr><td style="padding:6px 0;color:#475569">Contrato</td><td style="padding:6px 0">Versão ${CONTRACT_VERSION}, em anexo (PDF)</td></tr>
    </table>
    <p>Em anexo está o seu <strong>Contrato de Licença de Uso</strong>, preenchido com os dados da sua empresa, o plano contratado e o registro do aceite feito no checkout. Guarde este e-mail como comprovante.</p>
    <p style="font-size:13px;color:#475569">Você pode desistir em até 7 dias da contratação com devolução integral (cláusula 4.3).</p>
    <p><a href="${APP_URL}" style="display:inline-block;padding:12px 20px;background:#2563EB;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold">Acessar o NOX4</a></p>
    <p style="font-size:12px;color:#94A3B8">NOX4 ASSESSORIA E CONSULTORIA MARKETING LTDA · CNPJ 67.262.346/0001-39 · Pindamonhangaba/SP<br>Código de integridade do PDF (SHA-256): ${hash}</p>
  </div>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM,
      to: [sub.billing_email],
      ...(BCC ? { bcc: [BCC] } : {}),
      subject: 'NOX4: seu contrato de licença de uso',
      html,
      attachments: [{ filename: fileName, content: toBase64(pdfBytes) }],
    }),
  });

  if (!res.ok) {
    // PDF já está salvo; grava o caminho para reenviar depois
    await db.from('subscriptions').update({ contract_pdf_path: path, contract_pdf_sha256: hash }).eq('id', sub.id);
    return json(502, { error: 'email_send_failed', detail: await res.text() });
  }

  await db
    .from('subscriptions')
    .update({
      contract_pdf_path: path,
      contract_pdf_sha256: hash,
      contract_email_sent_at: new Date().toISOString(),
    })
    .eq('id', sub.id);

  return json(200, { ok: true, path, sha256: hash });
});
