import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, AlertTriangle, User, Phone, Check, Archive } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { toast } from "sonner";

interface MessagesTabProps {
  businessId?: string;
}

interface Message {
  id: string;
  caller_name: string | null;
  caller_phone: string;
  content: string;
  recipient_staff_id: string | null;
  recipient_type: string;
  is_urgent: boolean;
  is_read: boolean;
  is_archived: boolean;
  created_at: string;
  staff?: { name: string } | null;
}

export const MessagesTab = ({ businessId }: MessagesTabProps) => {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "urgent" | "unread" | "archived">("all");

  useEffect(() => {
    if (businessId) {
      loadMessages();
      
      // Set up realtime subscription
      const channel = supabase
        .channel('messages-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'messages',
            filter: `business_id=eq.${businessId}`
          },
          () => {
            loadMessages();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [businessId]);

  const loadMessages = async () => {
    if (!businessId) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from("messages")
      .select(`
        *,
        staff:recipient_staff_id(name)
      `)
      .eq("business_id", businessId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading messages:", error);
    } else {
      setMessages(data || []);
    }
    setLoading(false);
  };

  const markAsRead = async (messageId: string) => {
    const { error } = await supabase
      .from("messages")
      .update({ is_read: true })
      .eq("id", messageId);

    if (!error) {
      setMessages(prev => prev.map(m => 
        m.id === messageId ? { ...m, is_read: true } : m
      ));
    }
  };

  const archiveMessage = async (messageId: string) => {
    const { error } = await supabase
      .from("messages")
      .update({ is_archived: true, is_read: true })
      .eq("id", messageId);

    if (!error) {
      setMessages(prev => prev.map(m => 
        m.id === messageId ? { ...m, is_archived: true, is_read: true } : m
      ));
      toast.success("Message archived");
    } else {
      toast.error("Failed to archive message");
    }
  };

  const unarchiveMessage = async (messageId: string) => {
    const { error } = await supabase
      .from("messages")
      .update({ is_archived: false })
      .eq("id", messageId);

    if (!error) {
      setMessages(prev => prev.map(m => 
        m.id === messageId ? { ...m, is_archived: false } : m
      ));
      toast.success("Message restored");
    } else {
      toast.error("Failed to restore message");
    }
  };

  const filteredMessages = messages.filter(msg => {
    if (filter === "archived") return msg.is_archived;
    if (filter === "urgent") return msg.is_urgent && !msg.is_archived;
    if (filter === "unread") return !msg.is_read && !msg.is_archived;
    // "all" shows non-archived messages
    return !msg.is_archived;
  });

  const getRecipientLabel = (msg: Message) => {
    if (msg.recipient_type === "staff" && msg.staff?.name) {
      return msg.staff.name;
    }
    if (msg.recipient_type === "admin") return "Admin";
    return "Everyone";
  };

  const archivedCount = messages.filter(m => m.is_archived).length;
  const activeMessages = messages.filter(m => !m.is_archived);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            {t("dashboard.messages")}
          </CardTitle>
          <div className="flex gap-2 text-sm">
            <Badge variant={filter === "all" ? "default" : "outline"}>
              {activeMessages.length} Total
            </Badge>
            <Badge variant="destructive" className={filter === "urgent" ? "" : "opacity-50"}>
              {activeMessages.filter(m => m.is_urgent).length} Urgent
            </Badge>
            <Badge variant="secondary" className={filter === "unread" ? "" : "opacity-50"}>
              {activeMessages.filter(m => !m.is_read).length} Unread
            </Badge>
            <Badge variant="outline" className={filter === "archived" ? "bg-muted" : "opacity-50"}>
              {archivedCount} Archived
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all" onValueChange={(v) => setFilter(v as "all" | "urgent" | "unread" | "archived")}>
            <TabsList className="mb-4">
              <TabsTrigger value="all">All Messages</TabsTrigger>
              <TabsTrigger value="urgent">Urgent</TabsTrigger>
              <TabsTrigger value="unread">Unread</TabsTrigger>
              <TabsTrigger value="archived" className="flex items-center gap-1">
                <Archive className="w-4 h-4" />
                Archived
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-0">
              {renderMessages(filteredMessages, loading, markAsRead, archiveMessage, unarchiveMessage, getRecipientLabel, false)}
            </TabsContent>
            <TabsContent value="urgent" className="mt-0">
              {renderMessages(filteredMessages, loading, markAsRead, archiveMessage, unarchiveMessage, getRecipientLabel, false)}
            </TabsContent>
            <TabsContent value="unread" className="mt-0">
              {renderMessages(filteredMessages, loading, markAsRead, archiveMessage, unarchiveMessage, getRecipientLabel, false)}
            </TabsContent>
            <TabsContent value="archived" className="mt-0">
              {renderMessages(filteredMessages, loading, markAsRead, archiveMessage, unarchiveMessage, getRecipientLabel, true)}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

function renderMessages(
  messages: Message[], 
  loading: boolean, 
  markAsRead: (id: string) => void,
  archiveMessage: (id: string) => void,
  unarchiveMessage: (id: string) => void,
  getRecipientLabel: (msg: Message) => string,
  isArchivedTab: boolean
) {
  if (loading) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>Loading messages...</p>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-50" />
        <p className="text-lg mb-2">No {isArchivedTab ? "archived " : ""}messages</p>
        <p className="text-sm">
          {isArchivedTab 
            ? "Archived messages will appear here" 
            : "Messages left by callers will appear here"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`p-4 border rounded-lg transition-colors ${
            msg.is_urgent && !msg.is_archived ? "border-destructive bg-destructive/5" : ""
          } ${!msg.is_read && !msg.is_archived ? "bg-primary/5 border-primary/20" : ""}`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <p className="font-medium flex items-center gap-1">
                  <User className="w-4 h-4" />
                  {msg.caller_name || "Unknown Caller"}
                </p>
                {/* Status badges */}
                {msg.is_archived ? (
                  <Badge variant="outline" className="text-muted-foreground">
                    <Archive className="w-3 h-3 mr-1" />
                    Archived
                  </Badge>
                ) : msg.is_urgent ? (
                  <Badge variant="destructive" className="flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Urgent
                  </Badge>
                ) : !msg.is_read ? (
                  <Badge variant="default" className="bg-blue-500 hover:bg-blue-600">
                    Unread
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground">
                    <Check className="w-3 h-3 mr-1" />
                    Read
                  </Badge>
                )}
              </div>
              
              <p className="text-sm text-muted-foreground flex items-center gap-1 mb-2">
                <Phone className="w-3 h-3" />
                {msg.caller_phone}
              </p>
              
              <p className="text-sm mb-2">{msg.content}</p>
              
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>{format(new Date(msg.created_at), "MMM d, yyyy 'at' h:mm a")}</span>
                <Badge variant="outline" className="text-xs">
                  For: {getRecipientLabel(msg)}
                </Badge>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {!msg.is_read && !msg.is_archived && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => markAsRead(msg.id)}
                  className="flex items-center gap-1"
                >
                  <Check className="w-4 h-4" />
                  Mark Read
                </Button>
              )}
              
              {msg.is_archived ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => unarchiveMessage(msg.id)}
                  className="flex items-center gap-1"
                >
                  <Archive className="w-4 h-4" />
                  Restore
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => archiveMessage(msg.id)}
                  className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
                >
                  <Archive className="w-4 h-4" />
                  Archive
                </Button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}