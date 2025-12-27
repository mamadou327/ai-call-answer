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

    // Get business info for notification
    const { data: businessData, error: businessError } = await supabase
      .from("businesses")
      .select("business_name, custom_booking_domain")
      .eq("id", business_id)
      .single();

    if (businessError) {
      console.error("Error fetching business:", businessError);
    }

    const previousDomain = businessData?.custom_booking_domain;

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
        statusMessage = "Domain verified! Your booking page will be live within 24 hours once our team adds it to hosting.";
      } else {
        verified = false;
        statusMessage = `Domain responded with status ${response.status}. Please check your DNS settings.`;
      }
    } catch (fetchError: any) {
      console.error("Fetch error:", fetchError);
      
      if (fetchError.name === "AbortError") {
        statusMessage = "Connection timed out. Please verify your DNS records point to 185.158.133.1.";
      } else if (fetchError.message?.includes("ssl") || fetchError.message?.includes("certificate")) {
        statusMessage = "DNS is correctly pointed. SSL certificate will be provisioned once our team adds the domain to hosting (within 24 hours).";
        // Domain is pointed correctly, just waiting for SSL - mark as verified
        verified = true;
      } else {
        statusMessage = "Could not reach your domain. Please add an A record pointing to 185.158.133.1. DNS changes can take up to 24-48 hours to propagate.";
      }
      
      if (!fetchError.message?.includes("ssl") && !fetchError.message?.includes("certificate")) {
        verified = false;
      }
    }

    // Update verification status
    const { error: updateStatusError } = await supabase
      .from("businesses")
      .update({
        custom_domain_verified: verified,
        custom_domain_status_message: statusMessage,
        custom_domain_last_checked_at: new Date().toISOString(),
        // Reset hosting status if domain changed
        ...(previousDomain !== normalizedDomain && {
          custom_domain_added_to_hosting: false,
          custom_domain_added_at: null,
        }),
      })
      .eq("id", business_id);

    if (updateStatusError) {
      console.error("Error updating verification status:", updateStatusError);
    }

    console.log(`Verification complete: verified=${verified}, message=${statusMessage}`);

    // Send admin notification if domain is verified
    if (verified && businessData?.business_name) {
      try {
        console.log("Sending admin notification for verified domain");
        
        const resendApiKey = Deno.env.get("RESEND_API_KEY");
        const adminEmail = "mlaye915@gmail.com"; // Admin email
        
        if (resendApiKey) {
          const emailResponse = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${resendApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: Deno.env.get("RESEND_FROM_EMAIL") || "Aivia <notifications@aiviaapp.co.uk>",
              to: [adminEmail],
              subject: `🌐 New Custom Domain Verified: ${normalizedDomain}`,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #333;">New Custom Domain Ready for Hosting</h2>
                  
                  <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 0 0 10px 0;"><strong>Business:</strong> ${businessData.business_name}</p>
                    <p style="margin: 0 0 10px 0;"><strong>Domain:</strong> <code style="background: #e0e0e0; padding: 2px 6px; border-radius: 4px;">${normalizedDomain}</code></p>
                    <p style="margin: 0;"><strong>Status:</strong> DNS Verified ✅</p>
                  </div>
                  
                  <h3 style="color: #333;">Action Required</h3>
                  <p>Please add this domain to Lovable project settings for SSL provisioning:</p>
                  
                  <ol style="line-height: 1.8;">
                    <li>Go to <a href="https://lovable.dev/projects" style="color: #2563eb;">Lovable Dashboard</a></li>
                    <li>Open project settings → Domains</li>
                    <li>Add domain: <code style="background: #e0e0e0; padding: 2px 6px; border-radius: 4px;">${normalizedDomain}</code></li>
                    <li>Mark as processed in Admin Dashboard</li>
                  </ol>
                  
                  <p style="color: #666; font-size: 14px; margin-top: 30px;">
                    This is an automated notification from Aivia.
                  </p>
                </div>
              `,
            }),
          });
          
          if (!emailResponse.ok) {
            const errorText = await emailResponse.text();
            console.error("Failed to send admin notification email:", errorText);
          } else {
            console.log("Admin notification email sent successfully");
          }
        } else {
          console.log("RESEND_API_KEY not configured, skipping admin notification");
        }
      } catch (emailError) {
        console.error("Error sending admin notification:", emailError);
      }
    }

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
