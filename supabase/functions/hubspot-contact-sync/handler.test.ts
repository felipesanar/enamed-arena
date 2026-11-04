import { createHandler, type Dependencies } from "./handler.ts";
const assert = (v: unknown) => {
  if (!v) throw new Error("assertion failed");
};
function fixture() {
  const env: Record<string, string> = {
    HUBSPOT_SYNC_SECRET: "fixture",
    HUBSPOT_SYNC_ENABLED: "true",
    HUBSPOT_SEGMENT_PROPERTY: "segment",
    HUBSPOT_EDITION_PROPERTY: "enamed_edicao_alvo",
    SUPABASE_URL: "https://lljnbysgcwvkhlnaqxtt.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "fixture",
  };
  let payload: Record<string, unknown> | null = null;
  let reads = 0;
  const deps: Dependencies = {
    env: (k) => env[k],
    load: async () => {
      reads++;
      return {
        email: "canonical@example.invalid",
        full_name: "Canonical",
        segment: "guest",
        edition_code: null,
        created_at: "2026-01-01T00:00:00Z",
      };
    },
    fetch: async (url, init) => {
      assert(
        url ===
          "https://api-na1.hubapi.com/automation/v4/webhook-triggers/9321751/E0lS7db",
      );
      payload = JSON.parse(String(init.body));
      return new Response("{}");
    },
  };
  return {
    env,
    deps,
    handler: createHandler(deps),
    payload: () => payload,
    reads: () => reads,
    request: (
      body: unknown = { user_id: "c6000000-0000-0000-0000-000000000001" },
      secret = "fixture",
    ) =>
      new Request("https://local.invalid", {
        method: "POST",
        headers: { "x-internal-secret": secret },
        body: JSON.stringify(body),
      }),
  };
}
Deno.test("HubSpot internal-only; JWT or arbitrary profile fields cannot send", async () => {
  const f = fixture();
  assert(
    (await f.handler(f.request(undefined, "wrong"))).status === 403 &&
      f.reads() === 0,
  );
  assert(
    (await f.handler(
          f.request({
            user_id: "c6000000-0000-0000-0000-000000000001",
            segment: "pro",
          }),
        )).status === 400 && f.reads() === 0,
  );
});
Deno.test("HubSpot canonical segment and NULL edition explicitly clear remote property", async () => {
  const f = fixture();
  assert((await f.handler(f.request())).status === 200);
  const p = f.payload();
  assert(
    p?.segment === "guest" && "enamed_edicao_alvo" in p &&
      p.enamed_edicao_alvo === null,
  );
  assert(p?.email === "canonical@example.invalid");
});
Deno.test("HubSpot requires agreed server mapping and explicit enablement", async () => {
  for (
    const key of [
      "HUBSPOT_SYNC_ENABLED",
      "HUBSPOT_EDITION_PROPERTY",
      "HUBSPOT_SEGMENT_PROPERTY",
    ]
  ) {
    const f = fixture();
    delete f.env[key];
    assert((await f.handler(f.request())).status === 503 && f.reads() === 0);
  }
});
Deno.test("HubSpot network failures redact diagnostics and never claim delivery", async () => {
  const f = fixture();
  f.deps.fetch = () => {
    throw new Error("canonical@example.invalid critical-token");
  };
  const r = await f.handler(f.request());
  assert(r.status === 503 && !(await r.text()).includes("canonical@"));
});
