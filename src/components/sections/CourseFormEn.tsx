'use client'

import { useState, FormEvent, Fragment } from 'react'

type Step = 'details' | 'payment' | 'confirmed'

interface PurchaserData {
  name:  string
  email: string
}

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

// ── Step indicator ────────────────────────────────────────────
const STEP_LABELS = ['Your Details', 'Payment', 'Confirmation']

function StepIndicator({ current }: { current: 1 | 2 | 3 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '2.25rem' }}>
      {STEP_LABELS.map((label, i) => {
        const n = i + 1; const done = n < current; const active = n === current
        return (
          <Fragment key={label}>
            {i > 0 && (
              <div style={{ flex: 1, height: '1px', marginTop: '3px', background: done ? 'var(--accent)' : 'var(--border)', opacity: done ? 0.45 : 0.6 }} />
            )}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem' }}>
              <div style={{
                width: '6px', height: '6px', borderRadius: '50%',
                background: active || done ? 'var(--accent)' : 'transparent',
                border: `1px solid ${active || done ? 'var(--accent)' : 'var(--border-strong)'}`,
                opacity: done ? 0.5 : 1,
              }} />
              <span style={{ fontSize: '0.57rem', letterSpacing: '0.04em', whiteSpace: 'nowrap', color: active ? 'var(--accent)' : 'var(--subtle)', opacity: done ? 0.5 : 1 }}>
                {label}
              </span>
            </div>
          </Fragment>
        )
      })}
    </div>
  )
}

// ── Step 1: Details ───────────────────────────────────────────
function DetailsStep({ onNext }: { onNext: (d: PurchaserData) => void }) {
  const [name,  setName]  = useState('')
  const [email, setEmail] = useState('')
  const [touched, setTouched] = useState({ name: false, email: false })
  const [focused, setFocused] = useState('')

  const nameErr  = name.trim().length < 2 ? 'Name is required' : null
  const emailErr = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? null : 'Enter a valid email address'
  const valid    = !nameErr && !emailErr

  function submit(e: FormEvent) {
    e.preventDefault()
    setTouched({ name: true, email: true })
    if (valid) onNext({ name: name.trim(), email: email.trim() })
  }

  return (
    <form onSubmit={submit} noValidate style={{ maxWidth: '480px' }}>
      <StepIndicator current={1} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {[
          { id: 'name',  label: 'Full name',      value: name,  set: setName,  err: nameErr,  touch: touched.name  },
          { id: 'email', label: 'Email address',  value: email, set: setEmail, err: emailErr, touch: touched.email },
        ].map(f => (
          <div key={f.id}>
            <label htmlFor={f.id} style={lbl}>{f.label} <span style={{ color: 'var(--accent)', opacity: 0.8 }}>*</span></label>
            <input
              id={f.id} type={f.id === 'email' ? 'email' : 'text'}
              value={f.value}
              onChange={e => f.set(e.target.value)}
              onFocus={() => setFocused(f.id)}
              onBlur={() => { setFocused(''); setTouched(p => ({ ...p, [f.id]: true })) }}
              style={{ ...input, borderColor: f.touch && f.err ? 'rgba(192,100,60,0.7)' : focused === f.id ? 'var(--accent)' : 'var(--border)' }}
            />
            {f.touch && f.err && (
              <p style={{ marginTop: '0.4rem', fontSize: '0.72rem', color: 'rgba(200,110,70,0.9)', lineHeight: 1.5 }}>{f.err}</p>
            )}
          </div>
        ))}
      </div>
      <button
        type="submit"
        style={{
          marginTop: '2rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: '9999px', background: 'var(--accent)', color: 'var(--accent-fg)',
          padding: '0.9rem 2.25rem', fontSize: '0.9rem', fontWeight: 600,
          letterSpacing: '0.04em', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
          whiteSpace: 'nowrap', transition: 'opacity 0.15s',
        }}
      >
        Continue to Payment
      </button>
    </form>
  )
}

// ── Step 2: Payment ───────────────────────────────────────────
function PaymentStep({ data, onSuccess, onBack }: {
  data: PurchaserData
  onSuccess: () => void
  onBack: () => void
}) {
  const [status, setStatus] = useState<'idle' | 'processing'>('idle')

  function simulatePayment() {
    // TODO: Replace this simulation with real payment integration.
    // See integration notes below.
    setStatus('processing')
    setTimeout(() => onSuccess(), 1800)
  }

  return (
    <div style={{ maxWidth: '480px' }}>
      <StepIndicator current={2} />

      {/* Order summary */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: '0.875rem', padding: '1.25rem 1.5rem',
        marginBottom: '1.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <p style={{ fontSize: '0.82rem', color: 'var(--muted)', marginBottom: '0.2rem' }}>The Hidden Traps of Migration</p>
          <p style={{ fontSize: '0.72rem', color: 'var(--subtle)', opacity: 0.75 }}>{data.email}</p>
        </div>
        <p style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--accent)', letterSpacing: '-0.02em' }}>$99</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

        {/*
          ── TODO: PayPal Integration ─────────────────────────────────────────
          1.  npm install @paypal/react-paypal-js
          2.  Add to .env.local:  NEXT_PUBLIC_PAYPAL_CLIENT_ID=your_client_id
          3.  Wrap with <PayPalScriptProvider options={{ clientId: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID, currency: 'USD' }}>
          4.  Replace placeholder below with:
              <PayPalButtons
                style={{ layout: 'vertical', color: 'gold', shape: 'pill' }}
                createOrder={async () => {
                  const res = await fetch('/api/paypal/create-order', { method: 'POST' })
                  return (await res.json()).id
                }}
                onApprove={async (d) => {
                  await fetch('/api/paypal/capture-order', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ orderID: d.orderID, name: data.name, email: data.email }),
                  })
                  onSuccess()
                }}
              />
          5.  Create API routes:
              /api/paypal/create-order  → PayPal Orders v2 API, returns { id }
              /api/paypal/capture-order → capture + send course access email
          ───────────────────────────────────────────────────────────────────── */}

        <button
          type="button"
          onClick={simulatePayment}
          disabled={status === 'processing'}
          style={{
            width: '100%', background: status === 'processing' ? '#0070ba99' : '#0070ba',
            color: '#fff', border: 'none', borderRadius: '0.5rem',
            padding: '0.9rem 1rem', fontSize: '0.95rem', fontWeight: 600,
            cursor: status === 'processing' ? 'wait' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem',
            fontFamily: 'inherit', transition: 'background 0.15s',
          }}
        >
          {status === 'processing' ? 'Processing…' : 'Pay with PayPal'}
        </button>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
          <span style={{ fontSize: '0.72rem', color: 'var(--subtle)' }}>or</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
        </div>

        {/*
          ── TODO: Stripe / Card Integration ──────────────────────────────────
          Option A — Stripe Elements:
            1.  npm install @stripe/react-stripe-js @stripe/stripe-js
            2.  Add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY to .env.local
            3.  Create /api/stripe/create-payment-intent (server-side secret key)
            4.  Render <Elements stripe={stripePromise}><PaymentElement /></Elements>

          Option B — PayPal Card Fields (same provider, no Stripe needed):
            Use PayPalHostedFields inside the same PayPalScriptProvider.
          ───────────────────────────────────────────────────────────────────── */}

        <button
          type="button"
          onClick={simulatePayment}
          disabled={status === 'processing'}
          style={{
            width: '100%', background: 'transparent', color: 'var(--muted)',
            border: '1px solid var(--border-strong)', borderRadius: '0.5rem',
            padding: '0.9rem 1rem', fontSize: '0.9rem', fontWeight: 400,
            cursor: status === 'processing' ? 'wait' : 'pointer', fontFamily: 'inherit',
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

// ── Step 3: Confirmation ──────────────────────────────────────
function ConfirmationStep({ data }: { data: PurchaserData }) {
  return (
    <div style={{ maxWidth: '480px' }}>
      <StepIndicator current={3} />

      <div style={{ width: '2rem', height: '1px', background: 'var(--accent)', opacity: 0.65, marginBottom: '1.75rem' }} />

      <h3 style={{ fontSize: 'clamp(1.1rem, 2vw, 1.3rem)', fontWeight: 600, color: 'var(--foreground)', lineHeight: 1.4, marginBottom: '1.25rem' }}>
        Purchase confirmed.
      </h3>

      <p style={{ fontSize: '0.9rem', color: 'var(--muted)', lineHeight: 1.9, marginBottom: '0.75rem' }}>
        {/* TODO: Send access email via Resend / SendGrid to {data.email}
            Include course access link and onboarding instructions. */}
        A confirmation has been sent to <span style={{ color: 'var(--foreground)', fontWeight: 500 }}>{data.email}</span>.
      </p>
      <p style={{ fontSize: '0.78rem', color: 'var(--subtle)', lineHeight: 1.75, marginBottom: '2rem', opacity: 0.85 }}>
        You'll receive course access details within a few minutes. Check your spam folder if it doesn't arrive.
      </p>

      <a
        href="/en"
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: '9999px', border: '1px solid var(--border-strong)',
          color: 'var(--muted)', padding: '0.875rem 2rem', fontSize: '0.875rem',
          fontWeight: 400, textDecoration: 'none', letterSpacing: '0.03em',
          transition: 'border-color 0.15s, color 0.15s',
        }}
      >
        Back to home
      </a>
    </div>
  )
}

// ── Controller ────────────────────────────────────────────────
export function CourseFormEn({ onPaymentMode }: { onPaymentMode?: () => void }) {
  const [step, setStep] = useState<Step>('details')
  const [data, setData] = useState<PurchaserData | null>(null)

  if (step === 'confirmed' && data) return <ConfirmationStep data={data} />

  if (step === 'payment' && data) {
    return (
      <PaymentStep
        data={data}
        onSuccess={() => setStep('confirmed')}
        onBack={() => setStep('details')}
      />
    )
  }

  return (
    <DetailsStep
      onNext={d => {
        setData(d)
        onPaymentMode?.()
        setTimeout(() => setStep('payment'), 420)
      }}
    />
  )
}
