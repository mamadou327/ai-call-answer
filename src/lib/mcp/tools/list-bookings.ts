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
  name: "list_bookings",
  title: "List bookings",
  description:
    "List upcoming or recent bookings for the signed-in user's business. Returns booking code, customer name/phone, service, staff, start/end time, status, and payment status.",
  inputSchema: {
    limit: z.number().int().min(1).max(100).describe("Max rows to return (default 25).").optional(),
    status: z
      .enum(["confirmed", "pending", "cancelled", "completed", "no_show"])
      .describe("Filter by booking status.")
      .optional(),
    from: z.string().describe("ISO date/time lower bound on start_time.").optional(),
    to: z.string().describe("ISO date/time upper bound on start_time.").optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, status, from, to }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    let q = sb
      .from("bookings")
      .select(
        "booking_code, customer_name, customer_phone, customer_email, start_time, end_time, status, payment_status, party_size, notes, service_id, staff_id, business_id",
      )
      .order("start_time", { ascending: false })
      .limit(limit ?? 25);
    if (status) q = q.eq("status", status);
    if (from) q = q.gte("start_time", from);
    if (to) q = q.lte("start_time", to);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { bookings: data ?? [] },
    };
  },
});
