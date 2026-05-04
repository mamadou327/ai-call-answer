// Scrape a business website + up to 3 relevant linked pages, then ask Lovable AI
// to extract structured business info as JSON.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// High-priority keywords get a bigger score boost than generic ones.
const STRONG_KEYWORDS = [
  "service", "services", "treatment", "treatments", "menu", "price", "prices", "pricing",
  "price-list", "pricelist", "tariff", "rates", "packages", "package",
];
const MEDIUM_KEYWORDS = [
  "booking", "book", "appointment", "reserve", "reservation",
  "hours", "opening", "open", "schedule",
  "faq", "faqs", "policy", "policies", "cancellation", "terms",
  "about", "contact",
];
const SKIP_PATH_PATTERNS = [
  /\.(pdf|jpg|jpeg|png|gif|svg|webp|mp4|mp3|zip|css|js|ico)(\?|$)/i,
  /\/(blog|news|press|article|post|tag|category|author|wp-content|wp-admin|wp-login|cart|checkout|account|login|signup|privacy|cookie|gdpr)(\/|$|\?)/i,
];
const MAX_PAGES = 15; // homepage + up to 14 internal pages
const MAX_HTML_BYTES = 250_000;
const FETCH_TIMEOUT_MS = 8_000;
const FETCH_CONCURRENCY = 5;

const EXTRACTION_PROMPT = `You are a business data extraction assistant. The user content contains text scraped from MULTIPLE pages of one business's website (each page delimited by "=== PAGE: <url> ==="). Carefully read EVERY page and merge information across them — services and prices are often spread across many pages (one per service, or grouped by category). Extract a COMPLETE list, not just the first few you see. Return valid JSON only with no additional text and these fields: business_name, services (array of objects with name and price; include EVERY distinct service/treatment/menu item you find across all pages, deduplicated by name), opening_hours (object with days and times), booking_policy, cancellation_policy, faqs (array of objects with question and answer). If a field cannot be found return null for that field. Do not invent prices — use null if a price is not stated.`;

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractLinks(html: string, baseUrl: URL): Array<{ href: string; text: string }> {
  const out: Array<{ href: string; text: string }> = [];
  const re = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    try {
      const url = new URL(m[1], baseUrl);
      if (url.origin !== baseUrl.origin) continue;
      if (!/^https?:/.test(url.protocol)) continue;
      out.push({ href: url.toString().split("#")[0], text: stripHtml(m[2]).toLowerCase() });
    } catch (_) { /* ignore */ }
  }
  return out;
}

function shouldSkipUrl(href: string): boolean {
  return SKIP_PATH_PATTERNS.some((re) => re.test(href));
}

function scoreLink(href: string, text: string): number {
  const blob = (href + " " + text).toLowerCase();
  let score = 0;
  for (const k of STRONG_KEYWORDS) if (blob.includes(k)) score += 3;
  for (const k of MEDIUM_KEYWORDS) if (blob.includes(k)) score += 1;
  // Bonus for short, "section-y" paths
  try {
    const path = new URL(href).pathname.replace(/\/$/, "");
    const segs = path.split("/").filter(Boolean);
    if (segs.length === 1 && STRONG_KEYWORDS.some((k) => segs[0].includes(k))) score += 2;
    // Penalize very deep paths
    if (segs.length > 4) score -= 1;
  } catch (_) { /* ignore */ }
  return score;
}

function pickRelevantLinks(
  links: Array<{ href: string; text: string }>,
  alreadySeen: Set<string>,
  limit: number,
): string[] {
  const scored: Array<{ href: string; score: number }> = [];
  const dedup = new Set<string>();
  for (const l of links) {
    if (alreadySeen.has(l.href) || dedup.has(l.href)) continue;
    if (shouldSkipUrl(l.href)) continue;
    const score = scoreLink(l.href, l.text);
    if (score > 0) {
      scored.push({ href: l.href, score });
      dedup.add(l.href);
    }
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.href);
}

async function fetchSitemapUrls(baseUrl: URL): Promise<string[]> {
  const candidates = ["/sitemap.xml", "/sitemap_index.xml", "/sitemap-index.xml"];
  const found: string[] = [];
  for (const path of candidates) {
    const xml = await fetchPage(new URL(path, baseUrl).toString());
    if (!xml) continue;
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/gi)].map((m) => m[1].trim());
    for (const loc of locs) {
      try {
        const u = new URL(loc);
        if (u.origin === baseUrl.origin && !shouldSkipUrl(u.toString())) {
          found.push(u.toString().split("#")[0]);
        }
      } catch (_) { /* ignore */ }
    }
    if (found.length) break;
  }
  return Array.from(new Set(found));
}

async function fetchAll(urls: string[], concurrency: number): Promise<Array<{ url: string; html: string }>> {
  const out: Array<{ url: string; html: string }> = [];
  let i = 0;
  async function worker() {
    while (i < urls.length) {
      const idx = i++;
      const u = urls[idx];
      const html = await fetchPage(u);
      if (html) out.push({ url: u, html });
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, worker));
  return out;
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
    const reader = res.body?.getReader();
    if (!reader) return await res.text();
    let received = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      chunks.push(value);
      if (received >= MAX_HTML_BYTES) { try { reader.cancel(); } catch (_) {} break; }
    }
    const merged = new Uint8Array(received);
    let offset = 0;
    for (const c of chunks) { merged.set(c, offset); offset += c.byteLength; }
    return new TextDecoder().decode(merged);
  } catch (_e) {
    return "";
  } finally {
    clearTimeout(t);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    let { url, businessId } = body as { url?: string; businessId?: string };
    if (!url || typeof url !== "string") {
      return new Response(JSON.stringify({ error: "Missing url" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    let baseUrl: URL;
    try { baseUrl = new URL(url); } catch {
      return new Response(JSON.stringify({ error: "Invalid url" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!/^https?:$/.test(baseUrl.protocol)) {
      return new Response(JSON.stringify({ error: "Invalid protocol" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify business ownership if provided
    if (businessId) {
      const { data: biz } = await supabase.from("businesses").select("id").eq("id", businessId).maybeSingle();
      if (!biz) {
        return new Response(JSON.stringify({ error: "Business not found or access denied" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Fetch homepage
    const homepageHtml = await fetchPage(baseUrl.toString());
    if (!homepageHtml) {
      return new Response(JSON.stringify({ error: "Could not fetch website" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const links = extractLinks(homepageHtml, baseUrl);
    const extraUrls = pickRelevantLinks(links, baseUrl.toString());

    const pages: Array<{ url: string; text: string }> = [
      { url: baseUrl.toString(), text: stripHtml(homepageHtml).slice(0, 15000) },
    ];
    for (const u of extraUrls) {
      const html = await fetchPage(u);
      if (html) pages.push({ url: u, text: stripHtml(html).slice(0, 10000) });
    }

    const combined = pages.map((p) => `=== PAGE: ${p.url} ===\n${p.text}`).join("\n\n").slice(0, 60000);

    // Call Lovable AI
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: EXTRACTION_PROMPT },
          { role: "user", content: combined },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (aiRes.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limited, try again shortly" }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiRes.status === 402) {
      return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!aiRes.ok) {
      const txt = await aiRes.text();
      return new Response(JSON.stringify({ error: "AI extraction failed", detail: txt.slice(0, 500) }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiRes.json();
    const content = aiData?.choices?.[0]?.message?.content ?? "{}";
    let extracted: unknown;
    try { extracted = JSON.parse(content); } catch { extracted = {}; }

    return new Response(
      JSON.stringify({
        url: baseUrl.toString(),
        pages_scraped: pages.map((p) => p.url),
        extracted,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: "Server error", detail: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
