'use client'

import { useState, FormEvent } from 'react'

// Replace with real Zarinpal or payment gateway URL when ready
const CONSULTATION_PAYMENT_HREF = 'https://example.com/consultation-payment'

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
  direction: 'rtl',
  boxSizing: 'border-box' as const,
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.78rem',
  color: 'var(--muted)',
  marginBottom: '0.5rem',
  letterSpacing: '0.02em',
}

interface Field {
  id: string
  label: string
  type: 'text' | 'email' | 'textarea'
  placeholder: string
  required: boolean
  rows?: number
}

const FIELDS: Field[] = [
  { id: 'name',      label: 'نام و نام خانوادگی',                           type: 'text',     placeholder: '',  required: true },
  { id: 'instagram', label: 'آیدی اینستاگرام',                              type: 'text',     placeholder: '@', required: false },
  { id: 'email',     label: 'ایمیل',                                         type: 'email',    placeholder: '',  required: true },
  { id: 'subject',   label: 'موضوع جلسه',                                   type: 'text',     placeholder: '',  required: true },
  { id: 'message',   label: 'الان دقیقاً در چه موردی به کمک نیاز داری؟',   type: 'textarea', placeholder: '',  required: true, rows: 5 },
]

export function ConsultationForm() {
  const [values, setValues] = useState<Record<string, string>>({})
  const [focused, setFocused] = useState<string | null>(null)

  function handleChange(id: string, value: string) {
    setValues(prev => ({ ...prev, [id]: value }))
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams({
      name:      values.name      ?? '',
      instagram: values.instagram ?? '',
      email:     values.email     ?? '',
      subject:   values.subject   ?? '',
      message:   values.message   ?? '',
    })
    window.location.href = `${CONSULTATION_PAYMENT_HREF}?${params.toString()}`
  }

  return (
    <form onSubmit={handleSubmit} noValidate style={{ maxWidth: '560px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {FIELDS.map((field) => (
          <div key={field.id}>
            <label htmlFor={field.id} style={labelStyle}>
              {field.label}
              {field.required && (
                <span style={{ color: 'var(--accent)', marginRight: '0.2rem', opacity: 0.8 }}>*</span>
              )}
            </label>

            {field.type === 'textarea' ? (
              <textarea
                id={field.id}
                name={field.id}
                rows={field.rows}
                required={field.required}
                placeholder={field.placeholder}
                value={values[field.id] ?? ''}
                onChange={e => handleChange(field.id, e.target.value)}
                onFocus={() => setFocused(field.id)}
                onBlur={() => setFocused(null)}
                style={{
                  ...inputStyle,
                  resize: 'vertical',
                  minHeight: '120px',
                  borderColor: focused === field.id ? 'var(--accent)' : 'var(--border)',
                }}
              />
            ) : (
              <input
                id={field.id}
                name={field.id}
                type={field.type}
                required={field.required}
                placeholder={field.placeholder}
                value={values[field.id] ?? ''}
                onChange={e => handleChange(field.id, e.target.value)}
                onFocus={() => setFocused(field.id)}
                onBlur={() => setFocused(null)}
                style={{
                  ...inputStyle,
                  borderColor: focused === field.id ? 'var(--accent)' : 'var(--border)',
                }}
              />
            )}
          </div>
        ))}
      </div>

      <button
        type="submit"
        style={{
          marginTop: '2rem',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '9999px',
          background: 'var(--accent)',
          color: 'var(--accent-fg)',
          padding: '0.9rem 2.25rem',
          fontSize: '0.9rem',
          fontWeight: 600,
          letterSpacing: '0.04em',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'inherit',
          transition: 'opacity 0.15s',
          whiteSpace: 'nowrap',
        }}
        onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
        onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
      >
        ثبت درخواست جلسه
      </button>
    </form>
  )
}
