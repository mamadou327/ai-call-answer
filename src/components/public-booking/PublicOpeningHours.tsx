import { Clock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface OpeningHour {
  day_of_week: number;
  is_closed: boolean;
  open_time: string | null;
  close_time: string | null;
}

interface PublicOpeningHoursProps {
  openingHours: OpeningHour[];
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const formatTime = (time: string | null): string => {
  if (!time) return "";
  const [hours, minutes] = time.split(":");
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
};

export const PublicOpeningHours = ({ openingHours }: PublicOpeningHoursProps) => {
  // Sort by day of week (Monday first)
  const sortedHours = [...openingHours].sort((a, b) => {
    // Convert to Monday-first ordering (0=Mon, 6=Sun)
    const aDay = a.day_of_week === 0 ? 6 : a.day_of_week - 1;
    const bDay = b.day_of_week === 0 ? 6 : b.day_of_week - 1;
    return aDay - bDay;
  });

  // Get today's day of week
  const today = new Date().getDay();
  const todayHours = openingHours.find((h) => h.day_of_week === today);

  const getTodayStatus = () => {
    if (!todayHours || todayHours.is_closed) {
      return "Closed today";
    }
    return `Open today: ${formatTime(todayHours.open_time)} - ${formatTime(todayHours.close_time)}`;
  };

  if (openingHours.length === 0) return null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
          <Clock className="h-4 w-4" />
          {getTodayStatus()}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Opening Hours</DialogTitle>
          <DialogDescription>Our weekly schedule</DialogDescription>
        </DialogHeader>
        <div className="space-y-1 mt-4">
          {sortedHours.map((hour) => (
            <div
              key={hour.day_of_week}
              className={`flex justify-between items-center py-2 border-b border-border/50 last:border-0 ${
                hour.day_of_week === today ? "font-medium" : ""
              }`}
            >
              <span className={hour.day_of_week === today ? "text-primary" : "text-muted-foreground"}>
                {DAY_NAMES[hour.day_of_week]}
                {hour.day_of_week === today && " (Today)"}
              </span>
              <span className={hour.is_closed ? "text-muted-foreground" : ""}>
                {hour.is_closed ? "Closed" : `${formatTime(hour.open_time)} - ${formatTime(hour.close_time)}`}
              </span>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};
