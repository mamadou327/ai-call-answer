import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Send, User, Shield } from "lucide-react";

interface ConversationMessage {
  id: string;
  sender_type: string;
  message: string;
  created_at: string;
  is_read: boolean;
}

interface SupportRequest {
  id: string;
  message: string | null;
  status: string;
  created_at: string;
}

interface SupportConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supportRequest: SupportRequest | null;
  onMessageSent?: () => void;
}

export function SupportConversationDialog({ 
  open, 
  onOpenChange, 
  supportRequest,
  onMessageSent
}: SupportConversationDialogProps) {
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && supportRequest) {
      loadConversation();
      markAdminMessagesAsRead();
    }
  }, [open, supportRequest?.id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conversation]);

  const loadConversation = async () => {
    if (!supportRequest) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("admin_conversations")
        .select("*")
        .eq("service_request_id", supportRequest.id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setConversation(data || []);
    } catch (error) {
      console.error("Error loading conversation:", error);
    } finally {
      setLoading(false);
    }
  };

  const markAdminMessagesAsRead = async () => {
    if (!supportRequest) return;
    try {
      await supabase
        .from("admin_conversations")
        .update({ is_read: true })
        .eq("service_request_id", supportRequest.id)
        .eq("sender_type", "admin")
        .eq("is_read", false);
    } catch (error) {
      console.error("Error marking as read:", error);
    }
  };

  const handleSendReply = async () => {
    if (!reply.trim() || !supportRequest) return;

    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const messageText = reply.trim();

      const { error } = await supabase
        .from("admin_conversations")
        .insert({
          service_request_id: supportRequest.id,
          sender_type: "business",
          sender_id: user.id,
          message: messageText,
        });

      if (error) throw error;

      // Send email notification to admins
      try {
        await supabase.functions.invoke("send-support-notification", {
          body: {
            service_request_id: supportRequest.id,
            sender_type: "business",
            message: messageText,
          },
        });
      } catch (emailError) {
        console.error("Failed to send email notification:", emailError);
      }

      setReply("");
      loadConversation();
      onMessageSent?.();
      
      toast.success("Reply sent to admin");
    } catch (error: any) {
      toast.error(error.message || "Failed to send reply");
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

  if (!supportRequest) return null;

  const { subject, body } = parseMessage(supportRequest.message);
  const hasAdminReplies = conversation.some(m => m.sender_type === "admin");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Support Conversation</DialogTitle>
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
                    <span className="font-medium text-sm">You</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(supportRequest.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="p-3 bg-primary/10 rounded-lg text-sm whitespace-pre-wrap">
                    {body}
                  </div>
                </div>
              </div>

              {/* Conversation Thread */}
              {loading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : conversation.length === 0 && !loading ? (
                <p className="text-center text-muted-foreground text-sm py-4">
                  Waiting for admin response...
                </p>
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
                          {msg.sender_type === "admin" ? "Admin" : "You"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(msg.created_at).toLocaleString()}
                        </span>
                      </div>
                      <div className={`p-3 rounded-lg text-sm whitespace-pre-wrap ${
                        msg.sender_type === "admin" 
                          ? "bg-blue-500/10" 
                          : "bg-primary/10"
                      }`}>
                        {msg.message}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          {hasAdminReplies && (
            <>
              <Separator className="my-4" />
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
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
