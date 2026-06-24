/**
 * POST /api/consultation/confirm
 *
 * Persian consultation — Phase 2 (manual payment proof).
 * Used for IR (Iran card) and AU (manual fallback) regions.
 *
 * Updates the existing Notion record created in Phase 1 with:
 *   - CONS Code (generated here)
 *   - Region, Price, Proof Type, Proof Value
 *   - Status → Payment Pending (stays pending until admin verifies)
 *
 * Body (JSON):
 *   notionPageId  string   Notion page ID from Phase 1 response
 *   region        'IR' | 'AU'
 *   proofType     'screenshot' | 'tracking'
 *   tracking      string   (only when proofType === 'tracking')
 *
 * Returns: { ok: true, consCode }
 *
 * Required env vars: NOTION_TOKEN
 */

import { NextRequest, NextResponse } from 'next/server'

const NOTION_API     = 'https://api.notion.com/v1'
const NOTION_VERSION = '2022-06-28'

function notionHeaders() {
  return {
    Authorization:    `Bearer ${process.env.NOTION_TOKEN}`,
    'Content-Type':   'application/json',
    'Notion-Version': NOTION_VERSION,
  }
}

function rt(text: string) {
  return [{ text: { content: (text || '').slice(0, 2000) } }]
}

function generateConsCode(region: 'IR' | 'AU' | 'INT'): string {
  const suffix = String(Math.floor(10000 + Math.random() * 90000))
  return `CONS-${region}-${suffix}`
}

const PRICE: Record<string, string> = {
  IR:  '17,000,000 تومان',
  AU:  'AUD 250',
  INT: 'USD 99',
}

export async function POST(req: NextRequest) {
  console.log('[FA consultation/confirm] Route hit')

  let body: Record<string, string>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { notionPageId, region, proofType, tracking } = body

  if (!region || !['IR', 'AU'].includes(region)) {
    return NextResponse.json({ error: 'Invalid region' }, { status: 422 })
  }
  if (!proofType || !['screenshot', 'tracking'].includes(proofType)) {
    return NextResponse.json({ error: 'Invalid proof type' }, { status: 422 })
  }
  if (proofType === 'tracking' && !tracking?.trim()) {
    return NextResponse.json({ error: 'Tracking number required' }, { status: 422 })
  }

  const token = process.env.NOTION_TOKEN
  if (!token) {
    console.error('[FA consultation/confirm] MISSING ENV VAR: NOTION_TOKEN')
    return NextResponse.json({ error: 'Service temporarily unavailable' }, { status: 503 })
  }

  const consCode   = generateConsCode(region as 'IR' | 'AU')
  const proofValue = proofType === 'tracking'
    ? tracking!.trim()
    : 'رسید آپلود شد — تأیید از طریق اینستاگرام'

  console.log('[FA consultation/confirm] Generated:', consCode, '| Region:', region, '| Proof:', proofType)

  // ── Update existing Notion record (or create if no pageId) ──
  if (notionPageId) {
    try {
      const res = await fetch(`${NOTION_API}/pages/${notionPageId}`, {
        method:  'PATCH',
        headers: notionHeaders(),
        body: JSON.stringify({
          properties: {
            'CONS Code':   { rich_text: rt(consCode) },
            'Region':      { select: { name: region } },
            'Price':       { rich_text: rt(PRICE[region] ?? '') },
            'Proof Type':  { select: { name: proofType } },
            'Proof Value': { rich_text: rt(proofValue) },
            'Status':      { select: { name: 'Payment Pending' } },
          },
        }),
      })
      if (!res.ok) {
        const err = await res.text()
        console.error('[FA consultation/confirm] Notion PATCH error:', res.status, err)
      } else {
        console.log('[FA consultation/confirm] ✓ Notion record updated. CONS Code:', consCode)
      }
    } catch (err) {
      console.error('[FA consultation/confirm] Notion update failed:', err)
    }
  } else {
    // Phase 1 save failed — the CONS code is still shown to the user,
    // but admin must reconcile manually from the lead.
    console.warn('[FA consultation/confirm] No notionPageId — CONS code issued without Notion update:', consCode)
  }

  return NextResponse.json({ ok: true, consCode })
}
