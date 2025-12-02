import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Mail, Send, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface StaffInviteDialogProps {
  businessId: string;
  businessName: string;
  onInviteSent?: () => void;
}

export const StaffInviteDialog = ({ businessId, businessName, onInviteSent }: StaffInviteDialogProps) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [sending, setSending] = useState(false);

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-staff-invite-with-code", {
        body: {
          staffEmail: email.trim(),
          staffName: name.trim() || undefined,
          businessId,
          businessName,
        },
      });

      if (error) throw error;

      toast({
        title: "Invite Sent!",
        description: `Staff invite with join code sent to ${email}`,
      });

      setOpen(false);
      setEmail("");
      setName("");
      onInviteSent?.();
    } catch (error: any) {
      console.error("Error sending invite:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to send invite",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Mail className="w-4 h-4 mr-2" />
          Send Invite with Code
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send Staff Invite with Code</DialogTitle>
          <DialogDescription>
            Send an email invitation that includes the current staff join code
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSendInvite} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email Address *</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="staff@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-name">Name (optional)</Label>
            <Input
              id="invite-name"
              type="text"
              placeholder="Staff member name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="bg-muted/50 p-3 rounded-lg text-sm text-muted-foreground">
            <p>The email will include:</p>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>The current staff join code</li>
              <li>Link to the staff signup page</li>
              <li>Instructions for completing setup</li>
            </ul>
          </div>
          <Button type="submit" className="w-full" disabled={sending}>
            {sending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Send Invite
              </>
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
