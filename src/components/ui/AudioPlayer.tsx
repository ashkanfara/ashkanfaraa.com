'use client'

import { useRef, useState, useCallback } from 'react'

interface AudioPlayerProps {
  src: string
  name: string
  label: string
}

function formatTime(s: number): string {
  if (!isFinite(s) || s <= 0) return '—'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export function AudioPlayer({ src, name, label }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [remaining, setRemaining] = useState(0)
  const [duration, setDuration] = useState(0)

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
    <div className="flex items-center gap-5 py-6" dir="ltr">
      {/* Play / pause */}
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? 'توقف' : 'پخش'}
        className="w-8 h-8 rounded-full border border-border-strong flex items-center justify-center text-subtle shrink-0 transition-colors duration-150 hover:border-accent hover:text-accent focus-visible:outline-1 focus-visible:outline-accent"
      >
        {playing ? (
          <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
          </svg>
        ) : (
          <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7L8 5z" />
          </svg>
        )}
      </button>

      {/* Speaker info */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', flexShrink: 0 }} dir="rtl">
        <span className="text-sm font-medium text-foreground">{name}</span>
        <span style={{ fontSize: '0.68rem', color: 'var(--subtle)', lineHeight: 1.3 }}>{label}</span>
      </div>

      {/* Progress track */}
      <div
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        onClick={seek}
        className="flex-1 h-px bg-border cursor-pointer relative group"
      >
        <div
          className="absolute inset-y-0 left-0 bg-accent transition-none"
          style={{ width: `${progress}%` }}
        />
        <div className="absolute inset-y-[-3px] left-0 right-0 group-hover:opacity-0" />
      </div>

      {/* Remaining time */}
      <span className="text-[11px] text-subtle tabular-nums shrink-0 w-8 text-left">
        {formatTime(remaining || duration)}
      </span>

      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setProgress(0); setRemaining(0) }}
        onLoadedMetadata={() => {
          const a = audioRef.current
          if (a) { setDuration(a.duration); setRemaining(a.duration) }
        }}
        onTimeUpdate={() => {
          const a = audioRef.current
          if (!a) return
          setProgress((a.currentTime / a.duration) * 100 || 0)
          setRemaining(a.duration - a.currentTime)
        }}
      />
    </div>
  )
}
