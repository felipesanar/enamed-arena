import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { createHandler } from "./handler.ts";

export const handler = createHandler({
  env: (key) => Deno.env.get(key),
  fetch: (url, init) => fetch(url, init),
  load: async (userId) => {
    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data: profile, error } = await db.from("profiles").select(
      "email,full_name,segment,created_at",
    ).eq("id", userId).maybeSingle();
    if (error) throw new Error("profile_read_failed");
    if (!profile) return null;
    const { data: onboarding, error: targetError } = await db.from(
      "onboarding_profiles",
    ).select("target_edition_id").eq("user_id", userId).maybeSingle();
    if (targetError) throw new Error("target_read_failed");
    let edition_code: string | null = null;
    if (onboarding?.target_edition_id) {
      const { data: edition, error: editionError } = await db.from(
        "exam_editions",
      ).select("code").eq("id", onboarding.target_edition_id).single();
      if (editionError) throw new Error("edition_read_failed");
      edition_code = edition.code;
    }
    return { ...profile, edition_code };
  },
});
if (import.meta.main) Deno.serve(handler);
