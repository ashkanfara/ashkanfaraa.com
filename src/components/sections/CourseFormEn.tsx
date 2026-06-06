'use client'

import { useState } from 'react'

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--surface-raised)',
  border: '1px solid var(--border)',
  borderRadius: '0.625rem',
  padding: '0.875rem 1rem',
  fontSize: '0.9rem',
  color: 'var(--foreground)',
  lineHeight: 1.5,
  outline: 'none',
  transition: 'border-color 0.15s',
  fontFamily: 'inherit',
  direction: 'ltr',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.75rem',
  color: 'var(--muted)',
  marginBottom: '0.5rem',
  letterSpacing: '0.02em',
}

function validate(id: string, val: string): string | null {
  if (id === 'name')  return val.trim().length < 2 ? 'Name is required' : null
  if (id === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim()) ? null : 'Enter a valid email address'
  if (id === 'phone') return val.trim().length < 5  ? 'Mobile number is required' : null
  return null
}

const REQUIRED = ['name', 'email', 'phone']

const FIELDS = [
  { id: 'name',      label: 'Full name',        type: 'text'  as const, required: true,  placeholder: '' },
  { id: 'email',     label: 'Email address',    type: 'email' as const, required: true,  placeholder: '' },
  { id: 'instagram', label: 'Instagram handle', type: 'text'  as const, required: false, placeholder: '@' },
  { id: 'telegram',  label: 'Telegram username', type: 'text' as const, required: false, placeholder: '@' },
  { id: 'phone',     label: 'Mobile number',    type: 'tel'   as const, required: true,  placeholder: '+61 ...' },
]

export function CourseFormEn() {
  const [values,  setValues]  = useState<Record<string, string>>({})
  const [touched, setTouched] = useState<Set<string>>(new Set())
  const [focused, setFocused] = useState<string | null>(null)
  const [loading, setLoading] = useState<'stripe' | 'paypal' | null>(null)
  const [error,   setError]   = useState<string | null>(null)

  const isValid = REQUIRED.every(id => validate(id, values[id] ?? '') === null)

  function touchAll() {
    setTouched(new Set(REQUIRED))
  }

  async function redirectTo(provider: 'stripe' | 'paypal') {
    touchAll()
    if (!isValid) return

    setLoading(provider)
    setError(null)

    const endpoint = provider === 'stripe'
      ? '/api/en/stripe/checkout'
      : '/api/en/paypal/create-order'

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
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

      // Real redirect to Stripe / PayPal hosted checkout
      window.location.href = data.url
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      setError(msg)
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
          const borderColor = showErr
            ? 'rgba(192,100,60,0.7)'
            : focused === f.id ? 'var(--accent)' : 'var(--border)'
          return (
            <div key={f.id}>
              <label htmlFor={f.id} style={labelStyle}>
                {f.label}
                {f.required && <span style={{ color: 'var(--accent)', marginLeft: '0.2rem', opacity: 0.8 }}>*</span>}
              </label>
              <input
                id={f.id} name={f.id} type={f.type}
                placeholder={f.placeholder}
                value={values[f.id] ?? ''}
                onChange={e => setValues(p => ({ ...p, [f.id]: e.target.value }))}
                onFocus={() => setFocused(f.id)}
                onBlur={() => { setFocused(null); setTouched(p => new Set([...p, f.id])) }}
                style={{ ...inputStyle, borderColor }}
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
          background: 'rgba(192,100,60,0.08)', border: '1px solid rgba(192,100,60,0.25)',
          borderRadius: '0.5rem', padding: '0.875rem 1rem', marginBottom: '1.5rem',
        }}>
          <p style={{ fontSize: '0.82rem', color: 'rgba(220,130,90,0.95)', lineHeight: 1.6, margin: 0 }}>
            {error}
          </p>
        </div>
      )}

      {/* Payment buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

        {/* Stripe */}
        <button
          type="button"
          onClick={() => redirectTo('stripe')}
          disabled={loading !== null}
          style={{
            width: '100%',
            background: loading === 'stripe' ? 'var(--accent-dim)' : 'var(--accent)',
            color: 'var(--accent-fg)',
            border: 'none',
            borderRadius: '0.5rem',
            padding: '0.95rem 1rem',
            fontSize: '0.9rem',
            fontWeight: 600,
            letterSpacing: '0.03em',
            cursor: loading !== null ? 'wait' : 'pointer',
            fontFamily: 'inherit',
            transition: 'background 0.15s, opacity 0.15s',
            opacity: loading !== null && loading !== 'stripe' ? 0.5 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
          }}
        >
          {loading === 'stripe' ? (
            'Redirecting to checkout…'
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M13.479 9.883c-2.352-.586-3.105-.6-3.105-1.218 0-.534.507-.778 1.407-.778 1.35 0 2.805.517 3.793 1.017l.557-3.434C15.186 5.16 13.79 4.5 11.78 4.5c-1.365 0-2.502.36-3.327.983C7.65 6.14 7.2 7.085 7.2 8.18c0 2.24 1.365 3.055 3.795 3.686 1.935.495 2.52.72 2.52 1.35 0 .615-.585.9-1.62.9-1.29 0-3.015-.555-4.095-1.245l-.57 3.465c1.065.675 2.895 1.164 4.77 1.164 1.44 0 2.625-.36 3.465-.99.9-.675 1.365-1.665 1.365-2.88 0-2.31-1.38-3.105-3.951-3.747z"/>
              </svg>
              Pay with Card — $99 USD
            </>
          )}
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
          onClick={() => redirectTo('paypal')}
          disabled={loading !== null}
          style={{
            width: '100%',
            background: loading === 'paypal' ? '#0060a3' : '#0070ba',
            color: '#fff',
            border: 'none',
            borderRadius: '0.5rem',
            padding: '0.95rem 1rem',
            fontSize: '0.9rem',
            fontWeight: 600,
            cursor: loading !== null ? 'wait' : 'pointer',
            fontFamily: 'inherit',
            transition: 'background 0.15s, opacity 0.15s',
            opacity: loading !== null && loading !== 'paypal' ? 0.5 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
          }}
        >
          {loading === 'paypal' ? (
            'Redirecting to PayPal…'
          ) : (
            'Pay with PayPal — $99 USD'
          )}
        </button>
      </div>
    </div>
  )
}
