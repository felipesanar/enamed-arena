import { test } from "node:test";
import assert from "node:assert/strict";
import { findUnpinnedImports, validateImportMap } from "./check-edge-function-pins.mjs";

test("accepts exact external versions, subpaths and local imports", () => {
  assert.deepEqual(findUnpinnedImports(`
    import { x } from "npm:@scope/pkg@1.2.3/sub";
    export { y } from "https://esm.sh/zod@4.6.7?target=deno";
    import "./local.ts";
    import("node:crypto");
  `), []);
});

test("rejects loose, missing and deceptive versions across import forms", () => {
  for (const spec of ["npm:zod@^4.6.7", "npm:zod@4", "npm:zod", "jsr:@std/path@~1.2.3", "https://esm.sh/zod@4.6.7^", "npm:zod@4.6.7?version=latest"]) {
    assert.equal(findUnpinnedImports(`import {\n z\n} from "${spec}";`).length, 1, spec);
    assert.equal(findUnpinnedImports(`await import("${spec}")`).length, 1, spec);
    assert.equal(findUnpinnedImports("await import(`" + spec + "`)").length, 1, spec);
  }
});

test("checks deno import maps including scoped mappings", () => {
  assert.deepEqual(validateImportMap({ imports: { zod: "npm:zod@4.6.7" } }), []);
  assert.equal(validateImportMap({ imports: { zod: "npm:zod@^4" }, scopes: { "./": { sdk: "npm:sdk" } } }).length, 2);
  assert.throws(() => validateImportMap({ imports: { zod: 42 } }), /mapping/);
});
