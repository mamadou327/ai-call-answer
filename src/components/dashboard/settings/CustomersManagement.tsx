import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Users, Upload, Settings2, Phone, Mail, User } from "lucide-react";
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
} from "@/components/ui/dialog";

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
}

interface CustomerSettings {
  collect_name: boolean;
  collect_phone: boolean;
  collect_email: boolean;
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
  });
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);

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

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone?.includes(searchTerm) ||
    c.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Data Collection Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="w-5 h-5" />
            Customer Data Collection
          </CardTitle>
          <CardDescription>
            Configure which customer details Aivia should collect during calls and bookings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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

          <Separator />

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

          <Separator />

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
        </CardContent>
      </Card>

      {/* Customer List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Customers ({customers.length})
            </CardTitle>
            <CardDescription>View and manage your customer database</CardDescription>
          </div>
          <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Upload className="w-4 h-4 mr-2" />
                Import
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Import Customers</DialogTitle>
                <DialogDescription>
                  Import customers from a CSV file
                </DialogDescription>
              </DialogHeader>
              <div className="py-8 text-center">
                <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">CSV import coming soon</p>
                <p className="text-sm text-muted-foreground mt-2">
                  This feature will allow you to bulk import customer data from spreadsheets.
                </p>
              </div>
              <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
                Close
              </Button>
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
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{customer.name}</p>
                      <Badge variant="secondary" className="text-xs">
                        {customer.total_visits} {customer.total_visits === 1 ? 'visit' : 'visits'}
                      </Badge>
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
                    </div>
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    <p>First visit</p>
                    <p>{format(new Date(customer.first_visit_date), "MMM d, yyyy")}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};