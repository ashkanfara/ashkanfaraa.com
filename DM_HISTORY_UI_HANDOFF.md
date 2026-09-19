# DM Outbound History UI — Handoff for Website Claude

## Goal

Implement three tabs in the admin Review Center:

```
Review | Sent | Generated / Failed
```

The current implementation only has the `Review` tab (PENDING_REVIEW items). This document specifies the data model, available API surfaces, and exact UI requirements for the two new tabs.

---

## Tab: Sent

**Purpose:** Truthful record of messages that reached Instagram with a confirmed `message_id`.

### Data source

`dm_response_feedback` table in Supabase (authoritative outbound history).

**Pre-existing columns (always available):**
| Column | Type | Description |
|---|---|---|
| `id` | uuid | Row PK |
| `created_at` | timestamptz | When the feedback row was created |
| `buffer_id` | uuid | FK → `instagram_dm_buffer.id` |
| `sender_id` | text | Instagram user ID of recipient |
| `original_draft` | text | AI-generated draft before editing |
| `final_sent_response` | text | Exact text sent to Instagram |
| `draft_source` | text | `'ai'` or `'manual'` |
| `was_edited` | boolean | Whether admin modified the AI draft |
| `feedback_rating` | text | Thumbs up/down etc. (nullable) |
| `feedback_category` | text | Tag for the rating (nullable) |
| `feedback_note` | text | Free-text note (nullable) |
| `inbound_context` | text | Bundle of inbound messages that prompted the reply |

**Forensic columns (available after `DM_OUTBOUND_HISTORY_MIGRATION.sql` is applied):**
| Column | Type | Description |
|---|---|---|
| `ig_message_id` | text | Meta-returned message_id — non-null = confirmed send |
| `ig_http_status` | smallint | HTTP status from Meta API |
| `approval_ts` | timestamptz | When human clicked Approve & Send |
| `send_attempt_ts` | timestamptz | When the IG API call was made |
| `send_state` | text | `SENT` / `SEND_FAILED` / `SEND_STATUS_UNKNOWN` |
| `is_first_reply` | boolean | True if this was first-ever reply to this sender |

**Also available on `instagram_dm_buffer`** (join by `buffer_id`):
| Column | Purpose |
|---|---|
| `ig_message_id` | Same message_id stored on the buffer row |
| `response_sent_at` | When the send was recorded (surrogate for send time before forensic columns exist) |
| `sending_started_at` | When the claim/approve lock was taken |
| `sender_id` | Recipient IGSID |

### Query for Sent tab

Filter `dm_response_feedback` where `send_state = 'SENT'` **or** (pre-migration fallback) join `instagram_dm_buffer` where `failed_reason = 'SENT' AND response_sent = true`.

Recommended approach — call a new API route `/api/admin/dm-outbound-history?tab=sent` (see API section below).

### Display columns

| Field | Label | Source |
|---|---|---|
| Recipient | sender_id → display name lookup in `instagram_users` | `dm_response_feedback.sender_id` |
| Sent text | Final sent message | `final_sent_response` |
| Send time | Human-readable | `send_attempt_ts` (preferred) or `ig_message_id`-joined `response_sent_at` |
| Meta message ID | For reconciliation | `ig_message_id` — show first 12 chars + copy button |
| Status | Always "Sent (confirmed)" — only SENT rows shown here | `send_state` |
| Edited? | `was_edited` | `was_edited` badge |

**Do not show `SEND_FAILED` or `SEND_STATUS_UNKNOWN` rows in the Sent tab.** Those belong in Generated / Failed.

---

## Tab: Generated / Failed

**Purpose:** Audit trail and training data. Includes AI drafts that were ignored, generation failures, and send failures.

### Data sources

Two overlapping data sources must be merged:

**1. `instagram_dm_buffer`** — includes all outcomes:
- `failed_reason = 'IGNORED_BY_HUMAN'` — human clicked Ignore
- `failed_reason = 'AI_RECOMMENDED_IGNORE'` — AI suggested ignoring
- `failed_reason = 'DRAFT_FAILED'` — AI generation failed
- `failed_reason = 'SEND_FAILED'` — Meta definitively rejected
- `failed_reason = 'SEND_STATUS_UNKNOWN'` — outcome uncertain (potential double-send risk; flag clearly)
- `failed_reason = 'SUPERSEDED'` — newer message arrived, draft voided
- `failed_reason = 'REJECTED'` — blocked sender flow

**2. `dm_response_feedback`** — has actual final text and full context for approved (sent + failed) rows.

### Display columns

| Field | Label | Notes |
|---|---|---|
| Recipient | `sender_id` display name | |
| Draft text | AI draft | `response_text` from buffer (or `original_draft` from feedback) |
| Outcome | Reason badge | Color-coded: Ignored (grey), Send Failed (orange), Status Unknown (red), Superseded (grey), Draft Failed (red) |
| Time | `created_at` of buffer row | |
| Source | `draft_source` | `ai` / `manual` |

**SEND_STATUS_UNKNOWN rows must be flagged prominently** — they mean "message may or may not have been delivered; do not resend without manual Instagram verification."

---

## API Routes

### Existing routes (already implemented)

- `GET /api/admin/dm-inbox` — returns `{ items, history }` for the Review tab
  - `items`: PENDING_REVIEW items with `canSend` and `windowExpiresAt`
  - `history`: recent completed items (limited)

- `POST /api/admin/dm-inbox/send` — approve and send a single item

- `POST /api/admin/dm-inbox` with `action: 'ignore' | 'bulk_ignore' | ...` — state mutations

### New route needed: `/api/admin/dm-outbound-history`

Build this route at `src/app/api/admin/dm-outbound-history/route.ts`.

**GET params:**
- `?tab=sent` — returns `dm_response_feedback` filtered to `send_state = 'SENT'` (or fallback join)
- `?tab=failed` — returns buffer rows with final terminal failure states
- `?limit=50&offset=0` — pagination

**Auth:** same `requireAdminSession` guard used by all admin routes.

**Supabase helpers to add in `src/lib/supabase.ts`:**

```typescript
// For Sent tab
export async function getOutboundSent(limit = 50, offset = 0): Promise<SentRecord[]>

// For Generated/Failed tab  
export async function getOutboundFailed(limit = 50, offset = 0): Promise<FailedRecord[]>
```

---

## State machine reference

```
PENDING_REVIEW → SENDING → SENT            ← Confirmed send (message_id returned)
                         → SEND_FAILED     ← Meta 4xx/5xx before acceptance
                         → SEND_STATUS_UNKNOWN  ← Outcome uncertain; NON-RESENDABLE
PENDING_REVIEW → IGNORED_BY_HUMAN
PENDING_REVIEW → AI_RECOMMENDED_IGNORE
PENDING_REVIEW → DRAFT_GENERATING → PENDING_REVIEW (with draft)
                                  → DRAFT_FAILED
PENDING_REVIEW → SUPERSEDED       (newer message arrived)
```

---

## Important constraints

1. **`SENT` means Meta returned a non-empty `message_id`.** Sub-states: `META_ACCEPTED` (message_id exists, no read signal) and `READ` (matching row in `dm_read_signals`). There is no `DELIVERED` state — Meta does not send delivery events for Instagram. The UI must not say "delivered."

2. **`SEND_STATUS_UNKNOWN` is non-resendable.** Do not show a retry button for these rows. Show a warning: "Outcome uncertain — check Instagram outbox before taking any action."

3. **No bulk Approve & Send.** Individual human approval is required for each send. Bulk Ignore is safe (already implemented).

4. **`ig_message_id` is the ground truth** for whether a send was confirmed. If it's null on a SENT row (should not happen after the strengthened contract), that row is suspect and should be flagged.

---

## Read signal capture — IMPLEMENTED

### dm_read_signals table

```sql
-- One row per (sender_id, ig_message_id) — UNIQUE constraint prevents duplicate ingestion
CREATE TABLE dm_read_signals (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at    timestamptz DEFAULT now() NOT NULL,   -- our ingestion timestamp
  sender_id     text        NOT NULL,                 -- Instagram IGSID of the reader
  ig_message_id text        NOT NULL,                 -- = read.mid from Meta webhook = our outbound message_id
  read_at       timestamptz NOT NULL,                 -- Meta's own timestamp for the read event
  CONSTRAINT dm_read_signals_sender_msg_unique UNIQUE (sender_id, ig_message_id)
);
```

### Join query to identify READ messages

```sql
SELECT
  b.id           AS buffer_id,
  b.sender_id,
  b.ig_message_id,
  b.response_sent_at,
  r.read_at,
  CASE WHEN r.id IS NOT NULL THEN 'READ' ELSE 'META_ACCEPTED' END AS read_state
FROM instagram_dm_buffer b
LEFT JOIN dm_read_signals r ON r.ig_message_id = b.ig_message_id
WHERE b.failed_reason = 'SENT'
ORDER BY b.response_sent_at DESC;
```

### State model for Sent tab

| State | Condition | Label |
|---|---|---|
| `READ` | `dm_read_signals` row exists with matching `ig_message_id` | "Read" |
| `META_ACCEPTED` | `ig_message_id` IS NOT NULL but no matching read signal | "Sent (confirmed)" |
| *(not used)* | — | No "Delivered" state — Meta does not send delivery events for Instagram |

**Semantics of READ:** Meta's read.mid represents "read up to and including this message." All earlier messages in the conversation are implicitly read. Do NOT fabricate individual read signals for earlier messages.

### Verified join (historical record)

- Buffer row `85141ccc-7fb6-4f22-8a3a-201aece05b8b` sent at `2026-09-16T00:55:04.929Z`
- Read signal: sender `900845893037025` read at `2026-09-16T01:03:14.029Z`
- Join on `ig_message_id` = confirmed match → READ state

### n8n webhook branch (in My workflow 2)

Two new nodes appended to the IF1 FALSE output:
1. **If - Is Read Event?** — condition: `!!$json.body.entry?.[0]?.messaging?.[0]?.read`
2. **Save Read Signal** — POST to `dm_read_signals` with upsert (`Prefer: resolution=ignore-duplicates`)

Existing inbound message path (IF1 TRUE) is unchanged.

> **⚠️ n8n reload pending:** The two new nodes are in the SQLite DB (versionId `ca5a3325`) but n8n must reload the workflow to activate them. Run as admin:
> ```
> net stop n8n && net start n8n
> ```
> After reload, send a synthetic read-event POST to `http://localhost:5678/webhook/instagram-webhook` and verify a row appears in `dm_read_signals`.

### Delivery signals — still not available

Meta does not send `messaging_deliveries` events for Instagram. There is no delivery confirmation signal. Do not add a "Delivered" status to the UI.

---

## Migration dependency

`DM_OUTBOUND_HISTORY_MIGRATION.sql` must be applied in Supabase SQL editor before forensic columns (`ig_message_id`, `approval_ts`, `send_attempt_ts`, `send_state`, `is_first_reply`) are populated in `dm_response_feedback`. The production code as of commit `a3b1665` writes these columns in a fire-and-forget PATCH after the migration is applied — it is safe to deploy the UI before or after the migration.

**Pre-migration fallback:** For the Sent tab, join `dm_response_feedback` with `instagram_dm_buffer` on `buffer_id` and use `buffer.ig_message_id` and `buffer.response_sent_at` as the confirmation signal.
