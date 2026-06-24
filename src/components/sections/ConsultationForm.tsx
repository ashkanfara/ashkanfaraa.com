'use client'

import { useState, FormEvent, useRef, Fragment } from 'react'

// ── Types ─────────────────────────────────────────────────────
type Step    = 'application' | 'payment' | 'success'
type Region  = 'IR' | 'AU' | 'INT'
type Proof   = 'screenshot' | 'tracking'

interface AppData {
  name:      string
  instagram: string
  phone:     string
  location:  string
  email:     string
  subject:   string
  message:   string
}

// ── Region detection ──────────────────────────────────────────
function detectRegion(location: string): Region {
  const l = location.toLowerCase()
  if (/ایران|iran/.test(l))               return 'IR'
  if (/استرالیا|australia/.test(l))       return 'AU'
  return 'INT'
}

const REGION_PRICE: Record<Region, string> = {
  IR:  '۱۷٬۰۰۰٬۰۰۰ تومان',
  AU:  'AUD 250',
  INT: 'USD 99',
}

// ── Shared styles ─────────────────────────────────────────────
const inp: React.CSSProperties = {
  width: '100%', background: 'var(--surface-raised)',
  border: '1px solid var(--border)', borderRadius: '0.625rem',
  padding: '0.875rem 1rem', fontSize: '0.9rem',
  color: 'var(--foreground)', lineHeight: 1.5,
  outline: 'none', transition: 'border-color 0.15s',
  fontFamily: 'inherit', direction: 'rtl', boxSizing: 'border-box',
}
const lbl: React.CSSProperties = {
  display: 'block', fontSize: '0.78rem', color: 'var(--muted)',
  marginBottom: '0.5rem', letterSpacing: '0.02em',
}
const primaryBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: '9999px', background: 'var(--accent)', color: 'var(--accent-fg)',
  padding: '0.9rem 2.25rem', fontSize: '0.9rem', fontWeight: 600,
  letterSpacing: '0.04em', border: 'none', cursor: 'pointer',
  fontFamily: 'inherit', transition: 'opacity 0.15s', whiteSpace: 'nowrap',
  textDecoration: 'none',
}
const ghostBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: '9999px', background: 'transparent',
  border: '1px solid var(--border-strong)', color: 'var(--subtle)',
  padding: '0.9rem 1.75rem', fontSize: '0.9rem', fontWeight: 500,
  cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
  textDecoration: 'none', transition: 'border-color 0.15s, color 0.15s',
}

const CARD_HOLDER = process.env.NEXT_PUBLIC_CARD_HOLDER ?? 'اشکان فارا'
const CARD_NUMBER = process.env.NEXT_PUBLIC_CARD_NUMBER ?? '— — — —'
const CARD_SHEBA  = process.env.NEXT_PUBLIC_CARD_SHEBA  ?? ''

// ── Validation ────────────────────────────────────────────────
function normalizePhone(val: string): string {
  return val.replace(/[\s\-]/g, '').replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 1776))
}

function validateField(id: string, val: string): string | null {
  switch (id) {
    case 'name':     return val.trim().length === 0 ? 'نام الزامی است' : null
    case 'email':    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim()) ? null : 'یک ایمیل معتبر وارد کن'
    case 'phone': {
      const digits = normalizePhone(val)
      if (!digits.length) return 'شماره موبایل الزامی است'
      if (!/^\d+$/.test(digits)) return 'فقط عدد وارد کن'
      if (digits.length < 10) return 'شماره باید حداقل ۱۰ رقم باشد'
      return null
    }
    case 'location': return val.trim().length === 0 ? 'این فیلد الزامی است' : null
    case 'subject':  return val.trim().length === 0 ? 'این فیلد الزامی است' : null
    case 'message':  return val.trim().length === 0 ? 'این فیلد الزامی است' : null
    default:         return null
  }
}

const REQUIRED = ['name', 'email', 'phone', 'location', 'subject', 'message']

interface Field {
  id: string; label: string; type: 'text' | 'email' | 'tel' | 'textarea'
  placeholder: string; required: boolean; rows?: number
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

// ── Step indicator ────────────────────────────────────────────
const STEP_LABELS = ['درخواست', 'پرداخت', 'تأیید']

function StepIndicator({ current }: { current: 2 | 3 }) {
  return (
    <div dir="rtl" style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '2.25rem' }}>
      {STEP_LABELS.map((label, i) => {
        const n = i + 1; const done = n < current; const active = n === current
        return (
          <Fragment key={label}>
            {i > 0 && (
              <div style={{ flex: 1, height: '1px', marginTop: '3px', background: done ? 'var(--accent)' : 'var(--border)', opacity: done ? 0.45 : 0.6 }} />
            )}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: active || done ? 'var(--accent)' : 'transparent', border: `1px solid ${active || done ? 'var(--accent)' : 'var(--border-strong)'}`, opacity: done ? 0.5 : 1 }} />
              <span style={{ fontSize: '0.57rem', letterSpacing: '0.04em', whiteSpace: 'nowrap', color: active ? 'var(--accent)' : 'var(--subtle)', opacity: done ? 0.5 : 1 }}>{label}</span>
            </div>
          </Fragment>
        )
      })}
    </div>
  )
}

// ── Application step ──────────────────────────────────────────
function ApplicationStep({ onNext }: { onNext: (data: AppData) => void }) {
  const [values,  setValues]  = useState<Record<string, string>>({})
  const [focused, setFocused] = useState<string | null>(null)
  const [touched, setTouched] = useState<Set<string>>(new Set())
  const [status,  setStatus]  = useState<'idle' | 'submitting' | 'error'>('idle')

  const isValid = REQUIRED.every(id => validateField(id, values[id] ?? '') === null)

  function handleChange(id: string, val: string) {
    if (id === 'phone') {
      const cleaned = val.replace(/[\s\-]/g, '').split('').filter(c => /[\d۰-۹]/.test(c)).join('')
      setValues(p => ({ ...p, phone: cleaned }))
    } else {
      setValues(p => ({ ...p, [id]: val }))
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setTouched(new Set(REQUIRED))
    if (!isValid) return
    setStatus('submitting')

    try {
      const res = await fetch('/api/consultation', {
        method:  'POST',
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
      const data = await res.json().catch(() => ({}))
      // Pass notionPageId (may be undefined if Notion save failed — handled downstream)
      onNext({
        name:      values.name,
        instagram: values.instagram ?? '',
        phone:     normalizePhone(values.phone ?? ''),
        location:  values.location,
        email:     values.email,
        subject:   values.subject,
        message:   values.message,
        // Stash notionPageId in name field is wrong — carry separately via closure
        // onNext receives AppData; notionPageId is returned from this fetch
        // We extend AppData with an optional notionPageId below:
        ...({ notionPageId: data.notionPageId ?? '' } as object),
      } as AppData & { notionPageId: string })
    } catch {
      setStatus('error')
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate style={{ maxWidth: '560px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {FIELDS.map(field => {
          const error     = validateField(field.id, values[field.id] ?? '')
          const showError = touched.has(field.id) && error !== null
          const borderColor = showError ? 'rgba(192,100,60,0.7)' : focused === field.id ? 'var(--accent)' : 'var(--border)'
          return (
            <div key={field.id}>
              <label htmlFor={field.id} style={lbl}>
                {field.label}
                {field.required && <span style={{ color: 'var(--accent)', marginRight: '0.2rem', opacity: 0.8 }}>*</span>}
              </label>
              {field.type === 'textarea' ? (
                <textarea id={field.id} rows={field.rows} value={values[field.id] ?? ''}
                  onChange={e => handleChange(field.id, e.target.value)}
                  onFocus={() => setFocused(field.id)}
                  onBlur={() => { setFocused(null); setTouched(p => new Set([...p, field.id])) }}
                  style={{ ...inp, resize: 'vertical', minHeight: '120px', borderColor }} />
              ) : (
                <input id={field.id} type={field.type} value={values[field.id] ?? ''}
                  onChange={e => handleChange(field.id, e.target.value)}
                  onFocus={() => setFocused(field.id)}
                  onBlur={() => { setFocused(null); setTouched(p => new Set([...p, field.id])) }}
                  style={{ ...inp, borderColor }} />
              )}
              {showError && <p style={{ marginTop: '0.4rem', fontSize: '0.72rem', color: 'rgba(200,110,70,0.9)', lineHeight: 1.5 }}>{error}</p>}
            </div>
          )
        })}
      </div>

      {status === 'error' && (
        <p style={{ marginTop: '1rem', fontSize: '0.8rem', color: 'var(--subtle)', lineHeight: 1.6 }}>
          مشکلی پیش آمد. لطفاً دوباره امتحان کن.
        </p>
      )}

      <button type="submit" disabled={!isValid || status === 'submitting'}
        style={{ ...primaryBtn, marginTop: '2rem', opacity: !isValid || status === 'submitting' ? 0.4 : 1, cursor: !isValid || status === 'submitting' ? 'not-allowed' : 'pointer' }}>
        {status === 'submitting' ? 'در حال ثبت…' : 'ادامه — پرداخت'}
      </button>
    </form>
  )
}

// ── Payment step ──────────────────────────────────────────────
function PaymentStep({
  appData, notionPageId, onSuccess, onBack,
}: {
  appData: AppData
  notionPageId: string
  onSuccess: (code: string) => void
  onBack: () => void
}) {
  const region    = detectRegion(appData.location)
  const price     = REGION_PRICE[region]
  const fileRef   = useRef<HTMLInputElement>(null)
  const [file,    setFile]    = useState<File | null>(null)
  const [proof,   setProof]   = useState<Proof>('screenshot')
  const [tracking, setTracking] = useState('')
  const [trackFocused, setTrackFocused] = useState(false)
  const [status,  setStatus]  = useState<'idle' | 'submitting' | 'redirecting' | 'error'>('idle')

  // ── INT: PayPal redirect ────────────────────────────────────
  async function handlePayPal() {
    setStatus('redirecting')
    try {
      const res  = await fetch('/api/consultation/paypal', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notionPageId, name: appData.name }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) throw new Error(data.error ?? 'PayPal error')
      window.location.href = data.url
    } catch {
      setStatus('error')
    }
  }

  // ── IR / AU: manual proof submit ───────────────────────────
  async function handleManual(e: FormEvent) {
    e.preventDefault()
    if (proof === 'tracking' && !tracking.trim()) return
    setStatus('submitting')

    try {
      const res = await fetch('/api/consultation/confirm', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notionPageId,
          region,
          proofType: proof,
          tracking:  proof === 'tracking' ? tracking.trim() : '',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'error')
      onSuccess(data.consCode)
    } catch {
      setStatus('error')
    }
  }

  // ── INT region: PayPal block ────────────────────────────────
  if (region === 'INT') {
    return (
      <div dir="rtl" style={{ maxWidth: '520px' }}>
        <StepIndicator current={2} />

        <p style={{ fontSize: '0.65rem', letterSpacing: '0.18em', color: 'var(--subtle)', marginBottom: '0.75rem' }}>
          مبلغ پرداختی
        </p>
        <p style={{ fontSize: 'clamp(2rem, 6vw, 3rem)', fontWeight: 700, color: 'var(--foreground)', letterSpacing: '-0.02em', marginBottom: '0.5rem' }}>
          {price}
        </p>
        <p style={{ fontSize: '0.78rem', color: 'var(--subtle)', marginBottom: '2rem', lineHeight: 1.7 }}>
          پرداخت از طریق PayPal
        </p>

        <div style={{ height: '1px', background: 'var(--border)', marginBottom: '2rem' }} />

        {status === 'error' && (
          <p style={{ marginBottom: '1rem', fontSize: '0.82rem', color: 'rgba(200,110,70,0.9)', lineHeight: 1.7 }}>
            مشکلی در اتصال به PayPal پیش آمد. دوباره امتحان کن.
          </p>
        )}

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button onClick={handlePayPal} disabled={status === 'redirecting'}
            style={{ ...primaryBtn, opacity: status === 'redirecting' ? 0.6 : 1, cursor: status === 'redirecting' ? 'wait' : 'pointer' }}>
            {status === 'redirecting' ? 'در حال انتقال به PayPal…' : 'پرداخت با PayPal'}
          </button>
          <button type="button" onClick={onBack} style={ghostBtn}>ویرایش اطلاعات</button>
        </div>

        <p style={{ marginTop: '1.25rem', fontSize: '0.72rem', color: 'var(--subtle)', lineHeight: 1.75, opacity: 0.7 }}>
          پس از تأیید پرداخت در PayPal، کد مشاوره شما صادر می‌شود.
        </p>
      </div>
    )
  }

  // ── IR / AU region: manual card payment ────────────────────
  return (
    <div dir="rtl" style={{ maxWidth: '520px' }}>
      <StepIndicator current={2} />

      <p style={{ fontSize: '0.65rem', letterSpacing: '0.18em', color: 'var(--subtle)', marginBottom: '0.75rem' }}>
        مبلغ پرداختی
      </p>
      <p style={{ fontSize: 'clamp(2rem, 6vw, 3rem)', fontWeight: 700, color: 'var(--foreground)', letterSpacing: '-0.02em', marginBottom: '0.5rem' }}>
        {price}
      </p>

      {/* AU temporary notice */}
      {region === 'AU' && (
        <div style={{ background: 'rgba(196,151,58,0.06)', border: '1px solid rgba(196,151,58,0.2)', borderRadius: '0.625rem', padding: '0.875rem 1rem', marginBottom: '1.5rem' }}>
          <p style={{ fontSize: '0.78rem', color: 'var(--muted)', lineHeight: 1.8, margin: 0 }}>
            پرداخت آنلاین برای استرالیا به زودی فعال می‌شود. در حال حاضر لطفاً از طریق اینستاگرام{' '}
            <span style={{ color: 'var(--accent)' }}>@ashkanfaraa</span>{' '}
            برای دریافت جزئیات پرداخت تماس بگیرید، سپس رسید پرداخت را اینجا ارسال کنید.
          </p>
        </div>
      )}

      {region === 'IR' && (
        <>
          {/* Card details */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '0.875rem', padding: '1.25rem', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            {[
              { label: 'صاحب حساب', value: CARD_HOLDER },
              { label: 'شماره کارت', value: CARD_NUMBER, mono: true },
              ...(CARD_SHEBA ? [{ label: 'شماره شبا', value: CARD_SHEBA, mono: true }] : []),
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--subtle)' }}>{row.label}</span>
                <span style={{ fontSize: '0.88rem', color: 'var(--foreground)', fontFamily: row.mono ? 'monospace, inherit' : 'inherit', letterSpacing: row.mono ? '0.04em' : 0, direction: 'ltr' }}>
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{ height: '1px', background: 'var(--border)', marginBottom: '1.5rem' }} />

      {/* Proof type toggle */}
      <p style={{ fontSize: '0.78rem', color: 'var(--muted)', marginBottom: '0.875rem' }}>ارسال مدرک پرداخت</p>
      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.25rem', background: 'var(--surface-raised)', borderRadius: '9999px', padding: '0.3rem', width: 'fit-content' }}>
        {(['screenshot', 'tracking'] as Proof[]).map(t => (
          <button key={t} type="button" onClick={() => setProof(t)}
            style={{ padding: '0.45rem 1.1rem', borderRadius: '9999px', fontSize: '0.78rem', fontWeight: 500, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: proof === t ? 'var(--accent)' : 'transparent', color: proof === t ? 'var(--accent-fg)' : 'var(--muted)', transition: 'all 0.15s' }}>
            {t === 'screenshot' ? 'آپلود رسید' : 'شماره پیگیری'}
          </button>
        ))}
      </div>

      <form onSubmit={handleManual}>
        {proof === 'screenshot' ? (
          <>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => setFile(e.target.files?.[0] ?? null)} />
            <button type="button" onClick={() => fileRef.current?.click()}
              style={{ width: '100%', padding: '2rem 1rem', border: `1px dashed ${file ? 'var(--accent)' : 'var(--border-strong)'}`, borderRadius: '0.75rem', background: file ? 'rgba(196,151,58,0.05)' : 'transparent', color: file ? 'var(--accent)' : 'var(--subtle)', fontSize: '0.85rem', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', direction: 'rtl' }}>
              {file ? file.name : 'انتخاب تصویر رسید پرداخت'}
            </button>
          </>
        ) : (
          <div>
            <label htmlFor="tracking" style={lbl}>شماره پیگیری تراکنش</label>
            <input id="tracking" type="text" value={tracking}
              onChange={e => setTracking(e.target.value)}
              onFocus={() => setTrackFocused(true)} onBlur={() => setTrackFocused(false)}
              style={{ ...inp, direction: 'ltr', borderColor: trackFocused ? 'var(--accent)' : 'var(--border)' }} />
          </div>
        )}

        {status === 'error' && (
          <p style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'rgba(200,110,70,0.9)', lineHeight: 1.7 }}>
            مشکلی پیش آمد. دوباره امتحان کن.
          </p>
        )}

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
          <button type="submit" disabled={status === 'submitting'}
            style={{ ...primaryBtn, opacity: status === 'submitting' ? 0.65 : 1, cursor: status === 'submitting' ? 'wait' : 'pointer' }}>
            {status === 'submitting' ? '…' : 'ثبت پرداخت'}
          </button>
          <button type="button" onClick={onBack} style={ghostBtn}>ویرایش اطلاعات</button>
        </div>
      </form>
    </div>
  )
}

// ── Success step ──────────────────────────────────────────────
function SuccessStep({ consCode }: { consCode: string }) {
  const [copied, setCopied] = useState(false)

  function copyCode() {
    navigator.clipboard.writeText(consCode).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div dir="rtl" style={{ maxWidth: '520px' }}>
      <StepIndicator current={3} />

      <div style={{ width: '2rem', height: '1px', background: 'var(--accent)', opacity: 0.65, marginBottom: '1.75rem' }} />

      <p style={{ fontSize: '0.65rem', letterSpacing: '0.18em', color: 'var(--subtle)', marginBottom: '0.75rem' }}>
        کد مشاوره شما
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
        <p style={{ fontSize: 'clamp(2rem, 7vw, 3.5rem)', fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.08em', fontVariantNumeric: 'tabular-nums', lineHeight: 1, margin: 0 }}>
          {consCode}
        </p>
        <button onClick={copyCode}
          style={{ background: 'var(--surface-raised)', border: `1px solid ${copied ? 'var(--accent)' : 'var(--border)'}`, borderRadius: '0.5rem', padding: '0.45rem 0.9rem', fontSize: '0.72rem', fontWeight: 500, color: copied ? 'var(--accent)' : 'var(--subtle)', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s', whiteSpace: 'nowrap' }}>
          {copied ? '✓ کپی شد' : 'کپی کد'}
        </button>
      </div>

      <div style={{ height: '1px', background: 'var(--border)', margin: '2rem 0' }} />

      <p style={{ fontSize: '0.9rem', color: 'var(--muted)', lineHeight: 2, marginBottom: '0.5rem' }}>
        درخواست مشاوره شما ثبت شد. لطفاً این کد را در دایرکت اینستاگرام برای ادمین ارسال کنید تا پرداخت بررسی و مرحله بعد هماهنگ شود.
      </p>
      <p style={{ fontSize: '0.9rem', color: 'var(--muted)', lineHeight: 2, marginBottom: '2rem' }}>
        ارسال کد به:{' '}
        <span style={{ color: 'var(--accent)', fontWeight: 600 }}>@ashkanfaraa</span>
      </p>

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <a href="https://www.instagram.com/ashkanfaraa/" target="_blank" rel="noopener noreferrer"
          style={primaryBtn as React.CSSProperties}>
          رفتن به اینستاگرام
        </a>
        <a href="/consultation" style={ghostBtn as React.CSSProperties}>بازگشت</a>
      </div>
    </div>
  )
}

// ── Controller ────────────────────────────────────────────────
export function ConsultationForm() {
  const [step,         setStep]         = useState<Step>('application')
  const [appData,      setAppData]      = useState<AppData | null>(null)
  const [notionPageId, setNotionPageId] = useState('')
  const [consCode,     setConsCode]     = useState('')

  if (step === 'success') return <SuccessStep consCode={consCode} />

  if (step === 'payment' && appData) {
    return (
      <PaymentStep
        appData={appData}
        notionPageId={notionPageId}
        onSuccess={code => { setConsCode(code); setStep('success') }}
        onBack={() => setStep('application')}
      />
    )
  }

  return (
    <ApplicationStep
      onNext={(data) => {
        const d = data as AppData & { notionPageId?: string }
        setAppData(d)
        setNotionPageId(d.notionPageId ?? '')
        setStep('payment')
      }}
    />
  )
}
