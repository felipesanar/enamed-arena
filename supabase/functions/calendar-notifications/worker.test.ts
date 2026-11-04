import { createJobHandler, type Dependencies } from "./worker.ts";

function assert(value: unknown, message = "assertion failed"): asserts value {
  if (!value) throw new Error(message);
}
function fixture(channel: "calendar" | "ops" = "calendar") {
  const values: Record<string, string> = {
    SUPABASE_URL: "https://lljnbysgcwvkhlnaqxtt.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "fixture-key",
    NOVU_RELAY_SECRET: "fixture-secret",
    CALENDAR_DISPATCH_ENABLED: "true",
    OPS_DISPATCH_ENABLED: "true",
    CALENDAR_WINDOW_OPEN_WORKFLOW_ID: "configured-open",
    CALENDAR_LAST24H_WORKFLOW_ID: "configured-last",
    CALENDAR_RESULTS_RELEASED_WORKFLOW_ID: "configured-result",
    OPS_WORKFLOW_ID: "configured-ops",
    OPS_ALERT_RECIPIENT: "ops@example.invalid",
  };
  const calls: string[] = [];
  let sends = 0;
  const deps: Dependencies = {
    env: (key) => values[key],
    rpc: async (name, args) => {
      calls.push(name + (args?.p_status ? ":" + args.p_status : ""));
      if (name === "communication_job_enabled") return true;
      if (name === "claim_communications") {
        return [{
          id: "queue-id",
          lease_token: "lease-id",
          event_name: channel === "calendar" ? "window_open" : "ops_incident",
          recipient_id: "account-id",
          email: "student@example.invalid",
          payload: { event: "window_open" },
        }];
      }
      return channel === "ops" ? { cron_dependency: "installed" } : 1;
    },
    fetch: async (url, init) => {
      assert(
        url ===
          "https://kong.app-prod.sanar.cloud/novu/fallback/v1/events/trigger",
      );
      const body = JSON.parse(String(init?.body));
      assert(body.name.startsWith("configured-"));
      assert(!String(init?.body).includes("fixture-secret"));
      sends++;
      return new Response("{}");
    },
  };
  const request = (secret = "fixture-secret") =>
    new Request("https://internal.invalid", {
      method: "POST",
      headers: { "x-internal-secret": secret },
      body: '{"url":"https://attacker.invalid"}',
    });
  return {
    values,
    calls,
    deps,
    request,
    sends: () => sends,
    handler: createJobHandler(channel, deps),
  };
}
Deno.test("rejects JWT-only and wrong secret before DB or HTTP", async () => {
  const f = fixture();
  const res = await f.handler(f.request("wrong"));
  assert(res.status === 403 && f.calls.length === 0 && f.sends() === 0);
});
Deno.test("disabled or missing workflow is honest 503 before discovery", async () => {
  for (
    const key of [
      "CALENDAR_DISPATCH_ENABLED",
      "CALENDAR_RESULTS_RELEASED_WORKFLOW_ID",
    ]
  ) {
    const f = fixture();
    delete f.values[key];
    assert(
      (await f.handler(f.request())).status === 503 && f.calls.length === 0,
    );
  }
});
Deno.test("validates Supabase project and refuses arbitrary trigger override", async () => {
  const f = fixture();
  f.values.SUPABASE_URL = "https://attacker.invalid";
  assert((await f.handler(f.request())).status === 503 && f.calls.length === 0);
  f.values.SUPABASE_URL = "https://lljnbysgcwvkhlnaqxtt.supabase.co";
  f.values.NOVU_TRIGGER_URL = "https://attacker.invalid";
  assert((await f.handler(f.request())).status === 503 && f.sends() === 0);
});
Deno.test("starts before HTTP and completes only after acknowledgement", async () => {
  const f = fixture();
  assert((await f.handler(f.request())).status === 200);
  assert(
    f.sends() === 1 && f.calls.includes("start_communication") &&
      f.calls.includes("complete_communication:sent"),
  );
});
Deno.test("lost acknowledgement becomes uncertain, no retry in request, no PII in response", async () => {
  const f = fixture();
  let sends = 0;
  f.deps.fetch = async () => {
    sends++;
    throw new Error("student@example.invalid token raw HTML");
  };
  const res = await f.handler(f.request());
  const text = await res.text();
  assert(
    res.status === 503 && sends === 1 &&
      f.calls.includes("complete_communication:uncertain"),
  );
  assert(
    !text.includes("student@") && !text.includes("raw HTML") &&
      !text.includes("fixture-secret"),
  );
});
Deno.test("stale start never sends", async () => {
  const f = fixture();
  const original = f.deps.rpc;
  f.deps.rpc = async (name, args) => {
    if (name === "start_communication") throw new Error("stale");
    return await original(name, args);
  };
  assert((await f.handler(f.request())).status === 503 && f.sends() === 0);
});
Deno.test("database disabled is not reported as sent", async () => {
  const f = fixture();
  f.deps.rpc = async () => false;
  assert((await f.handler(f.request())).status === 503 && f.sends() === 0);
});
