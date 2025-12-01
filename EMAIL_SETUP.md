# Email Notification System for Aivia

## Overview

Aivia sends automated emails to staff members for:
1. **Staff Account Invitations** - When invited to join the platform
2. **Time-Off Approvals** - When time-off is scheduled

## How It Works

### Architecture

```
Business Owner Action → Edge Function → Email Service (Resend) → Staff Email
```

### Edge Functions Created

1. **send-staff-invitation** - Sends invitation emails to new staff
2. **send-time-off-notification** - Notifies staff about approved time-off

## Setup Instructions

### 1. Sign Up for Resend

1. Go to [https://resend.com](https://resend.com)
2. Create a free account
3. Verify your domain at [https://resend.com/domains](https://resend.com/domains)
4. Create an API key at [https://resend.com/api-keys](https://resend.com/api-keys)

### 2. Add API Key to Backend

You'll need to add your Resend API key as a secret in the backend.

The edge functions are already prepared and will automatically:
- Format professional HTML emails
- Include all relevant booking/time-off details
- Send from your verified domain

### 3. Email Templates

#### Staff Invitation Email
- Welcome message with business name
- List of features they'll have access to
- Call-to-action button to accept invitation
- Note that business owner needs to approve

#### Time-Off Notification Email
- Confirmation of approved time-off
- Date/time details formatted nicely
- Reason and any notes included
- Reassurance that AI won't schedule during that time

## Current Implementation

The edge functions are **ready to use** but need:
1. **RESEND_API_KEY** secret added to backend
2. Uncomment the Resend integration code in each function

### Example Integration (in edge function):

```typescript
import { Resend } from "npm:resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

await resend.emails.send({
  from: "Aivia <noreply@yourdomain.com>",
  to: staffEmail,
  subject: "You've been invited!",
  html: emailContent.html,
});
```

## Triggering Emails

### From the Frontend

The components already prepare the data. To actually send emails, you would call the edge functions:

```typescript
// When inviting staff
await supabase.functions.invoke("send-staff-invitation", {
  body: {
    staffName: "John Doe",
    staffEmail: "john@example.com",
    businessName: "My Salon",
    inviteLink: `${window.location.origin}/auth?invite=xyz`,
  },
});

// When approving time-off
await supabase.functions.invoke("send-time-off-notification", {
  body: {
    staffName: "John Doe",
    staffEmail: "john@example.com",
    businessName: "My Salon",
    startTime: "2024-01-15T09:00:00Z",
    endTime: "2024-01-15T17:00:00Z",
    reason: "sick_leave",
    notes: "Doctor appointment",
  },
});
```

## AI Integration

When the AI assistant receives a booking request:

1. **Checks staff availability** against the `staff_time_off` table
2. **Filters out unavailable staff** during their time-off periods
3. **Only offers available time slots** to customers
4. **Books appointments** only with available staff

This ensures staff won't receive bookings during their scheduled time-off.

## Production Checklist

- [ ] Sign up for Resend
- [ ] Verify your domain
- [ ] Create API key
- [ ] Add RESEND_API_KEY to backend secrets
- [ ] Update edge functions with your domain
- [ ] Uncomment Resend integration code
- [ ] Test with real email addresses
- [ ] Set up "from" address (e.g., noreply@yourdomain.com)

## Cost

Resend offers:
- **3,000 emails/month** free forever
- Additional emails at $0.001 per email
- Perfect for most small-medium businesses

## Support

The email templates are pre-designed with:
- Responsive HTML design
- Professional formatting
- Clear call-to-action buttons
- Mobile-friendly layout
- Accessibility considerations
