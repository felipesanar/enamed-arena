// No remote imports: tests inject all privileged I/O and cannot send real mail.
export const NOVU_TRIGGER_URL =
  "https://kong.app-prod.sanar.cloud/novu/fallback/v1/events/trigger";
export const SUPABASE_URL = "https://lljnbysgcwvkhlnaqxtt.supabase.co";
export interface Dependencies {
  env: (key: string) => string | undefined;
  rpc: (name: string, args?: Record<string, unknown>) => Promise<unknown>;
  fetch: (url: string, init: RequestInit) => Promise<Response>;
}
export function constantTimeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}
export function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}
interface Claim {
  id: string;
  lease_token: string;
  event_name: string;
  recipient_id: string | null;
  email: string | null;
  payload: Record<string, unknown>;
}
export function createJobHandler(
  channel: "calendar" | "ops",
  deps: Dependencies,
) {
  return async (req: Request): Promise<Response> => {
    if (req.method !== "POST") {
      return json(405, { error: "method_not_allowed" });
    }
    const secret = deps.env("NOVU_RELAY_SECRET") ?? "";
    if (!secret) return json(503, { error: "unconfigured" });
    if (
      !constantTimeEqual(req.headers.get("x-internal-secret") ?? "", secret)
    ) return json(403, { error: "forbidden" });
    const workflows: Record<string, string | undefined> = channel === "calendar"
      ? {
        window_open: deps.env("CALENDAR_WINDOW_OPEN_WORKFLOW_ID"),
        last24h: deps.env("CALENDAR_LAST24H_WORKFLOW_ID"),
        results_released: deps.env("CALENDAR_RESULTS_RELEASED_WORKFLOW_ID"),
      }
      : {
        ops_incident: deps.env("OPS_WORKFLOW_ID"),
        ops_recovery: deps.env("OPS_WORKFLOW_ID"),
      };
    const recipient = deps.env("OPS_ALERT_RECIPIENT");
    if (
      deps.env(
          channel === "calendar"
            ? "CALENDAR_DISPATCH_ENABLED"
            : "OPS_DISPATCH_ENABLED",
        ) !== "true" ||
      deps.env("SUPABASE_URL") !== SUPABASE_URL ||
      !deps.env("SUPABASE_SERVICE_ROLE_KEY") ||
      Object.values(workflows).some((v) => !v?.trim()) ||
      (deps.env("NOVU_TRIGGER_URL") &&
        deps.env("NOVU_TRIGGER_URL") !== NOVU_TRIGGER_URL) ||
      (channel === "ops" &&
        !/^[^\s<>"@]+@[^\s<>"@]+\.[^\s<>"@]+$/.test(recipient ?? ""))
    ) {
      return json(503, { state: "skipped", reason: "dispatch_unconfigured" });
    }
    // Request bodies are deliberately ignored: no caller-selected URL, audience,
    // workflow, email, historical cutoff or template/HTML override.
    let sent = 0, uncertain = 0;
    try {
      if (
        await deps.rpc("communication_job_enabled", { p_job: channel }) !== true
      ) return json(503, { state: "skipped", reason: "dispatch_disabled" });
      const health = await deps.rpc(
        channel === "calendar"
          ? "prepare_calendar_communications"
          : "prepare_ops_communications",
        channel === "calendar" ? { p_batch: 100 } : {},
      );
      const claimed = await deps.rpc("claim_communications", {
        p_channel: channel,
        p_batch: 10,
      });
      if (!Array.isArray(claimed)) throw new Error("invalid_claim_response");
      for (const row of claimed as Claim[]) {
        const workflow = workflows[row.event_name];
        if (
          !workflow ||
          (channel === "calendar" && (!row.email || !row.recipient_id))
        ) throw new Error("invalid_claim");
        await deps.rpc("start_communication", {
          p_id: row.id,
          p_lease: row.lease_token,
        });
        let status = "uncertain";
        try {
          const res = await deps.fetch(NOVU_TRIGGER_URL, {
            method: "POST",
            redirect: "error",
            signal: AbortSignal.timeout(5000),
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: workflow,
              to: [{
                subscriberId: channel === "ops" ? recipient : row.recipient_id,
                email: channel === "ops" ? recipient : row.email,
              }],
              payload: { ...row.payload, event: row.event_name },
            }),
          });
          // No upstream idempotency contract is documented for this gateway.
          // Any missing/rejected ACK is operator-reconciled, never blindly retried.
          if (res.ok) status = "sent";
          await res.body?.cancel();
        } catch {
          /* Error strings and response bodies may contain PII/secrets. */
        }
        await deps.rpc("complete_communication", {
          p_id: row.id,
          p_lease: row.lease_token,
          p_status: status,
        });
        if (status === "sent") {
          sent++;
        } else uncertain++;
      }
      const missingDependency = channel === "ops" && !!health &&
        typeof health === "object" && "cron_dependency" in health &&
        health.cron_dependency === "not_installed";
      return json(uncertain || missingDependency ? 503 : 200, {
        state: uncertain
          ? "uncertain"
          : missingDependency
          ? "dependency_missing"
          : "completed",
        sent,
        uncertain,
      });
    } catch {
      return json(503, {
        state: "failed",
        reason: "job_or_ack_failed",
        sent,
        uncertain,
      });
    }
  };
}
