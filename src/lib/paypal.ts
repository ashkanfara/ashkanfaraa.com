/**
 * PayPal REST API helpers — English site only.
 * All functions run server-side only. Never import from client components.
 *
 * Required env vars:
 *   PAYPAL_CLIENT_ID
 *   PAYPAL_CLIENT_SECRET
 *   PAYPAL_BASE_URL  (e.g. https://api-m.sandbox.paypal.com or https://api-m.paypal.com)
 */

const BASE = () => process.env.PAYPAL_BASE_URL ?? 'https://api-m.sandbox.paypal.com'

async function getAccessToken(): Promise<string> {
  const id     = process.env.PAYPAL_CLIENT_ID
  const secret = process.env.PAYPAL_CLIENT_SECRET
  if (!id || !secret) throw new Error('PayPal credentials are not configured.')

  const res = await fetch(`${BASE()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/x-www-form-urlencoded',
      Authorization:   `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,
    },
    body:  'grant_type=client_credentials',
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`PayPal auth failed: ${res.status}`)
  const data = await res.json()
  return data.access_token as string
}

export interface CreateOrderParams {
  amount:      string   // e.g. '99.00'
  currency:    string   // e.g. 'USD' or 'AUD'
  description: string
  customId:    string   // Notion page ID — used to update the record after payment
  returnUrl:   string
  cancelUrl:   string
}

/** Creates a PayPal order and returns the approval URL to redirect the user to. */
export async function createPayPalOrder(params: CreateOrderParams): Promise<string> {
  const token = await getAccessToken()

  const res = await fetch(`${BASE()}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      'Content-Type':     'application/json',
      Authorization:      `Bearer ${token}`,
      'PayPal-Request-Id': `af-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          amount:      { currency_code: params.currency, value: params.amount },
          description: params.description,
          custom_id:   params.customId,
        },
      ],
      application_context: {
        brand_name:          'Ashkan Faraa',
        landing_page:        'BILLING',
        user_action:         'PAY_NOW',
        return_url:          params.returnUrl,
        cancel_url:          params.cancelUrl,
        shipping_preference: 'NO_SHIPPING',
      },
    }),
  })

  if (!res.ok) throw new Error(`PayPal create order failed: ${await res.text()}`)

  const order = await res.json()
  const approveUrl = (order.links as { rel: string; href: string }[])?.find(
    l => l.rel === 'approve'
  )?.href

  if (!approveUrl) throw new Error('PayPal: no approve link in response')
  return approveUrl
}

export interface CaptureResult {
  orderId:  string
  customId: string  // Notion page ID stored in custom_id at order creation
  status:   string  // 'COMPLETED' on success
}

/**
 * Captures a PayPal order after the user approves it.
 * Idempotent: if the order is already captured, fetches and returns order details.
 */
export async function capturePayPalOrder(orderId: string): Promise<CaptureResult> {
  const token = await getAccessToken()

  const res = await fetch(`${BASE()}/v2/checkout/orders/${orderId}/capture`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization:  `Bearer ${token}`,
    },
  })

  const body = await res.json()

  if (!res.ok) {
    const issue = (body?.details as { issue?: string }[])?.[0]?.issue
    if (issue === 'ORDER_ALREADY_CAPTURED') {
      return fetchOrderDetails(orderId, token)
    }
    throw new Error(`PayPal capture failed: ${JSON.stringify(body)}`)
  }

  return {
    orderId:  body.id,
    customId: (body.purchase_units?.[0]?.custom_id as string) ?? '',
    status:   body.status,
  }
}

async function fetchOrderDetails(orderId: string, token: string): Promise<CaptureResult> {
  const res = await fetch(`${BASE()}/v2/checkout/orders/${orderId}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache:   'no-store',
  })
  const body = await res.json()
  return {
    orderId:  body.id,
    customId: (body.purchase_units?.[0]?.custom_id as string) ?? '',
    status:   body.status,
  }
}
