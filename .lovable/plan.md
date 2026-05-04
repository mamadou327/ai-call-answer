# Website Import & Auto Re-sync

Auto-learn business details (services, prices, hours, policies, FAQs) from a website URL during onboarding, with a manual re-sync control and a weekly background check that emails owners when changes are detected and lets them confirm in-app.

## Heads-up on a few requested details

A couple of small substitutions are needed before we build:

1. **OpenAI API key** — the project does not currently have a stored OpenAI key. We have two clean options:
   - Use **Lovable AI** (`google/gemini-2.5-flash` or `openai/gpt-5-mini`) — no key required, already wired in. **Recommended.**
   - Add an `OPENAI_API_KEY` secret and use `gpt-4o`. I'll prompt for the secret if you want this.
2. **Scraping** — raw `fetch()` works for many sites but fails on JS-heavy ones. Firecrawl (already supported as a connector) is dramatically more reliable for "find homepage + 3 linked pages." Plain fetch is the default; I'll note Firecrawl as an upgrade path.
3. **Resend** — the project's email functions currently use Lovable's built-in email (Resend under the hood, no extra setup). I'll reuse that same pattern, no new secrets needed.

I'll proceed with **Lovable AI (Gemini 2.5 Flash)** + **plain fetch scraping** + **existing email infra** unless you say otherwise after approval.

## What gets built

### 1. Database

New table `website_sync_log`:
- `id`, `business_id`, `synced_at`, `url`, `changes_detected` (bool), `changes_summary` (jsonb), `confirmed` (bool), `confirmed_at`
- RLS: owners can read/update their own rows; service role writes from cron.

Add columns to `businesses`:
- `website_last_synced_at timestamptz`
- `website_last_synced_url text`
- `website_pending_changes jsonb` (set by cron when diff found, cleared on confirm/dismiss)

### 2. Edge functions

**`scrape-website`** (callable from client and from cron)
- Input: `{ url, businessId }`
- Fetches homepage HTML, extracts `<a>` links, picks up to 3 with keywords `services|prices|menu|about|booking|hours|faq` in href or anchor text.
- Strips scripts/styles, returns concatenated plain text.
- Sends text to Lovable AI Gateway with the extraction prompt you provided (adapted to ask for valid JSON via `response_format: json_object`).
- Returns extracted JSON: `{ business_name, services[], opening_hours, booking_policy, cancellation_policy, faqs[] }`.

**`apply-website-import`**
- Input: `{ businessId, extracted }`
- Upserts into `business_settings` (`cancellation_policy`), `services` (insert/skip duplicates by name), `opening_hours` (replace), and updates `businesses.website`, `website_last_synced_at`, `website_last_synced_url`.
- Inserts a `website_sync_log` row with `confirmed = true`.

**`weekly-website-sync`** (scheduled)
- Loops approved businesses with a `website` set.
- Calls `scrape-website` per business, compares each field to current DB values (services by name+price, hours per day, policies as text equality).
- If any diff: writes `website_pending_changes` on the business, inserts a `website_sync_log` row (`changes_detected=true, confirmed=false`), and emails the owner via the existing email function with subject "We noticed your website may have been updated" + a side-by-side summary + CTA link to `/dashboard?tab=settings&section=website-sync`.
- pg_cron job runs weekly (Mondays 09:00 UTC) via `cron.schedule` + `net.http_post`.

### 3. UI

**Onboarding checklist** (`src/pages/Dashboard.tsx`)
- New top item: "Import your business details from your website". `isComplete` when `businesses.website_last_synced_at` is set.
- Clicking opens new component `WebsiteImportDialog`.

**`src/components/dashboard/WebsiteImportDialog.tsx`** (new)
- URL input + Import button → calls `scrape-website` → shows preview (services, hours, policies, FAQs) → "Confirm and Save" calls `apply-website-import`; "Edit manually" closes and routes to settings.

**`src/components/dashboard/settings/WebsiteSyncSection.tsx`** (new) — added inside `BusinessInfoForm` area
- Shows last synced URL, last synced date, editable URL field, "Re-sync from website" button (reuses the same dialog/flow).

**`src/components/dashboard/settings/PendingWebsiteChangesBanner.tsx`** (new)
- Renders at top of `BusinessInfoForm` (or `SettingsTab` "business" tab) when `businesses.website_pending_changes` is non-null.
- Side-by-side old vs new for each changed field. "Confirm Updates" → `apply-website-import` then clears `website_pending_changes`. "Dismiss" → just clears the field.
- Deep-link support: when route has `?section=website-sync`, scroll into view.

### 4. Files modified / created

**Created**
- `supabase/functions/scrape-website/index.ts`
- `supabase/functions/apply-website-import/index.ts`
- `supabase/functions/weekly-website-sync/index.ts`
- `src/components/dashboard/WebsiteImportDialog.tsx`
- `src/components/dashboard/settings/WebsiteSyncSection.tsx`
- `src/components/dashboard/settings/PendingWebsiteChangesBanner.tsx`
- Migration: new table `website_sync_log`, new columns on `businesses`, RLS policies, pg_cron schedule

**Modified**
- `src/pages/Dashboard.tsx` — add checklist item + dialog wiring
- `src/components/dashboard/settings/BusinessInfoForm.tsx` — render banner + sync section

**Untouched** (per your instructions)
- Call handling, voice settings, tier gating, billing, all other dashboard areas.

### Technical notes

- AI extraction uses `response_format: { type: "json_object" }` and a Zod parse to defend against malformed output.
- `scrape-website` enforces a 10s timeout per page, 200 KB cap on HTML per page, and rejects non-http(s) URLs.
- All edge functions validate JWT (owner endpoints) except the cron one which uses service-role auth from pg_net.
- Diff comparison is field-level and stored as `{field: {old, new}}` so the banner renders generically.
- Cron uses pg_cron + pg_net; the SQL with the project URL/anon key will be inserted via the data tool (not a migration) so it won't run on remixes.

After approval I'll switch to default mode and implement everything, then list every file changed at the end.
