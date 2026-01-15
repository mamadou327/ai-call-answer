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
            Running a restaurant means juggling constant pressure, especially during busy service. 
            Phones ring nonstop, customers call during rush hours or after closing time, and every 
            missed call can mean a lost order or an empty table.
          </p>

          <p className="text-foreground font-semibold text-lg">
            That's why we built AIVIA.
          </p>

          <p>
            AIVIA is an AI-powered phone assistant created specifically for restaurants. It answers 
            your phone 24/7, speaks naturally with your customers, and handles multiple calls at the 
            same time — so no customer is ever left on hold. Whether it's taking pickup orders, booking 
            tables, answering common questions, or leaving messages for your team, AIVIA manages it all 
            automatically.
          </p>

          <p>
            During peak service, AIVIA removes the pressure from your staff by handling every incoming 
            call at once, allowing your team to stay focused on cooking, serving, and delivering a great 
            dining experience. After hours, it continues answering calls, capturing orders and reservations 
            you would normally miss.
          </p>

          <p>
            AIVIA works like a reliable front-of-house assistant that never gets overwhelmed, never misses 
            a call, and never makes customers wait. It understands your menu, opening hours, and how your 
            restaurant operates — ensuring every interaction feels smooth, professional, and consistent.
          </p>

          <p className="text-foreground font-medium border-l-4 border-primary pl-4 py-2 bg-primary/5 rounded-r">
            Our mission is simple: help restaurants increase orders, fill more tables, reduce staff stress, 
            and never miss another opportunity — without hiring extra staff or changing the way they work.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AboutUsDialog;
