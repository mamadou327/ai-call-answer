import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, addDays, isBefore, startOfDay } from "date-fns";

interface TimeSlot {
  time: string;
  available: boolean;
  availableStaff: string[];
}

interface BookedSlot {
  staffId: string | null;
  date: string; // yyyy-MM-dd format
  time: string;
  durationMinutes: number;
}

interface PublicDateTimePickerProps {
  businessSlug: string;
  serviceId: string;
  staffId?: string;
  serviceDuration: number;
  onSelect: (date: Date, time: string) => void;
  onBack: () => void;
  bookedSlots?: BookedSlot[]; // Already booked slots from cart to exclude
}

export const PublicDateTimePicker = ({
  businessSlug,
  serviceId,
  staffId,
  serviceDuration,
  onSelect,
  onBack,
  bookedSlots = [],
}: PublicDateTimePickerProps) => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = startOfDay(new Date());
  const maxDate = addDays(today, 60); // Allow booking up to 60 days in advance

  // Fetch available slots when date is selected
  useEffect(() => {
    const fetchSlots = async () => {
      if (!selectedDate) return;

      setLoading(true);
      setError(null);

      try {
        const { data, error } = await supabase.functions.invoke("public-check-availability", {
          body: {
            businessSlug,
            date: format(selectedDate, "yyyy-MM-dd"),
            serviceId,
            staffId,
          },
        });

        if (error) throw error;

        if (data.message && (!data.slots || data.slots.length === 0)) {
          setError(data.message);
          setTimeSlots([]);
        } else {
          setTimeSlots(data.slots || []);
        }
      } catch (err: any) {
        console.error("Error fetching availability:", err);
        setError("Failed to load available times");
        setTimeSlots([]);
      } finally {
        setLoading(false);
      }
    };

    fetchSlots();
  }, [selectedDate, businessSlug, serviceId, staffId]);

  // Filter out slots that overlap with appointments already in the cart for the same staff
  const availableSlots = timeSlots.filter((slot) => {
    if (!slot.available) return false;
    if (!selectedDate) return true;

    const dateStr = format(selectedDate, "yyyy-MM-dd");

    const [slotHours, slotMinutes] = slot.time.split(":").map(Number);
    const candidateStart = new Date(selectedDate);
    candidateStart.setHours(slotHours, slotMinutes, 0, 0);
    const candidateEnd = new Date(candidateStart.getTime() + serviceDuration * 60 * 1000);

    const overlapsBooked = bookedSlots.some((booked) => {
      if (booked.date !== dateStr) return false;

      const [bookedHours, bookedMinutes] = booked.time.split(":").map(Number);
      const bookedStart = new Date(selectedDate);
      bookedStart.setHours(bookedHours, bookedMinutes, 0, 0);
      const bookedEnd = new Date(bookedStart.getTime() + booked.durationMinutes * 60 * 1000);

      const overlaps = candidateStart < bookedEnd && candidateEnd > bookedStart;
      if (!overlaps) return false;

      // If a specific staff is selected, only block overlaps for that staff
      if (staffId) {
        return booked.staffId === staffId || booked.staffId === null;
      }

      // If no staff is selected, block overlaps regardless (can't guarantee a different staff)
      return true;
    });

    return !overlapsBooked;
  });

  const handleTimeSelect = (time: string) => {
    if (selectedDate) {
      onSelect(selectedDate, time);
    }
  };

  return (
    <div className="space-y-6">
      <Button variant="outline" onClick={onBack} className="gap-2">
        <ArrowLeft className="h-4 w-4" />
        Back to staff selection
      </Button>

      <div>
        <h2 className="text-xl font-bold mb-2">Select Date & Time</h2>
        <p className="text-muted-foreground">
          Choose when you'd like your appointment
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Calendar */}
        <Card className="border-2 border-primary shadow-sm">
          <CardContent className="p-4">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              disabled={(date) => isBefore(date, today) || date > maxDate}
              className="rounded-md"
            />
          </CardContent>
        </Card>

        {/* Time slots */}
        <Card className="border-2 border-primary shadow-sm">
          <CardContent className="p-4">
            {!selectedDate ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Select a date to see available times
              </div>
            ) : loading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                {error}
              </div>
            ) : availableSlots.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                No available times for this date
              </div>
            ) : (
              <div className="space-y-2">
                <h3 className="font-semibold mb-3">
                  Available times for {format(selectedDate, "EEEE, MMMM d")}
                </h3>
                <div className="grid grid-cols-3 gap-2 max-h-[300px] overflow-y-auto">
                  {availableSlots.map((slot) => (
                    <Button
                      key={slot.time}
                      variant="outline"
                      className="border-2"
                      onClick={() => handleTimeSelect(slot.time)}
                    >
                      {slot.time}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
