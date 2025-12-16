import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send, User, Shield } from "lucide-react";

interface ConversationMessage {
  id: string;
  sender_type: string;
  message: string;
  created_at: string;
  is_read: boolean;
}

interface SupportMessage {
  id: string;
  business_id: string;
  message: string | null;
  status: string;
  created_at: string;
  reviewed_at: string | null;
  business?: {
    business_name: string;
    main_phone: string;
  };
}

interface AdminConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supportMessage: SupportMessage | null;
  onMessageSent?: () => void;
}

export function AdminConversationDialog({ 
  open, 
  onOpenChange, 
  supportMessage,
  onMessageSent
}: AdminConversationDialogProps) {
  const { toast } = useToast();
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && supportMessage) {
      loadConversation();
      markAsRead();
    }
  }, [open, supportMessage?.id]);

  useEffect(() => {
    // Scroll to bottom when conversation updates
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conversation]);

  const loadConversation = async () => {
    if (!supportMessage) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("admin_conversations")
        .select("*")
        .eq("service_request_id", supportMessage.id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setConversation(data || []);
    } catch (error) {
      console.error("Error loading conversation:", error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async () => {
    if (!supportMessage) return;
    try {
      // Mark unread business messages as read
      await supabase
        .from("admin_conversations")
        .update({ is_read: true })
        .eq("service_request_id", supportMessage.id)
        .eq("sender_type", "business")
        .eq("is_read", false);

      // Update the service request status if pending
      if (supportMessage.status === "pending") {
        const { data: { user } } = await supabase.auth.getUser();
        await supabase
          .from("service_requests")
          .update({
            status: "approved",
            reviewed_at: new Date().toISOString(),
            reviewed_by: user?.id,
          })
          .eq("id", supportMessage.id);
      }
    } catch (error) {
      console.error("Error marking as read:", error);
    }
  };

  const handleSendReply = async () => {
    if (!reply.trim() || !supportMessage) return;

    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("admin_conversations")
        .insert({
          service_request_id: supportMessage.id,
          sender_type: "admin",
          sender_id: user.id,
          message: reply.trim(),
        });

      if (error) throw error;

      setReply("");
      loadConversation();
      onMessageSent?.();
      
      toast({
        title: "Reply sent",
        description: "Your message has been sent to the business.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const parseMessage = (message: string | null) => {
    if (!message) return { subject: "No subject", body: "No message" };
    const subjectMatch = message.match(/\*\*Subject:\*\* (.+?)(\n|$)/);
    const subject = subjectMatch ? subjectMatch[1] : "No subject";
    const body = message.replace(/\*\*Subject:\*\* .+?\n\n?/, "").trim() || "No message";
    return { subject, body };
  };

  if (!supportMessage) return null;

  const { subject, body } = parseMessage(supportMessage.message);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Conversation with {supportMessage.business?.business_name || "Business"}
          </DialogTitle>
          <DialogDescription>
            Subject: {subject}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 flex flex-col">
          <ScrollArea className="flex-1 pr-4" ref={scrollRef}>
            <div className="space-y-4 py-4">
              {/* Original Message */}
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">
                      {supportMessage.business?.business_name || "Business"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(supportMessage.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="p-3 bg-muted rounded-lg text-sm whitespace-pre-wrap">
                    {body}
                  </div>
                </div>
              </div>

              {/* Conversation Thread */}
              {loading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                conversation.map((msg) => (
                  <div key={msg.id} className="flex gap-3">
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                      msg.sender_type === "admin" 
                        ? "bg-blue-500/10" 
                        : "bg-primary/10"
                    }`}>
                      {msg.sender_type === "admin" ? (
                        <Shield className="w-4 h-4 text-blue-500" />
                      ) : (
                        <User className="w-4 h-4 text-primary" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">
                          {msg.sender_type === "admin" ? "Admin" : supportMessage.business?.business_name || "Business"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(msg.created_at).toLocaleString()}
                        </span>
                      </div>
                      <div className={`p-3 rounded-lg text-sm whitespace-pre-wrap ${
                        msg.sender_type === "admin" 
                          ? "bg-blue-500/10" 
                          : "bg-muted"
                      }`}>
                        {msg.message}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          <Separator className="my-4" />

          {/* Reply Input */}
          <div className="space-y-3">
            <Label htmlFor="reply">Your Reply</Label>
            <Textarea
              id="reply"
              placeholder="Type your reply..."
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              rows={3}
              className="resize-none"
            />
            <Button 
              onClick={handleSendReply} 
              disabled={!reply.trim() || sending}
              className="w-full"
            >
              {sending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Send Reply
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
