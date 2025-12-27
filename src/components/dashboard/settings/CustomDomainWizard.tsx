import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Copy,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Info
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface CustomDomainWizardProps {
  domain: string;
  onDomainChange: (domain: string) => void;
  bookingUrl: string;
  onCopyUrl: (url: string) => void;
}

export const CustomDomainWizard = ({
  domain,
  onDomainChange,
  bookingUrl,
  onCopyUrl,
}: CustomDomainWizardProps) => {
  const [showProviderInstructions, setShowProviderInstructions] = useState(false);

  const validateDomainInput = (value: string) => {
    return value
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "")
      .toLowerCase();
  };

  return (
    <div className="space-y-4 pt-4 border-t">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold">Custom Domain (Optional)</Label>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Want customers to visit your own domain? Set up a redirect from your domain to your Aivia booking URL below. 
          Your customers will be redirected automatically.
        </AlertDescription>
      </Alert>

      {/* Booking URL to redirect to */}
      <div className="space-y-2">
        <Label className="text-sm text-muted-foreground">Your Aivia booking URL (redirect target):</Label>
        <div className="flex items-center gap-2">
          <code className="text-sm bg-muted px-3 py-2 rounded flex-1 truncate border">
            {bookingUrl}
          </code>
          <Button variant="outline" size="sm" onClick={() => onCopyUrl(bookingUrl)}>
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(bookingUrl, "_blank")}
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Custom domain input (for reference) */}
      <div className="space-y-2">
        <Label>Your custom domain (for your reference)</Label>
        <Input
          value={domain}
          onChange={(e) => onDomainChange(validateDomainInput(e.target.value))}
          placeholder="booking.yourdomain.com"
        />
        <p className="text-xs text-muted-foreground">
          This is just for your records. Set up the redirect at your domain provider.
        </p>
      </div>

      {/* Provider-specific redirect instructions */}
      <Collapsible open={showProviderInstructions} onOpenChange={setShowProviderInstructions}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" size="sm" className="w-full justify-between">
            <span className="text-sm">How to set up a redirect at your provider</span>
            {showProviderInstructions ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-2 pt-3">
          <div className="text-sm space-y-2 p-3 bg-muted/50 rounded-md">
            <p className="font-medium">GoDaddy:</p>
            <p className="text-muted-foreground">
              Domain Settings → Forwarding → Add Forwarding → Enter your Aivia URL → Select "Forward with masking" or "301 Redirect"
            </p>
          </div>
          <div className="text-sm space-y-2 p-3 bg-muted/50 rounded-md">
            <p className="font-medium">Namecheap:</p>
            <p className="text-muted-foreground">
              Domain List → Manage → Redirect Domain → Enter your Aivia URL
            </p>
          </div>
          <div className="text-sm space-y-2 p-3 bg-muted/50 rounded-md">
            <p className="font-medium">Cloudflare:</p>
            <p className="text-muted-foreground">
              Rules → Page Rules → Create Page Rule → URL: your-domain.com/* → Setting: Forwarding URL (301) → Destination: your Aivia URL
            </p>
          </div>
          <div className="text-sm space-y-2 p-3 bg-muted/50 rounded-md">
            <p className="font-medium">Squarespace:</p>
            <p className="text-muted-foreground">
              Settings → Domains → Manage domain → URL Mappings → Add redirect to your Aivia URL
            </p>
          </div>
          <div className="text-sm space-y-2 p-3 bg-muted/50 rounded-md">
            <p className="font-medium">Wix:</p>
            <p className="text-muted-foreground">
              Settings → Domains → Manage domain → Redirect domain → Enter your Aivia URL
            </p>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {domain && (
        <Alert className="bg-green-500/10 border-green-500/20">
          <Info className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-700 dark:text-green-400">
            Once you set up the redirect, customers visiting <strong>{domain}</strong> will be automatically sent to your Aivia booking page.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};
