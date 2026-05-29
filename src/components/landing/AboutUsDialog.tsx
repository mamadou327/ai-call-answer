import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AboutUsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AboutUsDialog = ({ open, onOpenChange }: AboutUsDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">About Us</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 text-muted-foreground leading-relaxed pt-4">
          <p>
            Running a service business means being everywhere at once. You are with a client, managing your team, handling payments and trying to grow, all while the phone keeps ringing.
          </p>

          <p>
            Every missed call is a missed booking. Every unanswered enquiry is a customer who called your competitor instead.
          </p>

          <p className="text-foreground font-semibold text-lg">
            That is why we built Aivia.
          </p>

          <p>
            Aivia is an AI receptionist built for service businesses. It answers every call 24/7, takes bookings and orders, answers questions about your services and prices, and sounds human enough that most customers never realise it is AI.
          </p>

          <p className="text-foreground font-medium border-l-4 border-primary pl-4 py-2 bg-primary/5 rounded-r">
            Whether you run a salon, a restaurant, a clinic, an estate agency or a trades business, Aivia makes sure no customer ever goes unanswered again.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AboutUsDialog;
