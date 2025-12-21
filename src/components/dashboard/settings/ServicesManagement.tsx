import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

interface ServicesManagementProps {
  businessId: string;
  onUpdate: () => void;
  currency?: string;
}

interface Service {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price: number;
  category: string;
  deposit_required: boolean;
  deposit_amount: number;
}

export const ServicesManagement = ({ businessId, onUpdate, currency = "GBP" }: ServicesManagementProps) => {
  const { toast } = useToast();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    duration_minutes: 60,
    price: 0,
    category: "",
    deposit_required: false,
    deposit_amount: 0,
  });

  const getCurrencySymbol = (curr: string) => {
    const symbols: Record<string, string> = {
      GBP: "£",
      USD: "$",
      EUR: "€",
      CAD: "$",
      AUD: "$",
      JPY: "¥",
      CHF: "CHF",
      SEK: "kr",
      NOK: "kr",
      DKK: "kr",
    };
    return symbols[curr] || "$";
  };

  const currencySymbol = getCurrencySymbol(currency);

  useEffect(() => {
    loadServices();
    
    // Set up realtime subscription with smart updates
    const channel = supabase
      .channel('services-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'services',
          filter: `business_id=eq.${businessId}`
        },
        (payload) => {
          setServices(prev => [...prev, payload.new as Service]);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'services',
          filter: `business_id=eq.${businessId}`
        },
        (payload) => {
          setServices(prev => prev.map(service => 
            service.id === payload.new.id ? payload.new as Service : service
          ));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'services',
          filter: `business_id=eq.${businessId}`
        },
        (payload) => {
          setServices(prev => prev.filter(service => service.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [businessId]);

  const loadServices = async () => {
    const { data } = await supabase
      .from("services")
      .select("*")
      .eq("business_id", businessId);
    
    if (data) setServices(data);
  };

  const openEditDialog = (service: Service) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      description: service.description || "",
      duration_minutes: service.duration_minutes,
      price: service.price,
      category: service.category,
      deposit_required: service.deposit_required || false,
      deposit_amount: service.deposit_amount || 0,
    });
    setDialogOpen(true);
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingService(null);
      setFormData({ name: "", description: "", duration_minutes: 60, price: 0, category: "", deposit_required: false, deposit_amount: 0 });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (editingService) {
      // Update existing service
      const { error } = await supabase
        .from("services")
        .update(formData)
        .eq("id", editingService.id);

      if (error) {
        toast({
          title: "Error",
          description: "Failed to update service.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "Service updated successfully.",
        });
        handleDialogClose(false);
        loadServices();
        onUpdate();
      }
    } else {
      // Create new service
      const { error } = await supabase
        .from("services")
        .insert([{ ...formData, business_id: businessId }]);

      if (error) {
        toast({
          title: "Error",
          description: "Failed to add service.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "Service added successfully.",
        });
        handleDialogClose(false);
        loadServices();
        onUpdate();
      }
    }

    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from("services")
      .delete()
      .eq("id", id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete service.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Service deleted successfully.",
      });
      loadServices();
      onUpdate();
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Services</CardTitle>
          <CardDescription>Manage your business services</CardDescription>
        </div>
        <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditingService(null); setFormData({ name: "", description: "", duration_minutes: 60, price: 0, category: "", deposit_required: false, deposit_amount: 0 }); }}>
              <Plus className="w-4 h-4 mr-2" />
              Add Service
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingService ? "Edit Service" : "Add New Service"}</DialogTitle>
              <DialogDescription>
                {editingService ? "Update service details" : "Create a new service for your business"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Service Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Input
                  id="category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="duration">Duration (minutes) *</Label>
                  <Input
                    id="duration"
                    type="number"
                    value={formData.duration_minutes}
                    onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="price">Price ({currencySymbol}) *</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                    required
                  />
                </div>
              </div>
              <div className="space-y-4 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="deposit_required">Require Deposit</Label>
                    <p className="text-sm text-muted-foreground">Collect a deposit when booking this service</p>
                  </div>
                  <Switch
                    id="deposit_required"
                    checked={formData.deposit_required}
                    onCheckedChange={(checked) => setFormData({ ...formData, deposit_required: checked })}
                  />
                </div>
                {formData.deposit_required && (
                  <div className="space-y-2">
                    <Label htmlFor="deposit_amount">Deposit Amount ({currencySymbol})</Label>
                    <Input
                      id="deposit_amount"
                      type="number"
                      step="0.01"
                      min="0"
                      max={formData.price}
                      value={formData.deposit_amount}
                      onChange={(e) => setFormData({ ...formData, deposit_amount: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                )}
              </div>
              <Button type="submit" disabled={loading}>
                {loading ? (editingService ? "Updating..." : "Adding...") : (editingService ? "Update Service" : "Add Service")}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {services.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No services configured yet</p>
            <p className="text-sm">Add your first service to get started</p>
          </div>
        ) : (
          <div className="space-y-4">
            {services.map((service) => (
              <div key={service.id} className="flex items-start justify-between p-4 border rounded-lg">
                <div>
                  <h4 className="font-semibold">{service.name}</h4>
                  <p className="text-sm text-muted-foreground">{service.category}</p>
                  {service.description && (
                    <p className="text-sm text-muted-foreground mt-1">{service.description}</p>
                  )}
                  <div className="flex gap-4 mt-2 text-sm">
                    <span>{service.duration_minutes} min</span>
                    <span>{currencySymbol}{service.price}</span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEditDialog(service)}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(service.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};