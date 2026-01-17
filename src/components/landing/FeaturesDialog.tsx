import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Phone, Calendar, MessageSquare, Clock, Brain, BarChart3, Globe, UtensilsCrossed, Bell, Users, Mic, ShieldCheck } from "lucide-react";

interface FeaturesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FeaturesDialog = ({ open, onOpenChange }: FeaturesDialogProps) => {
  const features = [
    {
      icon: Clock,
      title: "24/7 Instant Availability",
      description: "Answers every call in under 2 seconds, day or night. No hold times, no missed calls."
    },
    {
      icon: Calendar,
      title: "Smart Booking",
      description: "Automatically schedules reservations and takes orders while checking real-time availability."
    },
    {
      icon: BarChart3,
      title: "Live Analytics",
      description: "Track call volumes, booking rates, and revenue insights from your dashboard in real-time."
    },
    {
      icon: Globe,
      title: "Multi-language Support",
      description: "Serve customers in their preferred language with automatic detection and response."
    },
    {
      icon: UtensilsCrossed,
      title: "Order Taking",
      description: "Takes food orders accurately with full menu knowledge, including modifications and special requests."
    },
    {
      icon: Bell,
      title: "Appointment Reminders",
      description: "Automated SMS and email confirmations reduce no-shows and keep your schedule full."
    },
    {
      icon: Users,
      title: "CRM Integration",
      description: "Syncs customer data automatically so you know who's calling and their preferences instantly."
    },
    {
      icon: Mic,
      title: "Custom Voice & Personality",
      description: "Tailor AIVIA's voice, tone, and personality to match your brand perfectly."
    },
    {
      icon: ShieldCheck,
      title: "No-Show Reduction",
      description: "Deposit collection and confirmation calls ensure customers show up and your revenue is protected."
    },
    {
      icon: Phone,
      title: "AI Phone Answering",
      description: "Never miss a call. Our AI answers professionally and handles inquiries seamlessly."
    },
    {
      icon: MessageSquare,
      title: "SMS Notifications",
      description: "Automatic confirmations, reminders, and follow-ups keep customers informed."
    },
    {
      icon: Brain,
      title: "Natural Conversations",
      description: "Advanced AI that understands context and handles complex customer requests naturally."
    }
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Features</DialogTitle>
          <DialogDescription>
            Everything you need to manage calls and bookings effortlessly
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
          {features.map((feature, index) => (
            <div key={index} className="flex gap-3 p-4 rounded-xl border bg-card hover:bg-muted/50 hover:border-primary/30 transition-all">
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center">
                <feature.icon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold text-foreground">{feature.title}</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FeaturesDialog;
