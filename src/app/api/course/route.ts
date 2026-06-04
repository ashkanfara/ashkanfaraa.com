import { NextRequest, NextResponse } from 'next/server'
import { writeFile, readFile, mkdir } from 'fs/promises'
import { existsSync }                 from 'fs'
import path                           from 'path'

// ─────────────────────────────────────────────────────────────
// Storage — JSON file + screenshot files on disk.
// Swap readSubmissions / writeSubmissions / saveScreenshot for
// Notion / Airtable / Supabase when moving to production.
// AF code is the primary lookup key for Instagram AI flow.
// ─────────────────────────────────────────────────────────────

const DATA_DIR       = path.join(process.cwd(), 'data')
const SUBMISSIONS    = path.join(DATA_DIR, 'course-submissions.json')
const SCREENSHOT_DIR = path.join(DATA_DIR, 'screenshots')

export interface Submission {
  id:          string                      // AF-XXXX
  name:        string
  instagram:   string
  telegram:    string
  email:       string
  location:    string
  destination: string
  reason:      string
  proofType:   'screenshot' | 'tracking'
  proofValue:  string                      // filename or tracking number
  timestamp:   string
  status:      'pending' | 'approved' | 'rejected'
}

async function readSubmissions(): Promise<Submission[]> {
  try {
    return JSON.parse(await readFile(SUBMISSIONS, 'utf-8'))
  } catch {
    return []
  }
}

async function writeSubmissions(rows: Submission[]): Promise<void> {
  if (!existsSync(DATA_DIR)) await mkdir(DATA_DIR, { recursive: true })
  await writeFile(SUBMISSIONS, JSON.stringify(rows, null, 2), 'utf-8')
}

async function saveScreenshot(afCode: string, file: File): Promise<string> {
  const ext      = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const filename = `${afCode}.${ext}`
  if (!existsSync(SCREENSHOT_DIR)) await mkdir(SCREENSHOT_DIR, { recursive: true })
  await writeFile(path.join(SCREENSHOT_DIR, filename), Buffer.from(await file.arrayBuffer()))
  return filename
}

function generateAfCode(existing: Submission[]): string {
  const used = new Set(existing.map(s => s.id))
  let code: string
  do {
    code = `AF-${Math.floor(1000 + Math.random() * 9000)}`
  } while (used.has(code))
  return code
}

// ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  let fd: FormData
  try {
    fd = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const get = (key: string) => (fd.get(key) as string | null)?.trim() ?? ''

  const name        = get('name')
  const instagram   = get('instagram')
  const telegram    = get('telegram')
  const email       = get('email')
  const location    = get('location')
  const destination = get('destination')
  const reason      = get('reason')
  const proofType   = get('proofType') as 'screenshot' | 'tracking' | ''

  if (!name || !email || !location || !destination || !reason) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 422 })
  }
  if (proofType !== 'screenshot' && proofType !== 'tracking') {
    return NextResponse.json({ error: 'Invalid proof type' }, { status: 422 })
  }

  const submissions = await readSubmissions()
  const afCode      = generateAfCode(submissions)

  let proofValue = ''

  if (proofType === 'screenshot') {
    const file = fd.get('screenshot') as File | null
    if (!file || file.size === 0) {
      return NextResponse.json({ error: 'Screenshot required' }, { status: 422 })
    }
    proofValue = await saveScreenshot(afCode, file)
  } else {
    proofValue = get('tracking')
    if (!proofValue) {
      return NextResponse.json({ error: 'Tracking number required' }, { status: 422 })
    }
  }

  const submission: Submission = {
    id: afCode, name, instagram, telegram, email,
    location, destination, reason,
    proofType, proofValue,
    timestamp: new Date().toISOString(),
    status:    'pending',
  }

  submissions.push(submission)
  await writeSubmissions(submissions)

  console.log(`[course] ${afCode} — ${name} (${email})`)

  return NextResponse.json({ ok: true, afCode }, { status: 201 })
}
