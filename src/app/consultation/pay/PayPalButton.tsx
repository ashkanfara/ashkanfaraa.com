'use client'

import { useState } from 'react'

export default function PayPalButton({ token }: { token: string }) {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  async function handleClick() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/consultation/pay/initiate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'خطا در ایجاد سفارش. دوباره تلاش کن.')
        return
      }
      window.location.href = data.approvalUrl
    } catch {
      setError('خطا در اتصال. لطفاً دوباره تلاش کن.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading}
        style={{
          display:       'inline-flex',
          alignItems:    'center',
          justifyContent:'center',
          gap:           '0.5rem',
          borderRadius:  '9999px',
          background:    loading ? 'var(--surface-raised)' : 'var(--accent)',
          color:         loading ? 'var(--muted)' : 'var(--accent-fg)',
          border:        'none',
          padding:       '0.875rem 2rem',
          fontSize:      '0.875rem',
          fontWeight:    600,
          letterSpacing: '0.04em',
          cursor:        loading ? 'not-allowed' : 'pointer',
          transition:    'opacity 0.15s',
        }}
      >
        {loading ? '...' : 'پرداخت با PayPal'}
      </button>
      {error && (
        <p style={{ marginTop: '0.75rem', fontSize: '0.82rem', color: 'var(--error, #e05)' }}>
          {error}
        </p>
      )}
    </div>
  )
}
