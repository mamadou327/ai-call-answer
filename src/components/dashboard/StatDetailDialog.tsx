import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { CalendarCheck, XCircle, Phone, MessageSquare, DollarSign } from "lucide-react";

interface StatDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "bookings" | "cancelled" | "calls" | "messages" | "revenue";
  data: any[];
  currency?: string;
}

export const StatDetailDialog = ({ 
  open, 
  onOpenChange, 
  type, 
  data,
  currency = "GBP"
}: StatDetailDialogProps) => {
  const getCurrencySymbol = (curr: string) => {
    const symbols: Record<string, string> = {
      GBP: "£", USD: "$", EUR: "€", CAD: "$", AUD: "$", JPY: "¥", CHF: "CHF"
    };
    return symbols[curr] || "$";
  };

  const currencySymbol = getCurrencySymbol(currency);

  const getTitle = () => {
    switch (type) {
      case "bookings": return "All Bookings";
      case "cancelled": return "Cancelled Bookings";
      case "calls": return "All Calls";
      case "messages": return "All Messages";
      case "revenue": return "Revenue Details";
    }
  };

  const getIcon = () => {
    switch (type) {
      case "bookings": return <CalendarCheck className="w-5 h-5" />;
      case "cancelled": return <XCircle className="w-5 h-5 text-destructive" />;
      case "calls": return <Phone className="w-5 h-5" />;
      case "messages": return <MessageSquare className="w-5 h-5" />;
      case "revenue": return <DollarSign className="w-5 h-5" />;
    }
  };

  const renderBookingItem = (item: any, isCancelled = false) => (
    <div 
      key={item.id} 
      className={`p-3 border rounded-lg ${isCancelled ? 'border-destructive/20 bg-destructive/5' : ''}`}
    >
      <div className="flex justify-between items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium truncate">{item.customer_name}</p>
          <p className="text-sm text-muted-foreground">
            {format(new Date(item.start_time), "MMM d, yyyy 'at' h:mm a")}
          </p>
          {item.service?.name && (
            <p className="text-xs text-muted-foreground">{item.service.name}</p>
          )}
          {item.staff?.name && (
            <p className="text-xs text-muted-foreground">with {item.staff.name}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge variant={isCancelled ? "destructive" : "outline"} className="text-xs">
            {item.status}
          </Badge>
          {item.service?.price && (
            <span className="text-sm font-medium">{currencySymbol}{item.service.price}</span>
          )}
        </div>
      </div>
    </div>
  );

  const renderCallItem = (item: any) => (
    <div key={item.id} className="p-3 border rounded-lg">
      <div className="flex justify-between items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium truncate">{item.caller_name || item.caller_phone}</p>
          <p className="text-sm text-muted-foreground">
            {format(new Date(item.created_at), "MMM d, yyyy 'at' h:mm a")}
          </p>
          {item.summary && (
            <p className="text-xs text-muted-foreground line-clamp-2">{item.summary}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge variant="outline" className="text-xs">{item.call_type}</Badge>
          {item.duration_ms && (
            <span className="text-xs text-muted-foreground">
              {Math.round(item.duration_ms / 1000)}s
            </span>
          )}
        </div>
      </div>
    </div>
  );

  const renderMessageItem = (item: any) => (
    <div key={item.id} className={`p-3 border rounded-lg ${!item.is_read ? 'bg-primary/5 border-primary/20' : ''}`}>
      <div className="flex justify-between items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium truncate">{item.caller_name || item.caller_phone}</p>
          <p className="text-sm text-muted-foreground">
            {format(new Date(item.created_at), "MMM d, yyyy 'at' h:mm a")}
          </p>
          <p className="text-sm mt-1 line-clamp-2">{item.content}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {item.is_urgent && <Badge variant="destructive" className="text-xs">Urgent</Badge>}
          {!item.is_read && <Badge variant="secondary" className="text-xs">Unread</Badge>}
        </div>
      </div>
    </div>
  );

  const renderRevenueItem = (item: any) => (
    <div key={item.id} className="p-3 border rounded-lg">
      <div className="flex justify-between items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium truncate">{item.customer_name}</p>
          <p className="text-sm text-muted-foreground">
            {format(new Date(item.start_time), "MMM d, yyyy")}
          </p>
          {item.service?.name && (
            <p className="text-xs text-muted-foreground">{item.service.name}</p>
          )}
        </div>
        <span className="text-lg font-bold text-primary">
          {currencySymbol}{item.service?.price || 0}
        </span>
      </div>
    </div>
  );

  const renderContent = () => {
    if (data.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          {getIcon()}
          <p className="mt-2">No data available</p>
        </div>
      );
    }

    switch (type) {
      case "bookings":
        return data.map(item => renderBookingItem(item));
      case "cancelled":
        return data.map(item => renderBookingItem(item, true));
      case "calls":
        return data.map(item => renderCallItem(item));
      case "messages":
        return data.map(item => renderMessageItem(item));
      case "revenue":
        const total = data.reduce((sum, item) => sum + (item.service?.price || 0), 0);
        return (
          <>
            <div className="p-4 bg-primary/10 rounded-lg mb-4">
              <p className="text-sm text-muted-foreground">Total Revenue</p>
              <p className="text-2xl font-bold">{currencySymbol}{total.toFixed(2)}</p>
            </div>
            {data.map(item => renderRevenueItem(item))}
          </>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getIcon()}
            {getTitle()}
            <Badge variant="secondary" className="ml-2">{data.length}</Badge>
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-2">
            {renderContent()}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
