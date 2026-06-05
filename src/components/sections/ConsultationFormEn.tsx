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
  fontSize: '0.75rem',
  color: 'var(--muted)',
  marginBottom: '0.5rem',
  letterSpacing: '0.02em',
}

const sectionLabel: React.CSSProperties = {
  fontSize: '0.6rem',
  letterSpacing: '0.2em',
  textTransform: 'uppercase',
  color: 'var(--subtle)',
  marginBottom: '1.1rem',
}

function validate(id: string, val: string): string | null {
  switch (id) {
    case 'name':     return val.trim().length < 2                                    ? 'Name is required' : null
    case 'email':    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim())           ? null : 'Enter a valid email address'
    case 'country':  return val.trim().length === 0                                  ? 'Country is required' : null
    case 'decision': return val.trim().length < 10                                   ? 'Please describe your decision' : null
    case 'options':  return val.trim().length < 10                                   ? 'Please describe your options' : null
    case 'outcome':  return val.trim().length < 10                                   ? 'Please describe your ideal outcome' : null
    default:         return null
  }
}

const REQUIRED = ['name', 'email', 'country', 'decision', 'options', 'outcome']

export function ConsultationFormEn() {
  const [values,  setValues]  = useState<Record<string, string>>({})
  const [focused, setFocused] = useState<string | null>(null)
  const [touched, setTouched] = useState<Set<string>>(new Set())
  const [status,  setStatus]  = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')

  const isValid = REQUIRED.every(id => validate(id, values[id] ?? '') === null)

  function field(id: string) {
    const error     = validate(id, values[id] ?? '')
    const showError = touched.has(id) && error !== null
    const borderColor = showError
      ? 'rgba(192,100,60,0.7)'
      : focused === id ? 'var(--accent)' : 'var(--border)'
    return { error, showError, borderColor }
  }

  function renderError(id: string) {
    const { showError, error } = field(id)
    return showError ? (
      <p style={{ marginTop: '0.4rem', fontSize: '0.72rem', color: 'rgba(200,110,70,0.9)', lineHeight: 1.5 }}>{error}</p>
    ) : null
  }

  function inputProps(id: string, type: string) {
    const { borderColor } = field(id)
    return {
      id, name: id, type,
      value: values[id] ?? '',
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => setValues(p => ({ ...p, [id]: e.target.value })),
      onFocus: () => setFocused(id),
      onBlur: () => { setFocused(null); setTouched(p => new Set([...p, id])) },
      style: { ...inputStyle, borderColor },
    }
  }

  function textareaProps(id: string) {
    const { borderColor } = field(id)
    return {
      id, name: id, rows: 3,
      value: values[id] ?? '',
      onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => setValues(p => ({ ...p, [id]: e.target.value })),
      onFocus: () => setFocused(id),
      onBlur: () => { setFocused(null); setTouched(p => new Set([...p, id])) },
      style: { ...inputStyle, resize: 'vertical' as const, minHeight: '96px', borderColor },
    }
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
          location:  values.country   ?? '',
          email:     values.email     ?? '',
          subject:   values.decision  ?? '',
          message:   [
            `Decision: ${values.decision  ?? ''}`,
            `Options: ${values.options    ?? ''}`,
            `Outcome: ${values.outcome    ?? ''}`,
            values.notes ? `Notes: ${values.notes}` : '',
          ].filter(Boolean).join('\n\n'),
        }),
      })
      if (!res.ok) throw new Error('failed')
      setStatus('success')
    } catch {
      setStatus('error')
    }
  }

  /* ── Success ── */
  if (status === 'success') {
    return (
      <div style={{
        maxWidth: '560px', padding: '2.5rem 2rem',
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '0.875rem',
      }}>
        <div style={{ width: '2rem', height: '1px', background: 'var(--accent)', opacity: 0.65, marginBottom: '1.5rem' }} />
        <h3 style={{ fontSize: 'clamp(1.1rem, 2vw, 1.4rem)', fontWeight: 600, lineHeight: 1.35, color: 'var(--foreground)', marginBottom: '1rem' }}>
          Application received.
        </h3>
        <p style={{ fontSize: '0.9rem', color: 'var(--muted)', lineHeight: 1.9, marginBottom: '1rem' }}>
          You'll hear back within 48 hours.
        </p>
        <p style={{ fontSize: '0.78rem', color: 'var(--subtle)', lineHeight: 1.75, margin: 0, opacity: 0.85 }}>
          Not every application leads to a session — the goal is to make sure it's a good fit for both sides.
        </p>
      </div>
    )
  }

  /* ── Form ── */
  return (
    <form onSubmit={handleSubmit} noValidate style={{ maxWidth: '560px' }}>

      {/* ── Section 1: Contact ── */}
      <p style={sectionLabel}>Your Information</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '2.5rem' }}>

        <div>
          <label htmlFor="name" style={labelStyle}>Full name <span style={{ color: 'var(--accent)', opacity: 0.8 }}>*</span></label>
          <input {...inputProps('name', 'text')} />
          {renderError('name')}
        </div>

        <div>
          <label htmlFor="email" style={labelStyle}>Email address <span style={{ color: 'var(--accent)', opacity: 0.8 }}>*</span></label>
          <input {...inputProps('email', 'email')} />
          {renderError('email')}
        </div>

        <div>
          <label htmlFor="country" style={labelStyle}>Country you are currently based in <span style={{ color: 'var(--accent)', opacity: 0.8 }}>*</span></label>
          <input {...inputProps('country', 'text')} />
          {renderError('country')}
        </div>

        <div>
          <label htmlFor="instagram" style={labelStyle}>Instagram handle (optional)</label>
          <input {...inputProps('instagram', 'text')} placeholder="@" />
        </div>

      </div>

      {/* ── Section divider ── */}
      <div style={{ height: '1px', background: 'var(--border)', marginBottom: '2.5rem' }} />

      {/* ── Section 2: Decision context ── */}
      <p style={sectionLabel}>About Your Decision</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', marginBottom: '2.5rem' }}>

        <div>
          <label htmlFor="decision" style={labelStyle}>
            What decision are you trying to make? <span style={{ color: 'var(--accent)', opacity: 0.8 }}>*</span>
          </label>
          <textarea {...textareaProps('decision')} />
          {renderError('decision')}
        </div>

        <div>
          <label htmlFor="options" style={labelStyle}>
            What options are you considering? <span style={{ color: 'var(--accent)', opacity: 0.8 }}>*</span>
          </label>
          <textarea {...textareaProps('options')} />
          {renderError('options')}
        </div>

        <div>
          <label htmlFor="outcome" style={labelStyle}>
            What would a successful outcome look like? <span style={{ color: 'var(--accent)', opacity: 0.8 }}>*</span>
          </label>
          <textarea {...textareaProps('outcome')} />
          {renderError('outcome')}
        </div>

        <div>
          <label htmlFor="notes" style={labelStyle}>Anything else I should know? (optional)</label>
          <textarea {...textareaProps('notes')} />
        </div>

      </div>

      {status === 'error' && (
        <p style={{ marginBottom: '1rem', fontSize: '0.8rem', color: 'var(--subtle)', lineHeight: 1.6 }}>
          Something went wrong. Please try again.
        </p>
      )}

      <button
        type="submit"
        disabled={!isValid || status === 'submitting'}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: '9999px', background: 'var(--accent)', color: 'var(--accent-fg)',
          padding: '0.9rem 2.5rem', fontSize: '0.9rem', fontWeight: 600,
          letterSpacing: '0.04em', border: 'none', fontFamily: 'inherit',
          cursor: !isValid || status === 'submitting' ? 'not-allowed' : 'pointer',
          opacity: !isValid || status === 'submitting' ? 0.4 : 1,
          transition: 'opacity 0.15s', whiteSpace: 'nowrap',
        }}
      >
        {status === 'submitting' ? '…' : 'Submit Application'}
      </button>
    </form>
  )
}
