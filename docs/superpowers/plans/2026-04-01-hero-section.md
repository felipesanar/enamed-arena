# Hero Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `LandingHero.tsx` from scratch with Atmospheric Premium design — grid texture background, split layout, AI insight card with 3D tilt, floating metric chips, and social proof.

**Architecture:** Single-file rebuild of `src/components/landing/LandingHero.tsx`. All sub-elements (chips, card, stats bar) are inlined as JSX — no new files. `HeroAiInsight` component is removed. Framer Motion handles all entrance/hover/parallax animations. All data (scores, metrics, social proof numbers) is static/demo.

**Tech Stack:** React 18, TypeScript, Framer Motion 12, Tailwind CSS 3.4, shadcn/ui Button, React Router 6 Link, `@/lib/analytics` trackEvent, `@/lib/landingMotion` constants.

---

## File Map

| Action | Path | Purpose |
|--------|------|---------|
| **Modify** | `src/components/landing/LandingHero.tsx` | Full component rebuild |
| **Create** | `src/components/landing/LandingHero.test.tsx` | Render + behavior tests |

---

## Task 1: Test harness + section scaffold + background

**Files:**
- Create: `src/components/landing/LandingHero.test.tsx`
- Modify: `src/components/landing/LandingHero.tsx`

- [ ] **Step 1.1: Write failing tests**

Create `src/components/landing/LandingHero.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LandingHero } from "./LandingHero";

// Mock framer-motion so tests don't break on animation APIs
vi.mock("framer-motion", () => ({
  motion: new Proxy({}, {
    get: (_target, tag: string) =>
      ({ children, style: _s, initial: _i, animate: _a, whileHover: _wh, transition: _t, ...rest }) =>
        ({ div: <div {...rest}>{children}</div>, h1: <h1 {...rest}>{children}</h1>, p: <p {...rest}>{children}</p>, section: <section {...rest}>{children}</section> }[tag] ?? <div {...rest}>{children}</div>),
  }),
  useReducedMotion: () => false,
  useScroll: () => ({ scrollY: { get: () => 0 } }),
  useTransform: () => 0,
  AnimatePresence: ({ children }) => children,
}));

// Mock react-router-dom Link
vi.mock("react-router-dom", () => ({
  Link: ({ children, to, onClick, ...rest }) => (
    <a href={to} onClick={onClick} {...rest}>{children}</a>
  ),
}));

// Mock analytics
vi.mock("@/lib/analytics", () => ({
  trackEvent: vi.fn(),
}));

import { trackEvent } from "@/lib/analytics";

describe("LandingHero", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the hero section with id='hero'", () => {
    render(<LandingHero />);
    expect(document.getElementById("hero")).toBeTruthy();
  });

  it("renders the headline", () => {
    render(<LandingHero />);
    expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
  });

  it("renders the primary CTA linking to /login", () => {
    render(<LandingHero />);
    const link = screen.getByRole("link", { name: /próximo simulado/i });
    expect(link.getAttribute("href")).toBe("/login");
  });

  it("calls trackEvent when primary CTA is clicked", () => {
    render(<LandingHero />);
    const link = screen.getByRole("link", { name: /próximo simulado/i });
    fireEvent.click(link);
    expect(trackEvent).toHaveBeenCalledWith("lead_captured", { source: "landing_hero_primary" });
  });

  it("renders social proof text", () => {
    render(<LandingHero />);
    expect(screen.getByText(/18\.400 alunos/i)).toBeTruthy();
  });

  it("renders the AI insight card", () => {
    render(<LandingHero />);
    expect(screen.getByText(/Análise SanarFlix/i)).toBeTruthy();
    expect(screen.getByText(/Unifesp \+ 3/i)).toBeTruthy();
  });

  it("renders all three area scores", () => {
    render(<LandingHero />);
    expect(screen.getByText("82%")).toBeTruthy();
    expect(screen.getByText("68%")).toBeTruthy();
    expect(screen.getByText("54%")).toBeTruthy();
  });

  it("renders secondary CTA linking to #como-funciona", () => {
    render(<LandingHero />);
    const link = screen.getByRole("link", { name: /como funciona/i });
    expect(link.getAttribute("href")).toBe("#como-funciona");
  });
});
```

- [ ] **Step 1.2: Run tests — verify they all fail**

```bash
cd "/c/Users/Felipe Souza/Documents/enamed-arena" && npm run test -- --run LandingHero
```

Expected: 8 failures — `LandingHero` is not yet rebuilt.

- [ ] **Step 1.3: Replace LandingHero.tsx with new scaffold + background**

Overwrite `src/components/landing/LandingHero.tsx` entirely:

```tsx
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics";
import { EASE } from "@/lib/landingMotion";

/** Animation delays for staggered entrance */
const DELAY = {
  eyebrow: 0.05,
  headline: 0.15,
  subhead: 0.26,
  ctas: 0.36,
  social: 0.44,
  visual: 0.18,
  chipLeft: 0.5,
  chipRight: 0.6,
  stats: 0.65,
} as const;

export function LandingHero() {
  const prefersReducedMotion = useReducedMotion();

  /** Enable 3D hover only on real pointer devices ≥ lg */
  const [finePointerHoverDesktop, setFinePointerHoverDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px) and (hover: hover)");
    const sync = () => setFinePointerHoverDesktop(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const { scrollY } = useScroll();
  const visualY = useTransform(scrollY, [0, 400], [0, 60]);
  const visualOpacity = useTransform(scrollY, [0, 200], [1, 0.7]);

  /** Helper: entrance animation props, no-op when reduced motion is preferred */
  const entrance = (delay: number, yAmount = 20) =>
    prefersReducedMotion
      ? {}
      : {
          initial: { opacity: 0, y: yAmount },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.55, delay, ease: EASE },
        };

  return (
    <section
      id="hero"
      className="relative min-h-[100svh] flex flex-col justify-center overflow-x-hidden overflow-y-visible pb-16 pt-[max(env(safe-area-inset-top,0px),clamp(4rem,2.25vw+3rem,5.25rem))]"
    >
      {/* ── Background ── */}
      <div className="absolute inset-0 pointer-events-none -z-10 overflow-hidden" aria-hidden>
        {/* Base gradient */}
        <div className="absolute inset-0 bg-[linear-gradient(145deg,#07060d_0%,#0e0b1a_50%,#080511_100%)]" />

        {/* Grid texture — masked radially so it fades at edges */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: [
              "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)",
              "linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
            ].join(", "),
            backgroundSize: "36px 36px",
            maskImage:
              "radial-gradient(ellipse 85% 85% at 50% 50%, black 15%, transparent 75%)",
          }}
        />

        {/* Glow 1 — wine, top-left */}
        <motion.div
          className="absolute -top-20 -left-16 w-[420px] h-[420px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(176,48,80,0.22) 0%, transparent 60%)",
          }}
          animate={prefersReducedMotion ? {} : { x: [0, 30, 0], y: [0, -20, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Glow 2 — purple, bottom-right */}
        <motion.div
          className="absolute -bottom-28 right-[15%] w-[320px] h-[320px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(90,60,180,0.14) 0%, transparent 62%)",
          }}
          animate={prefersReducedMotion ? {} : { x: [0, -20, 0], y: [0, 25, 0] }}
          transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Glow 3 — wine subtle, top-right */}
        <div
          className="absolute top-[35%] right-[8%] w-[200px] h-[200px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(176,48,80,0.11) 0%, transparent 65%)",
          }}
        />
      </div>

      {/* ── Content grid (filled in next tasks) ── */}
      <div className="w-full max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-12 lg:gap-14 xl:gap-16 items-center">
          {/* Left column — Task 2 */}
          <div className="space-y-6 lg:space-y-7" />

          {/* Right column — Task 3 */}
          <div className="hidden lg:block" />
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 1.4: Run tests — verify scaffold tests pass**

```bash
npm run test -- --run LandingHero
```

Expected: `renders the hero section with id='hero'` passes. Others still fail — left/right columns not built yet.

- [ ] **Step 1.5: Commit scaffold**

```bash
git add src/components/landing/LandingHero.tsx src/components/landing/LandingHero.test.tsx
git commit -m "feat: hero section scaffold — background layers + test harness"
```

---

## Task 2: Left column (static, no animations yet)

**Files:**
- Modify: `src/components/landing/LandingHero.tsx` — fill left column div

- [ ] **Step 2.1: Replace the left column empty div**

In `LandingHero.tsx`, find the comment `{/* Left column — Task 2 */}` and replace the entire `<div className="space-y-6 lg:space-y-7" />` (self-closing) with:

```tsx
<div className="space-y-6 lg:space-y-7">
  {/* Eyebrow badge */}
  <div className="inline-flex items-center gap-2 self-start px-3 py-1.5 rounded-full border border-primary/[0.28] bg-primary/10 backdrop-blur-sm">
    <span
      className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_6px_hsl(var(--primary)/0.6)]"
      aria-hidden
    />
    <span className="text-overline uppercase tracking-[0.13em] text-primary/95">
      SanarFlix Simulados
    </span>
  </div>

  {/* Headline */}
  <h1 className="text-[3.2rem] sm:text-[3.5rem] lg:text-[3.2rem] xl:text-[3.6rem] font-extrabold leading-[1.05] tracking-[-0.04em] text-foreground max-w-[14ch]">
    Performance com{" "}
    <em className="not-italic bg-gradient-to-r from-[#d8405e] to-primary bg-clip-text text-transparent block mt-1 leading-[1.1] pb-0.5">
      precisão cirúrgica.
    </em>
  </h1>

  {/* Subhead */}
  <p className="text-body-lg text-muted-foreground max-w-[34ch] leading-relaxed">
    Análise por área, ranking em tempo real e IA que define exatamente
    o que revisar antes da próxima prova.
  </p>

  {/* CTA row */}
  <div className="flex items-center gap-4 flex-wrap">
    <Button
      size="lg"
      className="min-h-[52px] px-7 rounded-xl font-bold text-base bg-primary text-primary-foreground shadow-[0_6px_28px_hsl(var(--primary)/0.45),0_2px_8px_hsl(var(--primary)/0.25)] hover:bg-wine-hover hover:shadow-[0_10px_40px_hsl(var(--primary)/0.55)] hover:-translate-y-0.5 transition-all duration-300 active:translate-y-0"
      asChild
    >
      <Link
        to="/login"
        onClick={() => trackEvent("lead_captured", { source: "landing_hero_primary" })}
      >
        Entrar no próximo simulado →
      </Link>
    </Button>
    <a
      href="#como-funciona"
      className="text-body text-muted-foreground/60 font-medium border-b border-muted-foreground/20 hover:text-muted-foreground transition-colors duration-200 pb-px"
    >
      Ver como funciona
    </a>
  </div>

  {/* Social proof */}
  <div className="flex items-center gap-3">
    <div className="flex" aria-hidden>
      {[
        { bg: "bg-purple-700", initial: "A" },
        { bg: "bg-blue-700",   initial: "B" },
        { bg: "bg-primary",    initial: "C" },
        { bg: "bg-cyan-800",   initial: "D" },
        { bg: "bg-green-700",  initial: "E" },
      ].map((av, i) => (
        <span
          key={av.initial}
          className={cn(
            "w-6 h-6 rounded-full border-2 border-background flex items-center justify-center",
            "text-[0.5rem] font-bold text-white",
            av.bg,
            i > 0 && "-ml-1.5",
          )}
        >
          {av.initial}
        </span>
      ))}
    </div>
    <p className="text-body-sm text-muted-foreground/55">
      <strong className="text-muted-foreground/80 font-semibold">18.400 alunos</strong>{" "}
      em preparação agora
    </p>
  </div>
</div>
```

- [ ] **Step 2.2: Run tests**

```bash
npm run test -- --run LandingHero
```

Expected: `renders the headline`, `renders the primary CTA linking to /login`, `calls trackEvent when primary CTA is clicked`, `renders social proof text`, `renders secondary CTA linking to #como-funciona` — all pass. Remaining AI card tests still fail.

- [ ] **Step 2.3: Commit left column**

```bash
git add src/components/landing/LandingHero.tsx
git commit -m "feat: hero left column — eyebrow, headline, subhead, CTA, social proof"
```

---

## Task 3: Right column (static, no entrance animations yet)

**Files:**
- Modify: `src/components/landing/LandingHero.tsx` — fill right column div

- [ ] **Step 3.1: Replace the right column empty div**

Find the comment `{/* Right column — Task 3 */}` and replace `<div className="hidden lg:block" />` with:

```tsx
<div className="relative hidden lg:flex flex-col items-center gap-0">
  {/* Scene with horizontal room for floating chips */}
  <div className="w-full relative px-10">

    {/* Chip left — Evolução */}
    <div className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-card/[0.92] backdrop-blur-xl border border-white/10 rounded-[11px] p-2.5 shadow-[0_10px_32px_-4px_rgba(0,0,0,0.6)]">
      <p className="text-lg font-extrabold text-foreground leading-none">
        <span className="text-primary text-base" aria-hidden>▲</span> +12%
      </p>
      <p className="text-[0.5rem] text-muted-foreground/50 uppercase tracking-[0.1em] mt-0.5">
        Evolução
      </p>
    </div>

    {/* Chip right — Ranking */}
    <div className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-card/[0.92] backdrop-blur-xl border border-white/10 rounded-[11px] p-2.5 shadow-[0_10px_32px_-4px_rgba(0,0,0,0.6)]">
      <p className="text-lg font-extrabold text-foreground leading-none">
        <span className="text-primary text-base" aria-hidden>#</span>42
      </p>
      <p className="text-[0.5rem] text-muted-foreground/50 uppercase tracking-[0.1em] mt-0.5">
        Ranking
      </p>
    </div>

    {/* Main AI insight card */}
    <div style={{ perspective: "900px" }}>
      <motion.div
        initial={{ rotateX: 0, rotateY: 0 }}
        animate={{ rotateX: 2.5, rotateY: -2 }}
        transition={{ duration: 0.8, delay: DELAY.visual, ease: EASE }}
        whileHover={
          prefersReducedMotion || !finePointerHoverDesktop
            ? undefined
            : {
                rotateX: -1,
                rotateY: 1.5,
                transition: { type: "spring", stiffness: 300, damping: 35 },
              }
        }
        style={{ transformStyle: "preserve-3d" }}
        className="relative rounded-[20px] p-5 border border-primary/[0.32] bg-[linear-gradient(165deg,rgba(18,14,30,0.97)_0%,rgba(11,8,20,0.99)_100%)] shadow-[0_32px_80px_-16px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.08),0_0_0_1px_hsl(var(--primary)/0.08)]"
      >
        {/* Inner radial glow */}
        <div
          className="pointer-events-none absolute inset-0 rounded-[20px]"
          style={{
            background:
              "radial-gradient(ellipse 80% 55% at 50% -5%, hsl(var(--primary)/0.14) 0%, transparent 60%)",
          }}
          aria-hidden
        />

        <div className="relative z-[1]">
          {/* Card eyebrow */}
          <p className="text-overline uppercase tracking-[0.14em] text-primary flex items-center gap-1.5 mb-2">
            <span aria-hidden>✦</span> Análise SanarFlix
          </p>

          {/* Card headline + desc */}
          <p className="text-[1.2rem] font-extrabold text-foreground leading-[1.15] mb-1">
            Unifesp + 3 instituições
          </p>
          <p className="text-body-sm text-muted-foreground/55 leading-relaxed mb-4">
            você seria aprovado nestas instituições com o desempenho atual
          </p>

          <div className="h-px bg-white/[0.07] mb-3" />

          {/* Area breakdown grid */}
          <div className="grid grid-cols-3 gap-1.5 mb-3">
            {[
              { name: "Clínica Méd.", score: "82%", colorClass: "text-success" },
              { name: "Cirurgia",     score: "68%", colorClass: "text-warning" },
              { name: "Pediatria",    score: "54%", colorClass: "text-primary" },
            ].map((area) => (
              <div
                key={area.name}
                className="bg-white/[0.035] border border-white/[0.06] rounded-[9px] p-2"
              >
                <p className="text-[0.5rem] text-muted-foreground/50 uppercase tracking-[0.08em] mb-0.5">
                  {area.name}
                </p>
                <p className={cn("text-[0.9rem] font-extrabold leading-none", area.colorClass)}>
                  {area.score}
                </p>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div className="flex items-center gap-2">
            <span className="text-[0.52rem] text-muted-foreground/50 whitespace-nowrap shrink-0">
              Progresso geral
            </span>
            <div className="flex-1 h-1 bg-white/[0.06] rounded-full overflow-hidden">
              <div className="h-full w-[74%] bg-gradient-to-r from-primary to-[#d04070] rounded-full" />
            </div>
            <span className="text-[0.52rem] font-bold text-muted-foreground/70 shrink-0">74%</span>
          </div>
        </div>
      </motion.div>
    </div>
  </div>

  {/* Stats bar */}
  <div className="mt-4 w-full flex items-center justify-center bg-white/[0.025] border border-white/[0.06] rounded-xl px-4 py-3">
    {[
      { val: "4.200+", lbl: "aprovados" },
      { val: "18",     lbl: "provas no banco" },
      { val: "97%",    lbl: "satisfação" },
    ].map((stat, i) => (
      <div key={stat.lbl} className="flex items-center">
        {i > 0 && <div className="w-px h-7 bg-white/[0.07] mx-4" />}
        <div className="text-center">
          <p className="text-[1.05rem] font-extrabold text-foreground leading-none">{stat.val}</p>
          <p className="text-[0.52rem] text-muted-foreground/40 uppercase tracking-[0.08em] mt-0.5">
            {stat.lbl}
          </p>
        </div>
      </div>
    ))}
  </div>
</div>
```

- [ ] **Step 3.2: Run all tests**

```bash
npm run test -- --run LandingHero
```

Expected: all 8 tests pass.

- [ ] **Step 3.3: Visual check — start dev server**

```bash
npm run dev
```

Open `http://localhost:8080/landing`. Verify:
- Hero renders with dark background + grid texture visible
- Left column shows eyebrow, headline with gradient, subhead, CTA, social proof
- Right column shows card (tilted), chips, stats bar
- Mobile (< 1024px): right column hidden, left column full-width

- [ ] **Step 3.4: Commit right column**

```bash
git add src/components/landing/LandingHero.tsx
git commit -m "feat: hero right column — AI insight card, floating chips, stats bar"
```

---

## Task 4: Framer Motion — stagger entrances + parallax scroll

**Files:**
- Modify: `src/components/landing/LandingHero.tsx` — wrap elements with `motion.*` and add animation props

- [ ] **Step 4.1: Wrap left column elements with motion entrances**

Replace the static `<div className="space-y-6 lg:space-y-7">` wrapper and all its direct children with motion-wrapped versions. Replace the entire left column div (the one with `space-y-6 lg:space-y-7`) with:

```tsx
<div className="space-y-6 lg:space-y-7">
  {/* Eyebrow badge */}
  <motion.div {...entrance(DELAY.eyebrow)}>
    <div className="inline-flex items-center gap-2 self-start px-3 py-1.5 rounded-full border border-primary/[0.28] bg-primary/10 backdrop-blur-sm">
      <span
        className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_6px_hsl(var(--primary)/0.6)]"
        aria-hidden
      />
      <span className="text-overline uppercase tracking-[0.13em] text-primary/95">
        SanarFlix Simulados
      </span>
    </div>
  </motion.div>

  {/* Headline */}
  <motion.h1
    {...entrance(DELAY.headline, 32)}
    className="text-[3.2rem] sm:text-[3.5rem] lg:text-[3.2rem] xl:text-[3.6rem] font-extrabold leading-[1.05] tracking-[-0.04em] text-foreground max-w-[14ch]"
  >
    Performance com{" "}
    <em className="not-italic bg-gradient-to-r from-[#d8405e] to-primary bg-clip-text text-transparent block mt-1 leading-[1.1] pb-0.5">
      precisão cirúrgica.
    </em>
  </motion.h1>

  {/* Subhead */}
  <motion.p
    {...entrance(DELAY.subhead)}
    className="text-body-lg text-muted-foreground max-w-[34ch] leading-relaxed"
  >
    Análise por área, ranking em tempo real e IA que define exatamente
    o que revisar antes da próxima prova.
  </motion.p>

  {/* CTA row */}
  <motion.div {...entrance(DELAY.ctas)} className="flex items-center gap-4 flex-wrap">
    <Button
      size="lg"
      className="min-h-[52px] px-7 rounded-xl font-bold text-base bg-primary text-primary-foreground shadow-[0_6px_28px_hsl(var(--primary)/0.45),0_2px_8px_hsl(var(--primary)/0.25)] hover:bg-wine-hover hover:shadow-[0_10px_40px_hsl(var(--primary)/0.55)] hover:-translate-y-0.5 transition-all duration-300 active:translate-y-0"
      asChild
    >
      <Link
        to="/login"
        onClick={() => trackEvent("lead_captured", { source: "landing_hero_primary" })}
      >
        Entrar no próximo simulado →
      </Link>
    </Button>
    <a
      href="#como-funciona"
      className="text-body text-muted-foreground/60 font-medium border-b border-muted-foreground/20 hover:text-muted-foreground transition-colors duration-200 pb-px"
    >
      Ver como funciona
    </a>
  </motion.div>

  {/* Social proof */}
  <motion.div {...entrance(DELAY.social)} className="flex items-center gap-3">
    <div className="flex" aria-hidden>
      {[
        { bg: "bg-purple-700", initial: "A" },
        { bg: "bg-blue-700",   initial: "B" },
        { bg: "bg-primary",    initial: "C" },
        { bg: "bg-cyan-800",   initial: "D" },
        { bg: "bg-green-700",  initial: "E" },
      ].map((av, i) => (
        <span
          key={av.initial}
          className={cn(
            "w-6 h-6 rounded-full border-2 border-background flex items-center justify-center",
            "text-[0.5rem] font-bold text-white",
            av.bg,
            i > 0 && "-ml-1.5",
          )}
        >
          {av.initial}
        </span>
      ))}
    </div>
    <p className="text-body-sm text-muted-foreground/55">
      <strong className="text-muted-foreground/80 font-semibold">18.400 alunos</strong>{" "}
      em preparação agora
    </p>
  </motion.div>
</div>
```

- [ ] **Step 4.2: Wrap right column with parallax + animate chips and stats bar**

Replace the outer `<div className="relative hidden lg:flex ...">` (right column) with a motion wrapper that handles parallax scroll, and wrap the two chips + stats bar with their own motion elements:

```tsx
<motion.div
  style={prefersReducedMotion ? {} : { y: visualY, opacity: visualOpacity }}
  initial={prefersReducedMotion ? {} : { opacity: 0, scale: 0.97, y: 30 }}
  animate={prefersReducedMotion ? {} : { opacity: 1, scale: 1, y: 0 }}
  transition={{ duration: 0.8, delay: DELAY.visual, ease: EASE }}
  className="relative hidden lg:flex flex-col items-center gap-0"
>
  <div className="w-full relative px-10">

    {/* Chip left — Evolução */}
    <motion.div
      initial={prefersReducedMotion ? {} : { opacity: 0, x: -16 }}
      animate={prefersReducedMotion ? {} : { opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: DELAY.chipLeft, ease: EASE }}
      className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-card/[0.92] backdrop-blur-xl border border-white/10 rounded-[11px] p-2.5 shadow-[0_10px_32px_-4px_rgba(0,0,0,0.6)]"
    >
      <p className="text-lg font-extrabold text-foreground leading-none">
        <span className="text-primary text-base" aria-hidden>▲</span> +12%
      </p>
      <p className="text-[0.5rem] text-muted-foreground/50 uppercase tracking-[0.1em] mt-0.5">
        Evolução
      </p>
    </motion.div>

    {/* Chip right — Ranking */}
    <motion.div
      initial={prefersReducedMotion ? {} : { opacity: 0, x: 16 }}
      animate={prefersReducedMotion ? {} : { opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: DELAY.chipRight, ease: EASE }}
      className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-card/[0.92] backdrop-blur-xl border border-white/10 rounded-[11px] p-2.5 shadow-[0_10px_32px_-4px_rgba(0,0,0,0.6)]"
    >
      <p className="text-lg font-extrabold text-foreground leading-none">
        <span className="text-primary text-base" aria-hidden>#</span>42
      </p>
      <p className="text-[0.5rem] text-muted-foreground/50 uppercase tracking-[0.1em] mt-0.5">
        Ranking
      </p>
    </motion.div>

    {/* Main AI insight card — unchanged from Task 3 */}
    <div style={{ perspective: "900px" }}>
      <motion.div
        initial={{ rotateX: 0, rotateY: 0 }}
        animate={{ rotateX: 2.5, rotateY: -2 }}
        transition={{ duration: 0.8, delay: DELAY.visual, ease: EASE }}
        whileHover={
          prefersReducedMotion || !finePointerHoverDesktop
            ? undefined
            : {
                rotateX: -1,
                rotateY: 1.5,
                transition: { type: "spring", stiffness: 300, damping: 35 },
              }
        }
        style={{ transformStyle: "preserve-3d" }}
        className="relative rounded-[20px] p-5 border border-primary/[0.32] bg-[linear-gradient(165deg,rgba(18,14,30,0.97)_0%,rgba(11,8,20,0.99)_100%)] shadow-[0_32px_80px_-16px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.08),0_0_0_1px_hsl(var(--primary)/0.08)]"
      >
        <div
          className="pointer-events-none absolute inset-0 rounded-[20px]"
          style={{
            background:
              "radial-gradient(ellipse 80% 55% at 50% -5%, hsl(var(--primary)/0.14) 0%, transparent 60%)",
          }}
          aria-hidden
        />
        <div className="relative z-[1]">
          <p className="text-overline uppercase tracking-[0.14em] text-primary flex items-center gap-1.5 mb-2">
            <span aria-hidden>✦</span> Análise SanarFlix
          </p>
          <p className="text-[1.2rem] font-extrabold text-foreground leading-[1.15] mb-1">
            Unifesp + 3 instituições
          </p>
          <p className="text-body-sm text-muted-foreground/55 leading-relaxed mb-4">
            você seria aprovado nestas instituições com o desempenho atual
          </p>
          <div className="h-px bg-white/[0.07] mb-3" />
          <div className="grid grid-cols-3 gap-1.5 mb-3">
            {[
              { name: "Clínica Méd.", score: "82%", colorClass: "text-success" },
              { name: "Cirurgia",     score: "68%", colorClass: "text-warning" },
              { name: "Pediatria",    score: "54%", colorClass: "text-primary" },
            ].map((area) => (
              <div
                key={area.name}
                className="bg-white/[0.035] border border-white/[0.06] rounded-[9px] p-2"
              >
                <p className="text-[0.5rem] text-muted-foreground/50 uppercase tracking-[0.08em] mb-0.5">
                  {area.name}
                </p>
                <p className={cn("text-[0.9rem] font-extrabold leading-none", area.colorClass)}>
                  {area.score}
                </p>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[0.52rem] text-muted-foreground/50 whitespace-nowrap shrink-0">
              Progresso geral
            </span>
            <div className="flex-1 h-1 bg-white/[0.06] rounded-full overflow-hidden">
              <div className="h-full w-[74%] bg-gradient-to-r from-primary to-[#d04070] rounded-full" />
            </div>
            <span className="text-[0.52rem] font-bold text-muted-foreground/70 shrink-0">74%</span>
          </div>
        </div>
      </motion.div>
    </div>
  </div>

  {/* Stats bar */}
  <motion.div
    initial={prefersReducedMotion ? {} : { opacity: 0, y: 16 }}
    animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay: DELAY.stats, ease: EASE }}
    className="mt-4 w-full flex items-center justify-center bg-white/[0.025] border border-white/[0.06] rounded-xl px-4 py-3"
  >
    {[
      { val: "4.200+", lbl: "aprovados" },
      { val: "18",     lbl: "provas no banco" },
      { val: "97%",    lbl: "satisfação" },
    ].map((stat, i) => (
      <div key={stat.lbl} className="flex items-center">
        {i > 0 && <div className="w-px h-7 bg-white/[0.07] mx-4" />}
        <div className="text-center">
          <p className="text-[1.05rem] font-extrabold text-foreground leading-none">{stat.val}</p>
          <p className="text-[0.52rem] text-muted-foreground/40 uppercase tracking-[0.08em] mt-0.5">
            {stat.lbl}
          </p>
        </div>
      </div>
    ))}
  </motion.div>
</motion.div>
```

- [ ] **Step 4.3: Run all tests**

```bash
npm run test -- --run LandingHero
```

Expected: all 8 tests pass. The motion mock ensures Framer Motion animation props don't interfere with rendering.

- [ ] **Step 4.4: Visual check — animations in browser**

```bash
npm run dev
```

Open `http://localhost:8080/landing`. Verify:
- Left column elements stagger in from bottom on load
- Card settles from flat into the 3D tilt after ~0.2s
- Chips slide in from their respective sides (~0.5–0.6s)
- Stats bar fades in last (~0.65s)
- Scrolling down: right column drifts down (parallax) and fades slightly
- Hovering the card on desktop: smooth tilt response
- Reduced motion (devtools: `prefers-reduced-motion: reduce`): no animations, instant render

- [ ] **Step 4.5: Run lint**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 4.6: Final commit**

```bash
git add src/components/landing/LandingHero.tsx
git commit -m "feat: hero section complete — Atmospheric Premium with Framer Motion animations"
```

---

## Self-Review Checklist

| Spec section | Covered by task |
|---|---|
| 1. Layout grid `1.1fr 0.9fr` | Task 1 scaffold |
| 2. Grid texture + 3 glow layers | Task 1 |
| 3.1 Eyebrow badge | Task 2 |
| 3.2 Headline with gradient | Task 2 |
| 3.3 Subhead | Task 2 |
| 3.4 CTA row (primary + secondary) | Task 2 |
| 3.5 Social proof avatars + text | Task 2 |
| 4.1 Scene wrapper + parallax | Task 3 + 4 |
| 4.2 Floating chips (left + right) | Task 3 + 4 |
| 4.3 AI card (3D, eyebrow, headline, area grid, progress) | Task 3 |
| 4.4 Stats bar | Task 3 + 4 |
| 5. All entrance animations + `useReducedMotion` | Task 4 |
| 6. Mobile right col hidden, responsive headline | Task 3 (hidden lg:flex) + Task 2 (responsive text sizes) |
| 7. Existing tokens reused | Throughout |
| 8. `id="hero"`, `/login`, `trackEvent`, navbar untouched | Task 1 scaffold + Task 2 |
| 9. `HeroAiInsight` removed | Task 1 (not imported) |
