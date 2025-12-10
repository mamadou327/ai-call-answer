import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { User, Mail, Phone, Calendar, Building2, Briefcase, Shield } from "lucide-react";

interface UserDetails {
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  created_at: string | null;
  is_active: boolean;
  role: string | null;
  business_name?: string | null;
  business_id?: string | null;
  phone?: string | null;
  position?: string | null;
}

interface UserDetailsDialogProps {
  user: UserDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const UserDetailsDialog = ({ user, open, onOpenChange }: UserDetailsDialogProps) => {
  if (!user) return null;

  const getRoleBadge = (role: string | null) => {
    switch (role) {
      case "super_admin":
        return <Badge className="bg-primary/10 text-primary">Super Admin</Badge>;
      case "sub_admin":
        return <Badge className="bg-blue-500/10 text-blue-500">Sub Admin</Badge>;
      case "staff":
        return <Badge variant="secondary">Staff</Badge>;
      case "pending_admin":
        return <Badge variant="outline">Pending Admin</Badge>;
      default:
        return <Badge variant="outline">Business Owner</Badge>;
    }
  };

  const InfoRow = ({ icon: Icon, label, value }: { icon: any; label: string; value: string | null | undefined }) => (
    <div className="flex items-start gap-3 py-2">
      <Icon className="w-4 h-4 mt-0.5 text-muted-foreground" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value || "—"}</p>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            User Details
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div>
              <h3 className="font-semibold">
                {user.first_name || user.last_name
                  ? `${user.first_name || ""} ${user.last_name || ""}`.trim()
                  : "Unknown User"}
              </h3>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              {getRoleBadge(user.role)}
              <Badge variant={user.is_active ? "default" : "destructive"}>
                {user.is_active ? "Active" : "Inactive"}
              </Badge>
            </div>
          </div>

          <div className="space-y-1 divide-y">
            <InfoRow icon={Mail} label="Email" value={user.email} />
            <InfoRow 
              icon={Calendar} 
              label="Joined" 
              value={user.created_at ? new Date(user.created_at).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long", 
                year: "numeric"
              }) : null} 
            />
            <InfoRow icon={Shield} label="Role" value={user.role || "business_owner"} />
            {user.business_name && (
              <InfoRow icon={Building2} label="Business" value={user.business_name} />
            )}
            {user.position && (
              <InfoRow icon={Briefcase} label="Position" value={user.position} />
            )}
            {user.phone && (
              <InfoRow icon={Phone} label="Phone" value={user.phone} />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
