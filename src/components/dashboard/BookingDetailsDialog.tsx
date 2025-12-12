import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, User, Clock, FileText, Calendar as CalendarIcon, CheckCircle, RotateCcw, Edit, Save, X } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface BookingDetailsDialogProps {
  booking: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: () => void;
  isStaffView?: boolean;
}

export const BookingDetailsDialog = ({ booking, open, onOpenChange, onDelete, isStaffView = false }: BookingDetailsDialogProps) => {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [newStartTime, setNewStartTime] = useState("");
  const [editedNotes, setEditedNotes] = useState("");

  useEffect(() => {
    if (booking) {
      setEditedNotes(booking.notes || "");
    }
  }, [booking]);

  if (!booking) return null;

  const handleDelete = async () => {
    if (!confirm(t("bookingDetails.confirmCancel"))) {
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
      .from("bookings")
      .update({ 
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancelled_by_user_id: user?.id || null
      })
      .eq("id", booking.id);

    if (error) {
      toast({
        title: t("common.error"),
        description: t("bookingDetails.cancelError"),
        variant: "destructive",
      });
    } else {
      // Send cancellation email
      try {
        await supabase.functions.invoke("send-booking-email", {
          body: { businessId: booking.business_id, bookingId: booking.id, type: "cancellation" }
        });
      } catch (emailError) {
        console.warn("Failed to send cancellation email:", emailError);
      }
      
      toast({
        title: t("common.success"),
        description: t("bookingDetails.cancelSuccess"),
      });
      onDelete();
      onOpenChange(false);
    }
  };

  const handleMarkCompleted = async () => {
    const { error } = await supabase
      .from("bookings")
      .update({ status: "completed" })
      .eq("id", booking.id);

    if (error) {
      toast({
        title: t("common.error"),
        description: "Failed to mark booking as completed",
        variant: "destructive",
      });
    } else {
      toast({
        title: t("common.success"),
        description: "Booking marked as completed",
      });
      onDelete();
      onOpenChange(false);
    }
  };

  const handleReinstate = async () => {
    const { error } = await supabase
      .from("bookings")
      .update({ 
        status: "confirmed",
        cancelled_at: null,
        cancelled_by_user_id: null
      })
      .eq("id", booking.id);

    if (error) {
      toast({
        title: t("common.error"),
        description: "Failed to reinstate booking",
        variant: "destructive",
      });
    } else {
      toast({
        title: t("common.success"),
        description: "Booking reinstated successfully",
      });
      onDelete();
      onOpenChange(false);
    }
  };

  const handleReschedule = async () => {
    if (!newStartTime) {
      toast({
        title: t("common.error"),
        description: t("bookingDetails.selectNewTime"),
        variant: "destructive",
      });
      return;
    }

    // Calculate duration from original booking and apply to new start time
    const originalStart = new Date(booking.start_time);
    const originalEnd = new Date(booking.end_time);
    const durationMs = originalEnd.getTime() - originalStart.getTime();
    
    const newStart = new Date(newStartTime);
    const newEnd = new Date(newStart.getTime() + durationMs);

    const { error } = await supabase
      .from("bookings")
      .update({ 
        start_time: newStart.toISOString(),
        end_time: newEnd.toISOString(),
      })
      .eq("id", booking.id);

    if (error) {
      toast({
        title: t("common.error"),
        description: t("bookingDetails.rescheduleError"),
        variant: "destructive",
      });
    } else {
      toast({
        title: t("common.success"),
        description: t("bookingDetails.rescheduleSuccess"),
      });
      onDelete();
      onOpenChange(false);
      setIsRescheduling(false);
    }
  };

  const handleSaveNotes = async () => {
    const { error } = await supabase
      .from("bookings")
      .update({ notes: editedNotes.trim() || null })
      .eq("id", booking.id);

    if (error) {
      toast({
        title: t("common.error"),
        description: "Failed to save notes",
        variant: "destructive",
      });
    } else {
      toast({
        title: t("common.success"),
        description: "Notes saved successfully",
      });
      setIsEditingNotes(false);
      onDelete(); // Refresh data
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === "confirmed") return "default";
    if (status === "cancelled") return "destructive";
    if (status === "completed") return "secondary";
    return "secondary";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("bookingDetails.title")}</DialogTitle>
          <DialogDescription>{t("bookingDetails.description")}</DialogDescription>
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
                    <p className="text-sm font-medium">{t("bookings.service")}</p>
                    <p className="text-sm text-muted-foreground">{booking.service.name}</p>
                  </div>
                </div>
              )}

              {booking.staff && (
                <div className="flex items-center gap-3">
                  <User className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{t("bookings.staffMember")}</p>
                    <p className="text-sm text-muted-foreground">{booking.staff.name}</p>
                  </div>
                </div>
              )}

              {/* Notes section with edit capability */}
              <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{t("bookings.notes")}</p>
                    {!isEditingNotes && booking.status !== "cancelled" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2"
                        onClick={() => setIsEditingNotes(true)}
                      >
                        <Edit className="w-3 h-3 mr-1" />
                        Edit
                      </Button>
                    )}
                  </div>
                  {isEditingNotes ? (
                    <div className="space-y-2 mt-1">
                      <Textarea
                        value={editedNotes}
                        onChange={(e) => setEditedNotes(e.target.value)}
                        placeholder="Add notes about this booking..."
                        className="min-h-[80px] text-sm"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleSaveNotes}>
                          <Save className="w-3 h-3 mr-1" />
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setIsEditingNotes(false);
                            setEditedNotes(booking.notes || "");
                          }}
                        >
                          <X className="w-3 h-3 mr-1" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {booking.notes || "No notes"}
                    </p>
                  )}
                </div>
              </div>

              {booking.booking_code && (
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Booking Code</p>
                    <p className="text-sm font-mono font-semibold text-primary">{booking.booking_code}</p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <Badge variant="outline" className="text-xs">
                  {t("bookings.createdBy")}: {booking.created_by}
                </Badge>
                <Badge variant={getStatusBadge(booking.status)}>
                  {booking.status === "completed" ? "Completed" : t(`bookings.${booking.status}`)}
                </Badge>
              </div>
            </div>
          </div>

          {isRescheduling && (
            <div className="space-y-4 pt-4 border-t">
              <h4 className="font-medium">{t("bookingDetails.rescheduleTitle")}</h4>
              <div className="space-y-2">
                <Label>{t("bookingDetails.newStartTime")}</Label>
                <Input
                  type="datetime-local"
                  value={newStartTime}
                  onChange={(e) => setNewStartTime(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {t("bookingDetails.durationKept")}
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              {t("common.close")}
            </Button>
            
            {/* Cancelled booking - show reinstate */}
            {booking.status === "cancelled" && (
              <Button 
                variant="outline" 
                onClick={handleReinstate}
                className="flex-1 border-green-500 text-green-600 hover:bg-green-50"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Reinstate
              </Button>
            )}

            {/* Active booking - show done, reschedule, cancel */}
            {!isRescheduling && booking.status !== "cancelled" && booking.status !== "completed" && (
              <>
                <Button 
                  variant="secondary" 
                  onClick={handleMarkCompleted}
                  className="flex-1"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Done
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setIsRescheduling(true)}
                  className="flex-1"
                >
                  <CalendarIcon className="w-4 h-4 mr-2" />
                  {t("bookingDetails.reschedule")}
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={handleDelete}
                  className="flex-1"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {t("bookingDetails.cancelBooking")}
                </Button>
              </>
            )}
            
            {isRescheduling && (
              <>
                <Button 
                  variant="outline" 
                  onClick={() => setIsRescheduling(false)}
                  className="flex-1"
                >
                  {t("common.cancel")}
                </Button>
                <Button 
                  onClick={handleReschedule}
                  className="flex-1"
                >
                  {t("bookingDetails.confirmReschedule")}
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};