import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Send, MessageCircle, Clock, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SupportConversationDialog } from "./SupportConversationDialog";

interface ContactAdminFormProps {
  businessId: string;
}

interface SupportRequest {
  id: string;
  message: string | null;
  status: string;
  created_at: string;
  has_unread?: boolean;
}

export function ContactAdminForm({ businessId }: ContactAdminFormProps) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recentRequests, setRecentRequests] = useState<SupportRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<SupportRequest | null>(null);

  useEffect(() => {
    loadRecentRequests();
  }, [businessId]);

  const loadRecentRequests = async () => {
    const { data: requests } = await supabase
      .from("service_requests")
      .select("id, message, status, created_at")
      .eq("business_id", businessId)
      .eq("request_type", "support")
      .order("created_at", { ascending: false })
      .limit(10);
    
    if (requests) {
      // Check for unread admin messages for each request
      const requestsWithUnread = await Promise.all(
        requests.map(async (req) => {
          const { count } = await supabase
            .from("admin_conversations")
            .select("*", { count: "exact", head: true })
            .eq("service_request_id", req.id)
            .eq("sender_type", "admin")
            .eq("is_read", false);
          
          return { ...req, has_unread: (count || 0) > 0 };
        })
      );
      setRecentRequests(requestsWithUnread);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!subject.trim() || !message.trim()) {
      toast.error("Please fill in both subject and message");
      return;
    }

    setIsSubmitting(true);

    try {
      const fullMessage = `**Subject:** ${subject.trim()}\n\n${message.trim()}`;
      
      const { data: newRequest, error } = await supabase
        .from("service_requests")
        .insert({
          business_id: businessId,
          request_type: "support",
          message: fullMessage,
          status: "pending"
        })
        .select("id")
        .single();

      if (error) throw error;

      // Send email notification to admins
      if (newRequest?.id) {
        try {
          await supabase.functions.invoke("send-support-notification", {
            body: {
              service_request_id: newRequest.id,
              sender_type: "business",
              message: message.trim(),
            },
          });
        } catch (emailError) {
          console.error("Failed to send email notification:", emailError);
        }
      }

      toast.success("Message sent to admin successfully!");
      setSubject("");
      setMessage("");
      loadRecentRequests();
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const parseSubject = (msg: string | null) => {
    if (!msg) return "No subject";
    const match = msg.match(/\*\*Subject:\*\* (.+?)(\n|$)/);
    return match ? match[1] : "No subject";
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Contact Admin
          </CardTitle>
          <CardDescription>
            Need help? Send a message to our admin team and we'll get back to you.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                placeholder="What do you need help with?"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={100}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                placeholder="Describe your issue or question in detail..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                maxLength={1000}
              />
              <p className="text-xs text-muted-foreground">
                {message.length}/1000 characters
              </p>
            </div>

            <Button type="submit" disabled={isSubmitting} className="w-full">
              <Send className="h-4 w-4 mr-2" />
              {isSubmitting ? "Sending..." : "Send Message"}
            </Button>
          </form>

          {recentRequests.length > 0 && (
            <div className="pt-4 border-t">
              <h4 className="text-sm font-medium mb-3">Your Conversations</h4>
              <div className="space-y-2">
                {recentRequests.map((req) => (
                  <div
                    key={req.id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors cursor-pointer"
                    onClick={() => setSelectedRequest(req)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">
                          {parseSubject(req.message)}
                        </span>
                        {req.has_unread && (
                          <Badge variant="default" className="text-xs">
                            New reply
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(req.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {req.status === "pending" ? (
                        <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-600">
                          <Clock className="w-3 h-3 mr-1" />
                          Pending
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-green-500/10 text-green-600">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Responded
                        </Badge>
                      )}
                      <MessageCircle className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <SupportConversationDialog
        open={!!selectedRequest}
        onOpenChange={(open) => !open && setSelectedRequest(null)}
        supportRequest={selectedRequest}
        onMessageSent={loadRecentRequests}
      />
    </>
  );
}
