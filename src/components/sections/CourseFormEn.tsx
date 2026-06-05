'use client'

import { useState, FormEvent, Fragment } from 'react'

// ── Payment gateway config check ─────────────────────────────
// Set these in .env.local to activate real payment:
//   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
//   NEXT_PUBLIC_PAYPAL_CLIENT_ID=...
const STRIPE_KEY  = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
const PAYPAL_ID   = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID
const PAYMENT_READY = Boolean(STRIPE_KEY || PAYPAL_ID)

type Step = 'details' | 'payment'  // 'confirmed' is ONLY reachable via real payment callback

interface PurchaserData {
  name:      string
  email:     string
  instagram: string
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
const STEP_LABELS = ['Your Details', 'Payment']

function StepIndicator({ current }: { current: 1 | 2 }) {
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
  const [values,  setValues]  = useState({ name: '', email: '', instagram: '' })
  const [touched, setTouched] = useState({ name: false, email: false })
  const [focused, setFocused] = useState('')

  const nameErr  = values.name.trim().length < 2 ? 'Name is required' : null
  const emailErr = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim()) ? null : 'Enter a valid email address'
  const valid    = !nameErr && !emailErr

  function submit(e: FormEvent) {
    e.preventDefault()
    setTouched({ name: true, email: true })
    if (valid) onNext({ name: values.name.trim(), email: values.email.trim(), instagram: values.instagram.trim() })
  }

  const fields = [
    { id: 'name',      label: 'Full name',              type: 'text'  as const, required: true,  err: nameErr,  touch: touched.name },
    { id: 'email',     label: 'Email address',          type: 'email' as const, required: true,  err: emailErr, touch: touched.email },
    { id: 'instagram', label: 'Instagram (optional)',   type: 'text'  as const, required: false, err: null,     touch: false },
  ]

  return (
    <form onSubmit={submit} noValidate style={{ maxWidth: '480px' }}>
      <StepIndicator current={1} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {fields.map(f => (
          <div key={f.id}>
            <label htmlFor={f.id} style={lbl}>
              {f.label}
              {f.required && <span style={{ color: 'var(--accent)', marginLeft: '0.2rem', opacity: 0.8 }}>*</span>}
            </label>
            <input
              id={f.id} type={f.type}
              placeholder={f.id === 'instagram' ? '@' : ''}
              value={values[f.id as keyof typeof values]}
              onChange={e => setValues(p => ({ ...p, [f.id]: e.target.value }))}
              onFocus={() => setFocused(f.id)}
              onBlur={() => { setFocused(''); if (f.id in touched) setTouched(p => ({ ...p, [f.id]: true })) }}
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
function PaymentStep({ data, onBack }: {
  data: PurchaserData
  onBack: () => void
}) {

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

      {PAYMENT_READY ? (
        // ── PAYMENT ACTIVE ────────────────────────────────────────────────
        // TODO: Replace these with real Stripe / PayPal implementations.
        //
        // STRIPE (redirect-based checkout — recommended):
        //   1. npm install stripe
        //   2. Create /api/en/checkout/route.ts using STRIPE_SECRET_KEY
        //      → creates a Stripe Checkout Session and returns { url }
        //   3. POST to /api/en/checkout with { name, email, instagram }
        //   4. router.push(url) to redirect to Stripe's hosted checkout
        //   5. Set successUrl to /en/course?success=true&session_id={CHECKOUT_SESSION_ID}
        //   6. Create /app/en/course/success/page.tsx that verifies the session_id
        //      server-side before showing confirmation
        //
        // PAYPAL (in-page SDK):
        //   1. npm install @paypal/react-paypal-js
        //   2. Wrap with <PayPalScriptProvider options={{ clientId: NEXT_PUBLIC_PAYPAL_CLIENT_ID }}>
        //   3. <PayPalButtons
        //        createOrder={() => fetch('/api/en/paypal/create-order').then(r=>r.json()).then(d=>d.id)}
        //        onApprove={(d) => fetch('/api/en/paypal/capture-order', {
        //          method: 'POST', body: JSON.stringify({ orderID: d.orderID, ...data })
        //        }).then(() => router.push('/en/course?success=true'))}
        //      />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <button
            type="button"
            style={{
              width: '100%', background: '#0070ba', color: '#fff',
              border: 'none', borderRadius: '0.5rem', padding: '0.9rem 1rem',
              fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem',
              fontFamily: 'inherit',
            }}
          >
            Pay with PayPal
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
            <span style={{ fontSize: '0.72rem', color: 'var(--subtle)' }}>or</span>
            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
          </div>
          <button
            type="button"
            style={{
              width: '100%', background: 'transparent', color: 'var(--muted)',
              border: '1px solid var(--border-strong)', borderRadius: '0.5rem',
              padding: '0.9rem 1rem', fontSize: '0.9rem', fontWeight: 400,
              cursor: 'pointer', fontFamily: 'inherit', transition: 'border-color 0.15s',
            }}
          >
            Pay with Credit / Debit Card
          </button>
        </div>
      ) : (
        // ── PAYMENT NOT YET CONFIGURED ────────────────────────────────────
        // Remove this block once NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY or
        // NEXT_PUBLIC_PAYPAL_CLIENT_ID is added to .env.local
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: '0.75rem', padding: '1.75rem',
        }}>
          <p style={{ fontSize: '0.72rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--subtle)', marginBottom: '1rem' }}>
            Payment Setup In Progress
          </p>
          <p style={{ fontSize: '0.9rem', color: 'var(--muted)', lineHeight: 1.9, marginBottom: '1.25rem' }}>
            Online payment is being configured. To complete your purchase now, email{' '}
            <a href="mailto:hello@ashkanfaraa.com" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
              hello@ashkanfaraa.com
            </a>{' '}
            with your name and the subject <em>Course Purchase</em>.
          </p>
          <p style={{ fontSize: '0.72rem', color: 'var(--subtle)', lineHeight: 1.7, opacity: 0.8 }}>
            Price: $99 USD · The Hidden Traps of Migration
          </p>
        </div>
      )}

      <button
        type="button" onClick={onBack}
        style={{ marginTop: '1.25rem', background: 'none', border: 'none', color: 'var(--subtle)', fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
      >
        ← Edit details
      </button>
    </div>
  )
}

// ── Controller ────────────────────────────────────────────────
// NOTE: There is no client-side 'confirmed' step.
// Confirmation is only shown after a verified payment callback
// from Stripe (via /en/course?success=true&session_id=...) or PayPal.
export function CourseFormEn({ onPaymentMode }: { onPaymentMode?: () => void }) {
  const [step, setStep] = useState<Step>('details')
  const [data, setData] = useState<PurchaserData | null>(null)

  if (step === 'payment' && data) {
    return <PaymentStep data={data} onBack={() => setStep('details')} />
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
