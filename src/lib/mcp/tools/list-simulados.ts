import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, notAuthenticated } from "../supabase";

export default defineTool({
  name: "list_simulados",
  title: "List simulados",
  description:
    "List the mock exams (simulados) the signed-in user can see, newest first. Includes title, status, question count, duration, and execution window.",
  inputSchema: {
    limit: z
      .number()
      .int()
      .optional()
      .describe("Maximum number of simulados to return. Defaults to 20."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated;
    const capped = Math.min(Math.max(limit ?? 20, 1), 100);
    const { data, error } = await supabaseForUser(ctx)
      .from("simulados")
      .select(
        "id, title, sequence_number, status, questions_count, duration_minutes, execution_window_start, execution_window_end, results_release_at",
      )
      .order("sequence_number", { ascending: false })
      .limit(capped);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { simulados: data ?? [] },
    };
  },
});