'use client'

/**
 * /admin
 *
 * Private admin dashboard for managing consultation applications.
 * Password-protected via ADMIN_SECRET (stored in sessionStorage).
 *
 * Section A: New applications → Approve with price/method/expiry
 * Section B: Claimed payments → Confirm and receive CONS code
 */

import { useState, useEffect, FormEvent } from 'react'

// ── Types ─────────────────────────────────────────────────────
interface Application {
  pageId:           string
  name:             string
  email:            string
  location:         string
  subject:          string
  submittedAt:      string
  paymentStatus:    string
  paymentClaim:     string
  paymentMethod:    string
  approvedPrice:    number | null
  approvedCurrency: string
  status:           string
}

interface ApproveResult {
  paymentLink: string
  dmMessage:   string
}

interface ConfirmResult {
  consCode: string
}

// ── Styles ────────────────────────────────────────────────────
const card: React.CSSProperties = {
  background:   'var(--surface-raised)',
  border:       '1px solid var(--border)',
  borderRadius: '0.75rem',
  padding:      '1.25rem 1.5rem',
  marginBottom: '1rem',
}

const inputStyle: React.CSSProperties = {
  width:        '100%',
  background:   'var(--surface)',
  border:       '1px solid var(--border)',
  borderRadius: '0.5rem',
  padding:      '0.6rem 0.75rem',
  fontSize:     '0.875rem',
  color:        'var(--foreground)',
  outline:      'none',
  fontFamily:   'inherit',
  boxSizing:    'border-box',
}

const btn = (variant: 'primary' | 'ghost' = 'primary'): React.CSSProperties => ({
  display:       'inline-flex',
  alignItems:    'center',
  borderRadius:  '9999px',
  border:        variant === 'ghost' ? '1px solid var(--border)' : 'none',
  background:    variant === 'ghost' ? 'transparent' : 'var(--accent)',
  color:         variant === 'ghost' ? 'var(--muted)'  : 'var(--accent-fg)',
  padding:       '0.5rem 1.25rem',
  fontSize:      '0.8rem',
  fontWeight:    600,
  cursor:        'pointer',
  letterSpacing: '0.03em',
  whiteSpace:    'nowrap' as const,
})

const label: React.CSSProperties = {
  display:      'block',
  fontSize:     '0.72rem',
  color:        'var(--muted)',
  marginBottom: '0.3rem',
  letterSpacing:'0.02em',
}

function CopyBox({ value, label: lbl }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <div style={{ marginTop: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
        <span style={{ fontSize: '0.72rem', color: 'var(--muted)', letterSpacing: '0.04em' }}>{lbl}</span>
        <button onClick={copy} style={btn('ghost')}>{copied ? '✓ Copied' : 'Copy'}</button>
      </div>
      <textarea
        readOnly
        value={value}
        rows={value.includes('\n') ? 8 : 2}
        style={{ ...inputStyle, resize: 'none', fontFamily: 'monospace', fontSize: '0.8rem', direction: 'rtl' }}
      />
    </div>
  )
}

// ── Approve form ──────────────────────────────────────────────
function ApproveForm({
  app,
  password,
  onDone,
}: {
  app:      Application
  password: string
  onDone:   () => void
}) {
  const [price,      setPrice]      = useState('')
  const [currency,   setCurrency]   = useState('AUD')
  const [method,     setMethod]     = useState('paypal')
  const [expiryDays, setExpiryDays] = useState('7')
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState('')
  const [result,     setResult]     = useState<ApproveResult | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!price || isNaN(Number(price))) { setError('Enter a valid price'); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/consultation/approve', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${password}` },
        body:    JSON.stringify({
          pageId:     app.pageId,
          name:       app.name,
          price:      Number(price),
          currency:   method === 'manual_ir' ? 'IRR' : currency,
          method,
          expiryDays: Number(expiryDays),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed'); return }
      setResult(data)
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  if (result) {
    return (
      <div>
        <CopyBox value={result.paymentLink} label="PAYMENT LINK" />
        <CopyBox value={result.dmMessage}   label="PERSIAN DM" />
        <button onClick={onDone} style={{ ...btn('ghost'), marginTop: '1rem' }}>Done</button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: method === 'manual_ir' ? '1fr' : '1fr 1fr', gap: '0.5rem' }}>
        <div>
          <span style={label}>{method === 'manual_ir' ? 'Price (Toman تومان)' : 'Price'}</span>
          <input type="number" step="1" min="1" value={price} onChange={e => setPrice(e.target.value)}
            placeholder={method === 'manual_ir' ? '17000000' : '250'} required style={inputStyle} />
        </div>
        {method !== 'manual_ir' && (
          <div>
            <span style={label}>Currency</span>
            <select value={currency} onChange={e => setCurrency(e.target.value)} style={inputStyle}>
              <option value="AUD">AUD</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
        <div>
          <span style={label}>Payment Method</span>
          <select value={method} onChange={e => setMethod(e.target.value)} style={inputStyle}>
            <option value="paypal">PayPal (INT)</option>
            <option value="manual_ir">Manual IR (Card)</option>
            <option value="manual_au">Manual AU (Bank)</option>
          </select>
        </div>
        <div>
          <span style={label}>Link Expiry</span>
          <select value={expiryDays} onChange={e => setExpiryDays(e.target.value)} style={inputStyle}>
            <option value="3">3 days</option>
            <option value="7">7 days</option>
            <option value="14">14 days</option>
          </select>
        </div>
      </div>

      {error && <p style={{ fontSize: '0.8rem', color: 'var(--error, #e05)' }}>{error}</p>}

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button type="submit" disabled={loading} style={btn()}>{loading ? '...' : 'Approve & Generate Link'}</button>
        <button type="button" onClick={onDone} style={btn('ghost')}>Cancel</button>
      </div>
    </form>
  )
}

// ── Confirm button ─────────────────────────────────────────────
function ConfirmButton({
  app,
  password,
  onDone,
}: {
  app:      Application
  password: string
  onDone:   () => void
}) {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [consCode,setConsCode]= useState('')

  async function handleConfirm() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/consultation/confirm', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${password}` },
        body:    JSON.stringify({ pageId: app.pageId, method: app.paymentMethod }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed'); return }
      setConsCode(data.consCode)
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  if (consCode) {
    return (
      <div>
        <CopyBox value={consCode} label="CONS CODE — send this to the client" />
        <button onClick={onDone} style={{ ...btn('ghost'), marginTop: '0.75rem' }}>Done</button>
      </div>
    )
  }

  return (
    <div>
      {error && <p style={{ fontSize: '0.8rem', color: 'var(--error, #e05)', marginBottom: '0.5rem' }}>{error}</p>}
      <button onClick={handleConfirm} disabled={loading} style={btn()}>
        {loading ? '...' : 'Confirm Payment & Generate CONS'}
      </button>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────
export default function AdminPage() {
  const [password,    setPassword]    = useState('')
  const [inputPw,     setInputPw]     = useState('')
  const [pwError,     setPwError]     = useState('')
  const [loading,     setLoading]     = useState(false)
  const [newApps,     setNewApps]     = useState<Application[]>([])
  const [claimedApps, setClaimedApps] = useState<Application[]>([])
  const [fetchError,  setFetchError]  = useState('')
  const [expanded,    setExpanded]    = useState<string | null>(null)

  useEffect(() => {
    const saved = sessionStorage.getItem('adminPw')
    if (saved) { setPassword(saved); void fetchData(saved) }
  }, [])

  async function fetchData(pw: string) {
    setLoading(true)
    setFetchError('')
    try {
      const res = await fetch('/api/admin/consultation/list', {
        headers: { Authorization: `Bearer ${pw}` },
      })
      if (res.status === 401) { setPwError('Incorrect password'); sessionStorage.removeItem('adminPw'); setPassword(''); return }
      if (!res.ok) { setFetchError('Failed to load data'); return }
      const data = await res.json()
      setNewApps(data.new ?? [])
      setClaimedApps(data.claimed ?? [])
    } catch {
      setFetchError('Network error')
    } finally {
      setLoading(false)
    }
  }

  function handleLogin(e: FormEvent) {
    e.preventDefault()
    sessionStorage.setItem('adminPw', inputPw)
    setPassword(inputPw)
    void fetchData(inputPw)
  }

  function handleDone(pageId: string) {
    setExpanded(null)
    void fetchData(password)
  }

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  // ── Password screen ───────────────────────────────────────
  if (!password) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <form onSubmit={handleLogin} style={{ width: '100%', maxWidth: '320px', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <p style={{ fontSize: '0.8rem', letterSpacing: '0.1em', color: 'var(--muted)', marginBottom: '0.5rem' }}>ADMIN</p>
          <input
            type="password"
            value={inputPw}
            onChange={e => setInputPw(e.target.value)}
            placeholder="Password"
            autoFocus
            style={inputStyle}
          />
          {pwError && <p style={{ fontSize: '0.8rem', color: 'var(--error, #e05)' }}>{pwError}</p>}
          <button type="submit" style={btn()}>Enter</button>
        </form>
      </main>
    )
  }

  // ── Dashboard ─────────────────────────────────────────────
  const PAD = 'clamp(1rem, 4vw, 3rem)'

  return (
    <main style={{ padding: PAD, maxWidth: '860px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem', paddingTop: '2rem' }}>
        <p style={{ fontSize: '0.7rem', letterSpacing: '0.15em', color: 'var(--muted)' }}>CONSULTATION ADMIN</p>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={() => fetchData(password)} style={btn('ghost')}>Refresh</button>
          <button onClick={() => { sessionStorage.removeItem('adminPw'); setPassword('') }} style={btn('ghost')}>Sign Out</button>
        </div>
      </div>

      {loading && <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Loading...</p>}
      {fetchError && <p style={{ color: 'var(--error, #e05)', fontSize: '0.85rem' }}>{fetchError}</p>}

      {/* ── Section A: New Applications ── */}
      <section style={{ marginBottom: '3rem' }}>
        <p style={{ fontSize: '0.65rem', letterSpacing: '0.18em', color: 'var(--subtle)', marginBottom: '1rem' }}>
          NEW APPLICATIONS ({newApps.length})
        </p>

        {!loading && newApps.length === 0 && (
          <p style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>No new applications.</p>
        )}

        {newApps.map(app => (
          <div key={app.pageId} style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
              <div>
                <p style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.2rem' }}>{app.name}</p>
                <p style={{ fontSize: '0.78rem', color: 'var(--muted)', marginBottom: '0.2rem' }}>{app.email} · {app.location}</p>
                <p style={{ fontSize: '0.78rem', color: 'var(--subtle)' }}>{app.subject.slice(0, 80)}{app.subject.length > 80 ? '…' : ''}</p>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p style={{ fontSize: '0.72rem', color: 'var(--subtle)' }}>{formatDate(app.submittedAt)}</p>
                {expanded !== app.pageId && (
                  <button onClick={() => setExpanded(app.pageId)} style={{ ...btn(), marginTop: '0.5rem' }}>
                    Approve
                  </button>
                )}
              </div>
            </div>

            {expanded === app.pageId && (
              <ApproveForm
                app={app}
                password={password}
                onDone={() => handleDone(app.pageId)}
              />
            )}
          </div>
        ))}
      </section>

      {/* ── Section B: Claimed Payments ── */}
      <section>
        <p style={{ fontSize: '0.65rem', letterSpacing: '0.18em', color: 'var(--subtle)', marginBottom: '1rem' }}>
          AWAITING CONFIRMATION ({claimedApps.length})
        </p>

        {!loading && claimedApps.length === 0 && (
          <p style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>No pending confirmations.</p>
        )}

        {claimedApps.map(app => (
          <div key={app.pageId} style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
              <div>
                <p style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.2rem' }}>{app.name}</p>
                <p style={{ fontSize: '0.78rem', color: 'var(--muted)', marginBottom: '0.2rem' }}>
                  {app.paymentMethod === 'manual_ir' ? 'IR Card Transfer' : 'AU Bank Transfer'}
                  {app.approvedPrice ? ` · ${app.approvedPrice} ${app.approvedCurrency}` : ''}
                </p>
                {app.paymentClaim && (
                  <p style={{ fontSize: '0.78rem', color: 'var(--foreground)', background: 'var(--surface)', padding: '0.25rem 0.5rem', borderRadius: '0.35rem', display: 'inline-block', marginTop: '0.25rem' }}>
                    Claim: {app.paymentClaim}
                  </p>
                )}
              </div>
              <div style={{ flexShrink: 0 }}>
                {expanded !== app.pageId && (
                  <button onClick={() => setExpanded(app.pageId)} style={btn()}>
                    Confirm Payment
                  </button>
                )}
              </div>
            </div>

            {expanded === app.pageId && (
              <div style={{ marginTop: '1rem' }}>
                <ConfirmButton
                  app={app}
                  password={password}
                  onDone={() => handleDone(app.pageId)}
                />
              </div>
            )}
          </div>
        ))}
      </section>
    </main>
  )
}
