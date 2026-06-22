## Goal
Make service categories per-business and driven by what's actually in use (including imported ones), instead of a hardcoded list of 8 options.

## Behaviour
- The category dropdown in the "Add / Edit Service" dialog will be built dynamically from the distinct categories already used by that business's services (e.g. "Ladies Haircut", "Gents Haircut", etc.).
- A small set of sensible defaults (Kids, Women, Men/Adults, Unisex, Hairstyle, Color, Treatment, Other) is merged in so brand-new businesses with no services yet still see something.
- The user can also type a new category directly — if it doesn't exist yet, it's added on save and will appear in the dropdown next time.
- When editing an existing service, the current category is always preselected correctly, even if it was imported and isn't in the defaults (fixes the "Ladies Haircut" bug shown in the screenshot).
- No data migration, no renaming of existing categories — imported values stay exactly as they are.

## Scope
- Frontend only: `src/components/dashboard/settings/ServicesManagement.tsx`.
- Replace the fixed `Select` with a combobox-style input (Select for picking existing + free-text input for adding new), or a single searchable combobox. I'll use the existing shadcn `Command` + `Popover` pattern already used elsewhere in the project for consistency.
- No DB changes, no edge function changes, no changes to import logic — imported categories already land in `services.category` as free text, so they'll automatically appear in the new dropdown.

## Out of scope
- Editing/renaming/deleting categories globally (can be a follow-up if you want a "Manage categories" screen).
- Grouping services by category in the public booking page (separate task if wanted).
