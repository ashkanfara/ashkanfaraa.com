'use client'

import { useState, FormEvent } from 'react'

const inputStyle: React.CSSProperties = {
  width:          '100%',
  background:     'var(--surface-raised)',
  border:         '1px solid var(--border)',
  borderRadius:   '0.625rem',
  padding:        '0.875rem 1rem',
  fontSize:       '0.9rem',
  color:          'var(--foreground)',
  lineHeight:     1.5,
  outline:        'none',
  transition:     'border-color 0.15s',
  fontFamily:     'inherit',
  direction:      'ltr',
  boxSizing:      'border-box' as const,
}

const labelStyle: React.CSSProperties = {
  display:       'block',
  fontSize:      '0.75rem',
  color:         'var(--muted)',
  marginBottom:  '0.5rem',
  letterSpacing: '0.02em',
}

function validate(id: string, val: string): string | null {
  if (id === 'name')   return val.trim().length < 2                           ? 'Name is required' : null
  if (id === 'email')  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim())  ? null : 'Enter a valid email address'
  if (id === 'reason') return val.trim().length < 10                          ? 'Please describe your reason' : null
  return null
}

const REQUIRED = ['name', 'email', 'reason']

export function ConsultationFormEn() {
  const [values,  setValues]  = useState<Record<string, string>>({})
  const [focused, setFocused] = useState<string | null>(null)
  const [touched, setTouched] = useState<Set<string>>(new Set())
  const [status,  setStatus]  = useState<'idle' | 'submitting' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const isValid = REQUIRED.every(id => validate(id, values[id] ?? '') === null)

  function borderColor(id: string) {
    const err = validate(id, values[id] ?? '')
    if (touched.has(id) && err) return 'rgba(192,100,60,0.7)'
    if (focused === id)         return 'var(--accent)'
    return 'var(--border)'
  }

  function fieldError(id: string) {
    const err = validate(id, values[id] ?? '')
    if (!touched.has(id) || !err) return null
    return <p style={{ marginTop: '0.4rem', fontSize: '0.72rem', color: 'rgba(200,110,70,0.9)', lineHeight: 1.5 }}>{err}</p>
  }

  function inputProps(id: string, type: string) {
    return {
      id, name: id, type,
      value:    values[id] ?? '',
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        setValues(p => ({ ...p, [id]: e.target.value })),
      onFocus:  () => setFocused(id),
      onBlur:   () => { setFocused(null); setTouched(p => new Set([...p, id])) },
      style:    { ...inputStyle, borderColor: borderColor(id) },
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setTouched(new Set(REQUIRED))
    if (!isValid) return

    setStatus('submitting')
    setErrorMsg(null)

    try {
      const res = await fetch('/api/en/consultation', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:      values.name      ?? '',
          instagram: values.instagram ?? '',
          email:     values.email     ?? '',
          reason:    values.reason    ?? '',
        }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok || !data.url) {
        throw new Error(data.error ?? 'Something went wrong. Please try again.')
      }

      window.location.href = data.url
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setStatus('error')
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate style={{ maxWidth: '560px' }}>

      {/* ── Contact fields ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '1.75rem' }}>

        <div>
          <label htmlFor="name" style={labelStyle}>
            Full name <span style={{ color: 'var(--accent)', opacity: 0.8 }}>*</span>
          </label>
          <input {...inputProps('name', 'text')} />
          {fieldError('name')}
        </div>

        <div>
          <label htmlFor="email" style={labelStyle}>
            Email address <span style={{ color: 'var(--accent)', opacity: 0.8 }}>*</span>
          </label>
          <input {...inputProps('email', 'email')} />
          {fieldError('email')}
        </div>

        <div>
          <label htmlFor="instagram" style={labelStyle}>
            Instagram handle <span style={{ color: 'var(--subtle)', fontSize: '0.7rem' }}>(optional)</span>
          </label>
          <input {...inputProps('instagram', 'text')} placeholder="@" />
        </div>

      </div>

      {/* ── Reason textarea ── */}
      <div style={{ marginBottom: '2rem' }}>
        <label htmlFor="reason" style={labelStyle}>
          Reason for consultation <span style={{ color: 'var(--accent)', opacity: 0.8 }}>*</span>
        </label>
        <textarea
          id="reason"
          name="reason"
          rows={4}
          value={values.reason ?? ''}
          onChange={e => setValues(p => ({ ...p, reason: e.target.value }))}
          onFocus={() => setFocused('reason')}
          onBlur={() => { setFocused(null); setTouched(p => new Set([...p, 'reason'])) }}
          style={{
            ...inputStyle,
            resize:    'vertical' as const,
            minHeight: '110px',
            borderColor: borderColor('reason'),
          }}
        />
        {fieldError('reason')}
      </div>

      {/* ── Error message ── */}
      {errorMsg && (
        <div style={{
          background:   'rgba(192,100,60,0.08)',
          border:       '1px solid rgba(192,100,60,0.25)',
          borderRadius: '0.5rem',
          padding:      '0.875rem 1rem',
          marginBottom: '1.5rem',
        }}>
          <p style={{ fontSize: '0.82rem', color: 'rgba(220,130,90,0.95)', lineHeight: 1.6, margin: 0 }}>
            {errorMsg}
          </p>
        </div>
      )}

      {/* ── Submit ── */}
      <button
        type="submit"
        disabled={status === 'submitting'}
        style={{
          display:        'inline-flex',
          alignItems:     'center',
          justifyContent: 'center',
          borderRadius:   '9999px',
          background:     'var(--accent)',
          color:          'var(--accent-fg)',
          padding:        '0.9rem 2.5rem',
          fontSize:       '0.9rem',
          fontWeight:     600,
          letterSpacing:  '0.04em',
          border:         'none',
          fontFamily:     'inherit',
          cursor:         status === 'submitting' ? 'wait' : 'pointer',
          opacity:        status === 'submitting' ? 0.6 : 1,
          transition:     'opacity 0.15s',
          whiteSpace:     'nowrap',
        }}
      >
        {status === 'submitting' ? 'Redirecting to payment…' : 'Continue to Payment'}
      </button>

    </form>
  )
}
