import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_EMAIL = "mo@aiviaapp.co.uk";
const PROTECTED_EMAILS = ["mlaye915@gmail.com", "mo@aiviaapp.co.uk"];

async function deleteBusinessData(admin: any, businessId: string) {
  await admin.from("call_conversations").delete().eq("business_id", businessId);
  await admin.from("opening_hours").delete().eq("business_id", businessId);
  await admin.from("business_settings").delete().eq("business_id", businessId);
  await admin.from("business_number_selection").delete().eq("business_id", businessId);
  await admin.from("business_gallery").delete().eq("business_id", businessId);
  await admin.from("staff_memberships").delete().eq("business_id", businessId);
  await admin.from("staff_invites").delete().eq("business_id", businessId);
  await admin.from("staff_accounts").delete().eq("business_id", businessId);
  await admin.from("staff_time_off").delete().eq("business_id", businessId);
  await admin.from("calls_log").delete().eq("business_id", businessId);
  await admin.from("messages").delete().eq("business_id", businessId);
  await admin.from("missed_calls").delete().eq("business_id", businessId);
  await admin.from("customers").delete().eq("business_id", businessId);
  await admin.from("customer_settings").delete().eq("business_id", businessId);
  await admin.from("fallback_reservations").delete().eq("business_id", businessId);
  await admin.from("call_usage_notifications").delete().eq("business_id", businessId);

  const { data: staffData } = await admin.from("staff").select("id").eq("business_id", businessId);
  if (staffData) {
    for (const s of staffData) {
      await admin.from("staff_services").delete().eq("staff_id", s.id);
    }
  }
  await admin.from("staff").delete().eq("business_id", businessId);

  // menu cascade
  const { data: menuItems } = await admin.from("menu_items").select("id").eq("business_id", businessId);
  if (menuItems) {
    for (const mi of menuItems) {
      const { data: groups } = await admin.from("menu_item_option_groups").select("id").eq("menu_item_id", mi.id);
      if (groups) {
        for (const g of groups) {
          const { data: opts } = await admin.from("menu_item_options").select("id").eq("option_group_id", g.id);
          if (opts) {
            for (const o of opts) {
              await admin.from("menu_item_option_sizes").delete().eq("option_id", o.id);
            }
          }
          await admin.from("menu_item_options").delete().eq("option_group_id", g.id);
        }
      }
      await admin.from("menu_item_option_groups").delete().eq("menu_item_id", mi.id);
      await admin.from("menu_item_sizes").delete().eq("menu_item_id", mi.id);
    }
  }
  await admin.from("menu_items").delete().eq("business_id", businessId);
  await admin.from("menu_categories").delete().eq("business_id", businessId);

  await admin.from("services").delete().eq("business_id", businessId);
  await admin.from("bookings").delete().eq("business_id", businessId);
  await admin.from("businesses").delete().eq("id", businessId);
}

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

    const email = (user.email || "").toLowerCase();
    if (PROTECTED_EMAILS.includes(email)) {
      return new Response(JSON.stringify({ error: "This account is protected and cannot be deleted." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Require explicit confirmation
    let body: { confirm?: string } = {};
    try { body = await req.json(); } catch (_) {}
    if (body.confirm !== "DELETE") {
      return new Response(JSON.stringify({ error: "Confirmation required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find businesses this user owns
    const { data: businesses } = await admin
      .from("businesses")
      .select("id, business_name")
      .eq("owner_id", user.id);

    const deletedBusinesses: { id: string; name: string }[] = [];
    if (businesses && businesses.length > 0) {
      for (const b of businesses) {
        await deleteBusinessData(admin, b.id);
        deletedBusinesses.push({ id: b.id, name: b.business_name });
      }
    }

    // Wipe per-user references
    await admin.from("staff_memberships").delete().eq("user_id", user.id);
    await admin.from("staff_accounts").delete().eq("user_id", user.id);
    await admin.from("admin_permissions").delete().eq("user_id", user.id);
    await admin.from("user_roles").delete().eq("user_id", user.id);
    await admin.from("profiles").delete().eq("user_id", user.id);
    if (user.email) {
      await admin.from("staff_invites").delete().eq("email", user.email);
    }

    // Finally delete auth user
    const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
    if (delErr) {
      console.error("auth delete error", delErr);
    }

    // Email admin
    try {
      const resendKey = Deno.env.get("RESEND_API_KEY");
      const fromEmail = Deno.env.get("RESEND_FROM_EMAIL");
      if (resendKey && fromEmail) {
        const resend = new Resend(resendKey);
        await resend.emails.send({
          from: fromEmail,
          to: [ADMIN_EMAIL],
          subject: `Account deleted - ${user.email}`,
          html: `
            <h2>Account self-deletion (GDPR)</h2>
            <p><strong>User:</strong> ${user.email}</p>
            <p><strong>User ID:</strong> ${user.id}</p>
            <p><strong>Businesses wiped:</strong></p>
            <ul>${deletedBusinesses.map(b => `<li>${b.name} (${b.id})</li>`).join("") || "<li>None</li>"}</ul>
            <p>All associated data (bookings, customers, call logs, staff, menus, settings) has been permanently removed.</p>
          `,
        });
      }
    } catch (e) {
      console.error("notification email failed", e);
    }

    return new Response(JSON.stringify({
      success: true,
      deletedBusinesses: deletedBusinesses.length,
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("delete-my-account error", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
