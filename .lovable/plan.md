## Add Edit Campaign Feature

Add the ability to edit an existing outbound campaign's settings after creation.

### What you'll be able to edit
- Campaign name
- Calling days (Mon–Sun)
- Calling hours (start/end time)
- Max calls per day
- Voice
- Delay between calls

### UI changes
In `src/components/admin/outbound/OutboundCampaignsSection.tsx`:
- Add an **Edit** button (pencil icon) on each campaign card, next to the status/delete actions.
- Clicking it opens a new `EditCampaignDialog` pre-filled with the campaign's current values.
- Save updates the `outbound_campaigns` row and refreshes the list.

### New file
- `src/components/admin/outbound/EditCampaignDialog.tsx` — mirrors the create-campaign form fields, wired to an `UPDATE` on `outbound_campaigns`.

### Not included
- Status (active/paused/completed) — already editable today.
- Lead list / target audience — out of scope unless you want it.

Confirm and I'll build it.