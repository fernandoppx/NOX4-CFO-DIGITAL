import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
  'authorization, x-client-info, apikey, content-type',
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

function getBrazilDate(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())

  const year =
    parts.find((p) => p.type === 'year')?.value

  const month =
    parts.find((p) => p.type === 'month')?.value

  const day =
    parts.find((p) => p.type === 'day')?.value

  return `${year}-${month}-${day}`
}

function pad2(value: number) {
  return String(value).padStart(2, '0')
}

function makeDate(
  year: number,
  month: number,
  day: number,
) {
  return `${year}-${pad2(month)}-${pad2(day)}`
}

function parseDate(iso: string) {
  const [year, month, day] =
    iso.split('-').map(Number)

  return { year, month, day }
}

function utcTime(iso: string) {
  const { year, month, day } =
    parseDate(iso)

  return Date.UTC(
    year,
    month - 1,
    day,
  )
}

function daysBetween(
  start: string,
  end: string,
) {
  return Math.round(
    (utcTime(end) - utcTime(start)) /
      86400000,
  )
}

function roundMoney(value: number) {
  return Math.round(
    (value + Number.EPSILON) * 100,
  ) / 100
}

function previousMonthlyDate(
  renewalDate: string,
  renewalDay: number,
) {
  const { year, month } =
    parseDate(renewalDate)

  const date = new Date(
    Date.UTC(year, month - 2, 1),
  )

  return makeDate(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    renewalDay,
  )
}

function nextRenewalDate(
  today: string,
  billingCycle: 'monthly' | 'yearly',
  renewalMonth: number,
  renewalDay: number,
) {
  const {
    year,
    month,
  } = parseDate(today)

  if (billingCycle === 'monthly') {
    const thisMonth =
      makeDate(
        year,
        month,
        renewalDay,
      )

    if (today < thisMonth) {
      return thisMonth
    }

    const nextMonth =
      new Date(
        Date.UTC(
          year,
          month,
          1,
        ),
      )

    return makeDate(
      nextMonth.getUTCFullYear(),
      nextMonth.getUTCMonth() + 1,
      renewalDay,
    )
  }

  const thisYear =
    makeDate(
      year,
      renewalMonth,
      renewalDay,
    )

  if (today < thisYear) {
    return thisYear
  }

  return makeDate(
    year + 1,
    renewalMonth,
    renewalDay,
  )
}

function calculateProration(
  today: string,
  renewalDate: string,
  billingCycle: 'monthly' | 'yearly',
  fullCycleAmount: number,
  renewalMonth: number,
  renewalDay: number,
) {
  let previousRenewalDate: string

  if (billingCycle === 'monthly') {
    previousRenewalDate =
      previousMonthlyDate(
        renewalDate,
        renewalDay,
      )
  } else {
    const renewalYear =
      parseDate(renewalDate).year

    previousRenewalDate =
      makeDate(
        renewalYear - 1,
        renewalMonth,
        renewalDay,
      )
  }

  const cycleDays =
    daysBetween(
      previousRenewalDate,
      renewalDate,
    )

  const remainingDays =
    daysBetween(
      today,
      renewalDate,
    )

  if (
    cycleDays <= 0 ||
    remainingDays <= 0
  ) {
    throw new Error(
      'Período proporcional inválido.',
    )
  }

  const amount =
    roundMoney(
      fullCycleAmount *
        (remainingDays / cycleDays),
    )

  return {
    amount,
    remainingDays,
    cycleDays,
  }
}

// Versão do Contrato de Licença de Uso exigida no checkout
const CONTRACT_VERSION = '1.0'

// Promoção vigente do plano (ex.: Black Friday). Retorna o valor por ciclo, ou null.
function getActivePromo(
  plan: any,
  billingCycle: 'monthly' | 'yearly',
  regularCycleAmount: number,
) {
  const price = Number(plan?.promo_price)
  if (!Number.isFinite(price) || price <= 0) return null
  if (price >= regularCycleAmount) return null
  const now = Date.now()
  if (plan.promo_starts_at && now < new Date(plan.promo_starts_at).getTime()) return null
  if (plan.promo_ends_at && now > new Date(plan.promo_ends_at).getTime()) return null
  const cycles = Math.max(1, Number(plan.promo_cycles) || 1)
  return {
    label: typeof plan.promo_label === 'string' && plan.promo_label ? plan.promo_label : 'Promoção',
    price: roundMoney(price),
    cycles,
    billingCycle,
  }
}

function getAsaasError(
  data: any,
  fallback: string,
) {
  if (
    Array.isArray(data?.errors) &&
    data.errors.length > 0
  ) {
    return (
      data.errors
        .map(
          (item: any) =>
            item?.description ||
            item?.code,
        )
        .filter(Boolean)
        .join(' | ') ||
      fallback
    )
  }

  return fallback
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
    })
  }

  if (req.method !== 'POST') {
    return jsonResponse(
      {
        error:
          'Método não permitido.',
      },
      405,
    )
  }

  try {
    // =====================================================
    // AUTENTICAÇÃO
    // =====================================================

    const authHeader =
      req.headers.get('Authorization')

    if (
      !authHeader?.startsWith(
        'Bearer ',
      )
    ) {
      return jsonResponse(
        {
          error:
            'Usuário não autenticado.',
        },
        401,
      )
    }

    const token =
      authHeader
        .replace('Bearer ', '')
        .trim()

    const supabaseUrl =
      Deno.env.get('SUPABASE_URL')

    const anonKey =
      Deno.env.get(
        'SUPABASE_ANON_KEY',
      )

    const serviceRoleKey =
      Deno.env.get(
        'SUPABASE_SERVICE_ROLE_KEY',
      )

    if (
      !supabaseUrl ||
      !anonKey ||
      !serviceRoleKey
    ) {
      return jsonResponse(
        {
          error:
            'Erro interno de configuração.',
        },
        500,
      )
    }

    const userClient =
      createClient(
        supabaseUrl,
        anonKey,
        {
          global: {
            headers: {
              Authorization:
                authHeader,
            },
          },
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        },
      )

    const {
      data: { user },
      error: userError,
    } =
      await userClient.auth.getUser(
        token,
      )

    if (
      userError ||
      !user
    ) {
      return jsonResponse(
        {
          error:
            'Sessão inválida ou expirada.',
        },
        401,
      )
    }

    const admin =
      createClient(
        supabaseUrl,
        serviceRoleKey,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        },
      )

    // =====================================================
    // BODY
    // =====================================================

    let body: Record<
      string,
      unknown
    >

    try {
      body = await req.json()
    } catch {
      return jsonResponse(
        {
          error:
            'Dados do checkout inválidos.',
        },
        400,
      )
    }

    const planId =
      typeof body.planId ===
      'string'
        ? body.planId.trim()
        : ''

    const companyName =
      typeof body.companyName ===
      'string'
        ? body.companyName.trim()
        : ''

    const cpfCnpj =
      typeof body.cpfCnpj ===
      'string'
        ? body.cpfCnpj.replace(
            /\D/g,
            '',
          )
        : ''

    const billingEmail =
      typeof body.billingEmail ===
      'string'
        ? body.billingEmail
            .trim()
            .toLowerCase()
        : user.email
              ?.trim()
              .toLowerCase() ||
          ''

    const phone =
      typeof body.phone ===
      'string'
        ? body.phone.replace(
            /\D/g,
            '',
          )
        : ''

    // Aceite do Contrato de Licença de Uso (obrigatório)
    const acceptedContractVersion =
      typeof body.acceptedContractVersion === 'string'
        ? body.acceptedContractVersion.trim()
        : ''

    const acceptedIp =
      (req.headers.get('x-forwarded-for') || '')
        .split(',')[0]
        .trim() || null

    if (!planId) {
      return jsonResponse(
        {
          error:
            'Plano não informado.',
        },
        400,
      )
    }

    if (acceptedContractVersion !== CONTRACT_VERSION) {
      return jsonResponse(
        {
          error:
            'Para continuar, aceite o Contrato de Licença de Uso do NOX4.',
        },
        400,
      )
    }

    if (!companyName) {
      return jsonResponse(
        {
          error:
            'Informe o nome da empresa.',
        },
        400,
      )
    }

    if (
      cpfCnpj.length !== 14
    ) {
      return jsonResponse(
        {
          error:
            'Informe um CNPJ válido com 14 dígitos.',
        },
        400,
      )
    }

    if (!billingEmail) {
      return jsonResponse(
        {
          error:
            'Informe um e-mail de cobrança.',
        },
        400,
      )
    }

    // =====================================================
    // USUÁRIO NÃO PODE POSSUIR CIA
    // =====================================================

    const {
      data: memberships,
      error: membershipsError,
    } =
      await admin
        .from(
          'organization_members',
        )
        .select(
          'organization_id',
        )
        .eq(
          'user_id',
          user.id,
        )
        .limit(1)

    if (
      membershipsError
    ) {
      return jsonResponse(
        {
          error:
            'Não foi possível validar sua conta.',
        },
        500,
      )
    }

    if (
      memberships &&
      memberships.length > 0
    ) {
      return jsonResponse(
        {
          error:
            'Sua conta já possui acesso a uma empresa.',
        },
        409,
      )
    }

    // =====================================================
    // PLANO
    // =====================================================

    const {
      data: plan,
      error: planError,
    } =
      await admin
        .from('plans')
        .select(`
          id,
          name,
          base_price,
          annual_price,
          billing_cycle,
          included_users,
          extra_user_price,
          max_organizations,
          renewal_month,
          renewal_day,
          active,
          promo_label,
          promo_price,
          promo_cycles,
          promo_starts_at,
          promo_ends_at
        `)
        .eq(
          'id',
          planId,
        )
        .eq(
          'active',
          true,
        )
        .maybeSingle()

    if (planError) {
      console.error(
        'Erro ao buscar plano:',
        planError.message,
      )

      return jsonResponse(
        {
          error:
            'Não foi possível carregar o plano.',
        },
        500,
      )
    }

    if (!plan) {
      return jsonResponse(
        {
          error:
            'Plano indisponível.',
        },
        404,
      )
    }

    // O ciclo financeiro vem EXCLUSIVAMENTE do plano salvo no banco.
    // Qualquer billingCycle eventualmente enviado pelo frontend é ignorado.
    const billingCycleRaw =
      typeof plan.billing_cycle === 'string'
        ? plan.billing_cycle.trim().toLowerCase()
        : ''

    if (
      billingCycleRaw !== 'monthly' &&
      billingCycleRaw !== 'yearly'
    ) {
      return jsonResponse(
        {
          error:
            'O plano possui um ciclo de cobrança inválido.',
        },
        400,
      )
    }

    const billingCycle =
      billingCycleRaw as 'monthly' | 'yearly'

    // Em cada registro de plano, base_price representa o preço
    // comercial mensal exibido:
    // - NOX4 Mensal: R$ 109,90
    // - NOX4 Anual:  R$ 89,90/mês equivalente
    const basePrice =
      Number(
        plan.base_price,
      )

    const annualPrice =
      plan.annual_price == null
        ? null
        : Number(
            plan.annual_price,
          )

    const renewalMonth =
      Number(
        plan.renewal_month ||
          1,
      )

    const renewalDay =
      Number(
        plan.renewal_day ||
          10,
      )

    const fullCycleAmount =
      billingCycle === 'monthly'
        ? basePrice
        : Number(annualPrice)

    if (
      !Number.isFinite(basePrice) ||
      basePrice <= 0 ||
      !Number.isFinite(
        fullCycleAmount,
      ) ||
      fullCycleAmount <= 0
    ) {
      return jsonResponse(
        {
          error:
            billingCycle === 'yearly'
              ? 'O plano anual não possui valor anual válido.'
              : 'O plano mensal não possui preço válido.',
        },
        400,
      )
    }

    // =====================================================
    // DATA PADRÃO + PRÓ-RATA
    // =====================================================

    // Black Friday / promoção: o valor promocional vale para a cobrança
    // proporcional inicial e para os primeiros `cycles` ciclos completos.
    // Depois, o asaas-webhook volta a assinatura ao preço cheio.
    const promo =
      getActivePromo(
        plan,
        billingCycle,
        fullCycleAmount,
      )

    const chargedCycleAmount =
      promo ? promo.price : fullCycleAmount

    const today =
      getBrazilDate()

    const renewalDate =
      nextRenewalDate(
        today,
        billingCycle,
        renewalMonth,
        renewalDay,
      )

    const proration =
      calculateProration(
        today,
        renewalDate,
        billingCycle,
        chargedCycleAmount,
        renewalMonth,
        renewalDay,
      )

    // =====================================================
    // ASAAS
    // =====================================================

    const asaasApiKey =
      Deno.env.get(
        'ASAAS_API_KEY',
      )

    const asaasBaseUrlRaw =
      Deno.env.get(
        'ASAAS_BASE_URL',
      )

    if (
      !asaasApiKey ||
      !asaasBaseUrlRaw
    ) {
      return jsonResponse(
        {
          error:
            'Integração de pagamento não configurada.',
        },
        500,
      )
    }

    const asaasBaseUrl =
      asaasBaseUrlRaw.replace(
        /\/+$/,
        '',
      )

    const asaasHeaders = {
      'Content-Type':
        'application/json',
      access_token:
        asaasApiKey,
    }

    // =====================================================
    // CHECKOUT SESSION
    // =====================================================

    const openStatuses = [
      'pending',
      'customer_created',
      'subscription_created',
      'awaiting_payment',
    ]

    const {
      data: existingSessions,
      error: existingError,
    } =
      await admin
        .from(
          'checkout_sessions',
        )
        .select('*')
        .eq(
          'user_id',
          user.id,
        )
        .eq(
          'plan_id',
          plan.id,
        )
        .eq(
          'cpf_cnpj',
          cpfCnpj,
        )
        .eq(
          'billing_cycle',
          billingCycle,
        )
        .in(
          'status',
          openStatuses,
        )
        .order(
          'created_at',
          {
            ascending: false,
          },
        )
        .limit(1)

    if (existingError) {
      console.error(
        'Erro ao procurar checkout:',
        existingError.message,
      )
    }

    let checkoutSession =
      existingSessions?.[0] ??
      null

    if (!checkoutSession) {
      const {
        data: createdSession,
        error: sessionError,
      } =
        await admin
          .from(
            'checkout_sessions',
          )
          .insert({
            user_id:
              user.id,

            plan_id:
              plan.id,

            company_name:
              companyName,

            cpf_cnpj:
              cpfCnpj,

            billing_email:
              billingEmail,

            phone:
              phone || null,

            amount:
              proration.amount,

            billing_cycle:
              billingCycle,

            status:
              'pending',

            contract_version:
              acceptedContractVersion,

            contract_accepted_at:
              new Date().toISOString(),

            contract_accepted_ip:
              acceptedIp,

            regular_price:
              fullCycleAmount,

            promo_label:
              promo?.label ?? null,

            promo_price:
              promo?.price ?? null,

            promo_cycles:
              promo?.cycles ?? null,

            promo_cycles_remaining:
              promo?.cycles ?? 0,
          })
          .select()
          .single()

      if (
        sessionError ||
        !createdSession
      ) {
        console.error(
          'Erro ao criar checkout:',
          sessionError?.message,
        )

        return jsonResponse(
          {
            error:
              'Não foi possível iniciar o checkout.',
          },
          500,
        )
      }

      checkoutSession =
        createdSession
    } else {
      // Sessão reaproveitada: registra o aceite desta tentativa e os dados atuais
      const { data: refreshed } =
        await admin
          .from('checkout_sessions')
          .update({
            company_name: companyName,
            billing_email: billingEmail,
            phone: phone || null,
            contract_version: acceptedContractVersion,
            contract_accepted_at: new Date().toISOString(),
            contract_accepted_ip: acceptedIp,
            updated_at: new Date().toISOString(),
            // Condição comercial só muda enquanto a assinatura ainda não foi criada no Asaas
            ...(checkoutSession.asaas_subscription_id
              ? {}
              : {
                  amount: proration.amount,
                  regular_price: fullCycleAmount,
                  promo_label: promo?.label ?? null,
                  promo_price: promo?.price ?? null,
                  promo_cycles: promo?.cycles ?? null,
                  promo_cycles_remaining: promo?.cycles ?? 0,
                }),
          })
          .eq('id', checkoutSession.id)
          .select()
          .single()

      if (refreshed) {
        checkoutSession = refreshed
      }
    }

    // =====================================================
    // CLIENTE ASAAS
    // =====================================================

    let asaasCustomerId =
      checkoutSession
        .asaas_customer_id as
        | string
        | null

    if (!asaasCustomerId) {
      const externalReference =
        user.id

      const query =
        `${asaasBaseUrl}/customers` +
        `?cpfCnpj=${encodeURIComponent(
          cpfCnpj,
        )}` +
        `&externalReference=${encodeURIComponent(
          externalReference,
        )}` +
        `&limit=1`

      const searchResponse =
        await fetch(
          query,
          {
            method: 'GET',
            headers:
              asaasHeaders,
          },
        )

      const searchData =
        await searchResponse.json()

      if (
        !searchResponse.ok
      ) {
        return jsonResponse(
          {
            error:
              'Não foi possível consultar o cadastro de cobrança.',
          },
          502,
        )
      }

      if (
        Array.isArray(
          searchData?.data,
        ) &&
        searchData.data.length > 0
      ) {
        asaasCustomerId =
          searchData.data[0].id
      } else {
        const payload:
          Record<
            string,
            unknown
          > = {
          name:
            companyName,

          cpfCnpj,

          email:
            billingEmail,

          externalReference,
        }

        if (phone) {
          payload.mobilePhone =
            phone
        }

        const createCustomerResponse =
          await fetch(
            `${asaasBaseUrl}/customers`,
            {
              method:
                'POST',

              headers:
                asaasHeaders,

              body:
                JSON.stringify(
                  payload,
                ),
            },
          )

        const customerData =
          await createCustomerResponse.json()

        if (
          !createCustomerResponse.ok
        ) {
          return jsonResponse(
            {
              error:
                getAsaasError(
                  customerData,
                  'Não foi possível criar o cliente no Asaas.',
                ),
            },
            400,
          )
        }

        asaasCustomerId =
          customerData.id
      }

      if (
        !asaasCustomerId
      ) {
        return jsonResponse(
          {
            error:
              'O Asaas não retornou o cliente.',
          },
          502,
        )
      }

      await admin
        .from(
          'checkout_sessions',
        )
        .update({
          asaas_customer_id:
            asaasCustomerId,

          status:
            'customer_created',

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          'id',
          checkoutSession.id,
        )
    }

    // =====================================================
    // ASSINATURA RECORRENTE
    // =====================================================

    let asaasSubscriptionId =
      checkoutSession
        .asaas_subscription_id as
        | string
        | null

    if (!asaasSubscriptionId) {
      const asaasCycle =
        billingCycle ===
        'monthly'
          ? 'MONTHLY'
          : 'YEARLY'

      const subscriptionPayload = {
        customer:
          asaasCustomerId,

        billingType:
          'PIX',

        // Com promoção, a assinatura nasce no valor promocional;
        // o asaas-webhook volta ao preço cheio ao fim dos ciclos promocionais.
        value:
          checkoutSession.promo_price != null
            ? Number(checkoutSession.promo_price)
            : fullCycleAmount,

        nextDueDate:
          renewalDate,

        cycle:
          asaasCycle,

        description:
          billingCycle ===
          'monthly'
            ? `Assinatura mensal NOX4 CFO - ${plan.name}`
            : `Assinatura anual NOX4 CFO - ${plan.name}`,

        externalReference:
          checkoutSession.id,
      }

      const subscriptionResponse =
        await fetch(
          `${asaasBaseUrl}/subscriptions`,
          {
            method:
              'POST',

            headers:
              asaasHeaders,

            body:
              JSON.stringify(
                subscriptionPayload,
              ),
          },
        )

      const subscriptionData =
        await subscriptionResponse.json()

      if (
        !subscriptionResponse.ok
      ) {
        return jsonResponse(
          {
            error:
              getAsaasError(
                subscriptionData,
                'Não foi possível criar a assinatura.',
              ),
          },
          400,
        )
      }

      asaasSubscriptionId =
        subscriptionData.id

      if (
        !asaasSubscriptionId
      ) {
        return jsonResponse(
          {
            error:
              'O Asaas não retornou a assinatura.',
          },
          502,
        )
      }

      await admin
        .from(
          'checkout_sessions',
        )
        .update({
          asaas_subscription_id:
            asaasSubscriptionId,

          status:
            'subscription_created',

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          'id',
          checkoutSession.id,
        )
    }

    // =====================================================
    // PRIMEIRA COBRANÇA PROPORCIONAL
    // =====================================================

    let asaasPaymentId =
      checkoutSession
        .asaas_payment_id as
        | string
        | null

    let payment: any =
      null

    if (!asaasPaymentId) {
      const paymentPayload = {
        customer:
          asaasCustomerId,

        billingType:
          'PIX',

        value:
          proration.amount,

        dueDate:
          today,

        description:
          billingCycle ===
          'monthly'
            ? `NOX4 CFO - período proporcional até ${renewalDate}`
            : `NOX4 CFO anual - período proporcional até ${renewalDate}`,

        externalReference:
          checkoutSession.id,
      }

      const paymentResponse =
        await fetch(
          `${asaasBaseUrl}/payments`,
          {
            method:
              'POST',

            headers:
              asaasHeaders,

            body:
              JSON.stringify(
                paymentPayload,
              ),
          },
        )

      const paymentData =
        await paymentResponse.json()

      if (
        !paymentResponse.ok
      ) {
        return jsonResponse(
          {
            error:
              getAsaasError(
                paymentData,
                'Não foi possível criar a cobrança inicial.',
              ),
          },
          400,
        )
      }

      payment =
        paymentData

      asaasPaymentId =
        paymentData.id

      if (
        !asaasPaymentId
      ) {
        return jsonResponse(
          {
            error:
              'O Asaas não retornou a cobrança.',
          },
          502,
        )
      }

      await admin
        .from(
          'checkout_sessions',
        )
        .update({
          asaas_payment_id:
            asaasPaymentId,

          status:
            'awaiting_payment',

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          'id',
          checkoutSession.id,
        )
    }

    if (
      asaasPaymentId &&
      !payment
    ) {
      const paymentResponse =
        await fetch(
          `${asaasBaseUrl}/payments/${asaasPaymentId}`,
          {
            method:
              'GET',

            headers:
              asaasHeaders,
          },
        )

      if (
        paymentResponse.ok
      ) {
        payment =
          await paymentResponse.json()
      }
    }

    // =====================================================
    // PIX QR CODE
    // =====================================================

    let pix:
      Record<
        string,
        unknown
      > | null = null

    if (asaasPaymentId) {
      const pixResponse =
        await fetch(
          `${asaasBaseUrl}/payments/${asaasPaymentId}/pixQrCode`,
          {
            method:
              'GET',

            headers:
              asaasHeaders,
          },
        )

      if (
        pixResponse.ok
      ) {
        const pixData =
          await pixResponse.json()

        pix = {
          encodedImage:
            pixData.encodedImage ??
            null,

          payload:
            pixData.payload ??
            null,

          expirationDate:
            pixData.expirationDate ??
            null,
        }
      }
    }

    // =====================================================
    // RESPOSTA
    // =====================================================

    return jsonResponse({
      success: true,

      checkoutSessionId:
        checkoutSession.id,

      billingCycle,

      plan: {
        id:
          plan.id,

        name:
          plan.name,

        // Para o plano mensal: R$ 109,90.
        // Para o plano anual: R$ 89,90/mês equivalente.
        monthlyPrice:
          basePrice,

        annualPrice,

        annualMonthlyEquivalent:
          annualPrice == null
            ? null
            : roundMoney(
                annualPrice / 12,
              ),

        includedUsers:
          plan.included_users,

        extraUserPrice:
          Number(
            plan.extra_user_price,
          ),
      },

      firstPayment: {
        // Valor real da cobrança criada (numa sessão reaproveitada pode diferir do recálculo)
        amount:
          payment?.value != null
            ? Number(payment.value)
            : proration.amount,

        dueDate:
          today,

        periodEnd:
          renewalDate,
      },

      promo:
        checkoutSession.promo_price != null
          ? {
              label: checkoutSession.promo_label,
              price: Number(checkoutSession.promo_price),
              cycles: checkoutSession.promo_cycles,
              regularPrice: fullCycleAmount,
            }
          : null,

      recurring: {
        amount:
          checkoutSession.promo_price != null
            ? Number(checkoutSession.promo_price)
            : fullCycleAmount,

        regularAmount:
          fullCycleAmount,

        nextDueDate:
          renewalDate,

        cycle:
          billingCycle ===
          'monthly'
            ? 'MONTHLY'
            : 'YEARLY',
      },

      customerId:
        asaasCustomerId,

      subscriptionId:
        asaasSubscriptionId,

      paymentId:
        asaasPaymentId,

      paymentStatus:
        payment?.status ??
        'PENDING',

      invoiceUrl:
        payment?.invoiceUrl ??
        null,

      status:
        'awaiting_payment',

      pix,

      message:
        'Cobrança criada. Aguardando pagamento.',
    })
  } catch (error) {
    console.error(
      'Erro inesperado em asaas-start-checkout:',
      error instanceof Error
        ? error.message
        : error,
    )

    return jsonResponse(
      {
        success: false,
        error:
          'Erro interno ao iniciar pagamento.',
      },
      500,
    )
  }
})