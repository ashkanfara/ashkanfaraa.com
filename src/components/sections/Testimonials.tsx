'use client'

import { useRef, useState, useCallback, useMemo } from 'react'
import { testimonials } from '@/data/content'

const BAR_COUNT = 34

function seededBars(seed: string): number[] {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return Array.from({ length: BAR_COUNT }, (_, i) => {
    h = (h * 1664525 + 1013904223) >>> 0
    const raw = ((h >>> 16) & 0xff) / 255
    // Natural envelope: taller in the middle, shorter at edges
    const env = Math.sin((i / (BAR_COUNT - 1)) * Math.PI) * 0.45 + 0.55
    return Math.max(0.12, raw * env)
  })
}

function fmt(s: number): string {
  if (!isFinite(s) || s <= 0) return '—:——'
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

function TestimonialCard({ name, label, quote, src, id }: {
  name: string; label: string; quote: string; src: string; id: string
}) {
  const audioRef  = useRef<HTMLAudioElement>(null)
  const [playing,  setPlaying]  = useState(false)
  const [duration, setDuration] = useState(0)
  const [current,  setCurrent]  = useState(0)

  const bars        = useMemo(() => seededBars(id), [id])
  const filledCount = Math.round((current / (duration || 1)) * BAR_COUNT)

  const toggle = useCallback(() => {
    const a = audioRef.current
    if (!a) return
    playing ? a.pause() : a.play().catch(() => {})
  }, [playing])

  const seekBar = useCallback((i: number) => {
    const a = audioRef.current
    if (!a || !duration) return
    a.currentTime = (i / BAR_COUNT) * duration
  }, [duration])

  const timeLabel = (playing || current > 0) ? fmt(current) : fmt(duration)

  return (
    <div
      className="card-lift"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '1rem',
        padding: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Top accent */}
      <div style={{
        position: 'absolute', top: 0, right: 0, left: 0, height: '1px',
        background: 'linear-gradient(90deg, transparent, var(--accent), transparent)',
        opacity: 0.38,
      }} />

      {/* Quote — headline to encourage pressing play */}
      <p dir="rtl" style={{
        fontSize: '0.875rem',
        color: 'var(--muted)',
        lineHeight: 1.7,
        margin: 0,
        letterSpacing: '-0.01em',
      }}>
        «{quote}»
      </p>

      {/* Controls row — always LTR */}
      <div dir="ltr" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>

        {/* Play / pause */}
        <button
          type="button"
          onClick={toggle}
          className="play-btn"
          aria-label={playing ? 'توقف' : 'پخش'}
          style={{
            width: '2.75rem', height: '2.75rem',
            borderRadius: '50%',
            border: `1.5px solid ${playing ? 'var(--accent)' : 'var(--border-strong)'}`,
            background: playing ? 'var(--accent)' : 'rgba(255,255,255,0.025)',
            color: playing ? 'var(--accent-fg)' : 'var(--muted)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0,
          }}
        >
          {playing ? (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
              <rect x="5" y="4" width="4" height="16" rx="1.5" />
              <rect x="15" y="4" width="4" height="16" rx="1.5" />
            </svg>
          ) : (
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style={{ marginLeft: '2px' }}>
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* Waveform */}
        <div
          className={[playing ? 'waveform-playing' : '', duration > 0 ? 'waveform-seekable' : ''].filter(Boolean).join(' ')}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
            height: '2.25rem',
            overflow: 'hidden',
          }}
        >
          {bars.map((h, i) => {
            const filled = i < filledCount
            return (
              <div
                key={i}
                onClick={() => seekBar(i)}
                className={filled ? 'waveform-bar-filled' : 'waveform-bar-empty'}
                style={{
                  flex: 1,
                  height: `${Math.round(h * 100)}%`,
                  minHeight: '3px',
                  borderRadius: '9999px',
                  background: filled ? 'var(--accent)' : 'var(--border-strong)',
                  opacity: filled ? 0.9 : 0.45,
                  cursor: duration > 0 ? 'pointer' : 'default',
                  animationDelay: `${(i % 10) * 160}ms`,
                } as React.CSSProperties}
              />
            )
          })}
        </div>

        {/* Time */}
        <span style={{
          fontSize: '0.68rem',
          color: 'var(--subtle)',
          fontVariantNumeric: 'tabular-nums',
          minWidth: '2.5rem',
          textAlign: 'right',
          flexShrink: 0,
          letterSpacing: '0.02em',
        }}>
          {timeLabel}
        </span>
      </div>

      {/* Identity — RTL */}
      <div
        dir="rtl"
        style={{
          borderTop: '1px solid var(--border)',
          paddingTop: '0.875rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.25rem',
        }}
      >
        <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--foreground)', lineHeight: 1.2 }}>
          {name}
        </span>
        <span style={{ fontSize: '0.72rem', color: 'var(--muted)', opacity: 0.7, lineHeight: 1.45 }}>
          {label}
        </span>
      </div>

      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setCurrent(0) }}
        onLoadedMetadata={() => { const a = audioRef.current; if (a) setDuration(a.duration) }}
        onTimeUpdate={() => { const a = audioRef.current; if (a) setCurrent(a.currentTime) }}
      />
    </div>
  )
}

export function Testimonials() {
  return (
    <section dir="rtl" style={{ paddingTop: '0.5rem', paddingBottom: '1.75rem' }}>

      <div style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', marginBottom: '0.5rem' }}>
          <div style={{ width: '2rem', height: '1px', background: 'var(--accent)', opacity: 0.65 }} />
          <p style={{ fontSize: '0.65rem', letterSpacing: '0.26em', textTransform: 'uppercase', color: 'var(--subtle)', margin: 0 }}>
            {testimonials.sectionLabel}
          </p>
        </div>
        <p style={{ fontSize: '0.82rem', color: 'var(--subtle)', lineHeight: 1.75, opacity: 0.8, paddingRight: '2.875rem' }}>
          {testimonials.subtext}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: '1rem' }}>
        {testimonials.items.map(item => (
          <TestimonialCard
            key={item.id}
            id={item.id}
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
