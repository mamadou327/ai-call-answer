import { useState, useEffect, useRef } from "react";
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
import { CalendarIcon, AlertCircle, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOpeningHours } from "@/hooks/use-opening-hours";
import { useBookingValidation } from "@/hooks/use-booking-validation";

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

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  preferred_staff_id: string | null;
}

interface LastBooking {
  service_id: string | null;
  staff_id: string | null;
}

export const BookingDialog = ({ businessId, open, onOpenChange, onSuccess }: BookingDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [allStaff, setAllStaff] = useState<Staff[]>([]);
  const [filteredStaff, setFilteredStaff] = useState<Staff[]>([]);
  const [staffServices, setStaffServices] = useState<StaffService[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [timeError, setTimeError] = useState<string | null>(null);
  
  // Customer autocomplete state
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const customerInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const [formData, setFormData] = useState({
    customer_name: "",
    customer_phone: "",
    service_id: "",
    staff_id: "",
    time: "",
    duration: 60,
    notes: "",
  });

  const { isDayClosed, getHoursForDate, isTimeWithinHours } = useOpeningHours(businessId);
  const { checkStaffOverlap } = useBookingValidation();

  useEffect(() => {
    if (open) {
      loadServices();
      loadStaff();
      loadStaffServices();
      loadCustomers();
    }
  }, [open, businessId]);

  // Load customers for autocomplete
  const loadCustomers = async () => {
    const { data } = await supabase
      .from("customers")
      .select("id, name, phone, email, preferred_staff_id")
      .eq("business_id", businessId)
      .eq("is_blocked", false);
    if (data) setCustomers(data);
  };

  // Filter customers based on input
  useEffect(() => {
    if (formData.customer_name.length >= 2 && !selectedCustomerId) {
      const searchTerm = formData.customer_name.toLowerCase();
      const matches = customers.filter(c => 
        c.name.toLowerCase().includes(searchTerm)
      );
      setFilteredCustomers(matches.slice(0, 5)); // Limit to 5 results
      setShowCustomerDropdown(matches.length > 0);
    } else {
      setFilteredCustomers([]);
      setShowCustomerDropdown(false);
    }
  }, [formData.customer_name, customers, selectedCustomerId]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(e.target as Node) &&
        customerInputRef.current &&
        !customerInputRef.current.contains(e.target as Node)
      ) {
        setShowCustomerDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle customer selection from dropdown
  const handleSelectCustomer = async (customer: Customer) => {
    setSelectedCustomerId(customer.id);
    setShowCustomerDropdown(false);
    
    // Get last booking for this customer to get their usual service
    const { data: lastBooking } = await supabase
      .from("bookings")
      .select("service_id, staff_id")
      .eq("business_id", businessId)
      .eq("customer_phone", customer.phone)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Determine staff - prefer customer's preferred staff, then last booking's staff
    const staffId = customer.preferred_staff_id || lastBooking?.staff_id || "";
    const serviceId = lastBooking?.service_id || "";
    
    // Get duration from service if available
    const service = services.find(s => s.id === serviceId);
    
    setFormData(prev => ({
      ...prev,
      customer_name: customer.name,
      customer_phone: customer.phone || "",
      staff_id: staffId,
      service_id: serviceId,
      duration: service?.duration_minutes || prev.duration,
    }));
  };

  // Clear customer selection when name is manually edited
  const handleCustomerNameChange = (value: string) => {
    setSelectedCustomerId(null);
    setFormData({ ...formData, customer_name: value });
  };

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

    // If no staff-service mappings exist for this service, show all staff
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

  // Validate time when date or time changes
  useEffect(() => {
    if (selectedDate && formData.time) {
      const { isClosed, openTime, closeTime } = getHoursForDate(selectedDate);
      
      if (isClosed) {
        setTimeError("Business is closed on this day");
      } else if (!isTimeWithinHours(selectedDate, formData.time)) {
        setTimeError(`Business hours: ${openTime} - ${closeTime}`);
      } else {
        setTimeError(null);
      }
    } else {
      setTimeError(null);
    }
  }, [selectedDate, formData.time, getHoursForDate, isTimeWithinHours]);

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

    // Check if day is closed
    if (isDayClosed(selectedDate)) {
      toast({
        title: "Error",
        description: "Cannot book on a closed day.",
        variant: "destructive",
      });
      return;
    }

    // Check if time is within opening hours
    if (!isTimeWithinHours(selectedDate, formData.time)) {
      const { openTime, closeTime } = getHoursForDate(selectedDate);
      toast({
        title: "Error",
        description: `Selected time is outside business hours (${openTime} - ${closeTime}).`,
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

      // Check for double-booking if staff is selected
      if (formData.staff_id) {
        const { hasOverlap, conflictingBooking } = await checkStaffOverlap({
          businessId,
          staffId: formData.staff_id,
          startTime,
          endTime,
        });

        if (hasOverlap) {
          toast({
            title: "Double Booking Detected",
            description: `This staff member already has a booking at this time (${conflictingBooking?.customer_name} at ${format(new Date(conflictingBooking?.start_time), "h:mm a")}).`,
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
      }

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

      // Note: booking_code is auto-generated by database trigger
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
          status: "confirmed" as const,
          created_by: creatorName,
          created_by_user_id: user?.id || null,
        } as any]);

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
      setSelectedCustomerId(null);
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

  // Disable past dates and closed days
  const isDateDisabled = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (date < today) return true;
    return isDayClosed(date);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Booking</DialogTitle>
          <DialogDescription>Create a new booking manually</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2 relative">
            <Label htmlFor="customer_name">Customer Name *</Label>
            <div className="relative">
              <Input
                ref={customerInputRef}
                id="customer_name"
                value={formData.customer_name}
                onChange={(e) => handleCustomerNameChange(e.target.value)}
                onFocus={() => {
                  if (formData.customer_name.length >= 2 && filteredCustomers.length > 0) {
                    setShowCustomerDropdown(true);
                  }
                }}
                required
                autoComplete="off"
                placeholder="Start typing to search existing customers..."
              />
              {selectedCustomerId && (
                <User className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
              )}
            </div>
            
            {/* Customer autocomplete dropdown */}
            {showCustomerDropdown && filteredCustomers.length > 0 && (
              <div
                ref={dropdownRef}
                className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-y-auto"
              >
                {filteredCustomers.map((customer) => (
                  <button
                    key={customer.id}
                    type="button"
                    className="w-full px-3 py-2 text-left hover:bg-accent transition-colors flex flex-col"
                    onClick={() => handleSelectCustomer(customer)}
                  >
                    <span className="font-medium">{customer.name}</span>
                    {customer.phone && (
                      <span className="text-xs text-muted-foreground">{customer.phone}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
            
            {selectedCustomerId && (
              <p className="text-xs text-primary">
                Returning customer - details auto-filled (you can edit them)
              </p>
            )}
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
                  disabled={isDateDisabled}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            {selectedDate && isDayClosed(selectedDate) && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Business is closed on this day
              </p>
            )}
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
            {timeError ? (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {timeError}
              </p>
            ) : selectedDate && (
              <p className="text-xs text-muted-foreground">
                {(() => {
                  const { openTime, closeTime, isClosed } = getHoursForDate(selectedDate);
                  return isClosed ? "Closed" : `Open: ${openTime} - ${closeTime}`;
                })()}
              </p>
            )}
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
            <Button type="submit" disabled={loading || !!timeError}>
              {loading ? "Creating..." : "Create Booking"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
