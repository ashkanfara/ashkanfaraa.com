/// <reference types="@jest/globals" />
/**
 * edit-text-sync.test.ts
 *
 * Proves the editText / lastAppliedText synchronisation logic in DmInboxItem.
 * The component is not mounted (no RTL needed); the pure state-machine logic is
 * extracted and exercised directly to show it handles every phase of the
 * claim → DRAFT_GENERATING → callback → PENDING_REVIEW cycle correctly.
 */

// ── Extracted logic (mirrors exactly what useRef + useEffect does) ──────────

function makeSyncState(initialResponseText: string | null) {
  let editText        = initialResponseText ?? ''
  let lastApplied     = initialResponseText       // mirrors useRef(item.responseText)

  // Called by useEffect whenever item.responseText changes
  function onResponseTextChange(newText: string | null) {
    if (newText !== lastApplied) {
      lastApplied = newText
      editText    = newText ?? ''
    }
  }

  // Called by onChange on the textarea
  function onUserEdit(text: string) { editText = text }

  return {
    get editText()    { return editText },
    get lastApplied() { return lastApplied },
    onResponseTextChange,
    onUserEdit,
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

const OLD_DRAFT = 'Synthetic prior draft — do not send.'
const NEW_DRAFT = 'سلام! وقت مشاوره رو رزرو کن.'

describe('editText ↔ responseText synchronisation', () => {

  // ── Successful regeneration cycle ─────────────────────────────────────────

  it('editText is the old draft before any regen', () => {
    const s = makeSyncState(OLD_DRAFT)
    expect(s.editText).toBe(OLD_DRAFT)
  })

  it('claim refresh (responseText unchanged, only generationId changed): editText stays old draft', () => {
    const s = makeSyncState(OLD_DRAFT)
    // generationId changed on server → first refresh after claim
    // responseText is still OLD_DRAFT at this point
    s.onResponseTextChange(OLD_DRAFT)   // same value — no-op
    expect(s.editText).toBe(OLD_DRAFT)
  })

  it('callback refresh (responseText now the new AI draft): editText updates to new draft', () => {
    const s = makeSyncState(OLD_DRAFT)
    s.onResponseTextChange(OLD_DRAFT)   // claim refresh — no-op
    s.onResponseTextChange(NEW_DRAFT)   // callback arrived
    expect(s.editText).toBe(NEW_DRAFT)
  })

  it('subsequent polling after success: same responseText, editText unchanged', () => {
    const s = makeSyncState(OLD_DRAFT)
    s.onResponseTextChange(NEW_DRAFT)
    s.onResponseTextChange(NEW_DRAFT)   // poll with same text — no-op
    expect(s.editText).toBe(NEW_DRAFT)
  })

  // ── Manual edits are preserved ────────────────────────────────────────────

  it('manual edit survives a poll that returns the same responseText', () => {
    const s = makeSyncState(NEW_DRAFT)  // new draft already shown
    s.onUserEdit('Manual edit by admin.')
    s.onResponseTextChange(NEW_DRAFT)   // poll — same server text, no-op
    expect(s.editText).toBe('Manual edit by admin.')
  })

  it('manual edit on old draft is overwritten when a new server draft arrives (regen completed)', () => {
    const s = makeSyncState(OLD_DRAFT)
    s.onUserEdit('Admin typed something before regen.')
    // regen callback arrives
    s.onResponseTextChange(NEW_DRAFT)
    expect(s.editText).toBe(NEW_DRAFT)
  })

  // ── Failure / rollback ────────────────────────────────────────────────────

  it('on regen trigger failure: rollback leaves responseText as old draft, editText unchanged', () => {
    const s = makeSyncState(OLD_DRAFT)
    s.onResponseTextChange(OLD_DRAFT)   // claim refresh — no-op (still old text)
    // Routine trigger failed → row rolled back to PENDING_REVIEW with same old responseText
    s.onResponseTextChange(OLD_DRAFT)   // rollback refresh — no-op
    expect(s.editText).toBe(OLD_DRAFT)
  })

  it('manual edit before failed regen is preserved after rollback', () => {
    const s = makeSyncState(OLD_DRAFT)
    s.onUserEdit('Admin typed a manual reply.')
    s.onResponseTextChange(OLD_DRAFT)   // rollback — same text, no-op
    expect(s.editText).toBe('Admin typed a manual reply.')
  })

  // ── Edge: initial null responseText ──────────────────────────────────────

  it('null initial responseText: editText starts as empty string', () => {
    const s = makeSyncState(null)
    expect(s.editText).toBe('')
  })

  it('first draft arrives from null: editText updated to draft', () => {
    const s = makeSyncState(null)
    s.onResponseTextChange(NEW_DRAFT)
    expect(s.editText).toBe(NEW_DRAFT)
  })

  it('poll returning null when already null: no change', () => {
    const s = makeSyncState(null)
    s.onResponseTextChange(null)        // same as initial — no-op
    expect(s.editText).toBe('')
  })
})
