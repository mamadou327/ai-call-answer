import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Check, X, Mail } from "lucide-react";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";

interface StaffAccountsManagementProps {
  businessId: string;
  onUpdate: () => void;
}

interface StaffAccount {
  id: string;
  staff_id: string;
  email: string;
  status: string;
  invited_at: string;
  approved_at: string | null;
  staff?: { name: string; role: string };
}

interface Staff {
  id: string;
  name: string;
  role: string;
  email: string | null;
}

export const StaffAccountsManagement = ({ businessId, onUpdate }: StaffAccountsManagementProps) => {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [accounts, setAccounts] = useState<StaffAccount[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    staff_id: "",
    email: "",
  });

  useEffect(() => {
    loadAccounts();
    loadStaff();
  }, [businessId]);

  const loadAccounts = async () => {
    const { data } = await supabase
      .from("staff_accounts")
      .select(`
        *,
        staff:staff_id (
          name,
          role
        )
      `)
      .eq("business_id", businessId)
      .order("invited_at", { ascending: false });
    
    if (data) setAccounts(data);
  };

  const loadStaff = async () => {
    const { data } = await supabase
      .from("staff")
      .select("id, name, role, email")
      .eq("business_id", businessId);
    
    if (data) setStaff(data);
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from("staff_accounts")
        .insert([{
          business_id: businessId,
          staff_id: formData.staff_id,
          email: formData.email,
          status: "pending",
        }]);

      if (error) throw error;

      toast({
        title: t("staff.invitationSent"),
        description: t("staff.invitationDescription"),
      });

      setDialogOpen(false);
      setFormData({ staff_id: "", email: "" });
      loadAccounts();
      onUpdate();
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

  const handleApprove = async (accountId: string) => {
    try {
      const { error } = await supabase
        .from("staff_accounts")
        .update({ status: "active", approved_at: new Date().toISOString() })
        .eq("id", accountId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Staff account approved.",
      });

      loadAccounts();
      onUpdate();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleReject = async (accountId: string) => {
    try {
      const { error } = await supabase
        .from("staff_accounts")
        .update({ status: "rejected" })
        .eq("id", accountId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Staff account rejected.",
      });

      loadAccounts();
      onUpdate();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleRevoke = async (accountId: string) => {
    if (!confirm(t("staff.revokeConfirm"))) {
      return;
    }

    try {
      const { error } = await supabase
        .from("staff_accounts")
        .update({ status: "revoked" })
        .eq("id", accountId);

      if (error) throw error;

      toast({
        title: "Access Revoked",
        description: "Staff member's access has been removed.",
      });

      loadAccounts();
      onUpdate();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const availableStaff = staff.filter(
    (s) => !accounts.some((a) => a.staff_id === s.id && (a.status === "active" || a.status === "pending"))
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{t("staff.title")}</CardTitle>
            <CardDescription>
              {t("staff.description")}
            </CardDescription>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            {t("staff.inviteStaff")}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("staff.noAccounts")}</p>
        ) : (
          <div className="space-y-3">
            {accounts.map((account) => (
              <div
                key={account.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center gap-4">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">
                      {account.staff?.name} - {account.staff?.role}
                    </p>
                    <p className="text-sm text-muted-foreground">{account.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Invited {format(new Date(account.invited_at), "PPP")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {account.status === "pending" && (
                    <>
                      <Badge variant="secondary">{t("staff.pending")}</Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleApprove(account.id)}
                      >
                        <Check className="h-4 w-4 text-green-600" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleReject(account.id)}
                      >
                        <X className="h-4 w-4 text-red-600" />
                      </Button>
                    </>
                  )}
                  {account.status === "active" && (
                    <>
                      <Badge className="bg-green-600">{t("staff.active")}</Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRevoke(account.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        {t("staff.revoke")}
                      </Button>
                    </>
                  )}
                  {account.status === "rejected" && (
                    <Badge variant="destructive">{t("staff.rejected")}</Badge>
                  )}
                  {account.status === "revoked" && (
                    <Badge variant="secondary" className="bg-gray-500">{t("staff.revoked")}</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("staff.inviteTitle")}</DialogTitle>
            <DialogDescription>
              {t("staff.inviteDescription")}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleInvite} className="space-y-4">
            <div className="space-y-2">
              <Label>{t("staff.selectStaff")} *</Label>
              <Select
                value={formData.staff_id}
                onValueChange={(value) => {
                  const selectedStaff = staff.find((s) => s.id === value);
                  setFormData({
                    staff_id: value,
                    email: selectedStaff?.email || "",
                  });
                }}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("staff.selectStaff")} />
                </SelectTrigger>
                <SelectContent>
                  {availableStaff.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name} - {member.role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t("staff.emailAddress")} *</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="staff@example.com"
                required
              />
              <p className="text-xs text-muted-foreground">
                {t("staff.emailHelp")}
              </p>
            </div>

            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                {t("staff.cancel")}
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? t("staff.sending") : t("staff.sendInvitation")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
};