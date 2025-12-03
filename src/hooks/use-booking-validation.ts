import { supabase } from "@/integrations/supabase/client";

interface CheckOverlapParams {
  businessId: string;
  staffId: string;
  startTime: Date;
  endTime: Date;
  excludeBookingId?: string;
}

export const useBookingValidation = () => {
  const checkStaffOverlap = async ({
    businessId,
    staffId,
    startTime,
    endTime,
    excludeBookingId,
  }: CheckOverlapParams): Promise<{ hasOverlap: boolean; conflictingBooking?: any }> => {
    if (!staffId) {
      return { hasOverlap: false };
    }

    // Query for overlapping bookings for the same staff
    // Overlap condition: existing.start < new.end AND existing.end > new.start
    let query = supabase
      .from("bookings")
      .select("id, customer_name, start_time, end_time")
      .eq("business_id", businessId)
      .eq("staff_id", staffId)
      .neq("status", "cancelled")
      .lt("start_time", endTime.toISOString())
      .gt("end_time", startTime.toISOString());

    if (excludeBookingId) {
      query = query.neq("id", excludeBookingId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error checking overlap:", error);
      return { hasOverlap: false };
    }

    if (data && data.length > 0) {
      return { hasOverlap: true, conflictingBooking: data[0] };
    }

    return { hasOverlap: false };
  };

  return { checkStaffOverlap };
};
