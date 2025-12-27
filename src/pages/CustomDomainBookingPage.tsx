import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { isCustomDomain, getCurrentHostname, getBusinessByCustomDomain, getUnverifiedBusinessByDomain } from "@/lib/domainResolver";

/**
 * This component handles requests coming from custom domains.
 * It detects the hostname, looks up the business, and redirects to the booking page.
 */
const CustomDomainBookingPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState<string | null>(null);

  useEffect(() => {
    const resolveDomain = async () => {
      const hostname = getCurrentHostname();
      
      // If not a custom domain, redirect to home
      if (!isCustomDomain(hostname)) {
        navigate("/", { replace: true });
        return;
      }

      // Try to find a verified business for this domain
      const business = await getBusinessByCustomDomain(hostname);
      
      if (business) {
        // Business found and verified - redirect to their booking page
        // We use the slug internally but the URL stays on the custom domain
        navigate(`/book/${business.booking_slug}`, { replace: true });
        return;
      }

      // Check if there's an unverified business with this domain
      const unverifiedBusiness = await getUnverifiedBusinessByDomain(hostname);
      
      if (unverifiedBusiness) {
        setBusinessName(unverifiedBusiness.business_name);
        if (!unverifiedBusiness.custom_domain_verified) {
          setError("This domain is connected but not yet verified. The business owner needs to complete the domain verification process.");
        } else {
          setError("This booking page is temporarily unavailable.");
        }
      } else {
        setError("This domain hasn't been connected to Aivia yet. If you own this domain, please add it in your Aivia dashboard settings.");
      }
      
      setLoading(false);
    };

    resolveDomain();
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading booking page...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <CardTitle>Domain Not Connected</CardTitle>
          <CardDescription className="mt-2">
            {businessName && (
              <span className="block font-medium text-foreground mb-2">{businessName}</span>
            )}
            {error}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-sm text-muted-foreground mb-4">
            If you're the business owner, please check your domain settings in the Aivia dashboard.
          </p>
          <Button variant="outline" onClick={() => window.location.href = "https://aiviaapp.co.uk"}>
            Go to Aivia
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default CustomDomainBookingPage;
