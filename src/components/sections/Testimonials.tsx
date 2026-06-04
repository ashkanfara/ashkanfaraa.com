'use client'

import { useRef, useState, useCallback } from 'react'
import { testimonials } from '@/data/content'

// ── Time formatter ────────────────────────────────────────────
function fmt(s: number): string {
  if (!isFinite(s) || s <= 0) return '—:——'
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

// ── Single premium testimonial card ──────────────────────────
function TestimonialCard({
  name, label, quote, src,
}: {
  name: string; label: string; quote: string; src: string
}) {
  const audioRef  = useRef<HTMLAudioElement>(null)
  const [playing,  setPlaying]  = useState(false)
  const [duration, setDuration] = useState(0)
  const [progress, setProgress] = useState(0)

  const toggle = useCallback(() => {
    const a = audioRef.current
    if (!a) return
    playing ? a.pause() : a.play().catch(() => {})
  }, [playing])

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = audioRef.current
    if (!a || !duration) return
    const r = e.currentTarget.getBoundingClientRect()
    a.currentTime = ((e.clientX - r.left) / r.width) * duration
  }

  return (
    <div
      dir="rtl"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '1rem',
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Subtle top accent */}
      <div style={{
        position: 'absolute', top: 0, right: 0, left: 0, height: '1px',
        background: 'linear-gradient(90deg, transparent, var(--accent), transparent)',
        opacity: 0.3,
      }} />

      {/* Quote */}
      <p style={{
        fontSize: '0.875rem',
        color: 'var(--muted)',
        lineHeight: 1.85,
        margin: 0,
        flex: 1,
      }}>
        «{quote}»
      </p>

      {/* Divider */}
      <div style={{ height: '1px', background: 'var(--border)' }} />

      {/* Identity + controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
        {/* Name + label */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--foreground)', lineHeight: 1.2 }}>
            {name}
          </span>
          <span style={{ fontSize: '0.68rem', color: 'var(--subtle)', lineHeight: 1.3 }}>
            {label}
          </span>
        </div>

        {/* Play button + duration */}
        <div dir="ltr" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
          <span style={{ fontSize: '0.68rem', color: 'var(--subtle)', fontVariantNumeric: 'tabular-nums', minWidth: '2rem' }}>
            {fmt(duration)}
          </span>

          <button
            type="button"
            onClick={toggle}
            aria-label={playing ? 'توقف' : 'پخش'}
            style={{
              width: '2rem', height: '2rem', borderRadius: '50%',
              border: `1px solid ${playing ? 'var(--accent)' : 'var(--border-strong)'}`,
              background: playing ? 'var(--accent)' : 'transparent',
              color: playing ? 'var(--accent-fg)' : 'var(--subtle)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0,
              transition: 'all 0.15s',
            }}
          >
            {playing ? (
              <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            ) : (
              <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7L8 5z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Progress bar — only when duration is known */}
      {duration > 0 && (
        <div
          onClick={seek}
          style={{
            height: '1px', background: 'var(--border)', cursor: 'pointer',
            position: 'relative', marginTop: '-0.75rem',
          }}
        >
          <div style={{
            position: 'absolute', inset: 0, right: `${100 - progress}%`,
            background: 'var(--accent)', opacity: 0.7,
          }} />
        </div>
      )}

      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setProgress(0) }}
        onLoadedMetadata={() => {
          const a = audioRef.current
          if (a) setDuration(a.duration)
        }}
        onTimeUpdate={() => {
          const a = audioRef.current
          if (a) setProgress((a.currentTime / a.duration) * 100 || 0)
        }}
      />
    </div>
  )
}

// ── Section ───────────────────────────────────────────────────
export function Testimonials() {
  return (
    <section dir="rtl" style={{ paddingTop: '1rem', paddingBottom: '3rem' }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', marginBottom: '2rem' }}>
        <div style={{ width: '2rem', height: '1px', background: 'var(--accent)', opacity: 0.65 }} />
        <p style={{ fontSize: '0.65rem', letterSpacing: '0.26em', textTransform: 'uppercase', color: 'var(--subtle)', margin: 0 }}>
          {testimonials.sectionLabel}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: '1rem' }}>
        {testimonials.items.map(item => (
          <TestimonialCard
            key={item.id}
            name={item.name}
            label={item.label}
            quote={item.quote}
            src={item.src}
          />
        ))}
      </div>

    </section>
  )
}
