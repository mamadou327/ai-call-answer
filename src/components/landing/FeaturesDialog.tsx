import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Phone, Calendar, MessageSquare, Clock, Brain, BarChart3 } from "lucide-react";

interface FeaturesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FeaturesDialog = ({ open, onOpenChange }: FeaturesDialogProps) => {
  const features = [
    {
      icon: Phone,
      title: "AI Phone Answering",
      description: "Never miss a call. Our AI answers 24/7, handles inquiries, and takes messages professionally."
    },
    {
      icon: Calendar,
      title: "Smart Booking",
      description: "Customers can book appointments directly through phone calls. Seamless calendar integration."
    },
    {
      icon: MessageSquare,
      title: "SMS Notifications",
      description: "Automatic confirmations, reminders, and follow-ups to reduce no-shows."
    },
    {
      icon: Clock,
      title: "24/7 Availability",
      description: "Your business is always reachable, even outside working hours and on holidays."
    },
    {
      icon: Brain,
      title: "Natural Conversations",
      description: "Advanced AI that understands context and handles complex customer requests naturally."
    },
    {
      icon: BarChart3,
      title: "Analytics Dashboard",
      description: "Track calls, bookings, and customer insights to grow your business."
    }
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Features</DialogTitle>
          <DialogDescription>
            Everything you need to manage calls and bookings effortlessly
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {features.map((feature, index) => (
            <div key={index} className="flex gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors">
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <feature.icon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold text-foreground">{feature.title}</h4>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FeaturesDialog;
