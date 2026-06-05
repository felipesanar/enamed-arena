#!/usr/bin/env node
/**
 * check-edge-function-pins.mjs
 *
 * Falha o build se alguma Edge Function (supabase/functions/**\/*.ts) importar
 * uma dependência externa SEM pin completo (major.minor.patch).
 *
 * Contexto: docs/INCIDENTE_2026_05_17.md — um `npm:@supabase/supabase-js@2`
 * (sem patch) re-resolveu para uma versão nova no redeploy em massa de 17/05 e
 * quebrou três fluxos de auth em produção. Pin incompleto é uma bomba-relógio:
 * qualquer especificador `@2`, `@2.x`, `^2`, `~2` ou sem versão re-resolve a
 * versão mais nova a cada deploy. Esta trava impede a regressão.
 *
 * Considera "externo": especificadores que começam com `npm:`, `jsr:`,
 * `http://` ou `https://` (esm.sh, deno.land, etc.). Imports relativos
 * (./, ../) e módulos `node:` são ignorados.
 *
 * Uso: node scripts/check-edge-function-pins.mjs
 * Saída: exit 0 se tudo pinado; exit 1 listando os offensores.
 */
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const FUNCTIONS_DIR = join(ROOT, "supabase", "functions");

/** Recursively collect all .ts files under a directory. */
async function collectTsFiles(dir) {
  const out = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out; // dir doesn't exist → nothing to check
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await collectTsFiles(full)));
    else if (entry.isFile() && entry.name.endsWith(".ts")) out.push(full);
  }
  return out;
}

const EXTERNAL_PREFIX = /^(npm:|jsr:|https?:\/\/)/;
// Captures `import ... from "<spec>"`, `import "<spec>"` and `export ... from "<spec>"`.
const IMPORT_RE = /(?:import|export)\b[^'"]*?\bfrom\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]/g;
// A version token starts with a digit, right after an `@` (so it skips the npm scope `@supabase`).
const VERSION_TOKEN_RE = /@(\d[\w.\-+]*)/g;
const FULLY_PINNED_RE = /^\d+\.\d+\.\d+(?:[-+][\w.\-]+)?$/;

function extractVersion(spec) {
  // Strip the protocol so a host like `https://` is never mistaken for a version.
  const withoutProtocol = spec.replace(/^https?:\/\//, "").replace(/^(npm:|jsr:)/, "");
  const matches = [...withoutProtocol.matchAll(VERSION_TOKEN_RE)].map((m) => m[1]);
  // The package version is the last `@<digit...>` token (e.g. `@supabase/supabase-js@2.49.4`).
  return matches.length ? matches[matches.length - 1] : null;
}

const files = await collectTsFiles(FUNCTIONS_DIR);
const offenders = [];

for (const file of files) {
  const content = await readFile(file, "utf8");
  const lines = content.split(/\r?\n/);
  lines.forEach((line, idx) => {
    IMPORT_RE.lastIndex = 0;
    let m;
    while ((m = IMPORT_RE.exec(line)) !== null) {
      const spec = m[1] ?? m[2];
      if (!spec || !EXTERNAL_PREFIX.test(spec)) continue;
      const version = extractVersion(spec);
      const pinned = version != null && FULLY_PINNED_RE.test(version);
      if (!pinned) {
        offenders.push({
          file: relative(ROOT, file).replace(/\\/g, "/"),
          line: idx + 1,
          spec,
          version: version ?? "(sem versão)",
        });
      }
    }
  });
}

if (offenders.length > 0) {
  console.error("\n❌ Edge Function com import externo NÃO pinado (major.minor.patch):\n");
  for (const o of offenders) {
    console.error(`  ${o.file}:${o.line}`);
    console.error(`    → ${o.spec}   (versão detectada: ${o.version})`);
  }
  console.error(
    "\nPin completo obrigatório (ex.: @supabase/supabase-js@2.49.4). Ver docs/INCIDENTE_2026_05_17.md.\n",
  );
  process.exit(1);
}

console.log(
  `✅ Edge Functions OK — ${files.length} arquivo(s) .ts verificados, todos os imports externos com pin completo.`,
);
