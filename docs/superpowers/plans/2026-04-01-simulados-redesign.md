# Simulados Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the `/simulados` page UI to a premium dark/light hybrid layout with a hero card, vertical timeline, and redesigned "Como funciona" card — without changing any data, hooks, routes, or logic.

**Architecture:** `SimuladosPage.tsx` is rewritten in-place; all new sub-components (`HeroCard`, `TimelineItem`, `HowItWorksCard`) live inline in the same file. No new files are created. No changes to `SimuladoCard.tsx`, `useSimulados`, or any service/type.

**Tech Stack:** React 18, TypeScript, Framer Motion 12, Tailwind CSS 3.4, Lucide React, date-fns

---

## File Structure

| File | Change |
|------|--------|
| `src/pages/SimuladosPage.tsx` | Full rewrite of UI. Keeps same hook calls (`useSimulados`, `useReducedMotion`). Adds inline sub-components: `HowItWorksCard`, `HeroCard`, `TimelineSection`, `TimelineItem`, `CountdownBlock`. |

No other files are created or modified.

---

### Task 1: Add CSS keyframes for pulsing dots

The spec requires `@keyframes pulse` for pulsing dots on `in_progress` / `available` hero card and timeline nodes. This needs to be global CSS since Tailwind doesn't ship arbitrary keyframes.

**Files:**
- Modify: `src/index.css` (or global stylesheet — check what exists)

- [ ] **Step 1: Find the global CSS file**

Run:
```bash
ls src/*.css
```
Expected output: `src/index.css` (or similar). Note the filename.

- [ ] **Step 2: Add keyframes to the global CSS**

Open `src/index.css` and add the following block at the end (before any closing tags if it's a Tailwind file — just append after the last `@layer` block):

```css
/* Pulsing dot for live/active simulados */
@keyframes sim-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.5; transform: scale(0.85); }
}
.sim-dot-pulse {
  animation: sim-pulse 1.8s ease-in-out infinite;
}
```

- [ ] **Step 3: Verify dev server compiles without errors**

Run:
```bash
npm run dev
```
Expected: dev server starts, no CSS compilation errors in terminal.

- [ ] **Step 4: Commit**

```bash
git add src/index.css
git commit -m "style: add sim-pulse keyframe for live simulado dots"
```

---

### Task 2: Rewrite SimuladosPage — skeleton layout + hooks

Replace the current file content. Build only the outer shell with correct hook calls, loading state skeleton, and error state. Sub-component implementations come in later tasks.

**Files:**
- Modify: `src/pages/SimuladosPage.tsx`

- [ ] **Step 1: Replace file with new skeleton**

Paste the full content below into `src/pages/SimuladosPage.tsx`:

```tsx
import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Info, Play, Lock, CheckCircle2, Clock, Coffee, Calendar,
  ChevronDown, ArrowRight,
} from "lucide-react";
import { Link } from "react-router-dom";
import { format, formatDistanceToNowStrict, intervalToDuration, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { useSimulados } from "@/hooks/useSimulados";
import type { SimuladoWithStatus } from "@/types";

// ─── Loading skeleton ───────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Hero skeleton */}
      <div className="h-[220px] rounded-[24px] bg-muted/40" />
      {/* Timeline skeletons */}
      {[1, 2, 3].map(i => (
        <div key={i} className="h-[80px] rounded-xl bg-muted/30 ml-8" />
      ))}
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function SimuladosPage() {
  const prefersReducedMotion = useReducedMotion();
  const { simulados, loading, error, refetch } = useSimulados();

  // Hero: first active (available or in_progress), else first upcoming
  const heroSimulado = useMemo(() => {
    const active = simulados.find(s => s.status === "available" || s.status === "in_progress");
    if (active) return active;
    const upcoming = simulados
      .filter(s => s.status === "upcoming")
      .sort((a, b) => Date.parse(a.executionWindowStart) - Date.parse(b.executionWindowStart));
    return upcoming[0] ?? null;
  }, [simulados]);

  // Timeline: everything except the hero; ordered by spec
  const timelineItems = useMemo(() => {
    const heroId = heroSimulado?.id;
    const finished = simulados
      .filter(s =>
        (s.status === "closed_waiting" || s.status === "completed" || s.status === "available_late") &&
        s.id !== heroId
      )
      .sort((a, b) => Date.parse(b.executionWindowStart) - Date.parse(a.executionWindowStart));
    const upcomingRest = simulados
      .filter(s => s.status === "upcoming" && s.id !== heroId)
      .sort((a, b) => Date.parse(a.executionWindowStart) - Date.parse(b.executionWindowStart));
    return [...finished, ...upcomingRest];
  }, [simulados, heroSimulado]);

  if (loading) {
    return (
      <>
        <PageHeader title="Simulados" badge="ENAMED 2026" />
        <LoadingSkeleton />
      </>
    );
  }

  if (error) {
    return (
      <>
        <PageHeader title="Simulados" badge="ENAMED 2026" />
        <EmptyState
          variant="error"
          title="Não foi possível carregar os simulados"
          description={error}
          onRetry={() => refetch()}
          backHref="/"
          backLabel="Voltar ao início"
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Simulados"
        subtitle="100 questões inéditas no modelo ENAMED, elaboradas pelos professores do SanarFlix PRO."
        badge="ENAMED 2026"
      />

      {/* How it works */}
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.4, delay: prefersReducedMotion ? 0 : 0.05 }}
        className="mb-6"
      >
        <HowItWorksCard />
      </motion.div>

      {/* Hero card */}
      {heroSimulado ? (
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.5 }}
          className="mb-8"
        >
          <HeroCard sim={heroSimulado} />
        </motion.div>
      ) : (
        simulados.length === 0 && (
          <EmptyState
            title="Nenhum simulado disponível no momento"
            description="Fique de olho, em breve novos simulados serão publicados!"
            backHref="/"
            backLabel="Voltar ao início"
          />
        )
      )}

      {/* Timeline */}
      {timelineItems.length > 0 && (
        <TimelineSection items={timelineItems} reduced={!!prefersReducedMotion} />
      )}
    </>
  );
}

// ─── Sub-components (stubs — implemented in next tasks) ──────────────────────

function HowItWorksCard() {
  return <div className="h-20 rounded-xl bg-muted/20 flex items-center justify-center text-muted-foreground text-sm">HowItWorksCard — TODO</div>;
}

function HeroCard({ sim }: { sim: SimuladoWithStatus }) {
  return <div className="h-[220px] rounded-[24px] bg-muted/20 flex items-center justify-center text-muted-foreground text-sm">HeroCard — TODO: {sim.title}</div>;
}

function TimelineSection({ items, reduced }: { items: SimuladoWithStatus[]; reduced: boolean }) {
  return <div className="text-muted-foreground text-sm">TimelineSection — TODO: {items.length} items</div>;
}

function TimelineItem({ sim, index, reduced }: { sim: SimuladoWithStatus; index: number; reduced: boolean }) {
  return null;
}

function CountdownBlock({ label, value }: { label: string; value: string }) {
  return null;
}
```

- [ ] **Step 2: Verify dev server compiles and page renders with stubs**

Run: `npm run dev` and open `http://localhost:8080/simulados`.
Expected: page loads, shows "HowItWorksCard — TODO", "HeroCard — TODO", no console errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/SimuladosPage.tsx
git commit -m "refactor(simulados): scaffold new page shell with stub sub-components"
```

---

### Task 3: Implement `HowItWorksCard`

Replace the `HowItWorksCard` stub with the full premium implementation: white card, wine top-border gradient, info icon box, pills.

**Files:**
- Modify: `src/pages/SimuladosPage.tsx`

- [ ] **Step 1: Replace the `HowItWorksCard` stub**

Find and replace the entire `function HowItWorksCard()` function with:

```tsx
function HowItWorksCard() {
  return (
    <div
      className="relative rounded-xl bg-white overflow-hidden"
      style={{
        boxShadow: "0 2px 12px rgba(142,31,61,.08), 0 1px 3px rgba(142,31,61,.06)",
      }}
    >
      {/* Wine top border */}
      <div
        className="absolute inset-x-0 top-0 h-[2px]"
        style={{ background: "linear-gradient(90deg, #8e1f3d 0%, transparent 100%)" }}
      />
      <div className="p-4 md:p-5">
        <div className="flex items-start gap-3">
          {/* Icon box */}
          <div
            className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center mt-0.5"
            style={{
              background: "rgba(142,31,61,.12)",
              border: "1px solid rgba(142,31,61,.18)",
            }}
          >
            <Info className="w-4 h-4" style={{ color: "#8e1f3d" }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm text-foreground mb-1">Como funciona</p>
            <p className="text-xs text-muted-foreground leading-relaxed mb-3">
              Cada simulado tem uma janela oficial para participar do ranking nacional. Depois dela, o mesmo simulado continua disponível com a mesma experiência e correção — ideal para se preparar com referência (nessa modalidade a realização não entra no ranking). Resultado, gabarito e ranking da prova são liberados após o encerramento.
            </p>
            {/* Pills */}
            <div className="flex flex-wrap gap-1.5">
              {[
                "Não é possível pausar",
                "Resultado liberado após a janela",
                "Ranking disponível após encerramento",
              ].map(pill => (
                <span
                  key={pill}
                  className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                  style={{
                    background: "rgba(142,31,61,.08)",
                    color: "#8e1f3d",
                    border: "1px solid rgba(142,31,61,.14)",
                  }}
                >
                  {pill}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify visually**

Open `http://localhost:8080/simulados`. Confirm:
- White card with visible wine top gradient
- Info icon in a soft wine-tinted box
- Three pills at the bottom, wrapping on mobile

- [ ] **Step 3: Commit**

```bash
git add src/pages/SimuladosPage.tsx
git commit -m "feat(simulados): implement HowItWorksCard with wine accent and pills"
```

---

### Task 4: Implement `HeroCard` — State 1 (available / in_progress)

Build the dark premium hero card for the active window state.

**Files:**
- Modify: `src/pages/SimuladosPage.tsx`

- [ ] **Step 1: Add a deadline ticker helper above `HeroCard`**

Insert this function immediately above `function HeroCard`:

```tsx
function formatDeadlineTicker(windowEnd: string): string {
  const end = parseISO(windowEnd);
  const dur = intervalToDuration({ start: new Date(), end });
  const days = Math.floor((end.getTime() - Date.now()) / 86_400_000);
  const hours = dur.hours ?? 0;
  if (days > 0) return `Janela fecha em ${days} dia${days > 1 ? "s" : ""} e ${hours}h`;
  if (hours > 0) return `Janela fecha em ${hours}h${dur.minutes ? ` e ${dur.minutes}min` : ""}`;
  return `Janela fecha em breve`;
}
```

- [ ] **Step 2: Replace the `HeroCard` stub**

Replace the entire `function HeroCard` stub with:

```tsx
function HeroCard({ sim }: { sim: SimuladoWithStatus }) {
  const isActive = sim.status === "available" || sim.status === "in_progress";
  const isUpcoming = sim.status === "upcoming";

  if (isActive) return <HeroCardActive sim={sim} />;
  if (isUpcoming) return <HeroCardUpcoming sim={sim} />;
  return null;
}

function HeroCardActive({ sim }: { sim: SimuladoWithStatus }) {
  const ctaHref = sim.userState?.started && !sim.userState.finished
    ? `/simulados/${sim.slug}/prova`
    : `/simulados/${sim.slug}/start`;
  const ctaLabel = sim.userState?.started && !sim.userState.finished
    ? "Continuar Simulado"
    : "Iniciar Simulado";

  return (
    <div
      className="relative w-full rounded-[24px] overflow-hidden p-5 md:p-6"
      style={{
        background: "linear-gradient(142deg, #5a1530 0%, #2e0c1e 55%, #160610 100%)",
        border: "1px solid rgba(232,56,98,.28)",
      }}
    >
      {/* White top thread */}
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,.12) 40%, transparent)" }}
      />
      {/* Glow 1 — top-left radial */}
      <div
        className="pointer-events-none absolute -top-12 -left-12 w-64 h-64 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(232,56,98,.2) 0%, transparent 70%)" }}
      />
      {/* Glow 2 — bottom-right radial */}
      <div
        className="pointer-events-none absolute -bottom-16 -right-8 w-72 h-72 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(142,31,61,.18) 0%, transparent 65%)" }}
      />
      {/* Lateral overlay */}
      <div
        className="pointer-events-none absolute inset-y-0 right-0 w-1/2"
        style={{ background: "radial-gradient(ellipse at right, rgba(90,21,48,.4) 0%, transparent 70%)" }}
      />

      {/* Content */}
      <div className="relative z-10">
        {/* Top row: status badge + sequence badge */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span
              className="sim-dot-pulse w-2 h-2 rounded-full"
              style={{ background: "#e83862" }}
            />
            <span className="text-xs font-semibold uppercase tracking-wider text-white/80">
              {sim.status === "in_progress" ? "Em andamento" : "Janela aberta"}
            </span>
          </div>
          <span
            className="text-xs font-bold px-2.5 py-1 rounded-lg"
            style={{
              background: "rgba(255,255,255,.08)",
              border: "1px solid rgba(255,255,255,.12)",
              color: "rgba(255,255,255,.7)",
            }}
          >
            #{sim.sequenceNumber}
          </span>
        </div>

        {/* Title */}
        <h2 className="font-bold text-white mb-3" style={{ fontSize: "clamp(18px, 3.5vw, 22px)" }}>
          {sim.title}
        </h2>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-3 mb-5 text-white/60 text-xs">
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            {format(parseISO(sim.executionWindowStart), "dd/MM", { locale: ptBR })}
            {" – "}
            {format(parseISO(sim.executionWindowEnd), "dd/MM", { locale: ptBR })}
          </span>
          <span className="flex items-center gap-1.5">
            {sim.questionsCount} questões
          </span>
        </div>

        {/* Deadline ticker */}
        <div
          className="flex items-center gap-2 rounded-lg px-3 py-2 mb-5 text-xs font-medium"
          style={{
            background: "rgba(232,56,98,.1)",
            border: "1px solid rgba(232,56,98,.18)",
            color: "rgba(255,255,255,.75)",
          }}
        >
          <Clock className="w-3.5 h-3.5 shrink-0 text-[#e83862]" />
          {formatDeadlineTicker(sim.executionWindowEnd)} — realize agora para entrar no ranking
        </div>

        {/* CTAs */}
        <div className="flex flex-wrap gap-2">
          <Link
            to={ctaHref}
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
            style={{
              background: "#e83862",
              color: "#fff",
            }}
          >
            <Play className="w-4 h-4" />
            {ctaLabel}
          </Link>
          <button
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-opacity hover:opacity-80"
            style={{
              background: "rgba(255,255,255,.08)",
              border: "1px solid rgba(255,255,255,.12)",
              color: "rgba(255,255,255,.75)",
            }}
            onClick={() => {
              document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            Como funciona
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify visually**

Open `/simulados`. If there is an active simulado:
- Dark card with gradient background visible
- Pulsing wine dot in status badge
- Deadline ticker row with red-tinted background
- Two CTA buttons visible

If no active simulado, the card should not appear (upcoming hero comes in Task 5).

- [ ] **Step 4: Commit**

```bash
git add src/pages/SimuladosPage.tsx
git commit -m "feat(simulados): implement HeroCard active state (available/in_progress)"
```

---

### Task 5: Implement `HeroCard` — State 2 (upcoming) with countdown

Build the dimmer upcoming hero with countdown blocks.

**Files:**
- Modify: `src/pages/SimuladosPage.tsx`

- [ ] **Step 1: Add countdown helpers above `HeroCardUpcoming`**

Insert immediately after `formatDeadlineTicker`:

```tsx
function useCountdown(targetISO: string) {
  const [now, setNow] = useState(new Date());
  // Update every minute (no need for per-second precision)
  useMemo(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  const target = parseISO(targetISO);
  const diff = Math.max(0, target.getTime() - now.getTime());
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  return { days, hours, mins };
}
```

Note: `useState` and `useMemo` are already imported at the top of the file.

- [ ] **Step 2: Implement `CountdownBlock`**

Replace the `CountdownBlock` stub with:

```tsx
function CountdownBlock({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex flex-col items-center min-w-[52px] rounded-lg px-3 py-2"
      style={{
        background: "rgba(255,255,255,.06)",
        border: "1px solid rgba(255,255,255,.08)",
      }}
    >
      <span className="text-xl font-bold text-white tabular-nums leading-none">{value}</span>
      <span className="text-[10px] font-medium uppercase tracking-wider text-white/40 mt-1">{label}</span>
    </div>
  );
}
```

- [ ] **Step 3: Add `HeroCardUpcoming` function**

Insert immediately after `HeroCardActive`:

```tsx
function HeroCardUpcoming({ sim }: { sim: SimuladoWithStatus }) {
  const { days, hours, mins } = useCountdown(sim.executionWindowStart);

  return (
    <div
      className="relative w-full rounded-[24px] overflow-hidden p-5 md:p-6"
      style={{
        background: "linear-gradient(142deg, #3d0d22 0%, #220810 55%, #120408 100%)",
        border: "1px solid rgba(142,31,61,.3)",
      }}
    >
      {/* White top thread */}
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,.08) 40%, transparent)" }}
      />
      {/* Glow subdued */}
      <div
        className="pointer-events-none absolute -top-12 -left-12 w-64 h-64 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(142,31,61,.15) 0%, transparent 70%)" }}
      />

      <div className="relative z-10">
        {/* Status badge */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full border-2"
              style={{ borderColor: "rgba(220,140,170,.6)", background: "transparent" }}
            />
            <span className="text-xs font-semibold uppercase tracking-wider text-white/50">
              Em breve
            </span>
          </div>
          <span
            className="text-xs font-bold px-2.5 py-1 rounded-lg"
            style={{
              background: "rgba(255,255,255,.05)",
              border: "1px solid rgba(255,255,255,.08)",
              color: "rgba(255,255,255,.4)",
            }}
          >
            #{sim.sequenceNumber}
          </span>
        </div>

        {/* Title */}
        <h2
          className="font-bold mb-3"
          style={{ color: "rgba(255,255,255,.65)", fontSize: "clamp(18px, 3.5vw, 22px)" }}
        >
          {sim.title}
        </h2>

        {/* Meta row */}
        <div className="flex items-center gap-3 mb-5 text-white/40 text-xs">
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            Abre em {format(parseISO(sim.executionWindowStart), "dd/MM", { locale: ptBR })}
          </span>
        </div>

        {/* Countdown */}
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          <CountdownBlock label="dias" value={String(days).padStart(2, "0")} />
          <CountdownBlock label="horas" value={String(hours).padStart(2, "0")} />
          <CountdownBlock label="min" value={String(mins).padStart(2, "0")} />
        </div>

        {/* Disabled CTA */}
        <div className="flex flex-wrap gap-2 items-center">
          <button
            disabled
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold cursor-not-allowed opacity-50"
            style={{
              background: "rgba(255,255,255,.06)",
              border: "1px solid rgba(255,255,255,.08)",
              color: "rgba(255,255,255,.5)",
            }}
          >
            <Lock className="w-4 h-4" />
            Ainda não disponível
          </button>
        </div>

        {/* Info row */}
        <div className="mt-3 flex items-center gap-1.5 text-xs text-white/35">
          <Clock className="w-3 h-3" />
          Liberado automaticamente em{" "}
          {format(parseISO(sim.executionWindowStart), "dd/MM 'às' HH:mm", { locale: ptBR })}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify upcoming state**

If there is an upcoming simulado (and no active one), the hero should show:
- Dimmer gradient card
- Empty-ring "Em breve" badge
- Countdown blocks ticking (wait ~1min to confirm update)
- Disabled locked CTA button

- [ ] **Step 5: Commit**

```bash
git add src/pages/SimuladosPage.tsx
git commit -m "feat(simulados): implement HeroCard upcoming state with countdown"
```

---

### Task 6: Implement `TimelineSection` and `TimelineItem`

Build the vertical timeline below the hero.

**Files:**
- Modify: `src/pages/SimuladosPage.tsx`

- [ ] **Step 1: Replace `TimelineSection` stub**

Replace `function TimelineSection` with:

```tsx
function TimelineSection({ items, reduced }: { items: SimuladoWithStatus[]; reduced: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, 5);

  return (
    <section className="mb-8">
      {/* Section header */}
      <div className="flex items-center gap-3 mb-5">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Histórico e próximos
        </span>
        <div className="flex-1 h-px" style={{ background: "rgba(142,31,61,.15)" }} />
      </div>
      <p className="text-[11px] text-muted-foreground mb-5 -mt-3">
        Mais recente primeiro · clique para ver detalhes
      </p>

      {/* Spine + items */}
      <div className="relative">
        {/* Vertical spine */}
        <div
          className="absolute left-3 top-2 bottom-0 w-[1.5px]"
          style={{
            background: "linear-gradient(to bottom, rgba(142,31,61,.35), rgba(142,31,61,.04))",
          }}
        />

        <div className="space-y-3 pl-8">
          {visible.map((sim, index) => (
            <TimelineItem key={sim.id} sim={sim} index={index} reduced={reduced} />
          ))}
        </div>
      </div>

      {/* Show more */}
      {items.length > 5 && (
        <button
          onClick={() => setExpanded(v => !v)}
          className="mt-4 ml-8 flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronDown
            className="w-4 h-4 transition-transform"
            style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
          />
          {expanded ? "Ver menos" : `Ver todos os anteriores (${items.length - 5} a mais)`}
        </button>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Add status config helper above `TimelineItem`**

Insert this immediately before `function TimelineItem`:

```tsx
const STATUS_CONFIG = {
  in_progress: {
    dotClass: "sim-dot-pulse",
    dotStyle: { background: "#e83862", width: 10, height: 10 },
    cardBg: "rgba(255,248,250,.9)",
    cardBorder: "rgba(232,56,98,.2)",
    labelColor: "#e83862",
    Icon: Play,
    label: "Em andamento",
  },
  closed_waiting: {
    dotClass: "",
    dotStyle: { background: "#d4a017", width: 10, height: 10 },
    cardBg: "rgba(252,248,238,.8)",
    cardBorder: "rgba(212,160,23,.22)",
    labelColor: "#a07018",
    Icon: Lock,
    label: "Aguardando",
  },
  completed: {
    dotClass: "",
    dotStyle: { background: "rgba(255,255,255,.7)", width: 10, height: 10, border: "1.5px solid rgba(0,0,0,.15)" },
    cardBg: "#fff",
    cardBorder: "rgba(0,0,0,.08)",
    labelColor: "#2d8f5a",
    Icon: CheckCircle2,
    label: "Concluído",
  },
  available_late: {
    dotClass: "",
    dotStyle: { background: "transparent", width: 7, height: 7, border: "1.5px solid rgba(158,122,142,.4)" },
    cardBg: "rgba(244,241,245,.55)",
    cardBorder: "rgba(158,122,142,.18)",
    labelColor: "#9e7a8e",
    Icon: Coffee,
    label: "Fora da janela",
  },
  upcoming: {
    dotClass: "",
    dotStyle: { background: "rgba(220,140,170,.4)", width: 10, height: 10 },
    cardBg: "rgba(60,15,32,.45)",
    cardBorder: "rgba(142,31,61,.2)",
    labelColor: "rgba(220,140,170,.75)",
    Icon: Clock,
    label: "Em breve",
  },
} as const;
```

- [ ] **Step 3: Replace `TimelineItem` stub**

Replace `function TimelineItem` with:

```tsx
function TimelineItem({ sim, index, reduced }: { sim: SimuladoWithStatus; index: number; reduced: boolean }) {
  const cfg = STATUS_CONFIG[sim.status as keyof typeof STATUS_CONFIG];
  if (!cfg) return null;

  const isUpcoming = sim.status === "upcoming";
  const isCompleted = sim.status === "completed";
  const isInProgress = sim.status === "in_progress";
  const isClosedWaiting = sim.status === "closed_waiting";
  const isAvailableLate = sim.status === "available_late";

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0 : 0.4, delay: reduced ? 0 : index * 0.04 }}
      className="relative"
      style={{ opacity: isAvailableLate ? 0.6 : 1 }}
    >
      {/* Timeline dot */}
      <div
        className={`absolute -left-[21px] top-4 rounded-full ${cfg.dotClass}`}
        style={cfg.dotStyle as React.CSSProperties}
      />

      {/* Card */}
      <div
        className="rounded-xl px-4 py-3 flex items-center justify-between gap-3"
        style={{
          background: cfg.cardBg,
          border: `1px solid ${cfg.cardBorder}`,
        }}
      >
        {/* Left side */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-1">
            <cfg.Icon className="w-3 h-3 shrink-0" style={{ color: cfg.labelColor }} />
            <span
              className="text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: cfg.labelColor }}
            >
              {cfg.label}
            </span>
          </div>
          <p className="text-sm font-semibold text-foreground truncate">{sim.title}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {format(parseISO(sim.executionWindowStart), "dd/MM/yyyy", { locale: ptBR })} · #{sim.sequenceNumber}
          </p>
        </div>

        {/* Right side */}
        <div className="shrink-0 flex flex-col items-end gap-1.5">
          {isCompleted && (
            <>
              <span className="font-black leading-none" style={{ fontSize: 20, color: "#8e1f3d" }}>
                {sim.userState?.score ?? "–"}%
              </span>
              <Link
                to={`/simulados/${sim.slug}/resultado`}
                className="text-xs font-medium flex items-center gap-1 hover:opacity-80"
                style={{ color: "#8e1f3d" }}
              >
                Ver resultado <ArrowRight className="w-3 h-3" />
              </Link>
            </>
          )}
          {isInProgress && (
            <Link
              to={`/simulados/${sim.slug}/prova`}
              className="text-xs font-medium flex items-center gap-1 hover:opacity-80"
              style={{ color: "#e83862" }}
            >
              Continuar <ArrowRight className="w-3 h-3" />
            </Link>
          )}
          {isClosedWaiting && (
            <span className="flex items-center gap-1 text-xs text-amber-700 font-medium">
              <Lock className="w-3 h-3" />
              Aguardando
            </span>
          )}
          {isAvailableLate && (
            <div className="flex flex-col items-end gap-1">
              <Link
                to={`/simulados/${sim.slug}/start`}
                className="text-xs font-medium flex items-center gap-1 hover:opacity-80"
                style={{ color: "#9e7a8e" }}
              >
                Treinar <ArrowRight className="w-3 h-3" />
              </Link>
              <span className="text-[10px] text-muted-foreground text-right">
                Disponível como treino · não entra no ranking
              </span>
            </div>
          )}
          {isUpcoming && (
            <button className="text-xs font-medium flex items-center gap-1 hover:opacity-80" style={{ color: "rgba(220,140,170,.8)" }}>
              Agenda <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 4: Verify visually**

Open `/simulados`. Confirm:
- Section label "Histórico e próximos" with decorative line to the right
- Vertical spine visible on left
- Each card has correct background, dot color, and status label per its status
- Completed cards show score in wine color + "Ver resultado" link
- Expand/collapse works if more than 5 items

- [ ] **Step 5: Commit**

```bash
git add src/pages/SimuladosPage.tsx
git commit -m "feat(simulados): implement vertical timeline with per-status card styles"
```

---

### Task 7: Remove dead code and clean up

Remove the stubs (`TimelineItem` and `CountdownBlock` are now real; the old `Section` component reference is gone). Verify no unused imports.

**Files:**
- Modify: `src/pages/SimuladosPage.tsx`

- [ ] **Step 1: Check for unused imports**

Run:
```bash
npm run lint
```
Look for "no-unused-vars" or similar warnings. If `Coffee` or `CheckCircle2` or other Lucide icons appear unused, they are used inside `STATUS_CONFIG` — TypeScript knows this, but some linters need an explicit cast. Confirm they're referenced in `STATUS_CONFIG`.

- [ ] **Step 2: Remove the `useEffect` import if unused**

At the top of the file, `useEffect` is NOT imported (we used `useMemo` with a side-effect pattern in `useCountdown`). If the linter flags it, check if `useEffect` crept in accidentally and remove it.

Actually, the `useCountdown` function above uses `useMemo` as an effect which is technically wrong. Replace the `useCountdown` function with a proper `useEffect`-based version. First add `useEffect` to the imports:

Replace the import line:
```tsx
import { useMemo, useState } from "react";
```
with:
```tsx
import { useMemo, useState, useEffect } from "react";
```

Then replace `useCountdown`:
```tsx
function useCountdown(targetISO: string) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  const target = parseISO(targetISO);
  const diff = Math.max(0, target.getTime() - now.getTime());
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  return { days, hours, mins };
}
```

- [ ] **Step 3: Run lint again**

```bash
npm run lint
```
Expected: no errors or warnings related to this file.

- [ ] **Step 4: Run build**

```bash
npm run build
```
Expected: exits with code 0, no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/pages/SimuladosPage.tsx
git commit -m "fix(simulados): use proper useEffect in useCountdown, fix lint"
```

---

### Task 8: Visual QA pass

Manual verification against spec checklist before calling it done.

**Files:** None modified.

- [ ] **Step 1: Check HowItWorksCard**
  - Wine top-border gradient visible
  - Info icon in wine-tinted rounded box
  - Three pills visible and wrapping on narrow viewport (resize browser to ~375px)

- [ ] **Step 2: Check Hero — active state** (if no live active simulado, temporarily override `heroSimulado` to a test value, or check in staging with a configured simulado)
  - Dark card with gradient
  - Pulsing wine dot (check CSS animation is running — `sim-dot-pulse` class)
  - `#N` sequence badge top-right
  - Calendar + date meta row
  - Deadline ticker with red-tinted background
  - Two buttons: primary wine "Iniciar/Continuar" + secondary ghost "Como funciona"

- [ ] **Step 3: Check Hero — upcoming state**
  - Dimmer gradient
  - Empty ring badge "Em breve"
  - Three countdown blocks (dias / horas / min)
  - Disabled lock button

- [ ] **Step 4: Check Timeline**
  - Spine visible (left edge gradient line)
  - Each status has correct dot color
  - `in_progress` dot is pulsing
  - `completed` shows score + "Ver resultado" link
  - `available_late` card has reduced opacity
  - "Ver todos os anteriores" button appears and expands when >5 items

- [ ] **Step 5: Check responsiveness**
  - At 375px: hero padding reduces, countdown blocks fit, pills wrap, timeline cards have less padding
  - At 768px+: hero padding increases slightly

- [ ] **Step 6: Final commit if any tweaks made**

```bash
git add src/pages/SimuladosPage.tsx
git commit -m "polish(simulados): visual QA tweaks"
```

---

## Self-Review

**1. Spec coverage:**
- ✅ PageHeader: unchanged, same title/subtitle/badge
- ✅ HowItWorksCard: wine top fio, Info icon box, description, 3 pills, box-shadow
- ✅ Hero State 1 (active): gradient, border, pulsing dot, badge #N, title, meta-row, deadline ticker, CTAs
- ✅ Hero State 2 (upcoming): dimmer gradient, empty ring badge, countdown blocks, disabled CTA, info row
- ✅ Hero State 3 (edge case): `heroSimulado === null && simulados.length === 0` → EmptyState
- ✅ Timeline: spine, section label, staggered animation, per-status node + card styles
- ✅ All 5 statuses covered in STATUS_CONFIG
- ✅ Completed score in 20px/900 weight wine color
- ✅ available_late: "Disponível como treino · não entra no ranking" tag
- ✅ "Ver todos os anteriores" expand/collapse at 5 items
- ✅ Lucide icon map per spec (Play, Lock, CheckCircle2, Clock, Coffee, Calendar, ChevronDown, ArrowRight)
- ✅ Framer Motion animations with `useReducedMotion` guard
- ✅ Pulsing dot via `@keyframes` CSS (not Framer)
- ✅ Loading skeleton: h-[220px] hero + 3 skeleton cards
- ✅ Error state: `EmptyState variant="error"`
- ✅ No changes to hooks/types/routes
- ✅ `SimuladoCard.tsx` untouched

**2. Placeholder scan:** None found.

**3. Type consistency:**
- `SimuladoWithStatus` used throughout, sourced from `@/types`
- `STATUS_CONFIG` uses `sim.status as keyof typeof STATUS_CONFIG` — handles the cast
- `useCountdown` returns `{ days, hours, mins }` — `CountdownBlock` expects `{ label, value }` string — ✅ correctly stringified at call site
