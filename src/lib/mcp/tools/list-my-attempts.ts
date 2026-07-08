import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, notAuthenticated } from "../supabase";

export default defineTool({
  name: "list_my_attempts",
  title: "List my attempts",
  description:
    "List the signed-in user's simulado attempts, most recent first, with status, score and answer counts.",
  inputSchema: {
    limit: z
      .number()
      .int()
      .optional()
      .describe("Maximum number of attempts to return. Defaults to 20."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated;
    const capped = Math.min(Math.max(limit ?? 20, 1), 100);
    const { data, error } = await supabaseForUser(ctx)
      .from("attempts")
      .select(
        "id, simulado_id, status, attempt_type, score_percentage, total_correct, total_answered, is_within_window, started_at, finished_at",
      )
      .order("started_at", { ascending: false })
      .limit(capped);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { attempts: data ?? [] },
    };
  },
});