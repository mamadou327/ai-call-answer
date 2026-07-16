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
  name: "list_customers",
  title: "List customers",
  description:
    "List customers for the signed-in user's business, most recently updated first. Useful for lookups, exports, and analytics.",
  inputSchema: {
    search: z.string().describe("Case-insensitive substring match on customer name, phone, or email.").optional(),
    limit: z.number().int().min(1).max(200).describe("Max rows (default 50).").optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    let q = sb
      .from("customers")
      .select("id, name, phone, email, total_visits, first_visit_date, preferred_language, notes_preferences, business_id, updated_at")
      .order("updated_at", { ascending: false })
      .limit(limit ?? 50);
    if (search && search.trim()) {
      const s = `%${search.trim()}%`;
      q = q.or(`name.ilike.${s},phone.ilike.${s},email.ilike.${s}`);
    }
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { customers: data ?? [] },
    };
  },
});
