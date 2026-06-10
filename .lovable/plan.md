## Add business type to outbound calling

Allowed values: `salon`, `barbershop`, `restaurant`, `spa`, `clinic`, `trades`, `estate_agent`, `beauty`, `other`.

### 1. Database
Migration on `outbound_leads`:
- Add `business_type text` nullable, default `null`.
- Add CHECK constraint allowing only the 9 values above (or null).

### 2. CSV import (`OutboundCampaignsSection.tsx` → `importCSV`)
- Detect optional `business_type` header as 4th column.
- Normalize to lowercase, validate against allowed list, save `null` if invalid/missing.
- Update the import helper/instructions text to: `Columns: phone (required), first_name, business_name, business_type (optional — salon, barbershop, restaurant, spa, clinic, trades, estate_agent, beauty, other)`.

### 3. Add Lead dialog
- Add a `Select` "Business type" with a blank default ("—") plus the 9 options.
- Persist `business_type` (or null when blank) on insert.
- Extend `newLead` state shape and reset on close.

### 4. Leads table
- Add a "Type" column rendering a small `Badge` (outline variant) showing the value (with underscores replaced by spaces, capitalised). Hide when null.
- Add a `Select` filter "All types" + 9 options above the table, included in the `filtered` useMemo.

### 5. Retell dynamic variable (`supabase/functions/twilio-outbound-call/index.ts`)
- Select `business_type` from `outbound_leads`.
- In `retell_llm_dynamic_variables`, add `business_type: lead.business_type?.trim() || "service business"`.
- Redeploy `twilio-outbound-call`.

### 6. Types
- `Lead` type gains `business_type: string | null`.

### Technical notes
- CHECK constraint: `business_type IS NULL OR business_type IN ('salon','barbershop','restaurant','spa','clinic','trades','estate_agent','beauty','other')`.
- No RLS changes (column added to existing table).
- `src/integrations/supabase/types.ts` regenerates after migration approval; do code edits after.
