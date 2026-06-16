# Ranking "Você primeiro" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refazer a página `/ranking` com hero pessoal gamificado (anel de percentil, posição gigante, climb por delta de percentil, sparkline), full-width, rebaixando a nota de corte.

**Architecture:** Dados via hooks no `RankingPage` (`useRanking` + novo `useRankingEvolution`), injetados por props num `RankingView` presentational. Helpers puros em `src/lib/ranking-percentile.ts` (testáveis). Componentes novos isolados em `src/components/ranking/`. Sem backend/migração.

**Tech Stack:** React 18, TypeScript, Tailwind, Framer Motion, TanStack Query, Vitest + Testing Library.

Spec: `docs/superpowers/specs/2026-06-16-ranking-redesign-voce-primeiro-design.md`

---

### Task 1: Helpers de percentil e climb (puro, TDD)

**Files:**
- Create: `src/lib/ranking-percentile.ts`
- Test: `src/lib/ranking-percentile.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { computePercentile, computeClimb } from './ranking-percentile';

describe('computePercentile', () => {
  it('retorna top 1% para o primeiro de muitos', () => {
    expect(computePercentile(1, 318)).toBe(1);
  });
  it('clampa em 99 no pior caso', () => {
    expect(computePercentile(300, 300)).toBe(99);
  });
  it('arredonda pra cima', () => {
    expect(computePercentile(42, 318)).toBe(14); // ceil(13.2)
  });
  it('total 0 ou inválido vira 99 (sem divisão por zero)', () => {
    expect(computePercentile(1, 0)).toBe(99);
  });
});

describe('computeClimb', () => {
  it('estreia quando não há percentil anterior', () => {
    expect(computeClimb(null, 13)).toEqual({ kind: 'debut' });
  });
  it('subiu quando o percentil melhora (menor)', () => {
    expect(computeClimb(23, 13)).toEqual({ kind: 'delta', prevPercentil: 23, currPercentil: 13, delta: 10 });
  });
  it('caiu quando o percentil piora (maior)', () => {
    expect(computeClimb(13, 23)).toEqual({ kind: 'delta', prevPercentil: 13, currPercentil: 23, delta: -10 });
  });
  it('manteve quando igual', () => {
    expect(computeClimb(13, 13)).toEqual({ kind: 'delta', prevPercentil: 13, currPercentil: 13, delta: 0 });
  });
});
```

- [ ] **Step 2: Run, verify fail** — `npm run test -- ranking-percentile` → FAIL (módulo não existe).

- [ ] **Step 3: Implement**

```ts
export type Climb =
  | { kind: 'debut' }
  | { kind: 'delta'; prevPercentil: number; currPercentil: number; delta: number };

/** Top X% (1..99). Quanto menor, melhor. */
export function computePercentile(position: number, total: number): number {
  if (!total || total <= 0) return 99;
  return Math.min(99, Math.max(1, Math.ceil((position / total) * 100)));
}

export function computeClimb(prevPercentil: number | null, currPercentil: number): Climb {
  if (prevPercentil == null) return { kind: 'debut' };
  return { kind: 'delta', prevPercentil, currPercentil, delta: prevPercentil - currPercentil };
}
```

- [ ] **Step 4: Run, verify pass** — `npm run test -- ranking-percentile` → PASS.

- [ ] **Step 5: Commit** — `git add src/lib/ranking-percentile.ts src/lib/ranking-percentile.test.ts && git commit -m "feat(ranking): helpers de percentil e climb"`

---

### Task 2: Hook `useRankingEvolution`

**Files:**
- Create: `src/hooks/useRankingEvolution.ts`

Depende de: `simuladosApi.getUserPerformanceHistory`, `fetchRankingForSimulado`, `computePercentile`, `computeClimb`.

- [ ] **Step 1: Implement**

```ts
import { useQuery } from '@tanstack/react-query';
import { simuladosApi } from '@/services/simuladosApi';
import { fetchRankingForSimulado } from '@/services/rankingApi';
import { computePercentile, computeClimb, type Climb } from '@/lib/ranking-percentile';

export interface RankingEvolution {
  scoreSeries: number[];
  climb: Climb;
}

export function useRankingEvolution(
  userId: string | null,
  simuladosWithResults: Array<{ id: string; sequence_number: number }>,
  selectedSimuladoId: string | null,
  currentPercentil: number | null,
): { data: RankingEvolution | null; loading: boolean } {
  const historyQ = useQuery({
    queryKey: ['ranking-evolution-history', userId],
    queryFn: () => simuladosApi.getUserPerformanceHistory(userId!, 20),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  const history = historyQ.data ?? [];
  // ordem cronológica pela sequência dos simulados liberados
  const orderedReleased = [...simuladosWithResults].sort((a, b) => a.sequence_number - b.sequence_number);
  const scoreById = new Map(history.map((h) => [h.simulado_id, Math.round(h.score_percentage)]));
  const scoreSeries = orderedReleased
    .filter((s) => scoreById.has(s.id))
    .map((s) => scoreById.get(s.id)!);

  // simulado imediatamente anterior ao selecionado, que o usuário fez
  const idx = orderedReleased.findIndex((s) => s.id === selectedSimuladoId);
  let previousSimuladoId: string | null = null;
  for (let i = idx - 1; i >= 0; i--) {
    if (scoreById.has(orderedReleased[i].id)) { previousSimuladoId = orderedReleased[i].id; break; }
  }

  const prevQ = useQuery({
    queryKey: ['ranking-evolution-prev', previousSimuladoId, userId],
    queryFn: async () => {
      const rows = await fetchRankingForSimulado(previousSimuladoId!);
      const me = rows.find((r) => r.user_id === userId);
      if (!me) return null;
      return computePercentile(Number(me.posicao), Number(me.total_candidatos));
    },
    enabled: !!previousSimuladoId && !!userId,
    staleTime: 5 * 60 * 1000,
  });

  const loading = historyQ.isLoading || (!!previousSimuladoId && prevQ.isLoading);
  if (currentPercentil == null) return { data: null, loading };

  const prevPercentil = previousSimuladoId ? (prevQ.data ?? null) : null;
  return {
    data: { scoreSeries, climb: computeClimb(prevPercentil, currentPercentil) },
    loading,
  };
}
```

- [ ] **Step 2: Typecheck** — `npx tsc --noEmit` → sem erros novos neste arquivo.

- [ ] **Step 3: Commit** — `git add src/hooks/useRankingEvolution.ts && git commit -m "feat(ranking): hook de evolucao e climb por percentil"`

---

### Task 3: `PercentileRing`

**Files:**
- Create: `src/components/ranking/PercentileRing.tsx`

- [ ] **Step 1: Implement** — anel SVG (r=52, circ≈326.7), arco = `(100-percentil)%` preenchido, centro com `#{position}` + "de {total}", count-up animado da posição com `useReducedMotion`.

```tsx
import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';

interface Props { position: number; total: number; percentil: number; }
const CIRC = 2 * Math.PI * 52;

export function PercentileRing({ position, total, percentil }: Props) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(reduced ? position : 1);
  useEffect(() => {
    if (reduced) { setShown(position); return; }
    let raf = 0; const start = performance.now(); const dur = 700;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / dur);
      setShown(Math.round(1 + (position - 1) * k));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [position, reduced]);
  const offset = CIRC * (percentil / 100); // mais cheio => percentil menor
  return (
    <div
      className="relative h-32 w-32 shrink-0"
      role="img"
      aria-label={`${position}ª posição de ${total} — top ${percentil}%`}
    >
      <svg viewBox="0 0 120 120" className="block h-32 w-32">
        <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="9" />
        <motion.circle
          cx="60" cy="60" r="52" fill="none" stroke="#ffbf6b" strokeWidth="9" strokeLinecap="round"
          strokeDasharray={CIRC} transform="rotate(-90 60 60)"
          initial={{ strokeDashoffset: CIRC }}
          animate={{ strokeDashoffset: reduced ? offset : offset }}
          transition={reduced ? { duration: 0 } : { duration: 0.9, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[2rem] font-bold leading-none text-white tabular-nums">#{shown}</span>
        <span className="mt-0.5 text-[11px] text-white/60">de {total}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit** — `git add src/components/ranking/PercentileRing.tsx && git commit -m "feat(ranking): PercentileRing"`

---

### Task 4: `EvolutionSparkline`

**Files:**
- Create: `src/components/ranking/EvolutionSparkline.tsx`

- [ ] **Step 1: Implement** — polyline normalizada da série de notas; só renderiza com ≥2 pontos; último ponto destacado; traço animado com `useReducedMotion`; `role="img"` + aria-label.

```tsx
import { motion, useReducedMotion } from 'framer-motion';

interface Props { series: number[]; }
const W = 150, H = 38, P = 4;

export function EvolutionSparkline({ series }: Props) {
  const reduced = useReducedMotion();
  if (series.length < 2) return null;
  const min = Math.min(...series), max = Math.max(...series);
  const span = max - min || 1;
  const pts = series.map((v, i) => {
    const x = P + (i / (series.length - 1)) * (W - 2 * P);
    const y = P + (1 - (v - min) / span) * (H - 2 * P);
    return [x, y] as const;
  });
  const d = pts.map((p) => p.join(',')).join(' ');
  const last = pts[pts.length - 1];
  const trend = series[series.length - 1] >= series[0] ? 'subindo' : 'caindo';
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`} className="block w-full" height={H} preserveAspectRatio="none"
      role="img" aria-label={`Sua nota está ${trend}: de ${series[0]}% para ${series[series.length - 1]}%`}
    >
      <motion.polyline
        points={d} fill="none" stroke="#ffbf6b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        initial={{ pathLength: reduced ? 1 : 0 }} animate={{ pathLength: 1 }}
        transition={reduced ? { duration: 0 } : { duration: 0.8, ease: 'easeOut' }}
      />
      <circle cx={last[0]} cy={last[1]} r="3.5" fill="#fff" />
    </svg>
  );
}
```

- [ ] **Step 2: Commit** — `git add src/components/ranking/EvolutionSparkline.tsx && git commit -m "feat(ranking): EvolutionSparkline"`

---

### Task 5: `ClimbBadge`

**Files:**
- Create: `src/components/ranking/ClimbBadge.tsx`

- [ ] **Step 1: Implement** — recebe `Climb`; pill verde/vermelho/neutro/estreia; pulso quando subiu (reduced-motion off).

```tsx
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight, ArrowDownRight, Minus, Sparkles } from 'lucide-react';
import type { Climb } from '@/lib/ranking-percentile';

export function ClimbBadge({ climb }: { climb: Climb }) {
  const reduced = useReducedMotion();
  if (climb.kind === 'debut') {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-white/16 bg-white/10 px-3 py-1.5 text-[13px] font-medium text-white/85">
        <Sparkles className="h-4 w-4 text-amber-200" aria-hidden /> Sua estreia no ranking
      </span>
    );
  }
  const up = climb.delta > 0, down = climb.delta < 0;
  const cls = up
    ? 'border-[rgba(74,222,128,0.3)] bg-[rgba(74,222,128,0.16)] text-[#bbf7d0]'
    : down
      ? 'border-[rgba(248,113,113,0.3)] bg-[rgba(248,113,113,0.14)] text-[#fecaca]'
      : 'border-white/16 bg-white/10 text-white/85';
  const Icon = up ? ArrowUpRight : down ? ArrowDownRight : Minus;
  const text = up
    ? `Subiu do top ${climb.prevPercentil}% para o top ${climb.currPercentil}%`
    : down
      ? `Caiu do top ${climb.prevPercentil}% para o top ${climb.currPercentil}%`
      : `Você manteve o top ${climb.currPercentil}%`;
  return (
    <motion.span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] font-medium ${cls}`}
      animate={up && !reduced ? { scale: [1, 1.04, 1] } : undefined}
      transition={{ duration: 1.2, repeat: up && !reduced ? Infinity : 0, repeatDelay: 1.5 }}
    >
      <Icon className="h-4 w-4" aria-hidden /> {text}
    </motion.span>
  );
}
```

- [ ] **Step 2: Commit** — `git add src/components/ranking/ClimbBadge.tsx && git commit -m "feat(ranking): ClimbBadge"`

---

### Task 6: `RankingHero`

**Files:**
- Create: `src/components/ranking/RankingHero.tsx`

Compõe `PercentileRing`, `ClimbBadge`, `EvolutionSparkline`. Recebe standing + evolução (opcional) + simulado title + notaMedia. Trata estado aspiracional (sem standing).

- [ ] **Step 1: Implement**

```tsx
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { PercentileRing } from './PercentileRing';
import { ClimbBadge } from './ClimbBadge';
import { EvolutionSparkline } from './EvolutionSparkline';
import type { RankingEvolution } from '@/hooks/useRankingEvolution';

interface Props {
  simuladoTitle?: string;
  standing: { position: number; total: number; percentil: number; score: number } | null;
  notaMedia: number;
  evolution: RankingEvolution | null;
}

const WINE = 'linear-gradient(155deg,#7a1a32 0%,#5c1225 46%,#3d0b18 100%)';

export function RankingHero({ simuladoTitle, standing, notaMedia, evolution }: Props) {
  return (
    <section
      className="relative overflow-hidden rounded-[22px] p-6 text-white"
      style={{ background: WINE, boxShadow: '0 24px 56px -14px rgba(142,31,61,0.6), inset 0 1px 0 rgba(255,255,255,0.08)' }}
      aria-label="Resumo da sua colocação no ranking"
    >
      <div className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full" style={{ background: 'radial-gradient(circle, rgba(255,180,200,0.16) 0%, transparent 70%)' }} />
      <div className="pointer-events-none absolute -bottom-20 left-20 h-44 w-44 rounded-full" style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 70%)' }} />

      <p className="relative mb-5 text-[11px] font-medium uppercase tracking-[0.14em] text-white/55">
        Ranking ENAMED 2026{simuladoTitle ? ` · ${simuladoTitle}` : ''}
      </p>

      {!standing ? (
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-heading-2 font-bold">Você ainda não está no ranking</p>
            <p className="mt-1 max-w-md text-[13px] text-white/60">Conclua o simulado e aguarde a liberação dos resultados para ver sua colocação aqui.</p>
          </div>
          <Link to="/simulados" className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-white/12 px-4 py-2 text-caption font-semibold text-white hover:bg-white/20 transition-colors">
            Ver simulados <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      ) : (
        <div className="relative flex flex-col items-center gap-6 md:flex-row md:items-center md:gap-7">
          <PercentileRing position={standing.position} total={standing.total} percentil={standing.percentil} />

          <div className="min-w-0 flex-1 text-center md:text-left">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-white/50">Sua colocação</p>
            <p className="mt-0.5 text-[30px] font-bold leading-tight">Top {standing.percentil}%</p>
            {evolution && (
              <div className="mt-3 flex justify-center md:justify-start">
                <ClimbBadge climb={evolution.climb} />
              </div>
            )}
            <p className="mt-3 text-[12px] leading-relaxed text-white/55">
              Você está à frente de {Math.max(0, standing.total - standing.position)} candidatos.
            </p>
          </div>

          <div className="flex w-full shrink-0 flex-col gap-2.5 md:w-44">
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3">
              <span className="text-[11px] text-white/55">Sua nota</span>
              <div className="flex items-baseline gap-2">
                <span className="text-[26px] font-bold leading-snug text-[#ffcbd8]">{standing.score}%</span>
                <DeltaVsMedia score={standing.score} media={notaMedia} />
              </div>
            </div>
            {evolution && evolution.scoreSeries.length >= 2 && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-2.5">
                <span className="text-[11px] text-white/55">Sua evolução</span>
                <div className="mt-1"><EvolutionSparkline series={evolution.scoreSeries} /></div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function DeltaVsMedia({ score, media }: { score: number; media: number }) {
  const delta = score - media;
  return (
    <span className={'text-[12px] font-medium ' + (delta >= 0 ? 'text-[#86efac]' : 'text-[#fca5a5]')}>
      {delta >= 0 ? '+' : ''}{delta} vs média
    </span>
  );
}
```

- [ ] **Step 2: Commit** — `git add src/components/ranking/RankingHero.tsx && git commit -m "feat(ranking): RankingHero (anel + climb + nota + sparkline)"`

---

### Task 7: `RankingCutoffSection` (recolhível)

**Files:**
- Create: `src/components/ranking/RankingCutoffSection.tsx`

Envolve `RankingApprovalPanel` num disclosure recolhido por padrão.

- [ ] **Step 1: Implement**

```tsx
import { useState } from 'react';
import { ChevronDown, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RankingApprovalPanel, type ApprovalPanelState } from './RankingApprovalPanel';
import type { ApprovalEntry } from '@/lib/ranking-approval';

interface Props {
  state: ApprovalPanelState;
  entries: ApprovalEntry[];
  userScore: number | null;
  onOpenCutoffTable: () => void;
}

export function RankingCutoffSection(props: Props) {
  const [open, setOpen] = useState(false);
  const reached = props.entries.filter((e) => e.status === 'pass').length;
  const withCutoff = props.entries.filter((e) => e.cutoffGeneral != null).length;
  const summary = props.userScore != null && withCutoff > 0
    ? `${reached} de ${withCutoff} instituiç${withCutoff === 1 ? 'ão' : 'ões'} alcançada${reached === 1 ? '' : 's'}`
    : 'Compare sua nota com as notas de corte';
  return (
    <div className="rounded-2xl border border-border bg-card">
      <button
        type="button" onClick={() => setOpen((v) => !v)}
        aria-expanded={open} aria-controls="cutoff-panel"
        className="flex w-full items-center gap-3 px-5 py-4 text-left"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent shrink-0">
          <Target className="h-4.5 w-4.5 text-primary" aria-hidden />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-body font-semibold text-foreground">Você passaria?</span>
          <span className="block text-caption text-muted-foreground truncate">{summary}</span>
        </span>
        <ChevronDown className={cn('h-5 w-5 text-muted-foreground transition-transform shrink-0', open && 'rotate-180')} aria-hidden />
      </button>
      {open && (
        <div id="cutoff-panel" className="px-1 pb-1">
          <RankingApprovalPanel {...props} />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit** — `git add src/components/ranking/RankingCutoffSection.tsx && git commit -m "feat(ranking): secao de nota de corte recolhivel"`

---

### Task 8: Reestruturar `RankingView`

**Files:**
- Modify: `src/components/ranking/RankingView.tsx`

- [ ] **Step 1:** Adicionar props `heroStanding?` e `heroEvolution?` à interface `RankingViewProps` (tipos do spec §"Contrato de Props"). Importar `RankingHero`, `RankingCutoffSection`, `RankingEvolution`.

- [ ] **Step 2:** Computar `fallbackStanding` quando `heroStanding` ausente (admin): a partir de `currentUser` + `filteredParticipants.length` + `computePercentile`. `const heroStandingResolved = heroStanding ?? (currentUser ? { position: currentUser.position, total: filteredParticipants.length, percentil: computePercentile(currentUser.position, filteredParticipants.length), score: currentUser.score } : null);`

- [ ] **Step 3:** Remover o wrapper `<div className="rounded-2xl bg-background p-5">`; trocar por `<div className="space-y-5">` (mantendo `{toolbar}` antes). Remover import e uso de `RankingStatsRow`.

- [ ] **Step 4:** Nova ordem de render (dentro de `!loading`):
  1. `RankingSimuladoSelector`
  2. `<RankingHero simuladoTitle={...} standing={heroStandingResolved} notaMedia={stats.notaMedia} evolution={heroEvolution ?? null} />`
  3. `RankingLowConfidenceBanner` (quando `lowConfidence`)
  4. `RankingFilterBar`
  5. `RankingTable`
  6. `showApprovalPanel && <RankingCutoffSection state={approvalState} entries={approvalEntries} userScore={currentUser?.score ?? null} onOpenCutoffTable={() => setCutoffModalOpen(true)} />`
  - Manter o empty state da tabela e `CutoffScoreModal` no fim.

- [ ] **Step 5: Typecheck + lint** — `npx tsc --noEmit && npm run lint` → sem erros novos.

- [ ] **Step 6: Commit** — `git add src/components/ranking/RankingView.tsx && git commit -m "feat(ranking): reestrutura RankingView com hero e nota de corte rebaixada"`

---

### Task 9: Ligar dados no `RankingPage` + remover `RankingStatsRow`

**Files:**
- Modify: `src/pages/RankingPage.tsx`
- Delete: `src/components/ranking/RankingStatsRow.tsx`

- [ ] **Step 1:** Em `RankingPage`, pegar `allParticipants` do `useRanking`. Computar standing global:

```tsx
import { computePercentile } from '@/lib/ranking-percentile';
import { useRankingEvolution } from '@/hooks/useRankingEvolution';
// ...
const me = allParticipants.find((p) => p.isCurrentUser);
const heroStanding = me
  ? { position: me.position, total: allParticipants.length, percentil: computePercentile(me.position, allParticipants.length), score: me.score }
  : null;
const { data: heroEvolution } = useRankingEvolution(
  user?.id ?? null, simuladosWithResults, selectedSimuladoId, heroStanding?.percentil ?? null,
);
```
(`user` via `useAuth()` — importar se necessário.)

- [ ] **Step 2:** Passar `heroStanding={heroStanding}` e `heroEvolution={heroEvolution}` ao `<RankingView>`.

- [ ] **Step 3:** `git rm src/components/ranking/RankingStatsRow.tsx`.

- [ ] **Step 4: Typecheck** — `npx tsc --noEmit` → sem erros (nenhum import órfão de `RankingStatsRow`).

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(ranking): liga evolucao no RankingPage e remove RankingStatsRow"`

---

### Task 10: Atualizar testes do `RankingView`

**Files:**
- Modify: `src/components/ranking/RankingView.test.tsx`

- [ ] **Step 1:** Ajustar testes existentes que dependiam da estrutura antiga (StatsRow/wrapper). Adicionar casos:
  - com `heroStanding` → renderiza "Top {percentil}%" e a nota.
  - sem `heroStanding`/`currentUser` → renderiza "Você ainda não está no ranking".
  - `RankingCutoffSection` começa recolhida (texto "Você passaria?" visível, painel detalhado oculto) quando `showApprovalPanel` default; ausente quando `showApprovalPanel={false}`.

- [ ] **Step 2: Run** — `npm run test -- RankingView` → PASS.

- [ ] **Step 3: Commit** — `git add src/components/ranking/RankingView.test.tsx && git commit -m "test(ranking): cobre hero e secao de corte recolhivel"`

---

### Task 11: Verificação no preview + suíte completa

- [ ] **Step 1:** `npm run test` → toda a suíte PASS.
- [ ] **Step 2:** `npm run lint` → sem erros novos.
- [ ] **Step 3:** Subir o dev server (porta 8080) e abrir `/ranking`: validar hero (anel/climb/sparkline), tabela full-width, nota de corte recolhida, dark mode, e responsivo (mobile coluna única). Capturar screenshot.
- [ ] **Step 4:** Validar que o preview admin (`AdminRankingPreviewPage`) ainda renderiza (hero estático sem climb/sparkline, sem erro).

---

## Self-Review

- **Cobertura do spec:** shell/full-width (T8), hero+anel+posição (T3,T6), climb percentil (T1,T2,T5), sparkline (T4,T6), standing global + fallback admin (T8,T9), nota de corte rebaixada/recolhida (T7,T8), tabela/filtros mantidos (sem task = sem mudança de lógica, só restyle dentro de T8 se necessário), remoção StatsRow+wrapper (T8,T9), a11y/reduced-motion (T3,T4,T5), testes (T1,T10,T11). ✓
- **Placeholders:** nenhum — todos os steps têm código real. ✓
- **Consistência de tipos:** `Climb` (T1) usado em T2/T5/T6; `RankingEvolution` (T2) usado em T6/T8/T9; `computePercentile` (T1) usado em T2/T8/T9; props `heroStanding`/`heroEvolution` idênticas em T8/T9. ✓
