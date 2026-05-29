## 1. Make "Import from website" optional in setup checklist

**File:** `src/pages/Dashboard.tsx` (checklist item, line ~258–264)

- Add an "(optional)" suffix to the label so it reads: **"Import your business details from your website (optional)"**.
- Mark it as complete whenever the user dismisses it OR has already synced. Implementation: track a per-business dismissal flag in `localStorage` (key `aivia:website_import_skipped:<businessId>`); show a small "Skip" link/button on the row when not yet complete that sets the flag, and treat `isComplete` as `!!biz.website_last_synced_at || skipped`.
- This makes the progress bar reach 100% without forcing the import. No DB change needed — purely UI/local state.

Alternative if you'd prefer it persisted server-side: add a `setup_website_import_skipped boolean` column to `businesses`. Let me know and I'll switch to that in build mode.

## 2. Convert data export from JSON to multi-tab Excel (.xlsx)

**Edge function:** `supabase/functions/export-business-data/index.ts`

- Add `xlsx` (SheetJS) via Deno npm import: `import * as XLSX from "npm:xlsx@0.18.5"`.
- Keep the existing auth + business ownership check. For each business owned by the user, build a workbook with these 4 sheets exactly as specified:

  1. **Clients** — columns: `Name`, `Phone Number`, `Email` (from `customers`)
  2. **Bookings** — columns: `Client Name`, `Service`, `Date`, `Time`, `Staff Member` (join `bookings` → `services.name`, `staff.name`; split `start_time` into date + time in the business's locale)
  3. **Call Logs** — columns: `Date`, `Time`, `Caller Number`, `Duration`, `Outcome` (from `calls_log`: `created_at` split into date/time, `caller_phone`, `duration_ms` formatted as `m:ss`, `call_outcome`)
  4. **Staff** — columns: `Name`, `Role`, `Email` (from `staff`)

- If the user owns multiple businesses, prefix sheet names with a short business tag (e.g. `Clients — Acme`) so all four sheet types appear per business in one workbook. Single-business accounts get plain sheet names.
- Write the workbook with `XLSX.write(wb, { type: "array", bookType: "xlsx" })` and return it with:
  - `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
  - `Content-Disposition: attachment; filename="Aivia-Data-Export-<BusinessName>-<YYYY-MM-DD>.xlsx"` (business name sanitised: spaces → `-`, strip non-alphanumerics; date uses today in UTC). For multi-business accounts, use the primary/first business name.
- Drop the JSON `exported_at`/credential-stripping shape since the workbook only contains the four whitelisted column sets — no secrets are emitted.
- Remove the Resend admin-notification email (you said no notifications needed for demos; this also matches "they're all demos").

**Client:** `src/components/dashboard/settings/AccountManagementSection.tsx`

- Update `handleExport` to:
  - Read filename from the response `Content-Disposition` header (fallback `Aivia-Data-Export-<date>.xlsx`).
  - Save the blob with `.xlsx` extension instead of `.json`.
  - Update the helper sentence under the button to: "Downloads an Excel file with Clients, Bookings, Call Logs and Staff on separate tabs."

## Technical notes

- SheetJS works in Deno via the `npm:` specifier; no extra config needed.
- Duration formatting: `Math.floor(ms/60000) + ":" + String(Math.floor((ms%60000)/1000)).padStart(2,"0")`.
- Date/time: format with `Intl.DateTimeFormat` using the business's `business_settings.country`/timezone if available, else UTC. To keep this simple I'll use `en-GB` locale (DD/MM/YYYY, HH:mm) which matches the UK customer base — flag if you want a different format.
- Services and staff are looked up per business with a single `select id,name` query each, then mapped in memory to avoid N+1.

## Out of scope

- No schema changes (unless you choose the server-side dismissal flag in §1).
- No changes to the JSON export's GDPR completeness — the new Excel is intentionally a business-readable summary, not a full data dump. If you want a "Download full archive (JSON)" button kept alongside the Excel one, say so and I'll keep both.
