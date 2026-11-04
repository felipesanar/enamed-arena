import { constantTimeEqual, json } from "../calendar-notifications/worker.ts";

// Product has not accepted channels/cadence or a real workflow for this scaffold.
// Fail closed BEFORE querying student data; no fake successful daily dispatch.
export function createHandler(env: (key: string) => string | undefined) {
  return async (req: Request): Promise<Response> => {
    if (req.method !== "POST") {
      return json(405, { error: "method_not_allowed" });
    }
    const secret = env("NOVU_RELAY_SECRET") ?? "";
    if (!secret) return json(503, { error: "unconfigured" });
    if (
      !constantTimeEqual(req.headers.get("x-internal-secret") ?? "", secret)
    ) return json(403, { error: "forbidden" });
    return json(503, {
      state: "skipped",
      reason: "product_workflow_not_accepted",
      sent: 0,
    });
  };
}
