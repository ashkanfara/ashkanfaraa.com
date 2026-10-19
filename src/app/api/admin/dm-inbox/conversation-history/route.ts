/**
 * GET /api/admin/dm-inbox/conversation-history?sender_id=<id>
 *
 * Returns merged conversation history for a sender.
 * Customer: lines from instagram_dm_buffer (response_sent=true OR SUPERSEDED).
 * Ashkan:   lines from dm_response_feedback (confirmed sends).
 *
 * Intended caller: n8n FCH (Fetch Conversation History) node, replacing the
 * direct Supabase dm_response_feedback read that missed SUPERSEDED bundle siblings.
 *
 * Auth: Authorization: Bearer <DM_CONTEXT_API_SECRET>
 *   Set DM_CONTEXT_API_SECRET in Vercel env and in n8n as an HTTP header credential.
 *   Keep it server-side only — never expose to the browser.
 *
 * Returns: { sender_id, conversation_history }
 *   conversation_history is the same string assembleDmConversationHistory returns.
 *   Empty string when sender has no confirmed history.
 */

import { NextRequest, NextResponse } from 'next/server'
import { assembleDmConversationHistory } from '@/lib/dm-conversation-context'

export async function GET(req: NextRequest): Promise<NextResponse> {
  // Auth: Bearer token shared with n8n
  const secret = process.env.DM_CONTEXT_API_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'DM_CONTEXT_API_SECRET not configured' }, { status: 503 })
  }
  const auth = req.headers.get('authorization') ?? ''
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const senderId = req.nextUrl.searchParams.get('sender_id')?.trim()
  if (!senderId) {
    return NextResponse.json({ error: 'sender_id required' }, { status: 400 })
  }

  const conversationHistory = await assembleDmConversationHistory(senderId)
  return NextResponse.json({ sender_id: senderId, conversation_history: conversationHistory })
}
