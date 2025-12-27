import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  RefreshCw
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
}

export const CustomDomainsTab = () => {
  const { toast } = useToast();
  const [businesses, setBusinesses] = useState<BusinessWithDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedDomain, setCopiedDomain] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "verified" | "live">("all");
  const [search, setSearch] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    loadBusinesses();
  }, []);

  const loadBusinesses = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("businesses")
        .select("id, business_name, custom_booking_domain, custom_domain_verified, custom_domain_added_to_hosting, custom_domain_added_at, custom_domain_status_message, custom_domain_last_checked_at")
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

  const getStatus = (business: BusinessWithDomain) => {
    if (business.custom_domain_added_to_hosting) {
      return "live";
    }
    if (business.custom_domain_verified) {
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
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="p-4 bg-muted/50 rounded-lg text-center">
            <div className="text-2xl font-bold text-muted-foreground">{pendingCount}</div>
            <div className="text-sm text-muted-foreground">Pending DNS</div>
          </div>
          <div className="p-4 bg-blue-500/10 rounded-lg text-center">
            <div className="text-2xl font-bold text-blue-600">{verifiedCount}</div>
            <div className="text-sm text-blue-600">Ready for Hosting</div>
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
                  <TableCell className="text-sm text-muted-foreground">
                    {business.custom_domain_last_checked_at
                      ? new Date(business.custom_domain_last_checked_at).toLocaleString()
                      : "Never"
                    }
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getStatus(business) === "verified" && (
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
                              Mark as Added
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
      </CardContent>
    </Card>
  );
};
