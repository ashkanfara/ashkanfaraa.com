'use client'

import { useState, FormEvent } from 'react'

// ── Shared styles ─────────────────────────────────────────────
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

// ── Validation ────────────────────────────────────────────────
function normalizePhone(val: string): string {
  return val
    .replace(/[\s\-]/g, '')
    .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 1776))
}

function validateField(id: string, val: string): string | null {
  switch (id) {
    case 'name':
      return val.trim().length === 0 ? 'نام الزامی است' : null
    case 'email':
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim())
        ? null : 'یک ایمیل معتبر وارد کن'
    case 'phone': {
      const digits = normalizePhone(val)
      if (digits.length === 0)   return 'شماره موبایل الزامی است'
      if (!/^\d+$/.test(digits)) return 'فقط عدد وارد کن'
      if (digits.length < 10)    return 'شماره باید حداقل ۱۰ رقم باشد'
      return null
    }
    case 'location':
      return val.trim().length === 0 ? 'این فیلد الزامی است' : null
    case 'subject':
      return val.trim().length === 0 ? 'این فیلد الزامی است' : null
    case 'message':
      return val.trim().length === 0 ? 'این فیلد الزامی است' : null
    default:
      return null
  }
}

const REQUIRED = ['name', 'email', 'phone', 'location', 'subject', 'message']

// ── Fields ────────────────────────────────────────────────────
interface Field {
  id:          string
  label:       string
  type:        'text' | 'email' | 'tel' | 'textarea'
  placeholder: string
  required:    boolean
  rows?:       number
}

const FIELDS: Field[] = [
  { id: 'name',      label: 'نام و نام خانوادگی',                              type: 'text',     placeholder: '', required: true  },
  { id: 'instagram', label: 'آیدی اینستاگرام',                                 type: 'text',     placeholder: '@', required: false },
  { id: 'phone',     label: 'شماره موبایل',                                    type: 'tel',      placeholder: '', required: true  },
  { id: 'location',  label: 'در حال حاضر در کدام کشور و شهر زندگی می‌کنی؟',   type: 'text',     placeholder: '', required: true  },
  { id: 'email',     label: 'ایمیل',                                            type: 'email',    placeholder: '', required: true  },
  { id: 'subject',   label: 'مهم‌ترین تصمیمی که الان با آن روبه‌رو هستی',      type: 'text',     placeholder: '', required: true  },
  { id: 'message',   label: 'اگر فقط ۵ دقیقه فرصت داشتی شرایطت را توضیح بدهی، چه می‌گفتی؟', type: 'textarea', placeholder: '', required: true, rows: 5 },
]

// ── Component ─────────────────────────────────────────────────
export function ConsultationForm() {
  const [values,  setValues]  = useState<Record<string, string>>({})
  const [focused, setFocused] = useState<string | null>(null)
  const [touched, setTouched] = useState<Set<string>>(new Set())
  const [status,  setStatus]  = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')

  const isValid = REQUIRED.every(id => validateField(id, values[id] ?? '') === null)

  function handleChange(id: string, val: string) {
    if (id === 'phone') {
      const cleaned = val
        .replace(/[\s\-]/g, '')
        .split('').filter(c => /[\d۰-۹]/.test(c)).join('')
      setValues(p => ({ ...p, phone: cleaned }))
    } else {
      setValues(p => ({ ...p, [id]: val }))
    }
  }

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
          phone:     normalizePhone(values.phone ?? ''),
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
          درخواستت ثبت شد.
        </h3>

        <p style={{ fontSize: '0.9rem', color: 'var(--muted)', lineHeight: 1.9, marginBottom: '1rem' }}>
          درخواستت بررسی می‌شود. اگر این جلسه برای شرایطت مناسب باشد، برای هماهنگی مرحله بعد با تو تماس می‌گیریم.
        </p>
        <p style={{ fontSize: '0.78rem', color: 'var(--subtle)', lineHeight: 1.75, margin: 0, opacity: 0.8 }}>
          در صورت مناسب بودن شرایط، معمولاً طی ۲۴ تا ۴۸ ساعت آینده درخواست شما بررسی خواهد شد.
        </p>
      </div>
    )
  }

  /* ── Form ──────────────────────────────────────────── */
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
                  value={values[field.id] ?? ''}
                  onChange={e => handleChange(field.id, e.target.value)}
                  onFocus={() => setFocused(field.id)}
                  onBlur={() => handleBlur(field.id)}
                  style={{ ...inputStyle, resize: 'vertical', minHeight: '120px', borderColor }}
                />
              ) : (
                <input
                  id={field.id}
                  name={field.id}
                  type={field.type}
                  required={field.required}
                  value={values[field.id] ?? ''}
                  onChange={e => handleChange(field.id, e.target.value)}
                  onFocus={() => setFocused(field.id)}
                  onBlur={() => handleBlur(field.id)}
                  style={{ ...inputStyle, borderColor }}
                />
              )}

              {showError && (
                <p style={{
                  marginTop: '0.4rem', fontSize: '0.72rem',
                  color: 'rgba(200, 110, 70, 0.9)', lineHeight: 1.5,
                }}>
                  {error}
                </p>
              )}
            </div>
          )
        })}
      </div>

      {status === 'error' && (
        <p style={{ marginTop: '1rem', fontSize: '0.8rem', color: 'var(--subtle)', lineHeight: 1.6 }}>
          مشکلی پیش آمد. لطفاً دوباره امتحان کن.
        </p>
      )}

      <button
        type="submit"
        disabled={!isValid || status === 'submitting'}
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
          cursor: !isValid || status === 'submitting' ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit',
          opacity: !isValid || status === 'submitting' ? 0.4 : 1,
          transition: 'opacity 0.15s',
          whiteSpace: 'nowrap',
        }}
      >
        {status === 'submitting' ? '...' : 'ارسال درخواست'}
      </button>
    </form>
  )
}
