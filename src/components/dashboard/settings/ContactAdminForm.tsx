import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { MessageSquare, Send, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ContactAdminFormProps {
  businessId: string;
}

export function ContactAdminForm({ businessId }: ContactAdminFormProps) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recentRequests, setRecentRequests] = useState<Array<{
    id: string;
    message: string;
    status: string;
    created_at: string;
  }>>([]);
  const [showHistory, setShowHistory] = useState(false);

  const loadRecentRequests = async () => {
    const { data } = await supabase
      .from("service_requests")
      .select("id, message, status, created_at")
      .eq("business_id", businessId)
      .eq("request_type", "support")
      .order("created_at", { ascending: false })
      .limit(5);
    
    if (data) {
      setRecentRequests(data);
    }
    setShowHistory(true);
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
      
      const { error } = await supabase
        .from("service_requests")
        .insert({
          business_id: businessId,
          request_type: "support",
          message: fullMessage,
          status: "pending"
        });

      if (error) throw error;

      toast.success("Message sent to admin successfully!");
      setSubject("");
      setMessage("");
      
      if (showHistory) {
        loadRecentRequests();
      }
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
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

        <div className="pt-4 border-t">
          <Button
            variant="ghost"
            size="sm"
            onClick={loadRecentRequests}
            className="text-muted-foreground"
          >
            {showHistory ? "Refresh" : "View"} Recent Messages
          </Button>

          {showHistory && recentRequests.length > 0 && (
            <div className="mt-3 space-y-2">
              {recentRequests.map((req) => (
                <div
                  key={req.id}
                  className="p-3 bg-muted/50 rounded-lg text-sm"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">
                      {new Date(req.created_at).toLocaleDateString()}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      req.status === "pending" 
                        ? "bg-yellow-100 text-yellow-800" 
                        : req.status === "approved"
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-800"
                    }`}>
                      {req.status === "pending" ? "Pending" : req.status === "approved" ? "Responded" : req.status}
                    </span>
                  </div>
                  <p className="line-clamp-2">{req.message?.split('\n\n')[1] || req.message}</p>
                </div>
              ))}
            </div>
          )}

          {showHistory && recentRequests.length === 0 && (
            <p className="mt-3 text-sm text-muted-foreground">No previous messages</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
