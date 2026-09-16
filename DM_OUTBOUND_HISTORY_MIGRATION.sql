-- DM Outbound History & Forensic Audit Migration
-- Run in Supabase SQL editor.
--
-- Adds forensic columns to instagram_dm_buffer so every Meta API response
-- can be permanently audited without relying on ephemeral Vercel logs.
--
-- Also enriches dm_response_feedback to serve as the authoritative
-- outbound/generated-message history view.

-- ── instagram_dm_buffer: forensic Meta response columns ──────────────────────

-- HTTP status code returned by Meta (200, 400, 403, 500, etc.)
ALTER TABLE instagram_dm_buffer
  ADD COLUMN IF NOT EXISTS ig_http_status   smallint    DEFAULT NULL;

-- Truncated raw response body from Meta (max 2KB for storage efficiency)
ALTER TABLE instagram_dm_buffer
  ADD COLUMN IF NOT EXISTS ig_response_body text        DEFAULT NULL;

-- True if this was the first-ever outbound message to this sender (Message Request indicator)
ALTER TABLE instagram_dm_buffer
  ADD COLUMN IF NOT EXISTS is_first_reply   boolean     DEFAULT NULL;

-- ── dm_response_feedback: outbound history enrichment ────────────────────────
-- This table is now the authoritative outbound/generated-message history.
-- It already has: buffer_id, sender_id, original_draft, final_sent_response,
-- draft_source, was_edited, feedback_rating, feedback_category, feedback_note.
-- Adding the remaining fields for full traceability.

-- Instagram message ID from Meta API response
ALTER TABLE dm_response_feedback
  ADD COLUMN IF NOT EXISTS ig_message_id    text        DEFAULT NULL;

-- Meta HTTP status at the time of send
ALTER TABLE dm_response_feedback
  ADD COLUMN IF NOT EXISTS ig_http_status   smallint    DEFAULT NULL;

-- When the human clicked Approve (= claimDmForSend timestamp)
ALTER TABLE dm_response_feedback
  ADD COLUMN IF NOT EXISTS approval_ts      timestamptz DEFAULT NULL;

-- When the Instagram API call was made
ALTER TABLE dm_response_feedback
  ADD COLUMN IF NOT EXISTS send_attempt_ts  timestamptz DEFAULT NULL;

-- Final send state (SENT, SEND_FAILED, SEND_STATUS_UNKNOWN)
ALTER TABLE dm_response_feedback
  ADD COLUMN IF NOT EXISTS send_state       text        DEFAULT NULL;

-- True if this was the first reply to this sender
ALTER TABLE dm_response_feedback
  ADD COLUMN IF NOT EXISTS is_first_reply   boolean     DEFAULT NULL;

-- ── Indexes for outbound history queries ─────────────────────────────────────

-- Index for querying by sender (outbound history per conversation)
CREATE INDEX IF NOT EXISTS idx_dm_feedback_sender_id
  ON dm_response_feedback (sender_id, created_at DESC);

-- Index for querying SENT rows with message_id (for reconciliation)
CREATE INDEX IF NOT EXISTS idx_dm_buffer_ig_message_id
  ON instagram_dm_buffer (ig_message_id)
  WHERE ig_message_id IS NOT NULL;

-- ── Comments for documentation ────────────────────────────────────────────────

COMMENT ON COLUMN instagram_dm_buffer.ig_http_status IS
  'HTTP status code returned by Meta Messaging API. 200 = accepted by infrastructure. Non-2xx = rejected.';
COMMENT ON COLUMN instagram_dm_buffer.ig_response_body IS
  'Truncated (≤2KB) raw JSON body from Meta Messaging API response. Stored for forensic audit.';
COMMENT ON COLUMN instagram_dm_buffer.is_first_reply IS
  'True if this send was the first-ever outbound to this sender (Message Request conversation indicator).';

COMMENT ON COLUMN dm_response_feedback.ig_message_id IS
  'Instagram message_id returned by Meta API. Non-null only for confirmed sends.';
COMMENT ON COLUMN dm_response_feedback.ig_http_status IS
  'HTTP status code from Meta API at send time. Populated for all send attempts.';
COMMENT ON COLUMN dm_response_feedback.approval_ts IS
  'Timestamp when human clicked Approve & Send (= sending_started_at from instagram_dm_buffer).';
COMMENT ON COLUMN dm_response_feedback.send_attempt_ts IS
  'Timestamp of the actual Instagram API POST call.';
COMMENT ON COLUMN dm_response_feedback.send_state IS
  'Final outcome state: SENT, SEND_FAILED, SEND_STATUS_UNKNOWN, EXPIRED, REJECTED.';
COMMENT ON COLUMN dm_response_feedback.is_first_reply IS
  'True if this was the first reply to this sender (Message Request conversation).';
