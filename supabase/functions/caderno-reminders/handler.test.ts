import { createHandler } from "./handler.ts";
const assert = (v: unknown) => {
  if (!v) throw new Error("assertion failed");
};
Deno.test("Caderno keeps constant-time internal guard; unsupported cadence is honest no-op", async () => {
  const h = createHandler((k) =>
    k === "NOVU_RELAY_SECRET" ? "fixture" : undefined
  );
  const request = (secret: string) =>
    new Request("https://local.invalid", {
      method: "POST",
      headers: { "x-internal-secret": secret },
    });
  assert((await h(request("wrong"))).status === 403);
  const r = await h(request("fixture"));
  assert(r.status === 503 && (await r.json()).sent === 0);
  assert(
    (await createHandler(() => undefined)(request("fixture"))).status === 503,
  );
});
