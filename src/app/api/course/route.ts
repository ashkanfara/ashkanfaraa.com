/**
 * POST /api/course
 *
 * Persian course purchase handler.
 * Saves every submission to Notion: "Course Purchases (FA)".
 *
 * Accepts multipart/form-data (because the payment step optionally
 * uploads a screenshot). Screenshot files cannot be stored on Vercel's
 * read-only filesystem — the proof type and tracking number are saved
 * to Notion; screenshots are verified manually via Instagram DM.
 *
 * Required env vars:
 *   NOTION_TOKEN
 *   NOTION_FA_COURSE_DB_ID
 *
 * Fields saved:
 *   Full Name, Email, Instagram, Phone, Telegram, Location,
 *   AF Code, Proof Type, Proof Value, Source=FA, Status=pending
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

function generateAfCode(attempt = 0): string {
  // Simple AF-XXXX code; no uniqueness check needed for Notion
  const code = `AF-${Math.floor(1000 + Math.random() * 9000)}`
  return code
}

export async function POST(req: NextRequest) {
  console.log('[FA course] Route hit — parsing form data')

  // ── Parse multipart form data ───────────────────────────────
  let fd: FormData
  try {
    fd = await req.formData()
  } catch (err) {
    console.error('[FA course] Failed to parse form data:', err)
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const get = (key: string) => (fd.get(key) as string | null)?.trim() ?? ''

  const name      = get('name')
  const instagram = get('instagram')
  const email     = get('email')
  const phone     = get('phone')
  const telegram  = get('telegram')
  const location  = get('location')
  const proofType = get('proofType') as 'screenshot' | 'tracking' | ''
  const tracking  = get('tracking')

  console.log('[FA course] Request body received:', {
    name:      name      || '(empty)',
    email:     email     || '(empty)',
    instagram: instagram || '(empty)',
    phone:     phone     || '(empty)',
    telegram:  telegram  || '(empty)',
    proofType: proofType || '(empty)',
  })

  // ── Validate ────────────────────────────────────────────────
  if (!name || !instagram || !email || !phone || !telegram) {
    console.warn('[FA course] Missing required fields')
    return NextResponse.json({ error: 'Missing required fields' }, { status: 422 })
  }
  if (proofType !== 'screenshot' && proofType !== 'tracking') {
    console.warn('[FA course] Invalid proof type:', proofType)
    return NextResponse.json({ error: 'Invalid proof type' }, { status: 422 })
  }
  if (proofType === 'tracking' && !tracking) {
    console.warn('[FA course] Tracking number missing')
    return NextResponse.json({ error: 'Tracking number required' }, { status: 422 })
  }

  // Proof value — for screenshots we note it was uploaded (file cannot be
  // stored on Vercel's read-only filesystem; customer sends screenshot via Instagram)
  const proofValue = proofType === 'tracking'
    ? tracking
    : 'رسید آپلود شد — تأیید از طریق اینستاگرام'

  const afCode = generateAfCode()

  console.log('[FA course] Generated AF code:', afCode, '| Proof type:', proofType)

  // ── Check env vars ──────────────────────────────────────────
  const token = process.env.NOTION_TOKEN
  const dbId  = process.env.NOTION_FA_COURSE_DB_ID

  console.log('[FA course] Env check — NOTION_TOKEN present:', !!token, '| NOTION_FA_COURSE_DB_ID present:', !!dbId)

  if (!token || !dbId) {
    console.error('[FA course] MISSING ENV VAR:', !token ? 'NOTION_TOKEN' : 'NOTION_FA_COURSE_DB_ID')
    // Return the AF code so UX works; submission is lost
    console.error('[FA course] Submission not saved — missing env vars. Data:', JSON.stringify({ name, email, instagram, phone, telegram, location, afCode, proofType, proofValue }))
    return NextResponse.json({ ok: true, afCode }, { status: 200 })
  }

  // ── Save to Notion ──────────────────────────────────────────
  try {
    const res = await fetch(`${NOTION_API}/pages`, {
      method:  'POST',
      headers: notionHeaders(),
      body: JSON.stringify({
        parent: { database_id: dbId },
        properties: {
          'Full Name':   { title:      rt(name) },
          'Email':       { email:      email    },
          'Instagram':   { rich_text:  rt(instagram) },
          'Phone':       { rich_text:  rt(phone) },
          'Telegram':    { rich_text:  rt(telegram) },
          'Location':    { rich_text:  rt(location) },
          'AF Code':     { rich_text:  rt(afCode) },
          'Proof Type':  { select:     { name: proofType } },
          'Proof Value': { rich_text:  rt(proofValue) },
          'Source':      { select:     { name: 'FA' } },
          'Status':      { select:     { name: 'pending' } },
        },
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error('[FA course] Notion API error:', res.status, errText)
      // Still return the AF code — don't break the customer experience
      return NextResponse.json({ ok: true, afCode }, { status: 200 })
    }

    const page = await res.json()
    console.log('[FA course] ✓ Saved to Notion. Page ID:', page.id, '| AF Code:', afCode, '| Name:', name, '| Email:', email)

  } catch (err) {
    console.error('[FA course] Unexpected error saving to Notion:', err)
    // Still return the AF code
  }

  return NextResponse.json({ ok: true, afCode }, { status: 200 })
}
