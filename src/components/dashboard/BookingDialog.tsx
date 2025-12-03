import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface BookingDialogProps {
  businessId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface Service {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
}

interface Staff {
  id: string;
  name: string;
  role: string;
}

interface StaffService {
  staff_id: string;
  service_id: string;
}

export const BookingDialog = ({ businessId, open, onOpenChange, onSuccess }: BookingDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [allStaff, setAllStaff] = useState<Staff[]>([]);
  const [filteredStaff, setFilteredStaff] = useState<Staff[]>([]);
  const [staffServices, setStaffServices] = useState<StaffService[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [formData, setFormData] = useState({
    customer_name: "",
    customer_phone: "",
    service_id: "",
    staff_id: "",
    time: "",
    duration: 60,
    notes: "",
  });

  useEffect(() => {
    if (open) {
      loadServices();
      loadStaff();
      loadStaffServices();
    }
  }, [open, businessId]);

  // Filter staff when service changes
  useEffect(() => {
    if (!formData.service_id) {
      setFilteredStaff(allStaff);
      return;
    }

    // Get staff IDs that can perform the selected service
    const eligibleStaffIds = staffServices
      .filter(ss => ss.service_id === formData.service_id)
      .map(ss => ss.staff_id);

    // If no staff-service mappings exist, show all staff
    if (eligibleStaffIds.length === 0) {
      setFilteredStaff(allStaff);
    } else {
      setFilteredStaff(allStaff.filter(s => eligibleStaffIds.includes(s.id)));
    }

    // Reset staff selection if current staff can't do the service
    if (formData.staff_id && eligibleStaffIds.length > 0 && !eligibleStaffIds.includes(formData.staff_id)) {
      setFormData(prev => ({ ...prev, staff_id: "" }));
    }
  }, [formData.service_id, staffServices, allStaff]);

  const loadServices = async () => {
    const { data } = await supabase
      .from("services")
      .select("id, name, duration_minutes, price")
      .eq("business_id", businessId);
    if (data) setServices(data);
  };

  const loadStaff = async () => {
    const { data } = await supabase
      .from("staff")
      .select("id, name, role")
      .eq("business_id", businessId);
    if (data) {
      setAllStaff(data);
      setFilteredStaff(data);
    }
  };

  const loadStaffServices = async () => {
    const { data } = await supabase
      .from("staff_services")
      .select("staff_id, service_id");
    if (data) setStaffServices(data);
  };

  const handleServiceChange = (serviceId: string) => {
    const service = services.find(s => s.id === serviceId);
    setFormData({
      ...formData,
      service_id: serviceId,
      duration: service?.duration_minutes || 60,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedDate || !formData.time) {
      toast({
        title: "Error",
        description: "Please select both date and time.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Parse time (HH:MM format)
      const [hours, minutes] = formData.time.split(":").map(Number);
      const startTime = new Date(selectedDate);
      startTime.setHours(hours, minutes, 0, 0);
      
      const endTime = new Date(startTime.getTime() + formData.duration * 60000);

      const { data: { user } } = await supabase.auth.getUser();

      // Get user profile for display name
      let creatorName = "System";
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("first_name, last_name, email")
          .eq("user_id", user.id)
          .maybeSingle();
        
        if (profile) {
          creatorName = profile.first_name && profile.last_name 
            ? `${profile.first_name} ${profile.last_name}`
            : profile.email || "Staff";
        }

        // Check if user is staff or owner
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);
        
        const isStaff = roles?.some(r => r.role === "staff");
        if (isStaff) {
          creatorName = creatorName || "Staff Member";
        } else {
          creatorName = creatorName || "Business Owner";
        }
      }

      const { error } = await supabase
        .from("bookings")
        .insert([{
          business_id: businessId,
          customer_name: formData.customer_name,
          customer_phone: formData.customer_phone,
          service_id: formData.service_id || null,
          staff_id: formData.staff_id || null,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          notes: formData.notes,
          status: "confirmed",
          created_by: creatorName,
          created_by_user_id: user?.id || null,
        }]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Booking created successfully.",
      });
      
      onSuccess();
      onOpenChange(false);
      setFormData({
        customer_name: "",
        customer_phone: "",
        service_id: "",
        staff_id: "",
        time: "",
        duration: 60,
        notes: "",
      });
      setSelectedDate(undefined);
    } catch (error: any) {
      console.error("Booking creation error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create booking.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Booking</DialogTitle>
          <DialogDescription>Create a new booking manually</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="customer_name">Customer Name *</Label>
            <Input
              id="customer_name"
              value={formData.customer_name}
              onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer_phone">Customer Phone *</Label>
            <Input
              id="customer_phone"
              type="tel"
              value={formData.customer_phone}
              onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="service">Service</Label>
            <Select
              value={formData.service_id}
              onValueChange={handleServiceChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select service" />
              </SelectTrigger>
              <SelectContent>
                {services.map((service) => (
                  <SelectItem key={service.id} value={service.id}>
                    {service.name} - {service.duration_minutes} mins
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="staff">Staff Member</Label>
            <Select
              value={formData.staff_id}
              onValueChange={(value) => setFormData({ ...formData, staff_id: value })}
              disabled={filteredStaff.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder={filteredStaff.length === 0 ? "No staff available for this service" : "Select staff"} />
              </SelectTrigger>
              <SelectContent>
                {filteredStaff.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.name} - {member.role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {formData.service_id && filteredStaff.length === 0 && (
              <p className="text-xs text-muted-foreground">No staff assigned to this service yet</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Date *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="time">Time * (HH:MM)</Label>
            <Input
              id="time"
              type="time"
              value={formData.time}
              onChange={(e) => setFormData({ ...formData, time: e.target.value })}
              required
              step="60"
            />
            <p className="text-xs text-muted-foreground">You can enter any time (e.g., 12:12)</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="duration">Duration (minutes) *</Label>
            <Input
              id="duration"
              type="number"
              value={formData.duration}
              onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
              min="5"
              step="5"
              required
            />
            {formData.service_id && (
              <p className="text-xs text-muted-foreground">
                Auto-set from service duration. You can adjust if needed.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Any special requests or notes..."
            />
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Booking"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};