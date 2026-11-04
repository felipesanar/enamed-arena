#!/usr/bin/env node
import { readdir, readFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const EXTERNAL = /^(npm:|jsr:|https?:\/\/)/;
const VERSION = /^\d+\.\d+\.\d+(?:-[\w.-]+)?(?:\+[\w.-]+)?$/;

export function isPinned(spec) {
  if (/^(npm:|jsr:)/.test(spec)) {
    const match = /^(?:npm:|jsr:)(?:@[^/@]+\/)?[^/@]+@([^/?#]+)(?:\/[^?#]*)?$/.exec(spec);
    return !!match && VERSION.test(match[1]);
  }
  if (/^https?:\/\//.test(spec)) {
    const path = new URL(spec).pathname;
    const versions = [...path.matchAll(/@([^/]+)/g)];
    return versions.length > 0 && VERSION.test(versions.at(-1)[1]);
  }
  return false;
}

// Includes multiline static imports/re-exports and literal dynamic imports.
export function importSpecifiers(source) {
  const pattern = /(?:\b(?:import|export)\s+(?:(?![;]).)*?\bfrom\s*|\bimport\s*(?:\(\s*)?)["'`]([^"'`]+)["'`]/gs;
  return [...source.matchAll(pattern)].map((match) => ({
    spec: match[1],
    line: source.slice(0, match.index).split("\n").length,
  }));
}

export function findUnpinnedImports(source) {
  return importSpecifiers(source).filter(({ spec }) => EXTERNAL.test(spec) && !isPinned(spec));
}

export function validateImportMap(map) {
  if (!map || typeof map !== "object" || Array.isArray(map)) throw new Error("Invalid import map");
  const errors = [];
  for (const mappings of [map.imports ?? {}, ...Object.values(map.scopes ?? {})]) {
    if (!mappings || typeof mappings !== "object" || Array.isArray(mappings)) throw new Error("Invalid import mapping");
    for (const [key, spec] of Object.entries(mappings)) {
      if (typeof spec !== "string") throw new Error(`Invalid import mapping: ${key}`);
      if (EXTERNAL.test(spec) && !isPinned(spec)) errors.push({ key, spec });
    }
  }
  return errors;
}

async function collectFiles(dir) {
  const files = [];
  // Missing/unreadable function directories are failures, not silent success.
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(path));
    else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name === "deno.json")) files.push(path);
  }
  return files;
}

export async function checkEdgePins(root = ROOT) {
  const files = await collectFiles(join(root, "supabase/functions"));
  const errors = [];
  for (const file of files) {
    const source = await readFile(file, "utf8");
    const offenders = file.endsWith(".json") ? validateImportMap(JSON.parse(source)) : findUnpinnedImports(source);
    for (const offender of offenders) errors.push({ file: relative(root, file), ...offender });
  }
  return { files: files.length, errors };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { files, errors } = await checkEdgePins();
  for (const error of errors) console.error(`${error.file}:${error.line ?? error.key}: unpinned ${error.spec}`);
  console.log(`Edge pins: ${files} files checked; ${errors.length} unpinned imports.`);
  process.exitCode = errors.length ? 1 : 0;
}
