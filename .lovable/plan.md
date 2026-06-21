## What's happening
`business_settings` has RLS policies that let only the business **owner** insert/update rows. Super admins (you) only have `SELECT`. So when the admin tab tries to upsert a tier change for Lucy, Postgres rejects it with "row violates row-level security policy".

This is why both the "Approve & apply" button in **Upgrades** and the **Save** button in the business details dialog were failing for any account that wasn't already self-managing its settings row.

## Fix
Add a migration with two new policies on `public.business_settings`:

1. `Super admins can insert business settings` — `FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'super_admin'))`
2. `Super admins can update business settings` — `FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'super_admin')) WITH CHECK (has_role(auth.uid(), 'super_admin'))`

Existing policies stay untouched, so business owners keep managing their own settings.

After the migration, both:
- The Upgrades tab → **Approve & apply**
- The business details dialog → **Save** plan

will succeed for any business, including those (like demo accounts) that never had a `business_settings` row.

No frontend changes needed — both already use `upsert` correctly.
