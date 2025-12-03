import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Users, Download, Settings2, Phone, Mail, User, ChevronDown, ChevronUp, Calendar, MessageSquare, Heart, UserCheck, Loader2, Eye } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CalendarIcon } from "lucide-react";
import { CustomerDetailDialog } from "../CustomerDetailDialog";

interface CustomersManagementProps {
  businessId: string;
  onUpdate: () => void;
}

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  first_visit_date: string;
  total_visits: number;
  how_heard: string | null;
  marketing_consent: boolean | null;
  notes_preferences: string | null;
  preferred_staff_id: string | null;
}

interface CustomerSettings {
  collect_name: boolean;
  collect_phone: boolean;
  collect_email: boolean;
  ask_how_heard: boolean;
  ask_marketing_consent: boolean;
  ask_preferred_staff: boolean;
  ask_notes_preferences: boolean;
}

export const CustomersManagement = ({ businessId, onUpdate }: CustomersManagementProps) => {
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [settings, setSettings] = useState<CustomerSettings>({
    collect_name: true,
    collect_phone: true,
    collect_email: false,
    ask_how_heard: false,
    ask_marketing_consent: false,
    ask_preferred_staff: false,
    ask_notes_preferences: false,
  });
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportFromDate, setExportFromDate] = useState<Date | undefined>(undefined);
  const [exportToDate, setExportToDate] = useState<Date | undefined>(undefined);
  const [exporting, setExporting] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerDetailOpen, setCustomerDetailOpen] = useState(false);

  useEffect(() => {
    loadCustomers();
    loadSettings();
  }, [businessId]);

  const loadCustomers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .eq("business_id", businessId)
      .order("total_visits", { ascending: false });

    if (error) {
      console.error("Error loading customers:", error);
    } else {
      setCustomers(data || []);
    }
    setLoading(false);
  };

  const loadSettings = async () => {
    const { data } = await supabase
      .from("customer_settings")
      .select("*")
      .eq("business_id", businessId)
      .maybeSingle();

    if (data) {
      setSettings({
        collect_name: data.collect_name,
        collect_phone: data.collect_phone,
        collect_email: data.collect_email,
        ask_how_heard: data.ask_how_heard ?? false,
        ask_marketing_consent: data.ask_marketing_consent ?? false,
        ask_preferred_staff: data.ask_preferred_staff ?? false,
        ask_notes_preferences: data.ask_notes_preferences ?? false,
      });
    }
  };

  const saveSettings = async (newSettings: CustomerSettings) => {
    setSettingsLoading(true);
    const { error } = await supabase
      .from("customer_settings")
      .upsert({
        business_id: businessId,
        ...newSettings,
      }, { onConflict: "business_id" });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to save settings.",
        variant: "destructive",
      });
    } else {
      setSettings(newSettings);
      toast({
        title: "Success",
        description: "Customer collection settings updated.",
      });
    }
    setSettingsLoading(false);
  };

  const handleExportCustomers = async () => {
    setExporting(true);
    
    try {
      // Filter customers by date range if provided
      let customersToExport = [...customers];
      
      if (exportFromDate && exportToDate) {
        customersToExport = customers.filter(c => {
          const visitDate = new Date(c.first_visit_date);
          return visitDate >= exportFromDate && visitDate <= exportToDate;
        });
      }

      if (customersToExport.length === 0) {
        toast({
          title: "No customers to export",
          description: "No customers found for the selected date range.",
          variant: "destructive",
        });
        setExporting(false);
        return;
      }

      // Create CSV content
      const headers = ["Name", "Phone", "Email", "First Visit Date", "Total Visits", "How Heard", "Marketing Consent", "Notes/Preferences"];
      const csvRows = [headers.join(",")];
      
      for (const customer of customersToExport) {
        const row = [
          `"${customer.name.replace(/"/g, '""')}"`,
          customer.phone || "",
          customer.email || "",
          format(new Date(customer.first_visit_date), "yyyy-MM-dd"),
          customer.total_visits.toString(),
          customer.how_heard || "",
          customer.marketing_consent ? "Yes" : "No",
          `"${(customer.notes_preferences || "").replace(/"/g, '""')}"`,
        ];
        csvRows.push(row.join(","));
      }

      const csvContent = csvRows.join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      
      // Generate filename
      let filename = "customers";
      if (exportFromDate && exportToDate) {
        filename += `_${format(exportFromDate, "yyyy-MM-dd")}_to_${format(exportToDate, "yyyy-MM-dd")}`;
      } else {
        filename += "_all";
      }
      filename += ".csv";
      
      // Trigger download
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Export Complete",
        description: `Exported ${customersToExport.length} customers to ${filename}`,
      });

      setExportDialogOpen(false);
      setExportFromDate(undefined);
      setExportToDate(undefined);
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: "Error",
        description: "Failed to export customers.",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const handleViewCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setCustomerDetailOpen(true);
  };

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone?.includes(searchTerm) ||
    c.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeSettingsCount = Object.values(settings).filter(Boolean).length;

  return (
    <div className="space-y-6">
      {/* Customer List - Now at the top */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Customers ({customers.length})
            </CardTitle>
            <CardDescription>View and manage your customer database</CardDescription>
          </div>
          <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Export Customers</DialogTitle>
                <DialogDescription>
                  Download customer data as a CSV file. Optionally filter by date range.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>From Date (optional)</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !exportFromDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {exportFromDate ? format(exportFromDate, "PPP") : "Select start date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarPicker
                        mode="single"
                        selected={exportFromDate}
                        onSelect={setExportFromDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label>To Date (optional)</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !exportToDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {exportToDate ? format(exportToDate, "PPP") : "Select end date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarPicker
                        mode="single"
                        selected={exportToDate}
                        onSelect={setExportToDate}
                        disabled={(date) => exportFromDate ? date < exportFromDate : false}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <p className="text-sm text-muted-foreground">
                  Leave dates empty to export all customers. When dates are provided, customers will be filtered by their first visit date.
                </p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setExportDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleExportCustomers} disabled={exporting}>
                  {exporting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Exporting...
                    </>
                  ) : (
                    "Export Customers"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Input
              placeholder="Search by name, phone, or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading customers...
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No customers found</p>
              <p className="text-sm">Customers will appear here after their first booking</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredCustomers.map((customer) => (
                <div
                  key={customer.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer"
                  onClick={() => handleViewCustomer(customer)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{customer.name}</p>
                      <Badge variant="secondary" className="text-xs">
                        {customer.total_visits} {customer.total_visits === 1 ? 'visit' : 'visits'}
                      </Badge>
                      {customer.marketing_consent && (
                        <Badge variant="outline" className="text-xs">
                          <Heart className="w-3 h-3 mr-1" />
                          Marketing OK
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                      {customer.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {customer.phone}
                        </span>
                      )}
                      {customer.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {customer.email}
                        </span>
                      )}
                      {customer.how_heard && (
                        <span className="text-xs">Via: {customer.how_heard}</span>
                      )}
                    </div>
                    {customer.notes_preferences && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                        Notes: {customer.notes_preferences}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right text-sm text-muted-foreground">
                      <p>First visit</p>
                      <p>{format(new Date(customer.first_visit_date), "MMM d, yyyy")}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleViewCustomer(customer); }}>
                      <Eye className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Data Collection Settings - Collapsible */}
      <Card>
        <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
          <CardHeader className="pb-3">
            <CollapsibleTrigger asChild>
              <div className="flex items-center justify-between cursor-pointer">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Settings2 className="w-5 h-5" />
                    Customer Data Collection
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {activeSettingsCount} options enabled • Click to {settingsOpen ? 'collapse' : 'expand'}
                  </CardDescription>
                </div>
                <Button variant="ghost" size="sm">
                  {settingsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </Button>
              </div>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-4 pt-0">
              <p className="text-sm text-muted-foreground">
                Configure which customer details Aivia should collect during calls and bookings
              </p>
              
              <Separator />
              
              {/* Basic Info */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium">Basic Information</h4>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <Label>Collect Name</Label>
                      <p className="text-sm text-muted-foreground">Ask customers for their name</p>
                    </div>
                  </div>
                  <Switch
                    checked={settings.collect_name}
                    onCheckedChange={(checked) => saveSettings({ ...settings, collect_name: checked })}
                    disabled={settingsLoading}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <Label>Collect Phone Number</Label>
                      <p className="text-sm text-muted-foreground">Ask customers for their phone number</p>
                    </div>
                  </div>
                  <Switch
                    checked={settings.collect_phone}
                    onCheckedChange={(checked) => saveSettings({ ...settings, collect_phone: checked })}
                    disabled={settingsLoading}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <Label>Collect Email</Label>
                      <p className="text-sm text-muted-foreground">Ask customers for their email address</p>
                    </div>
                  </div>
                  <Switch
                    checked={settings.collect_email}
                    onCheckedChange={(checked) => saveSettings({ ...settings, collect_email: checked })}
                    disabled={settingsLoading}
                  />
                </div>
              </div>

              <Separator />

              {/* Additional Questions */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium">Additional Questions</h4>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <MessageSquare className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <Label>Ask "How did you hear about us?"</Label>
                      <p className="text-sm text-muted-foreground">Track where new customers come from</p>
                    </div>
                  </div>
                  <Switch
                    checked={settings.ask_how_heard}
                    onCheckedChange={(checked) => saveSettings({ ...settings, ask_how_heard: checked })}
                    disabled={settingsLoading}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Heart className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <Label>Ask for Marketing Consent</Label>
                      <p className="text-sm text-muted-foreground">"Can we send you offers by SMS or email?"</p>
                    </div>
                  </div>
                  <Switch
                    checked={settings.ask_marketing_consent}
                    onCheckedChange={(checked) => saveSettings({ ...settings, ask_marketing_consent: checked })}
                    disabled={settingsLoading}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <UserCheck className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <Label>Ask for Preferred Staff Member</Label>
                      <p className="text-sm text-muted-foreground">Let customers request a specific staff member</p>
                    </div>
                  </div>
                  <Switch
                    checked={settings.ask_preferred_staff}
                    onCheckedChange={(checked) => saveSettings({ ...settings, ask_preferred_staff: checked })}
                    disabled={settingsLoading}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <Label>Ask for Notes/Preferences</Label>
                      <p className="text-sm text-muted-foreground">Collect haircut preferences, special requests, etc.</p>
                    </div>
                  </div>
                  <Switch
                    checked={settings.ask_notes_preferences}
                    onCheckedChange={(checked) => saveSettings({ ...settings, ask_notes_preferences: checked })}
                    disabled={settingsLoading}
                  />
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Customer Detail Dialog */}
      <CustomerDetailDialog
        customer={selectedCustomer}
        businessId={businessId}
        open={customerDetailOpen}
        onOpenChange={setCustomerDetailOpen}
      />
    </div>
  );
};