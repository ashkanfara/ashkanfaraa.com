'use client'

/**
 * /admin — Consultation review dashboard.
 * Protected by a server-managed HttpOnly session cookie.
 * ADMIN_SECRET never reaches the browser — verified once at login, server-side.
 * No Anthropic/OpenAI API. Clipboard + manual workflow only.
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

// ── Styles ────────────────────────────────────────────────────
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
    background:   '#1a1714',
    border:       '1px solid #2c2720',
    borderRadius: '6px',
    marginBottom: '8px',
  } as React.CSSProperties,

  cardHeader: {
    padding:    '10px 14px',
    display:    'flex',
    alignItems: 'flex-start',
    gap:        '10px',
    cursor:     'pointer',
  } as React.CSSProperties,

  cardBody: {
    padding:   '0 14px 14px',
    borderTop: '1px solid #2c2720',
  } as React.CSSProperties,

  label: {
    color:         '#6b6359',
    fontSize:      '11px',
    marginBottom:  '2px',
    marginTop:     '10px',
    display:       'block',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
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
    width:      '100%',
    background: '#0e0c0a',
    border:     '1px solid #2c2720',
    borderRadius: '4px',
    padding:    '6px 8px',
    fontSize:   '12px',
    color:      '#e8e4de',
    outline:    'none',
    fontFamily: 'monospace',
    resize:     'none' as const,
    boxSizing:  'border-box' as const,
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

  subhead: {
    fontSize:      '10px',
    fontWeight:    700,
    color:         '#b5975a',
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    marginTop:     '16px',
    marginBottom:  '6px',
    paddingTop:    '12px',
    borderTop:     '1px solid #1e1c19',
    display:       'block',
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
    borderRadius: '4px',
    padding:      '4px 10px',
    fontSize:     '11px',
    fontWeight:   500,
    cursor:       'pointer',
    whiteSpace:   'nowrap' as const,
    fontFamily:   'system-ui, sans-serif',
  }
}

// ── Utilities ─────────────────────────────────────────────────
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

// ── Content builders ──────────────────────────────────────────
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
  if (d.internalNotes)        lines.push('', 'Internal Note:', d.internalNotes)
  if (d.selectedFinalResponse) lines.push('', 'Saved Response:', d.selectedFinalResponse)
  return lines.join('\n')
}

function buildAiPrompt(app: App): string {
  return `You are Ashkan Faraa's premium consultation closing assistant. Write natural Persian responses for website enquiries.

ABOUT ASHKAN FARAA:
Premium Persian-speaking personal brand — migration strategy, global life decisions, lived international experience (Australia). Tone: calm, direct, warm but not needy, high-trust, premium. Never salesy.

COMPLIANCE (non-negotiable):
• Do NOT claim Ashkan is a lawyer or registered migration agent
• Do NOT give legal immigration advice or visa guarantees
• For legal/visa specifics, say they may need a registered migration agent or lawyer
• DO offer strategic perspective, lived-experience education, decision clarity

ASHKAN'S OFFERS:
1. Private Consultation — 40-minute private session
   Iran: ۶.۹ میلیون تومان | International: AUD pricing on request
2. Hidden Traps of Migration — 90-minute audio course
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
─────────────────────────────────────────

Output EXACTLY these sections with these headings:

## 1. Lead Assessment
Lead quality: [High / Medium / Low]
Best offer: [Consultation / Course / Bundle / Not suitable]
Reason: [one sentence]
Suggested next action: [one sentence]

## 2. Main Response
[Persian reply — short, direct, warm, premium]

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

function buildFollowUpPrompt(app: App, d: AiData): string {
  return `You are Ashkan Faraa's premium consultation closing assistant.

CONTEXT — Original enquiry:
Name: ${app.name || '—'}
Location: ${app.location || '—'}
Topic: ${app.subject || '—'}
Original message: ${app.message || '—'}
${d.selectedFinalResponse ? `\nInitial reply sent:\n${d.selectedFinalResponse}` : ''}

PROSPECT'S LATEST REPLY:
${d.replyInput || '(not provided)'}

Write a single Persian follow-up reply. Same brand rules: calm, direct, premium, no legal promises, no hollow openers. Move toward the most appropriate next step.

## Follow-up Response
[Persian reply]

## Alternative Version
[Slightly different angle or tone]`
}

function buildPaymentMessage(app: App, linkUrl: string, expiryDate: string | null): string {
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

// ── Small copy button ─────────────────────────────────────────
function CopyBtn({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => {
        void navigator.clipboard.writeText(value)
        setCopied(true)
        setTimeout(() => setCopied(false), 1800)
      }}
      style={btn('ghost')}
    >
      {copied ? '✓ Copied' : label}
    </button>
  )
}

// ── Detail rows ───────────────────────────────────────────────
function DetailRows({ app }: { app: App }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
      {[
        ['Name',           app.name],
        ['Email',          app.email],
        ['Instagram',      app.instagram || '—'],
        ['Phone',          app.phone     || '—'],
        ['Location',       app.location  || '—'],
        ['Submitted',      fmtDate(app.submittedAt)],
        ['Status',         app.status],
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

// ── Approve form ──────────────────────────────────────────────
interface ApproveResult { paymentLink: string; dmMessage: string }

function ApproveForm({ app, onDone }: {
  app: App; onDone: (result: ApproveResult) => void
}) {
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
        headers: { 'Content-Type': 'application/json' },
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
      <button type="submit" disabled={busy} style={btn('primary')}>
        {busy ? '…' : 'Generate Link'}
      </button>
    </form>
  )
}

// ── Confirm payment (manual IR / AU) ──────────────────────────
function ConfirmPayment({ app, onDone }: {
  app: App; onDone: (consCode: string) => void
}) {
  const [busy,     setBusy]     = useState(false)
  const [err,      setErr]      = useState('')
  const [consCode, setConsCode] = useState('')

  async function confirm() {
    setBusy(true); setErr('')
    try {
      const res = await fetch('/api/admin/consultation/confirm', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
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

// ── Payment section ───────────────────────────────────────────
function PaymentSection({
  app, section, approveResult, onApproveResult, consCode, onConsCode,
  d, onUpdatePaymentMessage,
}: {
  app:                    App
  section:                string
  approveResult:          ApproveResult | null
  onApproveResult:        (r: ApproveResult) => void
  consCode:               string
  onConsCode:             (c: string) => void
  d:                      AiData
  onUpdatePaymentMessage: (msg: string) => void
}) {
  const [showApprove, setShowApprove] = useState(false)
  const [copiedPm,    setCopiedPm]    = useState<string | null>(null)
  const [pmErr,       setPmErr]       = useState<string | null>(null)

  const linkUrl    = approveResult?.paymentLink ?? (app.paymentToken ? paymentLink(app.paymentToken) : null)
  const expiryDate = app.tokenExpiry ?? null

  async function copyText(text: string, key: string) {
    setPmErr(null)
    try {
      await navigator.clipboard.writeText(text)
      setCopiedPm(key)
      setTimeout(() => setCopiedPm(c => c === key ? null : c), 2000)
    } catch { setPmErr('Clipboard failed') }
  }

  function handleCopyCombined() {
    setPmErr(null)
    if (!d.selectedFinalResponse.trim()) {
      setPmErr('Add a response first — save it in "Response & Notes" below.')
      return
    }
    if (!d.paymentMessage.trim()) {
      setPmErr('Generate the payment message first.')
      return
    }
    void copyText(`${d.selectedFinalResponse}\n\n${d.paymentMessage}`, 'combined')
  }

  const hasPaymentSetup = !!(app.approvedPrice || approveResult)
  const isClaimed       = section === 'claimed'
  const isPaid          = section === 'paid'

  if (!hasPaymentSetup && !isClaimed && !isPaid && section !== 'new' && section !== 'underReview') {
    return null
  }

  return (
    <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #1e1c19' }}>
      <span style={{ fontSize: '10px', fontWeight: 700, color: '#b5975a', letterSpacing: '0.1em', textTransform: 'uppercase' as const }}>
        Payment Setup
      </span>

      {/* Already approved — show details */}
      {(app.approvedPrice || approveResult) && (
        <div style={{ marginTop: '8px', fontSize: '12px', color: '#a09080', lineHeight: 1.8, background: '#0e0c0a', padding: '8px 10px', borderRadius: '4px', border: '1px solid #2c2720' }}>
          {app.approvedPrice && (
            <>
              <span style={{ color: '#6b6359' }}>Price: </span>
              <span>{fmtPrice(app.approvedPrice, app.approvedCurrency, app.paymentMethod)}</span>
              <span style={{ color: '#6b6359', marginLeft: '12px' }}>Method: </span>
              <span>{methodLabel(app.paymentMethod)}</span>
              <br />
            </>
          )}
          {linkUrl && (
            <>
              <span style={{ color: '#6b6359' }}>Link: </span>
              <span style={{ fontFamily: 'monospace', wordBreak: 'break-all', fontSize: '11px' }}>{linkUrl}</span>
              <br />
            </>
          )}
          {expiryDate && (
            <>
              <span style={{ color: '#6b6359' }}>Expires: </span>
              <span style={{ color: '#b5975a' }}>{fmtDate(expiryDate)}</span>
            </>
          )}
          {linkUrl && !expiryDate && (
            <span style={{ color: '#6b6359', fontStyle: 'italic', fontSize: '11px' }}>Expiry visible after page refresh</span>
          )}
        </div>
      )}

      {/* Link copy + payment message — only when link exists */}
      {linkUrl && (
        <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <CopyBtn value={linkUrl} label="Copy Payment Link" />
            <button
              onClick={e => { e.stopPropagation(); onUpdatePaymentMessage(buildPaymentMessage(app, linkUrl, expiryDate)) }}
              style={btn('warn')}
            >
              Generate Payment Message
            </button>
          </div>

          {d.paymentMessage && (
            <>
              <textarea
                value={d.paymentMessage}
                onChange={e => onUpdatePaymentMessage(e.target.value)}
                rows={7}
                style={{ ...S.textarea, direction: 'rtl', lineHeight: 1.8, marginTop: '4px' }}
              />
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button
                  onClick={e => { e.stopPropagation(); void copyText(d.paymentMessage, 'pm') }}
                  style={btn('ghost')}
                >
                  {copiedPm === 'pm' ? '✓ Copied' : 'Copy Payment Message'}
                </button>
                <button
                  onClick={e => { e.stopPropagation(); handleCopyCombined() }}
                  style={btn('primary')}
                >
                  {copiedPm === 'combined' ? '✓ Copied' : 'Copy Combined Message'}
                </button>
              </div>
              {pmErr && <p style={{ color: '#c0504a', fontSize: '11px', margin: 0 }}>{pmErr}</p>}
            </>
          )}
        </div>
      )}

      {/* Approve form toggle */}
      {!linkUrl && !showApprove && (
        <div style={{ marginTop: '8px' }}>
          <button
            style={btn('primary')}
            onClick={e => { e.stopPropagation(); setShowApprove(true) }}
          >
            Approve & Generate Link
          </button>
        </div>
      )}
      {showApprove && !approveResult && (
        <ApproveForm
          app={app}
          onDone={r => { onApproveResult(r); setShowApprove(false) }}
        />
      )}

      {/* Payment claim */}
      {isClaimed && app.paymentClaim && (
        <div style={{ marginTop: '8px', padding: '8px', background: '#0e0c0a', borderRadius: '4px', border: '1px solid #2c2720' }}>
          <span style={S.label}>Payment Claim</span>
          <span style={{ ...S.value, display: 'block' }}>{app.paymentClaim}</span>
          <span style={{ color: '#6b6359', fontSize: '11px' }}>{methodLabel(app.paymentMethod)}</span>
          <ConfirmPayment app={app} onDone={onConsCode} />
        </div>
      )}

      {/* CONS code for paid */}
      {isPaid && (app.consCode || consCode) && (
        <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ color: '#b5975a', fontWeight: 600, fontSize: '15px' }}>{consCode || app.consCode}</span>
          <CopyBtn value={consCode || app.consCode} label="Copy CONS" />
        </div>
      )}

      {/* Payment status buttons in payment section */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px' }}>
        <PaymentStatusBtn label="Awaiting Payment" status="Waiting for Payment" />
        <PaymentStatusBtn label="Paid"             status="Paid" />
        <PaymentStatusBtn label="Booked"           status="Booked" />
      </div>
    </div>
  )

  function PaymentStatusBtn({ label, status }: { label: string; status: string }) {
    const active = app.status === status
    return (
      <button
        onClick={async e => {
          e.stopPropagation()
          await fetch('/api/admin/consultation/status', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ pageId: app.pageId, status }),
          })
        }}
        style={{
          ...btn(active ? 'warn' : 'ghost'),
          opacity: active ? 1 : 0.6,
        }}
      >
        {label}
      </button>
    )
  }
}

// ── Response & Notes ──────────────────────────────────────────
function ResponseAndNotes({
  d, onUpd, onSaveResponse, onSaveNote, onSaveReply,
  saving, saved, dLoading,
}: {
  d:              AiData
  onUpd:          (key: keyof AiData, val: string) => void
  onSaveResponse: () => void
  onSaveNote:     () => void
  onSaveReply:    () => void
  saving:         boolean
  saved:          string | null
  dLoading:       boolean
}) {
  const [copiedR, setCopiedR] = useState(false)

  return (
    <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #1e1c19' }}>
      <span style={{ fontSize: '10px', fontWeight: 700, color: '#b5975a', letterSpacing: '0.1em', textTransform: 'uppercase' as const }}>
        Response &amp; Notes
      </span>

      {dLoading && <span style={{ color: '#6b6359', fontSize: '11px', marginLeft: '8px' }}>Loading…</span>}

      {/* Final Response Given */}
      <span style={S.label}>Final Response Given</span>
      <textarea
        value={d.selectedFinalResponse}
        onChange={e => onUpd('selectedFinalResponse', e.target.value)}
        placeholder="Paste the response you sent (or plan to send)…"
        rows={5}
        style={{ ...S.textarea, marginTop: '4px' }}
      />
      <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
        <button
          disabled={saving}
          onClick={e => { e.stopPropagation(); onSaveResponse() }}
          style={{ ...btn('ghost'), opacity: saving ? 0.6 : 1 }}
        >
          {saved === 'response' ? '✓ Saved' : saving ? '…' : 'Save Response'}
        </button>
        {d.selectedFinalResponse && (
          <button
            onClick={async e => {
              e.stopPropagation()
              await navigator.clipboard.writeText(d.selectedFinalResponse)
              setCopiedR(true)
              setTimeout(() => setCopiedR(false), 1800)
            }}
            style={btn('ghost')}
          >
            {copiedR ? '✓ Copied' : 'Copy Response'}
          </button>
        )}
      </div>

      {/* Internal Note */}
      <span style={{ ...S.label, marginTop: '14px' }}>Internal Note</span>
      <textarea
        value={d.internalNotes}
        onChange={e => onUpd('internalNotes', e.target.value)}
        placeholder="Private notes about this lead…"
        rows={3}
        style={{ ...S.textarea, marginTop: '4px' }}
      />
      <div style={{ marginTop: '6px' }}>
        <button
          disabled={saving}
          onClick={e => { e.stopPropagation(); onSaveNote() }}
          style={{ ...btn('ghost'), opacity: saving ? 0.6 : 1 }}
        >
          {saved === 'note' ? '✓ Saved' : saving ? '…' : 'Save Note'}
        </button>
      </div>

      {/* Latest Prospect Reply */}
      <span style={{ ...S.label, marginTop: '14px' }}>Latest Prospect Reply (optional)</span>
      <textarea
        value={d.replyInput}
        onChange={e => onUpd('replyInput', e.target.value)}
        placeholder="Paste their latest reply here to generate a follow-up prompt…"
        rows={3}
        style={{ ...S.textarea, marginTop: '4px' }}
      />
      {d.replyInput && (
        <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
          <button
            disabled={saving}
            onClick={e => { e.stopPropagation(); onSaveReply() }}
            style={{ ...btn('ghost'), opacity: saving ? 0.6 : 1 }}
          >
            {saved === 'reply' ? '✓ Saved' : saving ? '…' : 'Save'}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Instagram DM Safety ───────────────────────────────────────
function InstagramDmSafety({ app }: { app: App }) {
  const [dmMode,  setDmMode]  = useState<string | null>(app.dmMode)
  const [blocked, setBlocked] = useState<boolean | null>(app.isBlocked)
  const [busy,    setBusy]    = useState<string | null>(null)
  const [err,     setErr]     = useState<string | null>(null)

  async function setMode(mode: 'AI' | 'Hybrid' | 'Human') {
    setBusy('mode'); setErr(null)
    try {
      const res = await fetch('/api/admin/consultation/dm-mode', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
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
      setDmMode(data.dmMode)
    } catch { setErr('Network error') }
    finally { setBusy(null) }
  }

  async function toggleBlock(action: 'block' | 'unblock') {
    setBusy('block'); setErr(null)
    try {
      const res = await fetch('/api/admin/consultation/blocklist', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action, instagramHandle: app.instagram, name: app.name }),
      })
      const data = await res.json()
      if (!res.ok) { setErr(data.error || 'Failed'); return }
      setBlocked(action === 'block')
    } catch { setErr('Network error') }
    finally { setBusy(null) }
  }

  return (
    <div style={{ marginTop: '14px', padding: '8px 10px', border: '1px solid #1e1c19', borderRadius: '4px', background: '#110e0c' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '10px', color: '#6b6359', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>
          IG DM
        </span>
        <span style={{ color: '#9e9289', fontSize: '11px' }}>@{app.instagram}</span>

        {/* DM mode */}
        {(['AI', 'Human'] as const).map(mode => {
          const active = mode === dmMode
          const color  = mode === 'AI' ? '#4a8fc0' : '#5a9e6f'
          return (
            <button key={mode} disabled={!!busy}
              onClick={e => { e.stopPropagation(); void setMode(mode) }}
              style={{
                padding: '2px 8px', fontSize: '10px',
                border: `1px solid ${active ? color : '#2c2720'}`,
                borderRadius: '3px',
                background: active ? color + '22' : 'transparent',
                color: active ? color : '#9e9289',
                cursor: 'pointer', fontWeight: active ? 700 : 400,
              }}>
              {busy === 'mode' ? '…' : mode}
            </button>
          )
        })}

        {/* Block/Unblock — only when senderId known */}
        {app.senderId && (
          blocked ? (
            <button disabled={!!busy}
              onClick={e => { e.stopPropagation(); void toggleBlock('unblock') }}
              style={{ padding: '2px 8px', fontSize: '10px', border: '1px solid #5a9e6f', borderRadius: '3px', background: 'transparent', color: '#5a9e6f', cursor: 'pointer' }}>
              {busy === 'block' ? '…' : 'Restore AI DM'}
            </button>
          ) : (
            <button disabled={!!busy}
              onClick={e => { e.stopPropagation(); void toggleBlock('block') }}
              style={{ padding: '2px 8px', fontSize: '10px', border: '1px solid #c0504a', borderRadius: '3px', background: 'transparent', color: '#c0504a', cursor: 'pointer' }}>
              {busy === 'block' ? '…' : 'Block AI DM'}
            </button>
          )
        )}
        {!app.senderId && (
          <span style={{ color: '#6b6359', fontSize: '10px' }}>no DM match yet</span>
        )}
        {blocked === true && (
          <span style={{ color: '#c0504a', fontSize: '10px', fontWeight: 700 }}>BLOCKED</span>
        )}
        {err && <span style={{ color: '#c0504a', fontSize: '10px' }}>{err}</span>}
      </div>
    </div>
  )
}

// ── Application card ──────────────────────────────────────────
function AppCard({
  app, section, onRefresh,
}: {
  app:       App
  section:   'new' | 'underReview' | 'approved' | 'claimed' | 'paid'
  onRefresh: () => void
}) {
  const [isOpen,        setIsOpen]        = useState(false)
  const [approveResult, setApproveResult] = useState<ApproveResult | null>(null)
  const [consCode,      setConsCode]      = useState(app.consCode)
  const [busy,          setBusy]          = useState(false)
  const [d,             setD]             = useState<AiData>(DEFAULT_AI)
  const [dLoading,      setDLoading]      = useState(false)
  const [dSaving,       setDSaving]       = useState(false)
  const [dSaved,        setDSaved]        = useState<string | null>(null)
  const [copied,        setCopied]        = useState<string | null>(null)

  // Load DB data when card opens
  useEffect(() => {
    if (!isOpen) return
    setDLoading(true)
    fetch(`/api/admin/consultation/admin-data?pageId=${encodeURIComponent(app.pageId)}`)
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
      .finally(() => setDLoading(false))
  }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  function upd(key: keyof AiData, val: string) {
    setD(prev => ({ ...prev, [key]: val }))
  }

  async function saveFields(fields: Partial<AiData>, label: string) {
    setDSaving(true); setDSaved(null)
    try {
      const res = await fetch('/api/admin/consultation/admin-data', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ pageId: app.pageId, ...fields }),
      })
      if (res.ok) {
        setDSaved(label)
        setTimeout(() => setDSaved(s => s === label ? null : s), 2000)
      }
    } catch {}
    finally { setDSaving(false) }
  }

  async function copyText(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      setTimeout(() => setCopied(c => c === key ? null : c), 2000)
    } catch {}
  }

  async function setStatus(status: string) {
    const needsConfirm = new Set(['Declined', 'Not Suitable', 'Archived'])
    if (needsConfirm.has(status) && !window.confirm(`Mark as "${status}"?`)) return
    setBusy(true)
    try {
      await fetch('/api/admin/consultation/status', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ pageId: app.pageId, status }),
      })
      onRefresh()
    } catch {}
    finally { setBusy(false) }
  }

  return (
    <div style={S.card}>
      {/* Header */}
      <div style={S.cardHeader} onClick={() => setIsOpen(o => !o)}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontWeight: 600, fontSize: '13px' }}>{app.name}</span>
          <span style={{ color: '#6b6359', marginLeft: '10px' }}>{app.location}</span>
          <span style={{ color: '#6b6359', marginLeft: '10px', fontSize: '11px' }}>
            {new Date(app.submittedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
          </span>
          {app.status && app.status !== 'New' && (
            <span style={{ color: '#b5975a', marginLeft: '10px', fontSize: '11px' }}>{app.status}</span>
          )}
        </div>
        <span style={{ color: '#6b6359', fontSize: '11px', flexShrink: 0 }}>
          {isOpen ? '▲' : '▼'}
        </span>
      </div>

      {/* Subject preview (collapsed) */}
      {!isOpen && app.subject && (
        <div style={{ padding: '0 14px 10px', color: '#6b6359', fontSize: '12px' }}>
          {app.subject.slice(0, 120)}{app.subject.length > 120 ? '…' : ''}
        </div>
      )}

      {/* Expanded body */}
      {isOpen && (
        <div style={S.cardBody}>

          {/* ── 1. TOP ACTION ROW ── */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', paddingTop: '12px', paddingBottom: '12px', borderBottom: '1px solid #1e1c19' }}>

            {/* Copy buttons */}
            <button
              onClick={e => { e.stopPropagation(); void copyText(buildEnquiryBrief(app, d), 'brief') }}
              style={btn('ghost')}
            >
              {copied === 'brief' ? '✓ Copied' : 'Copy Enquiry'}
            </button>
            {d.replyInput.trim() && (
              <button
                onClick={e => { e.stopPropagation(); void copyText(buildFollowUpPrompt(app, d), 'followup') }}
                style={btn('ghost')}
              >
                {copied === 'followup' ? '✓ Copied' : 'Copy Follow-up Prompt'}
              </button>
            )}

            {/* Divider */}
            <span style={{ width: '1px', background: '#2c2720', margin: '0 2px', alignSelf: 'stretch' }} />

            {/* Status buttons */}
            {(section === 'new') && (
              <button disabled={busy} style={btn('warn')}
                onClick={e => { e.stopPropagation(); void setStatus('Under Review') }}>
                Under Review
              </button>
            )}
            <button disabled={busy} style={btn('ghost')}
              onClick={e => { e.stopPropagation(); void setStatus('Replied') }}>
              Response Given
            </button>
            <button disabled={busy} style={btn('danger')}
              onClick={e => { e.stopPropagation(); void setStatus('Not Suitable') }}>
              Not Suitable
            </button>
            <button disabled={busy} style={btn('danger')}
              onClick={e => { e.stopPropagation(); void setStatus('Declined') }}>
              Decline
            </button>
            <button disabled={busy} style={btn('ghost')}
              onClick={e => { e.stopPropagation(); void setStatus('Archived') }}>
              Archive
            </button>
          </div>

          {/* ── 2. LEAD DETAILS ── */}
          <DetailRows app={app} />

          {/* ── 3. PAYMENT SETUP ── */}
          <PaymentSection
            app={app}
            section={section}
            approveResult={approveResult}
            onApproveResult={setApproveResult}
            consCode={consCode}
            onConsCode={setConsCode}
            d={d}
            onUpdatePaymentMessage={msg => {
              upd('paymentMessage', msg)
              void saveFields({ paymentMessage: msg }, 'pm')
            }}
          />

          {/* ── 4. RESPONSE & NOTES ── */}
          <ResponseAndNotes
            d={d}
            onUpd={upd}
            onSaveResponse={() => saveFields({ selectedFinalResponse: d.selectedFinalResponse }, 'response')}
            onSaveNote={() => saveFields({ internalNotes: d.internalNotes }, 'note')}
            onSaveReply={() => saveFields({ replyInput: d.replyInput }, 'reply')}
            saving={dSaving}
            saved={dSaved}
            dLoading={dLoading}
          />

          {/* ── 5. INSTAGRAM DM SAFETY ── */}
          {app.instagram && (
            <InstagramDmSafety app={app} />
          )}
        </div>
      )}
    </div>
  )
}

// ── DM Inbox ──────────────────────────────────────────────────

const WINDOW_MS = 24 * 60 * 60 * 1000

interface DmStoryContext {
  mediaType:     string | null
  mediaUrl:      string | null
  caption:       string | null
  aiDescription: string | null
  ocrText:       string | null
}

interface DmItem {
  id:              string
  senderId:        string
  messageText:     string | null
  messageType:     string
  createdAt:       string
  isStoryReply:    boolean
  isStoryMention:  boolean
  storyId:         string | null
  responseText:    string | null
  failedReason:    string | null
  username:        string | null
  displayName:     string | null
  messageCount:    number | null
  notes:           string | null
  conversationOwner:   string | null
  humanTakeoverReason: string | null
  storyContext:    DmStoryContext | null
}

function windowMsRemaining(createdAt: string): number {
  return Math.max(0, new Date(createdAt).getTime() + WINDOW_MS - Date.now())
}

function fmtWindowRemaining(ms: number): string {
  if (ms <= 0) return 'Expired'
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  if (h >= 2) return `${h}h ${m}m`
  if (h === 1) return `1h ${m}m`
  return `${m}m`
}

function StoryTextFallback({ text }: { text: string | null }) {
  if (!text) return null
  return (
    <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span style={{ fontSize: '24px', lineHeight: 1 }}>📖</span>
      <p style={{ margin: 0, fontSize: '12px', color: '#9e8e6a', fontStyle: 'italic' }}>{text}</p>
    </div>
  )
}

function StoryThumbnail({
  mediaUrl, mediaType, fallbackText,
}: {
  mediaUrl:    string
  mediaType:   string | null
  fallbackText: string | null
}) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return <StoryTextFallback text={fallbackText || 'Story media unavailable'} />
  }

  if (mediaType === 'VIDEO') {
    return (
      <div
        style={{ position: 'relative', maxHeight: '180px', overflow: 'hidden', background: '#0d0a04', cursor: 'pointer' }}
        onClick={() => window.open(mediaUrl, '_blank', 'noopener,noreferrer')}
        title="Click to open story video"
      >
        <video
          src={mediaUrl}
          style={{ width: '100%', maxHeight: '180px', objectFit: 'contain', display: 'block' }}
          preload="none"
          muted
          playsInline
          onError={() => setFailed(true)}
        />
        {/* Play icon overlay */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <span style={{ fontSize: '36px', opacity: 0.85 }}>▶️</span>
        </div>
      </div>
    )
  }

  // IMAGE (or unknown type treated as image)
  return (
    <img
      src={mediaUrl}
      alt="Story"
      style={{ width: '100%', maxHeight: '180px', objectFit: 'contain', display: 'block', background: '#0d0a04', cursor: 'pointer' }}
      onClick={() => window.open(mediaUrl, '_blank', 'noopener,noreferrer')}
      title="Click to open full story image"
      onError={() => setFailed(true)}
    />
  )
}

function DmInboxItem({
  item, onRefresh,
}: {
  item:      DmItem
  onRefresh: () => void
}) {
  const [editText,  setEditText]  = useState(item.responseText ?? '')
  const [busy,      setBusy]      = useState<string | null>(null)
  const [err,       setErr]       = useState<string | null>(null)
  const [success,   setSuccess]   = useState<string | null>(null)
  const [expanded,  setExpanded]  = useState(true)

  const msLeft     = windowMsRemaining(item.createdAt)
  const windowOpen = msLeft > 0
  const urgent     = windowOpen && msLeft < 2 * 3_600_000
  const displayName = item.username ? `@${item.username}` : item.displayName || item.senderId

  async function call(
    path: string,
    body: Record<string, string>
  ): Promise<{ ok: boolean; error?: string }> {
    const res = await fetch(path, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    })
    return res.json()
  }

  async function send() {
    if (!editText.trim()) return
    setBusy('send'); setErr(null); setSuccess(null)
    try {
      const data = await call('/api/admin/dm-inbox/send', { id: item.id, finalText: editText })
      if (data.ok) {
        setSuccess('✓ Sent')
        setTimeout(onRefresh, 1200)
      } else {
        setErr(data.error ?? 'Send failed')
      }
    } catch { setErr('Network error') }
    finally { setBusy(null) }
  }

  async function mutate(action: string, extra: Record<string, string> = {}) {
    setBusy(action); setErr(null); setSuccess(null)
    try {
      const data = await call('/api/admin/dm-inbox', { action, id: item.id, senderId: item.senderId, ...extra })
      if (data.ok) {
        if (action === 'reject')            setSuccess('Rejected')
        if (action === 'requeue')           setSuccess('Re-queued for AI')
        if (action === 'retry_send_failed') setSuccess('Reset — re-approve to send')
        if (action === 'takeover')          setSuccess('Taken over — AI paused')
        if (action === 'release')           setSuccess('Released to AI')
        if (action === 'block')             setSuccess('Blocked')
        setTimeout(onRefresh, 1000)
      } else {
        setErr(data.error ?? 'Action failed')
      }
    } catch { setErr('Network error') }
    finally { setBusy(null) }
  }

  const isBusy = busy !== null
  const windowColor = !windowOpen ? '#c0504a' : urgent ? '#b5975a' : '#5a9e6f'

  return (
    <div style={{ ...S.card, borderLeft: `3px solid ${!windowOpen ? '#c0504a' : '#2c2720'}` }}>
      {/* Header */}
      <div style={{ ...S.cardHeader, alignItems: 'center' }} onClick={() => setExpanded(o => !o)}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontWeight: 600, fontSize: '13px', color: '#e8e4de' }}>{displayName}</span>
          {item.isStoryReply && (
            <span style={{ marginLeft: '8px', fontSize: '10px', color: '#fff', background: '#b5975a', borderRadius: '3px', padding: '2px 6px', fontWeight: 700, letterSpacing: '0.04em' }}>
              STORY REPLY
            </span>
          )}
          {item.conversationOwner === 'human_temp' && (
            <span style={{ marginLeft: '8px', fontSize: '10px', color: '#5a9e6f', border: '1px solid #5a9e6f', borderRadius: '3px', padding: '1px 5px' }}>
              Human Hold
            </span>
          )}
          {(item.failedReason === 'IG_SEND_ERROR' || item.failedReason === 'SEND_FAILED') && (
            <span style={{ marginLeft: '8px', fontSize: '10px', color: '#c0504a', border: '1px solid #c0504a', borderRadius: '3px', padding: '1px 5px' }}>
              Send Failed — Safe Retry
            </span>
          )}
          {item.failedReason === 'SENDING' && (
            <span style={{ marginLeft: '8px', fontSize: '10px', color: '#b5975a', border: '1px solid #b5975a', borderRadius: '3px', padding: '1px 5px' }}>
              Sending…
            </span>
          )}
          {item.failedReason === 'SEND_STATUS_UNKNOWN' && (
            <span style={{ marginLeft: '8px', fontSize: '10px', color: '#c0504a', border: '1px solid #c0504a', borderRadius: '3px', padding: '1px 5px', fontWeight: 700 }}>
              ⚠ Unknown — Check IG Outbox
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          <span style={{ fontSize: '11px', color: windowColor, fontWeight: urgent || !windowOpen ? 700 : 400 }}>
            {windowOpen ? `⏱ ${fmtWindowRemaining(msLeft)}` : '⛔ Expired'}
          </span>
          <span style={{ fontSize: '11px', color: '#6b6359' }}>
            {new Date(item.createdAt).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </span>
          <span style={{ color: '#6b6359', fontSize: '11px' }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {expanded && (
        <div style={S.cardBody}>

          {/* ── Story context (only for story replies) ──────────── */}
          {item.isStoryReply && (
            <div style={{ marginBottom: '14px', borderRadius: '6px', border: '1px solid #3a3020', background: '#1a1508', overflow: 'hidden' }}>

              {/* Thumbnail */}
              {item.storyContext?.mediaUrl ? (
                <StoryThumbnail
                  mediaUrl={item.storyContext.mediaUrl}
                  mediaType={item.storyContext.mediaType}
                  fallbackText={item.storyContext.aiDescription || item.storyContext.caption || item.storyContext.ocrText}
                />
              ) : (
                /* No media URL stored — show text fallback if any context exists */
                (item.storyContext?.aiDescription || item.storyContext?.caption || item.storyContext?.ocrText) && (
                  <StoryTextFallback text={item.storyContext.aiDescription || item.storyContext.caption || item.storyContext.ocrText} />
                )
              )}

              {/* Story context / caption — shown separately from inbound DM */}
              {(item.storyContext?.caption || item.storyContext?.ocrText) && (
                <div style={{ padding: '8px 10px', borderTop: item.storyContext?.mediaUrl ? '1px solid #3a3020' : undefined }}>
                  <span style={{ fontSize: '10px', color: '#b5975a', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block', marginBottom: '3px' }}>
                    Story Caption
                  </span>
                  <p style={{ margin: 0, fontSize: '12px', color: '#c8b88a', direction: 'rtl', textAlign: 'right', whiteSpace: 'pre-wrap' }}>
                    {item.storyContext.caption || item.storyContext.ocrText}
                  </p>
                </div>
              )}

              {/* AI scene description (shown only when no caption, as supplementary context) */}
              {!item.storyContext?.caption && !item.storyContext?.ocrText && item.storyContext?.aiDescription && (
                <div style={{ padding: '8px 10px' }}>
                  <span style={{ fontSize: '10px', color: '#b5975a', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block', marginBottom: '3px' }}>
                    Story Context
                  </span>
                  <p style={{ margin: 0, fontSize: '12px', color: '#9e8e6a', fontStyle: 'italic' }}>
                    {item.storyContext.aiDescription}
                  </p>
                </div>
              )}

              {/* No story_context row found — show minimal notice */}
              {!item.storyContext && (
                <div style={{ padding: '8px 10px' }}>
                  <span style={{ fontSize: '11px', color: '#6b6359' }}>Story context not available</span>
                </div>
              )}
            </div>
          )}

          {/* Inbound message */}
          <span style={S.label}>Their Message</span>
          <p style={{ ...S.value, whiteSpace: 'pre-wrap', lineHeight: 1.65, marginTop: '2px', direction: 'rtl', textAlign: 'right', background: '#0e0c0a', padding: '8px 10px', borderRadius: '4px', border: '1px solid #2c2720' }}>
            {item.messageText || <em style={{ color: '#6b6359' }}>(no text — {item.messageType})</em>}
          </p>

          {/* AI Draft — editable */}
          <span style={{ ...S.label, marginTop: '12px' }}>
            AI Draft
            <span style={{ color: '#6b6359', fontWeight: 400, marginLeft: '6px' }}>(edit before sending)</span>
          </span>
          {windowOpen ? (
            <textarea
              value={editText}
              onChange={e => setEditText(e.target.value)}
              rows={5}
              style={{ ...S.textarea, direction: 'rtl', lineHeight: 1.7, marginTop: '4px' }}
              placeholder="AI draft will appear here…"
            />
          ) : (
            <p style={{ ...S.value, whiteSpace: 'pre-wrap', lineHeight: 1.65, marginTop: '2px', color: '#6b6359', fontStyle: 'italic', background: '#0e0c0a', padding: '8px 10px', borderRadius: '4px', border: '1px solid #2c2720' }}>
              {item.responseText || '—'}
            </p>
          )}

          {/* Metadata */}
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '8px' }}>
            {item.messageCount !== null && (
              <span style={{ fontSize: '11px', color: '#6b6359' }}>
                <span style={{ color: '#9e9289' }}>Messages from them:</span> {item.messageCount}
              </span>
            )}
            <span style={{ fontSize: '11px', color: '#6b6359' }}>
              <span style={{ color: '#9e9289' }}>Sender ID:</span> {item.senderId}
            </span>
            {item.conversationOwner && (
              <span style={{ fontSize: '11px', color: '#6b6359' }}>
                <span style={{ color: '#9e9289' }}>Owner:</span> {item.conversationOwner}
                {item.humanTakeoverReason ? ` (${item.humanTakeoverReason})` : ''}
              </span>
            )}
          </div>

          {/* Will send preview — live mirror of editText shown only when window is open */}
          {windowOpen && editText.trim() && (
            <div style={{ marginTop: '10px', padding: '8px 10px', background: '#0a1a0f', border: '1px solid #2a4a30', borderRadius: '4px' }}>
              <span style={{ fontSize: '10px', color: '#5a9e6f', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                Will send:
              </span>
              <p style={{ margin: 0, fontSize: '12px', color: '#c8e0cc', whiteSpace: 'pre-wrap', direction: 'rtl', textAlign: 'right', lineHeight: 1.65 }}>
                {editText.trim()}
              </p>
            </div>
          )}

          {/* Feedback */}
          {err     && <p style={{ color: '#c0504a', fontSize: '11px', marginTop: '8px', margin: '8px 0 0' }}>{err}</p>}
          {success && <p style={{ color: '#5a9e6f', fontSize: '11px', marginTop: '8px', margin: '8px 0 0' }}>{success}</p>}

          {/* Actions */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #1e1c19', alignItems: 'center' }}>

            {/* Primary: Approve & Send */}
            {windowOpen && (
              <button
                disabled={isBusy || !editText.trim()}
                onClick={() => { void send() }}
                style={{
                  ...btn('primary'),
                  opacity: (isBusy || !editText.trim()) ? 0.5 : 1,
                  padding: '5px 14px',
                  fontSize: '12px',
                }}
              >
                {busy === 'send' ? '…' : 'Approve & Send'}
              </button>
            )}

            {!windowOpen && (
              <span style={{ fontSize: '11px', color: '#c0504a', fontWeight: 600, padding: '5px 0' }}>
                Window closed — cannot send
              </span>
            )}

            {/* Retry — only for definitive IG failure (IG never sent) */}
            {(item.failedReason === 'IG_SEND_ERROR' || item.failedReason === 'SEND_FAILED') && (
              <button
                disabled={isBusy}
                onClick={() => {
                  if (!window.confirm('Reset this failed send attempt? You will need to re-approve before it sends.')) return
                  void mutate('retry_send_failed')
                }}
                style={{ ...btn('warn'), fontSize: '12px' }}
              >
                {busy === 'retry_send_failed' ? '…' : 'Retry Send'}
              </button>
            )}

            {/* SENDING = in-flight; show status only, no action */}
            {item.failedReason === 'SENDING' && (
              <span style={{ fontSize: '11px', color: '#b5975a', padding: '5px 0' }}>
                Send in progress…
              </span>
            )}

            {/* SEND_STATUS_UNKNOWN = IG outcome uncertain — NON-RESENDABLE */}
            {item.failedReason === 'SEND_STATUS_UNKNOWN' && (
              <div style={{ background: '#1c100a', border: '1px solid #c0504a', borderRadius: '4px', padding: '8px 10px', fontSize: '11px', color: '#c0504a', lineHeight: 1.5 }}>
                <strong>⚠ Send outcome unknown.</strong> Instagram may or may not have delivered this message.
                Check your <strong>Instagram outbox</strong> before taking any action.
                Do <strong>not</strong> retry via this UI — use Supabase to manually resolve after confirming.
              </div>
            )}

            <span style={{ width: '1px', background: '#2c2720', alignSelf: 'stretch', margin: '0 2px' }} />

            <button disabled={isBusy} onClick={() => mutate('requeue')}
              style={btn('warn')}>
              {busy === 'requeue' ? '…' : 'Regenerate'}
            </button>

            <button disabled={isBusy} onClick={() => mutate('reject')}
              style={btn('ghost')}>
              {busy === 'reject' ? '…' : 'Reject'}
            </button>

            <span style={{ width: '1px', background: '#2c2720', alignSelf: 'stretch', margin: '0 2px' }} />

            {item.conversationOwner !== 'human_temp' ? (
              <button disabled={isBusy} onClick={() => mutate('takeover')}
                style={btn('ghost')}>
                {busy === 'takeover' ? '…' : 'Take Over'}
              </button>
            ) : (
              <button disabled={isBusy} onClick={() => mutate('release')}
                style={{ ...btn('ghost'), color: '#5a9e6f', borderColor: '#5a9e6f' }}>
                {busy === 'release' ? '…' : 'Release to AI'}
              </button>
            )}

            <button disabled={isBusy} onClick={() => {
              if (!window.confirm(`Block ${displayName}? AI will never reply to them again.`)) return
              void mutate('block', { displayName: item.displayName || item.senderId })
            }}
              style={btn('danger')}>
              {busy === 'block' ? '…' : 'Block'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function DmInbox() {
  const [items,   setItems]   = useState<DmItem[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [err,     setErr]     = useState<string | null>(null)
  const [igConfigured, setIgConfigured] = useState<boolean | null>(null)

  async function load() {
    setLoading(true); setErr(null)
    try {
      const res  = await fetch('/api/admin/dm-inbox')
      const data = await res.json()
      if (!res.ok) { setErr(data.error || 'Failed to load'); return }
      setItems(data.items)
      // Detect if IG is configured by checking for a specific response shape
      // (we don't expose whether the env var is set, just whether items loaded)
      setIgConfigured(true)
    } catch { setErr('Network error') }
    finally { setLoading(false) }
  }

  useEffect(() => { void load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const pending  = (items ?? []).filter(i => windowMsRemaining(i.createdAt) > 0)
  const expired  = (items ?? []).filter(i => windowMsRemaining(i.createdAt) <= 0)
  const urgent   = pending.filter(i => windowMsRemaining(i.createdAt) < 2 * 3_600_000)
  const oldest   = pending.length > 0
    ? new Date(Math.min(...pending.map(i => new Date(i.createdAt).getTime())))
    : null

  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px', marginTop: '28px', paddingBottom: '4px', borderBottom: '1px solid #2c2720' }}>
        <h2 style={{ ...S.sectionHead, margin: 0, borderBottom: 'none', paddingBottom: 0 }}>
          DM REVIEW INBOX
        </h2>
        {items !== null && (
          <span style={{ fontSize: '11px', color: '#6b6359' }}>
            {pending.length} pending
            {urgent.length > 0 && <span style={{ color: '#b5975a', marginLeft: '8px', fontWeight: 700 }}>⚠ {urgent.length} urgent</span>}
            {expired.length > 0 && <span style={{ color: '#c0504a', marginLeft: '8px' }}>{expired.length} expired</span>}
          </span>
        )}
        <button onClick={load} disabled={loading}
          style={{ ...btn('ghost'), marginLeft: 'auto', fontSize: '11px' }}>
          {loading ? '…' : 'Refresh'}
        </button>
      </div>

      {/* Summary bar */}
      {items !== null && items.length > 0 && (
        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', padding: '8px 12px', background: '#100e0c', borderRadius: '4px', border: '1px solid #2c2720', marginBottom: '12px', fontSize: '12px' }}>
          <span><span style={{ color: '#6b6359' }}>Pending: </span><span style={{ color: '#e8e4de', fontWeight: 600 }}>{pending.length}</span></span>
          {urgent.length > 0 && (
            <span><span style={{ color: '#6b6359' }}>Urgent (&lt;2h): </span><span style={{ color: '#b5975a', fontWeight: 600 }}>{urgent.length}</span></span>
          )}
          {oldest && (
            <span><span style={{ color: '#6b6359' }}>Oldest: </span><span style={{ color: '#e8e4de' }}>{new Date(oldest).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span></span>
          )}
          {expired.length > 0 && (
            <span><span style={{ color: '#6b6359' }}>Expired: </span><span style={{ color: '#c0504a', fontWeight: 600 }}>{expired.length}</span></span>
          )}
        </div>
      )}

      {err     && <p style={{ color: '#c0504a', fontSize: '12px' }}>{err}</p>}
      {loading && !items && <p style={{ color: '#6b6359', fontSize: '12px' }}>Loading…</p>}
      {items   && items.length === 0 && (
        <p style={{ color: '#6b6359', fontSize: '12px' }}>No drafts waiting for review.</p>
      )}

      {igConfigured === false && (
        <div style={{ padding: '10px 12px', background: '#1a1000', border: '1px solid #b5975a', borderRadius: '4px', marginBottom: '10px', fontSize: '12px', color: '#b5975a' }}>
          ⚠ Instagram sending is not configured — Approve & Send will be unavailable until the server environment is set up.
        </div>
      )}

      {/* Pending items */}
      {pending.map(item => (
        <DmInboxItem key={item.id} item={item} onRefresh={load} />
      ))}

      {/* Expired items — show for reject/archive only */}
      {expired.length > 0 && (
        <>
          <div style={{ fontSize: '11px', color: '#6b6359', margin: '16px 0 6px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Window Expired — Reject Only
          </div>
          {expired.map(item => (
            <DmInboxItem key={item.id} item={item} onRefresh={load} />
          ))}
        </>
      )}
    </section>
  )
}

// ── DM Access Control (full page section) ─────────────────────
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

const STATUS_LABEL: Record<AccessStatus, string> = { ai_allowed: 'AI', human_only: 'Human', blocked: 'Ignore' }
const STATUS_ICON:  Record<AccessStatus, string> = { ai_allowed: '🤖', human_only: '👤', blocked: '🚫' }
const STATUS_HELP:  Record<AccessStatus, string> = {
  ai_allowed:  'The AI replies normally.',
  human_only:  'The AI never replies. I reply manually.',
  blocked:     'Neither the AI nor I will respond.',
}
const STATUS_COLOR: Record<AccessStatus, string> = {
  ai_allowed: '#5a9e6f', human_only: '#b5975a', blocked: '#c0504a',
}

function rowKey(row: AccessRuleRow): string { return row.handle ?? row.senderId ?? '' }
function fmtRuleDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

function DmAccessControl() {
  const [rows,      setRows]      = useState<AccessRuleRow[] | null>(null)
  const [search,    setSearch]    = useState('')
  const [newHandle, setNewHandle] = useState('')
  const [busyKey,   setBusyKey]   = useState<string | null>(null)
  const [err,       setErr]       = useState<string | null>(null)

  async function load() {
    setErr(null)
    try {
      const res = await fetch('/api/admin/manual-dm-control')
      const data = await res.json()
      if (!res.ok) { setErr(data.error || 'Failed to load'); return }
      setRows(data.rules)
    } catch { setErr('Network error') }
  }

  useEffect(() => { void load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function setStatus(rawHandle: string, status: AccessStatus) {
    const handle = rawHandle.trim().replace(/^@/, '').toLowerCase()
    setBusyKey(handle); setErr(null)
    try {
      const res = await fetch('/api/admin/manual-dm-control', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'set-status', handle, status }),
      })
      const data = await res.json()
      if (!res.ok) { setErr(data.error || 'Failed to update'); return }
      await load(); setNewHandle('')
    } catch { setErr('Network error') }
    finally { setBusyKey(null) }
  }

  async function remove(row: AccessRuleRow) {
    const key = rowKey(row)
    setBusyKey(key); setErr(null)
    try {
      const res = await fetch('/api/admin/manual-dm-control', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(
          row.legacy ? { action: 'remove', senderId: row.senderId } : { action: 'remove', handle: row.handle }
        ),
      })
      const data = await res.json()
      if (!res.ok) { setErr(data.error || 'Failed to remove'); return }
      setRows(prev => prev?.filter(r => rowKey(r) !== key) ?? prev)
    } catch { setErr('Network error') }
    finally { setBusyKey(null) }
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
        <input type="text" placeholder="@instagram_handle" value={newHandle}
          onChange={e => { setNewHandle(e.target.value); setErr(null) }}
          style={{ ...S.input, width: '260px', marginTop: '4px' }}
        />
        <div style={{ marginTop: '14px' }}>
          <span style={S.label}>Access Mode</span>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
            {(['ai_allowed', 'human_only', 'blocked'] as const).map(s => (
              <button key={s} disabled={!!busyKey || !newHandle.trim()} onClick={() => setStatus(newHandle, s)}
                style={{ padding: '6px 14px', fontSize: '12px', fontWeight: 600,
                  border: `1px solid ${STATUS_COLOR[s]}`, borderRadius: '4px',
                  background: 'transparent', color: STATUS_COLOR[s], cursor: 'pointer',
                  opacity: addBusy ? 0.5 : 1 }}>
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

      <input type="text" placeholder="Search by handle or sender ID…" value={search}
        onChange={e => setSearch(e.target.value)} style={{ ...S.input, marginBottom: '10px' }} />

      {err    && <p style={{ color: '#c0504a', fontSize: '12px' }}>{err}</p>}
      {!rows  && !err && <p style={{ color: '#6b6359', fontSize: '12px' }}>Loading…</p>}
      {rows   && filtered.length === 0 && (
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
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px',
                flexWrap: 'wrap', borderTop: i === 0 ? 'none' : '1px solid #2c2720' }}>
                <div style={{ flex: '1 1 140px', minWidth: 0 }}>
                  <span style={S.label}>Handle</span>
                  <div style={S.value}>{row.handle || '—'}</div>
                </div>
                <div style={{ flex: '1 1 140px', minWidth: 0 }}>
                  <span style={S.label}>Sender ID</span>
                  <div style={{ ...S.value, fontSize: '11px', color: '#9e9289', wordBreak: 'break-all' }}>{row.senderId || '—'}</div>
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
                    <span style={{ display: 'inline-block', padding: '2px 8px', fontSize: '11px', fontWeight: 700,
                      borderRadius: '10px', border: `1px solid ${STATUS_COLOR[row.status]}`,
                      background: STATUS_COLOR[row.status] + '22', color: STATUS_COLOR[row.status], whiteSpace: 'nowrap' }}>
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
                <div style={{ flex: '1 1 100%', display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                  {(['ai_allowed', 'human_only', 'blocked'] as const).map(s => {
                    const active = s === row.status
                    return (
                      <button key={s} disabled={row.legacy || busy} onClick={() => setStatus(row.handle!, s)}
                        style={{ padding: '3px 10px', fontSize: '11px', fontWeight: active ? 700 : 400,
                          border: `1px solid ${active ? STATUS_COLOR[s] : '#2c2720'}`,
                          borderRadius: '4px',
                          background: active ? STATUS_COLOR[s] + '22' : 'transparent',
                          color: active ? STATUS_COLOR[s] : '#9e9289',
                          cursor: (row.legacy || busy) ? 'default' : 'pointer',
                          opacity: row.legacy ? 0.4 : 1 }}>
                        {STATUS_ICON[s]} {STATUS_LABEL[s]}
                      </button>
                    )
                  })}
                  <button disabled={busy} onClick={() => remove(row)}
                    style={{ ...btn('ghost'), opacity: busy ? 0.5 : 1, marginLeft: 'auto' }}>
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
function Section({ title, apps, section, onRefresh }: {
  title:     string
  apps:      App[]
  section:   'new' | 'underReview' | 'approved' | 'claimed' | 'paid'
  onRefresh: () => void
}) {
  return (
    <section>
      <h2 style={S.sectionHead}>{title} ({apps.length})</h2>
      {apps.length === 0
        ? <p style={{ color: '#6b6359', fontSize: '12px' }}>None.</p>
        : apps.map(app => (
            <AppCard key={app.pageId} app={app} section={section} onRefresh={onRefresh} />
          ))
      }
    </section>
  )
}

// ── Main page ─────────────────────────────────────────────────
export default function AdminPage() {
  const [loggedIn,  setLoggedIn]  = useState<boolean | null>(null) // null = checking
  const [inputPw,   setInputPw]   = useState('')
  const [pwErr,     setPwErr]     = useState('')
  const [loginBusy, setLoginBusy] = useState(false)
  const [data,      setData]      = useState<DashboardData | null>(null)
  const [loading,   setLoading]   = useState(false)
  const [fetchErr,  setFetchErr]  = useState('')

  // Probe session on mount — no password in browser, just check if cookie is valid
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/admin/consultation/list')
        if (res.status === 401) { setLoggedIn(false); return }
        if (res.ok) { setLoggedIn(true); setData(await res.json()) }
        else { setLoggedIn(false) }
      } catch { setLoggedIn(false) }
    })()
  }, [])

  async function load() {
    setLoading(true); setFetchErr('')
    try {
      const res = await fetch('/api/admin/consultation/list')
      if (res.status === 401) { setLoggedIn(false); return }
      if (!res.ok) { setFetchErr('Failed to load'); return }
      setData(await res.json())
    } catch { setFetchErr('Network error') }
    finally { setLoading(false) }
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault()
    setLoginBusy(true); setPwErr('')
    try {
      const res = await fetch('/api/admin/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ password: inputPw }),
      })
      if (res.status === 401) { setPwErr('Incorrect password'); return }
      if (!res.ok) { setPwErr('Login failed — try again'); return }
      // Cookie is now set server-side (HttpOnly). Clear the local input.
      setInputPw('')
      setLoggedIn(true)
      void load()
    } catch { setPwErr('Network error') }
    finally { setLoginBusy(false) }
  }

  async function handleLogout() {
    await fetch('/api/admin/logout', { method: 'POST' })
    setLoggedIn(false)
    setData(null)
  }

  // Still checking session
  if (loggedIn === null) {
    return (
      <main style={{ ...S.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#6b6359', fontSize: '12px' }}>…</p>
      </main>
    )
  }

  if (!loggedIn) {
    return (
      <main style={{ ...S.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <form onSubmit={handleLogin} style={{ width: '280px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <p style={{ color: '#6b6359', fontSize: '11px', letterSpacing: '0.1em', marginBottom: '4px' }}>ADMIN</p>
          <input type="password" value={inputPw} autoFocus required
            onChange={e => setInputPw(e.target.value)} placeholder="Password" style={S.input} />
          {pwErr && <p style={{ color: '#c0504a', fontSize: '11px', margin: 0 }}>{pwErr}</p>}
          <button type="submit" disabled={loginBusy} style={btn('primary')}>
            {loginBusy ? '…' : 'Enter'}
          </button>
        </form>
      </main>
    )
  }

  return (
    <main style={S.page}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ color: '#6b6359', fontSize: '11px', letterSpacing: '0.1em' }}>CONSULTATION ADMIN</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={load} style={btn('ghost')}>{loading ? '…' : 'Refresh'}</button>
          <button onClick={handleLogout} style={btn('ghost')}>Sign Out</button>
        </div>
      </div>

      {fetchErr && <p style={{ color: '#c0504a', fontSize: '12px' }}>{fetchErr}</p>}
      {loading && !data && <p style={{ color: '#6b6359', fontSize: '12px' }}>Loading…</p>}

      <DmInbox />
      <DmAccessControl />

      {data && (
        <>
          <Section title="New Applications"             apps={data.new}         section="new"         onRefresh={load} />
          <Section title="Under Review"                 apps={data.underReview} section="underReview" onRefresh={load} />
          <Section title="Approved / Payment Sent"      apps={data.approved}    section="approved"    onRefresh={load} />
          <Section title="Awaiting Manual Confirmation" apps={data.claimed}     section="claimed"     onRefresh={load} />
          <Section title="Paid / Completed"             apps={data.paid}        section="paid"        onRefresh={load} />
        </>
      )}
    </main>
  )
}
