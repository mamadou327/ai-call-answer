import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Calendar, Clock, User, CreditCard, ExternalLink, Download } from "lucide-react";
import { format, addMinutes } from "date-fns";

interface GroupBooking {
  bookingCode: string;
  serviceName: string;
  staffName: string | null;
  startTime: string;
  endTime: string;
}

interface PublicBookingConfirmationProps {
  businessName: string;
  businessAddress?: string;
  bookingCode: string;
  serviceName?: string;
  staffName?: string;
  date?: Date | null;
  time?: string | null;
  serviceDuration?: number;
  depositRequired: boolean;
  depositAmount?: number;
  depositPaymentLink?: string;
  currency: string;
  groupBookings?: GroupBooking[];
}

const formatCurrency = (amount: number, currency: string) => {
  const symbols: Record<string, string> = {
    GBP: "£",
    USD: "$",
    EUR: "€",
  };
  return `${symbols[currency] || currency}${amount.toFixed(2)}`;
};

// Generate ICS file content for calendar events
const generateICSContent = (
  title: string,
  startDate: Date,
  endDate: Date,
  location: string,
  description: string
): string => {
  const formatICSDate = (date: Date): string => {
    return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  };

  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Booking System//EN
BEGIN:VEVENT
UID:${Date.now()}@booking
DTSTAMP:${formatICSDate(new Date())}
DTSTART:${formatICSDate(startDate)}
DTEND:${formatICSDate(endDate)}
SUMMARY:${title}
LOCATION:${location}
DESCRIPTION:${description.replace(/\n/g, "\\n")}
END:VEVENT
END:VCALENDAR`;
};

// Download ICS file
const downloadICS = (content: string, filename: string) => {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// Generate Google Calendar URL
const generateGoogleCalendarUrl = (
  title: string,
  startDate: Date,
  endDate: Date,
  location: string,
  description: string
): string => {
  const formatGoogleDate = (date: Date): string => {
    return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  };

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${formatGoogleDate(startDate)}/${formatGoogleDate(endDate)}`,
    location: location,
    details: description,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

export const PublicBookingConfirmation = ({
  businessName,
  businessAddress,
  bookingCode,
  serviceName,
  staffName,
  date,
  time,
  serviceDuration,
  depositRequired,
  depositAmount,
  depositPaymentLink,
  currency,
  groupBookings,
}: PublicBookingConfirmationProps) => {
  // Calculate start and end times for calendar events
  const getEventTimes = () => {
    if (!date || !time) return null;
    const [hours, minutes] = time.split(":").map(Number);
    const startDate = new Date(date);
    startDate.setHours(hours, minutes, 0, 0);
    const endDate = addMinutes(startDate, serviceDuration || 60);
    return { startDate, endDate };
  };

  const handleAddToGoogleCalendar = (booking?: GroupBooking) => {
    if (booking) {
      const startDate = new Date(booking.startTime);
      const endDate = new Date(booking.endTime);
      const title = `${booking.serviceName} at ${businessName}`;
      const description = `Booking Code: ${booking.bookingCode}${booking.staffName ? `\nWith: ${booking.staffName}` : ""}\n\nBooked via online booking system.`;
      const location = businessAddress || businessName;
      const url = generateGoogleCalendarUrl(title, startDate, endDate, location, description);
      window.open(url, "_blank");
      return;
    }

    const times = getEventTimes();
    if (!times) return;

    const title = `${serviceName || "Appointment"} at ${businessName}`;
    const description = `Booking Code: ${bookingCode}${staffName ? `\nWith: ${staffName}` : ""}\n\nBooked via online booking system.`;
    const location = businessAddress || businessName;

    const url = generateGoogleCalendarUrl(title, times.startDate, times.endDate, location, description);
    window.open(url, "_blank");
  };

  const handleDownloadICS = (booking?: GroupBooking) => {
    if (booking) {
      const startDate = new Date(booking.startTime);
      const endDate = new Date(booking.endTime);
      const title = `${booking.serviceName} at ${businessName}`;
      const description = `Booking Code: ${booking.bookingCode}${booking.staffName ? `\nWith: ${booking.staffName}` : ""}\n\nBooked via online booking system.`;
      const location = businessAddress || businessName;
      const icsContent = generateICSContent(title, startDate, endDate, location, description);
      downloadICS(icsContent, `booking-${booking.bookingCode}.ics`);
      return;
    }

    const times = getEventTimes();
    if (!times) return;

    const title = `${serviceName || "Appointment"} at ${businessName}`;
    const description = `Booking Code: ${bookingCode}${staffName ? `\nWith: ${staffName}` : ""}\n\nBooked via online booking system.`;
    const location = businessAddress || businessName;

    const icsContent = generateICSContent(title, times.startDate, times.endDate, location, description);
    downloadICS(icsContent, `booking-${bookingCode}.ics`);
  };

  const showCalendarButtons = date && time;
  const isGroupBooking = groupBookings && groupBookings.length > 0;

  return (
    <div className="max-w-md mx-auto space-y-6">
      <Card className="border-2 border-primary shadow-sm">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
            <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
          </div>
          <CardTitle className="text-2xl">
            {isGroupBooking ? `${groupBookings.length} Bookings Confirmed!` : "Booking Confirmed!"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-muted-foreground">
            Your appointment{isGroupBooking && groupBookings.length > 1 ? "s" : ""} at <span className="font-medium">{businessName}</span> {isGroupBooking && groupBookings.length > 1 ? "have" : "has"} been booked.
          </p>

          {/* Group Bookings List */}
          {isGroupBooking ? (
            <div className="space-y-3">
              {groupBookings.map((booking, index) => (
                <div key={booking.bookingCode} className="bg-secondary p-4 rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-semibold">{booking.serviceName}</p>
                      {booking.staffName && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {booking.staffName}
                        </p>
                      )}
                    </div>
                    <p className="text-xs font-mono bg-background px-2 py-1 rounded">{booking.bookingCode}</p>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>{format(new Date(booking.startTime), "EEE, MMM d 'at' h:mm a")}</span>
                  </div>
                  {/* Calendar buttons for each booking */}
                  <div className="flex gap-2 mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={() => handleAddToGoogleCalendar(booking)}
                    >
                      <Calendar className="h-3 w-3 mr-1" />
                      Google
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={() => handleDownloadICS(booking)}
                    >
                      <Download className="h-3 w-3 mr-1" />
                      iCal
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="bg-secondary p-4 rounded-lg text-center">
                <p className="text-sm text-muted-foreground">Your booking reference</p>
                <p className="text-2xl font-bold font-mono tracking-wider">{bookingCode}</p>
              </div>

              {(serviceName || date || time || staffName) && (
                <div className="space-y-2 pt-2">
                  {serviceName && (
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>{serviceName}</span>
                    </div>
                  )}
                  {date && (
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>{format(date, "EEEE, MMMM d, yyyy")}</span>
                    </div>
                  )}
                  {time && (
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>{time}</span>
                    </div>
                  )}
                  {staffName && (
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span>{staffName}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Calendar Export Buttons */}
              {showCalendarButtons && (
                <div className="border-t pt-4 mt-4">
                  <p className="text-sm text-muted-foreground mb-3 text-center">Add to your calendar</p>
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex flex-col items-center gap-1 h-auto py-2"
                      onClick={() => handleAddToGoogleCalendar()}
                    >
                      <Calendar className="h-4 w-4" />
                      <span className="text-xs">Google</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex flex-col items-center gap-1 h-auto py-2"
                      onClick={() => handleDownloadICS()}
                    >
                      <Download className="h-4 w-4" />
                      <span className="text-xs">Apple</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex flex-col items-center gap-1 h-auto py-2"
                      onClick={() => handleDownloadICS()}
                    >
                      <Download className="h-4 w-4" />
                      <span className="text-xs">Outlook</span>
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}

          {depositRequired && depositAmount && depositAmount > 0 && depositPaymentLink && (
            <div className="border-t-2 border-primary pt-4 mt-4">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-2">
                <CreditCard className="h-5 w-5" />
                <span className="font-semibold">Deposit Required</span>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                Please pay your {formatCurrency(depositAmount, currency)} deposit to secure your booking.
              </p>
              <Button
                className="w-full gap-2"
                onClick={() => window.open(depositPaymentLink, "_blank")}
              >
                Pay Deposit
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          )}

          <div className="text-center text-sm text-muted-foreground pt-4">
            <p>A confirmation has been sent to your phone.</p>
            <p>Please save your booking reference{isGroupBooking && groupBookings.length > 1 ? "s" : ""}.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
