// Weekly cron: re-scrape every approved business with a website,
// diff against current settings, store pending changes + email owner.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Resend } from "https://esm.sh/resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const KEYWORDS = ["service", "price", "menu", "about", "booking", "hours", "faq", "contact"];
const MAX_PAGES = 4;
const MAX_HTML_BYTES = 200_000;
const FETCH_TIMEOUT_MS = 10_000;

const EXTRACTION_PROMPT = `You are a business data extraction assistant. Extract the following information from this website content and return it as valid JSON only with no additional text: business_name, services (array of objects with name and price), opening_hours (object with days and times), booking_policy, cancellation_policy, faqs (array of objects with question and answer). If any field cannot be found return null for that field.`;

const DAY_NUM_TO_NAME = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ").trim();
}

function extractLinks(html: string, baseUrl: URL) {
  const out: Array<{ href: string; text: string }> = [];
  const re = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    try {
      const url = new URL(m[1], baseUrl);
      if (url.origin !== baseUrl.origin) continue;
      out.push({ href: url.toString().split("#")[0], text: stripHtml(m[2]).toLowerCase() });
    } catch { /* ignore */ }
  }
  return out;
}

function pickRelevantLinks(links: Array<{ href: string; text: string }>, homepage: string): string[] {
  const seen = new Set<string>([homepage]);
  const scored: Array<{ href: string; score: number }> = [];
  for (const l of links) {
    if (seen.has(l.href)) continue;
    const blob = (l.href + " " + l.text).toLowerCase();
    let score = 0;
    for (const k of KEYWORDS) if (blob.includes(k)) score += 1;
    if (score > 0) scored.push({ href: l.href, score });
  }
  scored.sort((a, b) => b.score - a.score);
  const picked: string[] = [];
  for (const s of scored) {
    if (picked.length >= MAX_PAGES - 1) break;
    if (!seen.has(s.href)) { picked.push(s.href); seen.add(s.href); }
  }
  return picked;
}

async function fetchPage(url: string): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "AiviaBot/1.0 (+https://aiviaapp.co.uk)" },
      redirect: "follow",
    });
    if (!res.ok) return "";
    const txt = await res.text();
    return txt.slice(0, MAX_HTML_BYTES);
  } catch {
    return "";
  } finally {
    clearTimeout(t);
  }
}

async function extractFromUrl(url: string, lovableKey: string) {
  let baseUrl: URL;
  try { baseUrl = new URL(url.startsWith("http") ? url : "https://" + url); } catch { return null; }
  const home = await fetchPage(baseUrl.toString());
  if (!home) return null;
  const links = extractLinks(home, baseUrl);
  const extras = pickRelevantLinks(links, baseUrl.toString());
  const pages = [{ url: baseUrl.toString(), text: stripHtml(home).slice(0, 15000) }];
  for (const u of extras) {
    const html = await fetchPage(u);
    if (html) pages.push({ url: u, text: stripHtml(html).slice(0, 10000) });
  }
  const combined = pages.map((p) => `=== PAGE: ${p.url} ===\n${p.text}`).join("\n\n").slice(0, 60000);

  const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: EXTRACTION_PROMPT },
        { role: "user", content: combined },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!aiRes.ok) return null;
  const data = await aiRes.json();
  try { return JSON.parse(data?.choices?.[0]?.message?.content ?? "{}"); } catch { return null; }
}

function normalizeStr(v: unknown): string {
  return String(v ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

function diffData(current: any, extracted: any): Record<string, { old: any; new: any }> {
  const changes: Record<string, { old: any; new: any }> = {};

  // Cancellation policy
  if (extracted.cancellation_policy && normalizeStr(extracted.cancellation_policy) !== normalizeStr(current.cancellation_policy)) {
    changes.cancellation_policy = { old: current.cancellation_policy || null, new: extracted.cancellation_policy };
  }

  // Services: compare by name set
  if (Array.isArray(extracted.services)) {
    const newNames = extracted.services
      .filter((s: any) => s?.name)
      .map((s: any) => normalizeStr(s.name))
      .sort();
    const oldNames = (current.services || []).map((s: any) => normalizeStr(s.name)).sort();
    if (JSON.stringify(newNames) !== JSON.stringify(oldNames)) {
      changes.services = {
        old: current.services || [],
        new: extracted.services,
      };
    }
  }

  // Opening hours
  if (extracted.opening_hours && typeof extracted.opening_hours === "object") {
    const oldHours: Record<string, string> = {};
    for (const h of (current.opening_hours || [])) {
      const day = DAY_NUM_TO_NAME[h.day_of_week];
      oldHours[day] = h.is_closed ? "Closed" : `${h.open_time || ""} - ${h.close_time || ""}`;
    }
    const newHours: Record<string, string> = {};
    for (const [k, v] of Object.entries(extracted.opening_hours)) {
      newHours[k] = String(v);
    }
    if (JSON.stringify(newHours) !== JSON.stringify(oldHours)) {
      changes.opening_hours = { old: oldHours, new: newHours };
    }
  }

  return changes;
}

function buildEmailHtml(businessName: string, changes: Record<string, { old: any; new: any }>, dashboardUrl: string): string {
  const rows = Object.entries(changes).map(([field, { old, new: nw }]) => `
    <tr>
      <td style="padding:8px;border:1px solid #e5e7eb;font-weight:600;text-transform:capitalize;">${field.replace(/_/g, " ")}</td>
      <td style="padding:8px;border:1px solid #e5e7eb;color:#6b7280;font-size:13px;"><pre style="white-space:pre-wrap;margin:0;font-family:inherit;">${escapeHtml(JSON.stringify(old, null, 2))}</pre></td>
      <td style="padding:8px;border:1px solid #e5e7eb;color:#111827;font-size:13px;"><pre style="white-space:pre-wrap;margin:0;font-family:inherit;">${escapeHtml(JSON.stringify(nw, null, 2))}</pre></td>
    </tr>`).join("");

  return `
    <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px; color:#111827;">
      <h1 style="font-size:22px;">We noticed your website may have been updated</h1>
      <p>Hi ${escapeHtml(businessName)} team,</p>
      <p>Our weekly check found differences between your website and what's currently saved in Aivia. Please review the changes below and confirm if they should be applied.</p>
      <table style="width:100%;border-collapse:collapse;margin-top:16px;">
        <thead>
          <tr style="background:#f3f4f6;">
            <th style="padding:8px;border:1px solid #e5e7eb;text-align:left;">Field</th>
            <th style="padding:8px;border:1px solid #e5e7eb;text-align:left;">Currently in Aivia</th>
            <th style="padding:8px;border:1px solid #e5e7eb;text-align:left;">Found on website</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="margin-top:24px;">
        <a href="${dashboardUrl}" style="display:inline-block;padding:12px 20px;background:#2563eb;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;">Review and confirm changes</a>
      </p>
      <p style="color:#6b7280;font-size:12px;">No changes are applied automatically — you stay in control.</p>
    </div>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "Aivia <onboarding@resend.dev>";
    if (!lovableKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY missing" }), { status: 500, headers: corsHeaders });
    }

    const resend = resendKey ? new Resend(resendKey) : null;

    const { data: businesses, error } = await supabase
      .from("businesses")
      .select("id, business_name, website, owner_id")
      .eq("status", "approved")
      .not("website", "is", null);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
    }

    const results: any[] = [];

    for (const biz of (businesses || [])) {
      if (!biz.website) continue;
      try {
        const extracted = await extractFromUrl(biz.website, lovableKey);
        if (!extracted) {
          results.push({ business_id: biz.id, status: "scrape_failed" });
          continue;
        }

        // Load current state
        const [{ data: settings }, { data: services }, { data: hours }] = await Promise.all([
          supabase.from("business_settings").select("cancellation_policy").eq("business_id", biz.id).maybeSingle(),
          supabase.from("services").select("name, price").eq("business_id", biz.id),
          supabase.from("opening_hours").select("day_of_week, open_time, close_time, is_closed").eq("business_id", biz.id),
        ]);

        const current = {
          cancellation_policy: settings?.cancellation_policy || null,
          services: services || [],
          opening_hours: hours || [],
        };

        const changes = diffData(current, extracted);
        const changesDetected = Object.keys(changes).length > 0;

        await supabase.from("website_sync_log").insert({
          business_id: biz.id,
          url: biz.website,
          changes_detected: changesDetected,
          changes_summary: changesDetected ? { changes, extracted } : null,
          confirmed: false,
        });

        if (changesDetected) {
          await supabase
            .from("businesses")
            .update({
              website_pending_changes: { changes, extracted, detected_at: new Date().toISOString() },
              website_last_synced_at: new Date().toISOString(),
              website_last_synced_url: biz.website,
            })
            .eq("id", biz.id);

          // Email the owner
          if (resend) {
            const { data: ownerProfile } = await supabase
              .from("profiles")
              .select("email, full_name")
              .eq("user_id", biz.owner_id)
              .maybeSingle();

            const ownerEmail = (ownerProfile as any)?.email;
            if (ownerEmail) {
              const dashboardUrl = "https://aiviaapp.co.uk/dashboard?tab=settings&section=website-sync";
              try {
                await resend.emails.send({
                  from: fromEmail,
                  to: ownerEmail,
                  subject: "We noticed your website may have been updated",
                  html: buildEmailHtml(biz.business_name, changes, dashboardUrl),
                });
              } catch (e) {
                console.error("Email send failed for", biz.id, e);
              }
            }
          }
        } else {
          await supabase
            .from("businesses")
            .update({
              website_last_synced_at: new Date().toISOString(),
              website_last_synced_url: biz.website,
            })
            .eq("id", biz.id);
        }

        results.push({ business_id: biz.id, status: "ok", changes_detected: changesDetected });
      } catch (e) {
        console.error("Sync failed for", biz.id, e);
        results.push({ business_id: biz.id, status: "error", error: String(e) });
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
