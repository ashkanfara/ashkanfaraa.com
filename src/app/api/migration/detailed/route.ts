/**
 * POST /api/migration/detailed
 *
 * Stage-2 detailed migration assessment.
 * Stores in Notion: "Detailed Migration Assessments" database.
 * Linked to Stage-1 lead via Lead ID (AF-XXXXX).
 *
 * Env vars required:
 *   NOTION_TOKEN
 *   NOTION_MIGRATION_DETAILED_DB_ID
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

function multiSelect(csv: string) {
  if (!csv) return []
  return csv.split(',').map(s => s.trim()).filter(Boolean).map(name => ({ name }))
}

// ── Lead scoring ────────────────────────────────────────────────
interface ScoreResult {
  score:         number
  grade:         'A' | 'B' | 'C'
  criminalFlag:  boolean
}

function scoreAssessment(b: Record<string, string>): ScoreResult {
  let score = 0

  // Age (derived from DOB) — max 15
  if (b.dob) {
    try {
      const dob = new Date(b.dob)
      const age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
      if (age >= 25 && age <= 32)      score += 15
      else if (age >= 18 && age <= 24) score += 10
      else if (age >= 33 && age <= 39) score += 10
      else if (age >= 40 && age <= 44) score += 5
      // 45+: 0
    } catch { /* invalid date — skip */ }
  }

  // Education — max 15
  const edu: Record<string, number> = { 'PhD': 15, 'Master': 15, 'Bachelor': 10, 'Diploma': 5, 'High School': 0 }
  score += edu[b.education] ?? 0

  // English test — max 25
  if (b.englishTest && b.englishTest !== 'None') {
    const overall = parseFloat(b.englishOverall || '0')
    if (overall >= 8)       score += 25
    else if (overall >= 7)  score += 20
    else if (overall >= 6)  score += 10
    else                    score += 5   // test done but score not provided / low
  }

  // Work experience — max 15
  const exp: Record<string, number> = {
    '8+ years':    15,
    '5-8 years':   13,
    '3-5 years':   10,
    '1-3 years':    5,
    'Under 1 year': 0,
  }
  score += exp[b.experience] ?? 0

  // Skills assessment — max 20
  if (b.skillsAssessment === 'Completed')   score += 20
  else if (b.skillsAssessment === 'In Progress') score += 10

  // Savings — max 15
  const sav: Record<string, number> = {
    '50k+ AUD':      15,
    '30k-50k AUD':   12,
    '15k-30k AUD':    8,
    '5k-15k AUD':     5,
    'Under 5k AUD':   0,
  }
  score += sav[b.savings] ?? 0

  // Timeline urgency — max 5
  if (b.timeline === 'ASAP')           score += 5
  else if (b.timeline === '6-12 months') score += 3
  else if (b.timeline === '1-2 years')  score += 1

  // Negative adjustments
  if (b.visaRefusal     === 'Yes') score -= 15
  if (b.visaCancellation === 'Yes') score -= 10
  if (b.medicalIssues   === 'Yes') score -= 5

  const criminalFlag = b.criminalRecord === 'Yes'
  if (criminalFlag) score -= 25

  // Clamp to 0–100
  score = Math.max(0, Math.min(100, Math.round(score)))

  const grade: 'A' | 'B' | 'C' = score >= 70 ? 'A' : score >= 45 ? 'B' : 'C'

  return { score, grade, criminalFlag }
}

// ── Handler ─────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  console.log('[migration/detailed] Route hit')

  let body: Record<string, string>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  // Honeypot
  if (body.website) {
    console.warn('[migration/detailed] Honeypot triggered')
    return NextResponse.json({ ok: true, refId: body.leadId || 'AF-00000' })
  }

  // Required fields
  const required: Record<string, string> = {
    fullName:     'Full name is required',
    dob:          'Date of birth is required',
    nationality:  'Nationality is required',
    currentCountry: 'Current country is required',
    relationship: 'Relationship status is required',
    education:    'Education is required',
    experience:   'Work experience is required',
    englishTest:  'English test status is required',
    savings:      'Savings range is required',
    timeline:     'Timeline is required',
    consent:      'Consent is required',
  }

  for (const [field, message] of Object.entries(required)) {
    const val = body[field]
    if (!val || val.trim() === '' || val === 'false') {
      return NextResponse.json({ error: message }, { status: 422 })
    }
  }

  const token = process.env.NOTION_TOKEN
  const dbId  = process.env.NOTION_MIGRATION_DETAILED_DB_ID

  if (!token || !dbId) {
    console.error('[migration/detailed] Missing env vars')
    return NextResponse.json({ error: 'Service temporarily unavailable' }, { status: 503 })
  }

  const { score, grade, criminalFlag } = scoreAssessment(body)
  const refId = body.leadId || 'AF-UNKNOWN'

  console.log(`[migration/detailed] leadId=${refId} | score=${score} | grade=${grade} | criminal=${criminalFlag}`)

  try {
    const res = await fetch(`${NOTION_API}/pages`, {
      method:  'POST',
      headers: notionHeaders(),
      body: JSON.stringify({
        parent: { database_id: dbId },
        properties: {
          // ── Identity
          'Lead ID':               { title: rt(refId) },
          'Full Name':             { rich_text: rt(body.fullName) },
          'Date of Birth':         { rich_text: rt(body.dob) },
          'Nationality':           { rich_text: rt(body.nationality) },
          'Current Country':       { rich_text: rt(body.currentCountry) },
          'Current Visa Status':   { rich_text: rt(body.currentVisa      || '') },
          'Prior Presence':        { rich_text: rt(body.priorPresence    || '') },
          'Passport Status':       { rich_text: rt(body.passportStatus   || '') },
          'Timeline':              body.timeline ? { select: { name: body.timeline } } : undefined,
          'Destination':           { rich_text: rt(body.destination      || '') },
          // ── Family
          'Relationship Status':   body.relationship      ? { select: { name: body.relationship } }      : undefined,
          'Children':              body.children          ? { select: { name: body.children } }          : undefined,
          'Partner Age':           { rich_text: rt(body.partnerAge       || '') },
          'Partner Occupation':    { rich_text: rt(body.partnerOccupation || '') },
          'Partner Education':     body.partnerEducation  ? { select: { name: body.partnerEducation } }  : undefined,
          'Partner English':       body.partnerEnglish    ? { select: { name: body.partnerEnglish } }    : undefined,
          // ── Education
          'Education':             body.education         ? { select: { name: body.education } }         : undefined,
          'Field of Study':        { rich_text: rt(body.fieldOfStudy     || '') },
          'Institution':           { rich_text: rt(body.institution      || '') },
          'Country of Study':      { rich_text: rt(body.countryOfStudy   || '') },
          'Graduation Year':       { rich_text: rt(body.graduationYear   || '') },
          // ── Work
          'Occupation Category':   body.occupationCategory ? { select: { name: body.occupationCategory } } : undefined,
          'Employment Type':       body.employmentType    ? { select: { name: body.employmentType } }    : undefined,
          'Job Title':             { rich_text: rt(body.jobTitle         || '') },
          'Occupation':            { rich_text: rt(body.occupation       || '') },
          'Years Experience':      body.experience        ? { select: { name: body.experience } }        : undefined,
          'Evidence Available':    body.evidence
            ? { multi_select: multiSelect(body.evidence) }
            : undefined,
          // ── English
          'English Test':          body.englishTest       ? { select: { name: body.englishTest } }       : undefined,
          'English Overall':       body.englishOverall    ? { number: parseFloat(body.englishOverall) }  : undefined,
          'English Listening':     body.englishListening  ? { number: parseFloat(body.englishListening) } : undefined,
          'English Reading':       body.englishReading    ? { number: parseFloat(body.englishReading) }  : undefined,
          'English Writing':       body.englishWriting    ? { number: parseFloat(body.englishWriting) }  : undefined,
          'English Speaking':      body.englishSpeaking   ? { number: parseFloat(body.englishSpeaking) } : undefined,
          // ── Skills assessment
          'Skills Assessment':     body.skillsAssessment  ? { select: { name: body.skillsAssessment } }  : undefined,
          'Assessing Body':        { rich_text: rt(body.assessingBody    || '') },
          // ── Australia
          'AU Occupation (ANZSCO)':      { rich_text: rt(body.anzscoOccupation      || '') },
          'AU Employer Sponsorship':     body.auEmployerSponsorship ? { select: { name: body.auEmployerSponsorship } } : undefined,
          'AU Regional':                 body.auRegional            ? { select: { name: body.auRegional } }            : undefined,
          // ── Germany
          'German Level':          body.germanLevel       ? { select: { name: body.germanLevel } }       : undefined,
          'German Pathway':        body.germanPathway     ? { select: { name: body.germanPathway } }     : undefined,
          // ── Financial
          'Savings':               body.savings           ? { select: { name: body.savings } }           : undefined,
          'Family Support':        body.familySupport     ? { select: { name: body.familySupport } }     : undefined,
          // ── Migration history
          'Visa Refusal':          body.visaRefusal       ? { select: { name: body.visaRefusal } }       : undefined,
          'Visa Cancellation':     body.visaCancellation  ? { select: { name: body.visaCancellation } }  : undefined,
          'Criminal Record':       body.criminalRecord    ? { select: { name: body.criminalRecord } }    : undefined,
          'Medical Issues':        body.medicalIssues     ? { select: { name: body.medicalIssues } }     : undefined,
          // ── Open assessment
          'Open Assessment':       { rich_text: rt(body.openAssessment   || '') },
          // ── Scoring
          'Lead Score':            { number: score },
          'Lead Grade':            { select: { name: `${grade} Lead` } },
          'Criminal Flag':         { checkbox: criminalFlag },
          // ── Meta
          'Language':              { select: { name: body.language       || 'FA' } },
          'Source':                { rich_text: rt(body.source           || '') },
          'UTM Source':            { rich_text: rt(body.utmSource        || '') },
          'UTM Medium':            { rich_text: rt(body.utmMedium        || '') },
          'UTM Campaign':          { rich_text: rt(body.utmCampaign      || '') },
          'Referrer':              { rich_text: rt(body.referrer         || '') },
          'Consent':               { checkbox: body.consent === 'true' },
          'Status':                { select: { name: 'New' } },
        },
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error('[migration/detailed] Notion error:', res.status, errText)
      return NextResponse.json({ error: 'Submission failed. Please try again.' }, { status: 500 })
    }

    const page = await res.json()
    console.log(`[migration/detailed] ✓ Saved. Notion page: ${page.id} | leadId: ${refId} | score: ${score} | grade: ${grade}`)

    return NextResponse.json({ ok: true, refId, score, grade })

  } catch (err) {
    console.error('[migration/detailed] Unexpected error:', err)
    return NextResponse.json({ error: 'Submission failed. Please try again.' }, { status: 500 })
  }
}
