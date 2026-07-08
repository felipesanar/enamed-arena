import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser, notAuthenticated } from "../supabase";

export default defineTool({
  name: "get_my_performance",
  title: "Get my performance summary",
  description:
    "Return the signed-in user's overall performance summary: total attempts and average, best and last scores.",
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_args, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated;
    const { data, error } = await supabaseForUser(ctx)
      .from("user_performance_summary")
      .select("total_attempts, avg_score, best_score, last_score, last_finished_at")
      .eq("user_id", ctx.getUserId()!)
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data)
      return { content: [{ type: "text", text: "No performance data yet. Complete a simulado first." }] };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { performance: data },
    };
  },
});