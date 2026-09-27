-- DM Auto-Mode Enrollment Table
-- Apply in Supabase SQL editor once.
-- Project: bxvbyqauwpguzimfmwot (ashkanfaraa.com)
--
-- Tracks per-sender automatic response enrollment.
-- A sender is enrolled when the Claude Routine LLM classifies their conversation
-- as a clear MIGRATION_LEAD, COURSE_LEAD, or CONSULTATION_LEAD.
--
-- Enrollment expires 48h from the latest authentic inbound message timestamp.
-- Out-of-order events cannot move expires_at backward.
-- Scoped to (sender_id, ig_account_id) for multi-account isolation.
--
-- SECURITY: RLS is enabled; only service_role (server) may read or write.
-- anon and authenticated roles receive no access — fail-closed by default.

CREATE TABLE IF NOT EXISTS dm_auto_mode (
  sender_id         text        NOT NULL,
  ig_account_id     text        NOT NULL DEFAULT 'default',
  enrolled_reason   text        NOT NULL,            -- MIGRATION_INTEREST | COURSE_INQUIRY | CONSULTATION_INQUIRY
  enrolled_at       timestamptz NOT NULL DEFAULT now(),
  expires_at        timestamptz NOT NULL,            -- max(current, inbound_ts + 48h); never moved backward
  last_inbound_id   text        NOT NULL DEFAULT '', -- webhook deduplication key
  last_inbound_ts   timestamptz NOT NULL,            -- out-of-order guard: only update if new_ts >= this
  conversation_score int         NOT NULL DEFAULT 0, -- LLM classification confidence (0-100 scale)
  updated_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (sender_id, ig_account_id)
);

-- Fast expiry check
CREATE INDEX IF NOT EXISTS dm_auto_mode_expires_idx ON dm_auto_mode (expires_at);
-- Fast per-sender lookup
CREATE INDEX IF NOT EXISTS dm_auto_mode_sender_idx  ON dm_auto_mode (sender_id);

-- ── Row Level Security ──────────────────────────────────────────────────────
-- Enable RLS — service_role bypasses RLS automatically (Supabase default).
-- No policies are created for anon or authenticated: all non-service access is denied.
-- This table controls sending authority; fail-closed is the correct default.
ALTER TABLE dm_auto_mode ENABLE ROW LEVEL SECURITY;

-- Verify RLS is active (run separately if needed):
-- SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'dm_auto_mode';
