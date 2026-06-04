'use client'

import { useState, FormEvent, useRef } from 'react'

// ── Types ─────────────────────────────────────────────────────
type Step = 'application' | 'payment' | 'success'

interface AppData {
  name:        string
  instagram:   string
  telegram:    string
  email:       string
  location:    string
  destination: string
  reason:      string
}

// ── Shared styles ─────────────────────────────────────────────
const input: React.CSSProperties = {
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
  boxSizing: 'border-box',
}

const lbl: React.CSSProperties = {
  display: 'block',
  fontSize: '0.78rem',
  color: 'var(--muted)',
  marginBottom: '0.5rem',
  letterSpacing: '0.02em',
}

const btn: React.CSSProperties = {
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
  textDecoration: 'none',
}

const CARD_HOLDER = process.env.NEXT_PUBLIC_CARD_HOLDER ?? 'اشکان فارا'
const CARD_NUMBER = process.env.NEXT_PUBLIC_CARD_NUMBER ?? '— — — —'
const CARD_SHEBA  = process.env.NEXT_PUBLIC_CARD_SHEBA  ?? ''

// ── Application step ──────────────────────────────────────────
const APP_FIELDS = [
  { id: 'name',        label: 'نام و نام خانوادگی', type: 'text',  placeholder: '',  required: true  },
  { id: 'instagram',   label: 'آیدی اینستاگرام',    type: 'text',  placeholder: '@', required: false },
  { id: 'telegram',    label: 'آیدی تلگرام',         type: 'text',  placeholder: '@', required: false },
  { id: 'email',       label: 'ایمیل',               type: 'email', placeholder: '',  required: true  },
  { id: 'location',    label: 'شهر و کشور فعلی',    type: 'text',  placeholder: '',  required: true  },
  { id: 'destination', label: 'مقصد مورد نظر',       type: 'text',  placeholder: '',  required: true  },
] as const

function ApplicationStep({ onNext }: { onNext: (data: AppData) => void }) {
  const [values,       setValues]       = useState<Record<string, string>>({})
  const [focused,      setFocused]      = useState<string | null>(null)
  const [reasonFocused, setReasonFocused] = useState(false)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    onNext({
      name:        values.name        ?? '',
      instagram:   values.instagram   ?? '',
      telegram:    values.telegram    ?? '',
      email:       values.email       ?? '',
      location:    values.location    ?? '',
      destination: values.destination ?? '',
      reason:      values.reason      ?? '',
    })
  }

  return (
    <form onSubmit={handleSubmit} noValidate style={{ maxWidth: '560px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {APP_FIELDS.map(f => (
          <div key={f.id}>
            <label htmlFor={f.id} style={lbl}>
              {f.label}
              {f.required && <span style={{ color: 'var(--accent)', marginRight: '0.2rem', opacity: 0.8 }}>*</span>}
            </label>
            <input
              id={f.id} name={f.id} type={f.type}
              required={f.required} placeholder={f.placeholder}
              value={values[f.id] ?? ''}
              onChange={e => setValues(p => ({ ...p, [f.id]: e.target.value }))}
              onFocus={() => setFocused(f.id)}
              onBlur={() => setFocused(null)}
              style={{ ...input, borderColor: focused === f.id ? 'var(--accent)' : 'var(--border)' }}
            />
          </div>
        ))}

        <div>
          <label htmlFor="reason" style={lbl}>
            دلیل مهاجرت
            <span style={{ color: 'var(--accent)', marginRight: '0.2rem', opacity: 0.8 }}>*</span>
          </label>
          <textarea
            id="reason" name="reason" required rows={3}
            value={values.reason ?? ''}
            onChange={e => setValues(p => ({ ...p, reason: e.target.value }))}
            onFocus={() => setReasonFocused(true)}
            onBlur={() => setReasonFocused(false)}
            style={{
              ...input, resize: 'none',
              borderColor: reasonFocused ? 'var(--accent)' : 'var(--border)',
            }}
          />
        </div>
      </div>

      <button type="submit" style={{ ...btn, marginTop: '2rem' }}>
        ادامه — پرداخت
      </button>
    </form>
  )
}

// ── Payment step ──────────────────────────────────────────────
function PaymentStep({
  appData,
  onSuccess,
}: {
  appData:   AppData
  onSuccess: (afCode: string) => void
}) {
  const [proofType,      setProofType]      = useState<'screenshot' | 'tracking'>('screenshot')
  const [file,           setFile]           = useState<File | null>(null)
  const [tracking,       setTracking]       = useState('')
  const [status,         setStatus]         = useState<'idle' | 'submitting' | 'error'>('idle')
  const [trackingFocused, setTrackingFocused] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (proofType === 'screenshot' && !file)          return
    if (proofType === 'tracking'   && !tracking.trim()) return

    setStatus('submitting')
    try {
      const fd = new FormData()
      Object.entries(appData).forEach(([k, v]) => fd.append(k, v))
      fd.append('proofType', proofType)
      if (proofType === 'screenshot' && file)   fd.append('screenshot', file)
      if (proofType === 'tracking')             fd.append('tracking', tracking.trim())

      const res = await fetch('/api/course', { method: 'POST', body: fd })
      if (!res.ok) throw new Error('failed')
      const { afCode } = await res.json()
      onSuccess(afCode)
    } catch {
      setStatus('error')
    }
  }

  return (
    <div dir="rtl" style={{ maxWidth: '560px' }}>

      {/* ── Payment card ─────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, var(--surface-raised) 0%, var(--surface) 100%)',
        border: '1px solid var(--border-strong)',
        borderRadius: '1rem',
        padding: '1.75rem',
        marginBottom: '2rem',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
          background: 'linear-gradient(90deg, transparent, var(--accent), transparent)',
          opacity: 0.5,
        }} />

        <p style={{ fontSize: '0.62rem', letterSpacing: '0.2em', color: 'var(--subtle)', marginBottom: '1.25rem' }}>
          مبلغ قابل پرداخت
        </p>
        <p style={{
          fontSize: 'clamp(1.6rem, 4vw, 2.1rem)', fontWeight: 700,
          color: 'var(--accent)', letterSpacing: '-0.02em',
          marginBottom: '2rem', lineHeight: 1,
        }}>
          ۹.۹ میلیون تومان
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <p style={{ fontSize: '0.6rem', letterSpacing: '0.14em', color: 'var(--subtle)', marginBottom: '0.3rem' }}>
              صاحب حساب
            </p>
            <p style={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--foreground)' }}>
              {CARD_HOLDER}
            </p>
          </div>
          <div>
            <p style={{ fontSize: '0.6rem', letterSpacing: '0.14em', color: 'var(--subtle)', marginBottom: '0.3rem' }}>
              شماره کارت
            </p>
            <p style={{
              fontSize: '1.05rem', fontWeight: 600, color: 'var(--foreground)',
              letterSpacing: '0.18em', fontVariantNumeric: 'tabular-nums', direction: 'ltr',
            }}>
              {CARD_NUMBER}
            </p>
          </div>
          {CARD_SHEBA && (
            <div>
              <p style={{ fontSize: '0.6rem', letterSpacing: '0.14em', color: 'var(--subtle)', marginBottom: '0.3rem' }}>
                شبا / ساتنا
              </p>
              <p style={{
                fontSize: '0.82rem', fontWeight: 500, color: 'var(--muted)',
                letterSpacing: '0.06em', fontVariantNumeric: 'tabular-nums', direction: 'ltr',
              }}>
                {CARD_SHEBA}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Proof upload ──────────────────────────────────── */}
      <form onSubmit={handleSubmit}>
        <div style={{
          display: 'flex', gap: '0.4rem', marginBottom: '1.25rem',
          background: 'var(--surface-raised)', borderRadius: '9999px',
          padding: '0.3rem', width: 'fit-content',
        }}>
          {(['screenshot', 'tracking'] as const).map(t => (
            <button
              key={t} type="button" onClick={() => setProofType(t)}
              style={{
                padding: '0.45rem 1.1rem', borderRadius: '9999px',
                fontSize: '0.78rem', fontWeight: 500,
                border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                background: proofType === t ? 'var(--accent)' : 'transparent',
                color:      proofType === t ? 'var(--accent-fg)' : 'var(--muted)',
                transition: 'all 0.15s',
              }}
            >
              {t === 'screenshot' ? 'آپلود رسید' : 'شماره پیگیری'}
            </button>
          ))}
        </div>

        {proofType === 'screenshot' ? (
          <>
            <input
              ref={fileRef} type="file" accept="image/*"
              style={{ display: 'none' }}
              onChange={e => setFile(e.target.files?.[0] ?? null)}
            />
            <button
              type="button" onClick={() => fileRef.current?.click()}
              style={{
                width: '100%', padding: '2rem 1rem',
                border: `1px dashed ${file ? 'var(--accent)' : 'var(--border-strong)'}`,
                borderRadius: '0.75rem',
                background: file ? 'rgba(196,151,58,0.05)' : 'transparent',
                color:      file ? 'var(--accent)' : 'var(--subtle)',
                fontSize: '0.85rem', cursor: 'pointer', fontFamily: 'inherit',
                transition: 'all 0.15s', direction: 'rtl',
              }}
            >
              {file ? file.name : 'انتخاب تصویر رسید پرداخت'}
            </button>
          </>
        ) : (
          <div>
            <label htmlFor="tracking" style={lbl}>شماره پیگیری تراکنش</label>
            <input
              id="tracking" type="text"
              value={tracking}
              onChange={e => setTracking(e.target.value)}
              onFocus={() => setTrackingFocused(true)}
              onBlur={() => setTrackingFocused(false)}
              style={{ ...input, direction: 'ltr', borderColor: trackingFocused ? 'var(--accent)' : 'var(--border)' }}
            />
          </div>
        )}

        {status === 'error' && (
          <p style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--subtle)', lineHeight: 1.7 }}>
            مشکلی پیش آمد. دوباره امتحان کن.
          </p>
        )}

        <button
          type="submit"
          disabled={status === 'submitting'}
          style={{
            ...btn, marginTop: '1.5rem',
            opacity: status === 'submitting' ? 0.65 : 1,
            cursor:  status === 'submitting' ? 'wait' : 'pointer',
          }}
        >
          {status === 'submitting' ? '...' : 'ثبت پرداخت'}
        </button>
      </form>
    </div>
  )
}

// ── Success step ──────────────────────────────────────────────
function SuccessStep({ afCode }: { afCode: string }) {
  return (
    <div
      dir="rtl"
      style={{
        maxWidth: '480px',
        padding: '2.5rem 2rem',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '1rem',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
        background: 'linear-gradient(90deg, transparent, var(--accent), transparent)',
        opacity: 0.6,
      }} />

      <div style={{ width: '2rem', height: '1px', background: 'var(--accent)', opacity: 0.65, marginBottom: '1.5rem' }} />

      <h3 style={{
        fontSize: 'clamp(1.1rem, 2vw, 1.3rem)', fontWeight: 600,
        lineHeight: 1.35, color: 'var(--foreground)', marginBottom: '1.5rem',
      }}>
        پرداخت شما ثبت شد.
      </h3>

      <p style={{ fontSize: '0.72rem', color: 'var(--subtle)', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>
        شناسه شما
      </p>
      <p style={{
        fontSize: 'clamp(1.6rem, 4vw, 2.1rem)', fontWeight: 700,
        color: 'var(--accent)', letterSpacing: '0.12em',
        fontVariantNumeric: 'tabular-nums', marginBottom: '2rem', lineHeight: 1,
      }}>
        {afCode}
      </p>

      <p style={{ fontSize: '0.9rem', color: 'var(--muted)', lineHeight: 2, marginBottom: '2rem' }}>
        برای فعال‌سازی دسترسی،<br />
        این شناسه را در اینستاگرام برای<br />
        <span style={{ color: 'var(--accent)', fontWeight: 600 }}>@ashkanfaraa</span><br />
        ارسال کنید.
      </p>

      <a
        href="https://instagram.com/ashkanfaraa"
        target="_blank" rel="noopener noreferrer"
        style={btn as React.CSSProperties}
      >
        رفتن به اینستاگرام
      </a>
    </div>
  )
}

// ── Controller ────────────────────────────────────────────────
export function CourseForm({ onPaymentMode }: { onPaymentMode?: () => void }) {
  const [step,    setStep]    = useState<Step>('application')
  const [appData, setAppData] = useState<AppData | null>(null)
  const [afCode,  setAfCode]  = useState('')

  if (step === 'success') {
    return <SuccessStep afCode={afCode} />
  }

  if (step === 'payment' && appData) {
    return (
      <PaymentStep
        appData={appData}
        onSuccess={code => { setAfCode(code); setStep('success') }}
      />
    )
  }

  return (
    <ApplicationStep
      onNext={data => {
        setAppData(data)
        onPaymentMode?.()
        // Switch to PaymentStep after sales sections have faded out
        setTimeout(() => setStep('payment'), 420)
      }}
    />
  )
}
