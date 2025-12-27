import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertCircle, 
  RefreshCw, 
  Loader2,
  Copy,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  FileText
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface CustomDomainWizardProps {
  domain: string;
  onDomainChange: (domain: string) => void;
  verified: boolean;
  statusMessage: string;
  lastChecked: string | null;
  addedToHosting: boolean;
  txtValue: string | null;
  onVerify: () => void;
  verifying: boolean;
  onCopyUrl: (url: string) => void;
}

export const CustomDomainWizard = ({
  domain,
  onDomainChange,
  verified,
  statusMessage,
  lastChecked,
  addedToHosting,
  txtValue,
  onVerify,
  verifying,
  onCopyUrl,
}: CustomDomainWizardProps) => {
  const [showProviderInstructions, setShowProviderInstructions] = useState(false);
  const [copiedTxt, setCopiedTxt] = useState(false);

  const validateDomainInput = (value: string) => {
    return value
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "")
      .toLowerCase();
  };

  const copyTxtValue = () => {
    if (txtValue) {
      navigator.clipboard.writeText(txtValue);
      setCopiedTxt(true);
      setTimeout(() => setCopiedTxt(false), 2000);
    }
  };

  const getStep = () => {
    if (!domain) return 1;
    if (!verified) return 2;
    if (txtValue && !addedToHosting) return 3; // Awaiting TXT record
    if (!addedToHosting) return 3.5; // Awaiting admin setup
    return 4;
  };

  const currentStep = getStep();
  const customBookingUrl = domain ? `https://${domain}` : null;

  const getVerificationBadge = () => {
    if (!domain) return null;

    if (addedToHosting) {
      return (
        <Badge className="bg-green-500 hover:bg-green-600">
          <CheckCircle className="h-3 w-3 mr-1" />
          Live
        </Badge>
      );
    }

    if (txtValue && verified) {
      return (
        <Badge className="bg-amber-500 hover:bg-amber-600">
          <FileText className="h-3 w-3 mr-1" />
          Add TXT Record
        </Badge>
      );
    }

    if (verified) {
      return (
        <Badge className="bg-blue-500 hover:bg-blue-600">
          <Clock className="h-3 w-3 mr-1" />
          Pending Setup
        </Badge>
      );
    }

    if (statusMessage) {
      return (
        <Badge variant="destructive">
          <XCircle className="h-3 w-3 mr-1" />
          Not Verified
        </Badge>
      );
    }

    return (
      <Badge variant="secondary">
        <Clock className="h-3 w-3 mr-1" />
        Pending
      </Badge>
    );
  };

  return (
    <div className="space-y-4 pt-4 border-t">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold">Custom Domain (Optional)</Label>
        {getVerificationBadge()}
      </div>

      {/* Step 1: Enter Domain */}
      <div className={`p-4 rounded-lg border ${currentStep === 1 ? "border-primary bg-primary/5" : "border-border"}`}>
        <div className="flex items-center gap-2 mb-2">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium ${
            currentStep > 1 ? "bg-green-500 text-white" : currentStep === 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          }`}>
            {currentStep > 1 ? <CheckCircle className="h-4 w-4" /> : "1"}
          </div>
          <span className="font-medium">Enter your domain</span>
        </div>
        <div className="ml-8">
          <Input
            value={domain}
            onChange={(e) => onDomainChange(validateDomainInput(e.target.value))}
            placeholder="booking.yourdomain.com"
            className="mb-2"
          />
          <p className="text-xs text-muted-foreground">
            Use a subdomain like <code className="bg-muted px-1 rounded">booking.yourbusiness.com</code> or <code className="bg-muted px-1 rounded">book.yourbusiness.com</code>
          </p>
        </div>
      </div>

      {/* Step 2: Configure DNS - A Record */}
      {domain && (
        <div className={`p-4 rounded-lg border ${currentStep === 2 ? "border-primary bg-primary/5" : "border-border"}`}>
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium ${
              currentStep > 2 ? "bg-green-500 text-white" : currentStep === 2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}>
              {currentStep > 2 ? <CheckCircle className="h-4 w-4" /> : "2"}
            </div>
            <span className="font-medium">Add A record at your domain provider</span>
          </div>
          <div className="ml-8 space-y-3">
            <div className="bg-muted p-3 rounded-md font-mono text-sm space-y-1">
              <div className="flex items-center justify-between">
                <span><span className="text-muted-foreground">Type:</span> A</span>
              </div>
              <div className="flex items-center justify-between">
                <span><span className="text-muted-foreground">Name:</span> {domain.split('.')[0]}</span>
              </div>
              <div className="flex items-center justify-between">
                <span><span className="text-muted-foreground">Value:</span> 185.158.133.1</span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 px-2"
                  onClick={() => {
                    navigator.clipboard.writeText("185.158.133.1");
                  }}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Provider-specific instructions */}
            <Collapsible open={showProviderInstructions} onOpenChange={setShowProviderInstructions}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full justify-between">
                  <span className="text-sm text-muted-foreground">Provider-specific instructions</span>
                  {showProviderInstructions ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 pt-2">
                <div className="text-sm space-y-2 p-3 bg-muted/50 rounded-md">
                  <p className="font-medium">GoDaddy:</p>
                  <p className="text-muted-foreground">DNS → Manage Zones → Add Record → Select "A" → Enter subdomain name and IP</p>
                </div>
                <div className="text-sm space-y-2 p-3 bg-muted/50 rounded-md">
                  <p className="font-medium">Namecheap:</p>
                  <p className="text-muted-foreground">Domain List → Manage → Advanced DNS → Add New Record → A Record</p>
                </div>
                <div className="text-sm space-y-2 p-3 bg-muted/50 rounded-md">
                  <p className="font-medium">Cloudflare:</p>
                  <p className="text-muted-foreground">DNS → Add record → Type: A → Name: subdomain → IPv4: 185.158.133.1 → Proxy: OFF (DNS only)</p>
                </div>
              </CollapsibleContent>
            </Collapsible>

            <Button 
              variant="default" 
              onClick={onVerify}
              disabled={verifying}
              className="w-full"
            >
              {verifying ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Checking DNS...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Verify Domain
                </>
              )}
            </Button>

            {statusMessage && !verified && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {statusMessage}
                  {lastChecked && (
                    <p className="text-xs mt-1 opacity-70">
                      Last checked: {new Date(lastChecked).toLocaleString()}
                    </p>
                  )}
                </AlertDescription>
              </Alert>
            )}

            <p className="text-xs text-muted-foreground">
              DNS changes can take up to 24-48 hours to propagate. You can check again after adding the record.
            </p>
          </div>
        </div>
      )}

      {/* Step 3: TXT Record (when admin has provided it) */}
      {domain && verified && txtValue && !addedToHosting && (
        <div className={`p-4 rounded-lg border border-amber-500 bg-amber-500/5`}>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium bg-amber-500 text-white">
              <FileText className="h-4 w-4" />
            </div>
            <span className="font-medium">Add TXT record for verification</span>
          </div>
          <div className="ml-8 space-y-3">
            <Alert className="border-amber-500/50 bg-amber-500/10">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-700 dark:text-amber-400">
                <p className="font-medium">Action Required!</p>
                <p className="text-sm mt-1">
                  To complete setup, add this TXT record at your domain provider. This proves you own the domain.
                </p>
              </AlertDescription>
            </Alert>

            <div className="bg-muted p-3 rounded-md font-mono text-sm space-y-1">
              <div className="flex items-center justify-between">
                <span><span className="text-muted-foreground">Type:</span> TXT</span>
              </div>
              <div className="flex items-center justify-between">
                <span><span className="text-muted-foreground">Name:</span> _lovable</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="truncate flex-1">
                  <span className="text-muted-foreground">Value:</span> {txtValue}
                </span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 px-2 shrink-0"
                  onClick={copyTxtValue}
                >
                  {copiedTxt ? (
                    <CheckCircle className="h-3 w-3 text-green-500" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              After adding the TXT record, wait 5-10 minutes for propagation. Our team will complete the SSL setup once verified.
            </p>
          </div>
        </div>
      )}

      {/* Step 3.5: Awaiting Setup (no TXT yet) */}
      {domain && verified && !txtValue && !addedToHosting && (
        <div className={`p-4 rounded-lg border border-blue-500 bg-blue-500/5`}>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium bg-blue-500 text-white">
              <Clock className="h-4 w-4" />
            </div>
            <span className="font-medium">Awaiting SSL setup</span>
          </div>
          <div className="ml-8">
            <Alert>
              <CheckCircle className="h-4 w-4 text-green-500" />
              <AlertDescription>
                <p className="font-medium text-green-700 dark:text-green-400">A record verified successfully!</p>
                <p className="text-sm mt-1">
                  Your domain is correctly pointing to our servers. Our team has been notified and will set up SSL within 24 hours. 
                  You may receive an email with additional instructions to add a TXT record for verification.
                </p>
              </AlertDescription>
            </Alert>
          </div>
        </div>
      )}

      {/* Step 4: Live */}
      {domain && verified && addedToHosting && customBookingUrl && (
        <div className="p-4 rounded-lg border border-green-500 bg-green-500/5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium bg-green-500 text-white">
              <CheckCircle className="h-4 w-4" />
            </div>
            <span className="font-medium">Your custom domain is live!</span>
          </div>
          <div className="ml-8">
            <div className="flex items-center gap-2">
              <code className="text-sm bg-green-500/10 text-green-700 dark:text-green-400 px-2 py-1 rounded flex-1 truncate border border-green-500/20">
                {customBookingUrl}
              </code>
              <Button variant="outline" size="sm" onClick={() => onCopyUrl(customBookingUrl)}>
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(customBookingUrl, "_blank")}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
