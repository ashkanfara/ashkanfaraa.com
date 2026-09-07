'use client'

import { useState, useEffect, useCallback, FormEvent } from 'react'

// ── Types ─────────────────────────────────────────────────────
interface App {
  pageId: string; name: string; email: string; instagram: string
  phone: string; location: string; subject: string; message: string
  submittedAt: string; status: string; paymentToken: string
  tokenExpiry: string | null; approvedPrice: number | null
  approvedCurrency: string; paymentMethod: string; paymentStatus: string
  paymentClaim: string; consCode: string; dmMode: string | null
  senderId: string | null; isBlocked: boolean | null
}
interface DashboardData {
  new: App[]; underReview: App[]; approved: App[]; claimed: App[]; paid: App[]
}
interface AiData {
  leadQuality: string; bestOffer: string; assessmentReason: string
  suggestedAction: string; responseType: string; pastedClaudeOutput: string
  selectedFinalResponse: string; replyInput: string; replyIntent: string
  pastedNextClaudeOutput: string; nextResponse: string; internalNotes: string
  paymentMessage: string
}
const DEFAULT_AI: AiData = {
  leadQuality: 'Unknown', bestOffer: 'Unknown', assessmentReason: '',
  suggestedAction: '', responseType: 'sms', pastedClaudeOutput: '',
  selectedFinalResponse: '', replyInput: '', replyIntent: 'continue-closing',
  pastedNextClaudeOutput: '', nextResponse: '', internalNotes: '', paymentMessage: '',
}
interface ConvHistoryRow {
  id: string; createdAt: string; messageText: string | null
  messageType: string; isStoryReply: boolean; storyId: string | null
  sentText: string | null; responseSent: boolean; responseSentAt: string | null
  failedReason: string | null
}
interface DmStoryContext {
  mediaType: string | null; mediaUrl: string | null
  caption: string | null; aiDescription: string | null; ocrText: string | null
}
interface DmItem {
  id: string; senderId: string; messageText: string | null; messageType: string
  createdAt: string; processingStartedAt: string | null
  isStoryReply: boolean; isStoryMention: boolean; storyId: string | null
  responseText: string | null; failedReason: string | null
  username: string | null; displayName: string | null; profilePictureUrl: string | null
  messageCount: number | null; notes: string | null
  conversationOwner: string | null; humanTakeoverReason: string | null
  storyContext: DmStoryContext | null; history: ConvHistoryRow[]
}
interface FeedbackRow {
  id: string; buffer_id: string; sender_id: string
  inbound_context: string | null; original_draft: string | null
  final_sent_response: string; draft_source: string | null
  was_edited: boolean; feedback_rating: string | null
  feedback_category: string | null; feedback_note: string | null
  created_at: string
}
type CardState =
  | 'sending' | 'status_unknown' | 'needs_review' | 'needs_generation'
  | 'send_failed_open' | 'ai_suggested_ignore' | 'human_managed'
  | 'story_mention' | 'regenerating'
type Section = 'overview' | 'dm' | 'consultations' | 'access' | 'feedback'

// ── Design tokens ─────────────────────────────────────────────
const C = {
  bg:       '#0e0c0a',
  surface:  '#131110',
  card:     '#1a1714',
  border:   '#2c2720',
  border2:  '#1e1c19',
  text:     '#e8e4de',
  muted:    '#6b6359',
  dim:      '#9e9289',
  gold:     '#b5975a',
  goldDim:  '#7a6535',
  green:    '#5a9e6f',
  red:      '#c0504a',
  blue:     '#5a7eb5',
  sidebar:  '#110f0d',
}

const S = {
  page: {
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: '13px', color: C.text, background: C.bg, minHeight: '100vh',
  } as React.CSSProperties,
  card: {
    background: C.card, border: `1px solid ${C.border}`, borderRadius: '8px', marginBottom: '8px',
  } as React.CSSProperties,
  cardHeader: {
    padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer',
  } as React.CSSProperties,
  cardBody: { padding: '0 14px 14px', borderTop: `1px solid ${C.border}` } as React.CSSProperties,
  label: {
    color: C.muted, fontSize: '10px', marginBottom: '2px', marginTop: '10px',
    display: 'block', textTransform: 'uppercase' as const, letterSpacing: '0.06em',
  },
  value: { color: C.text, fontSize: '13px' } as React.CSSProperties,
  input: {
    width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: '6px',
    padding: '7px 10px', fontSize: '12px', color: C.text, outline: 'none',
    fontFamily: 'system-ui, sans-serif', boxSizing: 'border-box' as const,
  },
  select: {
    width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: '6px',
    padding: '7px 10px', fontSize: '12px', color: C.text, outline: 'none',
    fontFamily: 'system-ui, sans-serif',
  } as React.CSSProperties,
  textarea: {
    width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: '6px',
    padding: '7px 10px', fontSize: '12px', color: C.text, outline: 'none',
    fontFamily: 'monospace', resize: 'none' as const, boxSizing: 'border-box' as const,
  },
  sectionHead: {
    fontSize: '10px', letterSpacing: '0.1em', color: C.muted,
    textTransform: 'uppercase' as const, marginBottom: '10px', marginTop: '24px',
    paddingBottom: '6px', borderBottom: `1px solid ${C.border}`,
  } as React.CSSProperties,
}

function btn(
  variant: 'primary' | 'ghost' | 'danger' | 'warn' | 'success' = 'ghost'
): React.CSSProperties {
  const colors: Record<string, { background: string; color: string; border: string }> = {
    primary: { background: C.gold,        color: '#0e0c0a',  border: 'none' },
    ghost:   { background: 'transparent', color: C.dim,      border: `1px solid ${C.border}` },
    danger:  { background: 'transparent', color: C.red,      border: `1px solid ${C.red}` },
    warn:    { background: 'transparent', color: C.gold,     border: `1px solid ${C.gold}` },
    success: { background: 'transparent', color: C.green,    border: `1px solid ${C.green}` },
  }
  return {
    ...colors[variant],
    borderRadius: '6px', padding: '5px 12px', fontSize: '11px',
    fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' as const,
    fontFamily: 'system-ui, sans-serif',
  }
}

// ── Utilities ─────────────────────────────────────────────────
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AU', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}
function fmtTime(iso: string): string {
  const d = new Date(iso); const now = new Date()
  const time = d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false })
  if (d.toDateString() === now.toDateString()) return time
  return `${d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })} ${time}`
}
function fmtPrice(price: number | null, currency: string, method: string): string {
  if (!price) return '—'
  const n = new Intl.NumberFormat('en-AU').format(price)
  if (method === 'manual_ir') return `${n} Toman`
  return `${n} ${currency}`
}
function methodLabel(m: string): string {
  if (m === 'manual_ir') return 'Manual IR (Card)'
  if (m === 'manual_au') return 'Manual AU (Bank)'
  if (m === 'paypal')    return 'PayPal'
  return m || '—'
}
function paymentLink(token: string): string {
  return `https://ashkanfaraa.com/consultation/pay?token=${token}`
}
const WINDOW_MS = 24 * 60 * 60 * 1000
function windowMsRemaining(createdAt: string): number {
  return Math.max(0, new Date(createdAt).getTime() + WINDOW_MS - Date.now())
}
function fmtWindowRemaining(ms: number): string {
  if (ms <= 0) return 'Expired'
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  if (h >= 2) return `${h}h ${m}m`
  if (h === 1) return `1h ${m}m`
  return `${m}m`
}
function getCardState(item: DmItem): CardState {
  if (item.failedReason === null) {
    return item.processingStartedAt ? 'regenerating' : 'needs_generation'
  }
  if (item.failedReason === 'SENDING')             return 'sending'
  if (item.failedReason === 'SEND_STATUS_UNKNOWN') return 'status_unknown'
  if (item.failedReason === 'SEND_FAILED' || item.failedReason === 'IG_SEND_ERROR') return 'send_failed_open'
  if (item.failedReason === 'AI_RECOMMENDED_IGNORE') return 'ai_suggested_ignore'
  if (item.failedReason === 'HUMAN_TEMP_SKIP')          return 'human_managed'
  if (item.failedReason === 'STORY_MENTION_HUMAN_HOLD') return 'story_mention'
  return 'needs_review'
}

// ── Content builders ──────────────────────────────────────────
function buildEnquiryBrief(app: App, d: AiData): string {
  const lines: string[] = [
    'CONSULTATION ENQUIRY — ASHKAN FARAA', '─'.repeat(44),
    `Name:             ${app.name || '—'}`, `Email:            ${app.email || '—'}`,
    `Phone:            ${app.phone || '—'}`, `Instagram:        ${app.instagram || '—'}`,
    `Location:         ${app.location || '—'}`, `Submitted:        ${fmtDate(app.submittedAt)}`,
    `Status:           ${app.status || '—'}`, '', 'Topic / Decision:', `  ${app.subject || '—'}`,
    '', 'Message:', app.message || '—',
  ]
  if (app.approvedPrice) {
    lines.push('', 'Payment Setup:')
    lines.push(`  Price:          ${fmtPrice(app.approvedPrice, app.approvedCurrency, app.paymentMethod)}`)
    lines.push(`  Currency:       ${app.approvedCurrency || '—'}`)
    lines.push(`  Payment method: ${methodLabel(app.paymentMethod)}`)
    if (app.tokenExpiry)   lines.push(`  Link expiry:    ${fmtDate(app.tokenExpiry)}`)
    if (app.paymentStatus) lines.push(`  Payment status: ${app.paymentStatus}`)
  }
  if (d.internalNotes)         lines.push('', 'Internal Note:', d.internalNotes)
  if (d.selectedFinalResponse) lines.push('', 'Saved Response:', d.selectedFinalResponse)
  return lines.join('\n')
}
function buildFollowUpPrompt(app: App, d: AiData): string {
  return `You are Ashkan Faraa's premium consultation closing assistant.

CONTEXT — Original enquiry:
Name: ${app.name || '—'}
Location: ${app.location || '—'}
Topic: ${app.subject || '—'}
Original message: ${app.message || '—'}
${d.selectedFinalResponse ? `\nInitial reply sent:\n${d.selectedFinalResponse}` : ''}

PROSPECT'S LATEST REPLY:
${d.replyInput || '(not provided)'}

Write a single Persian follow-up reply. Same brand rules: calm, direct, premium, no legal promises, no hollow openers. Move toward the most appropriate next step.

## Follow-up Response
[Persian reply]

## Alternative Version
[Slightly different angle or tone]`
}
function buildPaymentMessage(app: App, linkUrl: string, expiryDate: string | null): string {
  const first = (app.name || '').trim().split(/\s+/)[0] || ''
  const priceStr = app.approvedPrice ? fmtPrice(app.approvedPrice, app.approvedCurrency, app.paymentMethod) : '[هزینه جلسه]'
  const expiryStr = expiryDate ? fmtDate(expiryDate) : '[تاریخ انقضا]'
  const methodNote: Record<string, string> = { manual_ir: 'پرداخت از طریق کارت بانکی ایران', manual_au: 'واریز بانکی (استرالیا)', paypal: 'PayPal' }
  const method = methodNote[app.paymentMethod] || 'پرداخت آنلاین'
  const greeting = first ? `${first} جان،\n\n` : ''
  return `${greeting}اگر تصمیم گرفتی جلسه را رزرو کنی، مرحله بعد پرداخت و ثبت زمان مشاوره است.

مشاوره خصوصی ۴۰ دقیقه‌ای با اشکان برای بررسی دقیق‌تر شرایط، مسیرهای کلی، آمادگی مالی/کاری و تصمیم‌گیری واقع‌بینانه قبل از مهاجرت.

هزینه جلسه: ${priceStr}
روش پرداخت: ${method}
لینک پرداخت: ${linkUrl}

این لینک تا ${expiryStr} فعال است.

بعد از پرداخت، اطلاعات رزرو و هماهنگی زمان جلسه برایت ارسال می‌شود.`
}

// ── Small components ──────────────────────────────────────────
function CopyBtn({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button onClick={() => { void navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1800) }} style={btn('ghost')}>
      {copied ? '✓ Copied' : label}
    </button>
  )
}

function SenderAvatar({ profilePictureUrl, label }: { profilePictureUrl: string | null; label: string }) {
  const [imgFailed, setImgFailed] = useState(false)
  const SIZE = 36
  const initials = label.replace(/^@/, '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || '?'
  const circleCss: React.CSSProperties = {
    width: SIZE, height: SIZE, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
    border: `1.5px solid ${C.border}`, display: 'flex', alignItems: 'center',
    justifyContent: 'center', background: '#2a2018', fontSize: '13px',
    fontWeight: 700, color: '#c8b88a', userSelect: 'none',
  }
  if (profilePictureUrl && !imgFailed) {
    return (
      <div style={circleCss}>
        <img src={profilePictureUrl} alt={label} width={SIZE} height={SIZE}
          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
          onError={() => setImgFailed(true)} />
      </div>
    )
  }
  return <div style={circleCss}>{initials}</div>
}

function StoryTextFallback({ text }: { text: string | null }) {
  if (!text) return null
  return (
    <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span style={{ fontSize: '24px', lineHeight: 1 }}>📖</span>
      <p style={{ margin: 0, fontSize: '12px', color: '#9e8e6a', fontStyle: 'italic' }}>{text}</p>
    </div>
  )
}

function StoryThumbnail({ mediaUrl, mediaType, fallbackText }: { mediaUrl: string; mediaType: string | null; fallbackText: string | null }) {
  const [failed, setFailed] = useState(false)
  if (failed) return <StoryTextFallback text={fallbackText || 'Story media unavailable'} />
  if (mediaType === 'VIDEO') {
    return (
      <div style={{ position: 'relative', maxHeight: '180px', overflow: 'hidden', background: '#0d0a04', cursor: 'pointer' }}
        onClick={() => window.open(mediaUrl, '_blank', 'noopener,noreferrer')} title="Click to open story video">
        <video src={mediaUrl} style={{ width: '100%', maxHeight: '180px', objectFit: 'contain', display: 'block' }}
          preload="none" muted playsInline onError={() => setFailed(true)} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <span style={{ fontSize: '36px', opacity: 0.85 }}>▶️</span>
        </div>
      </div>
    )
  }
  return (
    <img src={mediaUrl} alt="Story" style={{ width: '100%', maxHeight: '180px', objectFit: 'contain', display: 'block', background: '#0d0a04', cursor: 'pointer' }}
      onClick={() => window.open(mediaUrl, '_blank', 'noopener,noreferrer')} title="Click to open full story image"
      onError={() => setFailed(true)} />
  )
}

interface DisplayTurn {
  key: string; type: 'inbound' | 'outbound' | 'event'
  text: string; time: string; isStoryReply?: boolean; label?: string
}
function buildDisplayTurns(rows: ConvHistoryRow[]): DisplayTurn[] {
  const turns: DisplayTurn[] = []
  let lastOutboundText: string | null = null
  const seenIgIds = new Set<string>()
  for (const row of rows) {
    const inboundLabel =
      row.failedReason === 'AI_RECOMMENDED_IGNORE'      ? 'AI RECOMMENDED IGNORE'
      : row.failedReason === 'HUMAN_TEMP_SKIP'          ? 'HUMAN-MANAGED'
      : row.failedReason === 'STORY_MENTION_HUMAN_HOLD' ? 'STORY MENTION'
      : undefined
    if (row.messageText) {
      turns.push({ key: `in-${row.id}`, type: 'inbound', text: row.messageText, time: row.createdAt, isStoryReply: row.isStoryReply, label: inboundLabel })
    } else if (row.isStoryReply) {
      turns.push({ key: `ev-${row.id}`, type: 'event', text: 'Story reaction', time: row.createdAt })
    }
    if (row.responseSent && row.sentText) {
      if (row.id && seenIgIds.has(row.id)) continue
      if (row.sentText === lastOutboundText) continue
      turns.push({ key: `out-${row.id}`, type: 'outbound', text: row.sentText, time: row.responseSentAt ?? row.createdAt })
      lastOutboundText = row.sentText
      if (row.id) seenIgIds.add(row.id)
    }
  }
  return turns
}

function ConversationTimeline({ history, currentId, currentItem }: {
  history: ConvHistoryRow[]; currentId: string
  currentItem: { id: string; messageText: string | null; messageType: string; createdAt: string; isStoryReply: boolean }
}) {
  const [histExpanded, setHistExpanded] = useState(false)
  const past = history.filter(r => r.id !== currentId)
  const turns = buildDisplayTurns(past)
  const visibleTurns = histExpanded ? turns : turns.slice(-7)
  const hiddenCount = turns.length - visibleTurns.length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {hiddenCount > 0 && !histExpanded && (
        <button onClick={e => { e.stopPropagation(); setHistExpanded(true) }}
          style={{ alignSelf: 'center', ...btn('ghost'), fontSize: '10px', padding: '2px 10px' }}>
          Show earlier {hiddenCount} messages
        </button>
      )}
      {visibleTurns.map(turn => {
        if (turn.type === 'event') {
          return (
            <div key={turn.key} style={{ alignSelf: 'center', fontSize: '10px', color: C.muted, background: C.bg, border: `1px solid ${C.border2}`, borderRadius: '20px', padding: '3px 10px' }}>
              {turn.text} · {fmtTime(turn.time)}
            </div>
          )
        }
        if (turn.type === 'outbound') {
          return (
            <div key={turn.key} style={{ alignSelf: 'flex-end', maxWidth: '76%', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' }}>
              <div style={{ background: '#071a0d', border: '1px solid #1e4228', borderRadius: '14px 14px 3px 14px', padding: '8px 12px' }}>
                <p style={{ margin: 0, fontSize: '13px', color: '#8ec8a0', whiteSpace: 'pre-wrap', direction: 'rtl', textAlign: 'right', lineHeight: 1.55 }}>{turn.text}</p>
              </div>
              <span style={{ fontSize: '10px', color: '#3d6e4a', letterSpacing: '0.04em' }}>SENT · {fmtTime(turn.time)}</span>
            </div>
          )
        }
        return (
          <div key={turn.key} style={{ alignSelf: 'flex-start', maxWidth: '76%', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '3px' }}>
            {turn.label && <span style={{ fontSize: '10px', color: C.gold, fontWeight: 700, letterSpacing: '0.06em' }}>{turn.label}</span>}
            <div style={{ background: '#141210', border: `1px solid ${C.border}`, borderRadius: '3px 14px 14px 14px', padding: '8px 12px' }}>
              <p style={{ margin: 0, fontSize: '13px', color: '#bfb5a6', whiteSpace: 'pre-wrap', direction: 'rtl', textAlign: 'right', lineHeight: 1.55 }}>{turn.text}</p>
            </div>
            <span style={{ fontSize: '10px', color: C.muted }}>
              {turn.isStoryReply && <span style={{ color: C.gold, marginRight: '4px' }}>↩ Story reply ·</span>}
              {fmtTime(turn.time)}
            </span>
          </div>
        )
      })}
      {currentItem.messageText ? (
        <div style={{ alignSelf: 'flex-start', maxWidth: '76%', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '3px' }}>
          <span style={{ fontSize: '10px', color: '#c8b070', fontWeight: 700, letterSpacing: '0.08em' }}>NEW MESSAGE</span>
          <div style={{ background: '#1a160a', border: `2px solid ${C.gold}`, borderRadius: '3px 14px 14px 14px', padding: '9px 13px' }}>
            <p style={{ margin: 0, fontSize: '13px', color: '#f0dfa8', whiteSpace: 'pre-wrap', direction: 'rtl', textAlign: 'right', lineHeight: 1.6 }}>{currentItem.messageText}</p>
          </div>
          <span style={{ fontSize: '10px', color: '#c8b070' }}>
            {currentItem.isStoryReply && <span style={{ marginRight: '4px' }}>↩ Story reply ·</span>}
            {fmtTime(currentItem.createdAt)}
          </span>
        </div>
      ) : currentItem.isStoryReply ? (
        <div style={{ alignSelf: 'center', fontSize: '10px', color: '#c8b070', background: '#1a160a', border: `2px solid ${C.gold}`, borderRadius: '20px', padding: '4px 14px', fontWeight: 700 }}>
          Story reaction — no text · {fmtTime(currentItem.createdAt)} · NEW
        </div>
      ) : null}
    </div>
  )
}

const FB_CATEGORIES = [
  { value: 'good', label: 'Good draft' }, { value: 'too_long', label: 'Too long' },
  { value: 'too_short', label: 'Too short' }, { value: 'too_soft', label: 'Too soft' },
  { value: 'too_salesy', label: 'Too salesy' }, { value: 'wrong_tone', label: 'Wrong tone' },
  { value: 'missed_context', label: 'Missed context' }, { value: 'other', label: 'Other' },
]
function FeedbackControls({ category, note, onCategory, onNote }: {
  category: string | null; note: string; onCategory: (v: string | null) => void; onNote: (v: string) => void
}) {
  return (
    <div style={{ marginTop: '10px' }}>
      <span style={{ fontSize: '10px', color: '#4a443c', letterSpacing: '0.06em', fontWeight: 600 }}>FEEDBACK (OPTIONAL)</span>
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '5px' }}>
        {FB_CATEGORIES.map(c => (
          <button key={c.value} onClick={() => onCategory(category === c.value ? null : c.value)}
            style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '10px', cursor: 'pointer',
              border: `1px solid ${category === c.value ? C.green : C.border}`,
              background: category === c.value ? '#0a2414' : 'transparent',
              color: category === c.value ? C.green : '#5a5248' }}>
            {c.label}
          </button>
        ))}
      </div>
      {category && (
        <textarea value={note} onChange={e => onNote(e.target.value)} rows={2} maxLength={500}
          placeholder="Optional note…"
          style={{ ...S.textarea, marginTop: '6px', resize: 'vertical', fontSize: '11px', direction: 'rtl' }} />
      )}
    </div>
  )
}

// ── NeedsGenerationCard (proper component — fixes hooks-in-conditionals) ──
// "Generate with API" button is intentionally absent from this component.
// The backend route for mode='api' is preserved but not exposed in the UI.
function NeedsGenerationCard({ item, onRefresh }: { item: DmItem; onRefresh: () => void }) {
  const [promptPackage, setPromptPackage] = useState<string | null>(null)
  const [pasteText,     setPasteText]     = useState('')
  const [writeMode,     setWriteMode]     = useState<'write' | 'paste' | null>(null)
  const [copied,        setCopied]        = useState(false)
  const [busy,          setBusy]          = useState<string | null>(null)
  const [err,           setErr]           = useState<string | null>(null)

  const msLeft = windowMsRemaining(item.createdAt)
  const primaryLabel = item.username ? `@${item.username}` : item.displayName ?? 'Instagram User'
  const avatarLabel  = item.displayName || item.username || 'I'

  const windowColor = msLeft < 2 * 3_600_000 ? C.red : msLeft < 6 * 3_600_000 ? C.gold : C.green

  async function buildPrompt() {
    setBusy('generate_claude'); setErr(null)
    try {
      const res  = await fetch('/api/admin/dm-inbox/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, mode: 'claude' }),
      })
      const data = await res.json() as { ok: boolean; promptPackage?: string; error?: string }
      if (data.ok && data.promptPackage) {
        setPromptPackage(data.promptPackage); setWriteMode('paste'); setPasteText('')
      } else { setErr(data.error ?? 'Failed to build prompt') }
    } catch { setErr('Network error') }
    finally { setBusy(null) }
  }

  async function saveDraft(draftSource: 'CLAUDE_MANUAL' | 'HUMAN') {
    const text = pasteText.trim()
    if (!text) { setErr('Draft cannot be empty'); return }
    setBusy('save_draft'); setErr(null)
    try {
      const res  = await fetch('/api/admin/dm-inbox/save-draft', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, text, draftSource }),
      })
      const data = await res.json() as { ok: boolean; error?: string }
      if (data.ok) { setTimeout(onRefresh, 400) }
      else          { setErr(data.error ?? 'Save failed') }
    } catch { setErr('Network error') }
    finally { setBusy(null) }
  }

  async function doIgnore() {
    setBusy('ignore'); setErr(null)
    try {
      const res  = await fetch('/api/admin/dm-inbox', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ignore', id: item.id, senderId: item.senderId }),
      })
      const data = await res.json() as { ok: boolean; error?: string }
      if (data.ok) { setTimeout(onRefresh, 600) }
      else          { setErr(data.error ?? 'Failed') }
    } catch { setErr('Network error') }
    finally { setBusy(null) }
  }

  async function copyPrompt() {
    if (!promptPackage) return
    try {
      await navigator.clipboard.writeText(promptPackage)
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    } catch { setErr('Clipboard not available — select all text above and copy manually') }
  }

  const isBusy = busy !== null

  return (
    <div style={{ ...S.card, borderLeft: `3px solid ${C.blue}` }}>
      {/* Header */}
      <div style={{ ...S.cardHeader, alignItems: 'center', cursor: 'default' }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <SenderAvatar profilePictureUrl={item.profilePictureUrl} label={avatarLabel} />
          <div style={{ minWidth: 0 }}>
            <span style={{ fontWeight: 700, fontSize: '13px', color: C.text }}>{primaryLabel}</span>
            <span style={{ marginLeft: '8px', fontSize: '10px', color: C.blue, border: `1px solid ${C.blue}`, borderRadius: '4px', padding: '1px 5px', fontWeight: 700 }}>
              Needs Draft
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <span style={{ fontSize: '11px', color: windowColor, fontWeight: msLeft < 2 * 3_600_000 ? 700 : 400 }}>
            ⏱ {fmtWindowRemaining(msLeft)}
          </span>
          <span style={{ fontSize: '11px', color: C.muted }}>
            {new Date(item.createdAt).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '0 14px 14px' }}>
        {item.messageText && (
          <div style={{ background: '#141210', border: `1px solid ${C.border}`, borderRadius: '3px 14px 14px 14px', padding: '9px 13px', marginBottom: '12px', display: 'inline-block', maxWidth: '80%' }}>
            <p style={{ margin: 0, fontSize: '13px', color: '#f0dfa8', whiteSpace: 'pre-wrap', direction: 'rtl', textAlign: 'right', lineHeight: 1.6 }}>{item.messageText}</p>
          </div>
        )}

        {/* Action: no mode selected */}
        {writeMode === null && (
          <>
            <p style={{ margin: '0 0 10px', color: '#7a9bcc', fontSize: '11px' }}>
              No draft yet. Generate with Claude, or write a reply directly.
            </p>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <button disabled={isBusy} onClick={() => void buildPrompt()}
                style={{ ...btn('primary'), fontSize: '12px' }}
                title="Build a Claude prompt you can copy into Claude.ai — zero API cost">
                {busy === 'generate_claude' ? '…' : '✦ Generate with Claude'}
              </button>
              <button disabled={isBusy} onClick={() => { setWriteMode('write'); setPasteText(''); setErr(null) }}
                style={{ ...btn('ghost'), fontSize: '12px' }} title="Type a reply manually — no AI call">
                Write Reply
              </button>
              <button disabled={isBusy} onClick={() => void doIgnore()} style={{ ...btn('ghost'), fontSize: '12px' }}>
                {busy === 'ignore' ? '…' : 'Ignore'}
              </button>
            </div>
          </>
        )}

        {/* Generate with Claude: prompt + paste flow */}
        {writeMode === 'paste' && (
          <div>
            {promptPackage && (
              <div style={{ marginBottom: '10px' }}>
                <p style={{ fontSize: '10px', color: C.muted, margin: '0 0 4px', fontWeight: 700, letterSpacing: '0.06em' }}>
                  CLAUDE PROMPT READY — copy and paste into Claude.ai
                </p>
                <textarea readOnly value={promptPackage} rows={6}
                  style={{ ...S.textarea, fontSize: '10px', color: C.dim, fontFamily: 'monospace', direction: 'ltr', resize: 'vertical', cursor: 'text' }}
                  onClick={e => (e.currentTarget as HTMLTextAreaElement).select()} />
                <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                  <button onClick={() => void copyPrompt()} style={{ ...btn('primary'), fontSize: '11px' }}>
                    {copied ? '✓ Copied!' : 'Copy Prompt'}
                  </button>
                  <a href="https://claude.ai" target="_blank" rel="noopener noreferrer"
                    style={{ ...btn('ghost'), fontSize: '11px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
                    Open Claude.ai ↗
                  </a>
                </div>
              </div>
            )}
            <p style={{ fontSize: '10px', color: C.muted, margin: '10px 0 4px', fontWeight: 700, letterSpacing: '0.06em' }}>
              PASTE CLAUDE&apos;S REPLY HERE
            </p>
            <textarea value={pasteText} onChange={e => setPasteText(e.target.value)} rows={4}
              placeholder="Paste Claude's reply here…"
              style={{ ...S.textarea, direction: 'rtl', lineHeight: 1.7 }} />
            {pasteText.trim() && (
              <div style={{ marginTop: '6px', padding: '8px 10px', background: '#071a0d', border: '1px solid #1e4228', borderRadius: '6px' }}>
                <span style={{ fontSize: '10px', color: C.green, fontWeight: 700, letterSpacing: '0.06em', display: 'block', marginBottom: '4px' }}>WILL SAVE AS DRAFT:</span>
                <p style={{ margin: 0, fontSize: '12px', color: '#9ee0b0', whiteSpace: 'pre-wrap', direction: 'rtl', textAlign: 'right' }}>{pasteText.trim()}</p>
              </div>
            )}
            {err && <p style={{ color: C.red, fontSize: '11px', margin: '6px 0 0' }}>{err}</p>}
            <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
              <button disabled={isBusy || !pasteText.trim()} onClick={() => void saveDraft('CLAUDE_MANUAL')}
                style={{ ...btn('primary'), fontSize: '12px', opacity: !pasteText.trim() ? 0.5 : 1 }}>
                {busy === 'save_draft' ? '…' : 'Save Draft'}
              </button>
              <button disabled={isBusy} onClick={() => { setWriteMode(null); setPromptPackage(null); setPasteText(''); setErr(null) }}
                style={{ ...btn('ghost'), fontSize: '12px' }}>Cancel</button>
            </div>
          </div>
        )}

        {/* Write Reply: inline human composer — no takeover, no DB action until Save */}
        {writeMode === 'write' && (
          <div>
            <p style={{ fontSize: '10px', color: C.muted, margin: '0 0 4px', fontWeight: 700, letterSpacing: '0.06em' }}>WRITE YOUR REPLY</p>
            <textarea value={pasteText} onChange={e => setPasteText(e.target.value)} rows={4}
              placeholder="Type your reply…" style={{ ...S.textarea, direction: 'rtl', lineHeight: 1.7 }} autoFocus />
            {pasteText.trim() && (
              <div style={{ marginTop: '6px', padding: '8px 10px', background: '#071a0d', border: '1px solid #1e4228', borderRadius: '6px' }}>
                <span style={{ fontSize: '10px', color: C.green, fontWeight: 700, letterSpacing: '0.06em', display: 'block', marginBottom: '4px' }}>WILL SAVE AS DRAFT:</span>
                <p style={{ margin: 0, fontSize: '12px', color: '#9ee0b0', whiteSpace: 'pre-wrap', direction: 'rtl', textAlign: 'right' }}>{pasteText.trim()}</p>
              </div>
            )}
            {err && <p style={{ color: C.red, fontSize: '11px', margin: '6px 0 0' }}>{err}</p>}
            <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
              <button disabled={isBusy || !pasteText.trim()} onClick={() => void saveDraft('HUMAN')}
                style={{ ...btn('primary'), fontSize: '12px', opacity: !pasteText.trim() ? 0.5 : 1 }}>
                {busy === 'save_draft' ? '…' : 'Save Draft'}
              </button>
              <button disabled={isBusy} onClick={() => { setWriteMode(null); setPasteText(''); setErr(null) }}
                style={{ ...btn('ghost'), fontSize: '12px' }}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── DmInboxItem ───────────────────────────────────────────────
function DmInboxItem({ item, onRefresh }: { item: DmItem; onRefresh: () => void }) {
  const [editText,     setEditText]     = useState(item.responseText ?? '')
  const [busy,         setBusy]         = useState<string | null>(null)
  const [err,          setErr]          = useState<string | null>(null)
  const [success,      setSuccess]      = useState<string | null>(null)
  const [expanded,     setExpanded]     = useState(true)
  const [showComposer, setShowComposer] = useState(false)
  const [fbCategory,   setFbCategory]   = useState<string | null>(null)
  const [fbNote,       setFbNote]       = useState('')

  const cardState   = getCardState(item)
  const msLeft      = windowMsRemaining(item.createdAt)
  const urgent      = msLeft < 2 * 3_600_000
  const windowColor = msLeft < 2 * 3_600_000 ? C.red : msLeft < 6 * 3_600_000 ? C.gold : C.green

  const primaryLabel  = item.username ? `@${item.username}` : item.displayName ?? 'Instagram User'
  const avatarLabel   = item.displayName || item.username || 'I'
  const igProfileHref = item.username ? `https://www.instagram.com/${encodeURIComponent(item.username)}/` : null
  const displayName   = primaryLabel

  // NeedsGenerationCard handles needs_generation (hooks extracted to proper component)
  if (cardState === 'needs_generation') {
    return <NeedsGenerationCard item={item} onRefresh={onRefresh} />
  }

  async function call(path: string, body: Record<string, string | null | boolean>): Promise<{ ok: boolean; error?: string }> {
    const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    return res.json()
  }

  async function send() {
    if (!editText.trim()) return
    setBusy('send'); setErr(null); setSuccess(null)
    try {
      const data = await call('/api/admin/dm-inbox/send', { id: item.id, finalText: editText, feedbackCategory: fbCategory, feedbackNote: fbNote.trim() || null })
      if (data.ok) { setSuccess('✓ Sent'); setTimeout(onRefresh, 1200) }
      else          { setErr(data.error ?? 'Send failed') }
    } catch { setErr('Network error') }
    finally { setBusy(null) }
  }

  async function mutate(action: string, extra: Record<string, string> = {}) {
    setBusy(action); setErr(null); setSuccess(null)
    try {
      const data = await call('/api/admin/dm-inbox', { action, id: item.id, senderId: item.senderId, ...extra })
      if (data.ok) {
        const msgs: Record<string, string> = { ignore: 'Ignored', requeue: 'Regeneration requested — refresh to see new draft', retry_send_failed: 'Reset — re-approve to send', takeover: 'Taken over — AI paused', release: 'Released to AI', block: 'Blocked' }
        setSuccess(msgs[action] ?? 'Done')
        setTimeout(onRefresh, 1000)
      } else { setErr(data.error ?? 'Action failed') }
    } catch { setErr('Network error') }
    finally { setBusy(null) }
  }

  const isBusy = busy !== null

  // Regenerating
  if (cardState === 'regenerating') {
    const regenOrigin    = item.processingStartedAt ?? item.createdAt
    const regenElapsedMs = Date.now() - new Date(regenOrigin).getTime()
    const regenTimedOut  = regenElapsedMs > 10 * 60 * 1000
    const regenElapsedMin = Math.floor(regenElapsedMs / 60000)

    async function cancelRegen() {
      setBusy('cancel_regen'); setErr(null)
      try {
        const res = await fetch('/api/admin/dm-inbox', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'cancel_regen', id: item.id }) })
        const data = await res.json() as { ok: boolean; error?: string }
        if (data.ok) { setTimeout(onRefresh, 400) } else { setErr(data.error ?? 'Cancel failed') }
      } catch { setErr('Network error') }
      finally { setBusy(null) }
    }

    return (
      <div style={{ ...S.card, borderLeft: `3px solid ${regenTimedOut ? C.red : C.gold}` }}>
        <div style={{ ...S.cardHeader, alignItems: 'center', cursor: 'default' }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <SenderAvatar profilePictureUrl={item.profilePictureUrl} label={avatarLabel} />
            <div>
              <span style={{ fontWeight: 700, fontSize: '13px', color: C.text }}>{primaryLabel}</span>
              <span style={{ marginLeft: '8px', fontSize: '10px', color: regenTimedOut ? C.red : C.gold, border: `1px solid ${regenTimedOut ? C.red : C.gold}`, borderRadius: '4px', padding: '1px 5px', fontWeight: 700 }}>
                {regenTimedOut ? `Regeneration delayed (${regenElapsedMin}m)` : 'Regenerating…'}
              </span>
            </div>
          </div>
        </div>
        <div style={{ padding: '0 14px 12px', fontSize: '12px' }}>
          {item.messageText && <p style={{ ...S.value, whiteSpace: 'pre-wrap', fontSize: '12px', color: C.dim, margin: '0 0 8px' }}>{item.messageText}</p>}
          {item.responseText && (
            <div style={{ marginBottom: '8px' }}>
              <p style={{ fontSize: '10px', color: C.muted, margin: '0 0 4px', fontWeight: 600, letterSpacing: '0.06em' }}>PREVIOUS DRAFT — PRESERVED</p>
              <p style={{ ...S.value, whiteSpace: 'pre-wrap', fontSize: '12px', color: C.dim, fontStyle: 'italic', margin: 0 }}>{item.responseText}</p>
            </div>
          )}
          <p style={{ margin: '0 0 10px', color: regenTimedOut ? C.red : C.gold, fontSize: '11px' }}>
            {regenTimedOut ? 'AI draft has not arrived yet. Cancel to keep the previous draft, or refresh to check again.' : 'AI is generating a new draft — refresh in a moment.'}
          </p>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button onClick={onRefresh} style={{ ...btn('ghost'), fontSize: '11px' }}>Refresh</button>
            <button disabled={busy !== null} onClick={() => void cancelRegen()} style={{ ...btn('warn'), fontSize: '11px' }}>
              {busy === 'cancel_regen' ? '…' : 'Cancel Regeneration'}
            </button>
          </div>
          {err && <p style={{ color: C.red, fontSize: '11px', marginTop: '6px' }}>{err}</p>}
        </div>
      </div>
    )
  }

  // Audit-only states
  if (cardState === 'human_managed' || cardState === 'story_mention') {
    const stateLabel = cardState === 'human_managed' ? 'HUMAN-MANAGED' : 'STORY MENTION'
    return (
      <div style={{ ...S.card, borderLeft: `3px solid ${C.border}`, opacity: 0.8 }}>
        <div style={{ ...S.cardHeader, alignItems: 'center', cursor: 'default' }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <SenderAvatar profilePictureUrl={item.profilePictureUrl} label={avatarLabel} />
            <div>
              <span style={{ fontWeight: 700, fontSize: '13px', color: C.text }}>{primaryLabel}</span>
              <span style={{ marginLeft: '8px', fontSize: '10px', color: C.muted, border: `1px solid ${C.muted}`, borderRadius: '4px', padding: '1px 5px' }}>{stateLabel}</span>
            </div>
          </div>
          <span style={{ fontSize: '11px', color: C.muted }}>{new Date(item.createdAt).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        {item.messageText && (
          <div style={{ padding: '0 14px 10px' }}>
            <p style={{ ...S.value, whiteSpace: 'pre-wrap', fontSize: '12px', color: C.dim, margin: 0 }}>{item.messageText}</p>
            {cardState === 'human_managed' && (
              <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                {item.conversationOwner !== 'human_temp' ? (
                  <button disabled={isBusy} onClick={() => mutate('takeover')} style={btn('ghost')}>{busy === 'takeover' ? '…' : 'Take Over'}</button>
                ) : (
                  <button disabled={isBusy} onClick={() => mutate('release')} style={{ ...btn('ghost'), color: C.green, borderColor: C.green }}>{busy === 'release' ? '…' : 'Release to AI'}</button>
                )}
                {err     && <span style={{ color: C.red,   fontSize: '11px' }}>{err}</span>}
                {success && <span style={{ color: C.green, fontSize: '11px' }}>{success}</span>}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  const stateDesc =
    cardState === 'needs_review'        ? 'Needs reply'
    : cardState === 'send_failed_open'  ? 'Send failed'
    : cardState === 'sending'           ? 'Sending…'
    : cardState === 'status_unknown'    ? '⚠ Send outcome unknown'
    : cardState === 'ai_suggested_ignore' ? 'AI suggests no reply'
    : 'Needs reply'

  const accentColor = (cardState === 'send_failed_open' || cardState === 'status_unknown') ? C.red : C.border

  return (
    <div style={{ ...S.card, borderLeft: `3px solid ${accentColor}` }}>
      {/* Header */}
      <div style={{ ...S.cardHeader, alignItems: 'center' }} onClick={() => setExpanded(o => !o)}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div onClick={e => e.stopPropagation()}><SenderAvatar profilePictureUrl={item.profilePictureUrl} label={avatarLabel} /></div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {igProfileHref ? (
                <a href={igProfileHref} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                  style={{ fontWeight: 700, fontSize: '14px', color: C.text, textDecoration: 'none' }}
                  onMouseOver={e => (e.currentTarget.style.textDecoration = 'underline')}
                  onMouseOut={e => (e.currentTarget.style.textDecoration = 'none')}>{primaryLabel}</a>
              ) : (
                <span style={{ fontWeight: 700, fontSize: '14px', color: C.text }}>{primaryLabel}</span>
              )}
              {item.isStoryReply && <span style={{ fontSize: '10px', color: '#fff', background: C.gold, borderRadius: '4px', padding: '1px 6px', fontWeight: 700 }}>STORY REPLY</span>}
              {item.conversationOwner === 'human_temp' && <span style={{ fontSize: '10px', color: C.green, border: `1px solid ${C.green}`, borderRadius: '4px', padding: '1px 5px' }}>Human Hold</span>}
            </div>
            <div style={{ fontSize: '11px', color: windowColor, marginTop: '2px', fontWeight: urgent ? 700 : 400 }}>
              {stateDesc} · ⏱ {fmtWindowRemaining(msLeft)} remaining
            </div>
          </div>
        </div>
        <span style={{ color: C.muted, fontSize: '11px', flexShrink: 0, marginLeft: '8px' }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div style={{ ...S.cardBody, paddingTop: '14px' }}>
          <ConversationTimeline history={item.history} currentId={item.id} currentItem={item} />

          {/* Story context */}
          {item.isStoryReply && (
            <div style={{ margin: '14px 0 4px', borderRadius: '8px', border: `1px solid #3a3020`, background: '#1a1508', overflow: 'hidden' }}>
              {item.storyContext?.mediaUrl ? (
                <StoryThumbnail mediaUrl={item.storyContext.mediaUrl} mediaType={item.storyContext.mediaType} fallbackText={item.storyContext.aiDescription || item.storyContext.caption || item.storyContext.ocrText} />
              ) : (item.storyContext?.aiDescription || item.storyContext?.caption || item.storyContext?.ocrText) ? (
                <StoryTextFallback text={item.storyContext.aiDescription || item.storyContext.caption || item.storyContext.ocrText} />
              ) : null}
              {(item.storyContext?.caption || item.storyContext?.ocrText) && (
                <div style={{ padding: '8px 10px', borderTop: item.storyContext?.mediaUrl ? `1px solid #3a3020` : undefined }}>
                  <span style={{ fontSize: '10px', color: C.gold, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block', marginBottom: '3px' }}>Story Caption</span>
                  <p style={{ margin: 0, fontSize: '12px', color: '#c8b88a', direction: 'rtl', textAlign: 'right', whiteSpace: 'pre-wrap' }}>{item.storyContext.caption || item.storyContext.ocrText}</p>
                </div>
              )}
              {!item.storyContext && <div style={{ padding: '8px 10px' }}><span style={{ fontSize: '11px', color: C.muted }}>Story context not available</span></div>}
            </div>
          )}

          {/* Composer */}
          <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: `1px solid ${C.border2}` }}>

            {/* PENDING_REVIEW */}
            {cardState === 'needs_review' && (
              <>
                <span style={{ ...S.label, color: '#c8b070', fontWeight: 700, letterSpacing: '0.08em' }}>AI SUGGESTED REPLY — NOT SENT</span>
                <textarea value={editText} onChange={e => setEditText(e.target.value)} rows={4}
                  style={{ ...S.textarea, direction: 'rtl', lineHeight: 1.7, marginTop: '6px' }} placeholder="AI draft will appear here…" />
                {editText.trim() && (
                  <div style={{ marginTop: '8px', padding: '8px 10px', background: '#071a0d', border: '1px solid #1e4228', borderRadius: '6px' }}>
                    <span style={{ fontSize: '10px', color: C.green, fontWeight: 700, letterSpacing: '0.06em', display: 'block', marginBottom: '4px' }}>WILL SEND:</span>
                    <p style={{ margin: 0, fontSize: '13px', color: '#9ee0b0', whiteSpace: 'pre-wrap', direction: 'rtl', textAlign: 'right', lineHeight: 1.6 }}>{editText.trim()}</p>
                  </div>
                )}
                {err     && <p style={{ color: C.red,   fontSize: '11px', margin: '8px 0 0' }}>{err}</p>}
                {success && <p style={{ color: C.green, fontSize: '11px', margin: '8px 0 0' }}>{success}</p>}
                <FeedbackControls category={fbCategory} note={fbNote} onCategory={setFbCategory} onNote={setFbNote} />
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px' }}>
                  <button disabled={isBusy || !editText.trim()} onClick={() => { void send() }}
                    style={{ ...btn('primary'), opacity: (isBusy || !editText.trim()) ? 0.5 : 1, fontSize: '12px' }}>
                    {busy === 'send' ? '…' : 'Approve & Send'}
                  </button>
                  <button disabled={isBusy} onClick={() => void mutate('ignore')} style={{ ...btn('ghost'), fontSize: '12px' }}>{busy === 'ignore' ? '…' : 'Ignore'}</button>
                  {item.conversationOwner !== 'human_temp' ? (
                    <button disabled={isBusy} onClick={() => mutate('takeover')} style={{ ...btn('ghost'), fontSize: '12px' }}>{busy === 'takeover' ? '…' : 'Take Over'}</button>
                  ) : (
                    <button disabled={isBusy} onClick={() => mutate('release')} style={{ ...btn('ghost'), fontSize: '12px', color: C.green, borderColor: C.green }}>{busy === 'release' ? '…' : 'Release to AI'}</button>
                  )}
                  <button disabled={isBusy} onClick={() => { if (!window.confirm(`Block ${displayName}? AI will never reply to them again.`)) return; void mutate('block', { displayName: item.displayName || item.senderId }) }} style={{ ...btn('danger'), fontSize: '12px' }}>
                    {busy === 'block' ? '…' : 'Block'}
                  </button>
                </div>
              </>
            )}

            {/* AI_RECOMMENDED_IGNORE */}
            {cardState === 'ai_suggested_ignore' && (
              <>
                <div style={{ padding: '10px 12px', background: '#1a1508', border: `1px solid #3a3020`, borderRadius: '6px', fontSize: '12px', color: '#c8b88a', lineHeight: 1.6, marginBottom: '10px' }}>
                  AI recommends no reply. Nothing has been sent.
                </div>
                {!showComposer ? (
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <button onClick={() => setShowComposer(true)} style={{ ...btn('warn'), fontSize: '12px' }}>Write Reply</button>
                    <button disabled={isBusy} onClick={() => void mutate('ignore')} style={{ ...btn('ghost'), fontSize: '12px' }}>{busy === 'ignore' ? '…' : 'Ignore'}</button>
                    {item.conversationOwner !== 'human_temp' ? (
                      <button disabled={isBusy} onClick={() => mutate('takeover')} style={{ ...btn('ghost'), fontSize: '12px' }}>{busy === 'takeover' ? '…' : 'Take Over'}</button>
                    ) : (
                      <button disabled={isBusy} onClick={() => mutate('release')} style={{ ...btn('ghost'), fontSize: '12px', color: C.green, borderColor: C.green }}>{busy === 'release' ? '…' : 'Release to AI'}</button>
                    )}
                    <button disabled={isBusy} onClick={() => { if (!window.confirm(`Block ${displayName}? AI will never reply to them again.`)) return; void mutate('block', { displayName: item.displayName || item.senderId }) }} style={{ ...btn('danger'), fontSize: '12px' }}>{busy === 'block' ? '…' : 'Block'}</button>
                  </div>
                ) : (
                  <>
                    <span style={{ ...S.label, color: '#c8b070', fontWeight: 700, letterSpacing: '0.08em' }}>YOUR REPLY — NOT SENT</span>
                    <textarea value={editText} onChange={e => setEditText(e.target.value)} rows={4}
                      style={{ ...S.textarea, direction: 'rtl', lineHeight: 1.7, marginTop: '6px' }} placeholder="Type your reply…" />
                    {editText.trim() && (
                      <div style={{ marginTop: '8px', padding: '8px 10px', background: '#071a0d', border: '1px solid #1e4228', borderRadius: '6px' }}>
                        <span style={{ fontSize: '10px', color: C.green, fontWeight: 700, letterSpacing: '0.06em', display: 'block', marginBottom: '4px' }}>WILL SEND:</span>
                        <p style={{ margin: 0, fontSize: '13px', color: '#9ee0b0', whiteSpace: 'pre-wrap', direction: 'rtl', textAlign: 'right', lineHeight: 1.6 }}>{editText.trim()}</p>
                      </div>
                    )}
                    {err     && <p style={{ color: C.red,   fontSize: '11px', margin: '8px 0 0' }}>{err}</p>}
                    {success && <p style={{ color: C.green, fontSize: '11px', margin: '8px 0 0' }}>{success}</p>}
                    <FeedbackControls category={fbCategory} note={fbNote} onCategory={setFbCategory} onNote={setFbNote} />
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px' }}>
                      <button disabled={isBusy || !editText.trim()} onClick={() => { void send() }} style={{ ...btn('primary'), opacity: (isBusy || !editText.trim()) ? 0.5 : 1, fontSize: '12px' }}>
                        {busy === 'send' ? '…' : 'Approve & Send'}
                      </button>
                      <button disabled={isBusy} onClick={() => void mutate('ignore')} style={{ ...btn('ghost'), fontSize: '12px' }}>{busy === 'ignore' ? '…' : 'Ignore'}</button>
                    </div>
                  </>
                )}
              </>
            )}

            {/* SEND_FAILED */}
            {cardState === 'send_failed_open' && (
              <>
                <div style={{ padding: '10px 12px', background: '#1c0a0a', border: `1px solid ${C.red}`, borderRadius: '6px', marginBottom: '10px' }}>
                  <span style={{ fontSize: '11px', color: C.red, fontWeight: 700, display: 'block', marginBottom: '4px' }}>SEND FAILED</span>
                  {item.responseText && <p style={{ margin: 0, fontSize: '12px', color: '#bfb5a6', whiteSpace: 'pre-wrap', direction: 'rtl', textAlign: 'right' }}>Attempted: {item.responseText}</p>}
                </div>
                {err     && <p style={{ color: C.red,   fontSize: '11px', margin: '0 0 8px' }}>{err}</p>}
                {success && <p style={{ color: C.green, fontSize: '11px', margin: '0 0 8px' }}>{success}</p>}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <button disabled={isBusy} onClick={() => { if (!window.confirm('Reset this failed send attempt? You will need to re-approve before it sends.')) return; void mutate('retry_send_failed') }} style={{ ...btn('warn'), fontSize: '12px' }}>
                    {busy === 'retry_send_failed' ? '…' : 'Retry Send'}
                  </button>
                  <button disabled={isBusy} onClick={() => void mutate('ignore')} style={{ ...btn('ghost'), fontSize: '12px' }}>{busy === 'ignore' ? '…' : 'Ignore'}</button>
                  {item.conversationOwner !== 'human_temp' ? (
                    <button disabled={isBusy} onClick={() => mutate('takeover')} style={{ ...btn('ghost'), fontSize: '12px' }}>{busy === 'takeover' ? '…' : 'Take Over'}</button>
                  ) : (
                    <button disabled={isBusy} onClick={() => mutate('release')} style={{ ...btn('ghost'), fontSize: '12px', color: C.green, borderColor: C.green }}>{busy === 'release' ? '…' : 'Release to AI'}</button>
                  )}
                  <button disabled={isBusy} onClick={() => { if (!window.confirm(`Block ${displayName}? AI will never reply to them again.`)) return; void mutate('block', { displayName: item.displayName || item.senderId }) }} style={{ ...btn('danger'), fontSize: '12px' }}>
                    {busy === 'block' ? '…' : 'Block'}
                  </button>
                </div>
              </>
            )}

            {cardState === 'sending'        && <span style={{ fontSize: '12px', color: C.gold }}>Send in progress…</span>}
            {cardState === 'status_unknown' && (
              <div style={{ background: '#1c100a', border: `1px solid ${C.red}`, borderRadius: '6px', padding: '10px 12px', fontSize: '12px', color: C.red, lineHeight: 1.6 }}>
                <strong>⚠ Send outcome unknown.</strong> Instagram may or may not have delivered this message.
                Check your <strong>Instagram outbox</strong> before taking any action. Do <strong>not</strong> retry via this UI — resolve manually in Supabase after confirming.
              </div>
            )}
          </div>

          {/* Metadata footer */}
          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginTop: '10px', paddingTop: '8px', borderTop: `1px solid #141210`, fontSize: '10px', color: '#3a3530' }}>
            {item.conversationOwner && <span>Owner: {item.conversationOwner}{item.humanTakeoverReason ? ` (${item.humanTakeoverReason})` : ''}</span>}
            <span>ID: {item.senderId}</span>
            {item.messageCount !== null && <span>{item.messageCount} messages</span>}
          </div>
        </div>
      )}
    </div>
  )
}

// ── DmInbox section ───────────────────────────────────────────

interface ConversationGroup {
  senderId: string
  items: DmItem[]
  history: ConvHistoryRow[]
  username: string | null
  displayName: string | null
  profilePictureUrl: string | null
  latestItem: DmItem
  pendingCount: number
  worstState: CardState
  mostUrgentMs: number
}

const STATE_PRIORITY: Record<CardState, number> = {
  needs_generation: 0, needs_review: 1, send_failed_open: 2,
  status_unknown: 3, sending: 4, regenerating: 5,
  ai_suggested_ignore: 6, story_mention: 7, human_managed: 8,
}

function groupBySender(items: DmItem[]): ConversationGroup[] {
  const map = new Map<string, DmItem[]>()
  for (const item of items) {
    const list = map.get(item.senderId) ?? []
    list.push(item)
    map.set(item.senderId, list)
  }
  const groups: ConversationGroup[] = []
  for (const [senderId, senderItems] of map) {
    const sorted = [...senderItems].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    const latestItem = sorted[sorted.length - 1]
    const pendingItems = senderItems.filter(i => {
      const s = getCardState(i)
      return s !== 'human_managed' && s !== 'story_mention'
    })
    let worstState: CardState = getCardState(latestItem)
    for (const item of senderItems) {
      const s = getCardState(item)
      if (STATE_PRIORITY[s] < STATE_PRIORITY[worstState]) worstState = s
    }
    const urgentItems = pendingItems.filter(i => windowMsRemaining(i.createdAt) < 2 * 3_600_000)
    const mostUrgentMs = urgentItems.length > 0
      ? Math.min(...urgentItems.map(i => windowMsRemaining(i.createdAt)))
      : Math.min(...pendingItems.map(i => windowMsRemaining(i.createdAt)), Infinity)
    groups.push({
      senderId,
      items: sorted,
      history: latestItem.history,
      username: latestItem.username,
      displayName: latestItem.displayName,
      profilePictureUrl: latestItem.profilePictureUrl,
      latestItem,
      pendingCount: pendingItems.length,
      worstState,
      mostUrgentMs,
    })
  }
  // Sort: urgent first, then by state priority, then by recency
  groups.sort((a, b) => {
    const aUrgent = a.mostUrgentMs < 2 * 3_600_000 ? 0 : 1
    const bUrgent = b.mostUrgentMs < 2 * 3_600_000 ? 0 : 1
    if (aUrgent !== bUrgent) return aUrgent - bUrgent
    const aPri = STATE_PRIORITY[a.worstState]
    const bPri = STATE_PRIORITY[b.worstState]
    if (aPri !== bPri) return aPri - bPri
    return new Date(b.latestItem.createdAt).getTime() - new Date(a.latestItem.createdAt).getTime()
  })
  return groups
}

const STATE_COLOR: Record<CardState, string> = {
  needs_generation: C.blue, needs_review: C.green, send_failed_open: C.red,
  status_unknown: C.red, sending: C.gold, regenerating: C.gold,
  ai_suggested_ignore: C.muted, story_mention: C.muted, human_managed: C.muted,
}
const STATE_LABEL: Record<CardState, string> = {
  needs_generation: 'Draft needed', needs_review: 'Needs review', send_failed_open: 'Send failed',
  status_unknown: 'Status unknown', sending: 'Sending', regenerating: 'Regenerating',
  ai_suggested_ignore: 'AI ignore', story_mention: 'Story mention', human_managed: 'Human managed',
}

function humanizeMessageText(text: string | null, messageType: string): string {
  if (!text) return ''
  if (text.startsWith('[Media DM:')) {
    if (text.includes('ig_reel'))   return 'Shared a reel'
    if (text.includes('ig_image'))  return 'Shared an image'
    if (text.includes('ig_video'))  return 'Shared a video'
    return 'Shared media'
  }
  return text
}

function ConvSenderRow({ group, selected, onClick }: {
  group: ConversationGroup; selected: boolean; onClick: () => void
}) {
  const displayName = group.username ? `@${group.username}` : group.displayName ?? 'Instagram User'
  const avatarLabel = group.displayName || group.username || 'I'
  const urgent = group.mostUrgentMs < 2 * 3_600_000
  const stateColor = STATE_COLOR[group.worstState]
  const preview = humanizeMessageText(group.latestItem.messageText, group.latestItem.messageType)

  return (
    <div onClick={onClick} style={{
      padding: '10px 12px', cursor: 'pointer', borderRadius: '6px',
      background: selected ? C.gold + '14' : 'transparent',
      borderLeft: `3px solid ${selected ? C.gold : 'transparent'}`,
      display: 'flex', gap: '10px', alignItems: 'center',
      transition: 'background 0.1s',
    }}>
      <SenderAvatar profilePictureUrl={group.profilePictureUrl} label={avatarLabel} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontWeight: 700, fontSize: '12px', color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '130px' }}>{displayName}</span>
          {group.pendingCount > 1 && (
            <span style={{ background: stateColor + '30', color: stateColor, fontSize: '9px', fontWeight: 700, borderRadius: '8px', padding: '1px 5px', flexShrink: 0 }}>{group.pendingCount}</span>
          )}
          {urgent && <span style={{ color: C.red, fontSize: '10px', flexShrink: 0 }}>⚠</span>}
        </div>
        <div style={{ fontSize: '10px', color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px' }}>
          {preview || <span style={{ color: C.border }}>No message text</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
          <span style={{ fontSize: '9px', color: stateColor, fontWeight: 600 }}>{STATE_LABEL[group.worstState]}</span>
          {group.mostUrgentMs < Infinity && (
            <span style={{ fontSize: '9px', color: urgent ? C.red : C.muted }}>
              {fmtWindowRemaining(group.mostUrgentMs)}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function DmInbox() {
  const [items,     setItems]     = useState<DmItem[] | null>(null)
  const [loading,   setLoading]   = useState(false)
  const [err,       setErr]       = useState<string | null>(null)
  const [selected,  setSelected]  = useState<string | null>(null)
  const [showList,  setShowList]  = useState(true) // mobile: false = detail view

  const load = useCallback(async () => {
    setLoading(true); setErr(null)
    try {
      const res  = await fetch('/api/admin/dm-inbox')
      const data = await res.json()
      if (!res.ok) { setErr(data.error || 'Failed to load'); return }
      const history: Record<string, ConvHistoryRow[]> = data.history ?? {}
      const mapped = (data.items as DmItem[]).map(item => ({
        ...item,
        history: history[item.senderId] ?? [],
      }))
      setItems(mapped)
      // Auto-select first group if none selected
      if (!selected && mapped.length > 0) {
        const groups = groupBySender(mapped)
        if (groups.length > 0) setSelected(groups[0].senderId)
      }
    } catch { setErr('Network error') }
    finally { setLoading(false) }
  }, [selected])

  useEffect(() => { void load() }, [load])

  const allItems = items ?? []
  const groups   = groupBySender(allItems)

  // Separate audit items (human_managed, story_mention) — show in a collapsed section
  const activeGroups = groups.filter(g => g.worstState !== 'human_managed' && g.worstState !== 'story_mention')
  const auditGroups  = groups.filter(g => g.worstState === 'human_managed' || g.worstState === 'story_mention')
  const [showAudit, setShowAudit] = useState(false)

  const urgentCount    = activeGroups.filter(g => g.mostUrgentMs < 2 * 3_600_000).length
  const needsDraftCount = activeGroups.filter(g => g.worstState === 'needs_generation').length
  const needsReviewCount = activeGroups.filter(g => g.worstState === 'needs_review').length

  const selectedGroup = groups.find(g => g.senderId === selected) ?? null

  function selectGroup(senderId: string) {
    setSelected(senderId)
    setShowList(false) // on mobile, switch to detail view
  }

  const isMobileNarrow = typeof window !== 'undefined' && window.innerWidth < 640

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginTop: '-8px' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 0 10px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', flex: 1 }}>
          {items !== null && (
            <>
              {urgentCount > 0 && (
                <span style={{ fontSize: '10px', color: C.red, fontWeight: 700, background: C.red + '18', border: `1px solid ${C.red}`, borderRadius: '10px', padding: '2px 8px' }}>
                  ⚠ {urgentCount} urgent
                </span>
              )}
              <span style={{ fontSize: '10px', color: C.muted }}>
                {activeGroups.length} senders
                {needsDraftCount > 0 && ` · ${needsDraftCount} need draft`}
                {needsReviewCount > 0 && ` · ${needsReviewCount} need review`}
              </span>
            </>
          )}
        </div>
        <button onClick={() => void load()} disabled={loading} style={{ ...btn('ghost'), fontSize: '10px', padding: '3px 10px' }}>
          {loading ? '…' : 'Refresh'}
        </button>
      </div>

      {err && <p style={{ color: C.red, fontSize: '12px' }}>{err}</p>}
      {loading && !items && <p style={{ color: C.muted, fontSize: '12px' }}>Loading…</p>}

      {items !== null && activeGroups.length === 0 && auditGroups.length === 0 && (
        <p style={{ color: C.muted, fontSize: '12px' }}>Inbox clear.</p>
      )}

      {/* Master-detail layout */}
      {items !== null && (activeGroups.length > 0 || auditGroups.length > 0) && (
        <div style={{ display: 'flex', gap: 0, minHeight: 'calc(100vh - 180px)', border: `1px solid ${C.border}`, borderRadius: '8px', overflow: 'hidden' }}>

          {/* Left pane — sender list */}
          {(showList || !isMobileNarrow) && (
            <div style={{
              width: '260px', minWidth: '260px', borderRight: `1px solid ${C.border}`,
              background: C.sidebar, overflowY: 'auto', flexShrink: 0,
              display: 'flex', flexDirection: 'column',
            }}>
              <div style={{ padding: '8px 6px', display: 'flex', flexDirection: 'column', gap: '1px', flex: 1 }}>
                {activeGroups.map(g => (
                  <ConvSenderRow key={g.senderId} group={g} selected={selected === g.senderId}
                    onClick={() => selectGroup(g.senderId)} />
                ))}

                {/* Audit section in left pane */}
                {auditGroups.length > 0 && (
                  <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: `1px solid ${C.border2}` }}>
                    <button onClick={() => setShowAudit(s => !s)}
                      style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', fontSize: '9px', color: C.muted, fontWeight: 700, letterSpacing: '0.08em', fontFamily: 'system-ui, sans-serif' }}>
                      AUDIT ({auditGroups.length}) {showAudit ? '▲' : '▼'}
                    </button>
                    {showAudit && auditGroups.map(g => (
                      <ConvSenderRow key={g.senderId} group={g} selected={selected === g.senderId}
                        onClick={() => selectGroup(g.senderId)} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Right pane — conversation detail */}
          {(!showList || !isMobileNarrow) && (
            <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', background: C.bg }}>
              {!selectedGroup ? (
                <div style={{ padding: '32px 24px', color: C.muted, fontSize: '12px' }}>Select a conversation</div>
              ) : (
                <div style={{ padding: '0' }}>
                  {/* Detail header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', borderBottom: `1px solid ${C.border}`, background: C.sidebar, position: 'sticky', top: 0, zIndex: 10 }}>
                    {isMobileNarrow && (
                      <button onClick={() => setShowList(true)} style={{ background: 'none', border: 'none', color: C.dim, cursor: 'pointer', fontSize: '16px', padding: '2px 6px 2px 0', fontFamily: 'system-ui, sans-serif' }}>‹</button>
                    )}
                    <SenderAvatar profilePictureUrl={selectedGroup.profilePictureUrl} label={selectedGroup.displayName || selectedGroup.username || 'I'} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '13px', color: C.text }}>
                        {selectedGroup.username ? `@${selectedGroup.username}` : selectedGroup.displayName ?? 'Instagram User'}
                      </div>
                      <div style={{ fontSize: '10px', color: C.muted }}>
                        {selectedGroup.pendingCount} pending · {selectedGroup.items.length} total messages
                      </div>
                    </div>
                    <div style={{ fontSize: '10px', color: STATE_COLOR[selectedGroup.worstState], fontWeight: 600 }}>
                      {STATE_LABEL[selectedGroup.worstState]}
                    </div>
                  </div>

                  {/* Items — each DmInboxItem handles its own state */}
                  <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {selectedGroup.items.map(item => (
                      <DmInboxItem key={item.id} item={item} onRefresh={() => void load()} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── DM Access Control ─────────────────────────────────────────
type AccessStatus = 'ai_allowed' | 'human_only' | 'blocked'
interface AccessRuleRow {
  handle: string | null; senderId: string | null; status: AccessStatus
  notes: string | null; createdAt: string | null; updatedAt: string | null; legacy: boolean
}
const STATUS_LABEL: Record<AccessStatus, string> = { ai_allowed: 'AI', human_only: 'Human', blocked: 'Ignore' }
const STATUS_ICON:  Record<AccessStatus, string> = { ai_allowed: '🤖', human_only: '👤', blocked: '🚫' }
const STATUS_HELP:  Record<AccessStatus, string> = {
  ai_allowed: 'The AI replies normally.',
  human_only: 'The AI never replies. I reply manually.',
  blocked:    'Neither the AI nor I will respond.',
}
const STATUS_COLOR: Record<AccessStatus, string> = { ai_allowed: C.green, human_only: C.gold, blocked: C.red }

function rowKey(row: AccessRuleRow): string { return row.handle ?? row.senderId ?? '' }
function fmtRuleDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

function DmAccessControl() {
  const [rows,      setRows]      = useState<AccessRuleRow[] | null>(null)
  const [search,    setSearch]    = useState('')
  const [newHandle, setNewHandle] = useState('')
  const [busyKey,   setBusyKey]   = useState<string | null>(null)
  const [err,       setErr]       = useState<string | null>(null)

  const load = useCallback(async () => {
    setErr(null)
    try {
      const res = await fetch('/api/admin/manual-dm-control')
      const data = await res.json()
      if (!res.ok) { setErr(data.error || 'Failed to load'); return }
      setRows(data.rules)
    } catch { setErr('Network error') }
  }, [])

  useEffect(() => { void load() }, [load])

  async function setStatus(rawHandle: string, status: AccessStatus) {
    const handle = rawHandle.trim().replace(/^@/, '').toLowerCase()
    setBusyKey(handle); setErr(null)
    try {
      const res = await fetch('/api/admin/manual-dm-control', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set-status', handle, status }),
      })
      const data = await res.json()
      if (!res.ok) { setErr(data.error || 'Failed to update'); return }
      await load(); setNewHandle('')
    } catch { setErr('Network error') }
    finally { setBusyKey(null) }
  }

  async function remove(row: AccessRuleRow) {
    const key = rowKey(row)
    setBusyKey(key); setErr(null)
    try {
      const res = await fetch('/api/admin/manual-dm-control', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(row.legacy ? { action: 'remove', senderId: row.senderId } : { action: 'remove', handle: row.handle }),
      })
      const data = await res.json()
      if (!res.ok) { setErr(data.error || 'Failed to remove'); return }
      setRows(prev => prev?.filter(r => rowKey(r) !== key) ?? prev)
    } catch { setErr('Network error') }
    finally { setBusyKey(null) }
  }

  const filtered = (rows ?? []).filter(r => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return (r.handle ?? '').toLowerCase().includes(q) || (r.senderId ?? '').toLowerCase().includes(q)
  })
  const addBusy = busyKey !== null && busyKey === newHandle.trim().replace(/^@/, '').toLowerCase()

  return (
    <div>
      {/* Create rule */}
      <div style={{ border: `1px solid ${C.border}`, borderRadius: '8px', padding: '16px', marginBottom: '16px', background: C.surface }}>
        <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', color: C.dim, marginBottom: '12px' }}>CREATE ACCESS RULE</div>
        <span style={S.label}>Instagram Username</span>
        <input type="text" placeholder="@instagram_handle" value={newHandle}
          onChange={e => { setNewHandle(e.target.value); setErr(null) }}
          style={{ ...S.input, maxWidth: '300px', marginTop: '4px' }} />
        <div style={{ marginTop: '14px' }}>
          <span style={S.label}>Access Mode</span>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
            {(['ai_allowed', 'human_only', 'blocked'] as const).map(s => (
              <button key={s} disabled={!!busyKey || !newHandle.trim()} onClick={() => setStatus(newHandle, s)}
                style={{ padding: '6px 14px', fontSize: '12px', fontWeight: 600, border: `1px solid ${STATUS_COLOR[s]}`, borderRadius: '6px', background: 'transparent', color: STATUS_COLOR[s], cursor: 'pointer', opacity: addBusy ? 0.5 : 1 }}>
                {addBusy ? '…' : `${STATUS_ICON[s]} ${STATUS_LABEL[s]}`}
              </button>
            ))}
          </div>
        </div>
        <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {(['ai_allowed', 'human_only', 'blocked'] as const).map(s => (
            <div key={s} style={{ fontSize: '11px', color: C.dim }}>
              <span style={{ color: C.text, fontWeight: 600 }}>{STATUS_ICON[s]} {STATUS_LABEL[s]}</span>{' — '}{STATUS_HELP[s]}
            </div>
          ))}
        </div>
      </div>

      <input type="text" placeholder="Search by handle or sender ID…" value={search}
        onChange={e => setSearch(e.target.value)} style={{ ...S.input, marginBottom: '10px' }} />

      {err   && <p style={{ color: C.red,  fontSize: '12px' }}>{err}</p>}
      {!rows && !err && <p style={{ color: C.muted, fontSize: '12px' }}>Loading…</p>}
      {rows  && filtered.length === 0 && (
        <p style={{ color: C.muted, fontSize: '12px' }}>{rows.length === 0 ? 'No rules yet — add a username above.' : 'No matches.'}</p>
      )}

      {filtered.length > 0 && (
        <div style={S.card}>
          {filtered.map((row, i) => {
            const key  = rowKey(row)
            const busy = busyKey === key
            return (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', flexWrap: 'wrap', borderTop: i === 0 ? 'none' : `1px solid ${C.border}` }}>
                <div style={{ flex: '1 1 140px', minWidth: 0 }}>
                  <span style={S.label}>Handle</span>
                  <div style={S.value}>{row.handle || '—'}</div>
                </div>
                <div style={{ flex: '1 1 140px', minWidth: 0 }}>
                  <span style={S.label}>Sender ID</span>
                  <div style={{ ...S.value, fontSize: '11px', color: C.dim, wordBreak: 'break-all' }}>{row.senderId || '—'}</div>
                </div>
                <div style={{ flex: '0 0 100px' }}>
                  <span style={S.label}>Status</span>
                  <div style={{ marginTop: '2px' }}>
                    <span style={{ display: 'inline-block', padding: '2px 8px', fontSize: '11px', fontWeight: 700, borderRadius: '10px', border: `1px solid ${STATUS_COLOR[row.status]}`, background: STATUS_COLOR[row.status] + '22', color: STATUS_COLOR[row.status], whiteSpace: 'nowrap' }}>
                      {STATUS_ICON[row.status]} {STATUS_LABEL[row.status]}
                    </span>
                  </div>
                </div>
                <div style={{ flex: '1 1 120px', minWidth: 0 }}>
                  <span style={S.label}>Notes</span>
                  <div style={{ ...S.value, fontSize: '11px', color: C.dim }}>{row.notes || '—'}</div>
                </div>
                <div style={{ flex: '0 0 90px' }}>
                  <span style={S.label}>Updated</span>
                  <div style={{ ...S.value, fontSize: '11px' }}>{fmtRuleDate(row.updatedAt ?? row.createdAt)}</div>
                </div>
                <div style={{ flex: '1 1 100%', display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                  {(['ai_allowed', 'human_only', 'blocked'] as const).map(s => {
                    const active = s === row.status
                    return (
                      <button key={s} disabled={row.legacy || busy} onClick={() => setStatus(row.handle!, s)}
                        style={{ padding: '3px 10px', fontSize: '11px', fontWeight: active ? 700 : 400, border: `1px solid ${active ? STATUS_COLOR[s] : C.border}`, borderRadius: '4px', background: active ? STATUS_COLOR[s] + '22' : 'transparent', color: active ? STATUS_COLOR[s] : C.dim, cursor: (row.legacy || busy) ? 'default' : 'pointer', opacity: row.legacy ? 0.4 : 1 }}>
                        {STATUS_ICON[s]} {STATUS_LABEL[s]}
                      </button>
                    )
                  })}
                  <button disabled={busy} onClick={() => remove(row)}
                    style={{ ...btn('ghost'), opacity: busy ? 0.5 : 1, marginLeft: 'auto' }}>
                    {busy ? '…' : 'Remove'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Feedback ──────────────────────────────────────────────────
function DmFeedback() {
  const [rows,    setRows]    = useState<FeedbackRow[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [err,     setErr]     = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setErr(null)
    try {
      const res  = await fetch('/api/admin/dm-feedback?limit=100')
      const data = await res.json()
      if (!res.ok) { setErr(data.error || 'Failed to load'); return }
      setRows(data.rows)
    } catch { setErr('Network error') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  if (loading && !rows) return <p style={{ color: C.muted, fontSize: '12px' }}>Loading…</p>
  if (err)              return <p style={{ color: C.red,  fontSize: '12px' }}>{err}</p>
  if (!rows || rows.length === 0) return <p style={{ color: C.muted, fontSize: '12px' }}>No sent-DM feedback records yet.</p>

  const rated    = rows.filter(r => r.feedback_rating)
  const edited   = rows.filter(r => r.was_edited)
  const goodRate = rated.length > 0 ? rated.filter(r => r.feedback_rating === 'good').length / rated.length : null

  return (
    <div>
      {/* Summary */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', padding: '12px 16px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: '8px', marginBottom: '16px', fontSize: '12px' }}>
        <span><span style={{ color: C.muted }}>Total sent: </span><span style={{ fontWeight: 600 }}>{rows.length}</span></span>
        <span><span style={{ color: C.muted }}>Rated: </span><span style={{ fontWeight: 600 }}>{rated.length}</span></span>
        <span><span style={{ color: C.muted }}>Edited before send: </span><span style={{ fontWeight: 600 }}>{edited.length} ({rows.length > 0 ? Math.round(edited.length / rows.length * 100) : 0}%)</span></span>
        {goodRate !== null && <span><span style={{ color: C.muted }}>Good rating: </span><span style={{ fontWeight: 600, color: C.green }}>{Math.round(goodRate * 100)}%</span></span>}
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              {['Date', 'Draft source', 'Edited', 'Rating', 'Category', 'Sent response'].map(h => (
                <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontSize: '10px', fontWeight: 700, color: C.muted, letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.id} style={{ borderBottom: `1px solid ${C.border2}` }}>
                <td style={{ padding: '8px 10px', color: C.muted, whiteSpace: 'nowrap', fontSize: '11px' }}>{fmtDate(row.created_at)}</td>
                <td style={{ padding: '8px 10px', color: C.dim,  fontSize: '11px', whiteSpace: 'nowrap' }}>{row.draft_source ?? '—'}</td>
                <td style={{ padding: '8px 10px', color: row.was_edited ? C.gold : C.muted }}>{row.was_edited ? 'Yes' : 'No'}</td>
                <td style={{ padding: '8px 10px', fontWeight: 600, color: row.feedback_rating === 'good' ? C.green : row.feedback_rating === 'bad' ? C.red : C.dim }}>
                  {row.feedback_rating ?? '—'}
                </td>
                <td style={{ padding: '8px 10px', color: C.dim, fontSize: '11px' }}>{row.feedback_category ?? '—'}</td>
                <td style={{ padding: '8px 10px', maxWidth: '320px' }}>
                  <p style={{ margin: 0, whiteSpace: 'pre-wrap', direction: 'rtl', textAlign: 'right', color: '#9ee0b0', fontSize: '12px', lineHeight: 1.5 }}>
                    {row.final_sent_response.slice(0, 120)}{row.final_sent_response.length > 120 ? '…' : ''}
                  </p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Consultation components ───────────────────────────────────
function DetailRows({ app }: { app: App }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
      {[
        ['Name', app.name], ['Email', app.email], ['Instagram', app.instagram || '—'],
        ['Phone', app.phone || '—'], ['Location', app.location || '—'], ['Submitted', fmtDate(app.submittedAt)],
        ['Status', app.status], ['Payment Status', app.paymentStatus || '—'],
      ].map(([l, v]) => (
        <div key={l}><span style={S.label}>{l}</span><span style={S.value}>{v}</span></div>
      ))}
      <div style={{ gridColumn: '1 / -1' }}>
        <span style={S.label}>Topic / Decision</span>
        <span style={S.value}>{app.subject || '—'}</span>
      </div>
      <div style={{ gridColumn: '1 / -1' }}>
        <span style={S.label}>Message</span>
        <p style={{ ...S.value, whiteSpace: 'pre-wrap', lineHeight: 1.6, marginTop: '2px', direction: 'rtl', textAlign: 'right' }}>{app.message || '—'}</p>
      </div>
    </div>
  )
}

interface ApproveResult { paymentLink: string; dmMessage: string }

function ApproveForm({ app, onDone }: { app: App; onDone: (result: ApproveResult) => void }) {
  const [price,  setPrice]  = useState('')
  const [cur,    setCur]    = useState('AUD')
  const [method, setMethod] = useState('paypal')
  const [expiry, setExpiry] = useState('7')
  const [busy,   setBusy]   = useState(false)
  const [err,    setErr]    = useState('')
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!price || isNaN(Number(price))) { setErr('Enter a valid price'); return }
    setBusy(true); setErr('')
    try {
      const res = await fetch('/api/admin/consultation/approve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pageId: app.pageId, name: app.name, price: Number(price), currency: method === 'manual_ir' ? 'IRR' : cur, method, expiryDays: Number(expiry) }) })
      const data = await res.json()
      if (!res.ok) { setErr(data.error ?? 'Failed'); return }
      onDone(data)
    } catch { setErr('Network error') }
    finally { setBusy(false) }
  }
  const isIR = method === 'manual_ir'
  return (
    <form onSubmit={submit} style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: isIR ? '1fr' : '1fr 1fr', gap: '8px' }}>
        <div>
          <span style={S.label}>{isIR ? 'Price (Toman)' : 'Price'}</span>
          <input type="number" step="1" min="1" value={price} required onChange={e => setPrice(e.target.value)} placeholder={isIR ? '17000000' : '250'} style={S.input} />
        </div>
        {!isIR && <div><span style={S.label}>Currency</span><select value={cur} onChange={e => setCur(e.target.value)} style={S.select}><option value="AUD">AUD</option><option value="USD">USD</option><option value="EUR">EUR</option></select></div>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <div><span style={S.label}>Payment Method</span><select value={method} onChange={e => setMethod(e.target.value)} style={S.select}><option value="paypal">PayPal (INT)</option><option value="manual_ir">Manual IR (Card)</option><option value="manual_au">Manual AU (Bank)</option></select></div>
        <div><span style={S.label}>Link Expiry</span><select value={expiry} onChange={e => setExpiry(e.target.value)} style={S.select}><option value="3">3 days</option><option value="7">7 days</option><option value="14">14 days</option></select></div>
      </div>
      {err && <p style={{ color: C.red, fontSize: '11px', margin: 0 }}>{err}</p>}
      <button type="submit" disabled={busy} style={btn('primary')}>{busy ? '…' : 'Generate Link'}</button>
    </form>
  )
}

function ConfirmPayment({ app, onDone }: { app: App; onDone: (consCode: string) => void }) {
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [consCode, setConsCode] = useState('')
  async function confirm() {
    setBusy(true); setErr('')
    try {
      const res = await fetch('/api/admin/consultation/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pageId: app.pageId, method: app.paymentMethod }) })
      const data = await res.json()
      if (!res.ok) { setErr(data.error ?? 'Failed'); return }
      setConsCode(data.consCode); onDone(data.consCode)
    } catch { setErr('Network error') }
    finally { setBusy(false) }
  }
  if (consCode) return <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}><span style={{ color: C.gold, fontWeight: 600, fontSize: '15px' }}>{consCode}</span><CopyBtn value={consCode} label="Copy CONS Code" /></div>
  return <div style={{ marginTop: '10px' }}>{err && <p style={{ color: C.red, fontSize: '11px', marginBottom: '6px' }}>{err}</p>}<button onClick={confirm} disabled={busy} style={btn('primary')}>{busy ? '…' : 'Confirm Payment & Generate CONS'}</button></div>
}

function PaymentSection({ app, section, approveResult, onApproveResult, consCode, onConsCode, d, onUpdatePaymentMessage }: {
  app: App; section: string; approveResult: ApproveResult | null; onApproveResult: (r: ApproveResult) => void
  consCode: string; onConsCode: (c: string) => void; d: AiData; onUpdatePaymentMessage: (msg: string) => void
}) {
  const [showApprove, setShowApprove] = useState(false)
  const [copiedPm,    setCopiedPm]    = useState<string | null>(null)
  const [pmErr,       setPmErr]       = useState<string | null>(null)
  const linkUrl    = approveResult?.paymentLink ?? (app.paymentToken ? paymentLink(app.paymentToken) : null)
  const expiryDate = app.tokenExpiry ?? null
  async function copyText(text: string, key: string) {
    setPmErr(null)
    try { await navigator.clipboard.writeText(text); setCopiedPm(key); setTimeout(() => setCopiedPm(c => c === key ? null : c), 2000) }
    catch { setPmErr('Clipboard failed') }
  }
  function handleCopyCombined() {
    setPmErr(null)
    if (!d.selectedFinalResponse.trim()) { setPmErr('Add a response first.'); return }
    if (!d.paymentMessage.trim()) { setPmErr('Generate the payment message first.'); return }
    void copyText(`${d.selectedFinalResponse}\n\n${d.paymentMessage}`, 'combined')
  }
  const hasPaymentSetup = !!(app.approvedPrice || approveResult)
  const isClaimed = section === 'claimed'; const isPaid = section === 'paid'
  if (!hasPaymentSetup && !isClaimed && !isPaid && section !== 'new' && section !== 'underReview') return null
  function PaymentStatusBtn({ label, status }: { label: string; status: string }) {
    const active = app.status === status
    return (
      <button onClick={async e => { e.stopPropagation(); await fetch('/api/admin/consultation/status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pageId: app.pageId, status }) }) }}
        style={{ ...btn(active ? 'warn' : 'ghost'), opacity: active ? 1 : 0.6 }}>{label}</button>
    )
  }
  return (
    <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: `1px solid ${C.border2}` }}>
      <span style={{ fontSize: '10px', fontWeight: 700, color: C.gold, letterSpacing: '0.1em', textTransform: 'uppercase' as const }}>Payment Setup</span>
      {(app.approvedPrice || approveResult) && (
        <div style={{ marginTop: '8px', fontSize: '12px', color: C.dim, lineHeight: 1.8, background: C.bg, padding: '8px 10px', borderRadius: '6px', border: `1px solid ${C.border}` }}>
          {app.approvedPrice && <><span style={{ color: C.muted }}>Price: </span><span>{fmtPrice(app.approvedPrice, app.approvedCurrency, app.paymentMethod)}</span><span style={{ color: C.muted, marginLeft: '12px' }}>Method: </span><span>{methodLabel(app.paymentMethod)}</span><br /></>}
          {linkUrl && <><span style={{ color: C.muted }}>Link: </span><span style={{ fontFamily: 'monospace', wordBreak: 'break-all', fontSize: '11px' }}>{linkUrl}</span><br /></>}
          {expiryDate && <><span style={{ color: C.muted }}>Expires: </span><span style={{ color: C.gold }}>{fmtDate(expiryDate)}</span></>}
        </div>
      )}
      {linkUrl && (
        <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <CopyBtn value={linkUrl} label="Copy Payment Link" />
            <button onClick={e => { e.stopPropagation(); onUpdatePaymentMessage(buildPaymentMessage(app, linkUrl, expiryDate)) }} style={btn('warn')}>Generate Payment Message</button>
          </div>
          {d.paymentMessage && (
            <>
              <textarea value={d.paymentMessage} onChange={e => onUpdatePaymentMessage(e.target.value)} rows={7} style={{ ...S.textarea, direction: 'rtl', lineHeight: 1.8, marginTop: '4px' }} />
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button onClick={e => { e.stopPropagation(); void copyText(d.paymentMessage, 'pm') }} style={btn('ghost')}>{copiedPm === 'pm' ? '✓ Copied' : 'Copy Payment Message'}</button>
                <button onClick={e => { e.stopPropagation(); handleCopyCombined() }} style={btn('primary')}>{copiedPm === 'combined' ? '✓ Copied' : 'Copy Combined Message'}</button>
              </div>
              {pmErr && <p style={{ color: C.red, fontSize: '11px', margin: 0 }}>{pmErr}</p>}
            </>
          )}
        </div>
      )}
      {!linkUrl && !showApprove && <div style={{ marginTop: '8px' }}><button style={btn('primary')} onClick={e => { e.stopPropagation(); setShowApprove(true) }}>Approve &amp; Generate Link</button></div>}
      {showApprove && !approveResult && <ApproveForm app={app} onDone={r => { onApproveResult(r); setShowApprove(false) }} />}
      {isClaimed && app.paymentClaim && (
        <div style={{ marginTop: '8px', padding: '8px', background: C.bg, borderRadius: '6px', border: `1px solid ${C.border}` }}>
          <span style={S.label}>Payment Claim</span><span style={{ ...S.value, display: 'block' }}>{app.paymentClaim}</span>
          <span style={{ color: C.muted, fontSize: '11px' }}>{methodLabel(app.paymentMethod)}</span>
          <ConfirmPayment app={app} onDone={onConsCode} />
        </div>
      )}
      {isPaid && (app.consCode || consCode) && (
        <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ color: C.gold, fontWeight: 600, fontSize: '15px' }}>{consCode || app.consCode}</span>
          <CopyBtn value={consCode || app.consCode} label="Copy CONS" />
        </div>
      )}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px' }}>
        <PaymentStatusBtn label="Awaiting Payment" status="Waiting for Payment" />
        <PaymentStatusBtn label="Paid" status="Paid" />
        <PaymentStatusBtn label="Booked" status="Booked" />
      </div>
    </div>
  )
}

function ResponseAndNotes({ d, onUpd, onSaveResponse, onSaveNote, onSaveReply, saving, saved, dLoading }: {
  d: AiData; onUpd: (key: keyof AiData, val: string) => void
  onSaveResponse: () => void; onSaveNote: () => void; onSaveReply: () => void
  saving: boolean; saved: string | null; dLoading: boolean
}) {
  const [copiedR, setCopiedR] = useState(false)
  return (
    <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: `1px solid ${C.border2}` }}>
      <span style={{ fontSize: '10px', fontWeight: 700, color: C.gold, letterSpacing: '0.1em', textTransform: 'uppercase' as const }}>Response &amp; Notes</span>
      {dLoading && <span style={{ color: C.muted, fontSize: '11px', marginLeft: '8px' }}>Loading…</span>}
      <span style={S.label}>Final Response Given</span>
      <textarea value={d.selectedFinalResponse} onChange={e => onUpd('selectedFinalResponse', e.target.value)} placeholder="Paste the response you sent…" rows={5} style={{ ...S.textarea, marginTop: '4px' }} />
      <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
        <button disabled={saving} onClick={e => { e.stopPropagation(); onSaveResponse() }} style={{ ...btn('ghost'), opacity: saving ? 0.6 : 1 }}>{saved === 'response' ? '✓ Saved' : saving ? '…' : 'Save Response'}</button>
        {d.selectedFinalResponse && <button onClick={async e => { e.stopPropagation(); await navigator.clipboard.writeText(d.selectedFinalResponse); setCopiedR(true); setTimeout(() => setCopiedR(false), 1800) }} style={btn('ghost')}>{copiedR ? '✓ Copied' : 'Copy Response'}</button>}
      </div>
      <span style={{ ...S.label, marginTop: '14px' }}>Internal Note</span>
      <textarea value={d.internalNotes} onChange={e => onUpd('internalNotes', e.target.value)} placeholder="Private notes…" rows={3} style={{ ...S.textarea, marginTop: '4px' }} />
      <div style={{ marginTop: '6px' }}><button disabled={saving} onClick={e => { e.stopPropagation(); onSaveNote() }} style={{ ...btn('ghost'), opacity: saving ? 0.6 : 1 }}>{saved === 'note' ? '✓ Saved' : saving ? '…' : 'Save Note'}</button></div>
      <span style={{ ...S.label, marginTop: '14px' }}>Latest Prospect Reply (optional)</span>
      <textarea value={d.replyInput} onChange={e => onUpd('replyInput', e.target.value)} placeholder="Paste their latest reply for a follow-up prompt…" rows={3} style={{ ...S.textarea, marginTop: '4px' }} />
      {d.replyInput && <div style={{ marginTop: '6px' }}><button disabled={saving} onClick={e => { e.stopPropagation(); onSaveReply() }} style={{ ...btn('ghost'), opacity: saving ? 0.6 : 1 }}>{saved === 'reply' ? '✓ Saved' : saving ? '…' : 'Save'}</button></div>}
    </div>
  )
}

function InstagramDmSafety({ app }: { app: App }) {
  const [dmMode,  setDmModeState] = useState<string | null>(app.dmMode)
  const [blocked, setBlocked]     = useState<boolean | null>(app.isBlocked)
  const [busy,    setBusy]        = useState<string | null>(null)
  const [err,     setErr]         = useState<string | null>(null)
  async function setMode(mode: 'AI' | 'Human') {
    setBusy('mode'); setErr(null)
    try {
      const res = await fetch('/api/admin/consultation/dm-mode', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ instagramHandle: app.instagram, dmMode: mode, pageId: app.pageId, name: app.name || undefined, email: app.email || undefined, phone: app.phone || undefined, location: app.location || undefined, status: app.status || undefined }) })
      const data = await res.json()
      if (!res.ok) { setErr(data.error || 'Failed'); return }
      setDmModeState(data.dmMode)
    } catch { setErr('Network error') }
    finally { setBusy(null) }
  }
  async function toggleBlock(action: 'block' | 'unblock') {
    setBusy('block'); setErr(null)
    try {
      const res = await fetch('/api/admin/consultation/blocklist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, instagramHandle: app.instagram, name: app.name }) })
      const data = await res.json()
      if (!res.ok) { setErr(data.error || 'Failed'); return }
      setBlocked(action === 'block')
    } catch { setErr('Network error') }
    finally { setBusy(null) }
  }
  return (
    <div style={{ marginTop: '14px', padding: '8px 10px', border: `1px solid ${C.border2}`, borderRadius: '6px', background: '#110e0c' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '10px', color: C.muted, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>IG DM</span>
        <span style={{ color: C.dim, fontSize: '11px' }}>@{app.instagram}</span>
        {(['AI', 'Human'] as const).map(mode => {
          const active = mode === dmMode; const color = mode === 'AI' ? '#4a8fc0' : C.green
          return (
            <button key={mode} disabled={!!busy} onClick={e => { e.stopPropagation(); void setMode(mode) }}
              style={{ padding: '2px 8px', fontSize: '10px', border: `1px solid ${active ? color : C.border}`, borderRadius: '3px', background: active ? color + '22' : 'transparent', color: active ? color : C.dim, cursor: 'pointer', fontWeight: active ? 700 : 400 }}>
              {busy === 'mode' ? '…' : mode}
            </button>
          )
        })}
        {app.senderId && (blocked ? (
          <button disabled={!!busy} onClick={e => { e.stopPropagation(); void toggleBlock('unblock') }} style={{ padding: '2px 8px', fontSize: '10px', border: `1px solid ${C.green}`, borderRadius: '3px', background: 'transparent', color: C.green, cursor: 'pointer' }}>{busy === 'block' ? '…' : 'Restore AI DM'}</button>
        ) : (
          <button disabled={!!busy} onClick={e => { e.stopPropagation(); void toggleBlock('block') }} style={{ padding: '2px 8px', fontSize: '10px', border: `1px solid ${C.red}`, borderRadius: '3px', background: 'transparent', color: C.red, cursor: 'pointer' }}>{busy === 'block' ? '…' : 'Block AI DM'}</button>
        ))}
        {!app.senderId && <span style={{ color: C.muted, fontSize: '10px' }}>no DM match yet</span>}
        {blocked === true && <span style={{ color: C.red, fontSize: '10px', fontWeight: 700 }}>BLOCKED</span>}
        {err && <span style={{ color: C.red, fontSize: '10px' }}>{err}</span>}
      </div>
    </div>
  )
}

function AppCard({ app, section, onRefresh }: { app: App; section: 'new' | 'underReview' | 'approved' | 'claimed' | 'paid'; onRefresh: () => void }) {
  const [isOpen,        setIsOpen]        = useState(false)
  const [approveResult, setApproveResult] = useState<ApproveResult | null>(null)
  const [consCode,      setConsCode]      = useState(app.consCode)
  const [busy,          setBusy]          = useState(false)
  const [d,             setD]             = useState<AiData>(DEFAULT_AI)
  const [dLoading,      setDLoading]      = useState(false)
  const [dSaving,       setDSaving]       = useState(false)
  const [dSaved,        setDSaved]        = useState<string | null>(null)
  const [copied,        setCopied]        = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setDLoading(true)
    fetch(`/api/admin/consultation/admin-data?pageId=${encodeURIComponent(app.pageId)}`)
      .then(r => r.json())
      .then(j => { if (j.data) setD(prev => ({ ...prev, ...Object.fromEntries(Object.entries(j.data as Record<string, string | null>).map(([k, v]) => [k, v ?? ''])) })) })
      .catch(() => {})
      .finally(() => setDLoading(false))
  }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  function upd(key: keyof AiData, val: string) { setD(prev => ({ ...prev, [key]: val })) }
  async function saveFields(fields: Partial<AiData>, label: string) {
    setDSaving(true); setDSaved(null)
    try {
      const res = await fetch('/api/admin/consultation/admin-data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pageId: app.pageId, ...fields }) })
      if (res.ok) { setDSaved(label); setTimeout(() => setDSaved(s => s === label ? null : s), 2000) }
    } catch {}
    finally { setDSaving(false) }
  }
  async function copyText(text: string, key: string) {
    try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(c => c === key ? null : c), 2000) } catch {}
  }
  async function setStatus(status: string) {
    const needsConfirm = new Set(['Declined', 'Not Suitable', 'Archived'])
    if (needsConfirm.has(status) && !window.confirm(`Mark as "${status}"?`)) return
    setBusy(true)
    try { await fetch('/api/admin/consultation/status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pageId: app.pageId, status }) }); onRefresh() }
    catch {} finally { setBusy(false) }
  }

  return (
    <div style={S.card}>
      <div style={S.cardHeader} onClick={() => setIsOpen(o => !o)}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontWeight: 600, fontSize: '13px' }}>{app.name}</span>
          <span style={{ color: C.muted, marginLeft: '10px' }}>{app.location}</span>
          <span style={{ color: C.muted, marginLeft: '10px', fontSize: '11px' }}>{new Date(app.submittedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}</span>
          {app.status && app.status !== 'New' && <span style={{ color: C.gold, marginLeft: '10px', fontSize: '11px' }}>{app.status}</span>}
        </div>
        <span style={{ color: C.muted, fontSize: '11px', flexShrink: 0 }}>{isOpen ? '▲' : '▼'}</span>
      </div>
      {!isOpen && app.subject && <div style={{ padding: '0 14px 10px', color: C.muted, fontSize: '12px' }}>{app.subject.slice(0, 120)}{app.subject.length > 120 ? '…' : ''}</div>}
      {isOpen && (
        <div style={S.cardBody}>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', paddingTop: '12px', paddingBottom: '12px', borderBottom: `1px solid ${C.border2}` }}>
            <button onClick={e => { e.stopPropagation(); void copyText(buildEnquiryBrief(app, d), 'brief') }} style={btn('ghost')}>{copied === 'brief' ? '✓ Copied' : 'Copy Enquiry'}</button>
            {d.replyInput.trim() && <button onClick={e => { e.stopPropagation(); void copyText(buildFollowUpPrompt(app, d), 'followup') }} style={btn('ghost')}>{copied === 'followup' ? '✓ Copied' : 'Copy Follow-up Prompt'}</button>}
            <span style={{ width: '1px', background: C.border, margin: '0 2px', alignSelf: 'stretch' }} />
            {section === 'new' && <button disabled={busy} style={btn('warn')} onClick={e => { e.stopPropagation(); void setStatus('Under Review') }}>Under Review</button>}
            <button disabled={busy} style={btn('ghost')} onClick={e => { e.stopPropagation(); void setStatus('Replied') }}>Response Given</button>
            <button disabled={busy} style={btn('danger')} onClick={e => { e.stopPropagation(); void setStatus('Not Suitable') }}>Not Suitable</button>
            <button disabled={busy} style={btn('danger')} onClick={e => { e.stopPropagation(); void setStatus('Declined') }}>Decline</button>
            <button disabled={busy} style={btn('ghost')} onClick={e => { e.stopPropagation(); void setStatus('Archived') }}>Archive</button>
          </div>
          <DetailRows app={app} />
          <PaymentSection app={app} section={section} approveResult={approveResult} onApproveResult={setApproveResult} consCode={consCode} onConsCode={setConsCode} d={d} onUpdatePaymentMessage={msg => { upd('paymentMessage', msg); void saveFields({ paymentMessage: msg }, 'pm') }} />
          <ResponseAndNotes d={d} onUpd={upd} onSaveResponse={() => saveFields({ selectedFinalResponse: d.selectedFinalResponse }, 'response')} onSaveNote={() => saveFields({ internalNotes: d.internalNotes }, 'note')} onSaveReply={() => saveFields({ replyInput: d.replyInput }, 'reply')} saving={dSaving} saved={dSaved} dLoading={dLoading} />
          {app.instagram && <InstagramDmSafety app={app} />}
        </div>
      )}
    </div>
  )
}

function ConsultationSection({ title, apps, section, onRefresh }: { title: string; apps: App[]; section: 'new' | 'underReview' | 'approved' | 'claimed' | 'paid'; onRefresh: () => void }) {
  return (
    <div>
      <h2 style={S.sectionHead}>{title} ({apps.length})</h2>
      {apps.length === 0 ? <p style={{ color: C.muted, fontSize: '12px' }}>None.</p> : apps.map(app => <AppCard key={app.pageId} app={app} section={section} onRefresh={onRefresh} />)}
    </div>
  )
}

function Consultations() {
  const [data,    setData]    = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(false)
  const [err,     setErr]     = useState('')

  const load = useCallback(async () => {
    setLoading(true); setErr('')
    try {
      const res = await fetch('/api/admin/consultation/list')
      if (!res.ok) { setErr('Failed to load'); return }
      setData(await res.json())
    } catch { setErr('Network error') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
        <button onClick={() => void load()} style={{ ...btn('ghost'), fontSize: '11px' }}>{loading ? '…' : 'Refresh'}</button>
      </div>
      {err     && <p style={{ color: C.red,  fontSize: '12px' }}>{err}</p>}
      {loading && !data && <p style={{ color: C.muted, fontSize: '12px' }}>Loading…</p>}
      {data && (
        <>
          <ConsultationSection title="New Applications"             apps={data.new}         section="new"         onRefresh={load} />
          <ConsultationSection title="Under Review"                 apps={data.underReview} section="underReview" onRefresh={load} />
          <ConsultationSection title="Approved / Payment Sent"      apps={data.approved}    section="approved"    onRefresh={load} />
          <ConsultationSection title="Awaiting Manual Confirmation" apps={data.claimed}     section="claimed"     onRefresh={load} />
          <ConsultationSection title="Paid / Completed"             apps={data.paid}        section="paid"        onRefresh={load} />
        </>
      )}
    </div>
  )
}

// ── Overview ──────────────────────────────────────────────────
function Overview() {
  const [dmData,   setDmData]   = useState<{ items: DmItem[]; history: Record<string, ConvHistoryRow[]> } | null>(null)
  const [consData, setConsData] = useState<DashboardData | null>(null)
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    void Promise.all([
      fetch('/api/admin/dm-inbox').then(r => r.json()),
      fetch('/api/admin/consultation/list').then(r => r.json()),
    ]).then(([dm, cons]) => {
      if (dm.items) setDmData(dm)
      if (cons.new) setConsData(cons)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) return <p style={{ color: C.muted, fontSize: '12px' }}>Loading…</p>

  const dmItems     = dmData?.items ?? []
  const needsReview = dmItems.filter(i => { const s = getCardState(i); return s === 'needs_review' || s === 'needs_generation' })
  const urgent      = needsReview.filter(i => windowMsRemaining(i.createdAt) < 2 * 3_600_000)
  const attention   = dmItems.filter(i => { const s = getCardState(i); return s === 'sending' || s === 'status_unknown' || s === 'send_failed_open' })
  const totalNew    = (consData?.new.length ?? 0) + (consData?.underReview.length ?? 0)

  const stat = (label: string, value: string | number, color?: string) => (
    <div style={{ padding: '16px 20px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: '8px' }}>
      <div style={{ fontSize: '24px', fontWeight: 700, color: color ?? C.text, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: '11px', color: C.muted, marginTop: '6px', letterSpacing: '0.04em' }}>{label}</div>
    </div>
  )

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px', marginBottom: '24px' }}>
        {stat('DMs needs review',   needsReview.length, needsReview.length > 0 ? C.blue   : C.muted)}
        {stat('Urgent (<2h)',        urgent.length,      urgent.length > 0      ? C.red    : C.muted)}
        {stat('DMs need attention',  attention.length,   attention.length > 0   ? C.gold   : C.muted)}
        {stat('Consultations open',  totalNew,           totalNew > 0           ? C.gold   : C.muted)}
        {stat('Paid / Completed',    consData?.paid.length ?? 0)}
      </div>
      {urgent.length > 0 && (
        <div style={{ padding: '12px 16px', background: C.red + '10', border: `1px solid ${C.red}`, borderRadius: '8px', fontSize: '12px', color: C.red }}>
          ⚠ {urgent.length} DM{urgent.length === 1 ? '' : 's'} expiring in less than 2 hours — go to DM Inbox to action.
        </div>
      )}
      {attention.length > 0 && (
        <div style={{ padding: '12px 16px', background: C.gold + '10', border: `1px solid ${C.gold}`, borderRadius: '8px', fontSize: '12px', color: C.gold, marginTop: '8px' }}>
          {attention.length} DM{attention.length === 1 ? '' : 's'} in a broken state (send failed / status unknown) — check DM Inbox.
        </div>
      )}
      {needsReview.length === 0 && urgent.length === 0 && attention.length === 0 && totalNew === 0 && (
        <p style={{ color: C.muted, fontSize: '13px', marginTop: '8px' }}>All clear.</p>
      )}
    </div>
  )
}

// ── Admin shell ───────────────────────────────────────────────
const NAV_ITEMS: { id: Section; label: string }[] = [
  { id: 'overview',      label: 'Overview' },
  { id: 'dm',            label: 'DM Inbox' },
  { id: 'consultations', label: 'Consultations' },
  { id: 'access',        label: 'Access Control' },
  { id: 'feedback',      label: 'Feedback' },
]

function AdminShell({ onLogout }: { onLogout: () => void }) {
  const [active,      setActive]      = useState<Section>('overview')
  const [drawerOpen,  setDrawerOpen]  = useState(false)
  const [isMobile,    setIsMobile]    = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    setIsMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  function navigate(id: Section) { setActive(id); setDrawerOpen(false) }

  const sidebarContent = (
    <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      {NAV_ITEMS.map(item => (
        <button key={item.id} onClick={() => navigate(item.id)}
          style={{
            textAlign: 'left', padding: '9px 14px', fontSize: '12px', fontWeight: active === item.id ? 700 : 400,
            background: active === item.id ? C.gold + '18' : 'transparent',
            color: active === item.id ? C.gold : C.dim,
            border: 'none', borderRadius: '6px', cursor: 'pointer',
            borderLeft: `3px solid ${active === item.id ? C.gold : 'transparent'}`,
            fontFamily: 'system-ui, sans-serif',
          }}>
          {item.label}
        </button>
      ))}
    </nav>
  )

  const sectionTitle = NAV_ITEMS.find(n => n.id === active)?.label ?? ''

  return (
    <div style={{ ...S.page, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Top bar */}
      <div style={{ height: '44px', background: C.sidebar, borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', padding: '0 16px', gap: '12px', flexShrink: 0, position: 'sticky', top: 0, zIndex: 100 }}>
        {isMobile && (
          <button onClick={() => setDrawerOpen(o => !o)}
            style={{ background: 'none', border: 'none', color: C.dim, cursor: 'pointer', fontSize: '18px', lineHeight: 1, padding: '4px' }}>
            ☰
          </button>
        )}
        <span style={{ fontSize: '11px', color: C.gold, fontWeight: 700, letterSpacing: '0.1em' }}>ASHKAN FARAA</span>
        <span style={{ fontSize: '11px', color: C.muted }}>/ {sectionTitle}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
          <button onClick={onLogout} style={{ ...btn('ghost'), fontSize: '11px' }}>Sign Out</button>
        </div>
      </div>

      {/* Body */}
      <div style={{ display: 'flex', flex: 1 }}>

        {/* Sidebar (desktop) */}
        {!isMobile && (
          <aside style={{ width: '200px', minWidth: '200px', background: C.sidebar, borderRight: `1px solid ${C.border}`, padding: '16px 10px', position: 'sticky', top: '44px', height: 'calc(100vh - 44px)', overflowY: 'auto', flexShrink: 0 }}>
            {sidebarContent}
          </aside>
        )}

        {/* Mobile drawer overlay */}
        {isMobile && drawerOpen && (
          <>
            <div onClick={() => setDrawerOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 199 }} />
            <aside style={{ position: 'fixed', top: 0, left: 0, width: '220px', height: '100vh', background: C.sidebar, borderRight: `1px solid ${C.border}`, padding: '48px 10px 16px', zIndex: 200, overflowY: 'auto' }}>
              {sidebarContent}
            </aside>
          </>
        )}

        {/* Main content */}
        <main style={{ flex: 1, minWidth: 0, padding: isMobile ? '16px 12px' : '24px 28px', overflowY: 'auto' }}>
          {active === 'overview'      && <><h1 style={{ ...S.sectionHead, marginTop: 0 }}>Overview</h1><Overview /></>}
          {active === 'dm'            && <><h1 style={{ ...S.sectionHead, marginTop: 0 }}>DM Inbox</h1><DmInbox /></>}
          {active === 'consultations' && <><h1 style={{ ...S.sectionHead, marginTop: 0 }}>Consultations</h1><Consultations /></>}
          {active === 'access'        && <><h1 style={{ ...S.sectionHead, marginTop: 0 }}>Access Control ({' '})</h1><DmAccessControl /></>}
          {active === 'feedback'      && <><h1 style={{ ...S.sectionHead, marginTop: 0 }}>DM Feedback</h1><DmFeedback /></>}
        </main>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────
export default function AdminPage() {
  const [loggedIn,  setLoggedIn]  = useState<boolean | null>(null)
  const [inputPw,   setInputPw]   = useState('')
  const [pwErr,     setPwErr]     = useState('')
  const [loginBusy, setLoginBusy] = useState(false)

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/admin/consultation/list')
        if (res.status === 401) { setLoggedIn(false); return }
        if (res.ok) setLoggedIn(true)
        else setLoggedIn(false)
      } catch { setLoggedIn(false) }
    })()
  }, [])

  async function handleLogin(e: FormEvent) {
    e.preventDefault()
    setLoginBusy(true); setPwErr('')
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: inputPw }),
      })
      if (res.status === 401) { setPwErr('Incorrect password'); return }
      if (!res.ok) { setPwErr('Login failed — try again'); return }
      setInputPw(''); setLoggedIn(true)
    } catch { setPwErr('Network error') }
    finally { setLoginBusy(false) }
  }

  async function handleLogout() {
    await fetch('/api/admin/logout', { method: 'POST' })
    setLoggedIn(false)
  }

  if (loggedIn === null) {
    return (
      <main style={{ ...S.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: C.muted, fontSize: '12px' }}>…</p>
      </main>
    )
  }

  if (!loggedIn) {
    return (
      <main style={{ ...S.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <form onSubmit={handleLogin} style={{ width: '280px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <p style={{ color: C.muted, fontSize: '11px', letterSpacing: '0.1em', margin: 0 }}>ASHKAN FARAA — ADMIN</p>
          <input type="password" value={inputPw} autoFocus required
            onChange={e => setInputPw(e.target.value)} placeholder="Password" style={S.input} />
          {pwErr && <p style={{ color: C.red, fontSize: '11px', margin: 0 }}>{pwErr}</p>}
          <button type="submit" disabled={loginBusy} style={btn('primary')}>
            {loginBusy ? '…' : 'Enter'}
          </button>
        </form>
      </main>
    )
  }

  return <AdminShell onLogout={handleLogout} />
}
