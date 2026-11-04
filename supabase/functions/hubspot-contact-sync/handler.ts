import {
  constantTimeEqual,
  json,
  SUPABASE_URL,
} from "../calendar-notifications/worker.ts";

const HUBSPOT_WEBHOOK_URL =
  "https://api-na1.hubapi.com/automation/v4/webhook-triggers/9321751/E0lS7db";
interface CanonicalContact {
  email: string;
  full_name: string | null;
  segment: string;
  edition_code: string | null;
  created_at: string;
}
export interface Dependencies {
  env: (key: string) => string | undefined;
  load: (id: string) => Promise<CanonicalContact | null>;
  fetch: (url: string, init: RequestInit) => Promise<Response>;
}
export function createHandler(deps: Dependencies) {
  return async (req: Request): Promise<Response> => {
    if (req.method !== "POST") {
      return json(405, { error: "method_not_allowed" });
    }
    const secret = deps.env("HUBSPOT_SYNC_SECRET") ?? "";
    if (!secret) return json(503, { error: "unconfigured" });
    if (
      !constantTimeEqual(req.headers.get("x-internal-secret") ?? "", secret)
    ) return json(403, { error: "forbidden" });
    // Explicit operator confirmation of the existing property contract. Never
    // create remote properties or accept a request-provided property mapping.
    if (
      deps.env("HUBSPOT_SYNC_ENABLED") !== "true" ||
      deps.env("HUBSPOT_SEGMENT_PROPERTY") !== "segment" ||
      deps.env("HUBSPOT_EDITION_PROPERTY") !== "enamed_edicao_alvo" ||
      deps.env("SUPABASE_URL") !== SUPABASE_URL ||
      !deps.env("SUPABASE_SERVICE_ROLE_KEY")
    ) {
      return json(503, {
        state: "skipped",
        reason: "mapping_or_dispatch_unconfigured",
      });
    }
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return json(400, { error: "invalid_request" });
    }
    if (
      !body || typeof body !== "object" || Array.isArray(body) ||
      Object.keys(body).some((k) => k !== "user_id") ||
      !("user_id" in body) || typeof body.user_id !== "string" ||
      !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(body.user_id)
    ) return json(400, { error: "invalid_request" });
    try {
      const contact = await deps.load(body.user_id);
      if (!contact) return json(404, { error: "contact_not_found" });
      if (
        !["guest", "standard", "pro"].includes(contact.segment) ||
        !/^[^\s<>"@]+@[^\s<>"@]+\.[^\s<>"@]+$/.test(contact.email)
      ) return json(422, { error: "invalid_canonical_contact" });
      const response = await deps.fetch(HUBSPOT_WEBHOOK_URL, {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(5000),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: contact.email,
          full_name: contact.full_name ?? "",
          segment: contact.segment,
          subscriber_type: contact.segment === "pro"
            ? "Aluno PRO"
            : contact.segment === "standard"
            ? "Aluno SanarFlix"
            : "Não assinante",
          registered_at: contact.created_at,
          enamed_edicao_alvo: contact.edition_code,
          source: "enamed-arena",
        }),
      });
      await response.body?.cancel();
      if (!response.ok) {
        return json(503, { state: "failed", reason: "upstream_rejected" });
      }
      return json(200, { state: "acknowledged" });
    } catch {
      return json(503, {
        state: "uncertain",
        reason: "canonical_read_or_upstream_failed",
      });
    }
  };
}
