/**
 * GET /api/admin/diagnostics
 *
 * Returns presence (true/false) of critical server-side env vars.
 * Never returns actual secret values.
 * Protected by HttpOnly session cookie (admin_session).
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession, unauthorized } from '@/lib/adminSession'

export async function GET(req: NextRequest) {
  if (!requireAdminSession(req)) return unauthorized()

  return NextResponse.json({
    supabaseUrlPresent:          Boolean(process.env.SUPABASE_URL),
    supabaseServiceRolePresent:  Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    adminSecretPresent:          Boolean(process.env.ADMIN_SECRET),
    notionTokenPresent:          Boolean(process.env.NOTION_TOKEN),
    instagramTokenPresent:       Boolean(process.env.INSTAGRAM_ACCESS_TOKEN),
    nodeEnv:                     process.env.NODE_ENV ?? 'unknown',
  })
}
