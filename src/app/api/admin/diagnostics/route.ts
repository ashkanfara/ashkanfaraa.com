/**
 * GET /api/admin/diagnostics
 *
 * Returns presence (true/false) of critical server-side env vars.
 * Never returns actual secret values.
 * Protected by Authorization: Bearer ADMIN_SECRET.
 */

import { NextRequest, NextResponse } from 'next/server'

function authorized(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET
  if (!secret) return false
  return req.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json({
    supabaseUrlPresent:          Boolean(process.env.SUPABASE_URL),
    supabaseServiceRolePresent:  Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    adminSecretPresent:          Boolean(process.env.ADMIN_SECRET),
    notionTokenPresent:          Boolean(process.env.NOTION_TOKEN),
    nodeEnv:                     process.env.NODE_ENV ?? 'unknown',
  })
}
