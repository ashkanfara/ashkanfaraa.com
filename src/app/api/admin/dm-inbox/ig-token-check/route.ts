/**
 * GET /api/admin/dm-inbox/ig-token-check
 *
 * Safe, read-only Instagram token diagnostic.
 * Calls GET graph.instagram.com/v25.0/me — no message is sent, no data is written.
 * Returns token validity and exact Meta error if invalid.
 *
 * Used to diagnose P0 Instagram send failure without requiring a real send attempt.
 * Token value is NEVER returned or logged.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/adminSession'

export async function GET(req: NextRequest) {
  if (!requireAdminSession(req)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const token = process.env.INSTAGRAM_ACCESS_TOKEN
  if (!token) {
    return NextResponse.json({ ok: false, error: 'INSTAGRAM_ACCESS_TOKEN not configured' }, { status: 503 })
  }

  try {
    const res = await fetch(
      `https://graph.instagram.com/v25.0/me?fields=id,username&access_token=${encodeURIComponent(token)}`,
      { signal: AbortSignal.timeout(10_000) }
    )
    const body = await res.json() as Record<string, unknown>

    if (res.ok) {
      // Token is valid — return user info (NOT the token)
      const igUserId   = body.id       as string | undefined
      const igUsername = body.username as string | undefined
      console.log(`[ig-token-check] ✓ Token valid | ig_user=${igUserId} username=${igUsername}`)
      return NextResponse.json({
        ok:           true,
        token_valid:  true,
        ig_user_id:   igUserId,
        ig_username:  igUsername,
      })
    }

    // Token invalid — return the exact Meta error (helps diagnose P0)
    const err = body.error as { code?: number; type?: string; message?: string; fbtrace_id?: string } | undefined
    console.error('[ig-token-check] Token check failed:', res.status, JSON.stringify(err))
    return NextResponse.json({
      ok:          false,
      token_valid: false,
      http_status: res.status,
      meta_error:  {
        code:       err?.code,
        type:       err?.type,
        message:    err?.message,
        fbtrace_id: err?.fbtrace_id,
      },
    })

  } catch (err) {
    const isTimeout = err instanceof Error && err.name === 'TimeoutError'
    console.error('[ig-token-check] request error:', isTimeout ? 'timeout(10s)' : err)
    return NextResponse.json({
      ok:    false,
      error: isTimeout ? 'timeout' : 'network_error',
    }, { status: 502 })
  }
}
