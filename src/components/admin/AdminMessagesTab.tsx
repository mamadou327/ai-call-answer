import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, 
  CheckCircle, 
  Building2,
  MessageSquare,
  MessageCircle
} from "lucide-react";
import { AdminConversationDialog } from "./AdminConversationDialog";

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

export const AdminMessagesTab = () => {
  const { toast } = useToast();
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<SupportMessage | null>(null);

  useEffect(() => {
    loadMessages();
  }, []);

  const loadMessages = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("service_requests")
        .select(`
          *,
          business:businesses(business_name, main_phone)
        `)
        .eq("request_type", "support")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setMessages(data || []);
    } catch (error: any) {
      console.error("Error loading messages:", error);
      toast({
        title: "Error",
        description: "Failed to load support messages",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const parseMessage = (message: string | null) => {
    if (!message) return { subject: "No subject", body: "No message" };
    
    const subjectMatch = message.match(/\*\*Subject:\*\* (.+?)(\n|$)/);
    const subject = subjectMatch ? subjectMatch[1] : "No subject";
    const body = message.replace(/\*\*Subject:\*\* .+?\n\n?/, "").trim() || "No message";
    
    return { subject, body };
  };

  const unreadMessages = messages.filter(m => m.status === "pending");
  const readMessages = messages.filter(m => m.status !== "pending");

  return (
    <div className="space-y-6">
      {/* Unread Messages */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-orange-500" />
            Unread Messages
          </CardTitle>
          <CardDescription>Support messages from businesses awaiting response</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : unreadMessages.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No unread messages</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Business</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Received</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unreadMessages.map((msg) => {
                  const { subject } = parseMessage(msg.message);
                  return (
                    <TableRow key={msg.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-muted-foreground" />
                          {msg.business?.business_name || "Unknown"}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">{subject}</TableCell>
                      <TableCell>{new Date(msg.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedMessage(msg)}
                        >
                          <MessageCircle className="w-4 h-4 mr-1" />
                          Reply
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Read Messages History */}
      <Card>
        <CardHeader>
          <CardTitle>Message History</CardTitle>
          <CardDescription>Previous conversations with businesses</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : readMessages.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No message history</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Business</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Activity</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {readMessages.map((msg) => {
                  const { subject } = parseMessage(msg.message);
                  return (
                    <TableRow key={msg.id}>
                      <TableCell className="font-medium">
                        {msg.business?.business_name || "Unknown"}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">{subject}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="bg-green-500/10 text-green-600">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Responded
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {msg.reviewed_at 
                          ? new Date(msg.reviewed_at).toLocaleDateString()
                          : "—"
                        }
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedMessage(msg)}
                        >
                          <MessageCircle className="w-4 h-4 mr-1" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Conversation Dialog */}
      <AdminConversationDialog
        open={!!selectedMessage}
        onOpenChange={(open) => !open && setSelectedMessage(null)}
        supportMessage={selectedMessage}
        onMessageSent={loadMessages}
      />
    </div>
  );
};
