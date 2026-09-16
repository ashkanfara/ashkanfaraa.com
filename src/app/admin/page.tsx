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
  responseText: string | null; failedReason: string | null; generationId: string | null
  username: string | null; displayName: string | null; profilePictureUrl: string | null
  messageCount: number | null; notes: string | null
  conversationOwner: string | null; humanTakeoverReason: string | null
  storyContext: DmStoryContext | null; history: ConvHistoryRow[]
  canSend: boolean; windowExpiresAt: string | null
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
  | 'sending' | 'status_unknown' | 'needs_review' | 'needs_generation' | 'draft_failed'
  | 'draft_generating' | 'send_failed_open' | 'ai_suggested_ignore' | 'human_managed'
  | 'story_mention' | 'regenerating'
type Section = 'overview' | 'dm' | 'consultations' | 'access' | 'feedback' | 'bos'

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
  if (item.failedReason === 'DRAFT_FAILED')        return 'draft_failed'
  if (item.failedReason === 'DRAFT_GENERATING')    return 'draft_generating'
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

// ── GenerationFailedCard — shown only when n8n draft generation failed ──
// Normal flow: n8n generates draft automatically → PENDING_REVIEW. This card
// is only shown when that generation genuinely failed (failedReason=null, processed=false).
// Provides: Retry Draft (one AI call, no send) + Write Reply (human, no AI).
function GenerationFailedCard({ item, onRefresh }: { item: DmItem; onRefresh: () => void }) {
  const [writeMode, setWriteMode] = useState<'write' | null>(null)
  const [draftText, setDraftText] = useState('')
  const [busy,      setBusy]      = useState<string | null>(null)
  const [err,       setErr]       = useState<string | null>(null)

  const msLeft       = windowMsRemaining(item.createdAt)
  const primaryLabel = item.username ? `@${item.username}` : item.displayName ?? 'Instagram User'
  const avatarLabel  = item.displayName || item.username || 'I'
  const windowColor  = msLeft < 2 * 3_600_000 ? C.red : msLeft < 6 * 3_600_000 ? C.gold : C.green
  const isBusy       = busy !== null

  async function retryDraft() {
    setBusy('retry'); setErr(null)
    try {
      const res  = await fetch('/api/admin/dm-inbox/retry-draft', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id }),
      })
      const data = await res.json() as { ok: boolean; error?: string }
      if (data.ok) { setTimeout(onRefresh, 600) }
      else          { setErr(data.error ?? 'Failed to queue draft generation') }
    } catch { setErr('Network error') }
    finally { setBusy(null) }
  }

  async function saveHumanDraft() {
    const text = draftText.trim()
    if (!text) { setErr('Reply cannot be empty'); return }
    setBusy('save'); setErr(null)
    try {
      const res  = await fetch('/api/admin/dm-inbox/save-draft', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, text, draftSource: 'HUMAN' }),
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

  return (
    <div style={{ ...S.card, borderLeft: `3px solid ${C.red}` }}>
      <div style={{ ...S.cardHeader, alignItems: 'center', cursor: 'default' }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <SenderAvatar profilePictureUrl={item.profilePictureUrl} label={avatarLabel} />
          <div style={{ minWidth: 0 }}>
            <span style={{ fontWeight: 700, fontSize: '13px', color: C.text }}>{primaryLabel}</span>
            <span style={{ marginLeft: '8px', fontSize: '10px', color: C.red, border: `1px solid ${C.red}`, borderRadius: '4px', padding: '1px 5px', fontWeight: 700 }}>
              Draft failed
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <span style={{ fontSize: '11px', color: windowColor, fontWeight: msLeft < 2 * 3_600_000 ? 700 : 400 }}>⏱ {fmtWindowRemaining(msLeft)}</span>
          <span style={{ fontSize: '11px', color: C.muted }}>{new Date(item.createdAt).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>
      <div style={{ padding: '0 14px 14px' }}>
        {item.messageText && (
          <div style={{ background: '#141210', border: `1px solid ${C.border}`, borderRadius: '3px 14px 14px 14px', padding: '9px 13px', marginBottom: '12px', display: 'inline-block', maxWidth: '80%' }}>
            <p style={{ margin: 0, fontSize: '13px', color: '#f0dfa8', whiteSpace: 'pre-wrap', direction: 'rtl', textAlign: 'right', lineHeight: 1.6 }}>{item.messageText}</p>
          </div>
        )}
        {writeMode === null ? (
          <>
            <p style={{ margin: '0 0 10px', color: C.red, fontSize: '11px' }}>
              Automatic draft generation failed. Retry or write a reply manually.
            </p>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <button disabled={isBusy} onClick={() => void retryDraft()} style={{ ...btn('warn'), fontSize: '12px' }}>
                {busy === 'retry' ? '…' : 'Retry Draft'}
              </button>
              <button disabled={isBusy} onClick={() => { setWriteMode('write'); setDraftText(''); setErr(null) }} style={{ ...btn('ghost'), fontSize: '12px' }}>
                Write Reply
              </button>
              <button disabled={isBusy} onClick={() => void doIgnore()} style={{ ...btn('ghost'), fontSize: '12px' }}>
                {busy === 'ignore' ? '…' : 'Ignore'}
              </button>
            </div>
          </>
        ) : (
          <div>
            <p style={{ fontSize: '10px', color: C.muted, margin: '0 0 4px', fontWeight: 700, letterSpacing: '0.06em' }}>WRITE YOUR REPLY</p>
            <textarea value={draftText} onChange={e => setDraftText(e.target.value)} rows={4}
              placeholder="Type your reply…" style={{ ...S.textarea, direction: 'rtl', lineHeight: 1.7 }} autoFocus />
            {draftText.trim() && (
              <div style={{ marginTop: '6px', padding: '8px 10px', background: '#071a0d', border: '1px solid #1e4228', borderRadius: '6px' }}>
                <span style={{ fontSize: '10px', color: C.green, fontWeight: 700, letterSpacing: '0.06em', display: 'block', marginBottom: '4px' }}>WILL SAVE AS DRAFT:</span>
                <p style={{ margin: 0, fontSize: '12px', color: '#9ee0b0', whiteSpace: 'pre-wrap', direction: 'rtl', textAlign: 'right' }}>{draftText.trim()}</p>
              </div>
            )}
            {err && <p style={{ color: C.red, fontSize: '11px', margin: '6px 0 0' }}>{err}</p>}
            <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
              <button disabled={isBusy || !draftText.trim()} onClick={() => void saveHumanDraft()}
                style={{ ...btn('primary'), fontSize: '12px', opacity: !draftText.trim() ? 0.5 : 1 }}>
                {busy === 'save' ? '…' : 'Save Draft'}
              </button>
              <button disabled={isBusy} onClick={() => { setWriteMode(null); setDraftText(''); setErr(null) }} style={{ ...btn('ghost'), fontSize: '12px' }}>Cancel</button>
            </div>
          </div>
        )}
        {writeMode === null && err && <p style={{ color: C.red, fontSize: '11px', margin: '6px 0 0' }}>{err}</p>}
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

  // GenerationFailedCard handles draft_failed (canonical) and needs_generation (legacy)
  if (cardState === 'draft_failed' || cardState === 'needs_generation') {
    return <GenerationFailedCard item={item} onRefresh={onRefresh} />
  }

  async function call(path: string, body: Record<string, string | null | boolean>): Promise<{ ok: boolean; error?: string; alreadySent?: boolean }> {
    const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    return res.json()
  }

  async function send() {
    if (!editText.trim()) return
    setBusy('send'); setErr(null); setSuccess(null)
    try {
      const data = await call('/api/admin/dm-inbox/send', { id: item.id, finalText: editText, feedbackCategory: fbCategory, feedbackNote: fbNote.trim() || null })
      if (data.ok && data.alreadySent) { setErr('Already handled — refresh to see current state'); setTimeout(onRefresh, 1200) }
      else if (data.ok) { setSuccess('✓ Sent'); setTimeout(onRefresh, 1200) }
      else               { setErr(data.error ?? 'Send failed') }
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

  // Draft generating via Claude Routine (async — callback arrives later)
  if (cardState === 'draft_generating') {
    const elapsedMs  = Date.now() - new Date(item.processingStartedAt ?? item.createdAt).getTime()
    const timedOut   = elapsedMs > 5 * 60 * 1000
    const elapsedMin = Math.floor(elapsedMs / 60000)
    return (
      <div style={{ ...S.card, borderLeft: `3px solid ${timedOut ? C.red : C.gold}` }}>
        <div style={{ ...S.cardHeader, alignItems: 'center', cursor: 'default' }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <SenderAvatar profilePictureUrl={item.profilePictureUrl} label={avatarLabel} />
            <div>
              <span style={{ fontWeight: 700, fontSize: '13px', color: C.text }}>{primaryLabel}</span>
              <span style={{ marginLeft: '8px', fontSize: '10px', color: timedOut ? C.red : C.gold, border: `1px solid ${timedOut ? C.red : C.gold}`, borderRadius: '4px', padding: '1px 5px', fontWeight: 700 }}>
                {timedOut ? `Generating (${elapsedMin}m — delayed)` : 'Generating draft…'}
              </span>
            </div>
          </div>
        </div>
        <div style={{ padding: '0 14px 12px', fontSize: '12px' }}>
          {item.messageText && <p style={{ ...S.value, whiteSpace: 'pre-wrap', fontSize: '12px', color: C.dim, margin: '0 0 8px' }}>{item.messageText}</p>}
          <p style={{ margin: '0 0 10px', color: timedOut ? C.red : C.gold, fontSize: '11px' }}>
            {timedOut ? 'Claude Routine has not responded. Write a reply manually or retry.' : 'Claude Routine is generating a draft — refreshing automatically.'}
          </p>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button onClick={onRefresh} style={{ ...btn('ghost'), fontSize: '11px' }}>Refresh</button>
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
                  style={{ ...S.textarea, direction: 'rtl', lineHeight: 1.7, marginTop: '6px' }} placeholder="AI suggested reply…" />
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

// ── Phase B2: one-conversation surface ────────────────────────

function selectActionTarget(items: DmItem[]): DmItem | null {
  if (!items.length) return null
  return [...items].sort((a, b) => {
    const aPri = STATE_PRIORITY[getCardState(a)]
    const bPri = STATE_PRIORITY[getCardState(b)]
    if (aPri !== bPri) return aPri - bPri
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })[0]
}

interface DetailTurn {
  key: string; rowId: string
  type: 'inbound' | 'outbound' | 'event'
  text: string; time: string
  isStoryReply?: boolean; label?: string
  isPending: boolean; isTarget: boolean
}

function buildDetailTurns(
  rows: ConvHistoryRow[],
  targetId: string,
  pendingIds: Set<string>
): DetailTurn[] {
  const turns: DetailTurn[] = []
  let lastOutboundText: string | null = null
  const seenIds = new Set<string>()

  for (const row of rows) {
    const isPending = pendingIds.has(row.id) && !row.responseSent
    const isTarget  = row.id === targetId

    const inboundLabel =
      row.failedReason === 'AI_RECOMMENDED_IGNORE'      ? 'AI RECOMMENDED IGNORE'
      : row.failedReason === 'HUMAN_TEMP_SKIP'          ? 'HUMAN-MANAGED'
      : row.failedReason === 'STORY_MENTION_HUMAN_HOLD' ? 'STORY MENTION'
      : undefined

    const displayText = row.messageText
      ? humanizeMessageText(row.messageText, row.messageType)
      : null

    if (displayText) {
      turns.push({ key: `in-${row.id}`, rowId: row.id, type: 'inbound', text: displayText, time: row.createdAt, isStoryReply: row.isStoryReply, label: inboundLabel, isPending, isTarget })
    } else if (row.isStoryReply) {
      turns.push({ key: `ev-${row.id}`, rowId: row.id, type: 'event', text: 'Story reaction', time: row.createdAt, isPending, isTarget })
    }

    if (row.responseSent && row.sentText) {
      if (row.id && seenIds.has(row.id)) continue
      if (row.sentText === lastOutboundText) continue
      turns.push({ key: `out-${row.id}`, rowId: row.id, type: 'outbound', text: row.sentText, time: row.responseSentAt ?? row.createdAt, isPending: false, isTarget: false })
      lastOutboundText = row.sentText
      if (row.id) seenIds.add(row.id)
    }
  }
  return turns
}

function ConvDetailTimeline({ history, targetId, pendingIds }: {
  history: ConvHistoryRow[]
  targetId: string
  pendingIds: Set<string>
}) {
  const [expanded, setExpanded] = useState(false)
  const turns   = buildDetailTurns(history, targetId, pendingIds)
  const visible  = expanded ? turns : turns.slice(-14)
  const hidden   = turns.length - visible.length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '16px 16px 4px' }}>
      {hidden > 0 && !expanded && (
        <button onClick={() => setExpanded(true)} style={{ alignSelf: 'center', ...btn('ghost'), fontSize: '10px', padding: '2px 10px' }}>
          Show {hidden} earlier messages
        </button>
      )}
      {visible.map(turn => {
        if (turn.type === 'outbound') {
          return (
            <div key={turn.key} style={{ alignSelf: 'flex-end', maxWidth: '76%', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' }}>
              <div style={{ background: '#071a0d', border: '1px solid #1e4228', borderRadius: '14px 14px 3px 14px', padding: '8px 12px' }}>
                <p style={{ margin: 0, fontSize: '13px', color: '#8ec8a0', whiteSpace: 'pre-wrap', direction: 'rtl', textAlign: 'right', lineHeight: 1.55 }}>{turn.text}</p>
              </div>
              <span style={{ fontSize: '9px', color: C.muted }}>SENT · {fmtTime(turn.time)}</span>
            </div>
          )
        }
        if (turn.type === 'event') {
          return (
            <div key={turn.key} style={{ alignSelf: 'center', fontSize: '10px', color: C.muted, background: C.bg, border: `1px solid ${C.border2}`, borderRadius: '20px', padding: '3px 10px' }}>
              {turn.text}{turn.isPending ? ' · NEW' : ''} · {fmtTime(turn.time)}
            </div>
          )
        }
        // Inbound
        const isCurrent = turn.isTarget
        const isNew = turn.isPending && !isCurrent
        const borderColor = isCurrent ? C.gold : isNew ? C.goldDim : C.border2
        const bgColor     = isCurrent ? '#1a160a' : isNew ? '#161208' : '#141210'
        return (
          <div key={turn.key} style={{ alignSelf: 'flex-start', maxWidth: '80%', display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {isCurrent && <span style={{ fontSize: '9px', color: C.gold, fontWeight: 700, letterSpacing: '0.08em' }}>CURRENT MESSAGE</span>}
            {isNew     && <span style={{ fontSize: '9px', color: C.goldDim, fontWeight: 700, letterSpacing: '0.08em' }}>NEW MESSAGE</span>}
            {turn.label && !isCurrent && !isNew && <span style={{ fontSize: '9px', color: C.muted, fontWeight: 700, letterSpacing: '0.08em' }}>{turn.label}</span>}
            <div style={{ background: bgColor, border: `2px solid ${borderColor}`, borderRadius: '3px 14px 14px 14px', padding: '9px 13px' }}>
              <p style={{ margin: 0, fontSize: '13px', color: '#f0dfa8', whiteSpace: 'pre-wrap', direction: 'rtl', textAlign: 'right', lineHeight: 1.6 }}>{turn.text}</p>
            </div>
            <span style={{ fontSize: '9px', color: C.muted }}>
              {turn.isStoryReply && '↩ Story · '}{fmtTime(turn.time)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ConvWorkspace — ONE response workspace per conversation.
// key={targetItem.id} on usage site ensures React remounts it when target changes,
// resetting all local state cleanly.
function ConvWorkspace({ targetItem, pendingCount, onRefresh, effectiveCreatedAt }: {
  targetItem: DmItem
  pendingCount: number
  onRefresh: () => void
  effectiveCreatedAt?: string
}) {
  const [pasteText,     setPasteText]     = useState('')
  const [writeMode,     setWriteMode]     = useState<'write' | null>(null)
  const [editText,      setEditText]      = useState(targetItem.responseText ?? '')
  const [showComposer,  setShowComposer]  = useState(false)
  const [showDebug,     setShowDebug]     = useState(false)
  const [busy,          setBusy]          = useState<string | null>(null)
  const [err,           setErr]           = useState<string | null>(null)
  const [success,       setSuccess]       = useState<string | null>(null)
  const [fbCategory,    setFbCategory]    = useState<string | null>(null)
  const [fbNote,        setFbNote]        = useState('')

  const cardState   = getCardState(targetItem)
  const msLeft      = windowMsRemaining(effectiveCreatedAt ?? targetItem.createdAt)
  const urgent      = msLeft < 2 * 3_600_000
  const windowColor = urgent ? C.red : msLeft < 6 * 3_600_000 ? C.gold : C.green
  const displayName = targetItem.username ? `@${targetItem.username}` : targetItem.displayName ?? 'Instagram User'
  const isBusy      = busy !== null

  async function callApi(path: string, body: Record<string, string | null | boolean>): Promise<{ ok: boolean; error?: string; promptPackage?: string; alreadySent?: boolean }> {
    const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    return res.json()
  }

  async function saveDraft(draftSource: 'HUMAN') {
    const text = pasteText.trim()
    if (!text) { setErr('Draft cannot be empty'); return }
    setBusy('save'); setErr(null)
    try {
      const data = await callApi('/api/admin/dm-inbox/save-draft', { id: targetItem.id, text, draftSource })
      if (data.ok) { setTimeout(onRefresh, 400) }
      else          { setErr(data.error ?? 'Save failed') }
    } catch { setErr('Network error') }
    finally { setBusy(null) }
  }

  async function send() {
    if (!editText.trim()) return
    setBusy('send'); setErr(null); setSuccess(null)
    try {
      const data = await callApi('/api/admin/dm-inbox/send', { id: targetItem.id, finalText: editText, feedbackCategory: fbCategory, feedbackNote: fbNote.trim() || null })
      if (data.ok && data.alreadySent) { setErr('Already handled — refresh to see current state'); setTimeout(onRefresh, 1200) }
      else if (data.ok) { setSuccess('✓ Sent'); setTimeout(onRefresh, 1200) }
      else if (data.error === 'bundle_stale') { setErr('New message arrived since draft was generated — refresh to include it in the reply'); setTimeout(onRefresh, 1500) }
      else               { setErr(data.error ?? 'Send failed') }
    } catch { setErr('Network error') }
    finally { setBusy(null) }
  }

  async function mutate(action: string, extra: Record<string, string> = {}) {
    setBusy(action); setErr(null); setSuccess(null)
    try {
      // 'ignore' in the UI always ignores at the conversation level (all actionable items for this sender).
      const apiAction = action === 'ignore' ? 'ignore_conversation' : action
      const data = await callApi('/api/admin/dm-inbox', { action: apiAction, id: targetItem.id, senderId: targetItem.senderId, ...extra })
      if (data.ok) {
        const msgs: Record<string, string> = {
          ignore: 'Ignored', requeue: 'Regeneration requested', retry_send_failed: 'Reset — re-approve to send',
          takeover: 'Taken over — AI paused', release: 'Released to AI', block: 'Blocked',
        }
        setSuccess(msgs[action] ?? 'Done')
        setTimeout(onRefresh, 1000)
      } else { setErr(data.error ?? 'Action failed') }
    } catch { setErr('Network error') }
    finally { setBusy(null) }
  }

  const multiPendingNote = pendingCount > 1
    ? <span style={{ fontSize: '10px', color: C.muted }}>· {pendingCount} pending messages in this conversation</span>
    : null

  const windowBar = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
      <span style={{ fontSize: '11px', color: windowColor, fontWeight: urgent ? 700 : 400 }}>⏱ {fmtWindowRemaining(msLeft)} window</span>
      {multiPendingNote}
    </div>
  )

  const takeOverOrRelease = targetItem.conversationOwner !== 'human_temp'
    ? <button disabled={isBusy} onClick={() => void mutate('takeover')} style={{ ...btn('ghost'), fontSize: '11px', color: C.muted }}>{busy === 'takeover' ? '…' : 'Take Over Conversation'}</button>
    : <button disabled={isBusy} onClick={() => void mutate('release')} style={{ ...btn('ghost'), fontSize: '11px', color: C.green, borderColor: C.green }}>{busy === 'release' ? '…' : 'Release to AI'}</button>

  const blockBtn = (
    <button disabled={isBusy}
      onClick={() => { if (!window.confirm(`Block ${displayName}? AI will never reply to them again.`)) return; void mutate('block', { displayName: targetItem.displayName || targetItem.senderId }) }}
      style={{ ...btn('danger'), fontSize: '11px' }}>
      {busy === 'block' ? '…' : 'Block Sender'}
    </button>
  )

  const debugPanel = showDebug && (
    <div style={{ marginTop: '10px', padding: '8px 10px', background: '#0a0806', border: `1px solid ${C.border2}`, borderRadius: '4px', fontSize: '10px', color: C.muted, fontFamily: 'monospace' }}>
      <div>target id: {targetItem.id}</div>
      <div>sender_id: {targetItem.senderId}</div>
      <div>state: {cardState}</div>
      <div>pending rows: {pendingCount}</div>
    </div>
  )

  const wrapStyle: React.CSSProperties = { padding: '14px 16px', borderTop: `1px solid ${C.border2}` }

  // ── draft_generating (Claude Routine in flight) ──────────────
  if (cardState === 'draft_generating') {
    const elapsedMs  = Date.now() - new Date(targetItem.processingStartedAt ?? targetItem.createdAt).getTime()
    const timedOut   = elapsedMs > 5 * 60 * 1000
    const elapsedMin = Math.floor(elapsedMs / 60000)

    return (
      <div style={wrapStyle}>
        {windowBar}
        <div style={{ padding: '10px 12px', background: '#1a1508', border: `1px solid ${timedOut ? C.red : C.gold}`, borderRadius: '6px', marginBottom: '10px', fontSize: '12px', color: timedOut ? C.red : C.gold, lineHeight: 1.5 }}>
          {timedOut
            ? `Claude Routine has not responded (${elapsedMin}m). Write a reply manually, or retry to fire a new generation.`
            : 'Claude Routine is generating a draft. Refreshing automatically — this usually takes under a minute.'}
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
          <button onClick={onRefresh} style={{ ...btn('ghost'), fontSize: '11px' }}>Refresh</button>
          {timedOut && (
            <button disabled={isBusy} onClick={async () => {
              setBusy('retry'); setErr(null)
              try {
                const data = await callApi('/api/admin/dm-inbox/retry-draft', { id: targetItem.id })
                if (data.ok) { setTimeout(onRefresh, 600) }
                else          { setErr(data.error ?? 'Failed to queue draft generation') }
              } catch { setErr('Network error') }
              finally { setBusy(null) }
            }} style={{ ...btn('warn'), fontSize: '11px' }}>{busy === 'retry' ? '…' : 'Retry Draft'}</button>
          )}
          <button disabled={isBusy} onClick={() => { setWriteMode('write'); setPasteText(''); setErr(null) }} style={{ ...btn('ghost'), fontSize: '11px' }}>Write Reply</button>
          <button disabled={isBusy} onClick={() => void mutate('ignore')} style={{ ...btn('ghost'), fontSize: '11px' }}>{busy === 'ignore' ? '…' : 'Ignore'}</button>
        </div>
        <div style={{ display: 'flex', gap: '6px', paddingTop: '6px', borderTop: `1px solid ${C.border2}`, flexWrap: 'wrap' }}>
          {takeOverOrRelease}{blockBtn}
        </div>
        {err && <p style={{ color: C.red, fontSize: '11px', marginTop: '8px' }}>{err}</p>}
        {writeMode === 'write' && (
          <div style={{ marginTop: '10px' }}>
            <p style={{ fontSize: '10px', color: C.muted, margin: '0 0 4px', fontWeight: 700, letterSpacing: '0.06em' }}>WRITE YOUR REPLY</p>
            <textarea value={pasteText} onChange={e => setPasteText(e.target.value)} rows={4}
              placeholder="Type your reply…" style={{ ...S.textarea, direction: 'rtl', lineHeight: 1.7 }} autoFocus />
            <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
              <button disabled={isBusy || !pasteText.trim()} onClick={() => void saveDraft('HUMAN')}
                style={{ ...btn('primary'), fontSize: '12px', opacity: !pasteText.trim() ? 0.5 : 1 }}>
                {busy === 'save' ? '…' : 'Save Draft'}
              </button>
              <button disabled={isBusy} onClick={() => { setWriteMode(null); setPasteText(''); setErr(null) }} style={{ ...btn('ghost'), fontSize: '12px' }}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── regenerating ────────────────────────────────────────────
  if (cardState === 'regenerating') {
    const elapsed = Date.now() - new Date(targetItem.processingStartedAt ?? targetItem.createdAt).getTime()
    const timedOut = elapsed > 10 * 60 * 1000

    async function cancelRegen() {
      setBusy('cancel'); setErr(null)
      try {
        const res = await fetch('/api/admin/dm-inbox', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'cancel_regen', id: targetItem.id }) })
        const data = await res.json() as { ok: boolean; error?: string }
        if (data.ok) { setTimeout(onRefresh, 400) } else { setErr(data.error ?? 'Cancel failed') }
      } catch { setErr('Network error') }
      finally { setBusy(null) }
    }

    return (
      <div style={wrapStyle}>
        {windowBar}
        <div style={{ padding: '10px 12px', background: '#1a1508', border: `1px solid ${timedOut ? C.red : C.gold}`, borderRadius: '6px', marginBottom: '10px', fontSize: '12px', color: timedOut ? C.red : C.gold }}>
          {timedOut ? `Regeneration delayed (${Math.floor(elapsed / 60000)}m) — cancel to keep previous draft.` : 'AI is generating a draft. Refresh in a moment.'}
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={onRefresh} style={{ ...btn('ghost'), fontSize: '11px' }}>Refresh</button>
          <button disabled={isBusy} onClick={() => void cancelRegen()} style={{ ...btn('warn'), fontSize: '11px' }}>{busy === 'cancel' ? '…' : 'Cancel Regeneration'}</button>
        </div>
        {err && <p style={{ color: C.red, fontSize: '11px', marginTop: '8px' }}>{err}</p>}
      </div>
    )
  }

  // ── sending ──────────────────────────────────────────────────
  if (cardState === 'sending') {
    return <div style={wrapStyle}><span style={{ fontSize: '12px', color: C.gold }}>Send in progress…</span></div>
  }

  // ── status_unknown ───────────────────────────────────────────
  if (cardState === 'status_unknown') {
    return (
      <div style={wrapStyle}>
        <div style={{ background: '#1c100a', border: `1px solid ${C.red}`, borderRadius: '6px', padding: '10px 12px', fontSize: '12px', color: C.red, lineHeight: 1.6 }}>
          <strong>⚠ Send outcome unknown.</strong> Instagram may or may not have delivered this message.
          Check your <strong>Instagram outbox</strong> before taking any action. Do <strong>not</strong> retry via this UI — resolve manually in Supabase after confirming.
        </div>
      </div>
    )
  }

  // ── human_managed / story_mention ────────────────────────────
  if (cardState === 'human_managed' || cardState === 'story_mention') {
    return (
      <div style={wrapStyle}>
        <p style={{ margin: '0 0 10px', fontSize: '11px', color: C.muted }}>
          {cardState === 'human_managed' ? 'This conversation is under human management.' : 'Story mention — no auto-reply.'}
        </p>
        <div style={{ display: 'flex', gap: '6px' }}>{takeOverOrRelease}</div>
        {err     && <p style={{ color: C.red,   fontSize: '11px', marginTop: '8px' }}>{err}</p>}
        {success && <p style={{ color: C.green, fontSize: '11px', marginTop: '8px' }}>{success}</p>}
      </div>
    )
  }

  // ── draft_failed / needs_generation (generation failure) ─────
  if (cardState === 'draft_failed' || cardState === 'needs_generation') {
    return (
      <div style={wrapStyle}>
        {windowBar}
        <div style={{ padding: '10px 12px', background: '#1c0a0a', border: `1px solid ${C.red}`, borderRadius: '6px', marginBottom: '10px', fontSize: '12px', color: C.red, lineHeight: 1.6 }}>
          Automatic draft generation failed. Retry to trigger one new AI draft, or write a reply manually.
        </div>

        {writeMode === null ? (
          <>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
              <button disabled={isBusy} onClick={async () => {
                setBusy('retry'); setErr(null)
                try {
                  const data = await callApi('/api/admin/dm-inbox/retry-draft', { id: targetItem.id })
                  if (data.ok) { setTimeout(onRefresh, 600) }
                  else          { setErr(data.error ?? 'Failed to queue draft generation') }
                } catch { setErr('Network error') }
                finally { setBusy(null) }
              }} style={{ ...btn('warn'), fontSize: '12px' }}>
                {busy === 'retry' ? '…' : 'Retry Draft'}
              </button>
              <button disabled={isBusy} onClick={() => { setWriteMode('write'); setPasteText(''); setErr(null) }} style={{ ...btn('ghost'), fontSize: '12px' }}>Write Reply</button>
              <button disabled={isBusy} onClick={() => void mutate('ignore')} style={{ ...btn('ghost'), fontSize: '12px' }}>
                {busy === 'ignore' ? '…' : pendingCount > 1 ? 'Ignore this message' : 'Ignore'}
              </button>
            </div>
            <div style={{ display: 'flex', gap: '6px', paddingTop: '6px', borderTop: `1px solid ${C.border2}`, flexWrap: 'wrap' }}>
              {takeOverOrRelease}{blockBtn}
              <button onClick={() => setShowDebug(d => !d)} style={{ ...btn('ghost'), fontSize: '10px', color: C.muted, marginLeft: 'auto' }}>debug</button>
            </div>
            {err     && <p style={{ color: C.red,   fontSize: '11px', marginTop: '8px' }}>{err}</p>}
            {success && <p style={{ color: C.green, fontSize: '11px', marginTop: '8px' }}>{success}</p>}
            {debugPanel}
          </>
        ) : (
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
                {busy === 'save' ? '…' : 'Save Draft'}
              </button>
              <button disabled={isBusy} onClick={() => { setWriteMode(null); setPasteText(''); setErr(null) }} style={{ ...btn('ghost'), fontSize: '12px' }}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── needs_review ─────────────────────────────────────────────
  if (cardState === 'needs_review') {
    return (
      <div style={wrapStyle}>
        {windowBar}
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
          {msLeft === 0 ? (
            <div style={{ padding: '8px 12px', background: '#1a0808', border: `1px solid ${C.red}`, borderRadius: '6px', fontSize: '12px', color: C.red, fontWeight: 700, letterSpacing: '0.05em' }}>
              Expired — cannot send
            </div>
          ) : (
            <button disabled={isBusy || !editText.trim()} onClick={() => void send()}
              style={{ ...btn('primary'), opacity: (isBusy || !editText.trim()) ? 0.5 : 1, fontSize: '12px' }}>
              {busy === 'send' ? '…' : 'Approve & Send'}
            </button>
          )}
          <button disabled={isBusy} onClick={() => void mutate('ignore')} style={{ ...btn('ghost'), fontSize: '12px' }}>
            {busy === 'ignore' ? '…' : pendingCount > 1 ? 'Ignore this message' : 'Ignore'}
          </button>
        </div>
        <div style={{ display: 'flex', gap: '6px', paddingTop: '8px', marginTop: '4px', borderTop: `1px solid ${C.border2}`, flexWrap: 'wrap' }}>
          {takeOverOrRelease}{blockBtn}
        </div>
      </div>
    )
  }

  // ── ai_suggested_ignore ──────────────────────────────────────
  if (cardState === 'ai_suggested_ignore') {
    return (
      <div style={wrapStyle}>
        {windowBar}
        <div style={{ padding: '10px 12px', background: '#1a1508', border: `1px solid #3a3020`, borderRadius: '6px', fontSize: '12px', color: '#c8b88a', lineHeight: 1.6, marginBottom: '10px' }}>
          AI recommends no reply. Nothing has been sent.
        </div>
        {!showComposer ? (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <button onClick={() => setShowComposer(true)} style={{ ...btn('warn'), fontSize: '12px' }}>Write Reply</button>
            <button disabled={isBusy} onClick={() => void mutate('ignore')} style={{ ...btn('ghost'), fontSize: '12px' }}>
              {busy === 'ignore' ? '…' : pendingCount > 1 ? 'Ignore this message' : 'Ignore'}
            </button>
            {takeOverOrRelease}{blockBtn}
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
              <button disabled={isBusy || !editText.trim()} onClick={() => void send()} style={{ ...btn('primary'), opacity: (isBusy || !editText.trim()) ? 0.5 : 1, fontSize: '12px' }}>
                {busy === 'send' ? '…' : 'Approve & Send'}
              </button>
              <button disabled={isBusy} onClick={() => void mutate('ignore')} style={{ ...btn('ghost'), fontSize: '12px' }}>{busy === 'ignore' ? '…' : 'Ignore'}</button>
              <button onClick={() => setShowComposer(false)} style={{ ...btn('ghost'), fontSize: '12px' }}>Cancel</button>
            </div>
          </>
        )}
        {!showComposer && err     && <p style={{ color: C.red,   fontSize: '11px', marginTop: '8px' }}>{err}</p>}
        {!showComposer && success && <p style={{ color: C.green, fontSize: '11px', marginTop: '8px' }}>{success}</p>}
      </div>
    )
  }

  // ── send_failed_open ─────────────────────────────────────────
  if (cardState === 'send_failed_open') {
    return (
      <div style={wrapStyle}>
        {windowBar}
        <div style={{ padding: '10px 12px', background: '#1c0a0a', border: `1px solid ${C.red}`, borderRadius: '6px', marginBottom: '10px' }}>
          <span style={{ fontSize: '11px', color: C.red, fontWeight: 700, display: 'block', marginBottom: '4px' }}>SEND FAILED</span>
          {targetItem.responseText && <p style={{ margin: 0, fontSize: '12px', color: '#bfb5a6', whiteSpace: 'pre-wrap', direction: 'rtl', textAlign: 'right' }}>Attempted: {targetItem.responseText}</p>}
        </div>
        {err     && <p style={{ color: C.red,   fontSize: '11px', margin: '0 0 8px' }}>{err}</p>}
        {success && <p style={{ color: C.green, fontSize: '11px', margin: '0 0 8px' }}>{success}</p>}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
          <button disabled={isBusy} onClick={() => { if (!window.confirm('Reset this failed send? You will need to re-approve.')) return; void mutate('retry_send_failed') }} style={{ ...btn('warn'), fontSize: '12px' }}>
            {busy === 'retry_send_failed' ? '…' : 'Retry Send'}
          </button>
          <button disabled={isBusy} onClick={() => void mutate('ignore')} style={{ ...btn('ghost'), fontSize: '12px' }}>{busy === 'ignore' ? '…' : 'Ignore'}</button>
        </div>
        <div style={{ display: 'flex', gap: '6px', paddingTop: '6px', borderTop: `1px solid ${C.border2}`, flexWrap: 'wrap' }}>
          {takeOverOrRelease}{blockBtn}
        </div>
      </div>
    )
  }

  return null
}

function SenderConvDetail({ group, onRefresh }: { group: ConversationGroup; onRefresh: () => void }) {
  const pendingItems = group.items.filter(i => {
    const s = getCardState(i)
    return s !== 'human_managed' && s !== 'story_mention'
  })
  const targetItem = selectActionTarget(pendingItems.length > 0 ? pendingItems : group.items)
  if (!targetItem) return null

  const pendingIds = new Set(pendingItems.map(i => i.id))

  const senderName = group.username ? `@${group.username}` : group.displayName ?? 'Instagram User'
  const igHref     = group.username ? `https://www.instagram.com/${encodeURIComponent(group.username)}/` : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      {/* Conversation timeline — all rows chronological, pending highlighted */}
      <ConvDetailTimeline history={group.history} targetId={targetItem.id} pendingIds={pendingIds} />

      {/* Story context for target item */}
      {targetItem.isStoryReply && (
        <div style={{ margin: '0 16px 8px', borderRadius: '8px', border: `1px solid #3a3020`, background: '#1a1508', overflow: 'hidden' }}>
          {targetItem.storyContext?.mediaUrl ? (
            <StoryThumbnail mediaUrl={targetItem.storyContext.mediaUrl} mediaType={targetItem.storyContext.mediaType}
              fallbackText={targetItem.storyContext.aiDescription || targetItem.storyContext.caption || targetItem.storyContext.ocrText} />
          ) : (targetItem.storyContext?.aiDescription || targetItem.storyContext?.caption || targetItem.storyContext?.ocrText) ? (
            <StoryTextFallback text={targetItem.storyContext.aiDescription || targetItem.storyContext.caption || targetItem.storyContext.ocrText} />
          ) : null}
          {(targetItem.storyContext?.caption || targetItem.storyContext?.ocrText) && (
            <div style={{ padding: '8px 10px' }}>
              <span style={{ fontSize: '10px', color: C.gold, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', display: 'block', marginBottom: '3px' }}>Story Caption</span>
              <p style={{ margin: 0, fontSize: '12px', color: '#c8b88a', direction: 'rtl', textAlign: 'right', whiteSpace: 'pre-wrap' }}>{targetItem.storyContext.caption || targetItem.storyContext.ocrText}</p>
            </div>
          )}
          {!targetItem.storyContext && <div style={{ padding: '8px 10px' }}><span style={{ fontSize: '11px', color: C.muted }}>Story context not available</span></div>}
        </div>
      )}

      {/* Response workspace — key resets all state on target change */}
      <ConvWorkspace key={targetItem.id} targetItem={targetItem} pendingCount={pendingItems.length} onRefresh={onRefresh}
        effectiveCreatedAt={pendingItems.length > 0
          ? pendingItems.reduce((best, i) => i.createdAt > best ? i.createdAt : best, pendingItems[0].createdAt)
          : targetItem.createdAt} />

      {/* Footer: IG link + debug info */}
      <div style={{ padding: '6px 16px', fontSize: '9px', color: '#2a2420', borderTop: `1px solid ${C.border2}`, display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <span>{senderName}</span>
        {igHref && <a href={igHref} target="_blank" rel="noopener noreferrer" style={{ color: '#2a2420', textDecoration: 'none' }}>IG profile ↗</a>}
        <span style={{ marginLeft: 'auto' }}>target: …{targetItem.id.slice(-8)} · {pendingItems.length} pending · {group.items.length} total</span>
      </div>
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
  // needs_review=0: a ready AI draft is more actionable than a failed generation.
  // When both exist for a sender, the ready draft shows first.
  needs_review: 0, draft_failed: 1, needs_generation: 2, send_failed_open: 3,
  status_unknown: 4, sending: 5, draft_generating: 6, regenerating: 7,
  ai_suggested_ignore: 8, story_mention: 9, human_managed: 10,
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
  draft_failed: C.red, needs_generation: C.red, needs_review: C.green, send_failed_open: C.red,
  status_unknown: C.red, sending: C.gold, draft_generating: C.gold, regenerating: C.gold,
  ai_suggested_ignore: C.muted, story_mention: C.muted, human_managed: C.muted,
}
const STATE_LABEL: Record<CardState, string> = {
  draft_failed: 'Draft failed', needs_generation: 'Draft failed (legacy)', needs_review: 'Needs review', send_failed_open: 'Send failed',
  status_unknown: 'Status unknown', sending: 'Sending', draft_generating: 'Generating draft…', regenerating: 'Regenerating',
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

function ConvSenderRow({ group, selected, onClick, checked, onCheck }: {
  group: ConversationGroup; selected: boolean; onClick: () => void
  checked?: boolean; onCheck?: (checked: boolean) => void
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
      display: 'flex', gap: '8px', alignItems: 'center',
      transition: 'background 0.1s',
    }}>
      {onCheck !== undefined && (
        <input type="checkbox" checked={checked ?? false}
          onChange={e => { e.stopPropagation(); onCheck(e.target.checked) }}
          onClick={e => e.stopPropagation()}
          style={{ flexShrink: 0, accentColor: C.gold, cursor: 'pointer', width: '13px', height: '13px' }} />
      )}
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

function DmInbox({ initialSenderId }: { initialSenderId?: string } = {}) {
  const [items,        setItems]        = useState<DmItem[] | null>(null)
  const [loading,      setLoading]      = useState(false)
  const [err,          setErr]          = useState<string | null>(null)
  const [selected,     setSelected]     = useState<string | null>(initialSenderId ?? null)
  const [showList,     setShowList]     = useState(true) // mobile: false = detail view
  const [dmSearch,     setDmSearch]     = useState('')
  type DmFilter = 'all' | 'needs_draft' | 'needs_review' | 'urgent' | 'attention'
  const [dmFilter,     setDmFilter]     = useState<DmFilter>('all')
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set())
  const [bulkBusy,     setBulkBusy]     = useState(false)
  const [bulkConfirm,  setBulkConfirm]  = useState(false)

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
      // Auto-select first group if none selected (and no initialSenderId was requested)
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

  // Auto-refresh every 12s while any group has a Routine generation in flight
  const hasGenerating = groups.some(g => g.worstState === 'draft_generating')
  useEffect(() => {
    if (!hasGenerating) return
    const t = setInterval(() => { void load() }, 12_000)
    return () => clearInterval(t)
  }, [hasGenerating, load])

  // Separate audit items (human_managed, story_mention) — show in a collapsed section
  const activeGroups = groups.filter(g => g.worstState !== 'human_managed' && g.worstState !== 'story_mention')
  const auditGroups  = groups.filter(g => g.worstState === 'human_managed' || g.worstState === 'story_mention')
  const [showAudit, setShowAudit] = useState(false)

  const urgentCount    = activeGroups.filter(g => g.mostUrgentMs < 2 * 3_600_000).length
  const needsDraftCount = activeGroups.filter(g => g.worstState === 'draft_failed' || g.worstState === 'needs_generation').length
  const needsReviewCount = activeGroups.filter(g => g.worstState === 'needs_review').length
  const attentionCount = activeGroups.filter(g => ['sending','status_unknown','send_failed_open'].includes(g.worstState)).length

  // Apply search + filter to activeGroups
  const filteredGroups = activeGroups.filter(g => {
    if (dmFilter === 'needs_draft'  && g.worstState !== 'draft_failed' && g.worstState !== 'needs_generation') return false
    if (dmFilter === 'needs_review' && g.worstState !== 'needs_review')     return false
    if (dmFilter === 'urgent'       && g.mostUrgentMs >= 2 * 3_600_000)    return false
    if (dmFilter === 'attention'    && !['sending','status_unknown','send_failed_open'].includes(g.worstState)) return false
    if (dmSearch.trim()) {
      const q = dmSearch.trim().toLowerCase()
      const nameMatch = (g.username ?? '').toLowerCase().includes(q) || (g.displayName ?? '').toLowerCase().includes(q)
      const previewMatch = (g.latestItem?.messageText ?? '').toLowerCase().includes(q)
      if (!nameMatch && !previewMatch) return false
    }
    return true
  })

  // Auto-select first filtered group when selected disappears from filtered view
  useEffect(() => {
    if (selected && filteredGroups.length > 0 && !filteredGroups.find(g => g.senderId === selected)) {
      setSelected(filteredGroups[0].senderId)
    }
  }, [dmSearch, dmFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  const selectedGroup = groups.find(g => g.senderId === selected) ?? null

  function selectGroup(senderId: string) {
    setSelected(senderId)
    setShowList(false) // on mobile, switch to detail view
  }

  async function doBulkIgnore() {
    const ids = Array.from(bulkSelected)
    setBulkBusy(true); setBulkConfirm(false)
    try {
      const res = await fetch('/api/admin/dm-inbox', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'bulk_ignore', senderIds: ids }),
      })
      const data = await res.json() as { ok: boolean; totalIgnored?: number; failed?: string[]; error?: string }
      if (data.ok) {
        setBulkSelected(new Set())
        void load()
      } else {
        // Non-fatal — some may have failed; reload to reflect actual state
        void load()
      }
    } catch { /* ignore */ }
    finally { setBulkBusy(false) }
  }

  // Compute total pending message count for bulk confirm dialog
  const bulkPendingCount = Array.from(bulkSelected).reduce((sum, sid) => {
    const g = groups.find(x => x.senderId === sid)
    return sum + (g?.pendingCount ?? 0)
  }, 0)

  const isMobileNarrow = typeof window !== 'undefined' && window.innerWidth < 640

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginTop: '-8px' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '0 0 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="search"
            placeholder="Search by name or message…"
            value={dmSearch}
            onChange={e => setDmSearch(e.target.value)}
            style={{ flex: 1, background: C.bg, border: `1px solid ${C.border}`, borderRadius: '6px', color: C.text, fontSize: '11px', padding: '4px 10px', outline: 'none', fontFamily: 'system-ui, sans-serif' }}
          />
          <button onClick={() => void load()} disabled={loading} style={{ ...btn('ghost'), fontSize: '10px', padding: '3px 10px' }}>
            {loading ? '…' : 'Refresh'}
          </button>
        </div>
        {items !== null && (
          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', alignItems: 'center' }}>
            {(['all','needs_draft','needs_review','urgent','attention'] as const).map(f => {
              const counts: Record<string,number> = { all: activeGroups.length, needs_draft: needsDraftCount, needs_review: needsReviewCount, urgent: urgentCount, attention: attentionCount }
              const labels: Record<string,string> = { all: 'All', needs_draft: 'Draft Failed', needs_review: 'Needs Review', urgent: 'Urgent', attention: 'Attention' }
              const active = dmFilter === f
              const count = counts[f]
              return (
                <button key={f} onClick={() => setDmFilter(f)}
                  style={{ fontSize: '10px', padding: '2px 9px', border: `1px solid ${active ? C.gold : C.border}`, borderRadius: '10px', background: active ? C.gold + '22' : 'none', color: active ? C.gold : C.muted, cursor: 'pointer', fontFamily: 'system-ui, sans-serif' }}>
                  {labels[f]} {count > 0 ? `(${count})` : ''}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {err && <p style={{ color: C.red, fontSize: '12px' }}>{err}</p>}
      {loading && !items && <p style={{ color: C.muted, fontSize: '12px' }}>Loading…</p>}

      {/* Bulk ignore confirmation dialog */}
      {bulkConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: C.sidebar, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '24px 28px', maxWidth: '360px', width: '90%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ margin: 0, fontSize: '13px', color: C.text, fontWeight: 700 }}>Ignore conversations?</p>
            <p style={{ margin: 0, fontSize: '12px', color: C.muted }}>
              Ignore {bulkSelected.size} conversation{bulkSelected.size !== 1 ? 's' : ''} and {bulkPendingCount} pending message{bulkPendingCount !== 1 ? 's' : ''}?
              Only actionable items are affected — SENDING and SENT records are never touched.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setBulkConfirm(false)} style={{ ...btn('ghost'), fontSize: '12px' }}>Cancel</button>
              <button onClick={() => void doBulkIgnore()} style={{ ...btn('primary'), fontSize: '12px', background: C.red, borderColor: C.red }}>Ignore</button>
            </div>
          </div>
        </div>
      )}

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
              {/* Bulk action bar */}
              {bulkSelected.size > 0 && (
                <div style={{ padding: '6px 10px', borderBottom: `1px solid ${C.border}`, background: C.gold + '11', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '10px', color: C.gold, fontWeight: 700 }}>{bulkSelected.size} selected</span>
                  <button disabled={bulkBusy} onClick={() => setBulkConfirm(true)}
                    style={{ ...btn('ghost'), fontSize: '10px', padding: '2px 8px', color: C.red, borderColor: C.red }}>
                    {bulkBusy ? '…' : 'Ignore selected'}
                  </button>
                  <button onClick={() => setBulkSelected(new Set())}
                    style={{ ...btn('ghost'), fontSize: '10px', padding: '2px 6px' }}>Clear</button>
                </div>
              )}
              {/* Select-all bar */}
              {filteredGroups.length > 0 && (
                <div style={{ padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '6px', borderBottom: `1px solid ${C.border2}` }}>
                  <input type="checkbox"
                    checked={filteredGroups.length > 0 && filteredGroups.every(g => bulkSelected.has(g.senderId))}
                    onChange={e => {
                      if (e.target.checked) setBulkSelected(prev => new Set([...prev, ...filteredGroups.map(g => g.senderId)]))
                      else setBulkSelected(prev => { const s = new Set(prev); filteredGroups.forEach(g => s.delete(g.senderId)); return s })
                    }}
                    style={{ accentColor: C.gold, cursor: 'pointer', width: '12px', height: '12px' }} />
                  <span style={{ fontSize: '9px', color: C.muted }}>Select all visible ({filteredGroups.length})</span>
                </div>
              )}
              <div style={{ padding: '8px 6px', display: 'flex', flexDirection: 'column', gap: '1px', flex: 1 }}>
                {filteredGroups.length === 0 && activeGroups.length > 0 && (
                  <p style={{ color: C.muted, fontSize: '11px', padding: '12px 8px', textAlign: 'center' }}>No results</p>
                )}
                {filteredGroups.map(g => (
                  <ConvSenderRow key={g.senderId} group={g} selected={selected === g.senderId}
                    onClick={() => selectGroup(g.senderId)}
                    checked={bulkSelected.has(g.senderId)}
                    onCheck={checked => setBulkSelected(prev => { const s = new Set(prev); if (checked) s.add(g.senderId); else s.delete(g.senderId); return s })} />
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

          {/* Right pane — single conversation surface (Phase B2) */}
          {(!showList || !isMobileNarrow) && (
            <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', background: C.bg, display: 'flex', flexDirection: 'column' }}>
              {!selectedGroup ? (
                <div style={{ padding: '32px 24px', color: C.muted, fontSize: '12px' }}>Select a conversation</div>
              ) : (
                <>
                  {/* Sticky sender header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderBottom: `1px solid ${C.border}`, background: C.sidebar, position: 'sticky', top: 0, zIndex: 10, flexShrink: 0 }}>
                    {isMobileNarrow && (
                      <button onClick={() => setShowList(true)} style={{ background: 'none', border: 'none', color: C.dim, cursor: 'pointer', fontSize: '16px', padding: '2px 6px 2px 0', fontFamily: 'system-ui, sans-serif' }}>‹</button>
                    )}
                    <SenderAvatar profilePictureUrl={selectedGroup.profilePictureUrl} label={selectedGroup.displayName || selectedGroup.username || 'I'} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '13px', color: C.text }}>
                        {selectedGroup.username ? `@${selectedGroup.username}` : selectedGroup.displayName ?? 'Instagram User'}
                      </div>
                      <div style={{ fontSize: '10px', color: C.muted }}>
                        {selectedGroup.pendingCount} pending · {selectedGroup.items.length} total
                      </div>
                    </div>
                    <div style={{ fontSize: '10px', color: STATE_COLOR[selectedGroup.worstState], fontWeight: 600, flexShrink: 0 }}>
                      {STATE_LABEL[selectedGroup.worstState]}
                    </div>
                  </div>

                  {/* Conversation + workspace */}
                  <SenderConvDetail key={selectedGroup.senderId} group={selectedGroup} onRefresh={() => void load()} />
                </>
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
  const [rows,      setRows]      = useState<FeedbackRow[] | null>(null)
  const [loading,   setLoading]   = useState(false)
  const [err,       setErr]       = useState<string | null>(null)
  const [expanded,  setExpanded]  = useState<Set<string>>(new Set())

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

  // Category distribution
  const ALL_CATS = ['good','too_long','too_short','too_soft','too_salesy','wrong_tone','wrong_context','missed_context','other']
  const catCounts: Record<string, number> = {}
  for (const cat of ALL_CATS) catCounts[cat] = 0
  for (const r of rows) {
    if (r.feedback_category && catCounts[r.feedback_category] !== undefined) catCounts[r.feedback_category]++
    else if (r.feedback_category) catCounts['other'] = (catCounts['other'] ?? 0) + 1
  }
  const catTotal = Object.values(catCounts).reduce((a, b) => a + b, 0)
  const catWithData = ALL_CATS.filter(c => catCounts[c] > 0)

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <div>
      {/* Summary */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', padding: '12px 16px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: '8px', marginBottom: '16px', fontSize: '12px' }}>
        <span><span style={{ color: C.muted }}>Total sent: </span><span style={{ fontWeight: 600 }}>{rows.length}</span></span>
        <span><span style={{ color: C.muted }}>Rated: </span><span style={{ fontWeight: 600 }}>{rated.length}</span></span>
        <span><span style={{ color: C.muted }}>Edited before send: </span><span style={{ fontWeight: 600 }}>{edited.length} ({rows.length > 0 ? Math.round(edited.length / rows.length * 100) : 0}%)</span></span>
        {goodRate !== null && <span><span style={{ color: C.muted }}>Good rating: </span><span style={{ fontWeight: 600, color: C.green }}>{Math.round(goodRate * 100)}%</span></span>}
      </div>

      {/* Category distribution */}
      {catWithData.length > 0 && (
        <div style={{ marginBottom: '16px', padding: '12px 16px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: '8px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: C.muted, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px' }}>Category Distribution</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {catWithData.map(cat => {
              const count = catCounts[cat]
              const pct   = catTotal > 0 ? Math.round(count / catTotal * 100) : 0
              const barColor = cat === 'good' ? C.green : cat.startsWith('too') ? C.gold : C.blue
              return (
                <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px' }}>
                  <span style={{ width: '120px', color: C.dim, flexShrink: 0 }}>{cat.replace(/_/g, ' ')}</span>
                  <div style={{ flex: 1, background: C.border, borderRadius: '3px', height: '6px', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: '3px' }} />
                  </div>
                  <span style={{ width: '48px', textAlign: 'right', color: C.muted, flexShrink: 0 }}>{count} ({pct}%)</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              {['', 'Date', 'Draft source', 'Edited', 'Rating', 'Category', 'Sent response'].map(h => (
                <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontSize: '10px', fontWeight: 700, color: C.muted, letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const isOpen = expanded.has(row.id)
              return (
                <>
                  <tr key={row.id} onClick={() => toggleExpand(row.id)}
                    style={{ borderBottom: isOpen ? 'none' : `1px solid ${C.border2}`, cursor: 'pointer', background: isOpen ? C.surface : 'none' }}>
                    <td style={{ padding: '8px 6px 8px 10px', color: C.muted, fontSize: '10px', width: '16px' }}>{isOpen ? '▲' : '▼'}</td>
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
                  {isOpen && (
                    <tr key={row.id + '_detail'} style={{ borderBottom: `1px solid ${C.border2}`, background: C.surface }}>
                      <td colSpan={7} style={{ padding: '0 16px 14px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', paddingTop: '10px' }}>
                          {row.inbound_context && (
                            <div>
                              <div style={{ fontSize: '9px', fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Inbound context</div>
                              <p style={{ margin: 0, fontSize: '11px', color: C.dim, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{row.inbound_context}</p>
                            </div>
                          )}
                          {row.original_draft && (
                            <div>
                              <div style={{ fontSize: '9px', fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Original draft</div>
                              <p style={{ margin: 0, fontSize: '11px', color: C.dim, whiteSpace: 'pre-wrap', direction: 'rtl', textAlign: 'right', lineHeight: 1.5 }}>{row.original_draft}</p>
                            </div>
                          )}
                          <div style={{ gridColumn: '1 / -1' }}>
                            <div style={{ fontSize: '9px', fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Final sent response</div>
                            <p style={{ margin: 0, fontSize: '11px', color: '#9ee0b0', whiteSpace: 'pre-wrap', direction: 'rtl', textAlign: 'right', lineHeight: 1.5 }}>{row.final_sent_response}</p>
                          </div>
                          {row.feedback_note && (
                            <div style={{ gridColumn: '1 / -1' }}>
                              <div style={{ fontSize: '9px', fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Feedback note</div>
                              <p style={{ margin: 0, fontSize: '11px', color: C.dim, lineHeight: 1.5 }}>{row.feedback_note}</p>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              )
            })}
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

function AppCard({ app, section, onRefresh, forceOpen }: { app: App; section: 'new' | 'underReview' | 'approved' | 'claimed' | 'paid'; onRefresh: () => void; forceOpen?: boolean }) {
  const [isOpen,        setIsOpen]        = useState(forceOpen ?? false)
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

type ConsTab = 'all' | 'open' | 'new' | 'underReview' | 'approved' | 'claimed' | 'paid'

const CONS_TABS: { id: ConsTab; label: string }[] = [
  { id: 'all',         label: 'All' },
  { id: 'open',        label: 'Open / Review' },
  { id: 'new',         label: 'New' },
  { id: 'underReview', label: 'Under Review' },
  { id: 'approved',    label: 'Approved / Payment Sent' },
  { id: 'claimed',     label: 'Awaiting Confirmation' },
  { id: 'paid',        label: 'Paid / Completed' },
]

function sectionForApp(app: App, data: DashboardData): 'new' | 'underReview' | 'approved' | 'claimed' | 'paid' {
  if (data.new.some(a => a.pageId === app.pageId))         return 'new'
  if (data.underReview.some(a => a.pageId === app.pageId)) return 'underReview'
  if (data.approved.some(a => a.pageId === app.pageId))    return 'approved'
  if (data.claimed.some(a => a.pageId === app.pageId))     return 'claimed'
  return 'paid'
}

function AppListRow({ app, selected, onClick }: { app: App; selected: boolean; onClick: () => void }) {
  const goal = (app.subject || app.message || '').slice(0, 60)
  return (
    <button onClick={onClick} style={{
      display: 'flex', flexDirection: 'column', gap: '2px', padding: '9px 12px', width: '100%',
      background: selected ? C.gold + '12' : 'none', border: 'none',
      borderLeft: `3px solid ${selected ? C.gold : 'transparent'}`,
      cursor: 'pointer', textAlign: 'left', fontFamily: 'system-ui, sans-serif',
      borderBottom: `1px solid ${C.border2}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: selected ? C.gold : C.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {app.name || '(unnamed)'}
        </span>
        {app.status && app.status !== 'New' && (
          <span style={{ fontSize: '9px', color: C.goldDim, fontWeight: 700, flexShrink: 0 }}>{app.status}</span>
        )}
      </div>
      <div style={{ display: 'flex', gap: '5px', fontSize: '10px', color: C.muted }}>
        {app.location && <span>{app.location}</span>}
        {app.location && <span>·</span>}
        <span>{new Date(app.submittedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}</span>
      </div>
      {goal && (
        <div style={{ fontSize: '10px', color: C.dim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {goal}{goal.length >= 60 ? '…' : ''}
        </div>
      )}
    </button>
  )
}

function Consultations({ initialTab, initialAppId }: { initialTab?: ConsTab; initialAppId?: string } = {}) {
  const [data,       setData]       = useState<DashboardData | null>(null)
  const [loading,    setLoading]    = useState(false)
  const [err,        setErr]        = useState('')
  const [activeTab,  setActiveTab]  = useState<ConsTab>(initialTab ?? 'all')
  const [search,     setSearch]     = useState('')
  const [sort,       setSort]       = useState<'newest' | 'oldest'>('newest')
  const [selectedId, setSelectedId] = useState<string | null>(initialAppId ?? null)
  const [showDetail, setShowDetail] = useState(!!initialAppId)

  const load = useCallback(async () => {
    setLoading(true); setErr('')
    try {
      const res = await fetch('/api/admin/consultation/list')
      if (!res.ok) { setErr('Failed to load'); return }
      const d: DashboardData = await res.json()
      setData(d)
      const all = [...d.new, ...d.underReview, ...d.approved, ...d.claimed, ...d.paid]
      if (initialAppId) {
        const found = all.find(a => a.pageId === initialAppId)
        setSelectedId(found ? found.pageId : (all[0]?.pageId ?? null))
      } else if (!selectedId && all.length > 0) {
        setSelectedId(all[0].pageId)
      }
    } catch { setErr('Network error') }
    finally { setLoading(false) }
  }, [selectedId, initialAppId])

  useEffect(() => { void load() }, [load])

  if (loading && !data) return <p style={{ color: C.muted, fontSize: '12px' }}>Loading…</p>
  if (err)              return <p style={{ color: C.red,   fontSize: '12px' }}>{err}</p>
  if (!data)            return null

  const allApps = [...data.new, ...data.underReview, ...data.approved, ...data.claimed, ...data.paid]

  function appsForTab(tab: ConsTab): App[] {
    if (tab === 'all')         return allApps
    if (tab === 'open')        return [...data!.new, ...data!.underReview]
    if (tab === 'new')         return data!.new
    if (tab === 'underReview') return data!.underReview
    if (tab === 'approved')    return data!.approved
    if (tab === 'claimed')     return data!.claimed
    return data!.paid
  }

  const q = search.trim().toLowerCase()
  let displayApps = appsForTab(activeTab).filter(app => {
    if (!q) return true
    return (
      (app.name     || '').toLowerCase().includes(q) ||
      (app.location || '').toLowerCase().includes(q) ||
      (app.subject  || '').toLowerCase().includes(q) ||
      (app.message  || '').toLowerCase().includes(q) ||
      (app.email    || '').toLowerCase().includes(q) ||
      (app.phone    || '').toLowerCase().includes(q)
    )
  })
  displayApps = [...displayApps].sort((a, b) => {
    const diff = new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime()
    return sort === 'newest' ? -diff : diff
  })

  const selectedApp    = selectedId ? allApps.find(a => a.pageId === selectedId) ?? null : null
  const selectedSection = selectedApp ? sectionForApp(selectedApp, data) : 'new'

  const isMobileNarrow = typeof window !== 'undefined' && window.innerWidth < 640

  function selectApp(pageId: string) { setSelectedId(pageId); setShowDetail(true) }

  const emptyMsg: Record<ConsTab, string> = {
    all: 'No applications yet.', open: 'No open applications.',
    new: 'No new applications.', underReview: 'No applications under review.',
    approved: 'No applications approved yet.', claimed: 'No applications awaiting confirmation.',
    paid: 'No completed applications.',
  }

  const tabBar = (
    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '8px' }}>
      {CONS_TABS.map(t => {
        const count = appsForTab(t.id).length
        const active = activeTab === t.id
        return (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            padding: '4px 10px', fontSize: '10px', fontWeight: active ? 700 : 400, cursor: 'pointer',
            background: active ? C.gold + '18' : 'transparent',
            color: active ? C.gold : C.muted,
            border: `1px solid ${active ? C.goldDim : C.border2}`,
            borderRadius: '10px', fontFamily: 'system-ui, sans-serif', whiteSpace: 'nowrap',
          }}>
            {t.label}{count > 0 ? ` (${count})` : ''}
          </button>
        )
      })}
    </div>
  )

  const toolbar = (
    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap' }}>
      <input value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Search name, location, goal…"
        style={{ ...S.input, flex: 1, minWidth: '140px', fontSize: '11px', padding: '5px 9px' }} />
      <select value={sort} onChange={e => setSort(e.target.value as 'newest' | 'oldest')}
        style={{ ...S.select, width: 'auto', fontSize: '10px', padding: '5px 8px' }}>
        <option value="newest">Newest</option>
        <option value="oldest">Oldest</option>
      </select>
      <button onClick={() => void load()} disabled={loading} style={{ ...btn('ghost'), fontSize: '10px', padding: '4px 10px' }}>
        {loading ? '…' : 'Refresh'}
      </button>
    </div>
  )

  if (!isMobileNarrow) {
    return (
      <div style={{ marginTop: '-8px' }}>
        {tabBar}
        {toolbar}
        <div style={{ display: 'flex', gap: 0, minHeight: 'calc(100vh - 220px)', border: `1px solid ${C.border}`, borderRadius: '8px', overflow: 'hidden' }}>
          <div style={{ width: '300px', minWidth: '240px', borderRight: `1px solid ${C.border}`, background: C.sidebar, overflowY: 'auto', flexShrink: 0 }}>
            {displayApps.length === 0 ? (
              <p style={{ padding: '16px 12px', color: C.muted, fontSize: '12px', margin: 0 }}>
                {q ? 'No results match your search.' : emptyMsg[activeTab]}
              </p>
            ) : displayApps.map(app => (
              <AppListRow key={app.pageId} app={app} selected={selectedId === app.pageId} onClick={() => selectApp(app.pageId)} />
            ))}
          </div>
          <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', background: C.bg }}>
            {selectedApp ? (
              <div style={{ padding: '16px' }}>
                <AppCard key={selectedApp.pageId} app={selectedApp} section={selectedSection} onRefresh={() => void load()} forceOpen />
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px' }}>
                <p style={{ color: C.muted, fontSize: '12px' }}>Select an application.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Mobile: list → detail
  if (showDetail && selectedApp) {
    return (
      <div>
        <button onClick={() => setShowDetail(false)} style={{ ...btn('ghost'), fontSize: '11px', marginBottom: '10px' }}>← Back</button>
        <AppCard key={selectedApp.pageId} app={selectedApp} section={selectedSection} onRefresh={() => { void load(); setShowDetail(false) }} forceOpen />
      </div>
    )
  }
  return (
    <div>
      {tabBar}
      {toolbar}
      {displayApps.length === 0 ? (
        <p style={{ color: C.muted, fontSize: '12px' }}>{q ? 'No results match your search.' : emptyMsg[activeTab]}</p>
      ) : (
        <div style={{ border: `1px solid ${C.border}`, borderRadius: '8px', overflow: 'hidden' }}>
          {displayApps.map(app => (
            <AppListRow key={app.pageId} app={app} selected={selectedId === app.pageId} onClick={() => selectApp(app.pageId)} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Overview ──────────────────────────────────────────────────
function Overview({ onNavigate }: { onNavigate: (section: Section, senderId?: string, consTab?: ConsTab, appId?: string) => void }) {
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

  const dmItems    = dmData?.items ?? []
  const allGroups  = groupBySender(dmItems)
  const activeGroups = allGroups.filter(g => g.worstState !== 'human_managed' && g.worstState !== 'story_mention')

  // Actionable = needs_generation or needs_review
  const actionableGroups = activeGroups.filter(g => g.worstState === 'needs_generation' || g.worstState === 'needs_review')
  const urgentGroups     = actionableGroups.filter(g => g.mostUrgentMs < 2 * 3_600_000)
  const attentionGroups  = activeGroups.filter(g => g.worstState === 'sending' || g.worstState === 'status_unknown' || g.worstState === 'send_failed_open')

  // Flat item counts preserved for KPI
  const needsReview = dmItems.filter(i => { const s = getCardState(i); return s === 'needs_review' || s === 'needs_generation' })
  const urgent      = needsReview.filter(i => windowMsRemaining(i.createdAt) < 2 * 3_600_000)
  const attention   = dmItems.filter(i => { const s = getCardState(i); return s === 'sending' || s === 'status_unknown' || s === 'send_failed_open' })
  const totalNew    = (consData?.new.length ?? 0) + (consData?.underReview.length ?? 0)
  const paidCount   = consData?.paid.length ?? 0

  // Top 5 groups for "Needs your attention" DM panel
  // Sort: urgent first (ascending urgency), then oldest actionable
  const topDmGroups = [...urgentGroups]
    .sort((a, b) => a.mostUrgentMs - b.mostUrgentMs)
    .concat(
      actionableGroups
        .filter(g => g.mostUrgentMs >= 2 * 3_600_000)
        .sort((a, b) => a.mostUrgentMs - b.mostUrgentMs)
    )
    .slice(0, 5)

  // Top 5 consultations needing attention
  const attentionCons = [...(consData?.new ?? []), ...(consData?.underReview ?? [])].slice(0, 5)

  function KpiCard({ label, value, color, onClick }: { label: string; value: number; color?: string; onClick: () => void }) {
    const active = value > 0
    return (
      <button onClick={onClick} style={{
        padding: '14px 18px', background: C.surface, border: `1px solid ${active && color ? color + '44' : C.border}`,
        borderRadius: '8px', cursor: 'pointer', textAlign: 'left', fontFamily: 'system-ui, sans-serif',
        transition: 'border-color 0.15s',
      }}>
        <div style={{ fontSize: '22px', fontWeight: 700, color: active && color ? color : C.dim, lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: '10px', color: C.muted, marginTop: '5px', letterSpacing: '0.04em' }}>{label}</div>
        <div style={{ fontSize: '9px', color: active ? (color ?? C.muted) : C.muted, marginTop: '4px', opacity: 0.7 }}>→ view</div>
      </button>
    )
  }

  function humanizeMsg(text: string | null, type: string): string {
    if (text) return text.length > 72 ? text.slice(0, 70) + '…' : text
    if (type === 'REEL') return 'Shared a reel'
    if (type === 'IMAGE') return 'Sent an image'
    if (type === 'STORY_MENTION') return 'Mentioned in story'
    return `[${type}]`
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '8px' }}>
        <KpiCard label="DMs needs review"  value={needsReview.length} color={C.blue}  onClick={() => onNavigate('dm')} />
        <KpiCard label="Urgent (<2h)"       value={urgent.length}      color={C.red}   onClick={() => onNavigate('dm', urgentGroups[0]?.senderId)} />
        <KpiCard label="DMs need attention" value={attention.length}   color={C.gold}  onClick={() => onNavigate('dm', attentionGroups[0]?.senderId)} />
        <KpiCard label="Consultations open" value={totalNew}           color={C.gold}  onClick={() => onNavigate('consultations', undefined, 'open')} />
        <KpiCard label="Paid / Completed"   value={paidCount}                          onClick={() => onNavigate('consultations', undefined, 'paid')} />
      </div>

      {/* Needs your attention */}
      <div>
        <div style={{ fontSize: '10px', color: C.muted, letterSpacing: '0.08em', fontWeight: 600, marginBottom: '8px', paddingBottom: '5px', borderBottom: `1px solid ${C.border}` }}>
          NEEDS YOUR ATTENTION
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: '10px' }}>

          {/* DM panel */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{ padding: '8px 12px', borderBottom: `1px solid ${C.border2}`, fontSize: '10px', color: C.muted, fontWeight: 600, letterSpacing: '0.06em' }}>
              DM INBOX
            </div>
            {topDmGroups.length === 0 ? (
              <p style={{ margin: 0, padding: '14px 12px', fontSize: '12px', color: C.muted }}>You're caught up.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {topDmGroups.map((g, i) => {
                  const ms = g.mostUrgentMs
                  const urgent = ms < 2 * 3_600_000
                  const label  = g.username ? `@${g.username}` : g.displayName ?? 'Instagram User'
                  const preview = humanizeMsg(g.latestItem.messageText, g.latestItem.messageType)
                  return (
                    <button key={g.senderId} onClick={() => onNavigate('dm', g.senderId)} style={{
                      display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px',
                      background: 'none', border: 'none', borderTop: i > 0 ? `1px solid ${C.border2}` : 'none',
                      cursor: 'pointer', textAlign: 'left', fontFamily: 'system-ui, sans-serif', width: '100%',
                    }}>
                      <SenderAvatar profilePictureUrl={g.profilePictureUrl} label={label} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
                          <span style={{ fontSize: '9px', color: STATE_COLOR[g.worstState], fontWeight: 700, flexShrink: 0 }}>{STATE_LABEL[g.worstState]}</span>
                        </div>
                        <div style={{ fontSize: '11px', color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', direction: 'rtl', textAlign: 'left' }}>{preview}</div>
                      </div>
                      <div style={{ fontSize: '10px', color: urgent ? C.red : C.muted, fontWeight: urgent ? 700 : 400, flexShrink: 0 }}>
                        {fmtWindowRemaining(ms)}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Consultations panel */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{ padding: '8px 12px', borderBottom: `1px solid ${C.border2}`, fontSize: '10px', color: C.muted, fontWeight: 600, letterSpacing: '0.06em' }}>
              CONSULTATIONS
            </div>
            {attentionCons.length === 0 ? (
              <p style={{ margin: 0, padding: '14px 12px', fontSize: '12px', color: C.muted }}>No consultations need attention.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {attentionCons.map((app, i) => {
                  const isNew = (consData?.new ?? []).some(a => a.pageId === app.pageId)
                  const statusLabel = isNew ? 'New' : 'Under Review'
                  const statusColor = isNew ? C.blue : C.gold
                  const goal = (app.subject || app.message || '').slice(0, 65)
                  return (
                    <button key={app.pageId} onClick={() => onNavigate('consultations', undefined, 'open', app.pageId)} style={{
                      display: 'flex', flexDirection: 'column', gap: '2px', padding: '9px 12px',
                      background: 'none', border: 'none', borderTop: i > 0 ? `1px solid ${C.border2}` : 'none',
                      cursor: 'pointer', textAlign: 'left', fontFamily: 'system-ui, sans-serif', width: '100%',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{app.name || '(unnamed)'}</span>
                        <span style={{ fontSize: '9px', color: statusColor, fontWeight: 700, flexShrink: 0 }}>{statusLabel}</span>
                      </div>
                      {app.location && <div style={{ fontSize: '10px', color: C.muted }}>{app.location}</div>}
                      {goal && <div style={{ fontSize: '10px', color: C.dim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{goal}{goal.length >= 65 ? '…' : ''}</div>}
                      <div style={{ fontSize: '9px', color: C.muted, marginTop: '1px' }}>{fmtDate(app.submittedAt)}</div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

        </div>
      </div>

      {needsReview.length === 0 && urgent.length === 0 && attention.length === 0 && totalNew === 0 && (
        <p style={{ color: C.muted, fontSize: '13px', marginTop: '4px' }}>All clear.</p>
      )}
    </div>
  )
}

// ── Business OS ───────────────────────────────────────────────

interface BosTaskRow {
  id: string; title: string; status: string; priority: string
  owner: string; created_at: string; updated_at: string
  approval_category: string; approval_note: string | null; blocked_reason: string | null
  depends_on: string[]; evidence: object[]; description: string | null
  outcome: string | null; human_approved_at: string | null
}
interface BosObjectiveRow {
  id: string; title: string; status: string; priority: string
}
interface BosRunRow {
  id: string; task_id: string; manager: string; status: string
  created_at: string; completed_at: string | null; result_summary: string | null
  trigger_type: string; error_detail: string | null; model_runtime: string | null
}
interface BosStateData {
  system_status: string; last_dispatch_at: string | null; last_ceo_run_at: string | null
  technical_task_count: number; human_approval_count: number
  open_task_count: number; in_progress_task_count: number
}

const BOS_PRIORITY_COLOR: Record<string, string> = { P0: C.red, P1: '#e07730', P2: C.gold, P3: C.muted }
const BOS_STATUS_COLOR: Record<string, string> = {
  open: C.blue, in_progress: C.gold, blocked: C.red,
  awaiting_human: '#e07730', done: C.green, cancelled: C.muted,
}
const BOS_OWNER_LABEL: Record<string, string> = {
  ceo: 'CEO', sales: 'Sales', marketing: 'Marketing', content: 'Content', technical: 'Technical',
}

function BosTaskCard({ task, onSelect, selected }: {
  task: BosTaskRow
  onSelect: (t: BosTaskRow) => void
  selected: boolean
}) {
  const ts = new Date(task.updated_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  return (
    <div onClick={() => onSelect(task)} style={{
      background: selected ? C.gold + '12' : C.card,
      border: `1px solid ${selected ? C.gold + '40' : C.border}`,
      borderRadius: '8px', padding: '12px 14px', marginBottom: '6px',
      cursor: 'pointer',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '10px', fontWeight: 700, color: BOS_PRIORITY_COLOR[task.priority] ?? C.muted, letterSpacing: '0.06em' }}>{task.priority}</span>
        <span style={{ fontSize: '10px', color: BOS_STATUS_COLOR[task.status] ?? C.muted, background: (BOS_STATUS_COLOR[task.status] ?? C.muted) + '18', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>{task.status.replace('_', ' ')}</span>
        <span style={{ fontSize: '10px', color: C.dim, background: C.surface, padding: '1px 6px', borderRadius: '4px' }}>{BOS_OWNER_LABEL[task.owner] ?? task.owner}</span>
        {task.approval_category !== 'none' && (
          <span style={{ fontSize: '10px', color: '#e07730', background: '#e0773018', padding: '1px 6px', borderRadius: '4px' }}>⚠ {task.approval_category}</span>
        )}
        <span style={{ fontSize: '10px', color: C.muted, marginLeft: 'auto' }}>{ts}</span>
      </div>
      <div style={{ marginTop: '6px', fontSize: '13px', color: C.text, fontWeight: 500 }}>{task.title}</div>
      {task.blocked_reason && (
        <div style={{ marginTop: '4px', fontSize: '11px', color: C.red }}>Blocked: {task.blocked_reason}</div>
      )}
    </div>
  )
}

function BosTaskDetail({ task, runs, onApproved }: { task: BosTaskRow; runs: BosRunRow[]; onApproved?: () => void }) {
  const taskRuns = runs.filter(r => r.task_id === task.id)
  const [approving, setApproving] = useState(false)
  const [approveErr, setApproveErr] = useState<string | null>(null)
  const [approved, setApproved] = useState(false)

  async function handleApprove() {
    setApproving(true); setApproveErr(null)
    try {
      const res = await fetch('/api/admin/bos/approve', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: task.id }),
      })
      const data = await res.json() as { ok: boolean; error?: string; unblocked_tasks?: string[] }
      if (!data.ok) { setApproveErr(data.error ?? 'Approval failed'); return }
      setApproved(true)
      setTimeout(() => onApproved?.(), 1200)
    } catch { setApproveErr('Network error') }
    finally { setApproving(false) }
  }

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '16px' }}>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
        <span style={{ fontSize: '10px', fontWeight: 700, color: BOS_PRIORITY_COLOR[task.priority] ?? C.muted }}>{task.priority}</span>
        <span style={{ fontSize: '10px', color: BOS_STATUS_COLOR[task.status] ?? C.muted }}>{task.status.replace('_', ' ')}</span>
        <span style={{ fontSize: '10px', color: C.dim }}>{BOS_OWNER_LABEL[task.owner] ?? task.owner}</span>
      </div>
      <div style={{ fontSize: '14px', fontWeight: 600, color: C.text, marginBottom: '8px' }}>{task.title}</div>
      {task.description && <p style={{ fontSize: '12px', color: C.dim, margin: '0 0 10px' }}>{task.description}</p>}
      {task.approval_note && (
        <div style={{ background: '#e0773012', border: '1px solid #e0773040', borderRadius: '6px', padding: '10px 12px', marginBottom: '12px' }}>
          <div style={{ fontSize: '10px', color: '#e07730', fontWeight: 700, marginBottom: '4px' }}>⚠ Requires Approval</div>
          <div style={{ fontSize: '12px', color: C.text }}>{task.approval_note}</div>
        </div>
      )}
      {task.status === 'awaiting_human' && (
        <div style={{ marginBottom: '14px' }}>
          {approved
            ? <div style={{ color: C.green, fontSize: '12px', fontWeight: 600 }}>✓ Approved — task continued</div>
            : <>
                <button onClick={handleApprove} disabled={approving}
                  style={{ ...btn('primary'), fontSize: '12px', padding: '7px 16px' }}>
                  {approving ? 'Approving…' : '✓ Approve & Continue'}
                </button>
                {approveErr && <span style={{ marginLeft: '10px', color: C.red, fontSize: '12px' }}>{approveErr}</span>}
              </>
          }
        </div>
      )}
      {(task.evidence as Array<{ timestamp: string; description: string; type: string }>).length > 0 && (
        <div>
          <div style={{ fontSize: '10px', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Evidence</div>
          {(task.evidence as Array<{ timestamp: string; description: string; type: string }>).map((e, i) => (
            <div key={i} style={{ fontSize: '11px', color: C.dim, padding: '4px 0', borderBottom: `1px solid ${C.border2}` }}>
              <span style={{ color: C.muted, marginRight: '8px' }}>{new Date(e.timestamp).toLocaleDateString()}</span>
              {e.description}
            </div>
          ))}
        </div>
      )}
      {taskRuns.length > 0 && (
        <div style={{ marginTop: '12px' }}>
          <div style={{ fontSize: '10px', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Agent Runs</div>
          {taskRuns.map(r => (
            <div key={r.id} style={{ fontSize: '11px', padding: '4px 0', borderBottom: `1px solid ${C.border2}` }}>
              <span style={{ color: BOS_STATUS_COLOR[r.status] ?? C.muted, marginRight: '8px' }}>{r.status}</span>
              <span style={{ color: C.dim, marginRight: '8px' }}>{new Date(r.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              {r.result_summary && <span style={{ color: C.text }}>{r.result_summary}</span>}
              {r.error_detail && <span style={{ color: C.red }}>{r.error_detail}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function BusinessOS() {
  const [tasks,     setTasks]     = useState<BosTaskRow[]>([])
  const [objectives, setObjectives] = useState<BosObjectiveRow[]>([])
  const [runs,      setRuns]      = useState<BosRunRow[]>([])
  const [state,     setState]     = useState<BosStateData | null>(null)
  const [selected,  setSelected]  = useState<BosTaskRow | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [err,       setErr]       = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'all' | 'open' | 'approval' | 'done' | 'runs'>('open')

  const load = useCallback(async () => {
    try {
      const [tasksRes, stateRes, runsRes] = await Promise.all([
        fetch('/api/admin/bos/tasks'),
        fetch('/api/admin/bos/state'),
        fetch('/api/admin/bos/runs'),
      ])
      if (tasksRes.status === 401 || stateRes.status === 401) {
        setErr('Unauthorized'); return
      }
      if (tasksRes.ok) {
        const d = await tasksRes.json() as { tasks: BosTaskRow[]; objectives: BosObjectiveRow[] }
        setTasks(d.tasks); setObjectives(d.objectives)
      }
      if (stateRes.ok) setState(await stateRes.json() as BosStateData)
      if (runsRes.ok) {
        const d = await runsRes.json() as { runs: BosRunRow[] }
        setRuns(d.runs)
      }
    } catch { setErr('Load failed') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  const filteredTasks = tasks.filter(t => {
    if (activeTab === 'open')     return t.status === 'open' || t.status === 'in_progress'
    if (activeTab === 'approval') return t.status === 'awaiting_human'
    if (activeTab === 'done')     return t.status === 'done' || t.status === 'cancelled'
    return true
  })

  const tabBtn = (id: typeof activeTab, label: string, count?: number) => (
    <button key={id} onClick={() => setActiveTab(id)} style={{
      padding: '6px 12px', fontSize: '11px', fontWeight: activeTab === id ? 700 : 400,
      background: activeTab === id ? C.gold + '20' : 'transparent',
      color: activeTab === id ? C.gold : C.dim,
      border: 'none', borderBottom: `2px solid ${activeTab === id ? C.gold : 'transparent'}`,
      cursor: 'pointer', fontFamily: 'system-ui, sans-serif',
    }}>
      {label}{count !== undefined && count > 0 ? ` (${count})` : ''}
    </button>
  )

  if (loading) return <p style={{ color: C.muted }}>Loading Business OS…</p>

  return (
    <div>
      <h1 style={{ ...S.sectionHead, marginTop: 0 }}>Business OS</h1>

      {/* State badges */}
      {state && (
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' }}>
          {state.human_approval_count > 0 && (
            <div style={{ background: '#e0773018', border: '1px solid #e0773040', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', color: '#e07730', fontWeight: 600 }}>
              🔔 {state.human_approval_count} awaiting approval
            </div>
          )}
          {state.technical_task_count > 0 && (
            <div style={{ background: C.blue + '18', border: `1px solid ${C.blue}40`, borderRadius: '6px', padding: '6px 12px', fontSize: '12px', color: C.blue, fontWeight: 600 }}>
              ⚡ {state.technical_task_count} technical tasks ready
            </div>
          )}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '6px', padding: '6px 12px', fontSize: '11px', color: C.muted }}>
            Open: {state.open_task_count} · In progress: {state.in_progress_task_count}
          </div>
          {state.last_ceo_run_at && (
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '6px', padding: '6px 12px', fontSize: '11px', color: C.muted }}>
              CEO last run: {new Date(state.last_ceo_run_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
          <button onClick={() => void load()} style={{ ...btn('ghost'), fontSize: '11px', marginLeft: 'auto' }}>↻ Refresh</button>
        </div>
      )}

      {/* Objectives */}
      {objectives.length > 0 && (
        <div style={{ marginBottom: '16px', padding: '10px 14px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: '8px' }}>
          <div style={{ fontSize: '10px', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Active Objectives</div>
          {objectives.filter(o => o.status === 'active').map(o => (
            <div key={o.id} style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '4px 0' }}>
              <span style={{ fontSize: '10px', fontWeight: 700, color: BOS_PRIORITY_COLOR[o.priority] ?? C.muted }}>{o.priority}</span>
              <span style={{ fontSize: '13px', color: C.text }}>{o.title}</span>
            </div>
          ))}
        </div>
      )}

      {err && <p style={{ color: C.red }}>{err}</p>}

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, marginBottom: '14px', gap: '0' }}>
        {tabBtn('open',     'Active',     tasks.filter(t => t.status === 'open' || t.status === 'in_progress').length)}
        {tabBtn('approval', 'Needs Approval', state?.human_approval_count)}
        {tabBtn('all',      'All Tasks')}
        {tabBtn('done',     'Done')}
        {tabBtn('runs',     'Agent Runs', runs.filter(r => r.status === 'running').length)}
      </div>

      {/* Task list + detail */}
      {activeTab !== 'runs' && (
        <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 1fr' : '1fr', gap: '12px' }}>
          <div>
            {filteredTasks.length === 0 && <p style={{ color: C.muted, fontSize: '13px' }}>No tasks in this view.</p>}
            {filteredTasks.map(t => (
              <BosTaskCard key={t.id} task={t} selected={selected?.id === t.id} onSelect={t2 => setSelected(t2.id === selected?.id ? null : t2)} />
            ))}
          </div>
          {selected && (
            <div>
              <BosTaskDetail task={selected} runs={runs} onApproved={() => { void load(); setSelected(null) }} />
            </div>
          )}
        </div>
      )}

      {/* Agent runs log */}
      {activeTab === 'runs' && (
        <div>
          {runs.length === 0 && <p style={{ color: C.muted, fontSize: '13px' }}>No agent runs yet.</p>}
          {runs.map(r => {
            const matchTask = tasks.find(t => t.id === r.task_id)
            return (
              <div key={r.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '10px 14px', marginBottom: '6px' }}>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: '10px', color: BOS_STATUS_COLOR[r.status] ?? C.muted, fontWeight: 600 }}>{r.status}</span>
                  <span style={{ fontSize: '10px', color: C.dim }}>{BOS_OWNER_LABEL[r.manager] ?? r.manager}</span>
                  <span style={{ fontSize: '10px', color: C.muted }}>{new Date(r.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  {r.model_runtime && <span style={{ fontSize: '10px', color: C.muted }}>{r.model_runtime}</span>}
                </div>
                {matchTask && <div style={{ marginTop: '4px', fontSize: '12px', color: C.dim }}>{matchTask.title}</div>}
                {r.result_summary && <div style={{ marginTop: '4px', fontSize: '12px', color: C.text }}>{r.result_summary}</div>}
                {r.error_detail && <div style={{ marginTop: '4px', fontSize: '12px', color: C.red }}>{r.error_detail}</div>}
              </div>
            )
          })}
        </div>
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
  { id: 'bos',           label: 'Business OS' },
]

function AdminShell({ onLogout }: { onLogout: () => void }) {
  const [active,           setActive]          = useState<Section>('overview')
  const [drawerOpen,       setDrawerOpen]       = useState(false)
  const [isMobile,         setIsMobile]         = useState(false)
  const [dmInitialSender,  setDmInitialSender]  = useState<string | undefined>(undefined)
  const [consInitialTab,   setConsInitialTab]   = useState<ConsTab | undefined>(undefined)
  const [consInitialAppId, setConsInitialAppId] = useState<string | undefined>(undefined)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    setIsMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  function navigate(id: Section) { setActive(id); setDrawerOpen(false) }

  function navigateFromOverview(section: Section, senderId?: string, consTab?: ConsTab, appId?: string) {
    setDmInitialSender(section === 'dm' ? senderId : undefined)
    setConsInitialTab(section === 'consultations' ? consTab : undefined)
    setConsInitialAppId(section === 'consultations' ? appId : undefined)
    setActive(section)
    setDrawerOpen(false)
  }

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
          {active === 'overview'      && <><h1 style={{ ...S.sectionHead, marginTop: 0 }}>Overview</h1><Overview onNavigate={(s, sid, ct, aid) => navigateFromOverview(s, sid, ct, aid)} /></>}
          {active === 'dm'            && <><h1 style={{ ...S.sectionHead, marginTop: 0 }}>DM Inbox</h1><DmInbox key={dmInitialSender ?? 'default'} initialSenderId={dmInitialSender} /></>}
          {active === 'consultations' && <><h1 style={{ ...S.sectionHead, marginTop: 0 }}>Consultations</h1><Consultations key={(consInitialTab ?? 'default') + (consInitialAppId ?? '')} initialTab={consInitialTab} initialAppId={consInitialAppId} /></>}
          {active === 'access'        && <><h1 style={{ ...S.sectionHead, marginTop: 0 }}>Access Control ({' '})</h1><DmAccessControl /></>}
          {active === 'feedback'      && <><h1 style={{ ...S.sectionHead, marginTop: 0 }}>DM Feedback</h1><DmFeedback /></>}
          {active === 'bos'           && <BusinessOS />}
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
