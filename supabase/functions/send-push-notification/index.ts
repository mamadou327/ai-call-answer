import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import webpush from "npm:web-push@3.6.7";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY");
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY");
const VAPID_EMAIL = Deno.env.get("VAPID_EMAIL") || "mailto:support@aiviaapp.co.uk";

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  try {
    webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);
  } catch (e) {
    console.error("VAPID setup failed", e);
  }
}

interface Body {
  business_id?: string;
  user_id?: string;
  title?: string;
  body?: string;
  url?: string;
  tag?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const internalSecret = Deno.env.get("CRON_SECRET");
  const provided = req.headers.get("x-internal-secret");
  if (!internalSecret || provided !== internalSecret) {
    return json({ error: "Unauthorized" }, 401);
  }

  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return json({ error: "VAPID keys not configured" }, 500);
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const { business_id, user_id, title, body: message, url, tag } = body;
  if ((!business_id && !user_id) || !title || !message) {
    return json({ error: "Missing required fields: (business_id or user_id), title, body" }, 400);
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  let query = supabase.from("push_subscriptions").select("id, endpoint, subscription");
  if (business_id) query = query.eq("business_id", business_id);
  if (user_id) query = query.eq("user_id", user_id);

  const { data: subs, error } = await query;
  if (error) return json({ error: error.message }, 500);
  if (!subs || subs.length === 0) return json({ sent: 0, message: "No subscribers" });

  const payload = JSON.stringify({ title, body: message, url: url || "/dashboard", tag: tag || "aivia" });

  let sent = 0;
  let removed = 0;
  await Promise.all(
    subs.map(async (row: any) => {
      try {
        await webpush.sendNotification(row.subscription, payload);
        sent++;
      } catch (err: any) {
        const status = err?.statusCode;
        if (status === 404 || status === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", row.id);
          removed++;
        } else {
          console.error("push send failed", status, err?.body || err?.message);
        }
      }
    }),
  );

  return json({ sent, removed, total: subs.length });
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
