-- Migration: dm_contact_notes
-- Project: bxvbyqauwpguzimfmwot
-- Purpose: per-contact private notes for DM review context (admin only)
-- Apply in: supabase.com/dashboard/project/bxvbyqauwpguzimfmwot/sql/new

BEGIN;

CREATE TABLE IF NOT EXISTS dm_contact_notes (
  ig_account_id  text        NOT NULL DEFAULT 'default',
  sender_id      text        NOT NULL,
  notes          text        NOT NULL DEFAULT '',
  updated_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ig_account_id, sender_id)
);

CREATE INDEX IF NOT EXISTS dm_contact_notes_sender_idx ON dm_contact_notes (sender_id);

-- Fail-closed: service role (server-side only) bypasses RLS.
-- Anon and authenticated roles are denied all access.
ALTER TABLE dm_contact_notes ENABLE ROW LEVEL SECURITY;

COMMIT;
