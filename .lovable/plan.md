## Fix service card tap on landing page

Add the missing `onSelectService` prop to `<PublicLandingPage>` in `src/pages/PublicBookingPage.tsx` (around line 994) so tapping a service card pre-selects that service and jumps straight to the staff selection step.

```tsx
onSelectService={(serviceId) => {
  const found = services.find((s: any) => s.id === serviceId);
  if (found) handleServiceSelect(found);
}}
```

`handleServiceSelect` already exists and handles advancing to the staff step, so no other changes are needed.