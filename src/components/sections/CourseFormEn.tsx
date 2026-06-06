'use client'

import { useState } from 'react'

const inputStyle: React.CSSProperties = {
  width:        '100%',
  background:   'var(--surface-raised)',
  border:       '1px solid var(--border)',
  borderRadius: '0.625rem',
  padding:      '0.875rem 1rem',
  fontSize:     '0.9rem',
  color:        'var(--foreground)',
  lineHeight:   1.5,
  outline:      'none',
  transition:   'border-color 0.15s',
  fontFamily:   'inherit',
  direction:    'ltr',
  boxSizing:    'border-box',
}

const labelStyle: React.CSSProperties = {
  display:       'block',
  fontSize:      '0.75rem',
  color:         'var(--muted)',
  marginBottom:  '0.5rem',
  letterSpacing: '0.02em',
}

function validate(id: string, val: string): string | null {
  if (id === 'name')  return val.trim().length < 2                          ? 'Name is required' : null
  if (id === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim()) ? null : 'Enter a valid email address'
  if (id === 'phone') return val.trim().length < 5                          ? 'Mobile number is required' : null
  return null
}

const REQUIRED = ['name', 'email', 'phone']

const FIELDS = [
  { id: 'name',      label: 'Full name',         type: 'text'  as const, required: true,  placeholder: '' },
  { id: 'email',     label: 'Email address',     type: 'email' as const, required: true,  placeholder: '' },
  { id: 'instagram', label: 'Instagram handle',  type: 'text'  as const, required: false, placeholder: '@' },
  { id: 'telegram',  label: 'Telegram username', type: 'text'  as const, required: false, placeholder: '@' },
  { id: 'phone',     label: 'Mobile number',     type: 'tel'   as const, required: true,  placeholder: '+61 ...' },
]

export function CourseFormEn() {
  const [values,  setValues]  = useState<Record<string, string>>({})
  const [touched, setTouched] = useState<Set<string>>(new Set())
  const [focused, setFocused] = useState<string | null>(null)
  const [loading, setLoading] = useState<'stripe' | 'paypal' | null>(null)
  const [error,   setError]   = useState<string | null>(null)

  const isValid = REQUIRED.every(id => validate(id, values[id] ?? '') === null)

  function borderColor(id: string) {
    const err = validate(id, values[id] ?? '')
    if (touched.has(id) && err) return 'rgba(192,100,60,0.7)'
    if (focused === id)         return 'var(--accent)'
    return 'var(--border)'
  }

  async function handlePay(provider: 'stripe' | 'paypal') {
    setTouched(new Set(REQUIRED))
    if (!isValid) return

    setLoading(provider)
    setError(null)

    const endpoint = provider === 'stripe'
      ? '/api/en/stripe/checkout'
      : '/api/en/paypal/create-order'

    try {
      const res = await fetch(endpoint, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:      values.name      ?? '',
          email:     values.email     ?? '',
          instagram: values.instagram ?? '',
          telegram:  values.telegram  ?? '',
          phone:     values.phone     ?? '',
        }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok || !data.url) {
        throw new Error(data.error ?? 'Payment is currently unavailable. Please try again.')
      }

      window.location.href = data.url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setLoading(null)
    }
  }

  return (
    <div style={{ maxWidth: '480px' }}>

      {/* Fields */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '2rem' }}>
        {FIELDS.map(f => {
          const err     = validate(f.id, values[f.id] ?? '')
          const showErr = touched.has(f.id) && err !== null
          return (
            <div key={f.id}>
              <label htmlFor={f.id} style={labelStyle}>
                {f.label}
                {f.required && <span style={{ color: 'var(--accent)', marginLeft: '0.2rem', opacity: 0.8 }}>*</span>}
              </label>
              <input
                id={f.id}
                name={f.id}
                type={f.type}
                placeholder={f.placeholder}
                value={values[f.id] ?? ''}
                onChange={e => setValues(p => ({ ...p, [f.id]: e.target.value }))}
                onFocus={() => setFocused(f.id)}
                onBlur={() => { setFocused(null); setTouched(p => new Set([...p, f.id])) }}
                style={{ ...inputStyle, borderColor: borderColor(f.id) }}
              />
              {showErr && (
                <p style={{ marginTop: '0.4rem', fontSize: '0.72rem', color: 'rgba(200,110,70,0.9)', lineHeight: 1.5 }}>
                  {err}
                </p>
              )}
            </div>
          )
        })}
      </div>

      {/* Error */}
      {error && (
        <div style={{
          background:   'rgba(192,100,60,0.08)',
          border:       '1px solid rgba(192,100,60,0.25)',
          borderRadius: '0.5rem',
          padding:      '0.875rem 1rem',
          marginBottom: '1.5rem',
        }}>
          <p style={{ fontSize: '0.82rem', color: 'rgba(220,130,90,0.95)', lineHeight: 1.6, margin: 0 }}>
            {error}
          </p>
        </div>
      )}

      {/* Stripe — card payment */}
      <button
        type="button"
        onClick={() => handlePay('stripe')}
        disabled={loading !== null}
        style={{
          width:          '100%',
          background:     loading === 'stripe' ? 'rgba(196,151,58,0.8)' : 'var(--accent)',
          color:          'var(--accent-fg)',
          border:         'none',
          borderRadius:   '0.5rem',
          padding:        '0.95rem 1rem',
          fontSize:       '0.9rem',
          fontWeight:     600,
          letterSpacing:  '0.02em',
          cursor:         loading !== null ? 'wait' : 'pointer',
          fontFamily:     'inherit',
          transition:     'background 0.15s, opacity 0.15s',
          opacity:        loading !== null && loading !== 'stripe' ? 0.45 : 1,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          gap:            '0.5rem',
        }}
      >
        {loading === 'stripe' ? 'Redirecting…' : 'Pay with Card — $99 USD'}
      </button>

      {/* Divider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
        <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
        <span style={{ fontSize: '0.7rem', color: 'var(--subtle)', letterSpacing: '0.06em' }}>or</span>
        <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
      </div>

      {/* PayPal */}
      <button
        type="button"
        onClick={() => handlePay('paypal')}
        disabled={loading !== null}
        style={{
          width:          '100%',
          background:     loading === 'paypal' ? '#0060a3' : '#0070ba',
          color:          '#fff',
          border:         'none',
          borderRadius:   '0.5rem',
          padding:        '0.95rem 1rem',
          fontSize:       '0.9rem',
          fontWeight:     600,
          cursor:         loading !== null ? 'wait' : 'pointer',
          fontFamily:     'inherit',
          transition:     'background 0.15s, opacity 0.15s',
          opacity:        loading !== null && loading !== 'paypal' ? 0.45 : 1,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          gap:            '0.5rem',
        }}
      >
        {loading === 'paypal' ? 'Redirecting to PayPal…' : 'Pay with PayPal — $99 USD'}
      </button>

    </div>
  )
}
