#!/usr/bin/env node
/**
 * check-npm-audit.mjs
 *
 * Equivale a `npm audit --audit-level=high`, mas aceita exceções explícitas
 * listadas em `audit-allowlist.json` (uma por advisory GHSA, com motivo e
 * data de expiração).
 *
 * Regras:
 *  - Qualquer advisory high/critical que NÃO esteja na allowlist → falha.
 *  - Exceção vencida (`expires` no passado) → falha, mesmo que o advisory
 *    continue aberto. Obriga a reavaliar em vez de esquecer a exceção.
 *  - Exceção que não aparece mais no audit → só aviso (pode ser removida).
 *
 * Uso: node scripts/check-npm-audit.mjs
 * Saída: exit 0 se não há advisory high/critical fora da allowlist; exit 1 caso contrário.
 */
import { execSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const ALLOWLIST_FILE = join(ROOT, "audit-allowlist.json");
const BLOCKING = new Set(["high", "critical"]);

function runAudit() {
  try {
    return execSync("npm audit --json", { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  } catch (err) {
    // `npm audit` sai com código != 0 quando encontra vulnerabilidades; o JSON vem no stdout.
    if (err.stdout) return err.stdout;
    throw err;
  }
}

const audit = JSON.parse(runAudit());
if (audit.error) {
  console.error("❌ npm audit falhou:", audit.error.summary ?? audit.error);
  process.exit(1);
}

const allowlist = JSON.parse(await readFile(ALLOWLIST_FILE, "utf8")).exceptions ?? [];
const allowById = new Map(allowlist.map((e) => [e.id, e]));
const today = new Date().toISOString().slice(0, 10);

// Um advisory aparece uma vez por pacote afetado; agrupa por GHSA.
const advisories = new Map();
for (const vuln of Object.values(audit.vulnerabilities ?? {})) {
  for (const via of vuln.via) {
    if (typeof via !== "object" || !BLOCKING.has(via.severity)) continue;
    const id = via.url?.split("/").pop() ?? String(via.source);
    const entry = advisories.get(id) ?? { id, severity: via.severity, title: via.title, packages: new Set() };
    entry.packages.add(`${via.name}@${via.range}`);
    advisories.set(id, entry);
  }
}

const blocked = [];
const expired = [];
for (const adv of advisories.values()) {
  const exception = allowById.get(adv.id);
  if (!exception) blocked.push(adv);
  else if (exception.expires < today) expired.push({ adv, exception });
}

const stale = allowlist.filter((e) => !advisories.has(e.id));
for (const e of stale) {
  console.warn(`⚠️  Exceção ${e.id} (${e.package}) não aparece mais no audit — pode sair de audit-allowlist.json.`);
}

if (blocked.length || expired.length) {
  if (blocked.length) {
    console.error("\n❌ Vulnerabilidades high/critical sem exceção em audit-allowlist.json:\n");
    for (const a of blocked) {
      console.error(`  [${a.severity}] ${a.id} — ${a.title}`);
      console.error(`    → ${[...a.packages].join(", ")}`);
    }
  }
  if (expired.length) {
    console.error("\n❌ Exceções vencidas (reavaliar e atualizar ou remover):\n");
    for (const { adv, exception } of expired) {
      console.error(`  ${adv.id} (${exception.package}) venceu em ${exception.expires}`);
    }
  }
  console.error("\nCorrija com `npm audit fix` ou registre a exceção com motivo e prazo em audit-allowlist.json.\n");
  process.exit(1);
}

console.log(
  `✅ npm audit OK — nenhuma vulnerabilidade high/critical fora da allowlist (${advisories.size} advisory(s) com exceção registrada).`,
);
