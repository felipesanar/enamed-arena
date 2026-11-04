import { createJobHandler } from "../calendar-notifications/worker.ts";
const assert = (v: unknown) => {
  if (!v) throw new Error("assertion failed");
};
Deno.test("ops requires explicit recipient and workflow before querying", async () => {
  for (const missing of ["OPS_ALERT_RECIPIENT", "OPS_WORKFLOW_ID"]) {
    const env: Record<string, string> = {
      NOVU_RELAY_SECRET: "fixture",
      OPS_DISPATCH_ENABLED: "true",
      SUPABASE_URL: "https://lljnbysgcwvkhlnaqxtt.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "fixture",
      OPS_ALERT_RECIPIENT: "ops@example.invalid",
      OPS_WORKFLOW_ID: "approved",
    };
    delete env[missing];
    const handler = createJobHandler("ops", {
      env: (k) => env[k],
      rpc: () => {
        throw new Error("must not query");
      },
      fetch: () => {
        throw new Error("must not send");
      },
    });
    assert(
      (await handler(
        new Request("https://local.invalid", {
          method: "POST",
          headers: { "x-internal-secret": "fixture" },
        }),
      )).status === 503,
    );
  }
});
Deno.test("missing cron and broken queue are non-success, no fake healthy", async () => {
  for (const broken of [false, true]) {
    const env: Record<string, string> = {
      NOVU_RELAY_SECRET: "fixture",
      OPS_DISPATCH_ENABLED: "true",
      SUPABASE_URL: "https://lljnbysgcwvkhlnaqxtt.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "fixture",
      OPS_ALERT_RECIPIENT: "ops@example.invalid",
      OPS_WORKFLOW_ID: "approved",
    };
    const handler = createJobHandler("ops", {
      env: (k) => env[k],
      rpc: async (name) => {
        if (name === "communication_job_enabled") return true;
        if (name === "prepare_ops_communications") {
          if (broken) throw new Error("queue SQL failed");
          return { cron_dependency: "not_installed" };
        }
        return [];
      },
      fetch: () => {
        throw new Error("must not send");
      },
    });
    assert(
      (await handler(
        new Request("https://local.invalid", {
          method: "POST",
          headers: { "x-internal-secret": "fixture" },
        }),
      )).status === 503,
    );
  }
});
