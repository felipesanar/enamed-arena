import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseHslTokens } from "./contrast";

/**
 * Guard: o modo claro (:root) NÃO deve mudar neste trabalho.
 * Extrai o primeiro bloco `:root { … }` e confere os tokens-âncora do light.
 * Se este teste falhar, uma edição vazou para o modo claro — reverter.
 */
function extractRootBlock(css: string): string {
  const start = css.indexOf(":root {");
  if (start === -1) throw new Error("Bloco :root não encontrado");
  let depth = 0;
  for (let i = css.indexOf("{", start); i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") {
      depth--;
      if (depth === 0) return css.slice(start, i + 1);
    }
  }
  throw new Error("Bloco :root não fechado");
}

const css = readFileSync(resolve(__dirname, "../index.css"), "utf-8");
const root = parseHslTokens(extractRootBlock(css));

/** Âncoras do modo claro — valores originais que NÃO podem mudar. */
const LIGHT_ANCHORS: Array<[string, [number, number, number]]> = [
  ["background", [0, 0, 98.5]],
  ["foreground", [220, 20, 10]],
  ["card", [0, 0, 100]],
  ["primary", [345, 65, 30]],
  ["muted-foreground", [220, 10, 46]],
  ["border", [220, 12, 90]],
];

describe("modo claro congelado (:root)", () => {
  for (const [name, expected] of LIGHT_ANCHORS) {
    it(`--${name} permanece ${expected.join(" ")}`, () => {
      expect(root[name]).toEqual(expected);
    });
  }
});
