## Apply brand color throughout booking flow

In `src/pages/PublicBookingPage.tsx`:

1. Add a `hexToHsl(hex: string): string` utility (module scope) that converts `#rrggbb` to the `H S% L%` format Tailwind expects.
2. Update the root wrapper `<div>` (line 892) `style` prop to also override `--primary` and `--primary-foreground`:

```tsx
style={{
  ["--brand-color" as any]: brandColor,
  ["--primary" as any]: hexToHsl(brandColor),
  ["--primary-foreground" as any]: "0 0% 100%",
}}
```

This cascades the business brand color into every Tailwind `*-primary` class used by the service selector, staff selector, date/time picker, customer form, and confirmation screens — no child components touched.