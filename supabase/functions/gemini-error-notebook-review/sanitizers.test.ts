/**
 * Testes de lógica pura extraída de gemini-error-notebook-review/index.ts
 *
 * Como rodar:
 *   deno test supabase/functions/gemini-error-notebook-review/sanitizers.test.ts
 *   ou, da raiz do projeto:
 *   deno test --allow-none supabase/functions/gemini-error-notebook-review/sanitizers.test.ts
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

function stripOpeningCompliments(text: string): string {
  const patterns: RegExp[] = [
    /^\s*(?:essa\s+(?:é|e)\s+(?:uma|a)?\s*)?(?:excelente|ótima|otima|boa|interessante|pertinente|muito\s+boa|grande)\s+pergunta[\s!.,:;…]+/i,
    /^\s*pergunta\s+(?:excelente|ótima|otima|boa|interessante|pertinente)[\s!.,:;…]+/i,
    /^\s*(?:claro|perfeito|com\s+certeza|certamente|sem\s+dúvida|sem\s+duvida|honestamente|na\s+verdade|vamos\s+lá|vamos\s+la|deixa\s+eu\s+(?:te\s+)?explicar)[\s!.,:;…]+/i,
    /^\s*(?:olá|ola|oi|opa|e\s+aí|e\s+ai|fala)[\s!.,:;…]+/i,
  ];
  let out = text;
  for (let i = 0; i < 4; i++) {
    let changed = false;
    for (const re of patterns) {
      const next = out.replace(re, "");
      if (next !== out) {
        out = next;
        changed = true;
      }
    }
    if (!changed) break;
  }
  if (out.length > 0 && /^[a-záéíóúâêôãõç]/.test(out)) {
    out = out[0].toUpperCase() + out.slice(1);
  }
  return out;
}

const REASON_LABELS: Record<string, string> = {
  errei: "errou a questão",
  sem_certeza: "acertou mas no chute",
  reading_error: "errou por desatenção/leitura",
  confused_alternatives: "confundiu com outra condição",
  conceito_fraco: "sente que o conceito está fraco",
  revisar_depois: "marcou pra revisar depois",
};

// ── Testes: stripEmDashes ──────────────────────────────────────────────────────

Deno.test("stripEmDashes [error-notebook] — em-dash cercado de espaços vira ponto", () => {
  const result = stripEmDashes("diagnóstico — conduta");
  assertEquals(result, "diagnóstico. conduta");
});

Deno.test("stripEmDashes [error-notebook] — en-dash solto vira vírgula", () => {
  const result = stripEmDashes("A–B");
  assertEquals(result, "A,B");
});

Deno.test("stripEmDashes [error-notebook] — texto limpo não muda", () => {
  const input = "O diagnóstico é insuficiência cardíaca congestiva.";
  assertEquals(stripEmDashes(input), input);
});

Deno.test("stripEmDashes [error-notebook] — múltiplos travessões no mesmo texto", () => {
  const input = "início — meio — fim";
  const result = stripEmDashes(input);
  assertEquals(result, "início. meio. fim");
});

// ── Testes: stripOpeningCompliments ──────────────────────────────────────────

Deno.test("stripOpeningCompliments — remove 'Excelente pergunta!'", () => {
  const input = "Excelente pergunta! O diagnóstico é X.";
  const result = stripOpeningCompliments(input);
  assertEquals(result, "O diagnóstico é X.");
});

Deno.test("stripOpeningCompliments — remove 'Ótima pergunta.'", () => {
  const input = "Ótima pergunta. O raciocínio aqui é...";
  const result = stripOpeningCompliments(input);
  assertStringIncludes(result, "O raciocínio aqui é");
});

Deno.test("stripOpeningCompliments — remove 'Claro!'", () => {
  const input = "Claro! Veja a alternativa correta.";
  const result = stripOpeningCompliments(input);
  assertEquals(result, "Veja a alternativa correta.");
});

Deno.test("stripOpeningCompliments — remove 'Olá,' case insensitive", () => {
  const input = "Olá, este é o gabarito.";
  const result = stripOpeningCompliments(input);
  assertEquals(result, "Este é o gabarito.");
});

Deno.test("stripOpeningCompliments — remove 'Perfeito!'", () => {
  const input = "Perfeito! O conceito que cobrou foi X.";
  const result = stripOpeningCompliments(input);
  assertEquals(result, "O conceito que cobrou foi X.");
});

Deno.test("stripOpeningCompliments — remove 'Oi,'", () => {
  const input = "Oi, vamos ver a questão.";
  const result = stripOpeningCompliments(input);
  assertStringIncludes(result, "vamos ver a questão");
});

Deno.test("stripOpeningCompliments — texto que não começa com elogio passa inalterado", () => {
  const input = "A alternativa correta é (B) porque...";
  const result = stripOpeningCompliments(input);
  assertEquals(result, input);
});

Deno.test("stripOpeningCompliments — elogios encadeados são removidos iterativamente", () => {
  // Dois elogios em sequência
  const input = "Claro! Ótima pergunta. O conceito é Y.";
  const result = stripOpeningCompliments(input);
  // Após primeira passagem remove "Claro! ", depois remove "Ótima pergunta. "
  assertStringIncludes(result, "O conceito é Y.");
});

Deno.test("stripOpeningCompliments — capitaliza primeira letra após remoção", () => {
  const input = "Excelente pergunta! o diagnóstico correto é Z.";
  const result = stripOpeningCompliments(input);
  // Deve capitalizar o 'o' que ficou exposto
  assertEquals(result.charAt(0), "O");
});

// ── Testes: REASON_LABELS ─────────────────────────────────────────────────────

Deno.test("REASON_LABELS — todos os 6 motivos conhecidos estão mapeados", () => {
  const expected = [
    "errei",
    "sem_certeza",
    "reading_error",
    "confused_alternatives",
    "conceito_fraco",
    "revisar_depois",
  ];
  for (const key of expected) {
    assertEquals(typeof REASON_LABELS[key], "string");
  }
});

Deno.test("REASON_LABELS — chave inexistente retorna undefined (fallback no código usa a chave bruta)", () => {
  assertEquals(REASON_LABELS["chave_inexistente"], undefined);
});

Deno.test("REASON_LABELS — 'errei' mapeia para descrição esperada", () => {
  assertEquals(REASON_LABELS["errei"], "errou a questão");
});

Deno.test("REASON_LABELS — 'sem_certeza' mapeia corretamente", () => {
  assertEquals(REASON_LABELS["sem_certeza"], "acertou mas no chute");
});
