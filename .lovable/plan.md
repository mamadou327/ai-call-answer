## Where we are today
- `staff.working_hours` (jsonb) already exists on every staff row.
- The AI receptionist (`twilio-media-stream`) and the public booking availability check (`public-check-availability`) already read it and filter slots to only times that staff member works.
- `staff_time_off` is separate (one-off holidays / sick days) and already wired up.
- What's missing is a UI to actually set those hours — right now `working_hours` is `null` for everyone, so the backend falls back to "available whenever the business is open", which is exactly the problem you're describing.

## Plan

### 1. Per-staff working hours editor (owner side)
- In `StaffManagement.tsx`, add a "Hours" button on each staff row that opens a new `StaffWorkingHoursDialog`.
- Dialog shows 7 rows (Mon–Sun), each with: `Working` toggle + `Start` / `End` time pickers + optional `Break start` / `Break end`.
- Defaults when first opened:
  - If `working_hours` is null → prefill from the business `opening_hours` for each day (so owners can just tweak).
  - If a day has multiple shifts later, we'll extend the shape; v1 is one shift + one break per day.
- Saved JSON shape (backwards compatible with what `twilio-media-stream` and `public-check-availability` already expect):
  ```json
  {
    "monday":    { "start": "09:00", "end": "17:00", "break_start": "13:00", "break_end": "13:30" },
    "tuesday":   { "start": "09:00", "end": "17:00" },
    "wednesday": null,
    ...
  }
  ```
  `null` / missing day = not working.
- Validation: warn (don't block) if staff hours fall outside the business `opening_hours` for that day, so owners can still set early-prep or late-clean shifts if they want.

### 2. Make the availability logic use breaks
- `public-check-availability` and `twilio-media-stream` currently honour `start`/`end`. Extend both to also subtract the `break_start`–`break_end` window when present, so the AI never books over a lunch break.
- `BookingDialog` (manual booking from dashboard) currently doesn't filter by staff hours at all — add the same per-staff filter so owners can't accidentally double-book a staff member outside their shift (still allow override with a confirm dialog).

### 3. Staff-side visibility
- In `StaffDashboard`, add a small "My schedule" card showing the staff member's own weekly hours (read-only, pulled from their linked staff row).
- Staff can request time off through the existing `staff_time_off` flow — no change there.

### 4. Calendar respects hours
- `CalendarTab` already colours by staff; add a subtle greyed-out background on staff columns/rows during their off-hours and breaks so the owner can see at a glance who's in.

## Out of scope (call out if you want it later)
- Multi-shift days (split shifts beyond one break).
- Recurring shift rotations (e.g. week A / week B).
- Per-date overrides beyond `staff_time_off` (e.g. "this Wednesday only, finish at 3").
- Auto-syncing staff hours from Google Calendar.

## No DB migration required
`staff.working_hours` already exists as `jsonb`. This is a UI + edge-function-logic change, no schema work.