'use client'

import { useState, FormEvent, Fragment } from 'react'

type Step = 'application' | 'payment' | 'success'

interface AppData {
  name:      string
  email:     string
  instagram: string
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
  direction: 'ltr',
  boxSizing: 'border-box',
}

const lbl: React.CSSProperties = {
  display: 'block',
  fontSize: '0.78rem',
  color: 'var(--muted)',
  marginBottom: '0.5rem',
  letterSpacing: '0.02em',
}

const primaryBtn: React.CSSProperties = {
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

// ── Step indicator ────────────────────────────────────────────
const STEP_LABELS = ['Application', 'Payment', 'Access Code']

function StepIndicator({ current }: { current: 1 | 2 | 3 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '2.25rem' }}>
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

// ── Validation ────────────────────────────────────────────────
function validateField(id: string, val: string): string | null {
  switch (id) {
    case 'name':
      return val.trim().length < 2 ? 'Name is required' : null
    case 'email':
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim()) ? null : 'Enter a valid email address'
    case 'instagram': {
      const clean = val.replace(/^@/, '').trim()
      return clean.length < 2 ? 'Instagram handle is required' : null
    }
    default:
      return null
  }
}

const REQUIRED = ['name', 'email', 'instagram']

// ── Step 1: Application ───────────────────────────────────────
function ApplicationStep({ onNext }: { onNext: (data: AppData) => void }) {
  const [values,  setValues]  = useState<Record<string, string>>({})
  const [focused, setFocused] = useState<string | null>(null)
  const [touched, setTouched] = useState<Set<string>>(new Set())

  const isValid = REQUIRED.every(id => validateField(id, values[id] ?? '') === null)

  const fields = [
    { id: 'name',      label: 'Full name',        type: 'text',  placeholder: '' },
    { id: 'email',     label: 'Email address',    type: 'email', placeholder: '' },
    { id: 'instagram', label: 'Instagram handle', type: 'text',  placeholder: '@' },
  ]

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!isValid) return
    onNext({
      name:      values.name      ?? '',
      email:     values.email     ?? '',
      instagram: values.instagram ?? '',
    })
  }

  return (
    <form onSubmit={handleSubmit} noValidate style={{ maxWidth: '480px' }}>
      <StepIndicator current={1} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {fields.map(f => {
          const error     = validateField(f.id, values[f.id] ?? '')
          const showError = touched.has(f.id) && error !== null
          return (
            <div key={f.id}>
              <label htmlFor={f.id} style={lbl}>{f.label} <span style={{ color: 'var(--accent)', opacity: 0.8 }}>*</span></label>
              <input
                id={f.id} name={f.id} type={f.type} placeholder={f.placeholder}
                value={values[f.id] ?? ''}
                onChange={e => setValues(p => ({ ...p, [f.id]: e.target.value }))}
                onFocus={() => setFocused(f.id)}
                onBlur={() => { setFocused(null); setTouched(p => new Set([...p, f.id])) }}
                style={{ ...input, borderColor: showError ? 'rgba(192,100,60,0.7)' : focused === f.id ? 'var(--accent)' : 'var(--border)' }}
              />
              {showError && (
                <p style={{ marginTop: '0.4rem', fontSize: '0.72rem', color: 'rgba(200,110,70,0.9)', lineHeight: 1.5 }}>{error}</p>
              )}
            </div>
          )
        })}
      </div>
      <button
        type="submit" disabled={!isValid}
        style={{ ...primaryBtn, marginTop: '2rem', opacity: isValid ? 1 : 0.4, cursor: isValid ? 'pointer' : 'not-allowed' }}
      >
        Continue to Payment
      </button>
    </form>
  )
}

// ── Step 2: Payment ───────────────────────────────────────────
function PaymentStep({ appData, onSuccess, onBack }: {
  appData: AppData
  onSuccess: (code: string) => void
  onBack: () => void
}) {
  const [status, setStatus] = useState<'idle' | 'processing'>('idle')

  function generateCode(): string {
    // TODO: In production, this code must come from the server
    // after PayPal payment is verified via webhook.
    // See /api/paypal/capture-order for the real implementation.
    return `AF-${Date.now().toString(36).toUpperCase().slice(-6)}`
  }

  function handlePayment() {
    // TODO: Replace this simulation with real PayPal or Stripe integration.
    // See TODO comments below for integration instructions.
    setStatus('processing')
    setTimeout(() => {
      onSuccess(generateCode())
    }, 1800)
  }

  return (
    <div style={{ maxWidth: '480px' }}>
      <StepIndicator current={2} />

      {/* Order summary */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '0.875rem',
        padding: '1.25rem 1.5rem',
        marginBottom: '1.75rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div>
          <p style={{ fontSize: '0.78rem', color: 'var(--subtle)', marginBottom: '0.25rem' }}>Migration: The Full Picture</p>
          <p style={{ fontSize: '0.72rem', color: 'var(--subtle)', opacity: 0.7 }}>{appData.email}</p>
        </div>
        <p style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--accent)', letterSpacing: '-0.02em' }}>$99</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

        {/*
          ── TODO: PayPal Integration ────────────────────────────────────────
          1. Install SDK:  npm install @paypal/react-paypal-js
          2. Add to .env.local:  NEXT_PUBLIC_PAYPAL_CLIENT_ID=your_client_id_here
          3. Wrap app (or this component) with <PayPalScriptProvider>
          4. Replace the placeholder button below with:

             <PayPalButtons
               style={{ layout: 'vertical', color: 'gold', shape: 'pill' }}
               createOrder={async () => {
                 const res = await fetch('/api/paypal/create-order', { method: 'POST' })
                 const { id } = await res.json()
                 return id
               }}
               onApprove={async (data) => {
                 const res = await fetch('/api/paypal/capture-order', {
                   method: 'POST',
                   body: JSON.stringify({ orderID: data.orderID, ...appData }),
                 })
                 const { afCode } = await res.json()
                 onSuccess(afCode)
               }}
             />

          5. Create API routes:
             - /api/paypal/create-order  → calls PayPal Orders API, returns { id }
             - /api/paypal/capture-order → captures payment, generates + returns { afCode }
          ────────────────────────────────────────────────────────────────── */}

        {/* PayPal placeholder button */}
        <button
          type="button"
          onClick={handlePayment}
          disabled={status === 'processing'}
          style={{
            width: '100%',
            background: status === 'processing' ? '#0070ba99' : '#0070ba',
            color: '#fff',
            border: 'none',
            borderRadius: '0.5rem',
            padding: '0.9rem 1rem',
            fontSize: '0.95rem',
            fontWeight: 600,
            cursor: status === 'processing' ? 'wait' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.6rem',
            fontFamily: 'inherit',
            transition: 'background 0.15s',
          }}
        >
          {status === 'processing' ? 'Processing…' : (
            <>
              {/* PayPal P-P wordmark (simplified inline SVG) */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M7.5 3h6.75C17.25 3 19.5 5.25 19.5 8.25c0 3-2.25 5.25-5.25 5.25H11L9.75 19.5H6L7.5 3z" fill="#fff" opacity="0.9"/>
                <path d="M10.5 7.5h4.5c1.5 0 2.25.75 2.25 2.25 0 1.5-1.5 2.25-3 2.25H11.25l-1.5 7.5H7.5l3-12z" fill="#fff"/>
              </svg>
              Pay with PayPal
            </>
          )}
        </button>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
          <span style={{ fontSize: '0.72rem', color: 'var(--subtle)' }}>or</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
        </div>

        {/*
          ── TODO: Card Payment Integration ──────────────────────────────────
          Option A — Stripe:
            1. npm install @stripe/react-stripe-js @stripe/stripe-js
            2. Add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY to .env.local
            3. Create /api/stripe/create-payment-intent
            4. Use <Elements> + <PaymentElement> from @stripe/react-stripe-js

          Option B — PayPal card fields (hosted fields):
            Use PayPalHostedFields within the same PayPalScriptProvider
          ────────────────────────────────────────────────────────────────── */}

        {/* Card placeholder button */}
        <button
          type="button"
          onClick={handlePayment}
          disabled={status === 'processing'}
          style={{
            width: '100%',
            background: 'transparent',
            color: 'var(--muted)',
            border: '1px solid var(--border-strong)',
            borderRadius: '0.5rem',
            padding: '0.9rem 1rem',
            fontSize: '0.9rem',
            fontWeight: 500,
            cursor: status === 'processing' ? 'wait' : 'pointer',
            fontFamily: 'inherit',
            transition: 'border-color 0.15s',
          }}
        >
          Pay with Credit / Debit Card
        </button>

      </div>

      <button
        type="button" onClick={onBack}
        style={{ marginTop: '1.25rem', background: 'none', border: 'none', color: 'var(--subtle)', fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
      >
        ← Edit details
      </button>
    </div>
  )
}

// ── Step 3: Success ───────────────────────────────────────────
function SuccessStep({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  function copyCode() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div style={{ maxWidth: '480px' }}>
      <StepIndicator current={3} />

      <div style={{ width: '2rem', height: '1px', background: 'var(--accent)', opacity: 0.65, marginBottom: '1.75rem' }} />

      <p style={{ fontSize: 'clamp(1rem, 1.8vw, 1.2rem)', fontWeight: 500, color: 'var(--foreground)', lineHeight: 1.5, marginBottom: '2.5rem' }}>
        Payment received.
      </p>

      <p style={{ fontSize: '0.65rem', letterSpacing: '0.18em', color: 'var(--subtle)', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
        Your Access Code
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
        <p style={{
          fontSize: 'clamp(2.4rem, 7vw, 3.6rem)', fontWeight: 700,
          color: 'var(--accent)', letterSpacing: '0.12em',
          fontVariantNumeric: 'tabular-nums', lineHeight: 1, margin: 0,
        }}>
          {code}
        </p>
        <button
          onClick={copyCode}
          style={{
            background: 'var(--surface-raised)',
            border: `1px solid ${copied ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius: '0.5rem', padding: '0.45rem 0.9rem',
            fontSize: '0.72rem', fontWeight: 500,
            color: copied ? 'var(--accent)' : 'var(--subtle)',
            cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s',
          }}
        >
          {copied ? '✓ Copied' : 'Copy code'}
        </button>
      </div>

      <div style={{ height: '1px', background: 'var(--border)', margin: '2rem 0' }} />

      <p style={{ fontSize: '0.9rem', color: 'var(--muted)', lineHeight: 2, marginBottom: '0.75rem' }}>
        Send this code to{' '}
        <span style={{ color: 'var(--accent)', fontWeight: 600 }}>@ashkanfaraa</span>{' '}
        on Instagram to receive course access.
      </p>
      <p style={{ fontSize: '0.78rem', color: 'var(--subtle)', marginBottom: '2rem', lineHeight: 1.7 }}>
        You'll typically receive a response within 24 hours.
      </p>

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <a href="https://www.instagram.com/ashkanfaraa/" target="_blank" rel="noopener noreferrer"
          style={{ ...primaryBtn } as React.CSSProperties}>
          Open Instagram
        </a>
        <a href="/en/course"
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '9999px', background: 'transparent', border: '1px solid var(--border-strong)', color: 'var(--subtle)', padding: '0.9rem 1.75rem', fontSize: '0.9rem', textDecoration: 'none', whiteSpace: 'nowrap' } as React.CSSProperties}>
          Back to course
        </a>
      </div>
    </div>
  )
}

// ── Controller ────────────────────────────────────────────────
export function CourseFormEn({ onPaymentMode }: { onPaymentMode?: () => void }) {
  const [step,    setStep]    = useState<Step>('application')
  const [appData, setAppData] = useState<AppData | null>(null)
  const [code,    setCode]    = useState('')

  if (step === 'success') return <SuccessStep code={code} />

  if (step === 'payment' && appData) {
    return (
      <PaymentStep
        appData={appData}
        onSuccess={c => { setCode(c); setStep('success') }}
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
