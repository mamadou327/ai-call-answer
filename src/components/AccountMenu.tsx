import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { User, LogOut, KeyRound, Bot, Loader2 } from "lucide-react";

interface AccountMenuProps {
  businessName: string;
  userEmail: string;
  planTier?: string;
  aiviaActive: boolean;
  businessId: string;
  onAiviaToggle: (active: boolean) => void;
}

export const AccountMenu = ({
  businessName,
  userEmail,
  planTier,
  aiviaActive,
  businessId,
  onAiviaToggle,
}: AccountMenuProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    newPassword: "",
    confirmPassword: "",
  });

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const handleAiToggle = async (checked: boolean) => {
    await supabase
      .from("businesses")
      .update({ aivia_active: checked })
      .eq("id", businessId);
    onAiviaToggle(checked);
    toast({
      title: checked ? "AI Activated" : "AI Deactivated",
      description: checked
        ? "AI receptionist is now active"
        : "AI receptionist is now inactive",
    });
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      toast({
        title: "Error",
        description: "Password must be at least 8 characters",
        variant: "destructive",
      });
      return;
    }

    setPasswordLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordForm.newPassword,
      });

      if (error) throw error;

      toast({
        title: "Password Updated",
        description: "Your password has been changed successfully.",
      });
      setChangePasswordOpen(false);
      setPasswordForm({ newPassword: "", confirmPassword: "" });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update password",
        variant: "destructive",
      });
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" className="rounded-full">
            <User className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72 p-4 bg-popover">
          <div className="space-y-4">
            {/* Business Info */}
            <div className="space-y-1">
              <h4 className="font-semibold text-sm">{businessName}</h4>
              <p className="text-xs text-muted-foreground">{userEmail}</p>
              {planTier && (
                <p className="text-xs text-muted-foreground capitalize">
                  Plan: {planTier.replace("_", " ")}
                </p>
              )}
            </div>

            <DropdownMenuSeparator />

            {/* AI Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">AI receptionist</span>
              </div>
              <Switch
                checked={aiviaActive}
                onCheckedChange={handleAiToggle}
              />
            </div>

            <DropdownMenuSeparator />

            {/* Change Password */}
            <button
              onClick={() => {
                setIsOpen(false);
                setChangePasswordOpen(true);
              }}
              className="flex items-center gap-2 w-full text-sm hover:text-primary transition-colors"
            >
              <KeyRound className="h-4 w-4" />
              Change password
            </button>

            <DropdownMenuSeparator />

            {/* Sign Out */}
            <Button
              variant="outline"
              className="w-full"
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign out
            </Button>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Change Password Dialog */}
      <Dialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>
              Enter your new password below.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) =>
                  setPasswordForm({ ...passwordForm, newPassword: e.target.value })
                }
                required
                minLength={8}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) =>
                  setPasswordForm({
                    ...passwordForm,
                    confirmPassword: e.target.value,
                  })
                }
                required
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setChangePasswordOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={passwordLoading}>
                {passwordLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Update Password"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};
