'use client'

/**
 * /admin — Consultation review dashboard.
 * Password-protected via ADMIN_SECRET (sessionStorage).
 *
 * Sections:
 *   1. New Applications
 *   2. Under Review
 *   3. Approved / Payment Sent
 *   4. Awaiting Manual Confirmation
 *   5. Paid / Completed
 */

import { useState, useEffect, FormEvent } from 'react'

// ── Types ─────────────────────────────────────────────────────
interface App {
  pageId:           string
  name:             string
  email:            string
  instagram:        string
  phone:            string
  location:         string
  subject:          string
  message:          string
  submittedAt:      string
  status:           string
  paymentToken:     string
  tokenExpiry:      string | null
  approvedPrice:    number | null
  approvedCurrency: string
  paymentMethod:    string
  paymentStatus:    string
  paymentClaim:     string
  consCode:         string
  dmMode:           string | null
  senderId:         string | null
  isBlocked:        boolean | null
}

interface DashboardData {
  new:         App[]
  underReview: App[]
  approved:    App[]
  claimed:     App[]
  paid:        App[]
}

// ── Minimal styles ────────────────────────────────────────────
const S = {
  page: {
    fontFamily: 'system-ui, sans-serif',
    fontSize:   '13px',
    color:      '#e8e4de',
    background: '#0e0c0a',
    minHeight:  '100vh',
    padding:    '1.5rem',
  } as React.CSSProperties,

  card: {
    background:    '#1a1714',
    border:        '1px solid #2c2720',
    borderRadius:  '6px',
    marginBottom:  '8px',
  } as React.CSSProperties,

  cardHeader: {
    padding:    '10px 14px',
    display:    'flex',
    alignItems: 'flex-start',
    gap:        '10px',
    cursor:     'pointer',
  } as React.CSSProperties,

  cardBody: {
    padding:    '0 14px 14px',
    borderTop:  '1px solid #2c2720',
  } as React.CSSProperties,

  label: {
    color:        '#6b6359',
    fontSize:     '11px',
    marginBottom: '2px',
    marginTop:    '10px',
    display:      'block',
    textTransform:'uppercase' as const,
    letterSpacing:'0.06em',
  },

  value: {
    color:    '#e8e4de',
    fontSize: '13px',
  } as React.CSSProperties,

  input: {
    width:        '100%',
    background:   '#0e0c0a',
    border:       '1px solid #2c2720',
    borderRadius: '4px',
    padding:      '6px 8px',
    fontSize:     '12px',
    color:        '#e8e4de',
    outline:      'none',
    fontFamily:   'system-ui, sans-serif',
    boxSizing:    'border-box' as const,
  },

  select: {
    width:        '100%',
    background:   '#0e0c0a',
    border:       '1px solid #2c2720',
    borderRadius: '4px',
    padding:      '6px 8px',
    fontSize:     '12px',
    color:        '#e8e4de',
    outline:      'none',
    fontFamily:   'system-ui, sans-serif',
  } as React.CSSProperties,

  textarea: {
    width:        '100%',
    background:   '#0e0c0a',
    border:       '1px solid #2c2720',
    borderRadius: '4px',
    padding:      '6px 8px',
    fontSize:     '12px',
    color:        '#e8e4de',
    outline:      'none',
    fontFamily:   'monospace',
    resize:       'none' as const,
    boxSizing:    'border-box' as const,
  },

  sectionHead: {
    fontSize:      '11px',
    letterSpacing: '0.1em',
    color:         '#6b6359',
    textTransform: 'uppercase' as const,
    marginBottom:  '8px',
    marginTop:     '28px',
    paddingBottom: '4px',
    borderBottom:  '1px solid #2c2720',
  } as React.CSSProperties,

  actions: {
    display:   'flex',
    gap:       '6px',
    flexWrap:  'wrap' as const,
    marginTop: '10px',
  } as React.CSSProperties,

  dmRow: {
    display:    'flex',
    alignItems: 'center',
    gap:        '8px',
    flexWrap:   'wrap' as const,
    padding:    '8px 14px',
    borderTop:  '1px solid #2c2720',
  } as React.CSSProperties,
}

function btn(
  variant: 'primary' | 'ghost' | 'danger' | 'warn' = 'ghost'
): React.CSSProperties {
  const colors = {
    primary: { background: '#b5975a', color: '#0e0c0a', border: 'none' },
    ghost:   { background: 'transparent', color: '#a09080', border: '1px solid #2c2720' },
    danger:  { background: 'transparent', color: '#c0504a', border: '1px solid #c0504a' },
    warn:    { background: 'transparent', color: '#b5975a', border: '1px solid #b5975a' },
  }
  return {
    ...colors[variant],
    borderRadius:  '4px',
    padding:       '4px 10px',
    fontSize:      '11px',
    fontWeight:    500,
    cursor:        'pointer',
    whiteSpace:    'nowrap' as const,
    fontFamily:    'system-ui, sans-serif',
  }
}

// ── Utilities ──────────────────────────────────────────────────
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AU', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function fmtPrice(price: number | null, currency: string, method: string): string {
  if (!price) return '—'
  const n = new Intl.NumberFormat('en-AU').format(price)
  if (method === 'manual_ir') return `${n} Toman`
  return `${n} ${currency}`
}

function methodLabel(m: string): string {
  if (m === 'manual_ir') return 'Manual IR (Card)'
  if (m === 'manual_au') return 'Manual AU (Bank)'
  if (m === 'paypal')    return 'PayPal'
  return m || '—'
}

function paymentLink(token: string): string {
  return `https://ashkanfaraa.com/consultation/pay?token=${token}`
}

function buildDM(name: string, token: string): string {
  const first = name.trim().split(/\s+/)[0]
  const link  = paymentLink(token)
  return `سلام ${first} جان،\nدرخواستت بررسی شد و به نظر می‌رسه جلسه مشاوره با اشکان جان می‌تونه برای شرایطت ارزشمند باشه.\n\nبرای ادامه، پرداخت رو از طریق لینک زیر انجام بده:\n${link}\n\nبعد از پرداخت، کدی که سایت بهت میده رو همینجا بفرست تا مرحله هماهنگی جلسه انجام بشه.`
}

// ── Copy button ────────────────────────────────────────────────
function CopyBtn({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(value)
        setCopied(true)
        setTimeout(() => setCopied(false), 1800)
      }}
      style={btn('ghost')}
    >
      {copied ? '✓ Copied' : label}
    </button>
  )
}

// ── Full detail view (expanded body) ──────────────────────────
function DetailRows({ app }: { app: App }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
      {[
        ['Name',      app.name],
        ['Email',     app.email],
        ['Instagram', app.instagram || '—'],
        ['Phone',     app.phone     || '—'],
        ['Location',  app.location  || '—'],
        ['Submitted', fmtDate(app.submittedAt)],
        ['Status',    app.status],
        ['Payment Status', app.paymentStatus || '—'],
      ].map(([l, v]) => (
        <div key={l}>
          <span style={S.label}>{l}</span>
          <span style={S.value}>{v}</span>
        </div>
      ))}
      <div style={{ gridColumn: '1 / -1' }}>
        <span style={S.label}>Topic / Decision</span>
        <span style={S.value}>{app.subject || '—'}</span>
      </div>
      <div style={{ gridColumn: '1 / -1' }}>
        <span style={S.label}>Message</span>
        <p style={{ ...S.value, whiteSpace: 'pre-wrap', lineHeight: 1.6, marginTop: '2px', direction: 'rtl', textAlign: 'right' }}>
          {app.message || '—'}
        </p>
      </div>
    </div>
  )
}

// ── Approve form ───────────────────────────────────────────────
interface ApproveResult { paymentLink: string; dmMessage: string }

function ApproveForm({
  app, password, onDone,
}: { app: App; password: string; onDone: (result: ApproveResult) => void }) {
  const [price,  setPrice]  = useState('')
  const [cur,    setCur]    = useState('AUD')
  const [method, setMethod] = useState('paypal')
  const [expiry, setExpiry] = useState('7')
  const [busy,   setBusy]   = useState(false)
  const [err,    setErr]    = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!price || isNaN(Number(price))) { setErr('Enter a valid price'); return }
    setBusy(true); setErr('')
    try {
      const res = await fetch('/api/admin/consultation/approve', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${password}` },
        body: JSON.stringify({
          pageId:     app.pageId,
          name:       app.name,
          price:      Number(price),
          currency:   method === 'manual_ir' ? 'IRR' : cur,
          method,
          expiryDays: Number(expiry),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setErr(data.error ?? 'Failed'); return }
      onDone(data)
    } catch { setErr('Network error') }
    finally { setBusy(false) }
  }

  const isIR = method === 'manual_ir'

  return (
    <form onSubmit={submit} style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: isIR ? '1fr' : '1fr 1fr', gap: '8px' }}>
        <div>
          <span style={S.label}>{isIR ? 'Price (Toman)' : 'Price'}</span>
          <input
            type="number" step="1" min="1" value={price} required
            onChange={e => setPrice(e.target.value)}
            placeholder={isIR ? '17000000' : '250'}
            style={S.input}
          />
        </div>
        {!isIR && (
          <div>
            <span style={S.label}>Currency</span>
            <select value={cur} onChange={e => setCur(e.target.value)} style={S.select}>
              <option value="AUD">AUD</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <div>
          <span style={S.label}>Payment Method</span>
          <select value={method} onChange={e => setMethod(e.target.value)} style={S.select}>
            <option value="paypal">PayPal (INT)</option>
            <option value="manual_ir">Manual IR (Card)</option>
            <option value="manual_au">Manual AU (Bank)</option>
          </select>
        </div>
        <div>
          <span style={S.label}>Link Expiry</span>
          <select value={expiry} onChange={e => setExpiry(e.target.value)} style={S.select}>
            <option value="3">3 days</option>
            <option value="7">7 days</option>
            <option value="14">14 days</option>
          </select>
        </div>
      </div>
      {err && <p style={{ color: '#c0504a', fontSize: '11px', margin: 0 }}>{err}</p>}
      <div style={{ display: 'flex', gap: '6px' }}>
        <button type="submit" disabled={busy} style={btn('primary')}>
          {busy ? '…' : 'Generate Link'}
        </button>
      </div>
    </form>
  )
}

// ── Approval result (after approve OR for already-approved cards) ──
function ApprovalDetails({ app, result }: {
  app:    App
  result: ApproveResult | null
}) {
  const link = result?.paymentLink ?? (app.paymentToken ? paymentLink(app.paymentToken) : '')
  const dm   = result?.dmMessage   ?? (app.paymentToken ? buildDM(app.name, app.paymentToken) : '')
  if (!link) return null

  return (
    <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <span style={S.label}>Payment Link</span>
          <CopyBtn value={link} label="Copy Link" />
        </div>
        <textarea readOnly value={link} rows={2} style={S.textarea} />
      </div>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <span style={S.label}>Persian DM</span>
          <CopyBtn value={dm} label="Copy DM" />
        </div>
        <textarea readOnly value={dm} rows={7} style={{ ...S.textarea, direction: 'rtl' }} />
      </div>
      {app.tokenExpiry && (
        <p style={{ color: '#6b6359', fontSize: '11px', margin: 0 }}>
          Link expires: {fmtDate(app.tokenExpiry)}
          {' · '}{methodLabel(app.paymentMethod)}
          {app.approvedPrice ? ` · ${fmtPrice(app.approvedPrice, app.approvedCurrency, app.paymentMethod)}` : ''}
        </p>
      )}
    </div>
  )
}

// ── Confirm payment (manual IR / AU) ──────────────────────────
function ConfirmPayment({ app, password, onDone }: {
  app: App; password: string; onDone: (consCode: string) => void
}) {
  const [busy,     setBusy]     = useState(false)
  const [err,      setErr]      = useState('')
  const [consCode, setConsCode] = useState('')

  async function confirm() {
    setBusy(true); setErr('')
    try {
      const res = await fetch('/api/admin/consultation/confirm', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${password}` },
        body:    JSON.stringify({ pageId: app.pageId, method: app.paymentMethod }),
      })
      const data = await res.json()
      if (!res.ok) { setErr(data.error ?? 'Failed'); return }
      setConsCode(data.consCode)
      onDone(data.consCode)
    } catch { setErr('Network error') }
    finally { setBusy(false) }
  }

  if (consCode) {
    return (
      <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ color: '#b5975a', fontWeight: 600, fontSize: '15px' }}>{consCode}</span>
        <CopyBtn value={consCode} label="Copy CONS Code" />
      </div>
    )
  }

  return (
    <div style={{ marginTop: '10px' }}>
      {err && <p style={{ color: '#c0504a', fontSize: '11px', marginBottom: '6px' }}>{err}</p>}
      <button onClick={confirm} disabled={busy} style={btn('primary')}>
        {busy ? '…' : 'Confirm Payment & Generate CONS'}
      </button>
    </div>
  )
}

// ── DM Control ────────────────────────────────────────────────
const DM_MODES = ['AI', 'Hybrid', 'Human'] as const
type DmModeValue = typeof DM_MODES[number]

function DmControl({ app, password }: { app: App; password: string }) {
  const [current, setCurrent] = useState<string | null>(app.dmMode)
  const [busy,    setBusy]    = useState<string | null>(null)
  const [err,     setErr]     = useState<string | null>(null)

  if (!app.instagram) {
    return (
      <div style={S.dmRow}>
        <span style={S.label}>DM CONTROL</span>
        <span style={{ color: '#6b6359', fontSize: '11px' }}>No Instagram handle</span>
      </div>
    )
  }

  async function setMode(mode: DmModeValue) {
    if (mode === current || busy) return
    setBusy(mode)
    setErr(null)
    try {
      const res = await fetch('/api/admin/consultation/dm-mode', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          Authorization:   `Bearer ${password}`,
        },
        body: JSON.stringify({
          instagramHandle: app.instagram,
          dmMode:          mode,
          pageId:          app.pageId,
          name:            app.name    || undefined,
          email:           app.email   || undefined,
          phone:           app.phone   || undefined,
          location:        app.location || undefined,
          status:          app.status  || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setErr(data.error || 'Failed'); return }
      setCurrent(data.dmMode)
    } catch {
      setErr('Network error')
    } finally {
      setBusy(null)
    }
  }

  const modeColor: Record<DmModeValue, string> = {
    AI:     '#4a8fc0',
    Hybrid: '#b5975a',
    Human:  '#5a9e6f',
  }

  return (
    <div style={S.dmRow}>
      <span style={S.label}>DM CONTROL</span>
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
        {DM_MODES.map(mode => {
          const active  = mode === current
          const loading = busy === mode
          return (
            <button
              key={mode}
              disabled={!!busy}
              onClick={e => { e.stopPropagation(); setMode(mode) }}
              style={{
                padding:         '3px 10px',
                fontSize:        '11px',
                fontWeight:      active ? 700 : 400,
                border:          `1px solid ${active ? modeColor[mode] : '#2c2720'}`,
                borderRadius:    '4px',
                background:      active ? modeColor[mode] + '22' : 'transparent',
                color:           active ? modeColor[mode] : '#9e9289',
                cursor:          busy ? 'default' : 'pointer',
                opacity:         loading ? 0.5 : 1,
              }}
            >
              {loading ? '…' : mode}
            </button>
          )
        })}
        {!current && (
          <span style={{ color: '#6b6359', fontSize: '11px' }}>not set</span>
        )}
      </div>
      {err && <span style={{ color: '#c0504a', fontSize: '11px', marginLeft: '8px' }}>{err}</span>}
    </div>
  )
}

// ── DM Blocklist ──────────────────────────────────────────────
function BlocklistControl({ app, password }: { app: App; password: string }) {
  const [blocked, setBlocked] = useState<boolean | null>(app.isBlocked)
  const [busy,    setBusy]    = useState(false)
  const [err,     setErr]     = useState<string | null>(null)

  if (!app.instagram) return null

  if (!app.senderId) {
    return (
      <div style={S.dmRow}>
        <span style={S.label}>DM BLOCKLIST</span>
        <span style={{ color: '#6b6359', fontSize: '11px' }}>No sender ID — person hasn't DM'd yet</span>
      </div>
    )
  }

  async function toggle(action: 'block' | 'unblock') {
    setBusy(true)
    setErr(null)
    try {
      const res = await fetch('/api/admin/consultation/blocklist', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${password}` },
        body:    JSON.stringify({ action, instagramHandle: app.instagram, name: app.name }),
      })
      const data = await res.json()
      if (!res.ok) { setErr(data.error || 'Failed'); return }
      setBlocked(action === 'block')
    } catch {
      setErr('Network error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={S.dmRow}>
      <span style={S.label}>DM BLOCKLIST</span>
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
        {blocked === true && (
          <span style={{ color: '#c0504a', fontSize: '11px', fontWeight: 700 }}>BLOCKED</span>
        )}
        {blocked === false && (
          <span style={{ color: '#5a9e6f', fontSize: '11px' }}>Not blocked</span>
        )}
        {blocked === null && (
          <span style={{ color: '#6b6359', fontSize: '11px' }}>Unknown</span>
        )}
        {blocked !== true && (
          <button
            disabled={busy}
            onClick={e => { e.stopPropagation(); toggle('block') }}
            style={{ padding: '3px 10px', fontSize: '11px', border: '1px solid #c0504a', borderRadius: '4px', background: 'transparent', color: '#c0504a', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.5 : 1 }}
          >
            {busy ? '…' : 'Block AI'}
          </button>
        )}
        {blocked === true && (
          <button
            disabled={busy}
            onClick={e => { e.stopPropagation(); toggle('unblock') }}
            style={{ padding: '3px 10px', fontSize: '11px', border: '1px solid #5a9e6f', borderRadius: '4px', background: 'transparent', color: '#5a9e6f', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.5 : 1 }}
          >
            {busy ? '…' : 'Unblock AI'}
          </button>
        )}
      </div>
      {err && <span style={{ color: '#c0504a', fontSize: '11px', marginLeft: '8px' }}>{err}</span>}
    </div>
  )
}

// ── AI Closing Assistant ───────────────────────────────────────

interface AiData {
  leadQuality:            string
  bestOffer:              string
  assessmentReason:       string
  suggestedAction:        string
  responseType:           string
  pastedClaudeOutput:     string
  selectedFinalResponse:  string
  replyInput:             string
  replyIntent:            string
  pastedNextClaudeOutput: string
  nextResponse:           string
  internalNotes:          string
  paymentMessage:         string
}

const DEFAULT_AI: AiData = {
  leadQuality: 'Unknown', bestOffer: 'Unknown', assessmentReason: '',
  suggestedAction: '', responseType: 'sms', pastedClaudeOutput: '',
  selectedFinalResponse: '', replyInput: '', replyIntent: 'continue-closing',
  pastedNextClaudeOutput: '', nextResponse: '', internalNotes: '',
  paymentMessage: '',
}

function buildEnquiryBrief(app: App, d: AiData): string {
  const lines: string[] = [
    'CONSULTATION ENQUIRY — ASHKAN FARAA',
    '─'.repeat(44),
    `Name:             ${app.name || '—'}`,
    `Email:            ${app.email || '—'}`,
    `Phone:            ${app.phone || '—'}`,
    `Instagram:        ${app.instagram || '—'}`,
    `Location:         ${app.location || '—'}`,
    `Submitted:        ${fmtDate(app.submittedAt)}`,
    `Status:           ${app.status || '—'}`,
    '',
    'Topic / Decision:',
    `  ${app.subject || '—'}`,
    '',
    'Message:',
    app.message || '—',
  ]
  if (app.approvedPrice) {
    lines.push('', 'Payment Setup:')
    lines.push(`  Price:          ${fmtPrice(app.approvedPrice, app.approvedCurrency, app.paymentMethod)}`)
    lines.push(`  Currency:       ${app.approvedCurrency || '—'}`)
    lines.push(`  Payment method: ${methodLabel(app.paymentMethod)}`)
    if (app.tokenExpiry)   lines.push(`  Link expiry:    ${fmtDate(app.tokenExpiry)}`)
    if (app.paymentStatus) lines.push(`  Payment status: ${app.paymentStatus}`)
  }
  if (d.internalNotes)         lines.push('', 'Internal Notes:',       d.internalNotes)
  if (d.selectedFinalResponse) lines.push('', 'Saved Final Response:',  d.selectedFinalResponse)
  return lines.join('\n')
}

function buildAiPrompt(app: App, d: AiData): string {
  const typeLabel: Record<string, string> = {
    sms:      'Short SMS / WhatsApp (2–4 sentences, very direct)',
    email:    'Email reply (slightly longer, warm but concise)',
    instagram:'Instagram DM (casual, brief, conversational)',
    followup: "Follow-up — they haven't replied (gentle, no pressure)",
    payment:  'Payment / booking instruction (clear next step)',
    decline:  'Polite decline (kind, firm, no door left open)',
  }
  const adminNote = (d.leadQuality !== 'Unknown' || d.bestOffer !== 'Unknown')
    ? `\nAdmin pre-assessment — quality: ${d.leadQuality} | best offer: ${d.bestOffer}` : ''

  return `You are Ashkan Faraa's premium consultation closing assistant. Write natural Persian responses for website enquiries.

ABOUT ASHKAN FARAA:
Premium Persian-speaking personal brand — migration strategy, global life decisions, lived international experience (Australia). Tone: calm, direct, warm but not needy, high-trust, premium. Never salesy.

COMPLIANCE (non-negotiable):
• Do NOT claim Ashkan is a lawyer or registered migration agent
• Do NOT give legal immigration advice or visa guarantees
• For legal/visa specifics, say they may need a registered migration agent or lawyer
• DO offer strategic perspective, lived-experience education, decision clarity

ASHKAN'S OFFERS:
1. Private Consultation — 40-minute private session:
   Iran: ۶.۹ میلیون تومان | International: AUD pricing on request
2. Hidden Traps of Migration — 90-minute audio course:
   ۵.۹ میلیون تومان

─────────────────────────────────────────
LEAD DETAILS:
Name: ${app.name || '—'}
Email: ${app.email || '—'}
Phone: ${app.phone || '—'}
Instagram: ${app.instagram || '—'}
Location: ${app.location || '—'}
Topic / Decision: ${app.subject || '—'}
Message:
${app.message || '—'}
Current status: ${app.status || 'New'}${adminNote}
─────────────────────────────────────────

REQUESTED RESPONSE FORMAT: ${typeLabel[d.responseType] || d.responseType}

Please output EXACTLY these four sections with these exact headings:

## 1. Lead Assessment
Lead quality: [High / Medium / Low]
Best offer: [Consultation / Course / Bundle / Not suitable]
Reason: [one sentence]
Suggested next action: [one sentence]

## 2. Main Response
[Persian reply — matches the requested format above]

## 3. Softer Version
[Warmer, less direct — same core message]

## 4. Firmer Closer
[Moves more directly toward payment or booking — still premium, not pushy]

WRITING RULES:
- Persian by default (match their language)
- No emojis unless clearly useful (max one)
- No hollow openers: no "سلام عزیزم", no "با سلام و احترام"
- No hype, no long paragraphs
- Make the next step crystal clear
- No legal promises, no outcome guarantees`
}

function buildPaymentMessage(
  app: App,
  linkUrl: string,
  expiryDate: string | null,
): string {
  const first    = (app.name || '').trim().split(/\s+/)[0] || ''
  const priceStr = app.approvedPrice
    ? fmtPrice(app.approvedPrice, app.approvedCurrency, app.paymentMethod)
    : '[هزینه جلسه]'
  const expiryStr = expiryDate ? fmtDate(expiryDate) : '[تاریخ انقضا]'
  const methodNote: Record<string, string> = {
    manual_ir: 'پرداخت از طریق کارت بانکی ایران',
    manual_au: 'واریز بانکی (استرالیا)',
    paypal:    'PayPal',
  }
  const method  = methodNote[app.paymentMethod] || 'پرداخت آنلاین'
  const greeting = first ? `${first} جان،\n\n` : ''

  return `${greeting}اگر تصمیم گرفتی جلسه را رزرو کنی، مرحله بعد پرداخت و ثبت زمان مشاوره است.

مشاوره خصوصی ۴۰ دقیقه‌ای با اشکان برای بررسی دقیق‌تر شرایط، مسیرهای کلی، آمادگی مالی/کاری و تصمیم‌گیری واقع‌بینانه قبل از مهاجرت.

هزینه جلسه: ${priceStr}
روش پرداخت: ${method}
لینک پرداخت: ${linkUrl}

این لینک تا ${expiryStr} فعال است.

بعد از پرداخت، اطلاعات رزرو و هماهنگی زمان جلسه برایت ارسال می‌شود.`
}

function buildReplyPrompt(app: App, d: AiData): string {
  const intentLabel: Record<string, string> = {
    'continue-closing': 'Continue closing — move toward payment or booking',
    'answer-objection': 'Answer their objection, keep them engaged',
    'send-payment':     'Send payment / booking instructions',
    'clarify':          'Ask a clarifying question',
    'to-course':        'Shift them toward the course instead',
    'to-consult':       'Shift them toward consultation instead',
    'decline':          'Politely decline — not a good fit',
  }

  return `You are Ashkan Faraa's premium consultation closing assistant.

CONTEXT — Original enquiry:
Name: ${app.name || '—'}
Location: ${app.location || '—'}
Topic: ${app.subject || '—'}
Original message: ${app.message || '—'}
${d.selectedFinalResponse ? `\nInitial reply Ashkan sent:\n${d.selectedFinalResponse}` : ''}

PROSPECT'S LATEST REPLY:
${d.replyInput || '(not provided)'}

INTENT: ${intentLabel[d.replyIntent] || d.replyIntent}

Write a single Persian reply. Same brand rules: calm, direct, premium, no legal promises, no hollow openers.

## Next Response
[Persian reply]

## Alternative Version
[Slightly different angle or tone]`
}

function AiAssistantPanel({
  app, password, paymentLinkUrl, paymentLinkExpiry,
}: {
  app:               App
  password:          string
  paymentLinkUrl:    string | null
  paymentLinkExpiry: string | null
}) {
  const [open,    setOpen]    = useState(false)
  const [d,       setD]       = useState<AiData>(DEFAULT_AI)
  const [loading, setLoading] = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [copied,  setCopied]  = useState<string | null>(null)
  const [err,     setErr]     = useState<string | null>(null)

  function upd(key: keyof AiData, val: string) {
    setD(prev => ({ ...prev, [key]: val }))
  }

  useEffect(() => {
    if (!open) return
    setLoading(true)
    fetch(`/api/admin/consultation/admin-data?pageId=${encodeURIComponent(app.pageId)}`, {
      headers: { Authorization: `Bearer ${password}` },
    })
      .then(r => r.json())
      .then(j => {
        if (j.data) {
          setD(prev => ({
            ...prev,
            ...Object.fromEntries(
              Object.entries(j.data as Record<string, string | null>)
                .map(([k, v]) => [k, v ?? ''])
            ),
          }))
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    setSaving(true); setErr(null); setSaved(false)
    try {
      const res = await fetch('/api/admin/consultation/admin-data', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${password}` },
        body:    JSON.stringify({ pageId: app.pageId, ...d }),
      })
      const j = await res.json()
      if (!res.ok) { setErr(j.error || 'Save failed'); return }
      setSaved(true)
      setTimeout(() => setSaved(s => s ? false : s), 2000)
    } catch { setErr('Network error') }
    finally { setSaving(false) }
  }

  async function copyText(text: string, key: string) {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      setTimeout(() => setCopied(c => c === key ? null : c), 2000)
    } catch { setErr('Clipboard failed — select and copy manually') }
  }

  function handleGeneratePaymentMessage() {
    if (!paymentLinkUrl) return
    upd('paymentMessage', buildPaymentMessage(app, paymentLinkUrl, paymentLinkExpiry))
  }

  function handleCopyCombined() {
    setErr(null)
    if (!d.selectedFinalResponse.trim()) {
      setErr('Add a final response first — paste it into "Selected Response to Send" above.')
      return
    }
    if (!d.paymentMessage.trim()) {
      setErr("Payment message is empty — generate it or edit it first. To copy only the response, use 'Copy Response to Send' above.")
      return
    }
    void copyText(`${d.selectedFinalResponse}\n\n${d.paymentMessage}`, 'combined')
  }

  const ta: React.CSSProperties = { ...S.textarea, width: '100%', minHeight: '80px', marginTop: '4px' }

  function sub(first = false): React.CSSProperties {
    return {
      fontSize: '10px', fontWeight: 700, color: '#b5975a', letterSpacing: '0.1em',
      textTransform: 'uppercase', marginTop: first ? '8px' : '14px',
      marginBottom: '6px', display: 'block',
      ...(first ? {} : { borderTop: '1px solid #1e1c19', paddingTop: '10px' }),
    }
  }

  const ghostSm: React.CSSProperties = { ...btn('ghost'), fontSize: '11px', alignSelf: 'flex-start', marginTop: '4px' }

  return (
    <div style={{ borderTop: '1px solid #2c2720', marginTop: '10px' }}>
      {/* Toggle */}
      <div
        style={{ padding: '8px 0', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
        onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
      >
        <div>
          <span style={{ fontSize: '10px', color: '#b5975a', fontWeight: 700, letterSpacing: '0.1em' }}>
            AI CLOSING ASSISTANT — MANUAL MODE
          </span>
          {!open && (
            <span style={{ color: '#6b6359', fontSize: '11px', marginLeft: '8px' }}>
              prompt builder · paste &amp; save
            </span>
          )}
        </div>
        <span style={{ color: '#6b6359', fontSize: '11px', marginLeft: 'auto' }}>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingBottom: '12px' }}>
          <p style={{ color: '#6b6359', fontSize: '11px', margin: '0 0 8px', lineHeight: 1.5 }}>
            No AI inside this page. Builds a complete prompt for Claude or ChatGPT — then saves and copies the final response.
          </p>

          {loading && <span style={{ color: '#6b6359', fontSize: '11px' }}>Loading…</span>}
          {err     && <span style={{ color: '#c0504a', fontSize: '11px' }}>{err}</span>}

          {/* ── Copy Enquiry Brief ── */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={e => { e.stopPropagation(); void copyText(buildEnquiryBrief(app, d), 'brief') }}
              style={{ ...btn('ghost'), fontSize: '11px' }}
            >
              {copied === 'brief' ? '✓ Copied' : 'Copy Enquiry Brief'}
            </button>
            <span style={{ color: '#6b6359', fontSize: '11px' }}>all lead data + saved notes &amp; response</span>
          </div>

          {/* ── Lead Assessment ── */}
          <span style={sub(true)}>Lead Assessment</span>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '110px' }}>
              <span style={S.label}>Quality</span>
              <select value={d.leadQuality} onChange={e => upd('leadQuality', e.target.value)} style={S.select}>
                {['Unknown', 'High', 'Medium', 'Low'].map(v => <option key={v}>{v}</option>)}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: '150px' }}>
              <span style={S.label}>Best Offer</span>
              <select value={d.bestOffer} onChange={e => upd('bestOffer', e.target.value)} style={S.select}>
                {['Unknown', 'Consultation', 'Course', 'Bundle', 'Not suitable'].map(v => <option key={v}>{v}</option>)}
              </select>
            </div>
            <div style={{ flex: 2, minWidth: '190px' }}>
              <span style={S.label}>Response Type</span>
              <select value={d.responseType} onChange={e => upd('responseType', e.target.value)} style={S.select}>
                <option value="sms">Short SMS / WhatsApp</option>
                <option value="email">Email reply</option>
                <option value="instagram">Instagram DM</option>
                <option value="followup">Follow-up</option>
                <option value="payment">Payment instruction</option>
                <option value="decline">Polite decline</option>
              </select>
            </div>
          </div>
          <div style={{ marginTop: '10px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={e => { e.stopPropagation(); void copyText(buildAiPrompt(app, d), 'ai-prompt') }}
              style={{ ...btn('primary'), fontSize: '12px' }}
            >
              {copied === 'ai-prompt' ? '✓ Copied' : 'Copy AI Response Prompt'}
            </button>
            <span style={{ color: '#6b6359', fontSize: '11px' }}>→ paste into Claude or ChatGPT → paste output below</span>
          </div>

          {/* ── AI Output ── */}
          <span style={sub()}>Claude / ChatGPT Output (paste here)</span>
          <textarea
            value={d.pastedClaudeOutput}
            onChange={e => upd('pastedClaudeOutput', e.target.value)}
            placeholder="Paste the full AI response here…"
            style={{ ...ta, minHeight: '120px' }}
          />

          {/* ── Selected Final Response ── */}
          <span style={sub()}>Selected Response to Send</span>
          <textarea
            value={d.selectedFinalResponse}
            onChange={e => upd('selectedFinalResponse', e.target.value)}
            placeholder="Paste the specific version you chose to send…"
            style={ta}
          />
          {d.selectedFinalResponse && (
            <button
              onClick={e => { e.stopPropagation(); void copyText(d.selectedFinalResponse, 'final') }}
              style={ghostSm}
            >
              {copied === 'final' ? '✓ Copied' : 'Copy Response to Send'}
            </button>
          )}

          {/* ── Payment & Booking Message ── */}
          <span style={sub()}>Payment &amp; Booking Message</span>
          {!paymentLinkUrl ? (
            <p style={{ color: '#6b6359', fontSize: '11px', margin: 0 }}>
              ⚠ Generate a payment link first — click Approve above, set price and method, then Generate Link.
            </p>
          ) : (
            <>
              <div style={{ fontSize: '11px', color: '#a09080', lineHeight: 1.7, background: '#0e0c0a', padding: '6px 8px', borderRadius: '4px', border: '1px solid #2c2720' }}>
                <span style={{ color: '#6b6359' }}>Link: </span>
                <span style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{paymentLinkUrl}</span>
                {paymentLinkExpiry && (
                  <><br /><span style={{ color: '#6b6359' }}>Expires: </span>
                  <span style={{ color: '#b5975a' }}>{fmtDate(paymentLinkExpiry)}</span></>
                )}
                {!paymentLinkExpiry && (
                  <><br /><span style={{ color: '#6b6359', fontStyle: 'italic' }}>Expiry: refresh the page to see exact date</span></>
                )}
              </div>
              <div style={{ marginTop: '8px' }}>
                <button
                  onClick={e => { e.stopPropagation(); handleGeneratePaymentMessage() }}
                  style={{ ...btn('warn'), fontSize: '11px' }}
                >
                  Generate Payment Message
                </button>
              </div>
              <textarea
                value={d.paymentMessage}
                onChange={e => upd('paymentMessage', e.target.value)}
                placeholder="Click 'Generate Payment Message' — then edit before sending…"
                style={{ ...ta, minHeight: '160px', direction: 'rtl', lineHeight: 1.8, marginTop: '6px' }}
              />
              <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                {d.paymentMessage && (
                  <button
                    onClick={e => { e.stopPropagation(); void copyText(d.paymentMessage, 'payment-msg') }}
                    style={ghostSm}
                  >
                    {copied === 'payment-msg' ? '✓ Copied' : 'Copy Payment Message'}
                  </button>
                )}
                <button
                  onClick={e => { e.stopPropagation(); handleCopyCombined() }}
                  style={{ ...btn('primary'), fontSize: '11px', marginTop: '4px' }}
                >
                  {copied === 'combined' ? '✓ Copied' : 'Copy Combined Response'}
                </button>
              </div>
            </>
          )}

          {/* ── Reply Assistant ── */}
          <span style={sub()}>Reply Assistant</span>
          <span style={S.label}>Prospect's Latest Reply</span>
          <textarea
            value={d.replyInput}
            onChange={e => upd('replyInput', e.target.value)}
            placeholder="Paste their reply here…"
            style={ta}
          />
          <span style={S.label}>Intent</span>
          <select value={d.replyIntent} onChange={e => upd('replyIntent', e.target.value)} style={S.select}>
            <option value="continue-closing">Continue closing</option>
            <option value="answer-objection">Answer objection</option>
            <option value="send-payment">Send payment link</option>
            <option value="clarify">Ask clarifying question</option>
            <option value="to-course">Move to course</option>
            <option value="to-consult">Move to consultation</option>
            <option value="decline">Politely decline</option>
          </select>
          <div style={{ marginTop: '6px' }}>
            <button
              onClick={e => { e.stopPropagation(); void copyText(buildReplyPrompt(app, d), 'reply-prompt') }}
              style={{ ...btn('primary'), fontSize: '12px' }}
            >
              {copied === 'reply-prompt' ? '✓ Copied' : 'Copy Reply Prompt'}
            </button>
          </div>
          <span style={sub()}>Reply AI Output (paste here)</span>
          <textarea
            value={d.pastedNextClaudeOutput}
            onChange={e => upd('pastedNextClaudeOutput', e.target.value)}
            placeholder="Paste the AI reply response here…"
            style={ta}
          />
          <span style={S.label}>Final Reply to Send</span>
          <textarea
            value={d.nextResponse}
            onChange={e => upd('nextResponse', e.target.value)}
            placeholder="The specific reply you'll send…"
            style={ta}
          />
          {d.nextResponse && (
            <button
              onClick={e => { e.stopPropagation(); void copyText(d.nextResponse, 'next-final') }}
              style={ghostSm}
            >
              {copied === 'next-final' ? '✓ Copied' : 'Copy Reply'}
            </button>
          )}

          {/* ── Internal Notes ── */}
          <span style={sub()}>Internal Notes</span>
          <textarea
            value={d.internalNotes}
            onChange={e => upd('internalNotes', e.target.value)}
            placeholder="Private notes about this lead…"
            style={ta}
          />

          {/* ── Save ── */}
          <div style={{ marginTop: '12px' }}>
            <button
              disabled={saving}
              onClick={e => { e.stopPropagation(); void save() }}
              style={{ ...btn('primary'), opacity: saving ? 0.6 : 1 }}
            >
              {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save All'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Application card ──────────────────────────────────────────
type CardMode = 'collapsed' | 'details' | 'approve'

function AppCard({
  app, password, section, onRefresh,
}: {
  app:       App
  password:  string
  section:   'new' | 'underReview' | 'approved' | 'claimed' | 'paid'
  onRefresh: () => void
}) {
  const [mode,          setMode]          = useState<CardMode>('collapsed')
  const [approveResult, setApproveResult] = useState<ApproveResult | null>(null)
  const [consCode,      setConsCode]      = useState(app.consCode)
  const [busy,          setBusy]          = useState(false)

  async function setStatus(status: string) {
    const needsConfirm = new Set(['Declined', 'Not Suitable', 'Closed Lost', 'Archived'])
    if (needsConfirm.has(status) && !window.confirm(`Mark as "${status}"?`)) return
    setBusy(true)
    try {
      await fetch('/api/admin/consultation/status', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${password}` },
        body:    JSON.stringify({ pageId: app.pageId, status }),
      })
      onRefresh()
    } catch { /* silent — refresh will show current state */ }
    finally { setBusy(false) }
  }

  const isExpanded = mode !== 'collapsed'

  return (
    <div style={S.card}>
      {/* ── Header row ── */}
      <div style={S.cardHeader} onClick={() => setMode(m => m === 'collapsed' ? 'details' : 'collapsed')}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontWeight: 600, fontSize: '13px' }}>{app.name}</span>
          <span style={{ color: '#6b6359', marginLeft: '10px' }}>{app.location}</span>
          <span style={{ color: '#6b6359', marginLeft: '10px', fontSize: '11px' }}>
            {new Date(app.submittedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
          </span>
        </div>
        <span style={{ color: '#6b6359', fontSize: '11px', flexShrink: 0 }}>
          {isExpanded ? '▲' : '▼'}
        </span>
      </div>

      {/* ── Subject preview (collapsed) ── */}
      {!isExpanded && app.subject && (
        <div style={{ padding: '0 14px 10px', color: '#6b6359', fontSize: '12px' }}>
          {app.subject.slice(0, 100)}{app.subject.length > 100 ? '…' : ''}
        </div>
      )}

      {/* ── Expanded body ── */}
      {isExpanded && (
        <div style={S.cardBody}>
          <DetailRows app={app} />

          {/* ── Payment sections (before AI assistant) ── */}
          {section === 'claimed' && app.paymentClaim && (
            <div style={{ marginTop: '10px', padding: '8px', background: '#0e0c0a', borderRadius: '4px', border: '1px solid #2c2720' }}>
              <span style={S.label}>Payment Claim</span>
              <span style={{ ...S.value, display: 'block' }}>{app.paymentClaim}</span>
              <span style={{ color: '#6b6359', fontSize: '11px' }}>{methodLabel(app.paymentMethod)}</span>
            </div>
          )}
          {(section === 'approved' || approveResult) && (
            <ApprovalDetails app={app} result={approveResult} />
          )}
          {section === 'paid' && (app.consCode || consCode) && (
            <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ color: '#b5975a', fontWeight: 600, fontSize: '15px' }}>
                {consCode || app.consCode}
              </span>
              <CopyBtn value={consCode || app.consCode} label="Copy CONS" />
            </div>
          )}
          {mode === 'approve' && !approveResult && (
            <ApproveForm
              app={app}
              password={password}
              onDone={result => { setApproveResult(result); setMode('details') }}
            />
          )}
          {section === 'claimed' && (
            <ConfirmPayment
              app={app}
              password={password}
              onDone={code => { setConsCode(code); onRefresh() }}
            />
          )}

          {/* ── AI Closing Assistant ── */}
          <AiAssistantPanel
            app={app}
            password={password}
            paymentLinkUrl={approveResult?.paymentLink ?? (app.paymentToken ? paymentLink(app.paymentToken) : null)}
            paymentLinkExpiry={app.tokenExpiry ?? null}
          />

          {/* ── Actions ── */}
          <div style={S.actions}>
            {(section === 'new' || section === 'underReview') && (
              <>
                {section === 'new' && (
                  <button disabled={busy} style={btn('warn')} onClick={e => { e.stopPropagation(); void setStatus('Under Review') }}>
                    Under Review
                  </button>
                )}
                {mode !== 'approve' && !approveResult && (
                  <button style={btn('primary')} onClick={e => { e.stopPropagation(); setMode('approve') }}>
                    Approve
                  </button>
                )}
                <button disabled={busy} style={btn('ghost')} onClick={e => { e.stopPropagation(); void setStatus('Replied') }}>
                  Replied
                </button>
                <button disabled={busy} style={btn('ghost')} onClick={e => { e.stopPropagation(); void setStatus('Waiting for Payment') }}>
                  Awaiting Payment
                </button>
                <button disabled={busy} style={btn('danger')} onClick={e => { e.stopPropagation(); void setStatus('Not Suitable') }}>
                  Not Suitable
                </button>
                <button disabled={busy} style={btn('danger')} onClick={e => { e.stopPropagation(); void setStatus('Declined') }}>
                  Decline
                </button>
                <button disabled={busy} style={btn('ghost')} onClick={e => { e.stopPropagation(); void setStatus('Archived') }}>
                  Archive
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── DM Access Control ───────────────────────────────────────────
type AccessStatus = 'ai_allowed' | 'human_only' | 'blocked'

interface AccessRuleRow {
  handle:    string | null
  senderId:  string | null
  status:    AccessStatus
  notes:     string | null
  createdAt: string | null
  updatedAt: string | null
  legacy:    boolean
}

const STATUS_LABEL: Record<AccessStatus, string> = {
  ai_allowed:  'AI',
  human_only:  'Human',
  blocked:     'Ignore',
}

const STATUS_ICON: Record<AccessStatus, string> = {
  ai_allowed:  '🤖',
  human_only:  '👤',
  blocked:     '🚫',
}

const STATUS_HELP: Record<AccessStatus, string> = {
  ai_allowed:  'The AI replies normally.',
  human_only:  'The AI never replies. I reply manually.',
  blocked:     'Neither the AI nor I will respond.',
}

// Green = AI, Yellow = Human, Red = Ignore
const STATUS_COLOR: Record<AccessStatus, string> = {
  ai_allowed:  '#5a9e6f',
  human_only:  '#b5975a',
  blocked:     '#c0504a',
}

function rowKey(row: AccessRuleRow): string {
  return row.handle ?? row.senderId ?? ''
}

function fmtRuleDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

function DmAccessControl({ password }: { password: string }) {
  const [rows,       setRows]       = useState<AccessRuleRow[] | null>(null)
  const [search,     setSearch]     = useState('')
  const [newHandle,  setNewHandle]  = useState('')
  const [busyKey,    setBusyKey]    = useState<string | null>(null)
  const [err,        setErr]        = useState<string | null>(null)

  async function load() {
    setErr(null)
    try {
      const res = await fetch('/api/admin/manual-dm-control', {
        headers: { Authorization: `Bearer ${password}` },
      })
      const data = await res.json()
      if (!res.ok) { setErr(data.error || 'Failed to load'); return }
      setRows(data.rules)
    } catch {
      setErr('Network error')
    }
  }

  useEffect(() => { void load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function setStatus(rawHandle: string, status: AccessStatus) {
    const handle = rawHandle.trim().replace(/^@/, '').toLowerCase()
    setBusyKey(handle)
    setErr(null)
    try {
      const res = await fetch('/api/admin/manual-dm-control', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${password}` },
        body:    JSON.stringify({ action: 'set-status', handle, status }),
      })
      const data = await res.json()
      if (!res.ok) { setErr(data.error || 'Failed to update'); return }
      await load()
      setNewHandle('')
    } catch {
      setErr('Network error')
    } finally {
      setBusyKey(null)
    }
  }

  async function remove(row: AccessRuleRow) {
    const key = rowKey(row)
    setBusyKey(key)
    setErr(null)
    try {
      const res = await fetch('/api/admin/manual-dm-control', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${password}` },
        body:    JSON.stringify(
          row.legacy ? { action: 'remove', senderId: row.senderId } : { action: 'remove', handle: row.handle }
        ),
      })
      const data = await res.json()
      if (!res.ok) { setErr(data.error || 'Failed to remove'); return }
      setRows(prev => prev?.filter(r => rowKey(r) !== key) ?? prev)
    } catch {
      setErr('Network error')
    } finally {
      setBusyKey(null)
    }
  }

  const filtered = (rows ?? []).filter(r => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return (r.handle ?? '').toLowerCase().includes(q) || (r.senderId ?? '').toLowerCase().includes(q)
  })

  const addBusy = busyKey !== null && busyKey === newHandle.trim().replace(/^@/, '').toLowerCase()

  return (
    <section>
      <h2 style={S.sectionHead}>DM Access Control ({rows?.length ?? 0})</h2>

      <div style={{ border: '1px solid #2c2720', borderRadius: '6px', padding: '14px', marginBottom: '14px', background: '#100e0c' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', color: '#9e9289', marginBottom: '12px' }}>
          CREATE ACCESS RULE
        </div>

        <span style={S.label}>Instagram Username</span>
        <input
          type="text"
          placeholder="@instagram_handle"
          value={newHandle}
          onChange={e => { setNewHandle(e.target.value); setErr(null) }}
          style={{ ...S.input, width: '260px', marginTop: '4px' }}
        />

        <div style={{ marginTop: '14px' }}>
          <span style={S.label}>Access Mode</span>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
            {(['ai_allowed', 'human_only', 'blocked'] as const).map(s => (
              <button
                key={s}
                disabled={!!busyKey || !newHandle.trim()}
                onClick={() => setStatus(newHandle, s)}
                style={{
                  padding:      '6px 14px',
                  fontSize:     '12px',
                  fontWeight:   600,
                  border:       `1px solid ${STATUS_COLOR[s]}`,
                  borderRadius: '4px',
                  background:   'transparent',
                  color:        STATUS_COLOR[s],
                  cursor:       'pointer',
                  opacity:      addBusy && busyKey !== null ? 0.5 : 1,
                }}
              >
                {addBusy ? '…' : `${STATUS_ICON[s]} ${STATUS_LABEL[s]}`}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {(['ai_allowed', 'human_only', 'blocked'] as const).map(s => (
            <div key={s} style={{ fontSize: '11px', color: '#9e9289' }}>
              <span style={{ color: '#d4cdc5', fontWeight: 600 }}>{STATUS_ICON[s]} {STATUS_LABEL[s]}</span>
              {' — '}{STATUS_HELP[s]}
            </div>
          ))}
        </div>
      </div>

      <input
        type="text"
        placeholder="Search by handle or sender ID…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ ...S.input, marginBottom: '10px' }}
      />

      {err && <p style={{ color: '#c0504a', fontSize: '12px' }}>{err}</p>}
      {rows === null && !err && <p style={{ color: '#6b6359', fontSize: '12px' }}>Loading…</p>}

      {rows !== null && filtered.length === 0 && (
        <p style={{ color: '#6b6359', fontSize: '12px' }}>
          {rows.length === 0 ? 'No one is set up yet — add a username above.' : 'No matches.'}
        </p>
      )}

      {filtered.length > 0 && (
        <div style={S.card}>
          {filtered.map((row, i) => {
            const key  = rowKey(row)
            const busy = busyKey === key
            return (
              <div
                key={key}
                style={{
                  display:      'flex',
                  alignItems:   'center',
                  gap:          '10px',
                  padding:      '10px 14px',
                  flexWrap:     'wrap',
                  borderTop:    i === 0 ? 'none' : '1px solid #2c2720',
                }}
              >
                <div style={{ flex: '1 1 140px', minWidth: 0 }}>
                  <span style={S.label}>Instagram Handle</span>
                  <div style={S.value}>{row.handle || '—'}</div>
                </div>
                <div style={{ flex: '1 1 140px', minWidth: 0 }}>
                  <span style={S.label}>Sender ID</span>
                  <div style={{ ...S.value, fontSize: '11px', color: '#9e9289', wordBreak: 'break-all' }}>
                    {row.senderId || '—'}
                  </div>
                </div>
                <div style={{ flex: '0 0 130px' }}>
                  <span style={S.label}>Type</span>
                  <div style={{ ...S.value, fontSize: '11px' }}>
                    {row.senderId ? 'Known User' : 'Waiting for First DM'}
                  </div>
                </div>
                <div style={{ flex: '0 0 90px' }}>
                  <span style={S.label}>Status</span>
                  <div style={{ marginTop: '2px' }}>
                    <span
                      style={{
                        display:      'inline-block',
                        padding:      '2px 8px',
                        fontSize:     '11px',
                        fontWeight:   700,
                        borderRadius: '10px',
                        border:       `1px solid ${STATUS_COLOR[row.status]}`,
                        background:   STATUS_COLOR[row.status] + '22',
                        color:        STATUS_COLOR[row.status],
                        whiteSpace:   'nowrap',
                      }}
                    >
                      {STATUS_ICON[row.status]} {STATUS_LABEL[row.status]}
                    </span>
                  </div>
                </div>
                <div style={{ flex: '1 1 160px', minWidth: 0 }}>
                  <span style={S.label}>Notes</span>
                  <div style={{ ...S.value, fontSize: '11px', color: '#9e9289' }}>{row.notes || '—'}</div>
                </div>
                <div style={{ flex: '0 0 90px' }}>
                  <span style={S.label}>Updated</span>
                  <div style={{ ...S.value, fontSize: '11px' }}>{fmtRuleDate(row.updatedAt ?? row.createdAt)}</div>
                </div>

                <div style={{ flex: '1 1 100%', display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', marginTop: '4px' }}>
                  {(['ai_allowed', 'human_only', 'blocked'] as const).map(s => {
                    const active = s === row.status
                    return (
                      <button
                        key={s}
                        disabled={row.legacy || busy}
                        onClick={() => setStatus(row.handle!, s)}
                        style={{
                          padding:      '3px 10px',
                          fontSize:     '11px',
                          fontWeight:   active ? 700 : 400,
                          border:       `1px solid ${active ? STATUS_COLOR[s] : '#2c2720'}`,
                          borderRadius: '4px',
                          background:   active ? STATUS_COLOR[s] + '22' : 'transparent',
                          color:        active ? STATUS_COLOR[s] : '#9e9289',
                          cursor:       (row.legacy || busy) ? 'default' : 'pointer',
                          opacity:      row.legacy ? 0.4 : 1,
                        }}
                      >
                        {STATUS_ICON[s]} {STATUS_LABEL[s]}
                      </button>
                    )
                  })}
                  <button
                    disabled={busy}
                    onClick={() => remove(row)}
                    style={{ ...btn('ghost'), opacity: busy ? 0.5 : 1, marginLeft: 'auto' }}
                  >
                    {busy ? '…' : 'Remove'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

// ── Section wrapper ───────────────────────────────────────────
function Section({
  title, apps, password, section, onRefresh,
}: {
  title:     string
  apps:      App[]
  password:  string
  section:   'new' | 'underReview' | 'approved' | 'claimed' | 'paid'
  onRefresh: () => void
}) {
  return (
    <section>
      <h2 style={S.sectionHead}>{title} ({apps.length})</h2>
      {apps.length === 0
        ? <p style={{ color: '#6b6359', fontSize: '12px' }}>None.</p>
        : apps.map(app => (
            <AppCard
              key={app.pageId}
              app={app}
              password={password}
              section={section}
              onRefresh={onRefresh}
            />
          ))
      }
    </section>
  )
}

// ── Main page ─────────────────────────────────────────────────
export default function AdminPage() {
  const [password,  setPassword]  = useState('')
  const [inputPw,   setInputPw]   = useState('')
  const [pwErr,     setPwErr]     = useState('')
  const [data,      setData]      = useState<DashboardData | null>(null)
  const [loading,   setLoading]   = useState(false)
  const [fetchErr,  setFetchErr]  = useState('')

  useEffect(() => {
    const saved = sessionStorage.getItem('adminPw')
    if (saved) { setPassword(saved); void load(saved) }
  }, [])

  async function load(pw: string) {
    setLoading(true); setFetchErr('')
    try {
      const res = await fetch('/api/admin/consultation/list', {
        headers: { Authorization: `Bearer ${pw}` },
      })
      if (res.status === 401) {
        setPwErr('Incorrect password')
        sessionStorage.removeItem('adminPw')
        setPassword('')
        return
      }
      if (!res.ok) { setFetchErr('Failed to load'); return }
      setData(await res.json())
    } catch { setFetchErr('Network error') }
    finally { setLoading(false) }
  }

  function handleLogin(e: FormEvent) {
    e.preventDefault()
    sessionStorage.setItem('adminPw', inputPw)
    setPassword(inputPw)
    void load(inputPw)
  }

  // ── Login screen ──────────────────────────────────────────
  if (!password) {
    return (
      <main style={{ ...S.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <form onSubmit={handleLogin} style={{ width: '280px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <p style={{ color: '#6b6359', fontSize: '11px', letterSpacing: '0.1em', marginBottom: '4px' }}>ADMIN</p>
          <input
            type="password" value={inputPw} autoFocus required
            onChange={e => setInputPw(e.target.value)}
            placeholder="Password"
            style={S.input}
          />
          {pwErr && <p style={{ color: '#c0504a', fontSize: '11px', margin: 0 }}>{pwErr}</p>}
          <button type="submit" style={btn('primary')}>Enter</button>
        </form>
      </main>
    )
  }

  // ── Dashboard ─────────────────────────────────────────────
  return (
    <main style={S.page}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ color: '#6b6359', fontSize: '11px', letterSpacing: '0.1em' }}>CONSULTATION ADMIN</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => load(password)} style={btn('ghost')}>
            {loading ? '…' : 'Refresh'}
          </button>
          <button onClick={() => { sessionStorage.removeItem('adminPw'); setPassword('') }} style={btn('ghost')}>
            Sign Out
          </button>
        </div>
      </div>

      {fetchErr && <p style={{ color: '#c0504a', fontSize: '12px' }}>{fetchErr}</p>}
      {loading && !data && <p style={{ color: '#6b6359', fontSize: '12px' }}>Loading…</p>}

      <DmAccessControl password={password} />

      {data && (
        <>
          <Section title="New Applications"              apps={data.new}         password={password} section="new"         onRefresh={() => load(password)} />
          <Section title="Under Review"                  apps={data.underReview} password={password} section="underReview" onRefresh={() => load(password)} />
          <Section title="Approved / Payment Sent"       apps={data.approved}    password={password} section="approved"    onRefresh={() => load(password)} />
          <Section title="Awaiting Manual Confirmation"  apps={data.claimed}     password={password} section="claimed"     onRefresh={() => load(password)} />
          <Section title="Paid / Completed"              apps={data.paid}        password={password} section="paid"        onRefresh={() => load(password)} />
        </>
      )}
    </main>
  )
}
