import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerifyDomainRequest {
  business_id: string;
  custom_domain: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { business_id, custom_domain }: VerifyDomainRequest = await req.json();

    if (!business_id || !custom_domain) {
      return new Response(
        JSON.stringify({ error: "Missing business_id or custom_domain" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalize the domain (lowercase, trim, remove protocol and paths)
    let normalizedDomain = custom_domain
      .toLowerCase()
      .trim()
      .replace(/^https?:\/\//, "") // Remove protocol
      .replace(/\/.*$/, "") // Remove path
      .replace(/^www\./, ""); // Remove www prefix if present

    console.log(`Verifying domain: ${normalizedDomain} for business: ${business_id}`);

    // Update the business with the normalized domain
    const { error: updateDomainError } = await supabase
      .from("businesses")
      .update({
        custom_booking_domain: normalizedDomain,
        custom_domain_last_checked_at: new Date().toISOString(),
      })
      .eq("id", business_id);

    if (updateDomainError) {
      console.error("Error updating domain:", updateDomainError);
      return new Response(
        JSON.stringify({ error: "Failed to update domain" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Attempt to verify the domain by making an HTTP request
    let verified = false;
    let statusMessage = "";

    try {
      // Try HTTPS first
      const httpsUrl = `https://${normalizedDomain}/`;
      console.log(`Attempting to fetch: ${httpsUrl}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(httpsUrl, {
        method: "HEAD",
        signal: controller.signal,
        headers: {
          "User-Agent": "Aivia-Domain-Verifier/1.0",
        },
      });

      clearTimeout(timeoutId);

      console.log(`Response status: ${response.status}`);

      // If we get any response (even 404), the domain is pointing somewhere and SSL is working
      if (response.ok || response.status === 404 || response.status === 301 || response.status === 302) {
        verified = true;
        statusMessage = "Domain verified and active.";
      } else {
        verified = false;
        statusMessage = `Domain responded with status ${response.status}. Please check your DNS settings.`;
      }
    } catch (fetchError: any) {
      console.error("Fetch error:", fetchError);
      
      if (fetchError.name === "AbortError") {
        statusMessage = "Connection timed out. Please verify your DNS records point to 185.158.133.1.";
      } else if (fetchError.message?.includes("ssl") || fetchError.message?.includes("certificate")) {
        statusMessage = "SSL certificate not yet provisioned. DNS is correctly pointed, but certificates may take up to 24 hours to activate.";
        // Domain is pointed correctly, just waiting for SSL
        verified = false;
      } else {
        statusMessage = "Could not reach your domain. Please add an A record pointing to 185.158.133.1. DNS changes can take up to 24-48 hours to propagate.";
      }
      verified = false;
    }

    // Update verification status
    const { error: updateStatusError } = await supabase
      .from("businesses")
      .update({
        custom_domain_verified: verified,
        custom_domain_status_message: statusMessage,
        custom_domain_last_checked_at: new Date().toISOString(),
      })
      .eq("id", business_id);

    if (updateStatusError) {
      console.error("Error updating verification status:", updateStatusError);
    }

    console.log(`Verification complete: verified=${verified}, message=${statusMessage}`);

    return new Response(
      JSON.stringify({
        verified,
        domain: normalizedDomain,
        status_message: statusMessage,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in verify-custom-domain:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
