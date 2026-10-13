# n8n Contact Notes Patch

## Gap

n8n fires the Anthropic Routine directly. It does not currently fetch
`dm_contact_notes` before building the trigger payload, so ordinary
n8n-triggered drafts do NOT receive persisted contact notes.

Admin-initiated regeneration (retry-draft) DOES include notes because the
admin UI reads them and passes them in the request body.

## Fix: add one HTTP Request node before "Fire Routine"

Insert an HTTP Request node called **"Fetch Contact Notes"** after
"Set DRAFT_GENERATING" and before "Build Routine Payload":

| Field | Value |
|-------|-------|
| Method | GET |
| URL | `={{ $env.SUPABASE_URL }}/rest/v1/dm_contact_notes?sender_id=eq.{{ $('Set DRAFT_GENERATING').item.json.sender_id }}&ig_account_id=eq.default&select=notes` |
| Header: `apikey` | `={{ $env.SUPABASE_SERVICE_ROLE_KEY }}` |
| Header: `Authorization` | `=Bearer {{ $env.SUPABASE_SERVICE_ROLE_KEY }}` |
| Continue On Fail | true |
| Response Format | JSON |

Then in the **Build Routine Payload** JavaScript node, add:

```javascript
// contact_notes from dm_contact_notes (empty string if no row or fetch failed)
const contactNotesRows = $('Fetch Contact Notes').all()
const contactNotes = (contactNotesRows?.[0]?.json?.notes ?? '').trim()

// ... existing payload build ...

const triggerPayload = {
  // ... all existing fields ...
}

// Only include if non-empty (Routine ignores absent fields)
if (contactNotes) triggerPayload.contact_notes = contactNotes

return [{ json: { text: JSON.stringify(triggerPayload) } }]
```

## Why this is safe

- The HTTP Request node has `continueOnFail=true` so a missing table or
  network error does not block draft generation.
- An empty / missing notes row simply omits `contact_notes` from the payload
  (same as before this patch — the Routine handles its absence gracefully).
- The `ig_account_id=eq.default` filter matches the single-account production setup.
  If a second account is ever added, the filter must be updated to use the
  buffer row's `ig_account_id`.

## Verification (safe synthetic test, no customer sends)

1. In Supabase SQL editor run:
   ```sql
   INSERT INTO dm_contact_notes (ig_account_id, sender_id, notes)
   VALUES ('default', 'TEST_SENDER_SYNTHETIC', 'Test note: synthetic fixture only.')
   ON CONFLICT (ig_account_id, sender_id) DO UPDATE SET notes = EXCLUDED.notes;
   ```
2. Insert a synthetic buffer row for `TEST_SENDER_SYNTHETIC` in `instagram_dm_buffer`
   with `processed=false, processing=false, response_sent=false`.
3. Watch n8n execute — in the "Build Routine Payload" node output, confirm
   `contact_notes` appears in the fired payload.
4. Delete the synthetic rows after verification:
   ```sql
   DELETE FROM dm_contact_notes WHERE sender_id = 'TEST_SENDER_SYNTHETIC';
   DELETE FROM instagram_dm_buffer WHERE sender_id = 'TEST_SENDER_SYNTHETIC';
   ```
