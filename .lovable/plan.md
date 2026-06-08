## Fix Duplicate Retell Webhook Processing

### Problem
Retell retries webhooks when it does not receive a 200 response within its timeout window. The `retell-call-webhook` edge function re-processes the same call on retries, running AI extraction again, re-inserting demo records, and re-sending notification emails.

### Fix 1 — Idempotent Early Return
In `supabase/functions/retell-call-webhook/index.ts`, immediately after fetching the lead by `retell_call_id`, check if `lead.call_transcript` is already populated. If it is, return HTTP 200 immediately with no side effects — no AI extraction, no DB updates, no emails.

### Fix 2 — Database Unique Constraint
Add a unique index on `outbound_demos(lead_id)` so that duplicate demo insertions are rejected at the database level even if the early return is somehow bypassed.

### Deployment
Re-deploy `retell-call-webhook` after the code change.

---

**Files touched:**
- `supabase/functions/retell-call-webhook/index.ts` — add early-return guard
- Database migration — `CREATE UNIQUE INDEX IF NOT EXISTS outbound_demos_lead_id_unique ON outbound_demos(lead_id)`