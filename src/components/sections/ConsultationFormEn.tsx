'use client'

import { useState, FormEvent } from 'react'

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
  boxSizing: 'border-box' as const,
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.78rem',
  color: 'var(--muted)',
  marginBottom: '0.5rem',
  letterSpacing: '0.02em',
}

function validateField(id: string, val: string): string | null {
  switch (id) {
    case 'name':    return val.trim().length < 2 ? 'Name is required' : null
    case 'email':   return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim()) ? null : 'Enter a valid email address'
    case 'subject': return val.trim().length === 0 ? 'This field is required' : null
    case 'message': return val.trim().length === 0 ? 'This field is required' : null
    default:        return null
  }
}

const REQUIRED = ['name', 'email', 'subject', 'message']

const FIELDS = [
  { id: 'name',      label: 'Full name',                              type: 'text' as const,     required: true,  placeholder: '' },
  { id: 'instagram', label: 'Instagram handle',                       type: 'text' as const,     required: false, placeholder: '@' },
  { id: 'email',     label: 'Email address',                          type: 'email' as const,    required: true,  placeholder: '' },
  { id: 'location',  label: 'Where are you currently based?',         type: 'text' as const,     required: false, placeholder: 'City, Country' },
  { id: 'subject',   label: 'The most important decision you face now', type: 'text' as const,   required: true,  placeholder: '' },
  { id: 'message',   label: "If you had 5 minutes to explain your situation, what would you say?", type: 'textarea' as const, required: true, rows: 5, placeholder: '' },
]

export function ConsultationFormEn() {
  const [values,  setValues]  = useState<Record<string, string>>({})
  const [focused, setFocused] = useState<string | null>(null)
  const [touched, setTouched] = useState<Set<string>>(new Set())
  const [status,  setStatus]  = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')

  const isValid = REQUIRED.every(id => validateField(id, values[id] ?? '') === null)

  function handleBlur(id: string) {
    setFocused(null)
    setTouched(prev => new Set([...prev, id]))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!isValid) return
    setStatus('submitting')
    try {
      const res = await fetch('/api/consultation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:      values.name      ?? '',
          instagram: values.instagram ?? '',
          phone:     '',
          location:  values.location  ?? '',
          email:     values.email     ?? '',
          subject:   values.subject   ?? '',
          message:   values.message   ?? '',
        }),
      })
      if (!res.ok) throw new Error('failed')
      setStatus('success')
    } catch {
      setStatus('error')
    }
  }

  if (status === 'success') {
    return (
      <div style={{
        maxWidth: '560px', padding: '2.5rem 2rem',
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '0.875rem',
      }}>
        <div style={{ width: '2rem', height: '1px', background: 'var(--accent)', opacity: 0.65, marginBottom: '1.5rem' }} />
        <h3 style={{ fontSize: 'clamp(1.1rem, 2vw, 1.4rem)', fontWeight: 600, lineHeight: 1.35, color: 'var(--foreground)', marginBottom: '1rem' }}>
          Request received.
        </h3>
        <p style={{ fontSize: '0.9rem', color: 'var(--muted)', lineHeight: 1.9, marginBottom: '1rem' }}>
          Your request has been reviewed. If it's a fit, we'll reach out to coordinate next steps.
        </p>
        <p style={{ fontSize: '0.78rem', color: 'var(--subtle)', lineHeight: 1.75, margin: 0, opacity: 0.8 }}>
          Requests are typically reviewed within 24–48 hours.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate style={{ maxWidth: '560px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {FIELDS.map((field) => {
          const error     = validateField(field.id, values[field.id] ?? '')
          const showError = touched.has(field.id) && error !== null
          const borderColor = showError
            ? 'rgba(192, 100, 60, 0.7)'
            : focused === field.id ? 'var(--accent)' : 'var(--border)'

          return (
            <div key={field.id}>
              <label htmlFor={field.id} style={labelStyle}>
                {field.label}
                {field.required && <span style={{ color: 'var(--accent)', marginLeft: '0.2rem', opacity: 0.8 }}>*</span>}
              </label>

              {field.type === 'textarea' ? (
                <textarea
                  id={field.id} name={field.id} rows={field.rows}
                  required={field.required}
                  value={values[field.id] ?? ''}
                  onChange={e => setValues(p => ({ ...p, [field.id]: e.target.value }))}
                  onFocus={() => setFocused(field.id)}
                  onBlur={() => handleBlur(field.id)}
                  style={{ ...inputStyle, resize: 'vertical', minHeight: '120px', borderColor }}
                />
              ) : (
                <input
                  id={field.id} name={field.id} type={field.type}
                  placeholder={field.placeholder}
                  required={field.required}
                  value={values[field.id] ?? ''}
                  onChange={e => setValues(p => ({ ...p, [field.id]: e.target.value }))}
                  onFocus={() => setFocused(field.id)}
                  onBlur={() => handleBlur(field.id)}
                  style={{ ...inputStyle, borderColor }}
                />
              )}

              {showError && (
                <p style={{ marginTop: '0.4rem', fontSize: '0.72rem', color: 'rgba(200, 110, 70, 0.9)', lineHeight: 1.5 }}>
                  {error}
                </p>
              )}
            </div>
          )
        })}
      </div>

      {status === 'error' && (
        <p style={{ marginTop: '1rem', fontSize: '0.8rem', color: 'var(--subtle)', lineHeight: 1.6 }}>
          Something went wrong. Please try again.
        </p>
      )}

      <button
        type="submit"
        disabled={!isValid || status === 'submitting'}
        style={{
          marginTop: '2rem',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: '9999px', background: 'var(--accent)', color: 'var(--accent-fg)',
          padding: '0.9rem 2.25rem', fontSize: '0.9rem', fontWeight: 600,
          letterSpacing: '0.04em', border: 'none', fontFamily: 'inherit',
          cursor: !isValid || status === 'submitting' ? 'not-allowed' : 'pointer',
          opacity: !isValid || status === 'submitting' ? 0.4 : 1,
          transition: 'opacity 0.15s', whiteSpace: 'nowrap',
        }}
      >
        {status === 'submitting' ? '…' : 'Submit Request'}
      </button>
    </form>
  )
}
