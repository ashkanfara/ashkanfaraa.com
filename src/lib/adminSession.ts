/**
 * Server-side admin session utilities.
 *
 * Session token: HMAC-SHA256 signed, base64url-encoded, stored in an HttpOnly cookie.
 * The ADMIN_SECRET password is verified ONCE at login and never touches the browser again.
 * A separate SESSION_SECRET signs tokens so rotating the password invalidates all sessions.
 *
 * Required env vars (server-side only — never NEXT_PUBLIC_*):
 *   ADMIN_SECRET    — the admin login password
 *   SESSION_SECRET  — random secret for signing session tokens (≥32 chars)
 */

import { createHmac, timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

export const ADMIN_COOKIE   = 'admin_session'
const SESSION_MAX_AGE_S     = 60 * 60 * 24   // 24 hours

function signingSecret(): string {
  const s = process.env.SESSION_SECRET
  if (!s || s.length < 32) throw new Error('SESSION_SECRET must be ≥32 chars and set as a server env var')
  return s
}

function hmac(payload: string): string {
  return createHmac('sha256', signingSecret()).update(payload, 'utf8').digest('hex')
}

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'))
  } catch { return false }
}

/** Verify the plain-text password against ADMIN_SECRET (timing-safe). */
export function verifyAdminPassword(password: string): boolean {
  const secret = process.env.ADMIN_SECRET
  if (!secret || !password) return false
  // Pad to same length so timingSafeEqual doesn't short-circuit on length diff
  const buf1 = Buffer.alloc(128, 0)
  const buf2 = Buffer.alloc(128, 0)
  buf1.write(secret,   0, 'utf8')
  buf2.write(password, 0, 'utf8')
  return timingSafeEqual(buf1, buf2) && secret === password
}

/** Create a signed session token valid for SESSION_MAX_AGE_S. */
export function createSessionToken(): string {
  const exp     = Date.now() + SESSION_MAX_AGE_S * 1000
  const payload = `v1:exp=${exp}`
  const sig     = hmac(payload)
  return Buffer.from(`${payload}.${sig}`).toString('base64url')
}

/** Return true iff the token is well-formed, untampered, and not expired. */
export function verifySessionToken(token: string): boolean {
  try {
    const decoded  = Buffer.from(token, 'base64url').toString('utf8')
    const lastDot  = decoded.lastIndexOf('.')
    if (lastDot === -1) return false
    const payload  = decoded.slice(0, lastDot)
    const sig      = decoded.slice(lastDot + 1)
    if (!safeCompare(hmac(payload), sig)) return false
    if (!payload.startsWith('v1:exp=')) return false
    const exp = parseInt(payload.slice('v1:exp='.length), 10)
    return Number.isFinite(exp) && Date.now() < exp
  } catch { return false }
}

/** Read session cookie from NextRequest and verify it. Fail-closed: any error → false. */
export function requireAdminSession(req: NextRequest): boolean {
  try {
    const token = req.cookies.get(ADMIN_COOKIE)?.value
    if (!token) return false
    return verifySessionToken(token)
  } catch { return false }
}

/** Build the Set-Cookie header value for the session cookie. */
export function buildSetCookieHeader(value: string): string {
  const isProd = process.env.NODE_ENV === 'production'
  return (
    `${ADMIN_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict` +
    (isProd ? '; Secure' : '') +
    `; Max-Age=${SESSION_MAX_AGE_S}`
  )
}

/** Build the Set-Cookie header value to clear the session cookie. */
export function buildClearCookieHeader(): string {
  const isProd = process.env.NODE_ENV === 'production'
  return (
    `${ADMIN_COOKIE}=; Path=/; HttpOnly; SameSite=Strict` +
    (isProd ? '; Secure' : '') +
    `; Max-Age=0`
  )
}

/** Convenience: return 401 JSON response. */
export function unauthorized(): NextResponse {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

/**
 * Verify the request Origin header matches the server host.
 * Required on all state-changing (POST/PATCH/DELETE) admin routes as defence-in-depth
 * alongside SameSite=Strict.
 *
 * Returns true only when Origin is present and its host matches the Host header.
 * Missing Origin on a mutation → reject (browsers always send Origin on cross-origin
 * requests; same-origin fetch from the admin UI will always include it).
 *
 * Skip this check for non-mutation routes (GET/HEAD) — Origin is not sent on those.
 */
export function validateSameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin')
  const host   = req.headers.get('host')
  if (!origin || !host) return false
  try {
    return new URL(origin).host === host
  } catch { return false }
}
