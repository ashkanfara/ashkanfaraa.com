'use client'

import { useState, FormEvent, useRef, Fragment } from 'react'

// ── Types ─────────────────────────────────────────────────────
type Step = 'application' | 'payment' | 'success'

interface AppData {
  name:      string
  instagram: string
  email:     string
  phone:     string
  telegram:  string
  location:  string
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

// ── Step indicator ─────────────────────────────────────────────
const STEP_LABELS = ['پرسشنامه', 'پرداخت', 'کد دسترسی']

function StepIndicator({ current }: { current: 2 | 3 }) {
  return (
    <div dir="rtl" style={{
      display: 'flex', alignItems: 'flex-start',
      marginBottom: '2.25rem',
    }}>
      {STEP_LABELS.map((label, i) => {
        const n      = i + 1
        const done   = n < current
        const active = n === current
        return (
          <Fragment key={label}>
            {i > 0 && (
              <div style={{
                flex: 1, height: '1px', marginTop: '3px',
                background: done ? 'var(--accent)' : 'var(--border)',
                opacity: done ? 0.45 : 0.6,
              }} />
            )}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem' }}>
              <div style={{
                width: '6px', height: '6px', borderRadius: '50%',
                background: active || done ? 'var(--accent)' : 'transparent',
                border: `1px solid ${active || done ? 'var(--accent)' : 'var(--border-strong)'}`,
                opacity: done ? 0.5 : 1,
              }} />
              <span style={{
                fontSize: '0.57rem', letterSpacing: '0.04em', whiteSpace: 'nowrap',
                color: active ? 'var(--accent)' : 'var(--subtle)',
                opacity: done ? 0.5 : 1,
              }}>
                {label}
              </span>
            </div>
          </Fragment>
        )
      })}
    </div>
  )
}

// ── Application step ──────────────────────────────────────────
const APP_FIELDS = [
  { id: 'name',      label: 'نام و نام خانوادگی', type: 'text',  placeholder: '',  required: true  },
  { id: 'instagram', label: 'آیدی اینستاگرام',    type: 'text',  placeholder: '@', required: true  },
  { id: 'email',     label: 'ایمیل',               type: 'email', placeholder: '',  required: true  },
  { id: 'phone',     label: 'شماره موبایل',        type: 'tel',   placeholder: '',  required: true  },
  { id: 'telegram',  label: 'آیدی تلگرام',         type: 'text',  placeholder: '@', required: false },
  { id: 'location',  label: 'شهر و کشور فعلی',    type: 'text',  placeholder: '',  required: false },
] as const

function ApplicationStep({ onNext }: { onNext: (data: AppData) => void }) {
  const [values,  setValues]  = useState<Record<string, string>>({})
  const [focused, setFocused] = useState<string | null>(null)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    onNext({
      name:      values.name      ?? '',
      instagram: values.instagram ?? '',
      email:     values.email     ?? '',
      phone:     values.phone     ?? '',
      telegram:  values.telegram  ?? '',
      location:  values.location  ?? '',
    })
  }

  return (
    <form onSubmit={handleSubmit} noValidate style={{ maxWidth: '560px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
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
  onBack,
}: {
  appData:   AppData
  onSuccess: (afCode: string) => void
  onBack:    () => void
}) {
  const [proofType,       setProofType]       = useState<'screenshot' | 'tracking'>('screenshot')
  const [file,            setFile]            = useState<File | null>(null)
  const [tracking,        setTracking]        = useState('')
  const [status,          setStatus]          = useState<'idle' | 'submitting' | 'error'>('idle')
  const [trackingFocused, setTrackingFocused] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (proofType === 'screenshot' && !file)           return
    if (proofType === 'tracking'   && !tracking.trim()) return

    setStatus('submitting')
    try {
      const fd = new FormData()
      Object.entries(appData).forEach(([k, v]) => fd.append(k, v))
      fd.append('proofType', proofType)
      if (proofType === 'screenshot' && file) fd.append('screenshot', file)
      if (proofType === 'tracking')           fd.append('tracking', tracking.trim())

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
      <StepIndicator current={2} />

      {/* Payment card */}
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

      {/* Proof upload */}
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

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
          <button
            type="submit"
            disabled={status === 'submitting'}
            style={{
              ...btn,
              opacity: status === 'submitting' ? 0.65 : 1,
              cursor:  status === 'submitting' ? 'wait' : 'pointer',
            }}
          >
            {status === 'submitting' ? '...' : 'ثبت پرداخت'}
          </button>

          <button
            type="button"
            onClick={onBack}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: '9999px',
              background: 'transparent',
              border: '1px solid var(--border-strong)',
              color: 'var(--subtle)',
              padding: '0.9rem 1.75rem',
              fontSize: '0.9rem', fontWeight: 500,
              cursor: 'pointer', fontFamily: 'inherit',
              whiteSpace: 'nowrap', transition: 'border-color 0.15s, color 0.15s',
            }}
          >
            بازگشت
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Success step ──────────────────────────────────────────────
function SuccessStep({ afCode }: { afCode: string }) {
  const [copied, setCopied] = useState(false)

  function copyCode() {
    navigator.clipboard.writeText(afCode).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div dir="rtl" style={{ maxWidth: '520px' }}>
      <StepIndicator current={3} />

      {/* Accent rule */}
      <div style={{ width: '2rem', height: '1px', background: 'var(--accent)', opacity: 0.65, marginBottom: '1.75rem' }} />

      <p style={{
        fontSize: 'clamp(1rem, 1.8vw, 1.2rem)', fontWeight: 500,
        color: 'var(--foreground)', lineHeight: 1.5, marginBottom: '2.5rem',
      }}>
        دسترسی شما ثبت شد.
      </p>

      {/* AF Code — centrepiece */}
      <p style={{ fontSize: '0.65rem', letterSpacing: '0.18em', color: 'var(--subtle)', marginBottom: '0.75rem' }}>
        کد دسترسی اختصاصی شما
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
        <p style={{
          fontSize: 'clamp(2.8rem, 8vw, 4.5rem)', fontWeight: 700,
          color: 'var(--accent)', letterSpacing: '0.1em',
          fontVariantNumeric: 'tabular-nums', lineHeight: 1, margin: 0,
        }}>
          {afCode}
        </p>

        <button
          onClick={copyCode}
          style={{
            background: 'var(--surface-raised)',
            border: `1px solid ${copied ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius: '0.5rem',
            padding: '0.45rem 0.9rem',
            fontSize: '0.72rem', fontWeight: 500,
            color: copied ? 'var(--accent)' : 'var(--subtle)',
            cursor: 'pointer', fontFamily: 'inherit',
            transition: 'all 0.2s', whiteSpace: 'nowrap',
          }}
        >
          {copied ? '✓ کپی شد' : 'کپی کد'}
        </button>
      </div>

      {/* Divider */}
      <div style={{ height: '1px', background: 'var(--border)', margin: '2rem 0' }} />

      {/* Instructions */}
      <p style={{ fontSize: '0.9rem', color: 'var(--muted)', lineHeight: 2, marginBottom: '0.75rem' }}>
        این کد را در اینستاگرام برای{' '}
        <span style={{ color: 'var(--accent)', fontWeight: 600 }}>@ashkanfaraa</span>{' '}
        ارسال کنید.
      </p>

      <p style={{ fontSize: '0.78rem', color: 'var(--subtle)', marginBottom: '2rem', lineHeight: 1.7 }}>
        معمولاً کمتر از ۲۴ ساعت پاسخ دریافت می‌کنید.
      </p>

      <a
        href="https://www.instagram.com/ashkanfaraa/"
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
        onBack={() => setStep('application')}
      />
    )
  }

  return (
    <ApplicationStep
      onNext={data => {
        setAppData(data)
        onPaymentMode?.()
        setTimeout(() => setStep('payment'), 420)
      }}
    />
  )
}
