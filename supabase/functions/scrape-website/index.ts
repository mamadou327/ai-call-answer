// Crawl a business website with Firecrawl (renders JS, preserves tables as
// Markdown), then ask Gemini 2.5 Pro to extract structured business info.
// Falls back to a simple homemade fetch if FIRECRAWL_API_KEY is missing.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const FIRECRAWL_BASE = "https://api.firecrawl.dev/v2";
const CRAWL_LIMIT = 50;
const CRAWL_MAX_DEPTH = 3;
const CRAWL_POLL_INTERVAL_MS = 3000;
const CRAWL_MAX_WAIT_MS = 90_000;
const MAX_COMBINED_CHARS = 400_000;
const EXCLUDE_PATHS = [
  "/blog/*", "/news/*", "/press/*", "/article/*", "/post/*",
  "/cart/*", "/checkout/*", "/account/*", "/login/*", "/signup/*",
  "/wp-admin/*", "/wp-login*", "/privacy*", "/cookie*", "/gdpr*",
  "/tag/*", "/category/*", "/author/*",
];

const EXTRACTION_PROMPT = `You extract structured business information from a website. The user content contains MANY pages of one business's website joined together (each delimited by "=== PAGE: <url> ==="). Pages are in clean Markdown — TABLES ARE PRESERVED as Markdown tables (| col | col |). Carefully read EVERY page and merge information.

CRITICAL RULES for services/prices:
1. For any price TABLE with multiple columns (e.g. lengths 14"/16"/18"/20"/22", or sizes Filler/Volume/All Out, or First Fit vs Refit), emit ONE entry PER PRICE CELL — never collapse columns into a single entry.
2. ALWAYS attach the section heading the table appeared under (e.g. "Tape", "Micro Bond", "FeatherLight", "Clip In") as the "category" field.
3. Service "name" should encode the row + column variant, e.g. "Sides — Up to 18" First Fit", "Filler — 14"", "Boost — Refit".
4. NEVER invent prices. If a cell is empty or unclear, set price to null.
5. Deduplicate exact duplicates only — variants with different prices are NOT duplicates.
6. Include EVERY service across all pages, even ones outside tables (bullet lists, paragraphs).

Return JSON only with these fields:
- business_name (string|null)
- services: array of { name, category, price (number|null), duration_minutes (number|null) }
- opening_hours: object keyed by day name with values like "9:00am-5:30pm" or "closed"
- booking_policy (string|null)
- cancellation_policy (string|null)
- faqs: array of { question, answer }

If a field cannot be found return null (or [] for arrays).`;

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function startFirecrawlCrawl(url: string, apiKey: string): Promise<string | null> {
  const res = await fetch(`${FIRECRAWL_BASE}/crawl`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url,
      limit: CRAWL_LIMIT,
      maxDepth: CRAWL_MAX_DEPTH,
      excludePaths: EXCLUDE_PATHS,
      scrapeOptions: {
        formats: ["markdown"],
        onlyMainContent: true,
      },
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    console.error("[scrape-website] firecrawl /crawl start failed", res.status, txt.slice(0, 300));
    return null;
  }
  const data = await res.json();
  return data?.id || data?.jobId || null;
}

async function pollFirecrawlCrawl(
  jobId: string,
  apiKey: string,
): Promise<Array<{ url: string; markdown: string }>> {
  const start = Date.now();
  let allDocs: Array<{ url: string; markdown: string }> = [];
  while (Date.now() - start < CRAWL_MAX_WAIT_MS) {
    const res = await fetch(`${FIRECRAWL_BASE}/crawl/${jobId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) {
      console.error("[scrape-website] firecrawl poll failed", res.status);
      break;
    }
    const data = await res.json();
    const docs = Array.isArray(data?.data) ? data.data : [];
    allDocs = docs
      .map((d: any) => ({
        url: d?.metadata?.sourceURL || d?.metadata?.url || d?.url || "",
        markdown: typeof d?.markdown === "string" ? d.markdown : "",
      }))
      .filter((d: any) => d.markdown);
    if (data?.status === "completed") return allDocs;
    if (data?.status === "failed" || data?.status === "cancelled") {
      console.error("[scrape-website] firecrawl crawl ended:", data?.status);
      return allDocs;
    }
    await new Promise((r) => setTimeout(r, CRAWL_POLL_INTERVAL_MS));
  }
  console.warn("[scrape-website] firecrawl crawl timed out, returning partial", allDocs.length);
  return allDocs;
}

async function fallbackFetchHomepage(url: string): Promise<Array<{ url: string; markdown: string }>> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "AiviaBot/1.0" },
      redirect: "follow",
    });
    clearTimeout(t);
    if (!res.ok) return [];
    const html = await res.text();
    return [{ url, markdown: stripHtml(html).slice(0, 30_000) }];
  } catch {
    return [];
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

    if (businessId) {
      const { data: biz } = await supabase.from("businesses").select("id").eq("id", businessId).maybeSingle();
      if (!biz) {
        return new Response(JSON.stringify({ error: "Business not found or access denied" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ---- 1. CRAWL ----
    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    let pages: Array<{ url: string; markdown: string }> = [];

    if (firecrawlKey) {
      const jobId = await startFirecrawlCrawl(baseUrl.toString(), firecrawlKey);
      if (jobId) {
        pages = await pollFirecrawlCrawl(jobId, firecrawlKey);
      }
    } else {
      console.warn("[scrape-website] FIRECRAWL_API_KEY missing — using fallback");
    }

    if (pages.length === 0) {
      pages = await fallbackFetchHomepage(baseUrl.toString());
    }

    if (pages.length === 0) {
      return new Response(JSON.stringify({ error: "Could not fetch website" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const combined = pages
      .map((p) => `=== PAGE: ${p.url} ===\n${p.markdown}`)
      .join("\n\n")
      .slice(0, MAX_COMBINED_CHARS);

    // ---- 2. EXTRACT ----
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    async function callAI(model: string) {
      return await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: EXTRACTION_PROMPT },
            { role: "user", content: combined },
          ],
          response_format: { type: "json_object" },
        }),
      });
    }

    let aiRes = await callAI("google/gemini-2.5-pro");
    if (aiRes.status === 429 || aiRes.status === 402 || aiRes.status >= 500) {
      console.warn("[scrape-website] Pro failed", aiRes.status, "— falling back to Flash");
      aiRes = await callAI("google/gemini-2.5-flash");
    }

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
    let extracted: any;
    try { extracted = JSON.parse(content); } catch { extracted = {}; }

    return new Response(
      JSON.stringify({
        url: baseUrl.toString(),
        pages_scraped: pages.map((p) => p.url),
        pages_count: pages.length,
        services_found: Array.isArray(extracted?.services) ? extracted.services.length : 0,
        extracted,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[scrape-website] error", e);
    return new Response(JSON.stringify({ error: "Server error", detail: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
