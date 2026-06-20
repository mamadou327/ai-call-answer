import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, range",
  "Access-Control-Expose-Headers": "content-length, content-range, accept-ranges",
};

// HMAC-SHA256 sign helper
async function hmacHex(key: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey(
    "raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", k, enc.encode(data));
  let hex = "";
  for (const b of new Uint8Array(sig)) hex += b.toString(16).padStart(2, "0");
  return hex;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const parts = url.pathname.split("/").filter(Boolean);
    const last = parts[parts.length - 1] || "";
    const recordingSid = last.replace(/\.mp3$/, "");

    if (!recordingSid || !recordingSid.startsWith("RE")) {
      return new Response("Bad request", { status: 400, headers: corsHeaders });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const TWILIO_SID = Deno.env.get("TWILIO_ACCOUNT_SID")!;
    const TWILIO_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // ---------- Action: issue a short-lived signed token ----------
    // POST /outbound-recording-proxy/<SID>?action=sign  with a super_admin JWT
    if (url.searchParams.get("action") === "sign") {
      const authHeader = req.headers.get("Authorization") || "";
      const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
      if (!bearer) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

      const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: `Bearer ${bearer}` } },
      });
      const { data: u } = await userClient.auth.getUser();
      const userId = u?.user?.id;
      if (!userId) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

      const { data: isSuper } = await supabase.rpc("has_role", { _user_id: userId, _role: "super_admin" });
      let allowed = !!isSuper;
      if (!allowed) {
        const { data: isSub } = await supabase.rpc("has_role", { _user_id: userId, _role: "sub_admin" });
        if (isSub) {
          const { data: perms } = await supabase
            .from("admin_permissions")
            .select("can_view_calls_messages")
            .eq("user_id", userId)
            .maybeSingle();
          if (perms?.can_view_calls_messages) allowed = true;
        }
      }
      if (!allowed) return new Response("Forbidden", { status: 403, headers: corsHeaders });

      const expires = Math.floor(Date.now() / 1000) + 60 * 30; // 30 min
      const sig = await hmacHex(SERVICE_KEY, `${recordingSid}.${expires}`);
      return new Response(JSON.stringify({ token: `${expires}.${sig}`, expires }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---------- Action: stream audio (requires valid signed token) ----------
    const token = url.searchParams.get("token") || "";
    const [expStr, providedSig] = token.split(".");
    const expires = parseInt(expStr, 10);
    if (!expires || !providedSig || expires < Math.floor(Date.now() / 1000)) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const expectedSig = await hmacHex(SERVICE_KEY, `${recordingSid}.${expires}`);
    if (expectedSig !== providedSig) {
      return new Response("Forbidden", { status: 403, headers: corsHeaders });
    }

    // Verify recording belongs to an outbound lead
    const { data: lead } = await supabase
      .from("outbound_leads")
      .select("id")
      .ilike("call_recording_url", `%${recordingSid}%`)
      .maybeSingle();

    if (!lead) {
      return new Response("Not found", { status: 404, headers: corsHeaders });
    }

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Recordings/${recordingSid}.mp3`;
    const auth = btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`);
    const range = req.headers.get("range");
    const headers: Record<string, string> = { Authorization: `Basic ${auth}` };
    if (range) headers["Range"] = range;

    const res = await fetch(twilioUrl, { headers });
    if (!res.ok && res.status !== 206) {
      return new Response(`Upstream error ${res.status}`, { status: res.status, headers: corsHeaders });
    }

    const outHeaders = new Headers(corsHeaders);
    outHeaders.set("Content-Type", "audio/mpeg");
    outHeaders.set("Accept-Ranges", "bytes");
    const cl = res.headers.get("content-length");
    if (cl) outHeaders.set("Content-Length", cl);
    const cr = res.headers.get("content-range");
    if (cr) outHeaders.set("Content-Range", cr);

    return new Response(res.body, { status: res.status, headers: outHeaders });
  } catch (e) {
    console.error("[outbound-recording-proxy] error", e);
    return new Response("error", { status: 500, headers: corsHeaders });
  }
});
