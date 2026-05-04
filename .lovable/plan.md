## Goal

Paste a website URL → Aivia automatically discovers every page, reads every price table, and imports a complete list of services, opening hours, booking policy, cancellation policy and FAQs. No manual cleanup.

## Why the current import is incomplete

The existing `scrape-website` edge function does two things that limit it:

1. **DIY crawler capped at 15 pages** with a 2-hop link-following heuristic. Sites with deep menu structures or JS-rendered content get partially missed.
2. **`stripHtml()` flattens `<table>` elements into a run-on string**, then Gemini 2.5 Flash tries to guess which price belongs to which service. On grid pricing (e.g. Vixen & Blush's Tape Sides × 18″/22″/Refit columns), most rows are dropped or merged.

## Solution: Firecrawl + Gemini 2.5 Pro

Swap the homemade crawler for **Firecrawl** (an official Lovable connector built for exactly this) and upgrade the extraction model to **Gemini 2.5 Pro**.

- **Firecrawl `/crawl`** walks the entire site recursively, renders JavaScript, and returns each page as clean Markdown — tables stay as `| Service | 18″ | 22″ | Refit |` Markdown tables.
- **Gemini 2.5 Pro** is significantly stronger than Flash at reading tabular data and emitting one structured row per price column.
- Firecrawl also has a built-in `json` extraction format with schemas, which we use to enforce the exact output shape we need.

## Plan

### 1. Connect Firecrawl
- Use the Firecrawl Lovable connector (`standard_connectors--connect` with `connector_id: firecrawl`).
- This injects `FIRECRAWL_API_KEY` into the edge functions automatically — no manual key entry.
- Firecrawl is a managed connector; the user can be offered the `LOVABLE50` coupon for 50% off if they hit credit limits.

### 2. Rewrite `supabase/functions/scrape-website/index.ts`
Replace the custom fetch + link scoring + HTML stripping with a two-stage pipeline:

**Stage A — Crawl with Firecrawl**
```
POST https://api.firecrawl.dev/v2/crawl
{
  url,
  limit: 50,           // up to 50 pages, plenty for any small business site
  maxDepth: 3,
  scrapeOptions: { formats: ['markdown'], onlyMainContent: true },
  excludePaths: ['/blog', '/news', '/cart', '/checkout', '/account', '/wp-admin']
}
```
Poll the returned job ID until `status === 'completed'` (typically 10-60s). Firecrawl handles JS rendering, sitemap discovery, link following, and rate limiting.

**Stage B — Extract with Gemini 2.5 Pro**
Concatenate every page's Markdown (now preserving tables) into one document, then send to the Lovable AI Gateway with `google/gemini-2.5-pro` and a tool-calling schema that forces this exact shape:

```json
{
  "business_name": "string|null",
  "services": [
    {
      "name": "string",            // e.g. "Tape Sides — Up to 18″ First Fit"
      "category": "string|null",   // e.g. "Tape", "Micro Bond"
      "price": "number|null",
      "duration_minutes": "number|null"
    }
  ],
  "opening_hours": { "monday": "9:00am-5:30pm", ... },
  "booking_policy": "string|null",
  "cancellation_policy": "string|null",
  "faqs": [{ "question": "string", "answer": "string" }]
}
```

The prompt explicitly instructs: "For any price table with multiple columns (lengths, sizes, refit, etc.), emit ONE entry per cell. Always include the section heading as `category`. Never skip a row."

Fallback to `google/gemini-2.5-flash` only on 429/402.

### 3. Update `apply-website-import/index.ts`
- Honor the AI-returned `category` instead of hardcoding `"Imported"` so services land grouped correctly in Services Management (Tape, Micro Bond, etc.).
- Honor `duration_minutes` when present (default 30 only if null).

### 4. Update `WebsiteImportDialog.tsx`
- Show a richer progress indicator: "Crawling website…" → "Reading X pages…" → "Extracting services…"
- Surface `pages_scraped` count + `services_found` count before the user confirms.
- If Firecrawl returns 402 (out of credits), show a friendly message with the upgrade link.

### 5. Apply the same pipeline to weekly re-sync
`weekly-website-sync` already calls `scrape-website` internally, so it inherits the upgrade automatically — no changes needed there.

## Technical details

- **Firecrawl async pattern**: `/crawl` returns `{ id, url }`; poll `GET /crawl/:id` every 3s for up to 90s. If still running, return a 202 to the client and let them re-poll (or just extend timeout to 90s for now since edge functions allow it).
- **Cost**: Firecrawl charges 1 credit per page scraped. A 50-page crawl = 50 credits. Free tier includes 500 credits/month, enough for ~10 imports.
- **Token budget**: 50 pages of Markdown ≈ 200-400k tokens, well within Gemini 2.5 Pro's 2M context.
- **Fallback**: If `FIRECRAWL_API_KEY` is missing (connector not linked), fall back to the current homemade crawler so existing customers aren't broken.

## Files to change

- `supabase/functions/scrape-website/index.ts` — full rewrite to Firecrawl + Gemini 2.5 Pro
- `supabase/functions/apply-website-import/index.ts` — honor `category` + `duration_minutes`
- `src/components/dashboard/WebsiteImportDialog.tsx` — better progress UI + 402 handling

Nothing else changes: call handling, voice settings, tier gating, billing, weekly re-sync wiring all stay as they are.

## Expected result on Vixen & Blush

Instead of ~5 partial entries, you should see ~60 services like:

```
Tape — Sides — Up to 18″ First Fit       £315
Tape — Sides — Up to 22″ First Fit       £345
Tape — Sides — Refit                     £145
Tape — Boost — Up to 18″ First Fit       £...
... (all 5 Tape rows × 3 columns)
Micro Bond — Filler — 14″                £...
... (all 4 head sizes × 5 lengths)
Clip In — Set                            £295
Clip In — Colour Match                   £50
FeatherLight — ... (all 5 levels × 5 lengths)
Other Services — ...
```

Each grouped by `category` so they sort naturally in Services Management.
