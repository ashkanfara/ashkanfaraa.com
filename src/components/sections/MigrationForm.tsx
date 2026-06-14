'use client'

import { useState, useEffect, FormEvent } from 'react'

// ── Design tokens (shared with site) ──────────────────────────
const input: React.CSSProperties = {
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
const sectionLbl: React.CSSProperties = {
  fontSize: '0.6rem', letterSpacing: '0.2em',
  textTransform: 'uppercase', color: 'var(--subtle)',
}

// ── Options ────────────────────────────────────────────────────
const DESTINATIONS = [
  { value: 'Australia',    label: 'استرالیا' },
  { value: 'Canada',       label: 'کانادا' },
  { value: 'New Zealand',  label: 'نیوزیلند' },
  { value: 'USA',          label: 'آمریکا' },
  { value: 'Europe',       label: 'اروپا' },
  { value: 'Not Sure',     label: 'مطمئن نیستم' },
]
const PATHWAYS = [
  { value: 'Student',            label: 'تحصیلی' },
  { value: 'Skilled Migration',  label: 'مهارتی' },
  { value: 'Employer Sponsored', label: 'حمایت کارفرما' },
  { value: 'Partner Visa',       label: 'ویزای همسر' },
  { value: 'Business/Investor',  label: 'کسب‌وکار / سرمایه‌گذار' },
  { value: 'Not Sure',           label: 'مطمئن نیستم' },
]
const AGE_RANGES = [
  { value: 'Under 25', label: 'زیر ۲۵' },
  { value: '25-34',    label: '۲۵–۳۴' },
  { value: '35-44',    label: '۳۵–۴۴' },
  { value: '45+',      label: '۴۵ به بالا' },
]
const ENGLISH_LEVELS = [
  { value: 'No English',          label: 'فاقد زبان' },
  { value: 'Basic',               label: 'مقدماتی' },
  { value: 'Intermediate',        label: 'متوسط' },
  { value: 'Advanced',            label: 'پیشرفته' },
  { value: 'IELTS/PTE Completed', label: 'آیلتس / PTE دارم' },
]
const EDUCATIONS = [
  { value: 'High School', label: 'دیپلم' },
  { value: 'Diploma',     label: 'فوق دیپلم' },
  { value: 'Bachelor',    label: 'لیسانس' },
  { value: 'Master',      label: 'فوق‌لیسانس' },
  { value: 'PhD',         label: 'دکترا' },
]
const BUDGETS = [
  { value: 'Under 5k AUD',  label: 'زیر ۵,۰۰۰ دلار استرالیا' },
  { value: '5k-15k AUD',    label: '۵,۰۰۰ تا ۱۵,۰۰۰ دلار' },
  { value: '15k-30k AUD',   label: '۱۵,۰۰۰ تا ۳۰,۰۰۰ دلار' },
  { value: '30k+ AUD',      label: 'بیش از ۳۰,۰۰۰ دلار' },
]

// ── Reusable pill selector ─────────────────────────────────────
function PillSelect({
  options, value, onChange, error,
}: {
  options: { value: string; label: string }[]
  value: string
  onChange: (v: string) => void
  error?: boolean
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
      {options.map(opt => {
        const selected = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            style={{
              padding: '0.45rem 1rem', borderRadius: '9999px',
              border: `1px solid ${selected ? 'var(--accent)' : error ? 'rgba(192,100,60,0.5)' : 'var(--border-strong)'}`,
              background: selected ? 'rgba(196,151,58,0.12)' : 'transparent',
              color: selected ? 'var(--accent)' : 'var(--muted)',
              fontSize: '0.82rem', cursor: 'pointer',
              fontFamily: 'inherit', transition: 'all 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

// ── Field wrapper ──────────────────────────────────────────────
function Field({ label, required, error, children }: {
  label: string; required?: boolean; error?: string; children: React.ReactNode
}) {
  return (
    <div>
      <label style={lbl}>
        {label}
        {required && <span style={{ color: 'var(--accent)', marginRight: '0.2rem', opacity: 0.8 }}> *</span>}
      </label>
      {children}
      {error && (
        <p style={{ marginTop: '0.4rem', fontSize: '0.72rem', color: 'rgba(200,110,70,0.9)', lineHeight: 1.5 }}>
          {error}
        </p>
      )}
    </div>
  )
}

// ── Section divider ────────────────────────────────────────────
function Section({ title }: { title: string }) {
  return (
    <div style={{ paddingTop: '2rem', marginBottom: '1.25rem', borderTop: '1px solid var(--border)' }}>
      <p style={sectionLbl}>{title}</p>
    </div>
  )
}

// ── Validation ─────────────────────────────────────────────────
function validate(values: Record<string, string>) {
  const e: Record<string, string> = {}
  if (!values.name?.trim())        e.name        = 'نام الزامی است'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email?.trim() || ''))
                                   e.email       = 'ایمیل معتبر وارد کن'
  if (!values.mobile?.trim())      e.mobile      = 'شماره موبایل الزامی است'
  if (!values.country?.trim())     e.country     = 'کشور فعلی الزامی است'
  if (!values.destination)         e.destination = 'کشور مقصد را انتخاب کن'
  if (!values.pathway)             e.pathway     = 'مسیر مهاجرت را انتخاب کن'
  if (!values.budget)              e.budget      = 'بودجه تقریبی را انتخاب کن'
  if (values.consent !== 'true')   e.consent     = 'تأیید رضایت الزامی است'
  return e
}

// ── Main component ─────────────────────────────────────────────
export function MigrationForm() {
  const [values,  setValues]  = useState<Record<string, string>>({})
  const [touched, setTouched] = useState<Set<string>>(new Set())
  const [focused, setFocused] = useState<string | null>(null)
  const [status,  setStatus]  = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [leadId,  setLeadId]  = useState('')
  const [apiError, setApiError] = useState('')
  const [source,  setSource]  = useState<Record<string,string>>({})

  // ── Capture UTM / referrer on mount ────────────────────────
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    setSource({
      source:      p.get('source')       || '',
      utmSource:   p.get('utm_source')   || '',
      utmMedium:   p.get('utm_medium')   || '',
      utmCampaign: p.get('utm_campaign') || '',
      referrer:    document.referrer     || '',
    })
  }, [])

  const errors = validate(values)
  const set = (k: string, v: string) => setValues(p => ({ ...p, [k]: v }))
  const touch = (k: string) => setTouched(p => new Set([...p, k]))

  function fieldBorder(id: string) {
    if (touched.has(id) && errors[id]) return 'rgba(192,100,60,0.7)'
    if (focused === id)                return 'var(--accent)'
    return 'var(--border)'
  }

  function fieldError(id: string) {
    return touched.has(id) ? errors[id] : undefined
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setTouched(new Set(Object.keys(errors).concat(['name','email','mobile','country','destination','pathway','budget','consent'])))
    if (Object.keys(errors).length > 0) return

    setStatus('submitting')
    setApiError('')

    try {
      const res = await fetch('/api/migration', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values,
          language:    'FA',
          source:      source.source      || '',
          utmSource:   source.utmSource   || '',
          utmMedium:   source.utmMedium   || '',
          utmCampaign: source.utmCampaign || '',
          referrer:    source.referrer    || '',
          website:     values.website     || '',  // honeypot
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'خطا در ارسال. دوباره امتحان کن.')
      setLeadId(data.leadId)
      setStatus('success')
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'خطا در ارسال. دوباره امتحان کن.')
      setStatus('error')
    }
  }

  // ── Success state ───────────────────────────────────────────
  if (status === 'success') {
    const detailedUrl = `/migration-assistance/detailed?leadId=${encodeURIComponent(leadId)}&dest=${encodeURIComponent(values.destination || '')}`
    return (
      <div dir="rtl" style={{ maxWidth: '560px', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        {/* Confirmation card */}
        <div style={{ padding: '2.5rem 2rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '0.875rem' }}>
          <div style={{ width: '2rem', height: '1px', background: 'var(--accent)', opacity: 0.65, marginBottom: '1.75rem' }} />
          <p style={{ fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--subtle)', marginBottom: '0.75rem' }}>
            شناسه درخواست شما
          </p>
          <p style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.1em', marginBottom: '1.75rem', fontVariantNumeric: 'tabular-nums' }}>
            {leadId}
          </p>
          <p style={{ fontSize: '0.9rem', color: 'var(--muted)', lineHeight: 1.9 }}>
            درخواست شما ثبت شد. پس از بررسی اطلاعات، در صورت مناسب بودن شرایط، ممکن است برای مراحل بعدی با شما تماس گرفته شود.
          </p>
        </div>

        {/* Optional detailed assessment CTA */}
        <div style={{ padding: '1.5rem 1.75rem', background: 'var(--surface-raised)', border: '1px solid var(--border)', borderRadius: '0.875rem' }}>
          <p style={{ fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--subtle)', marginBottom: '0.875rem' }}>
            مرحله اختیاری
          </p>
          <p style={{ fontSize: '0.85rem', color: 'var(--muted)', lineHeight: 1.85, marginBottom: '1.25rem' }}>
            اگر می‌خواهید بررسی دقیق‌تری دریافت کنید، می‌توانید فرم ارزیابی تفصیلی را تکمیل کنید. این مرحله اختیاری است و اطلاعات بیشتری برای ارزیابی دقیق‌تر پرونده شما فراهم می‌کند.
          </p>
          <a
            href={detailedUrl}
            style={{
              display: 'inline-flex', alignItems: 'center',
              borderRadius: '9999px', border: '1px solid var(--accent)',
              color: 'var(--accent)', background: 'transparent',
              padding: '0.7rem 1.75rem', fontSize: '0.82rem', fontWeight: 600,
              letterSpacing: '0.04em', textDecoration: 'none', fontFamily: 'inherit',
            }}
          >
            تکمیل ارزیابی تفصیلی ←
          </a>
        </div>

      </div>
    )
  }

  // ── Form ────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} noValidate dir="rtl" style={{ maxWidth: '600px' }}>

      {/* Honeypot — hidden from users */}
      <input
        type="text" name="website" tabIndex={-1} autoComplete="off"
        aria-hidden="true"
        style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', overflow: 'hidden', opacity: 0 }}
        value={values.website || ''}
        onChange={e => set('website', e.target.value)}
      />

      {/* ── SECTION 1 ── */}
      <Section title="اطلاعات تماس" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        <Field label="نام و نام خانوادگی" required error={fieldError('name')}>
          <input style={{ ...input, borderColor: fieldBorder('name') }}
            value={values.name || ''} type="text"
            onChange={e => set('name', e.target.value)}
            onFocus={() => setFocused('name')}
            onBlur={() => { setFocused(null); touch('name') }} />
        </Field>

        <Field label="ایمیل" required error={fieldError('email')}>
          <input style={{ ...input, borderColor: fieldBorder('email'), direction: 'ltr' }}
            value={values.email || ''} type="email"
            onChange={e => set('email', e.target.value)}
            onFocus={() => setFocused('email')}
            onBlur={() => { setFocused(null); touch('email') }} />
        </Field>

        <Field label="شماره موبایل" required error={fieldError('mobile')}>
          <input style={{ ...input, borderColor: fieldBorder('mobile'), direction: 'ltr' }}
            value={values.mobile || ''} type="tel" placeholder="+98..."
            onChange={e => set('mobile', e.target.value)}
            onFocus={() => setFocused('mobile')}
            onBlur={() => { setFocused(null); touch('mobile') }} />
        </Field>

        <Field label="واتساپ (اختیاری)">
          <input style={{ ...input, direction: 'ltr' }}
            value={values.whatsapp || ''} type="tel" placeholder="+..."
            onChange={e => set('whatsapp', e.target.value)} />
        </Field>

        <Field label="آیدی تلگرام (اختیاری)">
          <input style={{ ...input, direction: 'ltr' }}
            value={values.telegram || ''} type="text" placeholder="@"
            onChange={e => set('telegram', e.target.value)} />
        </Field>

        <Field label="کشور فعلی محل سکونت" required error={fieldError('country')}>
          <input style={{ ...input, borderColor: fieldBorder('country') }}
            value={values.country || ''} type="text"
            onChange={e => set('country', e.target.value)}
            onFocus={() => setFocused('country')}
            onBlur={() => { setFocused(null); touch('country') }} />
        </Field>

      </div>

      {/* ── SECTION 2 ── */}
      <Section title="اهداف مهاجرتی" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        <Field label="کشور مقصد مورد نظر" required error={fieldError('destination')}>
          <PillSelect options={DESTINATIONS} value={values.destination || ''}
            onChange={v => { set('destination', v); touch('destination') }}
            error={!!fieldError('destination')} />
        </Field>

        <Field label="مسیر مهاجرتی" required error={fieldError('pathway')}>
          <PillSelect options={PATHWAYS} value={values.pathway || ''}
            onChange={v => { set('pathway', v); touch('pathway') }}
            error={!!fieldError('pathway')} />
        </Field>

      </div>

      {/* ── SECTION 3 ── */}
      <Section title="پیش‌زمینه شما" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        <Field label="محدوده سنی (اختیاری)">
          <PillSelect options={AGE_RANGES} value={values.ageRange || ''}
            onChange={v => set('ageRange', v)} />
        </Field>

        <Field label="سطح زبان انگلیسی (اختیاری)">
          <PillSelect options={ENGLISH_LEVELS} value={values.english || ''}
            onChange={v => set('english', v)} />
        </Field>

        <Field label="بالاترین مدرک تحصیلی (اختیاری)">
          <PillSelect options={EDUCATIONS} value={values.education || ''}
            onChange={v => set('education', v)} />
        </Field>

        <Field label="شغل فعلی (اختیاری)">
          <input style={input} value={values.occupation || ''} type="text"
            onChange={e => set('occupation', e.target.value)} />
        </Field>

      </div>

      {/* ── SECTION 4 ── */}
      <Section title="آمادگی مالی" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        <Field label="بودجه تقریبی برای مهاجرت" required error={fieldError('budget')}>
          <PillSelect options={BUDGETS} value={values.budget || ''}
            onChange={v => { set('budget', v); touch('budget') }}
            error={!!fieldError('budget')} />
        </Field>

      </div>

      {/* ── SECTION 5 ── */}
      <Section title="توضیحات بیشتر" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        <Field label="چرا می‌خواهید مهاجرت کنید؟ (اختیاری)">
          <textarea style={{ ...input, resize: 'vertical', minHeight: '100px' }}
            value={values.whyMigrate || ''} rows={4}
            onChange={e => set('whyMigrate', e.target.value)} />
        </Field>

        <Field label="اگر اطلاعات مهم دیگری وجود دارد، اینجا بنویسید (اختیاری)">
          <textarea style={{ ...input, resize: 'vertical', minHeight: '80px' }}
            value={values.notes || ''} rows={3}
            onChange={e => set('notes', e.target.value)} />
        </Field>

      </div>

      {/* ── Consent ─────────────────────────────────────────── */}
      <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={values.consent === 'true'}
            onChange={e => { set('consent', e.target.checked ? 'true' : 'false'); touch('consent') }}
            style={{ marginTop: '0.2rem', accentColor: 'var(--accent)', flexShrink: 0, width: '1rem', height: '1rem' }}
          />
          <span style={{ fontSize: '0.8rem', color: 'var(--subtle)', lineHeight: 1.75 }}>
            با ارسال این فرم موافقت می‌کنم اطلاعاتم برای بررسی اولیه و در صورت نیاز، ارتباط با مشاوران یا متخصصان مهاجرت معتبر استفاده شود.
          </span>
        </label>
        {touched.has('consent') && errors.consent && (
          <p style={{ marginTop: '0.4rem', fontSize: '0.72rem', color: 'rgba(200,110,70,0.9)' }}>
            {errors.consent}
          </p>
        )}
      </div>

      {/* ── Error ── */}
      {status === 'error' && apiError && (
        <div style={{ marginTop: '1rem', background: 'rgba(192,100,60,0.08)', border: '1px solid rgba(192,100,60,0.25)', borderRadius: '0.5rem', padding: '0.875rem 1rem' }}>
          <p style={{ fontSize: '0.82rem', color: 'rgba(220,130,90,0.95)', margin: 0 }}>{apiError}</p>
        </div>
      )}

      {/* ── Submit ── */}
      <button
        type="submit"
        disabled={status === 'submitting'}
        style={{
          marginTop: '1.75rem',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: '9999px', background: 'var(--accent)', color: 'var(--accent-fg)',
          padding: '0.9rem 2.5rem', fontSize: '0.9rem', fontWeight: 600,
          letterSpacing: '0.04em', border: 'none', fontFamily: 'inherit',
          cursor: status === 'submitting' ? 'wait' : 'pointer',
          opacity: status === 'submitting' ? 0.6 : 1,
          transition: 'opacity 0.15s', whiteSpace: 'nowrap',
        }}
      >
        {status === 'submitting' ? 'در حال ارسال…' : 'ارسال اطلاعات'}
      </button>

    </form>
  )
}
