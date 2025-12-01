import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Edit } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

interface StaffManagementProps {
  businessId: string;
  onUpdate: () => void;
}

interface Staff {
  id: string;
  name: string;
  role: string;
  email?: string;
  phone?: string;
  color?: string;
}

interface Service {
  id: string;
  name: string;
}

export const StaffManagement = ({ businessId, onUpdate }: StaffManagementProps) => {
  const { toast } = useToast();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    role: "",
    email: "",
    phone: "",
    color: "#3B82F6",
  });
  const [selectedServices, setSelectedServices] = useState<string[]>([]);

  useEffect(() => {
    loadStaff();
    loadServices();
  }, [businessId]);

  const loadStaff = async () => {
    const { data } = await supabase
      .from("staff")
      .select("*")
      .eq("business_id", businessId);
    
    if (data) setStaff(data);
  };

  const loadServices = async () => {
    const { data } = await supabase
      .from("services")
      .select("id, name")
      .eq("business_id", businessId);
    
    if (data) setServices(data);
  };

  const loadStaffServices = async (staffId: string) => {
    const { data } = await supabase
      .from("staff_services")
      .select("service_id")
      .eq("staff_id", staffId);
    
    if (data) {
      setSelectedServices(data.map(ss => ss.service_id));
    }
  };

  const handleEdit = async (member: Staff) => {
    setSelectedStaff(member);
    setFormData({
      name: member.name,
      role: member.role,
      email: member.email || "",
      phone: member.phone || "",
      color: member.color || "#3B82F6",
    });
    await loadStaffServices(member.id);
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (selectedStaff) {
        // Update existing staff
        const { error: staffError } = await supabase
          .from("staff")
          .update({ ...formData })
          .eq("id", selectedStaff.id);

        if (staffError) throw staffError;

        // Update staff services
        await supabase
          .from("staff_services")
          .delete()
          .eq("staff_id", selectedStaff.id);

        if (selectedServices.length > 0) {
          const { error: servicesError } = await supabase
            .from("staff_services")
            .insert(selectedServices.map(serviceId => ({
              staff_id: selectedStaff.id,
              service_id: serviceId,
            })));

          if (servicesError) throw servicesError;
        }

        toast({
          title: "Success",
          description: "Staff member updated successfully.",
        });
      } else {
        // Create new staff
        const { data: newStaff, error: staffError } = await supabase
          .from("staff")
          .insert([{ ...formData, business_id: businessId }])
          .select()
          .single();

        if (staffError) throw staffError;

        // Add staff services
        if (selectedServices.length > 0 && newStaff) {
          const { error: servicesError } = await supabase
            .from("staff_services")
            .insert(selectedServices.map(serviceId => ({
              staff_id: newStaff.id,
              service_id: serviceId,
            })));

          if (servicesError) throw servicesError;
        }

        toast({
          title: "Success",
          description: "Staff member added successfully.",
        });
      }

      setDialogOpen(false);
      setSelectedStaff(null);
      setFormData({ name: "", role: "", email: "", phone: "", color: "#3B82F6" });
      setSelectedServices([]);
      loadStaff();
      onUpdate();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save staff member.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from("staff")
      .delete()
      .eq("id", id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete staff member.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Staff member deleted successfully.",
      });
      loadStaff();
      onUpdate();
    }
  };

  const toggleService = (serviceId: string) => {
    setSelectedServices(prev =>
      prev.includes(serviceId)
        ? prev.filter(id => id !== serviceId)
        : [...prev, serviceId]
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Staff Members</CardTitle>
          <CardDescription>Manage your team and their services</CardDescription>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setSelectedStaff(null);
            setFormData({ name: "", role: "", email: "", phone: "", color: "#3B82F6" });
            setSelectedServices([]);
          }
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Staff
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedStaff ? "Edit Staff Member" : "Add Staff Member"}</DialogTitle>
              <DialogDescription>
                {selectedStaff ? "Update team member information" : "Add a new team member"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="staff_name">Name *</Label>
                <Input
                  id="staff_name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role *</Label>
                <Input
                  id="role"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  placeholder="e.g., Stylist, Therapist, Dentist"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email (optional)</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="staff@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone (optional)</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+44 7700 900000"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="color">Calendar Color</Label>
                <div className="flex gap-2 items-center">
                  <Input
                    id="color"
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="w-20 h-10"
                  />
                  <span className="text-sm text-muted-foreground">
                    Color for this staff member in calendar views
                  </span>
                </div>
              </div>

              {services.length > 0 && (
                <div className="space-y-2">
                  <Label>Services</Label>
                  <div className="space-y-2 max-h-48 overflow-y-auto border rounded p-3">
                    {services.map((service) => (
                      <div key={service.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`service-${service.id}`}
                          checked={selectedServices.includes(service.id)}
                          onCheckedChange={() => toggleService(service.id)}
                        />
                        <label
                          htmlFor={`service-${service.id}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          {service.name}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Button type="submit" disabled={loading}>
                {loading ? "Saving..." : selectedStaff ? "Update Staff" : "Add Staff"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {staff.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No staff members added yet</p>
            <p className="text-sm">Add your first team member to get started</p>
          </div>
        ) : (
          <div className="space-y-4">
            {staff.map((member) => (
              <div key={member.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1 flex items-center gap-3">
                  <div 
                    className="w-4 h-4 rounded-full border-2 border-background shadow-sm flex-shrink-0"
                    style={{ backgroundColor: member.color || "#3B82F6" }}
                    title="Calendar color"
                  />
                  <div>
                    <h4 className="font-semibold">{member.name}</h4>
                    <p className="text-sm text-muted-foreground">{member.role}</p>
                    {member.email && <p className="text-xs text-muted-foreground mt-1">{member.email}</p>}
                    {member.phone && <p className="text-xs text-muted-foreground">{member.phone}</p>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(member)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(member.id)}
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
