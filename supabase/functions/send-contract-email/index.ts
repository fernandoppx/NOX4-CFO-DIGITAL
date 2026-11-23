// Edge Function: send-contract-email
//
// Envia ao cliente, por e-mail, o Contrato de Licença de Uso do NOX4 depois que o
// primeiro pagamento é confirmado. Deve ser chamada pelo webhook do Asaas
// (eventos PAYMENT_RECEIVED / PAYMENT_CONFIRMED), servidor para servidor:
//
//   await fetch(`${SUPABASE_URL}/functions/v1/send-contract-email`, {
//     method: 'POST',
//     headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
//     body: JSON.stringify({ subscriptionId }),
//   });
//
// Secrets necessários (Supabase > Edge Functions > Secrets):
//   RESEND_API_KEY       chave da conta Resend (https://resend.com)
//   CONTRACT_FROM_EMAIL  remetente verificado, ex.: "NOX4 <contratos@seudominio.com.br>"
//   APP_URL              ex.: https://nox4-cfo-digital.vercel.app
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (já existem nas Edge Functions)
//
// Idempotente: se contract_email_sent_at já estiver preenchido, não reenvia.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM = Deno.env.get('CONTRACT_FROM_EMAIL');
const APP_URL = (Deno.env.get('APP_URL') || '').replace(/\/$/, '');

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

const brl = (v?: number | null) =>
  v == null ? '' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  // Só chamadas internas (service role)
  const auth = req.headers.get('Authorization') || '';
  if (auth !== `Bearer ${SERVICE_ROLE}`) return json(401, { error: 'unauthorized' });

  if (!RESEND_API_KEY || !FROM || !APP_URL) return json(500, { error: 'email_not_configured' });

  const { subscriptionId } = await req.json().catch(() => ({}));
  if (!subscriptionId) return json(400, { error: 'subscriptionId_required' });

  const db = createClient(SUPABASE_URL, SERVICE_ROLE);

  const { data: sub, error } = await db
    .from('subscriptions')
    .select('id, billing_email, company_name, contract_version, contract_accepted_at, contract_email_sent_at, plan:plans(name, billing_cycle, base_price, annual_price), promo_label, regular_price')
    .eq('id', subscriptionId)
    .maybeSingle();

  if (error) return json(500, { error: error.message });
  if (!sub) return json(404, { error: 'subscription_not_found' });
  if (sub.contract_email_sent_at) return json(200, { ok: true, alreadySent: true });
  if (!sub.billing_email) return json(422, { error: 'billing_email_missing' });

  const plan: any = Array.isArray(sub.plan) ? sub.plan[0] : sub.plan;
  const yearly = plan?.billing_cycle === 'yearly';
  const fullPrice = yearly ? plan?.annual_price : plan?.base_price;
  const contractUrl = `${APP_URL}/contrato.html`;
  const acceptedAt = sub.contract_accepted_at
    ? new Date(sub.contract_accepted_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    : '';

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#0F172A;line-height:1.6">
    <h2 style="margin:0 0 12px">Bem-vindo ao NOX4</h2>
    <p>Olá${sub.company_name ? `, ${escapeHtml(sub.company_name)}` : ''}. Seu pagamento foi confirmado e sua assinatura está ativa.</p>
    <table style="border-collapse:collapse;width:100%;font-size:14px;margin:16px 0">
      <tr><td style="padding:6px 0;color:#475569">Plano</td><td style="padding:6px 0"><strong>${escapeHtml(plan?.name || '')}</strong></td></tr>
      <tr><td style="padding:6px 0;color:#475569">Ciclo</td><td style="padding:6px 0">${yearly ? 'Anual' : 'Mensal'}</td></tr>
      ${sub.promo_label ? `<tr><td style="padding:6px 0;color:#475569">Condição</td><td style="padding:6px 0">${escapeHtml(sub.promo_label)}. Depois do período promocional: ${brl(sub.regular_price ?? fullPrice)}${yearly ? '/ano' : '/mês'}</td></tr>` : ''}
      <tr><td style="padding:6px 0;color:#475569">Contrato</td><td style="padding:6px 0">Versão ${escapeHtml(sub.contract_version || '1.0')}${acceptedAt ? `, aceito em ${acceptedAt}` : ''}</td></tr>
    </table>
    <p>O Contrato de Licença de Uso que você aceitou no checkout está disponível em:</p>
    <p><a href="${contractUrl}" style="display:inline-block;padding:12px 20px;background:#2563EB;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold">Ver contrato</a></p>
    <p style="font-size:13px;color:#475569">Guarde este e-mail como comprovante. Você pode desistir em até 7 dias da contratação com devolução integral, conforme o item 4.3 do contrato.</p>
    <p><a href="${APP_URL}">Acessar o NOX4</a></p>
  </div>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM,
      to: [sub.billing_email],
      subject: 'NOX4: sua assinatura e o contrato de licença de uso',
      html,
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    return json(502, { error: 'email_send_failed', detail });
  }

  await db.from('subscriptions').update({ contract_email_sent_at: new Date().toISOString() }).eq('id', sub.id);
  return json(200, { ok: true });
});
