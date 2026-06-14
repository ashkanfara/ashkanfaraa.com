'use client'

import { useState, useEffect, FormEvent } from 'react'

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
const RELATIONSHIPS = [
  { value: 'Single',    label: 'مجرد' },
  { value: 'Married',   label: 'متأهل' },
  { value: 'De facto',  label: 'همسر عرفی (De Facto)' },
  { value: 'Divorced',  label: 'مطلقه / جدا' },
]
const CHILDREN_OPTS = [
  { value: 'None',  label: 'بدون فرزند' },
  { value: '1',     label: '۱ فرزند' },
  { value: '2',     label: '۲ فرزند' },
  { value: '3+',    label: '۳ یا بیشتر' },
]
const EDUCATION_OPTS = [
  { value: 'High School', label: 'دیپلم' },
  { value: 'Diploma',     label: 'فوق دیپلم' },
  { value: 'Bachelor',    label: 'لیسانس' },
  { value: 'Master',      label: 'فوق‌لیسانس' },
  { value: 'PhD',         label: 'دکترا' },
]
const ENGLISH_LEVELS = [
  { value: 'No English',          label: 'ندارم' },
  { value: 'Basic',               label: 'مقدماتی' },
  { value: 'Intermediate',        label: 'متوسط' },
  { value: 'Advanced',            label: 'پیشرفته' },
  { value: 'IELTS/PTE Completed', label: 'آیلتس / PTE دارم' },
]
const EXPERIENCE_OPTS = [
  { value: 'Under 1 year', label: 'کمتر از ۱ سال' },
  { value: '1-3 years',    label: '۱–۳ سال' },
  { value: '3-5 years',    label: '۳–۵ سال' },
  { value: '5-8 years',    label: '۵–۸ سال' },
  { value: '8+ years',     label: '۸ سال یا بیشتر' },
]
const ENGLISH_TESTS = [
  { value: 'IELTS',  label: 'IELTS' },
  { value: 'PTE',    label: 'PTE' },
  { value: 'TOEFL',  label: 'TOEFL' },
  { value: 'None',   label: 'هنوز نگرفتم' },
]
const SKILLS_ASSESSMENT_OPTS = [
  { value: 'Completed',    label: 'انجام شده' },
  { value: 'In Progress',  label: 'در حال انجام' },
  { value: 'Not Started',  label: 'شروع نشده' },
  { value: 'N/A',          label: 'مربوط نمی‌شود' },
]
const TIMELINE_OPTS = [
  { value: 'ASAP',          label: 'هرچه زودتر' },
  { value: '6-12 months',   label: '۶ تا ۱۲ ماه' },
  { value: '1-2 years',     label: '۱ تا ۲ سال' },
  { value: '2+ years',      label: 'بیش از ۲ سال' },
]
const SAVINGS_OPTS = [
  { value: 'Under 5k AUD', label: 'زیر ۵,۰۰۰ دلار' },
  { value: '5k-15k AUD',   label: '۵,۰۰۰ تا ۱۵,۰۰۰ دلار' },
  { value: '15k-30k AUD',  label: '۱۵,۰۰۰ تا ۳۰,۰۰۰ دلار' },
  { value: '30k-50k AUD',  label: '۳۰,۰۰۰ تا ۵۰,۰۰۰ دلار' },
  { value: '50k+ AUD',     label: 'بیش از ۵۰,۰۰۰ دلار' },
]
const GERMAN_LEVELS = [
  { value: 'None', label: 'ندارم' },
  { value: 'A1',   label: 'A1' },
  { value: 'A2',   label: 'A2' },
  { value: 'B1',   label: 'B1' },
  { value: 'B2',   label: 'B2' },
  { value: 'C1+',  label: 'C1 یا بالاتر' },
]
const GERMAN_PATHWAYS = [
  { value: 'Ausbildung',        label: 'آموزش حرفه‌ای (Ausbildung)' },
  { value: 'University',        label: 'دانشگاه' },
  { value: 'Skilled Employment',label: 'اشتغال ماهر' },
  { value: 'Job Seeker',        label: 'ویزای جستجوی کار' },
  { value: 'Not Sure',          label: 'مطمئن نیستم' },
]
const YES_NO = [
  { value: 'Yes', label: 'بله' },
  { value: 'No',  label: 'خیر' },
]
const EVIDENCE_OPTIONS = [
  { value: 'Payslips',              label: 'فیش حقوقی' },
  { value: 'Tax records',           label: 'اظهارنامه مالیاتی' },
  { value: 'Employment contracts',  label: 'قرارداد کار' },
  { value: 'Reference letters',     label: 'نامه توصیه' },
  { value: 'None',                  label: 'مدرکی ندارم' },
]

// ── Sub-components ─────────────────────────────────────────────
function PillSelect({ options, value, onChange, error }: {
  options: { value: string; label: string }[]
  value: string; onChange: (v: string) => void; error?: boolean
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
      {options.map(opt => {
        const sel = value === opt.value
        return (
          <button key={opt.value} type="button" onClick={() => onChange(opt.value)}
            style={{
              padding: '0.45rem 1rem', borderRadius: '9999px',
              border: `1px solid ${sel ? 'var(--accent)' : error ? 'rgba(192,100,60,0.5)' : 'var(--border-strong)'}`,
              background: sel ? 'rgba(196,151,58,0.12)' : 'transparent',
              color: sel ? 'var(--accent)' : 'var(--muted)',
              fontSize: '0.82rem', cursor: 'pointer',
              fontFamily: 'inherit', transition: 'all 0.15s', whiteSpace: 'nowrap',
            }}
          >{opt.label}</button>
        )
      })}
    </div>
  )
}

function Field({ label, required, error, hint, children }: {
  label: string; required?: boolean; error?: string; hint?: string; children: React.ReactNode
}) {
  return (
    <div>
      <label style={lbl}>
        {label}
        {required && <span style={{ color: 'var(--accent)', marginRight: '0.2rem', opacity: 0.8 }}> *</span>}
      </label>
      {hint && <p style={{ fontSize: '0.72rem', color: 'var(--subtle)', marginBottom: '0.6rem', lineHeight: 1.6 }}>{hint}</p>}
      {children}
      {error && (
        <p style={{ marginTop: '0.4rem', fontSize: '0.72rem', color: 'rgba(200,110,70,0.9)', lineHeight: 1.5 }}>
          {error}
        </p>
      )}
    </div>
  )
}

function Section({ title }: { title: string }) {
  return (
    <div style={{ paddingTop: '2.25rem', marginBottom: '1.5rem', borderTop: '1px solid var(--border)' }}>
      <p style={sectionLbl}>{title}</p>
    </div>
  )
}

function CheckboxGroup({ options, selected, onChange }: {
  options: { value: string; label: string }[]
  selected: Set<string>
  onChange: (v: string) => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      {options.map(opt => (
        <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={selected.has(opt.value)}
            onChange={() => onChange(opt.value)}
            style={{ accentColor: 'var(--accent)', width: '1rem', height: '1rem', flexShrink: 0 }}
          />
          <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>{opt.label}</span>
        </label>
      ))}
    </div>
  )
}

// ── Validation ─────────────────────────────────────────────────
function validate(v: Record<string, string>) {
  const e: Record<string, string> = {}
  if (!v.fullName?.trim())     e.fullName    = 'نام الزامی است'
  if (!v.dob?.trim())          e.dob         = 'تاریخ تولد الزامی است'
  if (!v.nationality?.trim())  e.nationality = 'ملیت الزامی است'
  if (!v.currentCountry?.trim()) e.currentCountry = 'کشور فعلی الزامی است'
  if (!v.relationship)         e.relationship = 'وضعیت تأهل را انتخاب کن'
  if (!v.education)            e.education   = 'مدرک تحصیلی را انتخاب کن'
  if (!v.experience)           e.experience  = 'سابقه کار را انتخاب کن'
  if (!v.englishTest)          e.englishTest = 'وضعیت آزمون زبان را انتخاب کن'
  if (!v.savings)              e.savings     = 'پس‌انداز تقریبی را انتخاب کن'
  if (!v.timeline)             e.timeline    = 'زمان‌بندی مهاجرت را انتخاب کن'
  if (v.consent !== 'true')    e.consent     = 'تأیید رضایت الزامی است'
  return e
}

// ── Main component ─────────────────────────────────────────────
export function MigrationDetailedForm({ leadId, destination }: { leadId: string; destination: string }) {
  const [v,       setV]       = useState<Record<string, string>>({ consent: 'false' })
  const [touched, setTouched] = useState<Set<string>>(new Set())
  const [focused, setFocused] = useState<string | null>(null)
  const [evidence, setEvidence] = useState<Set<string>>(new Set())
  const [status,  setStatus]  = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [refId,   setRefId]   = useState('')
  const [apiErr,  setApiErr]  = useState('')
  const [source,  setSource]  = useState<Record<string, string>>({})

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

  const errors = validate(v)
  const set    = (k: string, val: string) => setV(p => ({ ...p, [k]: val }))
  const touch  = (k: string) => setTouched(p => new Set([...p, k]))

  function fieldBorder(id: string) {
    if (touched.has(id) && errors[id]) return 'rgba(192,100,60,0.7)'
    if (focused === id)                return 'var(--accent)'
    return 'var(--border)'
  }
  function fieldError(id: string) { return touched.has(id) ? errors[id] : undefined }

  function toggleEvidence(val: string) {
    setEvidence(prev => {
      const next = new Set(prev)
      if (next.has(val)) next.delete(val)
      else               next.add(val)
      return next
    })
  }

  const hasPartner = v.relationship === 'Married' || v.relationship === 'De facto'
  const hasTest    = v.englishTest && v.englishTest !== 'None'
  const isAustralia = destination.toLowerCase().includes('australia') || destination === ''
  const isGermany   = destination.toLowerCase().includes('germany') || destination.toLowerCase().includes('europe')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const allRequired = ['fullName','dob','nationality','currentCountry','relationship','education','experience','englishTest','savings','timeline','consent']
    setTouched(new Set([...touched, ...allRequired]))
    if (Object.keys(errors).length > 0) return

    setStatus('submitting')
    setApiErr('')

    try {
      const res = await fetch('/api/migration/detailed', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...v,
          leadId,
          destination,
          evidence:    Array.from(evidence).join(', '),
          language:    'FA',
          source:      source.source      || '',
          utmSource:   source.utmSource   || '',
          utmMedium:   source.utmMedium   || '',
          utmCampaign: source.utmCampaign || '',
          referrer:    source.referrer    || '',
          website:     v.website          || '',
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'خطا در ارسال. دوباره امتحان کن.')
      setRefId(data.refId || leadId)
      setStatus('success')
    } catch (err) {
      setApiErr(err instanceof Error ? err.message : 'خطا در ارسال. دوباره امتحان کن.')
      setStatus('error')
    }
  }

  // ── Success ─────────────────────────────────────────────────
  if (status === 'success') {
    return (
      <div dir="rtl" style={{ maxWidth: '560px', padding: '2.5rem 2rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '0.875rem' }}>
        <div style={{ width: '2rem', height: '1px', background: 'var(--accent)', opacity: 0.65, marginBottom: '1.75rem' }} />
        <p style={{ fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--subtle)', marginBottom: '0.75rem' }}>
          ارزیابی تفصیلی ثبت شد
        </p>
        <p style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.1em', marginBottom: '1.75rem', fontVariantNumeric: 'tabular-nums' }}>
          {refId || leadId}
        </p>
        <p style={{ fontSize: '0.9rem', color: 'var(--muted)', lineHeight: 1.9 }}>
          ارزیابی تفصیلی شما دریافت شد. اطلاعات شما بررسی خواهد شد و در صورت تناسب، ممکن است با شما تماس گرفته شود.
        </p>
      </div>
    )
  }

  // ── Form ────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} noValidate dir="rtl" style={{ maxWidth: '640px' }}>

      {/* Honeypot */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true"
        style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', opacity: 0 }}
        value={v.website || ''} onChange={e => set('website', e.target.value)} />

      {/* Lead ID badge */}
      {leadId && (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem', marginBottom: '2rem', background: 'rgba(196,151,58,0.08)', border: '1px solid rgba(196,151,58,0.2)', borderRadius: '9999px', padding: '0.4rem 1rem' }}>
          <div style={{ width: '0.35rem', height: '0.35rem', borderRadius: '50%', background: 'var(--accent)', opacity: 0.8 }} />
          <span style={{ fontSize: '0.72rem', color: 'var(--accent)', letterSpacing: '0.08em' }}>
            شناسه پرونده: {leadId}
          </span>
        </div>
      )}

      {/* ── SECTION 1: Personal ── */}
      <Section title="اطلاعات شخصی" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        <Field label="نام و نام خانوادگی" required error={fieldError('fullName')}>
          <input style={{ ...input, borderColor: fieldBorder('fullName') }}
            value={v.fullName || ''} type="text"
            onChange={e => set('fullName', e.target.value)}
            onFocus={() => setFocused('fullName')}
            onBlur={() => { setFocused(null); touch('fullName') }} />
        </Field>

        <Field label="تاریخ تولد" required error={fieldError('dob')}
          hint="مثال: ۱۳۷۵/۰۵/۱۲ یا 1996-08-03">
          <input style={{ ...input, borderColor: fieldBorder('dob'), direction: 'ltr' }}
            value={v.dob || ''} type="text" placeholder="YYYY-MM-DD"
            onChange={e => set('dob', e.target.value)}
            onFocus={() => setFocused('dob')}
            onBlur={() => { setFocused(null); touch('dob') }} />
        </Field>

        <Field label="ملیت" required error={fieldError('nationality')}>
          <input style={{ ...input, borderColor: fieldBorder('nationality') }}
            value={v.nationality || ''} type="text"
            onChange={e => set('nationality', e.target.value)}
            onFocus={() => setFocused('nationality')}
            onBlur={() => { setFocused(null); touch('nationality') }} />
        </Field>

        <Field label="کشور فعلی محل سکونت" required error={fieldError('currentCountry')}>
          <input style={{ ...input, borderColor: fieldBorder('currentCountry') }}
            value={v.currentCountry || ''} type="text"
            onChange={e => set('currentCountry', e.target.value)}
            onFocus={() => setFocused('currentCountry')}
            onBlur={() => { setFocused(null); touch('currentCountry') }} />
        </Field>

        <Field label="وضعیت ویزای فعلی (اگر خارج از کشور مبدأ هستید، اختیاری)">
          <input style={input} value={v.currentVisa || ''} type="text"
            placeholder="مثلاً: ویزای دانشجویی استرالیا"
            onChange={e => set('currentVisa', e.target.value)} />
        </Field>

        <Field label="آیا قبلاً در کشور مقصد بوده‌اید یا حضور داشته‌اید؟">
          <PillSelect options={YES_NO} value={v.priorPresence || ''}
            onChange={val => set('priorPresence', val)} />
        </Field>

        <Field label="اعتبار پاسپورت (اختیاری)">
          <PillSelect
            options={[
              { value: 'Valid 1+ years', label: 'بیش از ۱ سال اعتبار' },
              { value: 'Valid under 1 year', label: 'کمتر از ۱ سال اعتبار' },
              { value: 'Expired', label: 'منقضی شده' },
            ]}
            value={v.passportStatus || ''}
            onChange={val => set('passportStatus', val)} />
        </Field>

        <Field label="زمان‌بندی مهاجرت" required error={fieldError('timeline')}>
          <PillSelect options={TIMELINE_OPTS} value={v.timeline || ''}
            onChange={val => { set('timeline', val); touch('timeline') }}
            error={!!fieldError('timeline')} />
        </Field>

      </div>

      {/* ── SECTION 2: Family ── */}
      <Section title="اطلاعات خانوادگی" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        <Field label="وضعیت تأهل" required error={fieldError('relationship')}>
          <PillSelect options={RELATIONSHIPS} value={v.relationship || ''}
            onChange={val => { set('relationship', val); touch('relationship') }}
            error={!!fieldError('relationship')} />
        </Field>

        <Field label="فرزندان">
          <PillSelect options={CHILDREN_OPTS} value={v.children || ''}
            onChange={val => set('children', val)} />
        </Field>

        {hasPartner && (
          <>
            <Field label="سن همسر (اختیاری)">
              <input style={{ ...input, direction: 'ltr' }} value={v.partnerAge || ''} type="text"
                onChange={e => set('partnerAge', e.target.value)} />
            </Field>
            <Field label="شغل همسر (اختیاری)">
              <input style={input} value={v.partnerOccupation || ''} type="text"
                onChange={e => set('partnerOccupation', e.target.value)} />
            </Field>
            <Field label="تحصیلات همسر (اختیاری)">
              <PillSelect options={EDUCATION_OPTS} value={v.partnerEducation || ''}
                onChange={val => set('partnerEducation', val)} />
            </Field>
            <Field label="سطح انگلیسی همسر (اختیاری)">
              <PillSelect options={ENGLISH_LEVELS} value={v.partnerEnglish || ''}
                onChange={val => set('partnerEnglish', val)} />
            </Field>
          </>
        )}

      </div>

      {/* ── SECTION 3: Education ── */}
      <Section title="تحصیلات" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        <Field label="بالاترین مدرک تحصیلی" required error={fieldError('education')}>
          <PillSelect options={EDUCATION_OPTS} value={v.education || ''}
            onChange={val => { set('education', val); touch('education') }}
            error={!!fieldError('education')} />
        </Field>

        <Field label="رشته تحصیلی (اختیاری)">
          <input style={input} value={v.fieldOfStudy || ''} type="text"
            onChange={e => set('fieldOfStudy', e.target.value)} />
        </Field>

        <Field label="نام دانشگاه یا مؤسسه (اختیاری)">
          <input style={input} value={v.institution || ''} type="text"
            onChange={e => set('institution', e.target.value)} />
        </Field>

        <Field label="کشور محل تحصیل (اختیاری)">
          <input style={input} value={v.countryOfStudy || ''} type="text"
            onChange={e => set('countryOfStudy', e.target.value)} />
        </Field>

        <Field label="سال فارغ‌التحصیلی (اختیاری)">
          <input style={{ ...input, direction: 'ltr' }} value={v.graduationYear || ''} type="text"
            placeholder="مثال: ۲۰۲۰"
            onChange={e => set('graduationYear', e.target.value)} />
        </Field>

      </div>

      {/* ── SECTION 4: Work Experience ── */}
      <Section title="سابقه کار" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        <Field label="عنوان شغلی فعلی (اختیاری)">
          <input style={input} value={v.jobTitle || ''} type="text"
            onChange={e => set('jobTitle', e.target.value)} />
        </Field>

        <Field label="زمینه شغلی (اختیاری)">
          <input style={input} value={v.occupation || ''} type="text"
            placeholder="مثلاً: مهندسی نرم‌افزار، پرستاری، حسابداری"
            onChange={e => set('occupation', e.target.value)} />
        </Field>

        <Field label="سال‌های تجربه مرتبط" required error={fieldError('experience')}>
          <PillSelect options={EXPERIENCE_OPTS} value={v.experience || ''}
            onChange={val => { set('experience', val); touch('experience') }}
            error={!!fieldError('experience')} />
        </Field>

        <Field label="مدارک اثبات اشتغال (اختیاری)">
          <CheckboxGroup options={EVIDENCE_OPTIONS} selected={evidence} onChange={toggleEvidence} />
        </Field>

      </div>

      {/* ── SECTION 5: English ── */}
      <Section title="آزمون زبان انگلیسی" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        <Field label="آزمون زبان انجام داده‌اید؟" required error={fieldError('englishTest')}>
          <PillSelect options={ENGLISH_TESTS} value={v.englishTest || ''}
            onChange={val => { set('englishTest', val); touch('englishTest') }}
            error={!!fieldError('englishTest')} />
        </Field>

        {hasTest && (
          <>
            <Field label="نمره کلی (Overall)">
              <input style={{ ...input, direction: 'ltr' }} value={v.englishOverall || ''} type="text"
                placeholder="مثال: 7.5"
                onChange={e => set('englishOverall', e.target.value)} />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
              {(['Listening','Reading','Writing','Speaking'] as const).map(skill => (
                <Field key={skill} label={skill === 'Listening' ? 'شنیداری' : skill === 'Reading' ? 'خواندن' : skill === 'Writing' ? 'نوشتار' : 'گفتار'}>
                  <input style={{ ...input, direction: 'ltr' }} type="text" placeholder="0.0"
                    value={v[`english${skill}`] || ''}
                    onChange={e => set(`english${skill}`, e.target.value)} />
                </Field>
              ))}
            </div>
          </>
        )}

      </div>

      {/* ── SECTION 6: Skills Assessment ── */}
      <Section title="ارزیابی مهارت (Skills Assessment)" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <Field label="وضعیت ارزیابی مهارت"
          hint="برای مهاجرت مهارتی به استرالیا و برخی کشورها، ارزیابی مهارت از یک نهاد رسمی الزامی است.">
          <PillSelect options={SKILLS_ASSESSMENT_OPTS} value={v.skillsAssessment || ''}
            onChange={val => set('skillsAssessment', val)} />
        </Field>
        <Field label="نهاد ارزیابی‌کننده (اختیاری)">
          <input style={input} value={v.assessingBody || ''} type="text"
            placeholder="مثلاً: Engineers Australia، VETASSESS، AHPRA"
            onChange={e => set('assessingBody', e.target.value)} />
        </Field>
      </div>

      {/* ── SECTION 7: Australia-specific ── */}
      {(isAustralia || destination === '') && (
        <>
          <Section title="استرالیا — اطلاعات تکمیلی" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <Field label="شغل مرتبط با استرالیا (ANZSCO اختیاری)">
              <input style={input} value={v.anzscoOccupation || ''} type="text"
                placeholder="مثلاً: Software Engineer، Registered Nurse"
                onChange={e => set('anzscoOccupation', e.target.value)} />
            </Field>
            <Field label="آیا به ویزای حمایت کارفرما (Employer Sponsored) علاقه دارید؟">
              <PillSelect options={YES_NO} value={v.auEmployerSponsorship || ''}
                onChange={val => set('auEmployerSponsorship', val)} />
            </Field>
            <Field label="آیا به مناطق منطقه‌ای (Regional) باز هستید؟"
              hint="ویزاهای منطقه‌ای اغلب نیازمندی‌های کمتری دارند.">
              <PillSelect options={YES_NO} value={v.auRegional || ''}
                onChange={val => set('auRegional', val)} />
            </Field>
          </div>
        </>
      )}

      {/* ── SECTION 8: Germany-specific ── */}
      {(isGermany || destination === '') && (
        <>
          <Section title="آلمان — اطلاعات تکمیلی" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <Field label="سطح زبان آلمانی">
              <PillSelect options={GERMAN_LEVELS} value={v.germanLevel || ''}
                onChange={val => set('germanLevel', val)} />
            </Field>
            <Field label="مسیر علاقه‌مندی در آلمان">
              <PillSelect options={GERMAN_PATHWAYS} value={v.germanPathway || ''}
                onChange={val => set('germanPathway', val)} />
            </Field>
          </div>
        </>
      )}

      {/* ── SECTION 9: Financial ── */}
      <Section title="وضعیت مالی" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <Field label="پس‌انداز موجود (تقریبی)" required error={fieldError('savings')}>
          <PillSelect options={SAVINGS_OPTS} value={v.savings || ''}
            onChange={val => { set('savings', val); touch('savings') }}
            error={!!fieldError('savings')} />
        </Field>
        <Field label="آیا حمایت مالی خانوادگی دارید؟">
          <PillSelect options={YES_NO} value={v.familySupport || ''}
            onChange={val => set('familySupport', val)} />
        </Field>
      </div>

      {/* ── SECTION 10: Migration History ── */}
      <Section title="سابقه مهاجرتی" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <Field label="آیا سابقه رد ویزا دارید؟">
          <PillSelect options={YES_NO} value={v.visaRefusal || ''}
            onChange={val => set('visaRefusal', val)} />
        </Field>
        <Field label="آیا ویزای شما تا به حال لغو شده است؟">
          <PillSelect options={YES_NO} value={v.visaCancellation || ''}
            onChange={val => set('visaCancellation', val)} />
        </Field>
        <Field label="آیا سابقه کیفری دارید؟">
          <PillSelect options={YES_NO} value={v.criminalRecord || ''}
            onChange={val => set('criminalRecord', val)} />
        </Field>
        <Field label="آیا مشکل پزشکی قابل توجهی دارید؟">
          <PillSelect options={YES_NO} value={v.medicalIssues || ''}
            onChange={val => set('medicalIssues', val)} />
        </Field>
      </div>

      {/* ── SECTION 11: Open Assessment ── */}
      <Section title="توضیحات کامل" />
      <div>
        <Field label="موقعیت خود را به طور کامل شرح دهید"
          hint="هر اطلاعاتی که فکر می‌کنید مرتبط است را اینجا بنویسید: اهداف مهاجرتی، سابقه تحصیلی، سابقه کاری، شرایط خانوادگی و هر نکته دیگری.">
          <textarea
            style={{ ...input, resize: 'vertical', minHeight: '140px' }}
            value={v.openAssessment || ''} rows={6}
            onChange={e => set('openAssessment', e.target.value)} />
        </Field>
      </div>

      {/* ── Consent ── */}
      <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer' }}>
          <input type="checkbox"
            checked={v.consent === 'true'}
            onChange={e => { set('consent', e.target.checked ? 'true' : 'false'); touch('consent') }}
            style={{ marginTop: '0.2rem', accentColor: 'var(--accent)', flexShrink: 0, width: '1rem', height: '1rem' }} />
          <span style={{ fontSize: '0.8rem', color: 'var(--subtle)', lineHeight: 1.75 }}>
            با ارسال این فرم موافقت می‌کنم که اطلاعات تفصیلی من برای ارزیابی دقیق‌تر و در صورت نیاز، ارجاع به متخصصان مهاجرت استفاده شود. اشکان فارا مشاور مهاجرت ثبت‌شده نیست و این ارزیابی جایگزین مشاوره حقوقی نیست.
          </span>
        </label>
        {touched.has('consent') && errors.consent && (
          <p style={{ marginTop: '0.4rem', fontSize: '0.72rem', color: 'rgba(200,110,70,0.9)' }}>{errors.consent}</p>
        )}
      </div>

      {status === 'error' && apiErr && (
        <div style={{ marginTop: '1rem', background: 'rgba(192,100,60,0.08)', border: '1px solid rgba(192,100,60,0.25)', borderRadius: '0.5rem', padding: '0.875rem 1rem' }}>
          <p style={{ fontSize: '0.82rem', color: 'rgba(220,130,90,0.95)', margin: 0 }}>{apiErr}</p>
        </div>
      )}

      <button type="submit" disabled={status === 'submitting'}
        style={{
          marginTop: '1.75rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: '9999px', background: 'var(--accent)', color: 'var(--accent-fg)',
          padding: '0.9rem 2.5rem', fontSize: '0.9rem', fontWeight: 600,
          letterSpacing: '0.04em', border: 'none', fontFamily: 'inherit',
          cursor: status === 'submitting' ? 'wait' : 'pointer',
          opacity: status === 'submitting' ? 0.6 : 1, transition: 'opacity 0.15s', whiteSpace: 'nowrap',
        }}
      >
        {status === 'submitting' ? 'در حال ارسال…' : 'ارسال ارزیابی تفصیلی'}
      </button>

    </form>
  )
}
