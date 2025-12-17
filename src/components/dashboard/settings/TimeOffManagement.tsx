import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Calendar } from "lucide-react";
import { format } from "date-fns";

interface TimeOffManagementProps {
  businessId: string;
  onUpdate: () => void;
}

interface TimeOff {
  id: string;
  staff_id: string;
  start_time: string;
  end_time: string;
  reason: string;
  notes: string;
  status: string;
  staff?: { name: string; role: string };
}

interface Staff {
  id: string;
  name: string;
  role: string;
}

export const TimeOffManagement = ({ businessId, onUpdate }: TimeOffManagementProps) => {
  const { toast } = useToast();
  const [timeOffs, setTimeOffs] = useState<TimeOff[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    staff_id: "",
    start_time: "",
    end_time: "",
    reason: "day_off",
    notes: "",
  });

  useEffect(() => {
    loadTimeOffs();
    loadStaff();
  }, [businessId]);

  const loadTimeOffs = async () => {
    const { data } = await supabase
      .from("staff_time_off")
      .select(`
        *,
        staff:staff_id (
          name,
          role
        )
      `)
      .eq("business_id", businessId)
      .order("start_time", { ascending: true });
    
    if (data) setTimeOffs(data);
  };

  const loadStaff = async () => {
    const { data } = await supabase
      .from("staff")
      .select("id, name, role")
      .eq("business_id", businessId);
    
    if (data) setStaff(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const start = new Date(formData.start_time);
      const end = new Date(formData.end_time);

      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        throw new Error("Please enter a valid start and end date/time.");
      }
      if (end <= start) {
        throw new Error("End time must be after start time.");
      }

      // IMPORTANT: datetime-local has no timezone. Convert local time -> ISO (UTC) before saving.
      const { error } = await supabase
        .from("staff_time_off")
        .insert([
          {
            business_id: businessId,
            staff_id: formData.staff_id,
            start_time: start.toISOString(),
            end_time: end.toISOString(),
            reason: formData.reason,
            notes: formData.notes,
            status: "approved",
          },
        ]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Time off added successfully.",
      });

      setDialogOpen(false);
      setFormData({
        staff_id: "",
        start_time: "",
        end_time: "",
        reason: "day_off",
        notes: "",
      });
      loadTimeOffs();
      onUpdate();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("staff_time_off")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Time off removed successfully.",
      });

      loadTimeOffs();
      onUpdate();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Time Off Management</CardTitle>
            <CardDescription>
              Manage staff breaks, days off, and sick leave. During these times, staff won't be booked.
            </CardDescription>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Time Off
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {timeOffs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No time off scheduled yet.</p>
        ) : (
          <div className="space-y-2">
            {timeOffs.map((timeOff) => (
              <div
                key={timeOff.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center gap-4">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">
                      {timeOff.staff?.name} - {timeOff.staff?.role}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(timeOff.start_time), "PPP p")} - {format(new Date(timeOff.end_time), "PPP p")}
                    </p>
                    <p className="text-sm text-muted-foreground capitalize">
                      {timeOff.reason.replace("_", " ")}
                      {timeOff.notes && ` - ${timeOff.notes}`}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(timeOff.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Time Off</DialogTitle>
            <DialogDescription>
              Schedule time when a staff member won't be available for bookings
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Staff Member *</Label>
              <Select
                value={formData.staff_id}
                onValueChange={(value) => setFormData({ ...formData, staff_id: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select staff" />
                </SelectTrigger>
                <SelectContent>
                  {staff.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name} - {member.role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Start Date & Time *</Label>
              <Input
                type="datetime-local"
                value={formData.start_time}
                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>End Date & Time *</Label>
              <Input
                type="datetime-local"
                value={formData.end_time}
                onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Reason *</Label>
              <Select
                value={formData.reason}
                onValueChange={(value) => setFormData({ ...formData, reason: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day_off">Day Off</SelectItem>
                  <SelectItem value="sick_leave">Sick Leave</SelectItem>
                  <SelectItem value="break">Break</SelectItem>
                  <SelectItem value="vacation">Vacation</SelectItem>
                  <SelectItem value="personal">Personal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Any additional details..."
              />
            </div>

            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Adding..." : "Add Time Off"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
};