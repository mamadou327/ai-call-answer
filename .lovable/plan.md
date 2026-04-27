# Make the customer's chosen plan obvious in the Review dialog

## The problem

In the Review Application dialog, the "Subscription tier" dropdown is *already* prefilled with the plan the customer selected at signup — but this isn't visually obvious. It looks like a blank choice you have to make, so you can't tell at a glance what they picked when contacting them.

You also asked what the "Internal note" is for.

## What will change

**1. Add the customer's chosen plan to the read-only summary block at the top of the dialog**, right next to Business / Owner / Email / Phone / Type / Applied. This is a clear, non-editable display showing exactly what the customer selected at signup — so you always know what to reference when you contact them, regardless of any override you make below.

```text
Business: jp                    Owner: james polly
Email: jp@gmail.com             Phone: 123456789
Type: Restaurant — Both         Applied: 27/04/2026
Customer chose: Growth          ← NEW
```

**2. Relabel the editable dropdown** from "Subscription tier" to **"Assign tier (override if needed)"** so it's clear this is the admin's decision, separate from what the customer picked. Helper text will be updated to:
> "Defaults to the customer's choice. Change only if you've agreed a different plan with them."

**3. Clarify the Internal note field** with helper text:
> "Private notes about this approval (e.g. why you changed the tier, special pricing agreed, follow-up needed). Only admins can see this — never shown to the customer."

## Files

- `src/pages/AdminDashboard.tsx` — update the Review Application dialog (around lines 1886–1949): add the "Customer chose" tile to the summary grid, relabel the tier select and its helper text, add helper text under the internal note field.

No database or backend changes needed — the customer's choice is already stored in `business_settings.subscription_tier` and loaded into `businessTiers[business.id]`.