import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "typescript";
import { assertSafeGenerationPath, generateMcp, validateArtifacts } from "./generate-mcp.mjs";

const ref = "lljnbysgcwvkhlnaqxtt";

// Static regression guard for the emitted JS, not a runtime authorization proof.
function assertReadOnlyPerformanceRpc(index) {
  assert.doesNotMatch(index, /SERVICE_ROLE|\.(?:insert|update|upsert|delete)\s*\(/);
  const source = ts.createSourceFile("mcp.js", index, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  assert.equal(source.parseDiagnostics.length, 0, "Artifact must parse");
  const rpcCalls = [];
  const mutations = new Set(["insert", "update", "upsert", "delete"]);
  function visit(node) {
    if (ts.isPropertyAccessExpression(node)) {
      assert.ok(!mutations.has(node.name.text), "Mutation methods are forbidden");
      if (node.name.text === "rpc") {
        assert.ok(ts.isCallExpression(node.parent) && node.parent.expression === node, "RPC aliases/dynamic calls are forbidden");
        rpcCalls.push(node.parent);
      }
    }
    if (ts.isElementAccessExpression(node)) {
      const key = ts.isStringLiteral(node.argumentExpression) ? node.argumentExpression.text : null;
      assert.ok(key !== "rpc" && !mutations.has(key), "Computed RPC/mutation access is forbidden");
      assert.ok(!(ts.isIdentifier(node.expression) && node.expression.text === "client"), "Dynamic client access is forbidden");
      assert.ok(!(ts.isCallExpression(node.parent) && node.parent.expression === node), "Dynamic method calls are forbidden");
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.equal(rpcCalls.length, 1, "Exactly one authorized RPC is required");
  const call = rpcCalls[0];
  assert.equal(call.expression.expression.getText(source), "client", "RPC must use the caller client");
  assert.equal(call.arguments.length, 2, "RPC must have exactly two arguments");
  assert.ok(ts.isStringLiteral(call.arguments[0]) && call.arguments[0].text === "get_user_performance_summary", "Only the literal performance read RPC is allowed");
  const args = call.arguments[1];
  assert.ok(ts.isObjectLiteralExpression(args), "RPC arguments must be a literal object");
  assert.equal(args.properties.length, 3, "RPC must have exactly three scope arguments");
  const expected = { p_user_id: "userId", p_edition_id: "edition.id", p_include_training: "false" };
  for (const property of args.properties) {
    assert.ok(ts.isPropertyAssignment(property) && ts.isIdentifier(property.name), "No computed keys, shorthand or spreads");
    const key = property.name.text;
    assert.ok(Object.hasOwn(expected, key), "Unknown or duplicate RPC argument");
    assert.equal(property.initializer.getText(source), expected[key], `Invalid ${key}`);
    delete expected[key];
  }
  let block = call.parent;
  while (block && !ts.isBlock(block)) block = block.parent;
  assert.ok(block, "RPC must be inside the handler block");
  for (const [name, initializer] of Object.entries({
    client: "supabaseForUser(ctx)", userId: "ctx.getUserId()",
    edition: "await resolvePerformanceEdition(client, userId, edition_id)",
  })) {
    const bindings = block.statements.filter(ts.isVariableStatement).flatMap(statement =>
      statement.declarationList.declarations.filter(declaration => ts.isIdentifier(declaration.name) && declaration.name.text === name)
        .map(declaration => ({ statement, declaration })));
    assert.equal(bindings.length, 1, `Exactly one local ${name} binding is required`);
    const { statement, declaration } = bindings[0];
    assert.ok(statement.declarationList.flags & ts.NodeFlags.Const, `${name} must be const`);
    assert.ok(statement.end < call.pos, `${name} must be bound before the RPC`);
    assert.equal(declaration.initializer?.getText(source), initializer, `Invalid ${name} provenance`);
  }
  let handler = block.parent;
  while (handler && !ts.isArrowFunction(handler)) handler = handler.parent;
  assert.ok(handler && handler.parameters.length === 2 && handler.parameters[1].name.getText(source) === "ctx", "OAuth handler context required");
  assert.ok(ts.isPropertyAssignment(handler.parent) && handler.parent.name.getText(source) === "handler", "RPC must belong to a tool handler");
  const toolName = handler.parent.parent.properties.find(property => ts.isPropertyAssignment(property) && property.name.getText(source) === "name");
  assert.ok(toolName && ts.isStringLiteral(toolName.initializer) && toolName.initializer.text === "get_my_performance", "RPC must belong to get_my_performance");
}

test("the checked-in official Linux artifact retains fixed pins and authorization boundaries", async () => {
  const directory = new URL("../supabase/functions/mcp/", import.meta.url);
  const names = await readdir(directory);
  const index = await readFile(new URL("index.ts", directory), "utf8");
  const deno = names.includes("deno.json") ? JSON.parse(await readFile(new URL("deno.json", directory), "utf8")) : undefined;
  validateArtifacts({ index, deno }, ref);
  for (const spec of ["npm:@lovable.dev/mcp-js@3.4.0", "npm:zod@4.6.7", "npm:@supabase/supabase-js@2.99.2"]) {
    assert.ok(index.includes(`from "${spec}"`), spec);
  }
  assert.equal([...index.matchAll(/readOnlyHint:\s*true/g)].length, 5);
  assert.equal([...index.matchAll(/if \(!ctx\.isAuthenticated\(\)\) return notAuthenticated/g)].length, 5);
  assert.match(index, /if \(!ctx\.isAuthenticated\(\) \|\| !token\) throw/);
  assert.match(index, /Authorization: `Bearer \$\{token\}`/);
  assert.match(index, /SUPABASE_PUBLISHABLE_KEY \?\? process\.env\.SUPABASE_ANON_KEY/);
  assert.match(index, /from\("profiles"\)\.select\("segment"\)\.eq\("id", ctx\.getUserId\(\)\)/);
  assert.match(index, /if \(profileError \|\| profile\?\.segment !== "pro"\)/);
  assertReadOnlyPerformanceRpc(index);
});

for (const [name, mutate] of [
  ["finalizer RPC", index => index.replace('rpc("get_user_performance_summary"', 'rpc("finalize_attempt_with_results"')],
  ["admin RPC", index => index.replace('rpc("get_user_performance_summary"', 'rpc("admin_import_cutoffs"')],
  ["forged user argument", index => index.replace("p_user_id: userId", 'p_user_id: "forged-user"')],
  ["forged OAuth binding", index => index.replace("const userId = ctx.getUserId();", 'const userId = "forged-user";')],
  ["training enabled", index => index.replace("p_include_training: false", "p_include_training: true")],
  ["global edition argument", index => index.replace("p_edition_id: edition.id", "p_edition_id: null")],
  ["unresolved edition binding", index => index.replace("const edition = await resolvePerformanceEdition(client, userId, edition_id);", "const edition = null;")],
  ["dynamic RPC name", index => index.replace('rpc("get_user_performance_summary"', "rpc(rpcName")],
  ["computed RPC", index => index.replace("client.rpc(", 'client["rpc"](')],
  ["dynamic client method", index => index.replace("client.rpc(", "client[method](")],
  ["RPC alias", index => index.replace("client.rpc(", "(client.rpc)(")],
  ["extra RPC", index => index + '\nclient.rpc("get_user_performance_summary", {});'],
  ["scope override spread", index => index.replace("p_include_training: false", "p_include_training: false, ...overrides")],
  ["service role", index => index + "\nconst key = process.env.SUPABASE_SERVICE_ROLE_KEY;"],
  ...["insert", "update", "upsert", "delete"].map(method => [method, index => index + `\nclient.${method}({});`]),
]) {
  test(`the read-only RPC guard rejects a mutated artifact: ${name}`, async () => {
    const index = await readFile(new URL("../supabase/functions/mcp/index.ts", import.meta.url), "utf8");
    const mutated = mutate(index);
    assert.notEqual(mutated, index, "Mutation must change the official artifact");
    assert.throws(() => assertReadOnlyPerformanceRpc(mutated), assert.AssertionError);
  });
}

test("the eight resolved upgrade advisories are no longer audit exceptions", async () => {
  const retired = new Set([
    "GHSA-f897-62hf-6gxq", "GHSA-46jr-4wx8-v453", "GHSA-22jm-h49p-29qw", "GHSA-6qxp-vccf-f47h",
    "GHSA-mrhx-c7xc-m3w5", "GHSA-5gmw-xhrv-c9v3", "GHSA-85c8-ppgw-ccpr", "GHSA-587h-7wmj-h5pm",
  ]);
  const allowlist = JSON.parse(await readFile(new URL("../audit-allowlist.json", import.meta.url), "utf8"));
  assert.deepEqual(allowlist.exceptions.filter(({ id }) => retired.has(id)), []);
});

test("destructive path guard rejects root, traversal and junctions at any depth", async () => {
  const parent = await mkdtemp(join(tmpdir(), "mcp-path-test-"));
  const root = join(parent, "root");
  const outside = join(parent, "outside");
  try {
    await mkdir(root);
    await mkdir(outside);
    await writeFile(join(outside, "sentinel"), "preserve");
    await assert.rejects(assertSafeGenerationPath(root, root), /root|outside/i);
    if (process.platform === "win32") {
      await assert.rejects(assertSafeGenerationPath(root, root.toUpperCase()), /root|outside/i);
    }
    await assert.rejects(assertSafeGenerationPath(root, join(root, "..", "outside")), /outside/i);
    await assertSafeGenerationPath(root, join(root, "new", "missing"));
    await symlink(outside, join(root, "junction"), process.platform === "win32" ? "junction" : "dir");
    await assert.rejects(assertSafeGenerationPath(root, join(root, "junction", "sentinel")), /link|junction/i);
    await mkdir(join(root, "stage"));
    await symlink(outside, join(root, "stage", "nested"), process.platform === "win32" ? "junction" : "dir");
    await assert.rejects(assertSafeGenerationPath(root, join(root, "stage")), /link|junction/i);
    assert.equal(await readFile(join(outside, "sentinel"), "utf8"), "preserve");
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});
// Validator fixtures only. Production artifacts must come from the official plugin.
const valid = `// AUTO-GENERATED by @lovable.dev/mcp-js
import { auth, defineMcp } from "npm:@lovable.dev/mcp-js@3.4.0";
import { createSupabaseHandler } from "npm:@lovable.dev/mcp-js@3.4.0/stacks/supabase";
var projectRef = "${ref}";
var mcp = defineMcp({ auth: auth.oauth.issuer({
  issuer: \`https://\${projectRef}.supabase.co/auth/v1\`,
  acceptedAudiences: "authenticated", acceptResourceClaim: false
}) });
Deno.serve(createSupabaseHandler(mcp, { functionName: "mcp" }));
`;

test("validates direct project issuer, audience, provenance and pinned imports", () => {
  assert.doesNotThrow(() => validateArtifacts({ index: valid }, ref));
  for (const index of [
    valid.replace(ref, "anotherprojectrefxxxx"),
    valid.replace("authenticated", "anon"),
    valid.replace("acceptResourceClaim: false", "acceptResourceClaim: true"),
    valid.replace(".supabase.co/auth/v1", ".proxy.example/auth/v1"),
    valid.replaceAll("@3.4.0", "@^3.4.0"),
    valid + '\nimport "C:\\\\Users\\\\developer\\\\index.ts";',
    valid + '\nimport "npm:C:/work/index.ts";',
    valid + '\nimport "/home/developer/node_modules/pkg/index.js";',
    valid + '\nimport "unmapped-package";',
    valid + '\nawait import("npm:zod@4");',
  ]) assert.throws(() => validateArtifacts({ index }, ref));
  assert.throws(() => validateArtifacts({ index: valid, deno: { imports: { zod: "npm:zod@^4" } } }, ref));
});

async function fixture(run) {
  const root = await mkdtemp(join(tmpdir(), "mcp-test-"));
  try {
    await mkdir(join(root, "supabase/functions/mcp"), { recursive: true });
    await mkdir(join(root, "src/lib/mcp"), { recursive: true });
    await writeFile(join(root, "src/lib/mcp/index.ts"), "export default {};");
    await writeFile(join(root, "package.json"), JSON.stringify({ dependencies: { "@lovable.dev/mcp-js": "3.4.0" } }));
    await writeFile(join(root, "supabase/config.toml"), `project_id = "${ref}"`);
    await writeFile(join(root, "supabase/functions/mcp/index.ts"), "known-good");
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("failed official generation or invalid output preserves canonical bytes", async () => {
  await fixture(async (root) => {
    for (const emit of [async () => { throw new Error("plugin failed"); }, async (stage) => {
      await mkdir(join(stage, "supabase/functions/mcp"), { recursive: true });
      await writeFile(join(stage, "supabase/functions/mcp/index.ts"), "corrupt");
    }]) {
      await assert.rejects(generateMcp({ root, projectRef: ref, emit }));
      assert.equal(await readFile(join(root, "supabase/functions/mcp/index.ts"), "utf8"), "known-good");
    }
  });
});

test("promotes only validated output and produces identical bytes on repeat", async () => {
  await fixture(async (root) => {
    const emit = async (stage) => {
      await assert.rejects(readFile(join(stage, "supabase/config.toml")));
      await mkdir(join(stage, "supabase/functions/mcp"), { recursive: true });
      await writeFile(join(stage, "supabase/functions/mcp/index.ts"), valid);
    };
    await generateMcp({ root, projectRef: ref, emit });
    await generateMcp({ root, projectRef: ref, emit });
    assert.equal(await readFile(join(root, "supabase/functions/mcp/index.ts"), "utf8"), valid);
    await assert.rejects(generateMcp({ root, projectRef: "wrongprojectrefxxxxxx", emit }));
    assert.equal(await readFile(join(root, "supabase/functions/mcp/index.ts"), "utf8"), valid);
  });
});

test("rejects non-deterministic emissions without replacing either canonical artifact", async () => {
  await fixture(async (root) => {
    const previousMap = '{"_lovableMcpGenerated":true,"imports":{}}';
    await writeFile(join(root, "supabase/functions/mcp/deno.json"), previousMap);
    let count = 0;
    const emit = async (stage) => {
      await mkdir(join(stage, "supabase/functions/mcp"), { recursive: true });
      await writeFile(join(stage, "supabase/functions/mcp/index.ts"), valid + `\n// emission ${++count}\n`);
    };
    await assert.rejects(generateMcp({ root, projectRef: ref, emit }), /Non-deterministic/);
    assert.equal(await readFile(join(root, "supabase/functions/mcp/index.ts"), "utf8"), "known-good");
    assert.equal(await readFile(join(root, "supabase/functions/mcp/deno.json"), "utf8"), previousMap);
  });
});

test("publishes the official file set without retaining a stale deno map", async () => {
  await fixture(async (root) => {
    await writeFile(join(root, "supabase/functions/mcp/deno.json"), '{"_lovableMcpGenerated":true}');
    const emit = async (stage) => {
      await mkdir(join(stage, "supabase/functions/mcp"), { recursive: true });
      await writeFile(join(stage, "supabase/functions/mcp/index.ts"), valid);
    };
    await generateMcp({ root, projectRef: ref, emit });
    await assert.rejects(readFile(join(root, "supabase/functions/mcp/deno.json")), { code: "ENOENT" });
    assert.equal(await readFile(join(root, "supabase/functions/mcp/index.ts"), "utf8"), valid);
  });
});

test("rejects import-map byte changes even when the parsed JSON is identical", async () => {
  await fixture(async (root) => {
    let count = 0;
    const emit = async (stage) => {
      const output = join(stage, "supabase/functions/mcp");
      await mkdir(output, { recursive: true });
      await writeFile(join(output, "index.ts"), valid);
      await writeFile(join(output, "deno.json"), JSON.stringify({ imports: {} }, null, ++count));
    };
    await assert.rejects(generateMcp({ root, projectRef: ref, emit }), /Non-deterministic/);
    assert.equal(await readFile(join(root, "supabase/functions/mcp/index.ts"), "utf8"), "known-good");
  });
});
