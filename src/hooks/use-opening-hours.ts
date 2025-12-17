import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface OpeningHour {
  day_of_week: number;
  is_closed: boolean;
  open_time: string | null;
  close_time: string | null;
}

export const useOpeningHours = (businessId: string) => {
  const [openingHours, setOpeningHours] = useState<OpeningHour[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadOpeningHours = async () => {
      if (!businessId) return;
      
      const { data } = await supabase
        .from("opening_hours")
        .select("day_of_week, is_closed, open_time, close_time")
        .eq("business_id", businessId)
        .order("day_of_week");

      if (data && data.length > 0) {
        setOpeningHours(data);
      } else {
        // Default: all days closed if no opening hours set
        setOpeningHours(
          Array.from({ length: 7 }, (_, i) => ({
            day_of_week: i,
            is_closed: true,
            open_time: null,
            close_time: null,
          }))
        );
      }
      setLoading(false);
    };

    loadOpeningHours();
  }, [businessId]);

  const isDayClosed = (date: Date): boolean => {
    // DB uses JS Date.getDay() convention: Sunday = 0 ... Saturday = 6
    const jsDay = date.getDay();
    const dayHours = openingHours.find((h) => h.day_of_week === jsDay);
    return dayHours?.is_closed ?? true;
  };

  const getHoursForDate = (
    date: Date
  ): { openTime: string | null; closeTime: string | null; isClosed: boolean } => {
    const jsDay = date.getDay();
    const dayHours = openingHours.find((h) => h.day_of_week === jsDay);
    return {
      openTime: dayHours?.open_time ?? null,
      closeTime: dayHours?.close_time ?? null,
      isClosed: dayHours?.is_closed ?? true,
    };
  };

  const isTimeWithinHours = (date: Date, time: string): boolean => {
    const { openTime, closeTime, isClosed } = getHoursForDate(date);
    
    if (isClosed || !openTime || !closeTime) return false;
    
    return time >= openTime && time < closeTime;
  };

  return {
    openingHours,
    loading,
    isDayClosed,
    getHoursForDate,
    isTimeWithinHours,
  };
};
