import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  Globe, 
  Copy, 
  Check, 
  CheckCircle, 
  XCircle, 
  Clock, 
  ExternalLink,
  Loader2,
  Search,
  RefreshCw,
  Send,
  FileText
} from "lucide-react";

interface BusinessWithDomain {
  id: string;
  business_name: string;
  custom_booking_domain: string | null;
  custom_domain_verified: boolean | null;
  custom_domain_added_to_hosting: boolean | null;
  custom_domain_added_at: string | null;
  custom_domain_status_message: string | null;
  custom_domain_last_checked_at: string | null;
  custom_domain_txt_value: string | null;
}

export const CustomDomainsTab = () => {
  const { toast } = useToast();
  const [businesses, setBusinesses] = useState<BusinessWithDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedDomain, setCopiedDomain] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "verified" | "awaiting_txt" | "live">("all");
  const [search, setSearch] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);
  const [txtDialogOpen, setTxtDialogOpen] = useState(false);
  const [selectedBusiness, setSelectedBusiness] = useState<BusinessWithDomain | null>(null);
  const [txtValue, setTxtValue] = useState("");
  const [savingTxt, setSavingTxt] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

  useEffect(() => {
    loadBusinesses();
  }, []);

  const loadBusinesses = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("businesses")
        .select("id, business_name, custom_booking_domain, custom_domain_verified, custom_domain_added_to_hosting, custom_domain_added_at, custom_domain_status_message, custom_domain_last_checked_at, custom_domain_txt_value")
        .not("custom_booking_domain", "is", null)
        .order("custom_domain_last_checked_at", { ascending: false, nullsFirst: false });

      if (error) throw error;
      setBusinesses(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const copyDomain = (domain: string) => {
    navigator.clipboard.writeText(domain);
    setCopiedDomain(domain);
    setTimeout(() => setCopiedDomain(null), 2000);
    toast({
      title: "Copied",
      description: "Domain copied to clipboard",
    });
  };

  const markAsAddedToHosting = async (businessId: string) => {
    setUpdating(businessId);
    try {
      const { error } = await supabase
        .from("businesses")
        .update({
          custom_domain_added_to_hosting: true,
          custom_domain_added_at: new Date().toISOString(),
        })
        .eq("id", businessId);

      if (error) throw error;

      toast({
        title: "Updated",
        description: "Domain marked as added to hosting",
      });
      loadBusinesses();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUpdating(null);
    }
  };

  const openTxtDialog = (business: BusinessWithDomain) => {
    setSelectedBusiness(business);
    setTxtValue(business.custom_domain_txt_value || "");
    setTxtDialogOpen(true);
  };

  const saveTxtValue = async () => {
    if (!selectedBusiness) return;
    
    setSavingTxt(true);
    try {
      const { error } = await supabase
        .from("businesses")
        .update({
          custom_domain_txt_value: txtValue || null,
        })
        .eq("id", selectedBusiness.id);

      if (error) throw error;

      toast({
        title: "Saved",
        description: "TXT record value saved successfully",
      });
      setTxtDialogOpen(false);
      loadBusinesses();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSavingTxt(false);
    }
  };

  const sendTxtInstructions = async () => {
    if (!selectedBusiness || !txtValue) return;
    
    setSendingEmail(true);
    try {
      const { error } = await supabase.functions.invoke("send-txt-record-instructions", {
        body: {
          business_id: selectedBusiness.id,
          txt_value: txtValue,
        },
      });

      if (error) throw error;

      toast({
        title: "Email Sent",
        description: "TXT record instructions sent to business owner",
      });
      setTxtDialogOpen(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send email",
        variant: "destructive",
      });
    } finally {
      setSendingEmail(false);
    }
  };

  const getStatus = (business: BusinessWithDomain) => {
    if (business.custom_domain_added_to_hosting) {
      return "live";
    }
    if (business.custom_domain_verified) {
      // If verified but has TXT value set, awaiting TXT
      if (business.custom_domain_txt_value) {
        return "awaiting_txt";
      }
      return "verified";
    }
    return "pending";
  };

  const getStatusBadge = (business: BusinessWithDomain) => {
    const status = getStatus(business);
    
    switch (status) {
      case "live":
        return (
          <Badge className="bg-green-500 hover:bg-green-600">
            <CheckCircle className="h-3 w-3 mr-1" />
            Live
          </Badge>
        );
      case "awaiting_txt":
        return (
          <Badge className="bg-amber-500 hover:bg-amber-600">
            <FileText className="h-3 w-3 mr-1" />
            Awaiting TXT
          </Badge>
        );
      case "verified":
        return (
          <Badge className="bg-blue-500 hover:bg-blue-600">
            <Clock className="h-3 w-3 mr-1" />
            Ready for Hosting
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="secondary">
            <XCircle className="h-3 w-3 mr-1" />
            Pending DNS
          </Badge>
        );
    }
  };

  const filteredBusinesses = businesses.filter(b => {
    const status = getStatus(b);
    const matchesFilter = filter === "all" || status === filter;
    const matchesSearch = 
      b.business_name.toLowerCase().includes(search.toLowerCase()) ||
      b.custom_booking_domain?.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const pendingCount = businesses.filter(b => getStatus(b) === "pending").length;
  const verifiedCount = businesses.filter(b => getStatus(b) === "verified").length;
  const awaitingTxtCount = businesses.filter(b => getStatus(b) === "awaiting_txt").length;
  const liveCount = businesses.filter(b => getStatus(b) === "live").length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Custom Domains
            </CardTitle>
            <CardDescription>
              Manage custom domains for business booking pages
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={loadBusinesses}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="p-4 bg-muted/50 rounded-lg text-center">
            <div className="text-2xl font-bold text-muted-foreground">{pendingCount}</div>
            <div className="text-sm text-muted-foreground">Pending DNS</div>
          </div>
          <div className="p-4 bg-blue-500/10 rounded-lg text-center">
            <div className="text-2xl font-bold text-blue-600">{verifiedCount}</div>
            <div className="text-sm text-blue-600">Ready for Hosting</div>
          </div>
          <div className="p-4 bg-amber-500/10 rounded-lg text-center">
            <div className="text-2xl font-bold text-amber-600">{awaitingTxtCount}</div>
            <div className="text-sm text-amber-600">Awaiting TXT</div>
          </div>
          <div className="p-4 bg-green-500/10 rounded-lg text-center">
            <div className="text-2xl font-bold text-green-600">{liveCount}</div>
            <div className="text-sm text-green-600">Live</div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-4 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by business or domain..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Domains</SelectItem>
              <SelectItem value="pending">Pending DNS</SelectItem>
              <SelectItem value="verified">Ready for Hosting</SelectItem>
              <SelectItem value="awaiting_txt">Awaiting TXT</SelectItem>
              <SelectItem value="live">Live</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredBusinesses.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {search || filter !== "all" 
              ? "No domains match your filters"
              : "No custom domains configured yet"
            }
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Business</TableHead>
                <TableHead>Domain</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>TXT Record</TableHead>
                <TableHead>Last Checked</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBusinesses.map((business) => (
                <TableRow key={business.id}>
                  <TableCell className="font-medium">
                    {business.business_name}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <code className="text-sm bg-muted px-2 py-1 rounded">
                        {business.custom_booking_domain}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => copyDomain(business.custom_booking_domain!)}
                      >
                        {copiedDomain === business.custom_booking_domain ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(business)}</TableCell>
                  <TableCell>
                    {business.custom_domain_txt_value ? (
                      <code className="text-xs bg-muted px-2 py-1 rounded truncate max-w-[150px] block">
                        {business.custom_domain_txt_value.slice(0, 20)}...
                      </code>
                    ) : (
                      <span className="text-muted-foreground text-sm">Not set</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {business.custom_domain_last_checked_at
                      ? new Date(business.custom_domain_last_checked_at).toLocaleString()
                      : "Never"
                    }
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {/* TXT Record Button - show for verified domains */}
                      {business.custom_domain_verified && !business.custom_domain_added_to_hosting && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openTxtDialog(business)}
                        >
                          <FileText className="h-4 w-4 mr-1" />
                          TXT
                        </Button>
                      )}
                      
                      {/* Mark as Added - show for verified domains with TXT set */}
                      {(getStatus(business) === "verified" || getStatus(business) === "awaiting_txt") && (
                        <Button
                          size="sm"
                          onClick={() => markAsAddedToHosting(business.id)}
                          disabled={updating === business.id}
                        >
                          {updating === business.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Check className="h-4 w-4 mr-1" />
                              Mark Live
                            </>
                          )}
                        </Button>
                      )}
                      
                      {getStatus(business) === "live" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(`https://${business.custom_booking_domain}`, "_blank")}
                        >
                          <ExternalLink className="h-4 w-4 mr-1" />
                          Visit
                        </Button>
                      )}
                      {business.custom_domain_added_at && (
                        <span className="text-xs text-muted-foreground">
                          Added {new Date(business.custom_domain_added_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* TXT Record Dialog */}
        <Dialog open={txtDialogOpen} onOpenChange={setTxtDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>TXT Record for {selectedBusiness?.business_name}</DialogTitle>
              <DialogDescription>
                Enter the TXT record value from Lovable's domain verification. This will be shown to the business owner.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Domain</Label>
                <code className="block mt-1 text-sm bg-muted px-3 py-2 rounded">
                  {selectedBusiness?.custom_booking_domain}
                </code>
              </div>
              <div>
                <Label htmlFor="txtValue">TXT Record Value</Label>
                <Input
                  id="txtValue"
                  value={txtValue}
                  onChange={(e) => setTxtValue(e.target.value)}
                  placeholder="lovable_verify=abc123..."
                  className="mt-1 font-mono"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Get this from Lovable → Project Settings → Domains → Manual Setup
                </p>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setTxtDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={saveTxtValue} disabled={savingTxt}>
                  {savingTxt ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Save
                </Button>
                {txtValue && (
                  <Button onClick={sendTxtInstructions} disabled={sendingEmail || !txtValue}>
                    {sendingEmail ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    Save & Email Owner
                  </Button>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};
