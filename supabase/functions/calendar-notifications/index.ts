import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { createJobHandler } from "./worker.ts";

export function handlerFor(channel: "calendar" | "ops") {
  return createJobHandler(channel, {
    env: (key) => Deno.env.get(key),
    fetch: (url, init) => fetch(url, init),
    rpc: async (name, args) => {
      const client = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        { auth: { persistSession: false, autoRefreshToken: false } },
      );
      const { data, error } = await client.rpc(name, args);
      if (error) throw new Error("database_operation_failed");
      return data;
    },
  });
}
if (import.meta.main) Deno.serve(handlerFor("calendar"));
