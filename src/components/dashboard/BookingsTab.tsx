import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BookingDialog } from "./BookingDialog";
import { useState } from "react";

interface BookingsTabProps {
  businessId: string;
}

export const BookingsTab = ({ businessId }: BookingsTabProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleBookingSuccess = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Bookings Management</CardTitle>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Booking
          </Button>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <Calendar className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg mb-2">No bookings yet</p>
            <p className="text-sm">Customer bookings will appear here once Aivia starts taking appointments</p>
          </div>
        </CardContent>
      </Card>

      <BookingDialog
        businessId={businessId}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={handleBookingSuccess}
      />
    </div>
  );
};