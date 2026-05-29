import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_EMAIL = "mo@aiviaapp.co.uk";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find business owned by user (the requester must be an owner)
    const { data: businesses, error: bizErr } = await admin
      .from("businesses")
      .select("*")
      .eq("owner_id", user.id);

    if (bizErr) throw bizErr;
    if (!businesses || businesses.length === 0) {
      return new Response(JSON.stringify({ error: "No business found for this account" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const exports: Record<string, any> = {
      exported_at: new Date().toISOString(),
      account: { id: user.id, email: user.email },
      businesses: [],
    };

    for (const biz of businesses) {
      const id = biz.id;
      const fetchAll = async (table: string) => {
        const { data } = await admin.from(table).select("*").eq("business_id", id);
        return data || [];
      };
      const bookings = await fetchAll("bookings");
      const customers = await fetchAll("customers");
      const calls = await fetchAll("calls_log");
      const messages = await fetchAll("messages");
      const staff = await fetchAll("staff");
      const services = await fetchAll("services");
      const settings = await fetchAll("business_settings");
      const openingHours = await fetchAll("opening_hours");
      const menuCategories = await fetchAll("menu_categories");
      const menuItems = await fetchAll("menu_items");
      const fallbackReservations = await fetchAll("fallback_reservations");
      const missedCalls = await fetchAll("missed_calls");

      // Strip sensitive credentials from the exported business record
      const {
        twilio_webhook_token, messagebird_token, stripe_account_id,
        staff_join_code, custom_domain_txt_value, ...safeBiz
      } = biz as any;

      exports.businesses.push({
        business: safeBiz,
        settings,
        opening_hours: openingHours,
        services,
        staff,
        customers,
        bookings,
        calls_log: calls,
        messages,
        missed_calls: missedCalls,
        fallback_reservations: fallbackReservations,
        menu_categories: menuCategories,
        menu_items: menuItems,
      });
    }

    // Notify admin
    try {
      const resendKey = Deno.env.get("RESEND_API_KEY");
      const fromEmail = Deno.env.get("RESEND_FROM_EMAIL");
      if (resendKey && fromEmail) {
        const resend = new Resend(resendKey);
        const bizList = businesses.map((b: any) => `<li>${b.business_name} (${b.id})</li>`).join("");
        await resend.emails.send({
          from: fromEmail,
          to: [ADMIN_EMAIL],
          subject: `Data export requested - ${user.email}`,
          html: `
            <h2>Data export (GDPR) requested</h2>
            <p><strong>User:</strong> ${user.email}</p>
            <p><strong>User ID:</strong> ${user.id}</p>
            <p><strong>Businesses included:</strong></p>
            <ul>${bizList}</ul>
            <p>The user has downloaded a JSON archive of their business data.</p>
          `,
        });
      }
    } catch (e) {
      console.error("notification email failed", e);
    }

    return new Response(JSON.stringify(exports, null, 2), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="aivia-data-export-${Date.now()}.json"`,
      },
    });
  } catch (e: any) {
    console.error("export-business-data error", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
