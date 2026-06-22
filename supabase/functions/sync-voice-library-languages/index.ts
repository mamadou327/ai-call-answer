// Backfill verified_languages + is_multilingual on public.voice_library by
// querying the ElevenLabs voice metadata for each row. Idempotent — safe to
// re-run any time the library changes.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "ELEVENLABS_API_KEY missing" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: voices, error } = await supabase
    .from("voice_library")
    .select("id, voice_id, name");

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: Array<Record<string, unknown>> = [];

  for (const v of voices ?? []) {
    try {
      const r = await fetch(`https://api.elevenlabs.io/v1/voices/${v.voice_id}`, {
        headers: { "xi-api-key": apiKey },
      });
      if (!r.ok) {
        results.push({ voice_id: v.voice_id, name: v.name, status: r.status, error: await r.text() });
        continue;
      }
      const data = await r.json();
      const verified = Array.isArray(data?.verified_languages) ? data.verified_languages : [];
      const langs = Array.from(
        new Set(
          verified
            .map((x: any) => (typeof x?.language === "string" ? x.language.toLowerCase() : null))
            .filter((x: any): x is string => !!x)
        )
      );
      const finalLangs = langs.length > 0 ? langs : ["en"];
      const isMulti = finalLangs.length > 1 || finalLangs.some((l) => l !== "en");

      const { error: upErr } = await supabase
        .from("voice_library")
        .update({ verified_languages: finalLangs, is_multilingual: isMulti })
        .eq("id", v.id);

      results.push({
        voice_id: v.voice_id,
        name: v.name,
        verified_languages: finalLangs,
        is_multilingual: isMulti,
        update_error: upErr?.message ?? null,
      });
    } catch (e: any) {
      results.push({ voice_id: v.voice_id, name: v.name, error: e?.message ?? String(e) });
    }
  }

  return new Response(JSON.stringify({ count: results.length, results }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
