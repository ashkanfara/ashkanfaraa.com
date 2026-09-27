-- DM Auto-Mode Enrollment Table
-- Apply in Supabase SQL editor once.
--
-- Tracks per-sender automatic response enrollment.
-- A sender is enrolled when their conversation history (not a single message)
-- clearly signals migration interest, occupation-related migration queries,
-- course interest, or consultation interest.
--
-- Enrollment expires 48h from the latest authentic inbound message timestamp.
-- Out-of-order events cannot move expires_at backward.
-- Scoped to (sender_id, ig_account_id) so multi-account setups stay isolated.

CREATE TABLE IF NOT EXISTS dm_auto_mode (
  sender_id         text        NOT NULL,
  ig_account_id     text        NOT NULL DEFAULT 'default',
  enrolled_reason   text        NOT NULL,            -- MIGRATION_INTEREST | COURSE_INQUIRY | CONSULTATION_INQUIRY
  enrolled_at       timestamptz NOT NULL DEFAULT now(),
  expires_at        timestamptz NOT NULL,            -- max(current, inbound_ts + 48h); never moved backward
  last_inbound_id   text        NOT NULL DEFAULT '', -- for webhook deduplication
  last_inbound_ts   timestamptz NOT NULL,            -- out-of-order guard: only update if new_ts >= this
  conversation_score int         NOT NULL DEFAULT 0, -- 0-100 signal confidence at enrollment time
  updated_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (sender_id, ig_account_id)
);

-- Fast expiry check
CREATE INDEX IF NOT EXISTS dm_auto_mode_expires_idx  ON dm_auto_mode (expires_at);
-- Fast per-sender lookup
CREATE INDEX IF NOT EXISTS dm_auto_mode_sender_idx   ON dm_auto_mode (sender_id);
