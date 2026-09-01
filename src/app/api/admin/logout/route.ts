/**
 * POST /api/admin/logout
 *
 * Clears the admin session cookie. No auth required — clearing a cookie is safe.
 */

import { NextResponse } from 'next/server'
import { buildClearCookieHeader } from '@/lib/adminSession'

export async function POST() {
  const res = NextResponse.json({ ok: true })
  res.headers.set('Set-Cookie', buildClearCookieHeader())
  return res
}
