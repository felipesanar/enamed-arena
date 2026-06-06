/** Utilitários de contraste WCAG 2.1 para tokens HSL do design system. */

/** Converte HSL (h em graus, s/l em 0..100) para RGB (0..255). */
export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const sN = s / 100;
  const lN = l / 100;
  const c = (1 - Math.abs(2 * lN - 1)) * sN;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0, g = 0, b = 0;
  if (hp >= 0 && hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = lN - c / 2;
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

/** Luminância relativa WCAG de um RGB (0..255). */
export function relativeLuminance([r, g, b]: [number, number, number]): number {
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Razão de contraste WCAG entre dois HSL. >= 4.5 (texto normal), >= 3 (texto grande). */
export function contrastRatioHsl(
  fg: [number, number, number],
  bg: [number, number, number]
): number {
  const l1 = relativeLuminance(hslToRgb(...fg));
  const l2 = relativeLuminance(hslToRgb(...bg));
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

/** Extrai o bloco `.dark { … }` (primeiro match) de um CSS. */
export function extractDarkBlock(css: string): string {
  const start = css.indexOf(".dark {");
  if (start === -1) throw new Error("Bloco .dark não encontrado");
  let depth = 0;
  for (let i = css.indexOf("{", start); i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") {
      depth--;
      if (depth === 0) return css.slice(start, i + 1);
    }
  }
  throw new Error("Bloco .dark não fechado");
}

/** Faz parse de tokens `--name: H S% L%;` (ignora valores com `/`, `var()`, gradientes). */
export function parseHslTokens(block: string): Record<string, [number, number, number]> {
  const out: Record<string, [number, number, number]> = {};
  const re = /--([\w-]+):\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*;/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block)) !== null) {
    out[m[1]] = [parseFloat(m[2]), parseFloat(m[3]), parseFloat(m[4])];
  }
  return out;
}
