/** Shared recovery for inbox refresh and the daily unattended safety sweep.
 * Never retries generation or sends a message. Only releases stale draft claims.
 */
export async function recoverStaleDmDrafts() {
  const url = (process.env.SUPABASE_URL ?? '').replace(/\/$/, '')
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase not configured')
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
  const cutoff = new Date(Date.now() - 30 * 60_000).toISOString()
  const table = `${url}/rest/v1/instagram_dm_buffer`
  const stale = `failed_reason=eq.DRAFT_GENERATING&response_sent=eq.false&processing_started_at=lt.${encodeURIComponent(cutoff)}`
  const response = await fetch(`${table}?${stale}&select=id,generation_id,processing_started_at&limit=50`, {
    headers, cache: 'no-store', signal: AbortSignal.timeout(5000),
  })
  if (!response.ok) throw new Error(`Draft recovery query failed (${response.status})`)
  const rows = await response.json() as { id: string; generation_id: string | null; processing_started_at: string }[]
  let reset = 0
  let errors = 0
  await Promise.all(rows.map(async row => {
    // Compare the complete claim: a concurrent callback, renewal or new generation wins.
    const generation = row.generation_id === null ? 'is.null' : `eq.${encodeURIComponent(row.generation_id)}`
    try {
      const patched = await fetch(`${table}?${stale}&id=eq.${encodeURIComponent(row.id)}&generation_id=${generation}&processing_started_at=eq.${encodeURIComponent(row.processing_started_at)}`, {
        method: 'PATCH', headers: { ...headers, Prefer: 'return=representation' },
        body: JSON.stringify({ failed_reason: 'DRAFT_FAILED', processing: false }),
        signal: AbortSignal.timeout(5000),
      })
      if (!patched.ok) { errors++; return }
      reset += (await patched.json() as unknown[]).length
    } catch { errors++ }
  }))
  return { ok: errors === 0, reset, found: rows.length, errors }
}
