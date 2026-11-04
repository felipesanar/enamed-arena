import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

const endpoints = [
  ["admin-verify-questions", "content.manage"],
  ["admin-verify-gabarito", "content.manage"],
  ["admin-delete-user", "users.manage"],
] as const;

// Evaluate the actual handler with imports replaced by explicit local ports.
// No Deno runtime, HTTP, external import or secret environment is consulted.
async function handler(name: string, options: { badJwt?: boolean; denied?: boolean; auditError?: boolean; apiKey?: boolean } = {}) {
  const calls: string[] = [];
  const rpc = vi.fn(async (method: string, args: Record<string, unknown>) => {
    calls.push(method);
    if (method === "admin_require") return { data: null, error: options.denied ? { message: "denied" } : null };
    return { data: null, error: options.auditError ? { message: "audit unavailable" } : null };
  });
  const userClient = {
    auth: { getUser: vi.fn(async () => {
      calls.push("getUser");
      return { data: { user: options.badJwt ? null : { id: "11111111-1111-4111-8111-111111111111" } }, error: options.badJwt ? {} : null };
    }) }, rpc,
  };
  const deleteUser = vi.fn(async () => { calls.push("deleteUser"); return { error: null }; });
  const createClient = vi.fn((_url: string, key: string, config?: unknown) => {
    calls.push(key === "anon" ? "userClient" : "adminClient");
    if (key === "anon") {
      expect(config).toEqual({ global: { headers: { Authorization: "Bearer real-jwt" } } });
      return userClient;
    }
    return { auth: { admin: { deleteUser } } };
  });
  let serve: (req: Request) => Promise<Response>;
  const Deno = {
    serve: (fn: typeof serve) => { serve = fn; },
    env: { get: (key: string) => ({ SUPABASE_URL: "https://example.invalid", SUPABASE_ANON_KEY: "anon", SUPABASE_SERVICE_ROLE_KEY: "service", GEMINI_API_KEY: options.apiKey ? "local-double" : undefined })[key] },
  };
  const source = readFileSync(resolve(`supabase/functions/${name}/index.ts`), "utf8");
  const js = ts.transpileModule(source.replace(/^import .*;\r?\n/gm, ""), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  const fetch = vi.fn(async () => { calls.push("modelCall"); return { ok: true, json: async () => ({}) }; });
  new Function("Deno", "createClient", "fetch", "buildContents", "parseFindings", "filterFindings", "filterAiFindings", "RESPONSE_SCHEMA", js)(
    Deno, createClient, fetch, () => [], () => [], (items: unknown) => items, (items: unknown) => items, {},
  );
  return { run: (body = {}, authorization: string | null = "Bearer real-jwt") => serve(new Request("https://example.invalid", {
    method: "POST", headers: { ...(authorization ? { Authorization: authorization } : {}), Origin: "https://simulados.sanar.com.br", "Content-Type": "application/json" }, body: JSON.stringify(body),
  })), calls, rpc, deleteUser };
}

describe.each(endpoints)("%s JWT capability boundary", (name, capability) => {
  it("accepts capability success with void data, not an admin role", async () => {
    const h = await handler(name);
    const response = await h.run({ user_id: "22222222-2222-4222-8222-222222222222", actor_id: "forged" });
    expect(response.status).toBe(200);
    expect(h.rpc).toHaveBeenCalledWith("admin_require", { p_capability: capability });
    expect(h.calls.indexOf("getUser")).toBeLessThan(h.calls.indexOf("admin_require"));
    if (h.calls.includes("adminClient")) expect(h.calls.indexOf("admin_require")).toBeLessThan(h.calls.indexOf("adminClient"));
    expect(h.rpc.mock.calls.some(([method]) => method === "has_role")).toBe(false);
  });
  it("denies capability errors before creating a service client", async () => {
    const h = await handler(name, { denied: true });
    expect((await h.run()).status).toBe(403);
    expect(h.calls).not.toContain("adminClient");
    expect(h.deleteUser).not.toHaveBeenCalled();
  });
  it("denies invalid JWT before capability or service access", async () => {
    const h = await handler(name, { badJwt: true });
    expect((await h.run()).status).toBe(401);
    expect(h.rpc).not.toHaveBeenCalled();
    expect(h.calls).not.toContain("adminClient");
  });
  it("denies anonymous requests before creating clients", async () => {
    const h = await handler(name);
    expect((await h.run({}, null)).status).toBe(401);
    expect(h.calls).toEqual([]);
  });
});

describe("delete auditing and input", () => {
  it("records the target, never a caller-supplied actor, through the JWT client before deletion", async () => {
    const h = await handler("admin-delete-user");
    const target = "22222222-2222-4222-8222-222222222222";
    expect((await h.run({ user_id: target, actor_id: "forged" })).status).toBe(200);
    expect(h.rpc).toHaveBeenCalledWith("admin_log_action", expect.objectContaining({ p_entity_id: target }));
    expect(JSON.stringify(h.rpc.mock.calls)).not.toContain("forged");
    expect(h.calls.indexOf("admin_log_action")).toBeLessThan(h.calls.indexOf("deleteUser"));
  });
  it("fails closed when audit fails", async () => {
    const h = await handler("admin-delete-user", { auditError: true });
    expect((await h.run({ user_id: "22222222-2222-4222-8222-222222222222" })).status).toBe(500);
    expect(h.deleteUser).not.toHaveBeenCalled();
  });
  it.each(["11111111-1111-4111-8111-111111111111", "not-a-uuid", null, 12])("rejects self or invalid target %s", async target => {
    const h = await handler("admin-delete-user");
    expect((await h.run({ user_id: target })).status).toBe(400);
    expect(h.deleteUser).not.toHaveBeenCalled();
  });
});

describe.each(endpoints.slice(0,2))("%s action audit", name => {
  it("audits using JWT client without student content or forged actor", async () => {
    const h = await handler(name, { apiKey: true });
    expect((await h.run({ questions: [{ question_number: 1 }], actor_id: "forged" })).status).toBe(200);
    expect(h.rpc).toHaveBeenCalledWith("admin_log_action", expect.objectContaining({ p_metadata: { question_count: 1 } }));
    expect(JSON.stringify(h.rpc.mock.calls)).not.toContain("forged");
    expect(h.calls).not.toContain("adminClient");
    expect(h.calls.indexOf("admin_log_action")).toBeLessThan(h.calls.indexOf("modelCall"));
  });
  it("fails closed if audit is unavailable", async () => {
    const h = await handler(name, { apiKey: true, auditError: true });
    expect((await h.run({ questions: [{ question_number: 1 }] })).status).toBe(500);
    expect(h.calls).not.toContain("modelCall");
  });
});
