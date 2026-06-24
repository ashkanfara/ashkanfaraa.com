/**
 * POST /api/admin/consultation/approve
 *
 * Approves a consultation application:
 *   - Generates a UUID payment token
 *   - Sets token expiry, approved price, currency, payment method
 *   - Updates Notion: Status=Approved, PaymentStatus=Pending
 *   - Returns the private payment link and a ready-to-copy Persian DM
 *
 * Protected by Authorization: Bearer ADMIN_SECRET
 *
 * Body: { pageId, name, price, currency, method, expiryDays }
 *   method: 'paypal' | 'manual_ir' | 'manual_au'
 *   currency: 'AUD' | 'USD' | 'EUR'
 */

import { NextRequest, NextResponse } from 'next/server'
import { randomUUID }                from 'crypto'
import { approveApplication }        from '@/lib/notion-fa-consultation'

function authorized(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET
  if (!secret) return false
  return req.headers.get('authorization') === `Bearer ${secret}`
}

function regionFromMethod(method: string): string {
  if (method === 'manual_ir') return 'IR'
  if (method === 'manual_au') return 'AU'
  return 'INT'
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { pageId, name, price, currency, method, expiryDays } = body as {
    pageId:     string
    name:       string
    price:      number
    currency:   string
    method:     string
    expiryDays: number
  }

  if (!pageId || !name || !price || !currency || !method || !expiryDays) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 422 })
  }

  if (!['paypal', 'manual_ir', 'manual_au'].includes(method)) {
    return NextResponse.json({ error: 'Invalid payment method' }, { status: 422 })
  }

  if (!['AUD', 'USD', 'EUR', 'IRR'].includes(currency)) {
    return NextResponse.json({ error: 'Invalid currency' }, { status: 422 })
  }

  const token      = randomUUID()
  const expiry     = new Date(Date.now() + Number(expiryDays) * 86_400_000).toISOString()
  const baseUrl    = (process.env.NEXT_PUBLIC_BASE_URL ?? 'https://ashkanfaraa.com').replace(/\/$/, '')
  const paymentLink = `${baseUrl}/consultation/pay?token=${token}`

  const firstName = (name as string).trim().split(/\s+/)[0]

  const dmMessage = `سلام ${firstName} جان،
درخواستت بررسی شد و به نظر می‌رسه جلسه مشاوره با اشکان جان می‌تونه برای شرایطت ارزشمند باشه.

برای ادامه، پرداخت رو از طریق لینک زیر انجام بده:
${paymentLink}

بعد از پرداخت، کدی که سایت بهت میده رو همینجا بفرست تا مرحله هماهنگی جلسه انجام بشه.`

  try {
    await approveApplication(pageId, {
      paymentToken:     token,
      tokenExpiry:      expiry,
      approvedPrice:    Number(price),
      approvedCurrency: currency,
      paymentMethod:    method,
      region:           regionFromMethod(method),
    })
  } catch (err) {
    console.error('[admin/approve] Notion write failed:', err)
    return NextResponse.json({ error: 'Failed to update Notion record' }, { status: 500 })
  }

  return NextResponse.json({ paymentLink, dmMessage })
}
