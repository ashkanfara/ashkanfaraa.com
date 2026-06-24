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
    if (status === 'Declined' || status === 'Archived') {
      if (!window.confirm(`Mark as ${status}?`)) return
    }
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

      {/* ── DM Control (always visible) ── */}
      <DmControl app={app} password={password} />

      {/* ── DM Blocklist (always visible) ── */}
      <BlocklistControl app={app} password={password} />

      {/* ── Expanded body ── */}
      {isExpanded && (
        <div style={S.cardBody}>
          <DetailRows app={app} />

          {/* Claimed section: show claim details */}
          {section === 'claimed' && app.paymentClaim && (
            <div style={{ marginTop: '10px', padding: '8px', background: '#0e0c0a', borderRadius: '4px', border: '1px solid #2c2720' }}>
              <span style={S.label}>Payment Claim</span>
              <span style={{ ...S.value, display: 'block' }}>{app.paymentClaim}</span>
              <span style={{ color: '#6b6359', fontSize: '11px' }}>{methodLabel(app.paymentMethod)}</span>
            </div>
          )}

          {/* Approved section: show payment details */}
          {(section === 'approved' || approveResult) && (
            <ApprovalDetails app={app} result={approveResult} />
          )}

          {/* Paid section: show CONS code */}
          {section === 'paid' && (app.consCode || consCode) && (
            <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ color: '#b5975a', fontWeight: 600, fontSize: '15px' }}>
                {consCode || app.consCode}
              </span>
              <CopyBtn value={consCode || app.consCode} label="Copy CONS" />
            </div>
          )}

          {/* Approve form */}
          {mode === 'approve' && !approveResult && (
            <ApproveForm
              app={app}
              password={password}
              onDone={result => { setApproveResult(result); setMode('details') }}
            />
          )}

          {/* Confirm payment (claimed section) */}
          {section === 'claimed' && (
            <ConfirmPayment
              app={app}
              password={password}
              onDone={code => { setConsCode(code); onRefresh() }}
            />
          )}

          {/* ── Actions ── */}
          <div style={S.actions}>
            {(section === 'new' || section === 'underReview') && (
              <>
                {mode !== 'approve' && !approveResult && (
                  <button style={btn('primary')} onClick={e => { e.stopPropagation(); setMode('approve') }}>
                    Approve
                  </button>
                )}
                {section === 'new' && (
                  <button disabled={busy} style={btn('warn')} onClick={e => { e.stopPropagation(); setStatus('Under Review') }}>
                    Under Review
                  </button>
                )}
                <button disabled={busy} style={btn('danger')} onClick={e => { e.stopPropagation(); setStatus('Declined') }}>
                  Decline
                </button>
                <button disabled={busy} style={btn('ghost')} onClick={e => { e.stopPropagation(); setStatus('Archived') }}>
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
