import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToolContext } from "@lovable.dev/mcp-js";
import { createSupabaseHandler } from "@lovable.dev/mcp-js/stacks/supabase";
import { createClient } from "@supabase/supabase-js";
import getMyProfile from "./tools/get-my-profile";
import getMyPerformance from "./tools/get-my-performance";
import listMyAttempts from "./tools/list-my-attempts";
import listSimulados from "./tools/list-simulados";
import listErrorNotebook from "./tools/list-error-notebook";
import { supabaseForUser } from "./supabase";

vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn() }));

const tools = [
  { definition: getMyProfile, invoke: (ctx: ToolContext) => getMyProfile.handler({}, ctx) },
  { definition: getMyPerformance, invoke: (ctx: ToolContext) => getMyPerformance.handler({}, ctx) },
  { definition: listMyAttempts, invoke: (ctx: ToolContext) => listMyAttempts.handler({ limit: undefined }, ctx) },
  { definition: listSimulados, invoke: (ctx: ToolContext) => listSimulados.handler({ limit: undefined }, ctx) },
  { definition: listErrorNotebook, invoke: (ctx: ToolContext) => listErrorNotebook.handler({ area: undefined, limit: undefined }, ctx) },
];
const context = (authenticated = true, token = "caller-token") => new ToolContext(authenticated ? {
  type: "oauth",
  principal: {
    claims: { sub: "caller-id" }, sub: "caller-id", scopes: [],
    issuer: "https://lljnbysgcwvkhlnaqxtt.supabase.co/auth/v1",
    resource: "https://lljnbysgcwvkhlnaqxtt.supabase.co/functions/v1/mcp",
    acceptedAudiences: ["authenticated"],
  },
  bearer: { token },
} : undefined);

function clientWith(segment = "pro", profileError: unknown = null) {
  const queries = new Map<string, ReturnType<typeof query>>();
  function query(table: string) {
    const result = table === "profiles"
      ? { data: { segment }, error: profileError }
      : { data: [], error: null };
    const builder = {
      select: vi.fn(() => builder), eq: vi.fn(() => builder),
      order: vi.fn(() => builder), limit: vi.fn(() => builder), is: vi.fn(() => builder),
      maybeSingle: vi.fn(async () => result),
      then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
    };
    return builder;
  }
  const from = vi.fn((table: string) => {
    const builder = query(table);
    queries.set(table, builder);
    return builder;
  });
  vi.mocked(createClient).mockReturnValue({ from } as unknown as ReturnType<typeof createClient>);
  return { from, queries };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("SUPABASE_URL", "https://unit-test.supabase.co");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "public-test-key");
  vi.stubEnv("SUPABASE_ANON_KEY", "anon-test-key");
  vi.stubEnv("VITE_SUPABASE_PROJECT_ID", "lljnbysgcwvkhlnaqxtt");
  vi.stubEnv("VITE_SUPABASE_URL", "https://untrusted.proxy.invalid");
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Network forbidden in unit tests"); }));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("MCP 3.4 tools and caller authorization", () => {
  it("keeps the direct issuer and accepts only the authenticated audience, not a resource-claim fallback", async () => {
    const { default: mcp } = await import("./index");
    expect(mcp.auth).toMatchObject({
      issuer: "https://lljnbysgcwvkhlnaqxtt.supabase.co/auth/v1",
      acceptedAudiences: ["authenticated"],
      acceptResourceClaim: false,
    });
  });

  it("the real SDK Supabase handler rejects an anonymous request without network or DB access", async () => {
    const { default: mcp } = await import("./index");
    const handler = createSupabaseHandler(mcp, { functionName: "mcp" });
    const response = await handler(new Request("https://lljnbysgcwvkhlnaqxtt.supabase.co/functions/v1/mcp", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    }));
    expect(response.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
  });
  it("keeps all five tools read-only and refuses anonymous calls before creating a client", async () => {
    for (const tool of tools) {
      expect(tool.definition.annotations).toMatchObject({ readOnlyHint: true, idempotentHint: true, openWorldHint: false });
      expect(await tool.invoke(context(false))).toMatchObject({ isError: true });
    }
    expect(createClient).not.toHaveBeenCalled();
  });

  it("forwards only the verified caller token with a public key and no persistent auth", () => {
    clientWith();
    supabaseForUser(context());
    expect(createClient).toHaveBeenCalledWith("https://unit-test.supabase.co", "public-test-key", {
      global: { headers: { Authorization: "Bearer caller-token" } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
  });

  it("fails closed if caller authentication or the bearer token is missing", () => {
    expect(() => supabaseForUser(context(false))).toThrow(/authenticated/i);
    expect(() => supabaseForUser(context(true, ""))).toThrow(/authenticated/i);
    expect(createClient).not.toHaveBeenCalled();
  });

  it.each(["guest", "standard"])("blocks the notebook for segment %s before reading entries", async (segment) => {
    const { from, queries } = clientWith(segment);
    const result = await listErrorNotebook.handler({ area: undefined, limit: undefined }, context());
    expect(result).toMatchObject({ isError: true });
    expect(from).toHaveBeenCalledExactlyOnceWith("profiles");
    expect(queries.get("profiles")!.eq).toHaveBeenCalledWith("id", "caller-id");
  });

  it("fails closed when checking the PRO profile fails", async () => {
    const { from } = clientWith("pro", { message: "denied" });
    expect(await listErrorNotebook.handler({ area: undefined, limit: undefined }, context())).toMatchObject({ isError: true });
    expect(from).not.toHaveBeenCalledWith("error_notebook");
  });

  it("reads a PRO notebook under the same caller, caps limits and retains filters", async () => {
    const { queries } = clientWith();
    const result = await listErrorNotebook.handler({ area: "Pediatria", limit: 1000 }, context());
    expect(result).toMatchObject({ structuredContent: { entries: [] } });
    expect(createClient).toHaveBeenCalledTimes(1);
    const notebook = queries.get("error_notebook")!;
    expect(notebook.limit).toHaveBeenCalledWith(100);
    expect(notebook.is).toHaveBeenCalledWith("deleted_at", null);
    expect(notebook.eq).toHaveBeenCalledWith("area", "Pediatria");
  });

  it("retains user filters and read-only client surface for the other tools", async () => {
    for (const tool of tools.filter(({ definition }) => definition !== listErrorNotebook)) {
      const { queries } = clientWith();
      await tool.invoke(context());
      expect(queries.size).toBe(1);
      const [table, query] = [...queries.entries()][0];
      expect(query.select).toHaveBeenCalled();
      if (table === "profiles") expect(query.eq).toHaveBeenCalledWith("id", "caller-id");
      if (table === "user_performance_summary") expect(query.eq).toHaveBeenCalledWith("user_id", "caller-id");
      // Mock exposes no insert/update/delete/rpc: accidental writes fail the test.
    }
  });
});
