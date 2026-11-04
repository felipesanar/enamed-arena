import { describe, expect, it } from "vitest";
import { authorizeRequest } from "./auth";

const secret = "fixture-relay-secret";

function request(method = "POST", headers: HeadersInit = {}) {
  return new Request("https://fixture.invalid/gabarito-key-alerts", { method, headers });
}

describe("gabarito-key-alerts authorization", () => {
  it.each([
    ["missing", {}],
    ["empty", { "x-internal-secret": "" }],
    ["wrong same length", { "x-internal-secret": "fixture-relay-secreX" }],
    ["wrong first character", { "x-internal-secret": "Xixture-relay-secret" }],
    ["shorter", { "x-internal-secret": "fixture-relay" }],
    ["longer", { "x-internal-secret": "fixture-relay-secret-extra" }],
  ])("rejects %s header", async (_label, headers) => {
    const response = authorizeRequest(request("POST", headers), secret);
    expect(response?.status).toBe(403);
    expect(await response?.json()).toEqual({ error: "Forbidden" });
  });

  it.each([undefined, null, "", "   "])("fails closed for absent configuration %j", async (configured) => {
    const response = authorizeRequest(request("POST", { "x-internal-secret": secret }), configured);
    expect(response?.status).toBe(503);
    expect(await response?.json()).toEqual({ error: "Server misconfigured" });
  });

  it("does not authorize two empty credentials", () => {
    expect(authorizeRequest(request("POST", { "x-internal-secret": "" }), "")?.status).toBe(503);
  });

  it("accepts only the exact configured secret", () => {
    expect(authorizeRequest(request("POST", { "x-internal-secret": secret }), secret)).toBeNull();
  });

  it("does not normalize the configured credential", () => {
    expect(authorizeRequest(request("POST", { "x-internal-secret": secret }), ` ${secret} `)?.status).toBe(403);
  });

  it("accepts case-insensitive HTTP header names", () => {
    expect(authorizeRequest(request("POST", { "X-Internal-Secret": secret }), secret)).toBeNull();
  });

  it("does not accept an admin JWT or origin as an alternative", () => {
    const response = authorizeRequest(request("POST", {
      Authorization: "Bearer fixture-admin-jwt",
      Origin: "https://simulados.sanar.com.br",
    }), secret);
    expect(response?.status).toBe(403);
    expect(response?.headers.has("Access-Control-Allow-Origin")).toBe(false);
  });

  it.each(["GET", "HEAD", "PUT", "PATCH", "DELETE"])("rejects %s before configuration/auth", async (method) => {
    const response = authorizeRequest(request(method, { "x-internal-secret": secret }), undefined);
    expect(response?.status).toBe(405);
    expect(response?.headers.get("Allow")).toBe("POST, OPTIONS");
    expect(await response?.json()).toEqual({ error: "Method not allowed" });
  });

  it("short-circuits OPTIONS without opening CORS or requiring configuration", () => {
    const response = authorizeRequest(request("OPTIONS", { Origin: "https://untrusted.invalid" }), undefined);
    expect(response?.status).toBe(204);
    expect(response?.body).toBeNull();
    expect(response?.headers.has("Access-Control-Allow-Origin")).toBe(false);
  });

  it("never echoes credentials in a rejection", async () => {
    const response = authorizeRequest(request("POST", { "x-internal-secret": "fixture-wrong-value" }), secret)!;
    const body = await response.text();
    expect(body).not.toContain(secret);
    expect(body).not.toContain("fixture-wrong-value");
    expect(response.headers.has("x-internal-secret")).toBe(false);
  });
});
