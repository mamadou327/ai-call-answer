# Premium Public Booking Landing Page Redesign

## 1. Database changes (single migration)

Add to `public.businesses`:
- `brand_color text default '#0F172A'`
- `hero_image_url text`
- `about_description text` with a `CHECK (char_length(about_description) <= 500)`

Rebuild the `public_businesses` view (CREATE OR REPLACE) to expose the existing public columns plus `brand_color`, `hero_image_url`, `about_description`. Re-grant `SELECT` to `anon` and `authenticated`.

Create storage bucket `business-hero` (public). Add storage policies:
- Public SELECT on `business-hero`
- Authenticated INSERT/UPDATE/DELETE on `business-hero` scoped to owner's business folder (mirror existing `business-logos` policies).

## 2. Branding settings (Online Booking Settings → Branding section)

Edit `src/components/dashboard/settings/OnlineBookingSettings.tsx` and add three controls below the existing LogoUpload:

- **Cover Photo**: new `HeroImageUpload` component cloned from `LogoUpload.tsx`, points to `business-hero` bucket, saves URL to `businesses.hero_image_url`. Shows preview, recommended dims note "1200 × 400 px".
- **Brand Colour**: native `<input type="color">` + hex text input, saves to `businesses.brand_color`. Helper text "This colour will be used for buttons and accents on your booking page." Default `#0F172A`.
- **About**: `<Textarea maxLength={500}>` with live character counter, saves to `businesses.about_description`. Placeholder "Tell clients what makes your business special".

All three persist via existing settings save flow (same pattern as logo_url field).

## 3. New PublicLandingPage layout

Rewrite `src/components/public-booking/PublicLandingPage.tsx`. Extend props to accept: `logoUrl`, `heroImageUrl`, `brandColor`, `aboutDescription`, `socials` (instagram/facebook/tiktok/twitter/youtube), `services` (first 6 with id, name, duration, price), `galleryImages` (first 4 urls), and an `onSelectService(serviceId)` callback.

Sections, top to bottom:

1. **Hero**: full-width image (h-[260px] md:h-[380px], object-cover) with `bg-gradient-to-b from-transparent to-black/60` overlay. Fallback: solid white with `brand_color` at 15% opacity gradient. Logo circle 80×80, 3px white border, overlapping hero by -40px bottom-left; business name 28px bold beside it; welcome/about as lighter subtitle.
2. **Action bar**: large "Book Now" button using `var(--brand-color)`, centered, rounded-full. Below, a row of social icons (only platforms with filled URLs) using each platform's brand color (Instagram gradient, Facebook #1877F2, TikTok/Twitter black, YouTube #FF0000).
3. **About**: bordered card with `about_description` if present, otherwise omit.
4. **Services preview**: 2-column grid of up to 6 service cards (name, duration, price). Card click → `onSelectService(id)` which jumps into booking flow at datetime step with that service preselected. "See All Services" ghost button below opens the standard service selector.
5. **Gallery preview**: horizontal scroll strip of 4 square thumbnails if gallery exists; click → `onViewGallery()`.
6. **Info row**: 3-column desktop / stacked mobile — address (MapPin), phone (tel link), opening hours (collapsible). Muted styling.
7. **Footer**: small ghost text links for "Cancel booking" and "Reschedule" (replacing big cards); "Policies" and "Contact" links inline; then a centered "Powered by Aivia" badge with tiny Aivia logo linking to https://aiviaapp.co.uk.

## 4. Brand color injection (PublicBookingPage)

In `src/pages/PublicBookingPage.tsx`:
- Add `brand_color`, `hero_image_url`, `about_description` to the SELECT lists (lines 170, 182, 285-289) and the `business` state type.
- Fetch up to 6 services and 4 gallery images for the landing page (or pass already-loaded data through).
- Wrap the root container with `style={{ '--brand-color': business.brand_color || '#0F172A' }}`.
- Update Tailwind classes on: the Book Now button, active step indicator in the booking stepper, confirmation page checkmark circle, and active header nav item to use `bg-[var(--brand-color)]` / `text-[var(--brand-color)]` / `border-[var(--brand-color)]` instead of `primary`.
- Pass `onSelectService` to PublicLandingPage that sets the selected service and advances the flow.

## 5. Header tweak

In the public booking header component, if `brand_color` is set, apply it as background at 95% opacity (`background: color-mix(in srgb, var(--brand-color) 95%, transparent)` or rgba via hex helper). Otherwise unchanged.

## 6. Powered by Aivia footer

Add a small reusable `PoweredByAivia` snippet (tiny logo from `/aivia-logo.svg` if present, otherwise text-only) used inside the new landing footer. Link target: `https://aiviaapp.co.uk`, `target="_blank" rel="noopener"`.

## Out of scope (do not modify)

- Booking flow steps (service/staff/datetime/customer/confirmation logic)
- `widget.js` floating button
- Header layout beyond the background color tweak

## Technical notes

- Types: after migration, `src/integrations/supabase/types.ts` regenerates automatically — no manual edit.
- The `public_businesses` view must be recreated with the new columns; ensure no sensitive columns (twilio tokens, etc.) are exposed — keep current safe column list and append the 3 new ones.
- Hero image upload component should reuse the same auth/business_id folder convention as LogoUpload for RLS.
- Brand-color CSS variable is read by Tailwind arbitrary values (`bg-[var(--brand-color)]`) — no Tailwind config change required.
