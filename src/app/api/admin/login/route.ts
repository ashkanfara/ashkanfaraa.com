/**
 * POST /api/admin/login
 *
 * Accepts { password } in the request body.
 * Verifies against ADMIN_SECRET (timing-safe, server-side).
 * On success: sets an HttpOnly, SameSite=Strict signed session cookie.
 * On failure: 401 — does not reveal whether the secret exists.
 *
 * ADMIN_SECRET never leaves the server.
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  verifyAdminPassword,
  createSessionToken,
  buildSetCookieHeader,
  validateSameOrigin,
} from '@/lib/adminSession'

// Fixed delay on every failed attempt — slows brute force without leaking timing info.
// Full rate-limiting requires persistent state (e.g. Upstash Redis) which is out of scope here.
const FAILURE_DELAY_MS = 1000

export async function POST(req: NextRequest) {
  if (!validateSameOrigin(req)) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })
  }

  let body: { password?: unknown }
  try { body = await req.json() }
  catch { return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 }) }

  const password = typeof body.password === 'string' ? body.password : ''

  if (!verifyAdminPassword(password)) {
    await new Promise(r => setTimeout(r, FAILURE_DELAY_MS))
    return NextResponse.json({ ok: false, error: 'Invalid password' }, { status: 401 })
  }

  const token = createSessionToken()
  const res   = NextResponse.json({ ok: true })
  res.headers.set('Set-Cookie', buildSetCookieHeader(token))
  return res
}
