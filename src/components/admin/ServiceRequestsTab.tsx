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
  MessageSquare, 
  Mail, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Building2,
  Eye
} from "lucide-react";

interface ServiceRequest {
  id: string;
  business_id: string;
  request_type: string;
  status: string;
  message: string | null;
  created_at: string;
  reviewed_at: string | null;
  business?: {
    business_name: string;
    main_phone: string;
  };
}

export const ServiceRequestsTab = () => {
  const { toast } = useToast();
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("service_requests")
        .select(`
          *,
          business:businesses(business_name, main_phone)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRequests(data || []);
    } catch (error: any) {
      console.error("Error loading requests:", error);
      toast({
        title: "Error",
        description: "Failed to load service requests",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (requestId: string, action: "approved" | "rejected") => {
    setActionLoading(requestId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from("service_requests")
        .update({
          status: action,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id,
        })
        .eq("id", requestId);

      if (error) throw error;

      toast({
        title: `Request ${action}`,
        description: `The service request has been ${action}.`,
      });

      loadRequests();
      setSelectedRequest(null);
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-600"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case "approved":
        return <Badge variant="secondary" className="bg-green-500/10 text-green-600"><CheckCircle className="w-3 h-3 mr-1" />Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "sms":
        return <MessageSquare className="w-4 h-4 text-blue-500" />;
      case "email":
        return <Mail className="w-4 h-4 text-purple-500" />;
      default:
        return null;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "sms":
        return "SMS Notifications";
      case "email":
        return "Email Notifications";
      default:
        return type;
    }
  };

  const pendingRequests = requests.filter(r => r.status === "pending");
  const processedRequests = requests.filter(r => r.status !== "pending");

  return (
    <div className="space-y-6">
      {/* Pending Requests */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-yellow-500" />
            Pending Requests
          </CardTitle>
          <CardDescription>Service access requests awaiting review</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : pendingRequests.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No pending requests</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Business</TableHead>
                  <TableHead>Request Type</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                        {request.business?.business_name || "Unknown"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getTypeIcon(request.request_type)}
                        {getTypeLabel(request.request_type)}
                      </div>
                    </TableCell>
                    <TableCell>{new Date(request.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedRequest(request)}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Review
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Processed Requests */}
      <Card>
        <CardHeader>
          <CardTitle>Request History</CardTitle>
          <CardDescription>Previously reviewed service requests</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : processedRequests.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No request history</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Business</TableHead>
                  <TableHead>Request Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reviewed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {processedRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-medium">
                      {request.business?.business_name || "Unknown"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getTypeIcon(request.request_type)}
                        {getTypeLabel(request.request_type)}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(request.status)}</TableCell>
                    <TableCell>
                      {request.reviewed_at 
                        ? new Date(request.reviewed_at).toLocaleDateString()
                        : "—"
                      }
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Review Dialog */}
      <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Review Service Request</DialogTitle>
            <DialogDescription>
              Review and approve or reject this service access request
            </DialogDescription>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Business</Label>
                  <p className="text-sm text-muted-foreground">
                    {selectedRequest.business?.business_name || "Unknown"}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Phone</Label>
                  <p className="text-sm text-muted-foreground">
                    {selectedRequest.business?.main_phone || "N/A"}
                  </p>
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium">Request Type</Label>
                <div className="flex items-center gap-2 mt-1">
                  {getTypeIcon(selectedRequest.request_type)}
                  <span className="text-sm">{getTypeLabel(selectedRequest.request_type)}</span>
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium">Request Details</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedRequest.message || "No additional details provided."}
                </p>
              </div>

              <div>
                <Label className="text-sm font-medium">Submitted</Label>
                <p className="text-sm text-muted-foreground">
                  {new Date(selectedRequest.created_at).toLocaleString()}
                </p>
              </div>

              <Separator />

              <div className="flex gap-2">
                <Button
                  onClick={() => handleAction(selectedRequest.id, "approved")}
                  disabled={!!actionLoading}
                  className="flex-1"
                >
                  {actionLoading === selectedRequest.id ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <CheckCircle className="w-4 h-4 mr-2" />
                  )}
                  Approve
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleAction(selectedRequest.id, "rejected")}
                  disabled={!!actionLoading}
                  className="flex-1"
                >
                  {actionLoading === selectedRequest.id ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <XCircle className="w-4 h-4 mr-2" />
                  )}
                  Reject
                </Button>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                Note: After approving, you'll need to enable the service in the business notification settings.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
