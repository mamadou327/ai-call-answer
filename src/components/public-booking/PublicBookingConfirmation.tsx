import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Calendar, Clock, User, CreditCard, ExternalLink } from "lucide-react";
import { format } from "date-fns";

interface PublicBookingConfirmationProps {
  businessName: string;
  bookingCode: string;
  serviceName?: string;
  staffName?: string;
  date?: Date | null;
  time?: string | null;
  depositRequired: boolean;
  depositAmount?: number;
  depositPaymentLink?: string;
  currency: string;
}

const formatCurrency = (amount: number, currency: string) => {
  const symbols: Record<string, string> = {
    GBP: "£",
    USD: "$",
    EUR: "€",
  };
  return `${symbols[currency] || currency}${amount.toFixed(2)}`;
};

export const PublicBookingConfirmation = ({
  businessName,
  bookingCode,
  serviceName,
  staffName,
  date,
  time,
  depositRequired,
  depositAmount,
  depositPaymentLink,
  currency,
}: PublicBookingConfirmationProps) => {
  return (
    <div className="max-w-md mx-auto space-y-6">
      <Card className="border-2 border-primary shadow-sm">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
            <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
          </div>
          <CardTitle className="text-2xl">Booking Confirmed!</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-muted-foreground">
            Your appointment at <span className="font-medium">{businessName}</span> has been booked.
          </p>

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
            <p>Please save your booking reference.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
