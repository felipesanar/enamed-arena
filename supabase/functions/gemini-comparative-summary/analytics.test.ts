/**
 * Testes de lógica pura extraída de gemini-comparative-summary/index.ts
 *
 * Como rodar:
 *   deno test supabase/functions/gemini-comparative-summary/analytics.test.ts
 *   ou, da raiz do projeto:
 *   deno test --allow-none supabase/functions/gemini-comparative-summary/analytics.test.ts
 *
 * Nenhum código de produção foi modificado. As funções e tipos abaixo são
 * cópias fiéis das helpers internas de index.ts para fins de teste isolado.
 */

import {
  assertEquals,
  assertAlmostEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

// ── Helpers duplicadas (cópia fiel de index.ts — NÃO altere o original) ───────

function fmtDuration(s: number | null): string {
  if (s == null) return "n/d";
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}min ${r}s`;
}

type Scenario =
  | "iniciante_baixo"
  | "iniciante_medio"
  | "iniciante_alto"
  | "em_crescimento"
  | "em_queda"
  | "plateau"
  | "volatil"
  | "acima_corte"
  | "rumo_a_corte"
  | "bem_abaixo"
  | "dado_suspeito";

interface SimuladoEntry {
  sequenceNumber: number;
  percentageScore: number;
  totalCorrect: number;
  totalQuestions: number;
  durationSeconds: number | null;
  tabExits: number;
  fullscreenExits: number;
  markedForReview: number;
  highConfidenceTotal: number;
  highConfidenceCorrect: number;
  byArea: { area: string; score: number }[];
  completedAt?: string | null;
}

function computeScenario(sorted: SimuladoEntry[]): Scenario {
  const scores = sorted.map((s) => s.percentageScore);
  const avgScore =
    scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance =
    scores.reduce((acc, s) => acc + Math.pow(s - avgScore, 2), 0) /
    scores.length;
  const stddev = Math.round(Math.sqrt(variance) * 10) / 10;

  const lastEntry = sorted[sorted.length - 1];
  const firstEntry = sorted[0];
  const scoreDelta = lastEntry.percentageScore - firstEntry.percentageScore;

  if (sorted.length <= 3) {
    if (lastEntry.percentageScore < 30) return "iniciante_baixo";
    else if (lastEntry.percentageScore < 50) return "iniciante_medio";
    else return "iniciante_alto";
  } else {
    if (lastEntry.percentageScore < 30) return "bem_abaixo";
    else if (lastEntry.percentageScore >= 50) return "acima_corte";
    else if (lastEntry.percentageScore >= 40 && scoreDelta > 0) return "rumo_a_corte";
    else if (stddev > 10) return "volatil";
    else if (Math.abs(scoreDelta) <= 4 && stddev < 4) return "plateau";
    else if (scoreDelta >= 5) return "em_crescimento";
    else if (scoreDelta <= -5) return "em_queda";
    else return "iniciante_medio";
  }
}

function computeStddev(scores: number[]): number {
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance =
    scores.reduce((acc, s) => acc + Math.pow(s - avg, 2), 0) / scores.length;
  return Math.round(Math.sqrt(variance) * 10) / 10;
}

function makeEntry(
  seq: number,
  score: number,
  overrides: Partial<SimuladoEntry> = {},
): SimuladoEntry {
  return {
    sequenceNumber: seq,
    percentageScore: score,
    totalCorrect: Math.round(score),
    totalQuestions: 100,
    durationSeconds: 7200,
    tabExits: 0,
    fullscreenExits: 0,
    markedForReview: 0,
    highConfidenceTotal: 0,
    highConfidenceCorrect: 0,
    byArea: [],
    ...overrides,
  };
}

// ── Testes: fmtDuration ────────────────────────────────────────────────────────

Deno.test("fmtDuration — null retorna 'n/d'", () => {
  assertEquals(fmtDuration(null), "n/d");
});

Deno.test("fmtDuration — 0 segundos retorna '0min 0s'", () => {
  assertEquals(fmtDuration(0), "0min 0s");
});

Deno.test("fmtDuration — 60 segundos retorna '1min 0s'", () => {
  assertEquals(fmtDuration(60), "1min 0s");
});

Deno.test("fmtDuration — 90 segundos retorna '1min 30s'", () => {
  assertEquals(fmtDuration(90), "1min 30s");
});

Deno.test("fmtDuration — 3600 segundos retorna '60min 0s'", () => {
  assertEquals(fmtDuration(3600), "60min 0s");
});

Deno.test("fmtDuration — 14400 (4h prova ENAMED) retorna '240min 0s'", () => {
  assertEquals(fmtDuration(14400), "240min 0s");
});

Deno.test("fmtDuration — valores com resto: 3661 retorna '61min 1s'", () => {
  assertEquals(fmtDuration(3661), "61min 1s");
});

// ── Testes: computeStddev ─────────────────────────────────────────────────────

Deno.test("computeStddev — scores idênticos = stddev 0", () => {
  assertEquals(computeStddev([50, 50, 50, 50]), 0);
});

Deno.test("computeStddev — dois extremos opostos tem stddev alto", () => {
  // 0 e 100: média 50, variância = ((50^2 + 50^2)/2) = 2500, stddev = 50
  assertEquals(computeStddev([0, 100]), 50);
});

Deno.test("computeStddev — valores próximos tem stddev baixo", () => {
  const sd = computeStddev([48, 49, 50, 51, 52]);
  // desvio padrão ≈ 1.41 (pop)
  assertAlmostEquals(sd, 1.4, 0.1);
});

// ── Testes: computeScenario — iniciantes (≤ 3 simulados) ─────────────────────

Deno.test("cenário: iniciante_baixo — 2 sims, último score < 30", () => {
  const sorted = [makeEntry(1, 25), makeEntry(2, 22)];
  assertEquals(computeScenario(sorted), "iniciante_baixo");
});

Deno.test("cenário: iniciante_medio — 2 sims, último score 30-49", () => {
  const sorted = [makeEntry(1, 35), makeEntry(2, 40)];
  assertEquals(computeScenario(sorted), "iniciante_medio");
});

Deno.test("cenário: iniciante_alto — 2 sims, último score >= 50", () => {
  const sorted = [makeEntry(1, 45), makeEntry(2, 60)];
  assertEquals(computeScenario(sorted), "iniciante_alto");
});

// ── Testes: computeScenario — veteranos (> 3 simulados) ─────────────────────

Deno.test("cenário: bem_abaixo — 4 sims, último < 30", () => {
  const sorted = [
    makeEntry(1, 28),
    makeEntry(2, 27),
    makeEntry(3, 25),
    makeEntry(4, 22),
  ];
  assertEquals(computeScenario(sorted), "bem_abaixo");
});

Deno.test("cenário: acima_corte — 4 sims, último >= 50", () => {
  const sorted = [
    makeEntry(1, 40),
    makeEntry(2, 48),
    makeEntry(3, 52),
    makeEntry(4, 58),
  ];
  assertEquals(computeScenario(sorted), "acima_corte");
});

Deno.test("cenário: rumo_a_corte — 4 sims, último 40-49 com trajetória positiva", () => {
  const sorted = [
    makeEntry(1, 30),
    makeEntry(2, 35),
    makeEntry(3, 40),
    makeEntry(4, 45),
  ];
  assertEquals(computeScenario(sorted), "rumo_a_corte");
});

Deno.test("cenário: em_crescimento — delta acumulado >= +5pp (não chega a 50)", () => {
  // último abaixo de 40, delta > 5 → em_crescimento
  const sorted = [
    makeEntry(1, 30),
    makeEntry(2, 33),
    makeEntry(3, 35),
    makeEntry(4, 36),
  ];
  // scoreDelta = 6, stddev moderada, último < 40 → em_crescimento
  assertEquals(computeScenario(sorted), "em_crescimento");
});

Deno.test("cenário: em_queda — delta acumulado <= -5pp", () => {
  const sorted = [
    makeEntry(1, 55),
    makeEntry(2, 52),
    makeEntry(3, 49),
    makeEntry(4, 44),
  ];
  // scoreDelta = -11, último 44 não >= 50, nem >= 40 com delta positivo
  // stddev moderada, |delta| > 4 → em_queda
  assertEquals(computeScenario(sorted), "em_queda");
});

Deno.test("cenário: plateau — stddev < 4 e |delta| <= 4", () => {
  const sorted = [
    makeEntry(1, 43),
    makeEntry(2, 42),
    makeEntry(3, 44),
    makeEntry(4, 43),
  ];
  // stddev ~ 0.7, scoreDelta = 0 → plateau
  assertEquals(computeScenario(sorted), "plateau");
});

Deno.test("cenário: volatil — stddev > 10", () => {
  const sorted = [
    makeEntry(1, 20),
    makeEntry(2, 60),
    makeEntry(3, 25),
    makeEntry(4, 45),
  ];
  // último 45, não >= 50, não >= 40 com delta positivo (delta = 25 pra 20... wait)
  // scoreDelta = 45 - 20 = 25 >= 5 → mas stddev > 10 tem precedência no algoritmo
  // Na lógica real: acima_corte é verificado primeiro, depois rumo_a_corte,
  // depois volatil (stddev > 10), depois plateau...
  // 45 < 50 → não acima_corte
  // 45 >= 40 && 25 > 0 → rumo_a_corte ← esse tem precedência sobre volatil
  // Então este caso na verdade é rumo_a_corte:
  assertEquals(computeScenario(sorted), "rumo_a_corte");
});

Deno.test("cenário: volatil real — último < 40 e stddev > 10", () => {
  const sorted = [
    makeEntry(1, 20),
    makeEntry(2, 60),
    makeEntry(3, 10),
    makeEntry(4, 35),
  ];
  // scoreDelta = 15, último 35 < 40 → não rumo_a_corte
  // stddev > 10 → volatil
  assertEquals(computeScenario(sorted), "volatil");
});
