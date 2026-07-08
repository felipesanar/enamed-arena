import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";

/**
 * Build a Supabase client that acts as the authenticated MCP caller. The raw
 * bearer token from the verified OAuth context is forwarded as the
 * `Authorization` header so every query runs under that user's RLS policies —
 * exactly like the browser app. Never use the service-role key here.
 *
 * Import-safe: reads env only when called (inside a tool handler), never at
 * module load, so the manifest-extract eval and cold start don't need secrets.
 */
export function supabaseForUser(ctx: ToolContext): SupabaseClient {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

/** Standard "not signed in" tool result. */
export const notAuthenticated = {
  content: [{ type: "text" as const, text: "Not authenticated. Reconnect this MCP server and sign in." }],
  isError: true,
};