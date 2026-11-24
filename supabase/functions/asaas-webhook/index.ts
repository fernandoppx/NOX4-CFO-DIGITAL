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
