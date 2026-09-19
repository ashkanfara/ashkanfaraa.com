# DM simplification and deployment repair

## Confirmed deployment fault

The five-minute Vercel cron is incompatible with this project's Hobby plan. It blocked deployment of the messaging-window changes, leaving production at 242afd0 while main advanced to c69e870. Git push and an unauthenticated 401 are not deployment verification.

## First implemented simplification

One recovery function now serves authenticated inbox refresh and a daily unattended cron. A generating inbox already polls every 12 seconds. Drafts older than 30 minutes become retryable during that refresh. Recovery never sends or starts a generation. Conditional writes compare the original generation, timestamp, unsent flag and state so a callback or renewed claim cannot be overwritten.

The daily schedule fits the existing hosting plan. With the inbox closed, the independent Vercel backup now runs daily rather than every five minutes; the previous five-minute schedule never deployed. This does not replace the existing Windows worker scheduler. CRON_SECRET must be present for the unattended endpoint; missing configuration fails closed.

The existing main changes remove local expiry enforcement and make legacy expired rows explicitly retryable. Instagram can still reject a send; a real platform rejection must remain visible. No automated retry of an uncertain send is allowed.

## Preserved contracts

AI persona, prompts, response rules, review/approval, history, human takeover, access rules and Windows infrastructure remain unchanged. No real Instagram messages are sent as tests.

## Remaining architecture work

Target: one inbound ingestion path, one durable conversation queue, one draft engine using the existing versioned persona, one approval/send service, and one recovery policy. n8n should schedule/ingest, not duplicate website send-state decisions. Supabase holds authoritative state. The website handles review and the one send endpoint.

Before retiring paths, inventory the live n8n workflow and Claude Routine configuration against deployed code. Both direct generation and Routine callbacks currently exist, with differing prompt-version handling. Preserve their actual behavior before consolidating. Do not remove block controls yet: legacy blocklist, access rules and human takeover are connected. Separate obsolete UI from active consent/access rules.

Implemented send fixes: claim/read failures stop before Instagram and return errors; unsent-only claims prevent contradictory rows from being resent; cleanup only covers messages at or before the approved primary message and is awaited; newer arrivals stay pending. HTTP 5xx and incomplete success responses remain non-resendable pending reconciliation. Generic account restrictions no longer masquerade as window errors. Local timer badges are explicitly estimates, not confirmed expiry.

Isolated tests cover old timestamps reaching the mocked API, genuine window errors, unrelated account errors, uncertain delivery, failed claims, stale bundles and guarded cleanup. Production build and targeted lint pass.

Remaining: per-row draft claims do not serialize an entire conversation; exact draft bundle membership is not yet persisted; Routine context uses hardcoded link-sent flags. Fix with isolated concurrency tests, not live customer sends. Roll out separately from restoring deployment so failures are attributable and reversible.
