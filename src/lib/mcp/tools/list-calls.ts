import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_calls",
  title: "List recent calls",
  description:
    "List recent AI receptionist call log entries for the signed-in user's business, including caller, duration, outcome, and short summary.",
  inputSchema: {
    limit: z.number().int().min(1).max(100).describe("Max rows (default 25).").optional(),
    needs_review_only: z.boolean().describe("If true, only return calls flagged for review.").optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, needs_review_only }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    let q = sb
      .from("calls_log")
      .select(
        "id, business_id, caller_name, caller_phone, to_number, call_type, call_outcome, duration_ms, summary, tags, needs_review, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(limit ?? 25);
    if (needs_review_only) q = q.eq("needs_review", true);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { calls: data ?? [] },
    };
  },
});
