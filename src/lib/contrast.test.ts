import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { extractDarkBlock, parseHslTokens, contrastRatioHsl } from "./contrast";

const css = readFileSync(resolve(__dirname, "../index.css"), "utf-8");
const tokens = parseHslTokens(extractDarkBlock(css));

/** Pares [foregroundToken, backgroundToken, mínimo] que precisam passar no escuro. */
const PAIRS: Array<[string, string, number]> = [
  ["foreground", "background", 4.5],
  ["card-foreground", "card", 4.5],
  ["popover-foreground", "popover", 4.5],
  ["muted-foreground", "card", 4.5],
  ["muted-foreground", "background", 4.5],
  ["secondary-foreground", "secondary", 4.5],
  ["primary-foreground", "primary", 3.0], // botões: texto grande/bold
  ["destructive-foreground", "destructive", 3.0],
  ["accent-foreground", "accent", 4.5],
];

describe("contraste WCAG dos tokens .dark", () => {
  it("parseou o bloco escuro (não o print/light)", () => {
    expect(tokens.background, "token --background ausente").toBeDefined();
    expect(tokens.background[2], "background deve ser escuro (L<50)").toBeLessThan(50);
  });

  for (const [fg, bg, min] of PAIRS) {
    it(`${fg} sobre ${bg} >= ${min}:1`, () => {
      expect(tokens[fg], `token --${fg} ausente`).toBeDefined();
      expect(tokens[bg], `token --${bg} ausente`).toBeDefined();
      const ratio = contrastRatioHsl(tokens[fg], tokens[bg]);
      expect(ratio, `ratio=${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(min);
    });
  }
});
