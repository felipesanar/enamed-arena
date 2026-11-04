import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, notAuthenticated } from "../supabase";
import { resolvePerformanceEdition } from "../edition-scope";

export default defineTool({
  name: "get_my_performance",
  title: "Get my performance summary",
  description:
    "Return released, non-training performance for one catalog edition of the signed-in OAuth user. Never a global aggregate.",
  inputSchema: {
    edition_id: z.uuid().optional().describe("Catalog edition UUID. Defaults to the user's target, graduation term, then current catalog edition."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ edition_id }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated;
    try {
      const client = supabaseForUser(ctx);
      const userId = ctx.getUserId();
      if (!userId) return notAuthenticated;
      const edition = await resolvePerformanceEdition(client, userId, edition_id);
      if (!edition) return {
        content: [{ type: "text", text: "No edition is available for this performance scope yet." }],
        structuredContent: { scope: null, performance: [] },
      };
      const scope = { edition_id: edition.id, edition_label: edition.label, include_training: false };
      const { data, error } = await client.rpc("get_user_performance_summary", {
        p_user_id: userId, p_edition_id: edition.id, p_include_training: false,
      });
      if (error) throw new Error("Performance unavailable");
      const performance = data ?? [];
      return {
        content: [{ type: "text", text: JSON.stringify({ scope, performance }) }],
        structuredContent: { scope, performance },
      };
    } catch {
      return { content: [{ type: "text", text: "Performance scope unavailable. Check the edition and try again." }], isError: true };
    }
  },
});
