import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

Deno.serve(async (req) => {
  const { path } = await req.json();
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data, error } = await sb.storage.from("call-recordings").download(path);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  const fd = new FormData();
  fd.append("file", new Blob([await data.arrayBuffer()], { type: "audio/mpeg" }), "r.mp3");
  fd.append("model", "whisper-1");
  fd.append("language", "en");
  const r = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${Deno.env.get("OPENAI_API_KEY")}` },
    body: fd,
  });
  const j = await r.json();
  return new Response(JSON.stringify(j), { headers: { "Content-Type": "application/json" } });
});
