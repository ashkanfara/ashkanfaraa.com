/**
 * GET /api/admin/migration-stats?key=<ADMIN_STATS_KEY>
 *
 * Aggregates lead data from both Notion databases and returns a JSON
 * business intelligence summary.
 *
 * Env vars required:
 *   NOTION_TOKEN
 *   NOTION_MIGRATION_DB_ID
 *   NOTION_MIGRATION_DETAILED_DB_ID
 *   ADMIN_STATS_KEY   (a secret you set — protect this endpoint)
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/adminSession'

const NOTION_API     = 'https://api.notion.com/v1'
const NOTION_VERSION = '2022-06-28'

function notionHeaders() {
  return {
    Authorization:    `Bearer ${process.env.NOTION_TOKEN}`,
    'Content-Type':   'application/json',
    'Notion-Version': NOTION_VERSION,
  }
}

// Fetch all pages from a Notion database (handles pagination)
async function fetchAllPages(dbId: string): Promise<Record<string, unknown>[]> {
  const pages: Record<string, unknown>[] = []
  let cursor: string | undefined

  do {
    const body: Record<string, unknown> = { page_size: 100 }
    if (cursor) body.start_cursor = cursor

    const res = await fetch(`${NOTION_API}/databases/${dbId}/query`, {
      method:  'POST',
      headers: notionHeaders(),
      body:    JSON.stringify(body),
    })

    if (!res.ok) {
      console.error('[migration-stats] Notion query failed:', res.status)
      break
    }

    const data = await res.json()
    pages.push(...(data.results || []))
    cursor = data.has_more ? data.next_cursor : undefined
  } while (cursor)

  return pages
}

// ── Property extractors ──────────────────────────────────────────
type NotionPage = Record<string, unknown>

function prop(page: NotionPage, key: string): Record<string, unknown> | undefined {
  const props = page.properties as Record<string, unknown> | undefined
  return props?.[key] as Record<string, unknown> | undefined
}

function selectValue(page: NotionPage, key: string): string {
  const p = prop(page, key) as { select?: { name?: string } } | undefined
  return p?.select?.name || ''
}

function numberValue(page: NotionPage, key: string): number | null {
  const p = prop(page, key) as { number?: number } | undefined
  return p?.number ?? null
}

function checkboxValue(page: NotionPage, key: string): boolean {
  const p = prop(page, key) as { checkbox?: boolean } | undefined
  return p?.checkbox ?? false
}

// ── Aggregation helpers ──────────────────────────────────────────
function tally(items: string[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const item of items) {
    if (!item) continue
    out[item] = (out[item] || 0) + 1
  }
  return out
}

function topN(tally: Record<string, number>, n = 5): { value: string; count: number }[] {
  return Object.entries(tally)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([value, count]) => ({ value, count }))
}

function avg(nums: number[]): number {
  if (!nums.length) return 0
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10
}

function pct(part: number, total: number): string {
  if (!total) return '0%'
  return `${Math.round((part / total) * 100)}%`
}

// ── Handler ──────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  if (!requireAdminSession(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const token    = process.env.NOTION_TOKEN
  const stage1Id = process.env.NOTION_MIGRATION_DB_ID
  const stage2Id = process.env.NOTION_MIGRATION_DETAILED_DB_ID

  if (!token || !stage1Id || !stage2Id) {
    return NextResponse.json({ error: 'Missing env vars' }, { status: 503 })
  }

  // Fetch both databases in parallel
  const [stage1Pages, stage2Pages] = await Promise.all([
    fetchAllPages(stage1Id),
    fetchAllPages(stage2Id),
  ])

  // ── Stage 1 analysis ────────────────────────────────────────
  const s1Count        = stage1Pages.length
  const destinations   = stage1Pages.map(p => selectValue(p, 'Destination'))
  const pathways       = stage1Pages.map(p => selectValue(p, 'Pathway'))
  const budgets        = stage1Pages.map(p => selectValue(p, 'Budget'))
  const languages      = stage1Pages.map(p => selectValue(p, 'Language'))
  const sources        = stage1Pages.map(p => {
    const s = prop(p, 'Source') as { rich_text?: { plain_text?: string }[] } | undefined
    return s?.rich_text?.[0]?.plain_text || ''
  })
  const utmSources     = stage1Pages.map(p => {
    const s = prop(p, 'UTM Source') as { rich_text?: { plain_text?: string }[] } | undefined
    return s?.rich_text?.[0]?.plain_text || ''
  })

  // ── Stage 2 analysis ────────────────────────────────────────
  const s2Count    = stage2Pages.length
  const scores     = stage2Pages.map(p => numberValue(p, 'Lead Score')).filter((n): n is number => n !== null)
  const grades     = stage2Pages.map(p => selectValue(p, 'Lead Grade'))
  const occCats    = stage2Pages.map(p => selectValue(p, 'Occupation Category'))
  const empTypes   = stage2Pages.map(p => selectValue(p, 'Employment Type'))
  const educations = stage2Pages.map(p => selectValue(p, 'Education'))
  const timelines  = stage2Pages.map(p => selectValue(p, 'Timeline'))
  const savings    = stage2Pages.map(p => selectValue(p, 'Savings'))
  const crimFlags  = stage2Pages.filter(p => checkboxValue(p, 'Criminal Flag')).length
  const refusals   = stage2Pages.filter(p => selectValue(p, 'Visa Refusal') === 'Yes').length

  const gradeA = grades.filter(g => g === 'A Lead').length
  const gradeB = grades.filter(g => g === 'B Lead').length
  const gradeC = grades.filter(g => g === 'C Lead').length

  // ── Business health signals ──────────────────────────────────
  const conversionRate   = pct(s2Count, s1Count)
  const avgScore         = avg(scores)
  const highValueLeads   = gradeA  // A-grade only
  const referrableLeads  = gradeA + gradeB  // A+B potentially referable
  const flaggedLeads     = crimFlags + refusals

  // Lead value assessment signal
  let businessSignal: string
  if (!s1Count)                          businessSignal = 'No data yet'
  else if (s2Count / s1Count < 0.05)     businessSignal = 'Low Stage-2 adoption — CTA may need prominence'
  else if (avgScore >= 65 && gradeA >= 3) businessSignal = 'Strong — referral business viable'
  else if (avgScore >= 50)                businessSignal = 'Moderate — mix of A/B leads, refine targeting'
  else                                    businessSignal = 'Low quality — audience may need qualification before funnel'

  const now = new Date().toISOString()

  return NextResponse.json({
    generated_at: now,

    funnel: {
      stage1_completions:    s1Count,
      stage2_completions:    s2Count,
      stage2_conversion_rate: conversionRate,
    },

    lead_quality: {
      average_score:    avgScore,
      grade_A:          gradeA,
      grade_B:          gradeB,
      grade_C:          gradeC,
      grade_A_pct:      pct(gradeA, s2Count),
      grade_B_pct:      pct(gradeB, s2Count),
      grade_C_pct:      pct(gradeC, s2Count),
      referable_leads:  referrableLeads,
      high_value_leads: highValueLeads,
      flagged_leads:    flaggedLeads,
    },

    stage1_breakdown: {
      top_destinations: topN(tally(destinations)),
      top_pathways:     topN(tally(pathways)),
      budget_distribution: topN(tally(budgets), 10),
      language_split:   tally(languages),
      top_sources:      topN(tally(sources.filter(Boolean))),
      top_utm_sources:  topN(tally(utmSources.filter(Boolean))),
    },

    stage2_breakdown: {
      occupation_categories: topN(tally(occCats), 10),
      employment_types:      topN(tally(empTypes), 10),
      education_levels:      topN(tally(educations), 10),
      timeline_distribution: topN(tally(timelines), 10),
      savings_distribution:  topN(tally(savings), 10),
    },

    business_signal: businessSignal,
  })
}
