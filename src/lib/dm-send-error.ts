/**
 * Detect whether a Meta error response indicates the messaging window has closed.
 * Meta returns various error codes/messages for this; check the common ones.
 */
export function isMetaWindowError(responseBody: string | null): boolean {
  if (!responseBody) return false
  try {
    const body = JSON.parse(responseBody) as Record<string, unknown>
    const err  = body?.error as Record<string, unknown> | undefined
    if (!err) return false
    // 2534022 is verified from the production Instagram rejection.
    if (err.error_subcode === 2534022 || err.error_subcode === 2018141) return true
    const msg = typeof err.message === 'string' ? err.message.toLowerCase() : ''
    if (msg.includes('24 hour') || msg.includes('outside the window') || msg.includes('outside of allowed window') ||
        msg.includes('messaging window')) return true
  } catch { /* not parseable */ }
  return false
}

