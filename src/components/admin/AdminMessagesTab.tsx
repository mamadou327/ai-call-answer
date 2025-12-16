import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, 
  Clock, 
  CheckCircle, 
  Building2,
  Eye,
  MessageSquare,
  Mail
} from "lucide-react";

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
  const [actionLoading, setActionLoading] = useState<string | null>(null);

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

  const handleMarkRead = async (messageId: string) => {
    setActionLoading(messageId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from("service_requests")
        .update({
          status: "approved",
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id,
        })
        .eq("id", messageId);

      if (error) throw error;

      toast({
        title: "Message marked as read",
        description: "The support message has been acknowledged.",
      });

      loadMessages();
      setSelectedMessage(null);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
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
                          <Eye className="w-4 h-4 mr-1" />
                          Read
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
          <CardDescription>Previously read support messages</CardDescription>
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
                  <TableHead>Read On</TableHead>
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
                          Read
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
                          <Eye className="w-4 h-4" />
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

      {/* Message Detail Dialog */}
      <Dialog open={!!selectedMessage} onOpenChange={() => setSelectedMessage(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Support Message</DialogTitle>
            <DialogDescription>
              Message from {selectedMessage?.business?.business_name || "Unknown Business"}
            </DialogDescription>
          </DialogHeader>
          {selectedMessage && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Business</Label>
                  <p className="text-sm text-muted-foreground">
                    {selectedMessage.business?.business_name || "Unknown"}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Phone</Label>
                  <p className="text-sm text-muted-foreground">
                    {selectedMessage.business?.main_phone || "N/A"}
                  </p>
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium">Subject</Label>
                <p className="text-sm mt-1">
                  {parseMessage(selectedMessage.message).subject}
                </p>
              </div>

              <div>
                <Label className="text-sm font-medium">Message</Label>
                <div className="mt-1 p-3 bg-muted/50 rounded-lg text-sm whitespace-pre-wrap">
                  {parseMessage(selectedMessage.message).body}
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium">Received</Label>
                <p className="text-sm text-muted-foreground">
                  {new Date(selectedMessage.created_at).toLocaleString()}
                </p>
              </div>

              <Separator />

              {selectedMessage.status === "pending" ? (
                <Button
                  onClick={() => handleMarkRead(selectedMessage.id)}
                  disabled={!!actionLoading}
                  className="w-full"
                >
                  {actionLoading === selectedMessage.id ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <CheckCircle className="w-4 h-4 mr-2" />
                  )}
                  Mark as Read
                </Button>
              ) : (
                <p className="text-sm text-center text-muted-foreground">
                  This message was read on {selectedMessage.reviewed_at 
                    ? new Date(selectedMessage.reviewed_at).toLocaleString()
                    : "an unknown date"
                  }
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
