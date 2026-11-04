import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, notAuthenticated } from "../supabase";

export default defineTool({
  name: "list_error_notebook",
  title: "List error notebook entries",
  description:
    "List the signed-in user's error notebook (caderno de erros) entries — questions they got wrong — newest first. Optionally filter by area. This is a PRO feature; non-PRO users see no entries.",
  inputSchema: {
    area: z.string().optional().describe("Filter entries by medical area (e.g. 'Clínica Médica')."),
    limit: z
      .number()
      .int()
      .optional()
      .describe("Maximum number of entries to return. Defaults to 20."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ area, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated;
    const client = supabaseForUser(ctx);
    const { data: profile, error: profileError } = await client
      .from("profiles")
      .select("segment")
      .eq("id", ctx.getUserId()!)
      .maybeSingle();
    if (profileError || profile?.segment !== "pro") {
      return { content: [{ type: "text", text: "PRO access required for the error notebook." }], isError: true };
    }
    const capped = Math.min(Math.max(limit ?? 20, 1), 100);
    let query = client
      .from("error_notebook")
      .select("id, area, theme, reason, question_number, simulado_title, was_correct, created_at, next_review_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(capped);
    if (area) query = query.eq("area", area);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { entries: data ?? [] },
    };
  },
});
