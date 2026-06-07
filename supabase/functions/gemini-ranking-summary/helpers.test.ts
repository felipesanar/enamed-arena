/**
 * Testes de lógica pura extraída de gemini-ranking-summary/index.ts
 *
 * Como rodar:
 *   deno test supabase/functions/gemini-ranking-summary/helpers.test.ts
 *   ou, da raiz do projeto:
 *   deno test --allow-none supabase/functions/gemini-ranking-summary/helpers.test.ts
 *
 * Nenhum código de produção foi modificado. As funções abaixo são cópias
 * fiéis das helpers internas de index.ts para fins de teste isolado.
 */

import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

// ── Helpers duplicadas (cópia fiel de index.ts — NÃO altere o original) ───────

function stripEmDashes(text: string): string {
  return text
    .replace(/\s+[—–]\s+/g, ". ")
    .replace(/[—–]/g, ",")
    .replace(/\.[ \t]+\./g, ".")
    .replace(/[ \t]{2,}/g, " ");
}

/** Cálculos do ranking summary (lógica pura extraída do handler) */
function computeRankingMetrics(
  userScore: number,
  userPosition: number,
  totalCandidates: number,
  averageScore: number,
  top10Cutoff: number,
): { percentile: number; aheadOfAvg: number; gapToTop10: number } {
  const percentile =
    totalCandidates > 0
      ? Math.round(
          ((totalCandidates - userPosition + 1) / totalCandidates) * 100,
        )
      : 0;
  const aheadOfAvg = Math.round(userScore - averageScore);
  const gapToTop10 = Math.round(top10Cutoff - userScore);
  return { percentile, aheadOfAvg, gapToTop10 };
}

function buildApprovalLine(
  firstName: string,
  userScore: number,
  targetCutoffNumber: number | null,
): string {
  if (targetCutoffNumber == null) return "";
  const diff = Math.round(userScore - targetCutoffNumber);
  return diff >= 0
    ? `Hoje ${firstName} está **${diff} pontos ACIMA** do corte mais baixo das instituições-alvo (${targetCutoffNumber}%).`
    : `Hoje ${firstName} está **${Math.abs(diff)} pontos ABAIXO** do corte mais baixo das instituições-alvo (${targetCutoffNumber}%).`;
}

// ── Testes: stripEmDashes ──────────────────────────────────────────────────────

Deno.test("stripEmDashes — substitui em-dash cercado de espaços por ponto", () => {
  const input = "texto antes — texto depois";
  const result = stripEmDashes(input);
  assertEquals(result, "texto antes. texto depois");
});

Deno.test("stripEmDashes — substitui en-dash solto por vírgula", () => {
  const input = "texto–mais";
  const result = stripEmDashes(input);
  assertEquals(result, "texto,mais");
});

Deno.test("stripEmDashes — colapsa '. .' em '.'", () => {
  const input = "fim. . inicio";
  const result = stripEmDashes(input);
  assertEquals(result, "fim. inicio");
});

Deno.test("stripEmDashes — colapsa espaços múltiplos", () => {
  const input = "a  b   c";
  const result = stripEmDashes(input);
  assertEquals(result, "a b c");
});

Deno.test("stripEmDashes — texto sem travessão passa inalterado (exceto espaços)", () => {
  const input = "Texto normal sem travessão algum.";
  const result = stripEmDashes(input);
  assertEquals(result, "Texto normal sem travessão algum.");
});

Deno.test("stripEmDashes — múltiplos travessões no mesmo texto", () => {
  const input = "a — b — c";
  const result = stripEmDashes(input);
  // Cada " — " vira ". "
  assertEquals(result, "a. b. c");
});

// ── Testes: computeRankingMetrics ─────────────────────────────────────────────

Deno.test("computeRankingMetrics — percentil correto no topo (posição 1 de 100)", () => {
  const { percentile } = computeRankingMetrics(90, 1, 100, 60, 80);
  assertEquals(percentile, 100);
});

Deno.test("computeRankingMetrics — percentil correto na última posição", () => {
  const { percentile } = computeRankingMetrics(10, 100, 100, 60, 80);
  assertEquals(percentile, 1);
});

Deno.test("computeRankingMetrics — percentil zero quando totalCandidates é 0", () => {
  const { percentile } = computeRankingMetrics(50, 1, 0, 50, 70);
  assertEquals(percentile, 0);
});

Deno.test("computeRankingMetrics — aheadOfAvg positivo quando acima da média", () => {
  const { aheadOfAvg } = computeRankingMetrics(75, 10, 100, 60, 80);
  assertEquals(aheadOfAvg, 15);
});

Deno.test("computeRankingMetrics — aheadOfAvg negativo quando abaixo da média", () => {
  const { aheadOfAvg } = computeRankingMetrics(45, 80, 100, 60, 80);
  assertEquals(aheadOfAvg, -15);
});

Deno.test("computeRankingMetrics — gapToTop10 positivo quando abaixo do corte", () => {
  const { gapToTop10 } = computeRankingMetrics(65, 20, 100, 55, 80);
  assertEquals(gapToTop10, 15);
});

Deno.test("computeRankingMetrics — gapToTop10 negativo (já no top10)", () => {
  const { gapToTop10 } = computeRankingMetrics(85, 5, 100, 55, 80);
  assertEquals(gapToTop10, -5);
});

Deno.test("computeRankingMetrics — posição no meio do ranking (50 de 100 → percentil 51)", () => {
  const { percentile } = computeRankingMetrics(50, 50, 100, 50, 70);
  assertEquals(percentile, 51);
});

// ── Testes: buildApprovalLine ─────────────────────────────────────────────────

Deno.test("buildApprovalLine — retorna string vazia quando cutoff é null", () => {
  const result = buildApprovalLine("Ana", 65, null);
  assertEquals(result, "");
});

Deno.test("buildApprovalLine — mensagem ACIMA quando score > cutoff", () => {
  const result = buildApprovalLine("João", 70, 60);
  assertStringIncludes(result, "ACIMA");
  assertStringIncludes(result, "10 pontos");
  assertStringIncludes(result, "João");
});

Deno.test("buildApprovalLine — mensagem ABAIXO quando score < cutoff", () => {
  const result = buildApprovalLine("Maria", 45, 60);
  assertStringIncludes(result, "ABAIXO");
  assertStringIncludes(result, "15 pontos");
});

Deno.test("buildApprovalLine — diff exato zero resulta em ACIMA com 0 pontos", () => {
  const result = buildApprovalLine("Pedro", 60, 60);
  assertStringIncludes(result, "ACIMA");
  assertStringIncludes(result, "0 pontos");
});

Deno.test("buildApprovalLine — cutoff mencionado no texto", () => {
  const result = buildApprovalLine("Lara", 55, 50);
  assertStringIncludes(result, "50%");
});
