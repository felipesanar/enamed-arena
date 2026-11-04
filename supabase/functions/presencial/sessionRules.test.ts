import { readFileSync } from "node:fs";
import ts from "typescript";
import { expect, it, vi } from "vitest";

it.each(["email_direct", "name_suggestion"])("%s passes only the validated server session and resolved user to the session RPC", async path => {
  const source = readFileSync("supabase/functions/presencial/index.ts", "utf8");
  const ast = ts.createSourceFile("index.ts", source, ts.ScriptTarget.ES2022, true);
  const node = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === "createSession")!;
  const js = ts.transpileModule(node.getText(ast), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const insert = vi.fn(() => ({ select: () => ({ single: async () => ({ data: { id: "submission" }, error: null }) }) }));
  const rpc = vi.fn(async () => ({ data: "attempt", error: null }));
  const buildReadyResponse = vi.fn(async () => ({ status: "ready" }));
  const createSession = new Function("buildReadyResponse", `${js}; return createSession;`)(buildReadyResponse);
  await createSession({ rpc, from: () => ({ insert }) }, { id: "server-session", simulado_id: "server-sim" }, path,
    { id: "resolved-user" }, "ip-hash", "Fixture", "qa@example.invalid", null);
  expect(rpc).toHaveBeenCalledExactlyOnceWith("create_or_convert_presencial_attempt_for_session", {
    p_simulado_id: "server-sim", p_user_id: "resolved-user", p_session_id: "server-session",
  });
  expect(insert).toHaveBeenCalledWith(expect.objectContaining({ session_id: "server-session", linked_attempt_id: "attempt" }));
});
