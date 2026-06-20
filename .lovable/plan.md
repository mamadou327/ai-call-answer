# Archive instead of delete for campaigns and leads

Replace destructive delete with a two-step flow: **Archive** (soft, reversible) → **Archive view** → **Delete forever** (hard, with confirm).

## DB changes

Add to both `outbound_campaigns` and `outbound_leads`:
- `archived_at timestamptz null`
- `archived_by uuid null` (auth user id, for audit)

No status enum changes — archived is orthogonal to `status`. Indexes on `archived_at` for fast filtering.

Update the existing `process-outbound-campaign` edge function to ignore rows where `archived_at is not null` (one extra `.is("archived_at", null)` on the campaign and leads queries) so archived items never get auto-dialed.

## UI changes (`OutboundCampaignsSection.tsx` only)

### Campaigns tab
- Replace the red Trash button on each row with an **Archive** button (box-arrow icon).
- Add an **"Archived"** toggle/filter at the top ("Active campaigns" | "Archived"). Default = Active.
- In the Archived view, each row shows two buttons:
  - **Restore** → sets `archived_at = null`
  - **Delete forever** (red) → hard delete with `confirm("This permanently deletes the campaign and ALL its leads, calls, recordings. Cannot be undone.")`
- Active list query: `.is("archived_at", null)`. Archived list: `.not("archived_at", "is", null)`.

### Leads tab (inside a campaign)
- Replace the per-row trash with **Archive** (icon).
- Add the same toggle ("Active leads" | "Archived") above the table; default Active.
- Bulk action bar (the one we just added) gains an **Archive selected** button alongside **Call again**. In Archived view it shows **Restore selected** and **Delete forever**.
- The bulk "Call again" excludes archived leads automatically (they're not in the Active view anyway).

### Confirms & toasts
- Archive: no confirm (it's reversible) — toast "Archived. Undo" with a 6-second Undo button that restores.
- Delete forever: hard confirm dialog naming what will be lost.

## Files touched

- `src/components/admin/outbound/OutboundCampaignsSection.tsx` — campaigns list, leads table, bulk bar, archive view toggles, restore/delete-forever handlers.
- `supabase/functions/process-outbound-campaign/index.ts` — add `archived_at is null` filters on campaign + lead queries.
- One DB migration adding the two columns + indexes on both tables.

## Not in scope

- No retention policy / auto-purge of archived rows (can add later).
- No archive view for demos (separate table, can do in a follow-up if you want).
- No changes to RLS — archive is just a column, existing policies still apply.
