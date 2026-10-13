-- Migration: add admin_regen flag to instagram_dm_buffer
-- Safe additive: DEFAULT false means zero data changes on existing rows.
-- Purpose: when retry-draft claims a row for admin-initiated regeneration,
--          it sets admin_regen=true. dm-draft-callback reads this flag and
--          skips the auto-send path regardless of Routine classification,
--          preserving the invariant: no auto-send on admin regen.
--
-- Apply in Supabase SQL editor:
--   https://supabase.com/dashboard/project/bxvbyqauwpguzimfmwot/sql/new

BEGIN;

ALTER TABLE instagram_dm_buffer
  ADD COLUMN IF NOT EXISTS admin_regen boolean NOT NULL DEFAULT false;

-- Reset admin_regen to false when a row re-enters normal n8n processing
-- (i.e. when processed=false is set by requeueDm). This is handled in application
-- code; no trigger needed. The column auto-resets because retry-draft never sets
-- admin_regen on n8n-path rows, and the PATCH used by n8n's SDG node does not
-- touch admin_regen (Postgres ignores absent columns in PATCH body).

COMMENT ON COLUMN instagram_dm_buffer.admin_regen IS
  'True when this DRAFT_GENERATING row was claimed by admin retry-draft. '
  'dm-draft-callback skips auto-send for these rows; human review is required.';

COMMIT;
