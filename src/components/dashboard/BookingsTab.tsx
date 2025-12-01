import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export const BookingsTab = () => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Bookings Management</CardTitle>
          <Button>
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
    </div>
  );
};