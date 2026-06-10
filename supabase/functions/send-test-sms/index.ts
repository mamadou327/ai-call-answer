import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

Deno.serve(async (_req) => {
  const sid = Deno.env.get("TWILIO_ACCOUNT_SID")!;
  const tok = Deno.env.get("TWILIO_AUTH_TOKEN")!;
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: s } = await supabase.from("outbound_settings").select("sms_sender_id, mo_phone_number").limit(1).maybeSingle();
  const from = ((s as any)?.sms_sender_id || "Aivia").trim();
  const to = (s as any)?.mo_phone_number;
  const body = `Hi Mo, test from ${from} via Aivia — alphanumeric sender working. (Replies not supported on this sender.)`;
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${btoa(`${sid}:${tok}`)}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ To: to, From: from, Body: body }).toString(),
  });
  const text = await r.text();
  return new Response(JSON.stringify({ status: r.status, to, from, response: text }), {
    headers: { "Content-Type": "application/json" },
  });
});
