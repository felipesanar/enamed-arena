# Refino do Modo Escuro — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Elevar a qualidade, coesão, contraste e conforto visual do modo escuro nas superfícies do produto do aluno (app premium, prova, resultados/caderno), via refino da camada de tokens `.dark` + QA visual por superfície, sem tocar o modo claro.

**Architecture:** Token-first. A camada `.dark` em `src/index.css` é a fonte única da verdade: neutros levemente quentes (hue vinho ~345, saturação baixíssima), fundo ~9% L, escada de elevação perceptível, sistema de elevação nativo de dark (sombra real + rim de luz, já que sombra escura some no escuro), heros harmonizados para vinho-quente e feedback semântico re-tunado. Depois, QA visual por superfície corrige componentes que cravam cor e furam os tokens. Dois testes automáticos guardam o resultado: contraste WCAG dos tokens `.dark` e um guard de que `:root` (modo claro) ficou intocado.

**Tech Stack:** Vite + Tailwind 3.4, CSS custom properties (HSL), Vitest 3 (node/jsdom), next-themes (dark via classe `.dark`).

**Spec:** `docs/superpowers/specs/2026-06-06-dark-mode-refino-design.md`

---

## Convenções deste plano

- Todas as edições de token são no bloco `.dark { … }` de `src/index.css` (atualmente linhas ~148-247) e em utilitários `.dark *` no `@layer utilities`. **Nunca** editar `:root`, `.landing-dark` ou os blocos `@media print`.
- Os blocos de **auth** dentro de `.dark` (linhas ~234-246: `--auth-*`) **não** devem ser alterados — auth é sempre escuro e está fora de escopo. Preservar exatamente como estão.
- Valores HSL abaixo são o ponto de partida; ajuste fino é permitido no QA visual desde que os testes de contraste continuem verdes e a relação de elevação seja preservada.

---

## Task 1: Helper + teste de contraste WCAG dos tokens `.dark`

Cria a rede de segurança automática antes de mexer nos tokens. O teste lê o `.dark` do `src/index.css`, faz parse dos tokens `H S% L%` e assere contraste AA para os pares de cor que importam. Roda primeiro contra o CSS **atual** (deve passar — é um guard, não um red/green forçado).

**Files:**
- Create: `src/lib/contrast.ts`
- Create: `src/lib/contrast.test.ts`

- [ ] **Step 1: Escrever o helper de contraste**

Create `src/lib/contrast.ts`:

```typescript
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
```

- [ ] **Step 2: Escrever o teste de contraste**

Create `src/lib/contrast.test.ts`:

```typescript
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
  for (const [fg, bg, min] of PAIRS) {
    it(`${fg} sobre ${bg} >= ${min}:1`, () => {
      expect(tokens[fg], `token --${fg} ausente`).toBeDefined();
      expect(tokens[bg], `token --${bg} ausente`).toBeDefined();
      const ratio = contrastRatioHsl(tokens[fg], tokens[bg]);
      expect(ratio, `ratio=${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(min);
    });
  }
});
```

- [ ] **Step 3: Rodar o teste contra o CSS atual (baseline)**

Run: `npm run test -- src/lib/contrast.test.ts`
Expected: PASS (os tokens atuais já passam AA; estabelece a rede de segurança). Se algum par falhar agora, anotar — será corrigido na Task 2.

- [ ] **Step 4: Commit**

```bash
git add src/lib/contrast.ts src/lib/contrast.test.ts
git commit -m "test: add WCAG contrast guard for .dark tokens"
```

---

## Task 2: Reescrever a paleta `.dark` (neutros quentes + escada de elevação)

Substitui os neutros azuis (hue 220) por neutros levemente quentes (hue 345, saturação baixíssima), sobe o fundo para ~9% L e cria uma escada de elevação perceptível. Preserva os blocos `--auth-*` e `--exam-*`/`--hero-*` (tratados nas Tasks 3-4).

**Files:**
- Modify: `src/index.css` (bloco `.dark`, tokens de base/neutros/feedback — linhas ~148-200)
- Create: nada
- Test: `src/lib/contrast.test.ts` (já existe)

- [ ] **Step 1: Substituir os tokens de base e neutros no `.dark`**

Em `src/index.css`, no bloco `.dark`, substituir as linhas de **base/superfícies/neutros/primary/feedback** (de `--background` até `--info-foreground`, ~linhas 149-190) por:

```css
    /* Base surfaces — neutros levemente quentes (hue vinho, saturação baixíssima) */
    --background: 345 8% 9%;
    --foreground: 345 8% 92%;

    --card: 345 7% 13%;
    --card-foreground: 345 8% 92%;

    --popover: 345 7% 13%;
    --popover-foreground: 345 8% 92%;

    /* Brand wine — mantido próximo do atual (contraste do texto branco já validado) */
    --primary: 345 56% 50%;
    --primary-foreground: 0 0% 100%;

    --secondary: 345 7% 17%;
    --secondary-foreground: 345 8% 86%;

    --muted: 345 6% 18%;
    --muted-foreground: 345 7% 68%;

    --accent: 345 32% 18%;
    --accent-foreground: 345 55% 72%;

    /* Destructive: L alto + S moderado pra não competir com primary (rosa) */
    --destructive: 0 58% 52%;
    --destructive-foreground: 0 0% 100%;

    --border: 345 8% 24%;
    --input: 345 8% 20%;
    --ring: 345 56% 50%;

    /* Escada de elevação: sunken < background(9%) < card(13%) < elevated(17%) */
    --surface-elevated: 345 7% 17%;
    --surface-sunken: 345 8% 7%;

    /* Borda forte — divisores e realces sobre card/elevated */
    --border-strong: 345 8% 32%;

    /* Feedback semântico dark-tuned (luminoso, saturação confortável sobre base quente) */
    --success: 152 52% 50%;
    --success-foreground: 0 0% 100%;
    --warning: 38 86% 60%;
    --warning-foreground: 345 10% 10%;
    --info: 210 76% 64%;
    --info-foreground: 0 0% 100%;
```

> Nota: `--border-strong` é token novo (usado na Task 5 para divisores). `--auth-*` e tudo abaixo de `--info-foreground` permanece intocado nesta task.

- [ ] **Step 2: Re-tunar a sidebar dark para a família quente**

No mesmo bloco `.dark`, substituir os tokens `--sidebar-*` (atualmente hue 220, ~linhas 192-200) por:

```css
    --sidebar-background: 345 9% 7%;
    --sidebar-foreground: 345 7% 66%;
    --sidebar-primary: 345 56% 52%;
    --sidebar-primary-foreground: 0 0% 100%;
    --sidebar-accent: 345 8% 13%;
    --sidebar-accent-foreground: 345 8% 82%;
    --sidebar-border: 345 8% 14%;
    --sidebar-ring: 345 56% 52%;
    --sidebar-muted: 345 6% 38%;
```

- [ ] **Step 3: Rodar o teste de contraste**

Run: `npm run test -- src/lib/contrast.test.ts`
Expected: PASS para todos os pares. Se `muted-foreground sobre card` ou `primary-foreground sobre primary` falhar, ajustar a luminância do token (subir L do foreground / baixar L do primary) e repetir até verde.

- [ ] **Step 4: Build sanity**

Run: `npm run build`
Expected: build conclui sem erros.

- [ ] **Step 5: Commit**

```bash
git add src/index.css
git commit -m "feat(dark): warm neutral palette + elevation ladder"
```

---

## Task 3: Sistema de elevação nativo de dark (sombra real + rim de luz)

Sombra escura some no escuro. Substituir os tokens de sombra **dentro do `.dark`** por sombras pretas visíveis + rim de luz no topo dos cards, dando relevo premium.

**Files:**
- Modify: `src/index.css` (adicionar tokens de sombra ao `.dark`; adicionar overrides `.dark .premium-card*` no `@layer utilities`)
- Modify: `src/components/premium/SurfaceCard.tsx` (revisar sombra dark)

- [ ] **Step 1: Adicionar tokens de sombra dark ao bloco `.dark`**

Em `src/index.css`, dentro do bloco `.dark` (logo após os tokens de feedback, antes de `--sidebar-*`), adicionar:

```css
    /* Sombras dark — pretas visíveis (a sombra clara do light some no escuro) */
    --shadow-sm: 0 1px 2px 0 hsl(0 0% 0% / 0.4);
    --shadow-md: 0 4px 12px -2px hsl(0 0% 0% / 0.45), 0 2px 4px -2px hsl(0 0% 0% / 0.35);
    --shadow-lg: 0 12px 32px -4px hsl(0 0% 0% / 0.5), 0 4px 8px -2px hsl(0 0% 0% / 0.4);
    --shadow-premium: 0 10px 28px -6px hsl(0 0% 0% / 0.55), 0 0 0 1px hsl(0 0% 100% / 0.04);
```

- [ ] **Step 2: Adicionar rim de luz aos cards no dark**

Em `src/index.css`, no `@layer utilities`, logo após o bloco `.premium-card { … }` existente (e seus hovers), adicionar overrides dark-only:

```css
  /* Elevação dark: sombra real + rim de luz no topo (relevo premium) */
  .dark .premium-card {
    box-shadow: var(--shadow-md), inset 0 1px 0 0 hsl(0 0% 100% / 0.04);
  }
  .dark .premium-card:hover {
    box-shadow: var(--shadow-lg), inset 0 1px 0 0 hsl(0 0% 100% / 0.05);
  }
  .dark .premium-card-hero {
    box-shadow: var(--shadow-premium), inset 0 1px 0 0 hsl(0 0% 100% / 0.05);
  }
```

- [ ] **Step 3: Revisar a sombra dark do SurfaceCard**

Em `src/components/premium/SurfaceCard.tsx`, a sombra dark é cravada em classe (linhas 19 e 30). Atualizar `shadowBase` para incluir o rim de luz e profundidade maior, mantendo a classe light intocada:

Substituir a linha 19:

```typescript
const shadowBase =
  "shadow-[0_1px_2px_rgba(20,20,30,0.02),0_4px_12px_rgba(20,20,30,0.04)] dark:shadow-[0_4px_12px_-2px_rgba(0,0,0,0.45),0_2px_4px_-2px_rgba(0,0,0,0.35),inset_0_1px_0_0_rgba(255,255,255,0.04)]";
```

(O hover dark na linha 30 já tem `inset … rgba(255,255,255,0.04)` e profundidade — manter como está.)

- [ ] **Step 4: Build sanity**

Run: `npm run build`
Expected: build conclui sem erros.

- [ ] **Step 5: Commit**

```bash
git add src/index.css src/components/premium/SurfaceCard.tsx
git commit -m "feat(dark): native elevation system (shadow + light rim)"
```

---

## Task 4: Harmonizar gradientes hero para vinho-quente

Trocar os hex azul-marinho cravados (`#080A14`, `#0C1020`, `#1A0816`...) por gradiente quase-preto-vinho → borgonha, coeso com a marca.

**Files:**
- Modify: `src/index.css` (`--hero-premium-bg` no `.dark`; `.dark .hero-premium-surface`; `.dark .hero-status-card`)

- [ ] **Step 1: Atualizar o token `--hero-premium-bg` no `.dark`**

Em `src/index.css`, no bloco `.dark`, substituir a linha do `--hero-premium-bg` (atual ~linha 215) por:

```css
    --hero-premium-bg: linear-gradient(148deg, hsl(345 30% 9%) 0%, hsl(345 38% 12%) 38%, hsl(345 48% 17%) 72%, hsl(345 55% 21%) 100%);
```

- [ ] **Step 2: Atualizar `.dark .hero-premium-surface`**

Em `src/index.css`, no `@layer utilities`, substituir o bloco `.dark .hero-premium-surface { … }` (radiais com `rgba(...)` azuis) por:

```css
  .dark .hero-premium-surface {
    background:
      radial-gradient(ellipse 30% 44% at 0% 0%, hsl(345 45% 16% / 0.92) 0%, transparent 60%),
      radial-gradient(ellipse 24% 36% at 0% 100%, hsl(345 35% 9% / 0.85) 0%, transparent 55%),
      radial-gradient(ellipse 55% 48% at 100% 0%, hsl(345 60% 26% / 0.4) 0%, transparent 62%),
      linear-gradient(120deg, hsl(345 35% 8%) 0%, hsl(345 30% 9%) 18%, hsl(345 28% 10%) 42%, hsl(345 38% 13%) 72%, hsl(345 50% 18%) 100%);
  }
```

- [ ] **Step 3: Atualizar `.dark .hero-status-card`**

Em `src/index.css`, no `@layer utilities`, substituir o bloco `.dark .hero-status-card { … }` por:

```css
  .dark .hero-status-card {
    @apply border-white/[0.08];
    background:
      linear-gradient(148deg, hsl(345 32% 8%) 0%, hsl(345 30% 10%) 30%, hsl(345 42% 14%) 60%, hsl(345 52% 19%) 85%, hsl(345 58% 22%) 100%);
    box-shadow: 0 20px 40px -20px hsl(0 0% 0% / 0.9), 0 8px 20px -12px hsl(345 50% 12% / 0.5);
  }
```

- [ ] **Step 4: Build sanity**

Run: `npm run build`
Expected: build conclui sem erros.

- [ ] **Step 5: Commit**

```bash
git add src/index.css
git commit -m "feat(dark): harmonize hero gradients to warm wine"
```

---

## Task 5: Re-tunar feedback semântico de superfícies, trend e medalhas

Ajusta os fundos de badge/alert, indicadores de tendência e medalhas para o novo fundo quente, e atualiza o glow/dashboard-bg dark. (As cores sólidas `--success/warning/info/destructive` já foram tratadas na Task 2.)

**Files:**
- Modify: `src/index.css` (bloco `.dark`: `--trend-*`, `--medal-*`, `--*-surface`, e o `@layer utilities` `.dark .dashboard-page-bg` se necessário)

- [ ] **Step 1: Atualizar trend, medalhas e surfaces no `.dark`**

Em `src/index.css`, no bloco `.dark`, substituir os blocos `--trend-*`, `--medal-*` e `--*-surface` (atuais ~linhas 220-232) por:

```css
    /* Trend indicators (dark) */
    --trend-up: 152 58% 52%;
    --trend-down: 0 62% 58%;

    /* Medal colors (dark) — legíveis sobre card quente */
    --medal-gold: 38 82% 58%;
    --medal-silver: 345 8% 66%;
    --medal-bronze: 22 72% 60%;

    /* Success/warning/info surfaces (dark) — fundos translúcidos de badge/alert */
    --success-surface: 152 58% 52% / 0.1;
    --warning-surface: 38 82% 58% / 0.1;
    --info-surface: 210 76% 64% / 0.1;
```

- [ ] **Step 2: Confirmar o glow/dashboard no dark**

O `.dark .dashboard-page-bg` (em `@layer utilities`) usa `hsl(var(--primary) / …)` em radiais — como `--primary` permanece na família vinho, **não precisa mudar**. Apenas verificar visualmente na Task 6. Nenhuma edição neste step salvo regressão evidente.

- [ ] **Step 3: Rodar contraste + build**

Run: `npm run test -- src/lib/contrast.test.ts`
Expected: PASS.
Run: `npm run build`
Expected: build conclui sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/index.css
git commit -m "feat(dark): re-tune feedback surfaces, trend and medals"
```

---

## Task 6: QA visual — Home Premium

Subir o app e comparar antes/depois em dark, corrigindo componentes premium que cravam cor e furam os tokens.

**Files (candidatos — corrigir só os que destoarem no screenshot):**
- Modify: `src/components/premium/home/*.tsx` (HomePagePremium, HomeHeroSection, KpiCard, ActionCard, QuickActionCard, ResumeCard, RankingExpressCard, UpcomingSimulationCard, EvolutionBlock)
- Modify: `src/components/premium/sidebar/*.tsx`, `PremiumSidebar.tsx`, `MobileBottomNav.tsx`, `TopUtilityBar.tsx`, `NavItem.tsx`

- [ ] **Step 1: Subir o dev server**

Run (background): `npm run dev`
Expected: servidor em `http://localhost:8080`.

- [ ] **Step 2: Abrir a home em dark e capturar screenshot**

Usar as ferramentas de preview (`mcp__Claude_Preview__preview_start` apontando para `http://localhost:8080`, depois `preview_screenshot`). Garantir tema escuro: o app usa `next-themes` com classe `.dark` em `<html>`; se necessário, forçar via `preview_eval` → `document.documentElement.classList.add('dark')`. Autenticar se a rota exigir login (usar credenciais de dev disponíveis; se não houver, capturar o que estiver acessível e anotar).
Capturar: hero/status card, KPIs, cards de ação, ranking express, sidebar (desktop) e bottom nav (viewport mobile via `preview_resize` 390px).

- [ ] **Step 3: Identificar e corrigir cores cravadas que destoam**

Para cada componente acima, procurar `#hex`/`rgba()`/classes de cor fixas que não respondem ao tema (ex.: `bg-[#...]`, `text-white` sobre fundo claro, sombras claras cravadas). Regra de correção:
- Cor de superfície cravada → `bg-card` / `bg-secondary` / `surface-elevated`.
- Texto cravado → `text-foreground` / `text-muted-foreground`.
- Borda cravada → `border-border` / `border-strong` (via `style={{ borderColor: 'hsl(var(--border-strong))' }}` ou utilitário).
- Efeito dark-specific (glow/rim) → manter, mas com `hsl(var(--primary) / …)`.
Não alterar aparência no modo claro: se o valor cravado servia ao claro, condicionar com `dark:` em vez de substituir.

- [ ] **Step 4: Re-capturar screenshot e comparar**

Re-rodar `preview_screenshot` das mesmas vistas. Confirmar: cards com elevação legível (não "vazando"), texto secundário confortável, hero coeso com a marca, nenhuma cor azul-fria remanescente.

- [ ] **Step 5: Build + commit**

Run: `npm run build`
Expected: sem erros.

```bash
git add src/components/premium
git commit -m "fix(dark): QA visual home premium — tokens coesos"
```

---

## Task 7: QA visual — Prova (exam mode)

**Files (candidatos):**
- Modify: `src/pages/SimuladoExamPage.tsx`, `src/pages/SimuladoDetailPage.tsx`
- Modify: `src/components/exam/*.tsx` (componentes de enunciado, opções, header/timer)

- [ ] **Step 1: Abrir a tela de prova em dark e capturar screenshot**

Com o dev server no ar, navegar até uma prova (`preview` tools). Capturar: header + timer, enunciado, opções nos estados **default / hover / selecionado**, e o anel de foco (`:focus-visible`).

- [ ] **Step 2: Verificar os tokens `--exam-*` no `.dark`**

Os tokens `--exam-*` (em `.dark`, ~linhas 202-212) usam hue 220. Re-tunar para a família quente, mantendo a relação de contraste alta da tela de foco. Em `src/index.css`, no bloco `.dark`, substituir o grupo `--exam-*` por:

```css
    /* Exam focus mode (dark) — neutros quentes, alto contraste de leitura */
    --exam-bg: 345 8% 8%;
    --exam-surface: 345 7% 12%;
    --exam-surface-hover: 345 7% 15%;
    --exam-border: 345 8% 18%;
    --exam-border-selected: var(--primary);
    --exam-text: 345 8% 92%;
    --exam-text-secondary: 345 7% 62%;
    --exam-header-bg: 345 8% 9% / 0.92;
    --exam-option-selected-bg: 345 56% 50% / 0.08;
    --exam-shadow-selected: 0 2px 10px -2px hsl(345 56% 50% / 0.18);
```

> `--exam-text-secondary` sobe de 55% para 62% (conforto/contraste em texto longo).

- [ ] **Step 3: Corrigir cores cravadas nos componentes de exam**

Mesmo critério da Task 6, Step 3, aplicado aos componentes de `src/components/exam/`. Priorizar legibilidade do enunciado e distinção clara do estado **selecionado** (borda `--primary` + fundo `--exam-option-selected-bg`).

- [ ] **Step 4: Re-capturar e comparar**

Confirmar: enunciado confortável para leitura longa, opção selecionada inequívoca, foco visível, timer legível.

- [ ] **Step 5: Contraste + build + commit**

Run: `npm run test -- src/lib/contrast.test.ts` → PASS.
Run: `npm run build` → sem erros.

```bash
git add src/index.css src/pages/SimuladoExamPage.tsx src/pages/SimuladoDetailPage.tsx src/components/exam
git commit -m "fix(dark): QA visual prova — exam tokens quentes + legibilidade"
```

---

## Task 8: QA visual — Resultado, Correção e Caderno

**Files (candidatos):**
- Modify: `src/pages/ResultadoPage.tsx`, `src/pages/CorrecaoPage.tsx`
- Modify: `src/pages/CadernoErrosPage.tsx`, `src/pages/CadernoRevisaoPage.tsx`
- Modify: `src/components/desempenho/DesempenhoSimuladoPanel.tsx` e componentes de resultado/caderno usados por essas páginas

- [ ] **Step 1: Capturar screenshots em dark**

Com o dev server no ar, abrir Resultado, Correção, Caderno de Erros e Caderno de Revisão. Capturar as áreas densas: tabelas/listas de questões, badges de acerto/erro, gráficos de desempenho, cards de comparativo.

- [ ] **Step 2: Corrigir cores cravadas e validar badges semânticos**

Mesmo critério (Task 6, Step 3). Atenção especial:
- Badges "Acertou/Errou" usam `success`/`destructive` — confirmar distinção e contraste sobre `card`.
- Gráficos (Recharts) podem cravar cores — garantir que leem tokens (cores de série legíveis sobre `card` escuro).
- Divisores de tabela densos → usar `border` (sutil) ou `border-strong` conforme densidade.

- [ ] **Step 3: Re-capturar e comparar**

Confirmar: tabelas legíveis sem listras agressivas, badges distinguíveis, gráficos com contraste de série, comparativo coeso.

- [ ] **Step 4: Build + commit**

Run: `npm run build` → sem erros.

```bash
git add src/pages src/components/desempenho
git commit -m "fix(dark): QA visual resultado/correção/caderno"
```

---

## Task 9: Verificação final + guard do modo claro

Garante que o modo claro ficou 100% intocado e que tudo está verde, e monta a evidência visual.

**Files:**
- Create: `src/lib/light-mode-frozen.test.ts`

- [ ] **Step 1: Escrever guard de que `:root` (modo claro) não mudou**

O guard compara o conteúdo do bloco `:root { … }` com o do `main` (baseline). Como não dá pra ler git de dentro do teste de forma robusta, usar uma abordagem de snapshot do hash dos tokens light. Create `src/lib/light-mode-frozen.test.ts`:

```typescript
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
```

- [ ] **Step 2: Rodar o guard**

Run: `npm run test -- src/lib/light-mode-frozen.test.ts`
Expected: PASS. Se falhar, uma edição vazou para `:root` — reverter a alteração indevida.

- [ ] **Step 3: Suíte completa + lint + build**

Run: `npm run test`
Expected: toda a suíte PASS (incluindo os testes que mockam `useTheme` como light).
Run: `npm run lint`
Expected: sem novos erros.
Run: `npm run build`
Expected: build conclui sem erros.

- [ ] **Step 4: Conferir o diff contra `main` (modo claro intocado)**

Run: `git diff main -- src/index.css`
Expected: revisar que **nenhuma** linha dentro de `:root { … }`, `.landing-dark { … }` ou `@media print` foi alterada; só `.dark`, utilitários `.dark *` e o novo `--border-strong`/sombras dark.

- [ ] **Step 5: Montar evidência visual**

Reunir os screenshots antes/depois (dark) das 4 superfícies capturados nas Tasks 6-8. Anexar/listar na entrega.

- [ ] **Step 6: Commit final**

```bash
git add src/lib/light-mode-frozen.test.ts
git commit -m "test: guard light mode (:root) frozen"
```

---

## Self-Review (cobertura do spec)

- **Spec 4.1 (paleta neutros quentes + elevação):** Task 2. ✔
- **Spec 4.2 (elevação nativa de dark):** Task 3. ✔
- **Spec 4.3 (heros harmonizados):** Task 4. ✔
- **Spec 4.4 (feedback semântico):** sólidas na Task 2, surfaces/trend/medal na Task 5. ✔
- **Spec 4.5 (QA por superfície):** Tasks 6 (home), 7 (prova), 8 (resultado/correção/caderno). ✔
- **Spec 5 (garantias: claro congelado, AA, build/lint/test, evidência):** Task 1 + Task 9. ✔
- **Tipos/nomes consistentes:** `contrastRatioHsl`, `parseHslTokens`, `extractDarkBlock` definidos na Task 1 e reusados na Task 9; `--border-strong` introduzido na Task 2 e usado nas Tasks 7-8. ✔
- **Sem placeholders:** todos os steps de código têm o código completo. ✔
```
