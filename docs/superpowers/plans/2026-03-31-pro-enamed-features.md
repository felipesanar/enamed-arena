# PRO ENAMED UI Features — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplicar 6 mudanças de UX/UI no projeto enamed-arena: ordering de simulados, login page copy, bloqueio de card para não-PRO, badge de pior área, label de ranking na home e filtros de ranking por segmento/instituição.

**Architecture:** Todas as mudanças são in-place nos arquivos existentes, sem novos arquivos de componente (exceto o sub-componente `LogoPro` criado dentro de `LoginPage.tsx`). Nenhuma alteração de tipo, hook ou schema de banco.

**Tech Stack:** React 18, TypeScript 5, Tailwind CSS, shadcn/ui, TanStack Query, Supabase, Vitest + Testing Library

---

## Arquivos modificados

| Arquivo | O que muda |
|---------|-----------|
| `src/services/simuladosApi.ts:157` | `ascending: true` → `false` |
| `src/pages/LoginPage.tsx` | `BrandLockup` → `LogoPro`; copy no `AuthShell` e `MobileHeaderAndHero` |
| `src/components/SimuladoCard.tsx` | Props `isLocked` e `worstArea`; lógica de bloqueio e badge |
| `src/pages/SimuladosPage.tsx` | Imports `useSegment`, `useUserPerformance`, `useSimuladoDetail`, `useExamResult`, `computePerformanceBreakdown`; passa `isLocked` e `worstArea` aos cards |
| `src/components/premium/home/HomePagePremium.tsx` | Passa `segmentFilter` para `HeroPerformanceCard`; label com segmento; empty state |
| `src/pages/RankingPage.tsx` | Filtragem de segmentos por tipo; instituição como sub-filtro |

---

## Task 1: Ordering — simulados mais recente primeiro

**Files:**
- Modify: `src/services/simuladosApi.ts:157`

- [ ] **Step 1: Alterar ordering**

Em `src/services/simuladosApi.ts`, linha 157:
```ts
// antes
.order('sequence_number', { ascending: true });

// depois
.order('sequence_number', { ascending: false });
```

- [ ] **Step 2: Verificar build**

```bash
npm run build 2>&1 | tail -5
```
Esperado: sem erros de TypeScript.

- [ ] **Step 3: Commit**

```bash
git add src/services/simuladosApi.ts
git commit -m "feat: ordenar simulados por sequence_number DESC (mais recente primeiro)"
```

---

## Task 2: Login page — LogoPro + copy

**Files:**
- Modify: `src/pages/LoginPage.tsx`

- [ ] **Step 1: Substituir `BrandLockup` por `LogoPro`**

Localizar a função `BrandLockup` (linhas 409–419) e substituí-la inteiramente:

```tsx
function LogoPro() {
  return (
    <div className="text-center">
      <div className="mx-auto inline-flex items-center gap-2.5 rounded-xl border border-auth-border-subtle bg-auth-surface-soft px-4 py-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#7c3aed] to-[#a855f7]">
          <span className="text-[14px] font-black text-white">P</span>
        </div>
        <div className="text-left">
          <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#c4b5fd]">SanarFlix</div>
          <div className="text-[15px] font-bold leading-tight text-auth-text-primary">PRO ENAMED</div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Atualizar chamadas de `BrandLockup` para `LogoPro`**

No JSX do `LoginPage`, substituir todas as ocorrências de `<BrandLockup />` por `<LogoPro />` (há duas: dentro do `flowState === "sent"` e dentro do render principal).

- [ ] **Step 3: Atualizar copy em `AuthShell`**

Localizar o `return (` principal de `LoginPage` (linha ~201) onde aparece:
```tsx
<AuthShell
  heroEyebrow="Entrada Premium SanarFlix"
  heroTitle="Preparação para o ENAMED, com direção."
  heroSubtitle="Entre e continue de onde parou."
```
Substituir por:
```tsx
<AuthShell
  heroEyebrow="PRO ENAMED"
  heroTitle="Simulados para o ENAMED, com direção"
  heroSubtitle="Entre, realize os simulados e compare seu desempenho no ranking nacional."
```

- [ ] **Step 4: Atualizar copy em `MobileHeaderAndHero`**

Localizar a função `MobileHeaderAndHero` (linha ~421) e substituir o bloco do hero mobile:
```tsx
// antes
<h2 className="max-w-[12ch] text-heading-1 leading-[1.02] tracking-tight text-auth-hero-headline">
  Evolua no ENAMED.
</h2>
<p className="text-body text-auth-hero-subtitle">Retome seu plano em minutos.</p>

// depois
<h2 className="max-w-[14ch] text-heading-1 leading-[1.02] tracking-tight text-auth-hero-headline">
  Simulados para o ENAMED, com direção
</h2>
<p className="text-body text-auth-hero-subtitle">Compare seu desempenho no ranking nacional.</p>
```

- [ ] **Step 5: Remover import `GraduationCap` se não usado em mais nenhum lugar**

Verificar: `GraduationCap` ainda é usado em `MobileHeaderAndHero` (linha ~427). **Não remover** — permanece no import.

- [ ] **Step 6: Verificar build**

```bash
npm run build 2>&1 | tail -5
```
Esperado: sem erros.

- [ ] **Step 7: Commit**

```bash
git add src/pages/LoginPage.tsx
git commit -m "feat: login — LogoPro placeholder e copy PRO ENAMED"
```

---

## Task 3: SimuladoCard — props isLocked e worstArea

**Files:**
- Modify: `src/components/SimuladoCard.tsx`
- Test: `src/components/SimuladoCard.test.tsx`

- [ ] **Step 1: Escrever testes que vão falhar**

Criar `src/components/SimuladoCard.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { SimuladoCard } from './SimuladoCard';
import type { SimuladoWithStatus } from '@/types';

const baseSimulado: SimuladoWithStatus = {
  id: 'sim-1',
  title: 'Simulado ENAMED 26/03',
  sequenceNumber: 3,
  executionWindowStart: '2026-03-26T00:00:00Z',
  executionWindowEnd: '2026-03-28T00:00:00Z',
  resultsReleaseAt: '2026-03-29T00:00:00Z',
  status: 'available',
  questionsCount: 100,
  durationMinutes: 240,
  themeTags: [],
  userState: undefined,
};

function renderCard(props: Partial<React.ComponentProps<typeof SimuladoCard>> = {}) {
  return render(
    <MemoryRouter>
      <SimuladoCard simulado={baseSimulado} isLocked={false} {...props} />
    </MemoryRouter>
  );
}

describe('SimuladoCard', () => {
  it('renders CTA link when not locked', () => {
    renderCard({ isLocked: false });
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/simulados/sim-1');
  });

  it('renders locked state with PRO badge and disabled CTA', () => {
    const { container } = renderCard({ isLocked: true });
    expect(screen.getByText('🔒 PRO')).toBeInTheDocument();
    expect(screen.getByText('🔒 Disponível apenas para Aluno PRO')).toBeInTheDocument();
    expect(container.querySelector('a[href]')).toBeNull();
  });

  it('renders worstArea badge when provided', () => {
    renderCard({ isLocked: false, worstArea: 'Clínica Médica' });
    expect(screen.getByText('Foco: Clínica Médica')).toBeInTheDocument();
  });

  it('does not render worstArea badge when null', () => {
    renderCard({ isLocked: false, worstArea: null });
    expect(screen.queryByText(/Foco:/)).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar para confirmar falha**

```bash
npm run test -- SimuladoCard.test --run 2>&1 | tail -20
```
Esperado: FAIL — `isLocked` não é uma prop conhecida.

- [ ] **Step 3: Implementar props e lógica no SimuladoCard**

Substituir o conteúdo inteiro de `src/components/SimuladoCard.tsx`:

```tsx
import { Calendar, Trophy } from "lucide-react";
import { PremiumCard } from "./PremiumCard";
import { StatusBadge } from "./StatusBadge";
import type { SimuladoWithStatus } from "@/types";
import { Link } from "react-router-dom";
import { getSimuladoCTA, formatDateShort } from "@/lib/simulado-helpers";

const PRO_ENAMED_URL = "https://sanarflix.com.br/sanarflix-pro-enamed";

interface SimuladoCardProps {
  simulado: SimuladoWithStatus;
  delay?: number;
  isLocked: boolean;
  worstArea?: string | null;
}

export function SimuladoCard({ simulado, delay = 0, isLocked, worstArea }: SimuladoCardProps) {
  const cta = getSimuladoCTA(simulado.status);
  const hasScore = simulado.userState?.score !== undefined;

  const cardContent = (
    <PremiumCard interactive delay={delay} className="flex flex-col p-5 md:p-6" style={isLocked ? { opacity: 0.65 } : undefined}>
      <div className="flex items-start justify-between mb-3">
        <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center">
          <span className="text-body font-bold text-primary">#{simulado.sequenceNumber}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <StatusBadge status={simulado.status} />
          {isLocked && (
            <span className="inline-flex items-center gap-1 rounded-full border border-[#7c3aed40] bg-[#7c3aed25] px-2 py-0.5 text-[11px] font-bold text-[#c4b5fd]">
              🔒 PRO
            </span>
          )}
        </div>
      </div>

      <h3 className="text-heading-3 text-foreground mb-3">{simulado.title}</h3>

      <div className="flex flex-wrap items-center gap-3 text-body-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5" />
          {formatDateShort(simulado.executionWindowStart)} - {formatDateShort(simulado.executionWindowEnd)}
        </span>
      </div>

      {worstArea && !isLocked && (
        <div className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-[#ef444430] bg-[#ef444415] px-2 py-1">
          <span className="text-[10px]">📌</span>
          <span className="text-[11px] font-semibold text-[#fca5a5]">Foco: {worstArea}</span>
        </div>
      )}

      {/* Score display only when results are released */}
      {hasScore && simulado.status === 'completed' && (
        <div className="flex items-center gap-2 mt-3 p-2.5 rounded-xl bg-accent/50 border border-border/30">
          <Trophy className="h-4 w-4 text-primary" />
          <span className="text-body-sm text-muted-foreground">Sua nota:</span>
          <span className="text-body font-bold text-primary ml-auto">{simulado.userState!.score}%</span>
        </div>
      )}

      {/* Window info */}
      {simulado.status === 'upcoming' && (
        <p className="text-caption text-info mt-2">
          Abre em {formatDateShort(simulado.executionWindowStart)}
        </p>
      )}
      {simulado.status === 'available_late' && (
        <p className="text-caption text-warning mt-2">
          Fora da janela · Não entra no ranking
        </p>
      )}
      {simulado.status === 'closed_waiting' && !simulado.userState?.finished && (
        <p className="text-caption text-muted-foreground mt-2">
          Não realizado
        </p>
      )}
      {simulado.status === 'closed_waiting' && simulado.userState?.finished && (
        <p className="text-caption text-muted-foreground mt-2">
          Resultado em {formatDateShort(simulado.resultsReleaseAt)}
        </p>
      )}

      <div className="mt-auto pt-4">
        {isLocked ? (
          <div className="w-full py-2.5 rounded-xl bg-[#1e293b] text-[#94a3b8] text-body text-center font-medium">
            🔒 Disponível apenas para Aluno PRO
          </div>
        ) : cta.variant === 'primary' ? (
          <Link
            to={`/simulados/${simulado.id}`}
            className="block w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-body font-semibold hover:bg-wine-hover transition-colors text-center"
          >
            {cta.label}
          </Link>
        ) : cta.variant === 'secondary' ? (
          <Link
            to={`/simulados/${simulado.id}`}
            className="block w-full py-2.5 rounded-xl bg-secondary text-secondary-foreground text-body font-medium hover:bg-muted transition-colors text-center"
          >
            {cta.label}
          </Link>
        ) : (
          <div className="w-full py-2.5 rounded-xl bg-muted text-muted-foreground text-body text-center font-medium">
            {cta.label}
          </div>
        )}
      </div>
    </PremiumCard>
  );

  if (isLocked) {
    return (
      <div
        className="cursor-pointer"
        onClick={() => window.open(PRO_ENAMED_URL, '_blank', 'noopener,noreferrer')}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && window.open(PRO_ENAMED_URL, '_blank', 'noopener,noreferrer')}
        aria-label={`${simulado.title} — exclusivo Aluno PRO`}
      >
        {cardContent}
      </div>
    );
  }

  return cardContent;
}
```

- [ ] **Step 4: Rodar testes**

```bash
npm run test -- SimuladoCard.test --run 2>&1 | tail -20
```
Esperado: 4 testes PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/SimuladoCard.tsx src/components/SimuladoCard.test.tsx
git commit -m "feat: SimuladoCard — props isLocked e worstArea com testes"
```

---

## Task 4: SimuladosPage — computar isLocked e worstArea

**Files:**
- Modify: `src/pages/SimuladosPage.tsx`

- [ ] **Step 1: Adicionar imports**

No topo de `src/pages/SimuladosPage.tsx`, adicionar após os imports existentes:

```tsx
import { useSegment } from "@/contexts/UserContext";
import { useUserPerformance } from "@/hooks/useUserPerformance";
import { useSimuladoDetail } from "@/hooks/useSimuladoDetail";
import { useExamResult } from "@/hooks/useExamResult";
import { computePerformanceBreakdown } from "@/lib/resultHelpers";
```

- [ ] **Step 2: Computar isLocked e worstArea na função do componente**

Logo após `const { simulados, loading, error, refetch } = useSimulados();`, adicionar:

```tsx
const segment = useSegment();
const isLocked = segment !== 'pro';

const { summary } = useUserPerformance();
const lastSimuladoId = !isLocked ? (summary?.last_simulado_id ?? null) : null;

const { questions } = useSimuladoDetail(lastSimuladoId ?? undefined);
const { examState } = useExamResult(lastSimuladoId ?? undefined);

const worstArea = useMemo(() => {
  if (!examState || !questions.length) return null;
  if (examState.status !== 'submitted' && examState.status !== 'expired') return null;
  const breakdown = computePerformanceBreakdown(examState, questions);
  const byArea = breakdown.byArea;
  return byArea.length > 0 ? byArea[byArea.length - 1].area : null;
}, [examState, questions]);
```

- [ ] **Step 3: Passar props a todos os `<SimuladoCard />`**

Substituir cada `<SimuladoCard key={sim.id} simulado={sim} delay={i * 0.06} />` (há 3 ocorrências — active, upcoming, past) por:

```tsx
<SimuladoCard key={sim.id} simulado={sim} delay={i * 0.06} isLocked={isLocked} worstArea={worstArea} />
```

- [ ] **Step 4: Verificar build**

```bash
npm run build 2>&1 | tail -5
```
Esperado: sem erros.

- [ ] **Step 5: Commit**

```bash
git add src/pages/SimuladosPage.tsx
git commit -m "feat: SimuladosPage — passa isLocked e worstArea para SimuladoCard"
```

---

## Task 5: HomePagePremium — label de segmento + empty state

**Files:**
- Modify: `src/components/premium/home/HomePagePremium.tsx`

- [ ] **Step 1: Expor `segmentFilter` de `useRanking()` em `HomePagePremium`**

Na desestruturação de `useRanking()` (linha ~43), adicionar `segmentFilter`:

```tsx
const {
  currentUser,
  stats: rankingStats,
  loading: rankingLoading,
  simuladosWithResults,
  selectedSimuladoId,
  segmentFilter,          // <-- adicionar
} = useRanking();
```

- [ ] **Step 2: Passar `segmentFilter` para `HeroPerformanceCard`**

Na chamada de `<HeroPerformanceCard>` (linha ~222), adicionar a prop:

```tsx
<HeroPerformanceCard
  lastScore={lastScore}
  scoreDelta={scoreDelta}
  rankPosition={rankPosition}
  rankTotal={rankTotal}
  recentScores={recentScores}
  rankingTitle={selectedRankingTitle}
  segmentFilter={segmentFilter}        // <-- adicionar
/>
```

- [ ] **Step 3: Adicionar `segmentFilter` na assinatura de `HeroPerformanceCard`**

Localizar a interface de props de `HeroPerformanceCard` (linha ~248) e adicionar:

```tsx
import type { SegmentFilter } from '@/services/rankingApi';

// na interface:
{
  lastScore: number | null;
  scoreDelta: number | null;
  rankPosition: number | null;
  rankTotal: number | null;
  recentScores: number[];
  rankingTitle: string | null;
  segmentFilter: SegmentFilter;   // <-- adicionar
}
```

Adicionar o import de `SegmentFilter` no topo do arquivo:
```tsx
import type { SegmentFilter } from '@/services/rankingApi';
```

- [ ] **Step 4: Criar mapeamento de label e atualizar label do snapshot**

Dentro da função `HeroPerformanceCard`, antes do `return`, adicionar:

```tsx
const SEGMENT_LABEL: Record<SegmentFilter, string> = {
  all: 'Geral',
  sanarflix: 'Aluno SanarFlix',
  pro: 'Aluno PRO',
};
```

Localizar a linha (~462) que renderiza o título do ranking:
```tsx
{rankingTitle ? `Simulado: ${rankingTitle}` : "Sem ranking selecionado"}
```
Substituir por:
```tsx
{rankingTitle ? `${rankingTitle} · ${SEGMENT_LABEL[segmentFilter]}` : null}
```

- [ ] **Step 5: Implementar empty state**

A condição de empty state é `!selectedSimuladoId && rankPosition === null`. Mas `HeroPerformanceCard` não recebe `selectedSimuladoId`. A prop mais limpa é passar um booleano `hasRankingConfig`.

Na chamada de `<HeroPerformanceCard>`, adicionar:
```tsx
hasRankingConfig={selectedSimuladoId !== null}
```

Na interface de props de `HeroPerformanceCard`, adicionar:
```tsx
hasRankingConfig: boolean;
```

Dentro de `HeroPerformanceCard`, localizar o bloco do ranking snapshot — é a `div` que começa em:
```tsx
<div className="mt-3 rounded-xl border border-[rgba(245,241,238,0.12)] bg-[rgba(245,241,238,0.06)] p-3 backdrop-blur-sm text-[rgba(245,241,238,0.92)]">
```
Essa div vai até o fechamento antes do link `Ver desempenho completo`. Substituir **somente ela** por:

```tsx
{!hasRankingConfig && rankPosition === null ? (
  <div className="mt-3 rounded-xl border border-[rgba(245,241,238,0.12)] bg-[rgba(245,241,238,0.06)] p-4 text-center">
    <p className="text-[13px] font-semibold text-[rgba(245,241,238,0.85)] mb-1">
      Veja como você está no ranking
    </p>
    <p className="text-[11px] text-[rgba(245,241,238,0.55)] leading-relaxed mb-3">
      Acesse a aba Ranking para escolher um simulado e ver sua posição entre os participantes.
    </p>
    <Link
      to="/ranking"
      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[rgba(232,56,98,0.3)] bg-[rgba(232,56,98,0.15)] px-3.5 py-1.5 text-[12px] font-semibold text-[#e83862] no-underline transition-colors hover:bg-[rgba(232,56,98,0.22)]"
    >
      Ir para o Ranking →
    </Link>
  </div>
) : (
  <div className="mt-3 rounded-xl border border-[rgba(245,241,238,0.12)] bg-[rgba(245,241,238,0.06)] p-3 backdrop-blur-sm text-[rgba(245,241,238,0.92)]">
    <div className="mb-1 flex items-start justify-between gap-3">
      <p className="min-w-0 flex-1 text-[12px] leading-snug text-[rgba(245,241,238,0.96)]">
        {rankPosition !== null && rankTotal !== null
          ? `Você está em ${rankPosition}º de ${rankTotal} participantes`
          : "Complete um simulado para entrar no ranking"}
      </p>
      <div className="shrink-0 text-right">
        <p className="text-[8px] font-semibold uppercase tracking-[0.12em] text-[rgba(245,241,238,0.62)]">
          Variação
        </p>
        <p className={`mt-0.5 text-[11px] font-bold tabular-nums ${variationState.tone}`}>
          {variationState.value}
        </p>
      </div>
    </div>

    <div className="space-y-1">
      <p className="text-[10px] leading-snug text-[rgba(245,241,238,0.78)] truncate">
        {rankingTitle ? `${rankingTitle} · ${SEGMENT_LABEL[segmentFilter]}` : null}
      </p>
      <p className="text-[9px] leading-snug text-[rgba(245,241,238,0.68)]">
        {variationState.helper}
      </p>
    </div>

    <div className="my-1.5 h-[3px] rounded-full bg-[rgba(245,241,238,0.14)] overflow-hidden">
      <div
        className="h-full rounded-full bg-[linear-gradient(90deg,#8E1F3D_0%,#E83862_100%)] transition-all duration-700"
        style={{ width: `${progressPct}%` }}
      />
    </div>

    <div className="flex items-center justify-between gap-3 text-[10px] text-[rgba(245,241,238,0.88)]">
      <span className="font-medium tabular-nums">
        {rankLabel ?? "Sem colocação"}
      </span>
      <span className="truncate text-[rgba(245,241,238,0.72)]">
        {rankPosition !== null ? tierLabel : nextTier}
      </span>
    </div>
  </div>
)}
```

> Nota: `rankingTitle`, `variationState`, `progressPct`, `rankLabel`, `tierLabel`, `nextTier` já existem como variáveis locais em `HeroPerformanceCard`. Nenhum novo cálculo necessário — o `SEGMENT_LABEL` definido no Step 4 é usado diretamente aqui.

- [ ] **Step 6: Verificar que `Link` está importado em `HomePagePremium.tsx`**

`Link` já está importado no topo (`import { Link } from "react-router-dom"`). Nenhuma alteração necessária.

- [ ] **Step 7: Verificar build**

```bash
npm run build 2>&1 | tail -5
```
Esperado: sem erros.

- [ ] **Step 8: Commit**

```bash
git add src/components/premium/home/HomePagePremium.tsx
git commit -m "feat: HeroPerformanceCard — label com segmento e empty state de ranking"
```

---

## Task 6: RankingPage — filtros por segmento + instituição como sub-filtro

**Files:**
- Modify: `src/pages/RankingPage.tsx`
- Test: `src/pages/RankingPage.test.ts`

- [ ] **Step 1: Escrever teste que vai falhar**

Criar `src/pages/RankingPage.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type { SegmentFilter } from '@/services/rankingApi';
import type { UserSegment } from '@/types';

// Extração da lógica pura para facilitar teste
function getAllowedSegments(segment: UserSegment): SegmentFilter[] {
  if (segment === 'pro') return ['all', 'sanarflix', 'pro'];
  if (segment === 'standard') return ['all', 'sanarflix'];
  return ['all'];
}

describe('allowedSegments', () => {
  it('guest vê apenas "all"', () => {
    expect(getAllowedSegments('guest')).toEqual(['all']);
  });

  it('standard vê "all" e "sanarflix"', () => {
    expect(getAllowedSegments('standard')).toEqual(['all', 'sanarflix']);
  });

  it('pro vê todos os três segmentos', () => {
    expect(getAllowedSegments('pro')).toEqual(['all', 'sanarflix', 'pro']);
  });
});
```

- [ ] **Step 2: Rodar para confirmar PASS** (lógica pura, sem dependência do componente)

```bash
npm run test -- RankingPage.test --run 2>&1 | tail -10
```
Esperado: 3 testes PASS — a lógica isolada já está correta.

- [ ] **Step 3: Adicionar imports ao `RankingPage.tsx`**

No import do lucide-react (linha 16), adicionar `Globe, Crown`:

```tsx
import { Trophy, Medal, Filter, Users, Stethoscope, Building, Globe, Crown } from 'lucide-react';
```

Adicionar import de `useUser`:
```tsx
import { useUser } from '@/contexts/UserContext';
```

- [ ] **Step 4: Obter `segment` e computar `allowedSegments` + `visibleSegmentOptions`**

Dentro de `RankingPage`, após a desestruturação de `useRanking()`, adicionar:

```tsx
const { profile } = useUser();
const segment = profile?.segment ?? 'guest';

const allowedSegments = useMemo((): SegmentFilter[] => {
  if (segment === 'pro') return ['all', 'sanarflix', 'pro'];
  if (segment === 'standard') return ['all', 'sanarflix'];
  return ['all'];
}, [segment]);

const SEGMENT_OPTIONS: Array<{ key: SegmentFilter; label: string; icon: React.ElementType }> = [
  { key: 'all',       label: 'Todos',          icon: Globe },
  { key: 'sanarflix', label: 'Aluno SanarFlix', icon: Users },
  { key: 'pro',       label: 'Aluno PRO',       icon: Crown },
];

const visibleSegmentOptions = SEGMENT_OPTIONS.filter(o => allowedSegments.includes(o.key));
```

Adicionar `useEffect` para reset automático após a desestruturação dos hooks:

```tsx
useEffect(() => {
  if (!allowedSegments.includes(segmentFilter)) {
    setSegmentFilter('all');
  }
}, [allowedSegments, segmentFilter, setSegmentFilter]);
```

Adicionar `useEffect` ao import do React (linha 7):
```tsx
import { useEffect, useRef } from 'react';
```
> `useEffect` já está importado na maioria dos casos; verificar antes de duplicar. `useMemo` precisará ser adicionado também: `import { useEffect, useMemo, useRef } from 'react';`

- [ ] **Step 5: Substituir o bloco de segment filter pelo novo com opções filtradas**

Localizar o bloco `{/* Segment filter */}` (linhas 232–254) e substituir:

```tsx
{/* Segment filter */}
<div>
  <p className="text-caption text-muted-foreground mb-1.5">Segmento</p>
  <div className="flex gap-1.5">
    {visibleSegmentOptions.map((f) => (
      <button
        key={f.key}
        onClick={() => setSegmentFilter(f.key)}
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-caption font-medium transition-all',
          segmentFilter === f.key
            ? 'bg-primary text-primary-foreground'
            : f.key === 'pro'
            ? 'bg-muted text-[#c4b5fd] hover:bg-muted/80'
            : 'bg-muted text-muted-foreground hover:bg-muted/80',
        )}
      >
        <f.icon className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{f.label}</span>
      </button>
    ))}
  </div>
</div>
```

- [ ] **Step 6: Substituir o bloco de comparison filter pela versão com sub-filtro**

Localizar o bloco `{/* Comparison filter — mutually exclusive */}` (linhas 201–229) e substituir:

```tsx
{/* Comparison filter */}
<div>
  <p className="text-caption text-muted-foreground mb-1.5">Comparar com</p>
  <div className="flex gap-1.5">
    {([
      { key: 'all' as ComparisonFilter,          label: 'Todos',       icon: Users,        disabled: false },
      { key: 'same_specialty' as ComparisonFilter, label: userSpecialty || 'Especialidade', icon: Stethoscope, disabled: !userSpecialty },
    ]).map((f) => (
      <button
        key={f.key}
        onClick={() => !f.disabled && setComparisonFilter(f.key)}
        disabled={f.disabled}
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-caption font-medium transition-all',
          (comparisonFilter === f.key ||
            (f.key === 'same_specialty' && comparisonFilter === 'same_institution'))
            ? 'bg-primary text-primary-foreground'
            : f.disabled
            ? 'bg-muted/50 text-muted-foreground/50 cursor-not-allowed'
            : 'bg-muted text-muted-foreground hover:bg-muted/80',
        )}
        title={f.disabled ? 'Configure nas Configurações' : undefined}
      >
        <f.icon className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{f.label}</span>
      </button>
    ))}
  </div>

  {/* Sub-filtro de instituição — só quando especialidade está ativo */}
  {comparisonFilter !== 'all' && (
    <div className="mt-2 flex items-center gap-2 border-t border-border pt-2.5">
      <span className="text-caption text-muted-foreground">Restringir à:</span>
      <button
        onClick={() =>
          setComparisonFilter(
            comparisonFilter === 'same_institution' ? 'same_specialty' : 'same_institution'
          )
        }
        disabled={userInstitutions.length === 0}
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-caption font-medium transition-all',
          comparisonFilter === 'same_institution'
            ? 'bg-primary text-primary-foreground'
            : userInstitutions.length === 0
            ? 'bg-muted/50 text-muted-foreground/50 cursor-not-allowed'
            : 'bg-muted text-muted-foreground hover:bg-muted/80',
        )}
        title={userInstitutions.length === 0 ? 'Configure nas Configurações' : undefined}
      >
        <Building className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{userInstitutions[0] || 'Instituição'}</span>
      </button>
    </div>
  )}
</div>
```

- [ ] **Step 7: Remover bloco `comparisonFilter !== 'all'` de info textual antiga (se ainda presente)**

Localizar (linhas 257–272) o bloco que exibe texto informativo sobre o filtro ativo:
```tsx
{comparisonFilter !== 'all' && (
  <p className="text-caption text-muted-foreground mt-3 flex items-center gap-1.5">
    ...
  </p>
)}
```
**Manter** esse bloco — ele ainda funciona com `same_specialty` e `same_institution` e dá contexto ao usuário. Nenhuma alteração necessária.

- [ ] **Step 8: Verificar build**

```bash
npm run build 2>&1 | tail -5
```
Esperado: sem erros.

- [ ] **Step 9: Rodar todos os testes**

```bash
npm run test --run 2>&1 | tail -20
```
Esperado: todos PASS.

- [ ] **Step 10: Commit**

```bash
git add src/pages/RankingPage.tsx src/pages/RankingPage.test.ts
git commit -m "feat: RankingPage — segmento por tipo de usuário e instituição como sub-filtro"
```

---

## Self-review checklist

| Requisito do spec | Task |
|-------------------|------|
| Ordering DESC | Task 1 |
| LogoPro placeholder | Task 2 |
| heroEyebrow/Title/Subtitle | Task 2 |
| MobileHeaderAndHero copy | Task 2 |
| isLocked — card opaco + badge PRO | Task 3 |
| isLocked — CTA bloqueado | Task 3 |
| isLocked — click redireciona para PRO_ENAMED_URL | Task 3 |
| worstArea badge vermelho | Task 3 |
| SimuladosPage computa isLocked + worstArea | Task 4 |
| Passa props para todos os cards | Task 4 |
| HeroPerformanceCard recebe segmentFilter | Task 5 |
| Label `${rankingTitle} · ${segmentLabel}` | Task 5 |
| Empty state com CTA para /ranking | Task 5 |
| RankingPage — guest vê só "Todos" | Task 6 |
| RankingPage — standard vê "Todos" + "Aluno SanarFlix" | Task 6 |
| RankingPage — pro vê os três | Task 6 |
| Reset automático de segmentFilter inválido | Task 6 |
| Instituição como sub-filtro de especialidade | Task 6 |
| Globe + Crown importados no RankingPage | Task 6 |
