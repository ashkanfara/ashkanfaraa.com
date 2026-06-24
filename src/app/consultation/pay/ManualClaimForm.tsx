'use client'

import { useState, FormEvent } from 'react'

export default function ManualClaimForm({
  token,
  method,
}: {
  token:  string
  method: 'manual_ir' | 'manual_au'
}) {
  const [claimText, setClaimText] = useState('')
  const [status,    setStatus]    = useState<'idle' | 'submitting' | 'done' | 'error'>('idle')
  const [error,     setError]     = useState('')

  const label = method === 'manual_ir'
    ? 'شماره پیگیری واریز'
    : 'شماره مرجع انتقال (Reference Number)'

  const placeholder = method === 'manual_ir'
    ? 'مثال: ۱۲۳۴۵۶۷۸۹۰'
    : 'e.g. 123456789'

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!claimText.trim()) return
    setStatus('submitting')
    setError('')
    try {
      const res = await fetch('/api/consultation/pay/claim', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token, claimText: claimText.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'خطا در ثبت. دوباره تلاش کن.')
        setStatus('error')
        return
      }
      setStatus('done')
    } catch {
      setError('خطا در اتصال. لطفاً دوباره تلاش کن.')
      setStatus('error')
    }
  }

  if (status === 'done') {
    return (
      <div>
        <p style={{ fontSize: '0.95rem', color: 'var(--foreground)', fontWeight: 500, lineHeight: 1.7, marginBottom: '0.5rem' }}>
          درخواست پرداخت ثبت شد.
        </p>
        <p style={{ fontSize: '0.85rem', color: 'var(--muted)', lineHeight: 2 }}>
          پس از تأیید توسط ادمین، کد CONS برایت ارسال می‌شود.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} dir="rtl">
      <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--muted)', marginBottom: '0.5rem', letterSpacing: '0.02em' }}>
        {label}
      </label>
      <input
        type="text"
        value={claimText}
        onChange={e => setClaimText(e.target.value)}
        placeholder={placeholder}
        required
        style={{
          width:        '100%',
          background:   'var(--surface-raised)',
          border:       '1px solid var(--border)',
          borderRadius: '0.625rem',
          padding:      '0.875rem 1rem',
          fontSize:     '0.9rem',
          color:        'var(--foreground)',
          outline:      'none',
          fontFamily:   'inherit',
          boxSizing:    'border-box',
          marginBottom: '1rem',
          direction:    method === 'manual_ir' ? 'rtl' : 'ltr',
        }}
      />
      {error && (
        <p style={{ fontSize: '0.82rem', color: 'var(--error, #e05)', marginBottom: '0.75rem' }}>
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={status === 'submitting' || !claimText.trim()}
        style={{
          display:        'inline-flex',
          alignItems:     'center',
          justifyContent: 'center',
          borderRadius:   '9999px',
          background:     status === 'submitting' ? 'var(--surface-raised)' : 'var(--accent)',
          color:          status === 'submitting' ? 'var(--muted)'          : 'var(--accent-fg)',
          border:         'none',
          padding:        '0.875rem 2rem',
          fontSize:       '0.875rem',
          fontWeight:     600,
          letterSpacing:  '0.04em',
          cursor:         status === 'submitting' ? 'not-allowed' : 'pointer',
        }}
      >
        {status === 'submitting' ? '...' : 'پرداخت کردم'}
      </button>
    </form>
  )
}
