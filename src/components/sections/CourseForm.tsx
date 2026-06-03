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
  type: 'text' | 'email'
  placeholder: string
  required: boolean
}

const FIELDS: Field[] = [
  { id: 'name',        label: 'نام و نام خانوادگی',        type: 'text',  placeholder: '',  required: true  },
  { id: 'instagram',   label: 'آیدی اینستاگرام',           type: 'text',  placeholder: '@', required: false },
  { id: 'telegram',    label: 'آیدی تلگرام',               type: 'text',  placeholder: '@', required: false },
  { id: 'email',       label: 'ایمیل',                     type: 'email', placeholder: '',  required: true  },
  { id: 'location',    label: 'شهر و کشور فعلی',           type: 'text',  placeholder: '',  required: true  },
  { id: 'destination', label: 'مقصدی که به آن فکر می‌کنی', type: 'text',  placeholder: '',  required: true  },
]

export function CourseForm() {
  const [values, setValues]   = useState<Record<string, string>>({})
  const [focused, setFocused] = useState<string | null>(null)
  const [status, setStatus]   = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')

  function handleChange(id: string, value: string) {
    setValues(prev => ({ ...prev, [id]: value }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setStatus('submitting')

    try {
      const res = await fetch('/api/course', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:        values.name        ?? '',
          instagram:   values.instagram   ?? '',
          telegram:    values.telegram    ?? '',
          email:       values.email       ?? '',
          location:    values.location    ?? '',
          destination: values.destination ?? '',
        }),
      })
      if (!res.ok) throw new Error('failed')
      setStatus('success')
    } catch {
      setStatus('error')
    }
  }

  /* ── Success state ─────────────────────────────────── */
  if (status === 'success') {
    return (
      <div
        dir="rtl"
        style={{
          maxWidth: '560px',
          padding: '2.5rem 2rem',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '0.875rem',
        }}
      >
        <div style={{ width: '2rem', height: '1px', background: 'var(--accent)', opacity: 0.65, marginBottom: '1.5rem' }} />
        <h3 style={{
          fontSize: 'clamp(1.1rem, 2vw, 1.4rem)',
          fontWeight: 600,
          lineHeight: 1.35,
          color: 'var(--foreground)',
          marginBottom: '1rem',
        }}>
          درخواست ثبت شد.
        </h3>
        <p style={{ fontSize: '0.9rem', color: 'var(--muted)', lineHeight: 1.9, margin: 0 }}>
          برای دریافت اطلاعات پرداخت، رسیدگی از طریق اینستاگرام انجام می‌شود.
        </p>
      </div>
    )
  }

  /* ── Form ────────────────────────────────────────────── */
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
          </div>
        ))}
      </div>

      {status === 'error' && (
        <p style={{ marginTop: '1rem', fontSize: '0.8rem', color: 'var(--subtle)', lineHeight: 1.6 }}>
          مشکلی پیش آمد. لطفاً دوباره امتحان کن.
        </p>
      )}

      <button
        type="submit"
        disabled={status === 'submitting'}
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
          cursor: status === 'submitting' ? 'wait' : 'pointer',
          fontFamily: 'inherit',
          opacity: status === 'submitting' ? 0.65 : 1,
          transition: 'opacity 0.15s',
          whiteSpace: 'nowrap',
        }}
      >
        {status === 'submitting' ? '...' : 'ارسال درخواست'}
      </button>
    </form>
  )
}
