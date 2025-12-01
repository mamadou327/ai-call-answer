import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, User, Clock, Phone, FileText } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface BookingDetailsDialogProps {
  booking: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: () => void;
}

export const BookingDetailsDialog = ({ booking, open, onOpenChange, onDelete }: BookingDetailsDialogProps) => {
  const { toast } = useToast();

  if (!booking) return null;

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to cancel this booking?")) {
      return;
    }

    const { error } = await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", booking.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to cancel booking.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Booking cancelled successfully.",
      });
      onDelete();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Booking Details</DialogTitle>
          <DialogDescription>Full booking information</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-3 flex-1">
              <div className="flex items-center gap-3">
                <User className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">{booking.customer_name}</p>
                  <p className="text-sm text-muted-foreground">{booking.customer_phone}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">
                    {format(new Date(booking.start_time), "EEEE, MMMM d, yyyy")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(booking.start_time), "h:mm a")} - {format(new Date(booking.end_time), "h:mm a")}
                  </p>
                </div>
              </div>

              {booking.service && (
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Service</p>
                    <p className="text-sm text-muted-foreground">{booking.service.name}</p>
                  </div>
                </div>
              )}

              {booking.staff && (
                <div className="flex items-center gap-3">
                  <User className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Staff Member</p>
                    <p className="text-sm text-muted-foreground">{booking.staff.name}</p>
                  </div>
                </div>
              )}

              {booking.notes && (
                <div className="flex items-start gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Notes</p>
                    <p className="text-sm text-muted-foreground">{booking.notes}</p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <Badge variant="outline" className="text-xs">
                  Created by: {booking.created_by}
                </Badge>
                <Badge
                  variant={
                    booking.status === "confirmed"
                      ? "default"
                      : booking.status === "cancelled"
                      ? "destructive"
                      : "secondary"
                  }
                >
                  {booking.status}
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Close
            </Button>
            {booking.status !== "cancelled" && (
              <Button 
                variant="destructive" 
                onClick={handleDelete}
                className="flex-1"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Cancel Booking
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};