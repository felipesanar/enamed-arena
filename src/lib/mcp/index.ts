import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getMyProfile from "./tools/get-my-profile";
import listSimulados from "./tools/list-simulados";
import getMyPerformance from "./tools/get-my-performance";
import listMyAttempts from "./tools/list-my-attempts";
import listErrorNotebook from "./tools/list-error-notebook";

// The OAuth issuer MUST be the direct Supabase host, built from the project ref
// (never from SUPABASE_URL, which can be a proxy). Vite inlines
// VITE_SUPABASE_PROJECT_ID as a literal at build time, keeping this import-safe.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "simulados-sanarflix-mcp",
  title: "Simulados SanarFlix MCP",
  version: "0.1.0",
  instructions:
    "Read-only tools for the Simulados SanarFlix (ENAMED) platform. Each caller is a signed-in user; every tool returns only that user's data under their permissions. Use `list_simulados` to browse mock exams, `get_my_performance` for score summaries, `list_my_attempts` for attempt history, `get_my_profile` for account details, and `list_error_notebook` for the PRO error notebook.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [getMyProfile, listSimulados, getMyPerformance, listMyAttempts, listErrorNotebook],
});