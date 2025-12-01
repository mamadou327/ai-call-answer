import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Phone, Pause, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AiviaStatusCardProps {
  businessId: string;
  isActive: boolean;
  isSetupComplete: boolean;
  onStatusChange: (newStatus: boolean) => void;
}

export const AiviaStatusCard = ({ 
  businessId, 
  isActive, 
  isSetupComplete,
  onStatusChange 
}: AiviaStatusCardProps) => {
  const { toast } = useToast();

  const handleToggle = async (checked: boolean) => {
    if (checked && !isSetupComplete) {
      toast({
        title: "Setup incomplete",
        description: "Complete all setup steps before activating Aivia.",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase
      .from("businesses")
      .update({ aivia_active: checked })
      .eq("id", businessId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update Aivia status.",
        variant: "destructive",
      });
    } else {
      onStatusChange(checked);
      toast({
        title: checked ? "Aivia activated" : "Aivia paused",
        description: checked 
          ? "Aivia is now answering calls and handling bookings."
          : "Aivia has been paused and is not answering calls.",
      });
    }
  };

  const getStatus = () => {
    if (!isSetupComplete) return { label: "Not ready", variant: "secondary" as const, icon: AlertCircle };
    if (isActive) return { label: "Active", variant: "default" as const, icon: Phone };
    return { label: "Paused", variant: "outline" as const, icon: Pause };
  };

  const status = getStatus();
  const StatusIcon = status.icon;

  const getDescription = () => {
    if (!isSetupComplete) return "Aivia is not answering calls yet. Complete the setup steps below.";
    if (isActive) return "Aivia is currently answering calls and handling bookings for your business.";
    return "Aivia is paused and not answering calls right now.";
  };

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-lg">
              <StatusIcon className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Aivia Status</CardTitle>
              <Badge variant={status.variant} className="mt-1">
                {status.label}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {isActive ? "Active" : "Inactive"}
            </span>
            <Switch
              checked={isActive}
              onCheckedChange={handleToggle}
              disabled={!isSetupComplete && !isActive}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{getDescription()}</p>
        {!isSetupComplete && (
          <p className="text-sm text-muted-foreground mt-2 italic">
            Complete all setup steps before activating Aivia.
          </p>
        )}
      </CardContent>
    </Card>
  );
};
