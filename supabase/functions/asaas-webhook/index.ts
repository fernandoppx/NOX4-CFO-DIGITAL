import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'content-type, asaas-access-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

// Copia o aceite do contrato e a condição comercial do checkout para a assinatura
// e dispara a geração do contrato (PDF + e-mail). Nunca derruba o webhook.
async function finalizeSubscription(admin: any, checkout: any) {
  try {
    if (!checkout?.asaas_subscription_id) return

    const { data: sub, error: subError } = await admin
      .from('subscriptions')
      .select('id, contract_accepted_at, contract_email_sent_at')
      .eq('provider_subscription_id', checkout.asaas_subscription_id)
      .maybeSingle()

    if (subError || !sub) {
      console.error('Assinatura não encontrada para o contrato:', subError?.message || checkout.asaas_subscription_id)
      return
    }

    if (!sub.contract_accepted_at && checkout.contract_accepted_at) {
      const { error: copyError } = await admin
        .from('subscriptions')
        .update({
          company_name: checkout.company_name,
          cpf_cnpj: checkout.cpf_cnpj,
          billing_email: checkout.billing_email,
          phone: checkout.phone,
          contract_version: checkout.contract_version,
          contract_accepted_at: checkout.contract_accepted_at,
          contract_accepted_ip: checkout.contract_accepted_ip,
          promo_label: checkout.promo_label,
          promo_price: checkout.promo_price,
          promo_cycles: checkout.promo_cycles,
          promo_cycles_remaining: Number(checkout.promo_cycles || 0),
          regular_price: checkout.regular_price,
        })
        .eq('id', sub.id)

      if (copyError) {
        console.error('Erro ao copiar aceite para a assinatura:', copyError.message)
        return
      }
    }

    if (sub.contract_email_sent_at || !checkout.contract_accepted_at) return

    const response = await fetch(
      Deno.env.get('SUPABASE_URL') + '/functions/v1/generate-contract',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ subscriptionId: sub.id }),
      },
    )

    if (!response.ok) {
      console.error('generate-contract falhou:', response.status, await response.text())
    }
  } catch (error) {
    console.error('Erro ao finalizar assinatura:', error instanceof Error ? error.message : error)
  }
}

// Mensalidades/anuidades seguintes: conta os ciclos promocionais e, ao fim deles,
// volta a assinatura do Asaas ao preço cheio. Ignora pagamentos repetidos.
async function applyPromoCycle(admin: any, payment: any, event: string) {
  try {
    if (!payment?.subscription) return

    const { error: dupError } = await admin
      .from('asaas_processed_payments')
      .insert({ payment_id: payment.id, event })

    if (dupError) return // já processado (ou tabela indisponível)

    const { data: sub } = await admin
      .from('subscriptions')
      .select('id, promo_cycles_remaining, regular_price')
      .eq('provider_subscription_id', payment.subscription)
      .maybeSingle()

    if (!sub || !(Number(sub.promo_cycles_remaining) > 0)) return

    const remaining = Number(sub.promo_cycles_remaining) - 1

    await admin
      .from('subscriptions')
      .update({ promo_cycles_remaining: remaining })
      .eq('id', sub.id)

    if (remaining > 0 || !(Number(sub.regular_price) > 0)) return

    const apiKey = Deno.env.get('ASAAS_API_KEY')
    const baseUrl = (Deno.env.get('ASAAS_BASE_URL') || '').replace(/\/+$/, '')
    if (!apiKey || !baseUrl) return

    const response = await fetch(baseUrl + '/subscriptions/' + payment.subscription, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', access_token: apiKey },
      body: JSON.stringify({
        value: Number(sub.regular_price),
        updatePendingPayments: true,
      }),
    })

    if (!response.ok) {
      console.error('Erro ao voltar ao preço cheio:', response.status, await response.text())
    }
  } catch (error) {
    console.error('Erro no ciclo promocional:', error instanceof Error ? error.message : error)
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
    })
  }

  if (req.method !== 'POST') {
    return jsonResponse(
      { error: 'Método não permitido.' },
      405,
    )
  }

  try {
    // =========================================================
    // 1. VALIDAR TOKEN DO ASAAS
    // =========================================================

    const receivedToken =
      req.headers.get('asaas-access-token')

    const expectedToken =
      Deno.env.get('ASAAS_WEBHOOK_TOKEN')

    if (!expectedToken) {
      console.error(
        'ASAAS_WEBHOOK_TOKEN não configurado.',
      )

      return jsonResponse(
        { error: 'Webhook não configurado.' },
        500,
      )
    }

    if (
      !receivedToken ||
      receivedToken !== expectedToken
    ) {
      console.warn(
        'Webhook rejeitado: token inválido.',
      )

      return jsonResponse(
        { error: 'Não autorizado.' },
        401,
      )
    }

    // =========================================================
    // 2. LER EVENTO ASAAS
    // =========================================================

    let payload: any

    try {
      payload = await req.json()
    } catch {
      return jsonResponse(
        { error: 'Payload inválido.' },
        400,
      )
    }

    const eventId =
      typeof payload?.id === 'string'
        ? payload.id
        : null

    const event =
      typeof payload?.event === 'string'
        ? payload.event
        : ''

    const payment = payload?.payment

    console.log(
      'Webhook Asaas recebido:',
      eventId,
      event,
      payment?.id,
    )

    // =========================================================
    // 3. SOMENTE EVENTOS DE PAGAMENTO
    // =========================================================

    if (!payment?.id) {
      return jsonResponse({
        received: true,
        ignored: true,
        reason: 'Evento sem payment.id.',
      })
    }

    const paidEvents = [
      'PAYMENT_CONFIRMED',
      'PAYMENT_RECEIVED',
    ]

    if (!paidEvents.includes(event)) {
      return jsonResponse({
        received: true,
        ignored: true,
        event,
      })
    }

    // =========================================================
    // 4. CLIENTE ADMIN SUPABASE
    // =========================================================

    const supabaseUrl =
      Deno.env.get('SUPABASE_URL')

    const serviceRoleKey =
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !serviceRoleKey) {
      console.error(
        'Secrets internos do Supabase ausentes.',
      )

      return jsonResponse(
        { error: 'Erro interno de configuração.' },
        500,
      )
    }

    const admin = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    )

    // =========================================================
    // 5. LOCALIZAR CHECKOUT
    // =========================================================

    let checkout: any = null

    // Primeiro pelo payment ID
    const {
      data: byPayment,
      error: paymentLookupError,
    } = await admin
      .from('checkout_sessions')
      .select('*')
      .eq('asaas_payment_id', payment.id)
      .maybeSingle()

    if (paymentLookupError) {
      console.error(
        'Erro buscando checkout por payment:',
        paymentLookupError.message,
      )
    }

    if (byPayment) {
      checkout = byPayment
    }

    // Depois pela assinatura Asaas
    if (!checkout && payment.subscription) {
      const {
        data: bySubscription,
        error: subscriptionLookupError,
      } = await admin
        .from('checkout_sessions')
        .select('*')
        .eq(
          'asaas_subscription_id',
          payment.subscription,
        )
        .maybeSingle()

      if (subscriptionLookupError) {
        console.error(
          'Erro buscando checkout por assinatura:',
          subscriptionLookupError.message,
        )
      }

      if (bySubscription) {
        checkout = bySubscription
      }
    }

    // Por último externalReference
    if (
      !checkout &&
      typeof payment.externalReference === 'string'
    ) {
      const {
        data: byExternalReference,
        error: externalLookupError,
      } = await admin
        .from('checkout_sessions')
        .select('*')
        .eq(
          'id',
          payment.externalReference,
        )
        .maybeSingle()

      if (externalLookupError) {
        console.error(
          'Erro buscando checkout por externalReference:',
          externalLookupError.message,
        )
      }

      if (byExternalReference) {
        checkout = byExternalReference
      }
    }

    if (!checkout) {
      console.error(
        'Checkout não encontrado:',
        payment.id,
      )

      return jsonResponse({
        received: true,
        matched: false,
        paymentId: payment.id,
      })
    }

    // =========================================================
    // 6. SE JÁ FOI PROVISIONADO
    // =========================================================

    if (
      checkout.status === 'provisioned' &&
      checkout.organization_id
    ) {
      console.log(
        'Checkout já provisionado:',
        checkout.id,
      )

      await applyPromoCycle(admin, payment, event)

      return jsonResponse({
        received: true,
        alreadyProvisioned: true,
        checkoutSessionId: checkout.id,
        organizationId:
          checkout.organization_id,
      })
    }

    // =========================================================
    // 7. MARCAR PAGAMENTO COMO PAID
    // =========================================================

    if (checkout.status !== 'paid') {
      const {
        error: updateError,
      } = await admin
        .from('checkout_sessions')
        .update({
          status: 'paid',
          asaas_payment_id: payment.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', checkout.id)

      if (updateError) {
        console.error(
          'Erro ao marcar checkout como paid:',
          updateError.message,
        )

        return jsonResponse(
          {
            error:
              'Não foi possível atualizar o checkout.',
          },
          500,
        )
      }

      console.log(
        'Checkout marcado como paid:',
        checkout.id,
      )
    }

    // =========================================================
    // 8. PROVISIONAR CIA + OWNER + ASSINATURA
    // =========================================================

    const {
      data: organizationId,
      error: provisionError,
    } = await admin.rpc(
      'provision_paid_checkout',
      {
        p_checkout_id: checkout.id,
      },
    )

    if (provisionError) {
      console.error(
        'Erro ao provisionar CIA:',
        provisionError.message,
      )

      // Retornamos 500 propositalmente.
      // Assim o Asaas poderá reenviar o webhook.
      // A função SQL é idempotente.
      return jsonResponse(
        {
          error:
            'Pagamento recebido, mas houve erro ao liberar a empresa.',
        },
        500,
      )
    }

    if (!organizationId) {
      console.error(
        'Provisionamento não retornou organizationId.',
      )

      return jsonResponse(
        {
          error:
            'Não foi possível identificar a empresa criada.',
        },
        500,
      )
    }

    console.log(
      'CIA provisionada com sucesso:',
      organizationId,
    )

    // Contrato: copia o aceite para a assinatura e envia o PDF por e-mail
    await finalizeSubscription(admin, checkout)

    // =========================================================
    // 9. SUCESSO
    // =========================================================

    return jsonResponse({
      received: true,
      paid: true,
      provisioned: true,

      checkoutSessionId:
        checkout.id,

      organizationId,

      message:
        'Pagamento confirmado e empresa liberada com sucesso.',
    })
  } catch (error) {
    console.error(
      'Erro inesperado no asaas-webhook:',
      error instanceof Error
        ? error.message
        : error,
    )

    return jsonResponse(
      {
        error:
          'Erro interno no processamento do webhook.',
      },
      500,
    )
  }
})
