# Flashcards UX v2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesenhar a experiência de flashcards: preview com flip no clique, grid de cards verticais, 5 modos de revisão de treino (sem gravar SRS) e CTAs de criação destacados no corpo da página.

**Architecture:** Um único motor de sessão (`FlashcardReviewSession`) parametrizado por `mode`; pools de cards calculados por funções puras em `src/lib/flashcardReviewModes.ts`; novos componentes de apresentação (`FlashcardPreviewModal`, `ReviewModesHub`, `CreateActionsRow`) compostos em `CadernoFlashcardsPage`. Zero mudança de backend.

**Tech Stack:** React 18 + TypeScript, Framer Motion, TanStack Query, shadcn/Radix (`AdaptiveModal`), Tailwind com tokens `--c-*` do Caderno, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-11-flashcards-ux-v2-design.md`

**Convenções do projeto (ler antes):**
- Alias `@/` → `src/`. Nunca paths relativos longos.
- Logging: `import { logger } from '@/lib/logger'` — nunca `console.log`.
- Toasts: `import { toast } from '@/hooks/use-toast'`.
- Tokens de cor do Caderno: `var(--c-ink)`, `var(--c-muted)`, `var(--c-surface)`, `var(--c-wine-500)` etc. NÃO usar `bg-[var(--x)]/40` (Tailwind v3 descarta opacity sobre var) — usar `color-mix(in_srgb, ...)` como o código existente faz.
- Testes: Vitest, arquivos `*.test.ts` ao lado do código, em PT-BR (`it('mantém...')`), rodar com `npx vitest run <path>`.

---

### Task 1: Tipo `ReviewMode` + lib de modos com testes (TDD)

**Files:**
- Modify: `src/types/caderno.ts` (após a interface `Flashcard`, ~linha 184)
- Create: `src/lib/flashcardReviewModes.ts`
- Test: `src/lib/flashcardReviewModes.test.ts`

- [ ] **Step 1: Adicionar o tipo `ReviewMode` em `src/types/caderno.ts`**

Logo após o fechamento da interface `Flashcard` (linha 184):

```typescript
/** Modos de sessão de revisão de flashcards. Só `due` grava SRS. */
export type ReviewMode = 'due' | 'free' | 'hard' | 'shuffle' | 'reversed' | 'timed';
```

- [ ] **Step 2: Escrever os testes que falham**

Criar `src/lib/flashcardReviewModes.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import type { Flashcard } from '@/types/caderno';
import {
  REVIEW_MODE_CONFIGS,
  HARD_EASE_THRESHOLD,
  SHUFFLE_POOL_SIZE,
  TIMED_SESSION_SECONDS,
  filterFreePool,
  filterHardCards,
  shuffleCards,
  buildReviewPool,
} from './flashcardReviewModes';

/** Factory de flashcard com defaults seguros. */
function makeCard(overrides: Partial<Flashcard> = {}): Flashcard {
  return {
    id: 'c1',
    deck_id: 'd1',
    user_id: 'u1',
    front_md: 'Pergunta',
    back_md: 'Resposta',
    front_image_url: null,
    back_image_url: null,
    entry_id: null,
    question_id: null,
    srs_due_at: null,
    srs_interval: 0,
    srs_reps: 0,
    srs_ease: 2.5,
    mastered_at: null,
    created_at: '2026-06-01T00:00:00Z',
    updated_at: '2026-06-01T00:00:00Z',
    deleted_at: null,
    ...overrides,
  };
}

describe('REVIEW_MODE_CONFIGS', () => {
  it('só o modo due grava SRS', () => {
    expect(REVIEW_MODE_CONFIGS.due.writesSrs).toBe(true);
    (['free', 'hard', 'shuffle', 'reversed', 'timed'] as const).forEach((m) => {
      expect(REVIEW_MODE_CONFIGS[m].writesSrs).toBe(false);
    });
  });
  it('só o modo reversed inverte a direção', () => {
    expect(REVIEW_MODE_CONFIGS.reversed.reversed).toBe(true);
    (['due', 'free', 'hard', 'shuffle', 'timed'] as const).forEach((m) => {
      expect(REVIEW_MODE_CONFIGS[m].reversed).toBe(false);
    });
  });
  it('só o modo timed tem timer', () => {
    expect(REVIEW_MODE_CONFIGS.timed.timerSeconds).toBe(TIMED_SESSION_SECONDS);
    (['due', 'free', 'hard', 'shuffle', 'reversed'] as const).forEach((m) => {
      expect(REVIEW_MODE_CONFIGS[m].timerSeconds).toBeNull();
    });
  });
});

describe('filterFreePool', () => {
  it('exclui cards dominados', () => {
    const cards = [
      makeCard({ id: 'a' }),
      makeCard({ id: 'b', mastered_at: '2026-06-01T00:00:00Z' }),
    ];
    expect(filterFreePool(cards).map((c) => c.id)).toEqual(['a']);
  });
});

describe('filterHardCards', () => {
  it('inclui cards revisados com ease baixo', () => {
    const card = makeCard({ srs_reps: 2, srs_ease: HARD_EASE_THRESHOLD });
    expect(filterHardCards([card])).toHaveLength(1);
  });
  it('exclui cards nunca revisados (reps = 0), mesmo com ease baixo', () => {
    const card = makeCard({ srs_reps: 0, srs_ease: 1.5 });
    expect(filterHardCards([card])).toHaveLength(0);
  });
  it('exclui cards com ease acima do threshold', () => {
    const card = makeCard({ srs_reps: 3, srs_ease: 2.5 });
    expect(filterHardCards([card])).toHaveLength(0);
  });
  it('exclui cards dominados', () => {
    const card = makeCard({
      srs_reps: 3,
      srs_ease: 1.8,
      mastered_at: '2026-06-01T00:00:00Z',
    });
    expect(filterHardCards([card])).toHaveLength(0);
  });
});

describe('shuffleCards', () => {
  it('preserva todos os elementos', () => {
    const cards = ['a', 'b', 'c', 'd'].map((id) => makeCard({ id }));
    const shuffled = shuffleCards(cards, () => 0.5);
    expect(shuffled.map((c) => c.id).sort()).toEqual(['a', 'b', 'c', 'd']);
  });
  it('não muta o array original', () => {
    const cards = ['a', 'b', 'c'].map((id) => makeCard({ id }));
    const original = [...cards];
    shuffleCards(cards, () => 0);
    expect(cards).toEqual(original);
  });
});

describe('buildReviewPool', () => {
  const cards = [
    makeCard({ id: 'novo', srs_reps: 0, srs_ease: 2.5 }),
    makeCard({ id: 'dificil', srs_reps: 2, srs_ease: 1.9 }),
    makeCard({ id: 'dominado', mastered_at: '2026-06-01T00:00:00Z' }),
    ...Array.from({ length: 12 }, (_, i) =>
      makeCard({ id: `extra-${i}`, srs_reps: 1, srs_ease: 2.5 }),
    ),
  ];

  it('free: todos os não-dominados', () => {
    const pool = buildReviewPool('free', cards);
    expect(pool).toHaveLength(14);
    expect(pool.find((c) => c.id === 'dominado')).toBeUndefined();
  });
  it('hard: só os difíceis', () => {
    expect(buildReviewPool('hard', cards).map((c) => c.id)).toEqual(['dificil']);
  });
  it('shuffle: no máximo SHUFFLE_POOL_SIZE cards', () => {
    expect(buildReviewPool('shuffle', cards, () => 0.5)).toHaveLength(SHUFFLE_POOL_SIZE);
  });
  it('shuffle: pool menor que o limite retorna o pool inteiro', () => {
    const few = cards.slice(0, 3);
    expect(buildReviewPool('shuffle', few, () => 0.5).length).toBeLessThanOrEqual(3);
  });
  it('reversed: mesmo pool do free', () => {
    expect(buildReviewPool('reversed', cards)).toHaveLength(14);
  });
  it('timed: pool inteiro embaralhado (preserva elementos)', () => {
    const pool = buildReviewPool('timed', cards, () => 0.5);
    expect(pool.map((c) => c.id).sort()).toEqual(
      buildReviewPool('free', cards).map((c) => c.id).sort(),
    );
  });
  it('due: retorna [] — pool do due vem de getDueFlashcards(), não daqui', () => {
    expect(buildReviewPool('due', cards)).toEqual([]);
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run src/lib/flashcardReviewModes.test.ts`
Expected: FAIL — "Cannot find module './flashcardReviewModes'"

- [ ] **Step 4: Implementar `src/lib/flashcardReviewModes.ts`**

```typescript
/**
 * flashcardReviewModes — config e filtros de pool dos modos de revisão.
 *
 * Funções puras (testáveis sem DOM). Só o modo `due` grava SRS;
 * os demais são treino (estado local + analytics).
 * O pool do modo `due` vem de simuladosApi.getDueFlashcards() — não daqui.
 */

import type { Flashcard, ReviewMode } from '@/types/caderno';

/** Ease ≤ threshold marca card como "difícil" (SM-2: errei/difícil abaixam o ease). */
export const HARD_EASE_THRESHOLD = 2.1;
/** Tamanho da sessão aleatória. */
export const SHUFFLE_POOL_SIZE = 10;
/** Duração da sessão cronometrada (segundos). */
export const TIMED_SESSION_SECONDS = 5 * 60;

export interface ReviewModeConfig {
  id: ReviewMode;
  label: string;
  description: string;
  /** true = mostra o verso primeiro (verso → frente). */
  reversed: boolean;
  /** Só `due` persiste o agendamento via scheduleFlashcardReview. */
  writesSrs: boolean;
  /** Duração em segundos, ou null para sessão sem timer. */
  timerSeconds: number | null;
}

export const REVIEW_MODE_CONFIGS: Record<ReviewMode, ReviewModeConfig> = {
  due: {
    id: 'due',
    label: 'Revisar devidos',
    description: 'Repetição espaçada — os cards na hora certa de lembrar.',
    reversed: false,
    writesSrs: true,
    timerSeconds: null,
  },
  free: {
    id: 'free',
    label: 'Estudo livre',
    description: 'Todos os cards do deck, sem afetar o agendamento.',
    reversed: false,
    writesSrs: false,
    timerSeconds: null,
  },
  hard: {
    id: 'hard',
    label: 'Difíceis',
    description: 'Foco nos cards que você errou ou achou difícil.',
    reversed: false,
    writesSrs: false,
    timerSeconds: null,
  },
  shuffle: {
    id: 'shuffle',
    label: 'Aleatório',
    description: `Sessão rápida com ${SHUFFLE_POOL_SIZE} cards sorteados.`,
    reversed: false,
    writesSrs: false,
    timerSeconds: null,
  },
  reversed: {
    id: 'reversed',
    label: 'Invertido',
    description: 'Veja a resposta e lembre a pergunta.',
    reversed: true,
    writesSrs: false,
    timerSeconds: null,
  },
  timed: {
    id: 'timed',
    label: 'Cronometrado',
    description: 'O máximo de cards em 5 minutos.',
    reversed: false,
    writesSrs: false,
    timerSeconds: TIMED_SESSION_SECONDS,
  },
};

/** Pool base de treino: cards não-dominados. */
export function filterFreePool(cards: Flashcard[]): Flashcard[] {
  return cards.filter((c) => !c.mastered_at);
}

/** Cards difíceis: já revisados (reps > 0), ease baixo, não-dominados. */
export function filterHardCards(cards: Flashcard[]): Flashcard[] {
  return cards.filter(
    (c) => !c.mastered_at && c.srs_reps > 0 && c.srs_ease <= HARD_EASE_THRESHOLD,
  );
}

/** Fisher–Yates imutável. `rng` injetável para testes. */
export function shuffleCards<T>(items: T[], rng: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Monta o pool de cards do modo a partir da lista visível (deck atual ou todos).
 * Para `due`, retorna [] — a página usa getDueFlashcards().
 */
export function buildReviewPool(
  mode: ReviewMode,
  cards: Flashcard[],
  rng: () => number = Math.random,
): Flashcard[] {
  switch (mode) {
    case 'free':
    case 'reversed':
      return filterFreePool(cards);
    case 'hard':
      return filterHardCards(cards);
    case 'shuffle':
      return shuffleCards(filterFreePool(cards), rng).slice(0, SHUFFLE_POOL_SIZE);
    case 'timed':
      return shuffleCards(filterFreePool(cards), rng);
    case 'due':
    default:
      return [];
  }
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run src/lib/flashcardReviewModes.test.ts`
Expected: PASS (todos os testes)

- [ ] **Step 6: Commit**

```bash
git add src/types/caderno.ts src/lib/flashcardReviewModes.ts src/lib/flashcardReviewModes.test.ts
git commit -m "feat(flashcards): lib de modos de revisao com filtros de pool testados"
```

---

### Task 2: Extrair `CardFace` para arquivo próprio

**Files:**
- Create: `src/components/caderno/flashcards/CardFace.tsx`
- Modify: `src/components/caderno/flashcards/FlashcardReviewSession.tsx` (remover CardFace local, linhas 85–144)

- [ ] **Step 1: Criar `src/components/caderno/flashcards/CardFace.tsx`**

Mover o componente `CardFace` e sua interface de `FlashcardReviewSession.tsx` (linhas 85–144) **sem alterar o render**. Conteúdo completo do arquivo novo:

```tsx
/**
 * CardFace — uma face (frente ou verso) de um flashcard.
 * Usado pela FlashcardReviewSession e pelo FlashcardPreviewModal.
 * Render markdown + imagem opcional + badge da face.
 */

import ReactMarkdown from 'react-markdown';
import { Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CardFaceProps {
  md: string;
  imageUrl: string | null;
  faceLabel: 'Frente' | 'Verso';
  isMobile: boolean;
}

export function CardFace({ md, imageUrl, faceLabel, isMobile }: CardFaceProps) {
  const isBack = faceLabel === 'Verso';
  return (
    <div
      className={cn(
        'flex flex-col gap-4',
        isMobile ? 'min-h-[240px] p-6' : 'min-h-[280px] p-8 sm:min-h-[320px]',
      )}
    >
      {/* Face label badge */}
      <span
        className={cn(
          'self-start rounded-[var(--c-radius-pill)] px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em]',
          isBack
            ? 'bg-[var(--c-surface-2)] text-[var(--c-muted)]'
            : 'bg-[var(--c-wine-50)] text-[var(--c-wine-600)]',
        )}
      >
        {faceLabel}
      </span>

      {/* Image */}
      {imageUrl ? (
        <div className="overflow-hidden rounded-xl border border-[var(--c-border)]">
          <img
            src={imageUrl}
            alt={`Imagem do ${faceLabel.toLowerCase()} do flashcard`}
            className="max-h-48 w-full object-contain"
          />
        </div>
      ) : null}

      {/* Content */}
      {md.trim() ? (
        <div
          className={cn(
            'prose dark:prose-invert max-w-none flex-1',
            isMobile ? 'prose-sm text-[14px] leading-relaxed' : 'prose-base text-[15px] leading-relaxed',
          )}
        >
          <ReactMarkdown>{md}</ReactMarkdown>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center gap-2 text-[var(--c-muted-2)]">
          <ImageIcon className="h-5 w-5" aria-hidden />
          <span className="text-[13px] italic">(conteúdo vazio)</span>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Atualizar `FlashcardReviewSession.tsx`**

Remover o bloco `/* ── CardFace ── */` (interface + componente, linhas 85–144) e adicionar o import:

```tsx
import { CardFace } from './CardFace';
```

`ReactMarkdown` deixa de ser usado no arquivo — remover também `import ReactMarkdown from 'react-markdown';`. O ícone `Image as ImageIcon` do lucide também sai do import se não houver outro uso (verificar com busca no arquivo).

- [ ] **Step 3: Verificar build/lint**

Run: `npx tsc --noEmit && npm run lint -- --quiet`
Expected: sem erros novos (warnings pré-existentes ok)

- [ ] **Step 4: Commit**

```bash
git add src/components/caderno/flashcards/CardFace.tsx src/components/caderno/flashcards/FlashcardReviewSession.tsx
git commit -m "refactor(flashcards): extrai CardFace para reuso no preview modal"
```

---

### Task 3: Parametrizar `FlashcardReviewSession` com `mode`

**Files:**
- Modify: `src/components/caderno/flashcards/FlashcardReviewSession.tsx`

A sessão ganha: prop `mode` (default `'due'`), direção invertida, timer do modo cronometrado, banner de treino, e grava SRS **somente** quando `config.writesSrs`.

- [ ] **Step 1: Atualizar imports e props**

```tsx
import { REVIEW_MODE_CONFIGS, type ReviewModeConfig } from '@/lib/flashcardReviewModes';
import type { Flashcard, FlashcardReviewOutcome, ReviewMode, SrsState } from '@/types/caderno';
```

(Adicionar `Timer` e `Dumbbell` ao import do lucide-react.)

```tsx
export interface FlashcardReviewSessionProps {
  cards: Flashcard[];
  /** Modo da sessão. Default 'due' (comportamento original, grava SRS). */
  mode?: ReviewMode;
  onFinish: () => void;
}

export function FlashcardReviewSession({ cards, mode = 'due', onFinish }: FlashcardReviewSessionProps) {
  const config: ReviewModeConfig = REVIEW_MODE_CONFIGS[mode];
  const isTraining = !config.writesSrs;
  // ... estado existente
```

- [ ] **Step 2: Direção invertida**

A face mostrada antes de revelar é a frente — exceto no modo invertido. Derivar as faces no corpo do componente, logo após `const currentCard = cards[currentIndex];`:

```tsx
  // Modo invertido mostra o verso primeiro e pede a frente.
  const firstFace = config.reversed
    ? { md: currentCard?.back_md ?? '', imageUrl: currentCard?.back_image_url ?? null, label: 'Verso' as const }
    : { md: currentCard?.front_md ?? '', imageUrl: currentCard?.front_image_url ?? null, label: 'Frente' as const };
  const secondFace = config.reversed
    ? { md: currentCard?.front_md ?? '', imageUrl: currentCard?.front_image_url ?? null, label: 'Frente' as const }
    : { md: currentCard?.back_md ?? '', imageUrl: currentCard?.back_image_url ?? null, label: 'Verso' as const };
```

E nos dois `<CardFace>` do JSX, trocar as props hardcoded por:

```tsx
{/* card não revelado */}
<CardFace md={firstFace.md} imageUrl={firstFace.imageUrl} faceLabel={firstFace.label} isMobile={isMobile} />
{/* card revelado */}
<CardFace md={secondFace.md} imageUrl={secondFace.imageUrl} faceLabel={secondFace.label} isMobile={isMobile} />
```

- [ ] **Step 3: SRS condicional no `handleGrade`**

Substituir o corpo do `try` em `handleGrade` para só chamar a API quando `config.writesSrs`:

```tsx
  const handleGrade = useCallback(
    async (outcome: FlashcardReviewOutcome) => {
      if (grading || !currentCard) return;
      setGrading(true);
      try {
        if (config.writesSrs) {
          const srs: SrsState = await simuladosApi.scheduleFlashcardReview(currentCard.id, outcome);
          trackEvent('caderno_flashcard_reviewed', {
            flashcard_id: currentCard.id,
            outcome,
            mode,
            mastered: srs.mastered,
            srs_interval: srs.srsInterval,
          });
        } else {
          trackEvent('caderno_flashcard_reviewed', {
            flashcard_id: currentCard.id,
            outcome,
            mode,
            training: true,
          } as any);
        }
        setResults((prev) => ({ ...prev, [outcome]: (prev[outcome] ?? 0) + 1 }));
      } catch (err) {
        logger.error('[FlashcardReviewSession] Error scheduling review:', err);
        toast({ title: 'Erro ao registrar avaliação', description: 'Tente novamente.', variant: 'destructive' });
        setGrading(false);
        return;
      }
      const next = currentIndex + 1;
      if (next >= cards.length) {
        setDone(true);
      } else {
        setFlipDir('back');
        setCurrentIndex(next);
        setRevealed(false);
      }
      setGrading(false);
    },
    [currentCard, currentIndex, cards.length, grading, config.writesSrs, mode],
  );
```

- [ ] **Step 4: Timer do modo cronometrado**

Estado + efeito (junto dos outros `useState`):

```tsx
  const [secondsLeft, setSecondsLeft] = useState<number | null>(config.timerSeconds);

  // Countdown do modo cronometrado: ao zerar, encerra a sessão.
  useEffect(() => {
    if (secondsLeft === null || done) return;
    if (secondsLeft <= 0) {
      setDone(true);
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => (s === null ? null : s - 1)), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft, done]);

  const formatTime = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
```

No header da sessão (ao lado do contador `{currentIndex + 1} / {cards.length}`), exibir o timer quando existir:

```tsx
        <div className="flex items-center gap-3">
          {secondsLeft !== null && (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-[var(--c-radius-pill)] border px-2.5 py-1 text-[12px] font-bold tabular-nums',
                secondsLeft <= 30
                  ? 'border-red-500/30 bg-red-500/10 text-red-500'
                  : 'border-[var(--c-border)] bg-[var(--c-surface-2)] text-[var(--c-ink)]',
              )}
              aria-label={`Tempo restante: ${formatTime(secondsLeft)}`}
            >
              <Timer className="h-3.5 w-3.5" aria-hidden />
              {formatTime(secondsLeft)}
            </span>
          )}
          <span className="text-[13px] font-bold tabular-nums text-[var(--c-muted)]">
            {currentIndex + 1}
            <span className="font-normal opacity-60"> / {cards.length}</span>
          </span>
        </div>
```

- [ ] **Step 5: Banner de treino**

Logo abaixo da `<ProgressBar>`, renderizar quando `isTraining`:

```tsx
      {isTraining && (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-[var(--c-border)] bg-[var(--c-surface-2)] px-3 py-2">
          <Dumbbell className="h-3.5 w-3.5 shrink-0 text-[var(--c-muted)]" aria-hidden />
          <p className="text-[11.5px] font-medium text-[var(--c-muted)]">
            <span className="font-bold text-[var(--c-ink)]">{config.label}</span>
            {' · '}modo treino — não altera seu agendamento
          </p>
        </div>
      )}
```

- [ ] **Step 6: Summary com modo e tempo**

`SessionSummary` ganha props `modeLabel: string` e `timedSeconds: number | null`. No subtítulo:

```tsx
interface SessionSummaryProps {
  total: number;
  results: Record<FlashcardReviewOutcome, number>;
  removedCount: number;
  modeLabel: string;
  timedSeconds: number | null;
  onFinish: () => void;
}
```

```tsx
        <p className="mt-1.5 text-[14px] text-[var(--c-muted)]">
          {modeLabel}
          {' — '}
          {total} {total === 1 ? 'flashcard revisado' : 'flashcards revisados'}
          {timedSeconds !== null && ` em ${Math.floor(timedSeconds / 60)}:${String(timedSeconds % 60).padStart(2, '0')}`}
        </p>
```

No call site do summary (o `total` passa a ser o nº efetivamente revisado, pois o timed pode encerrar antes do fim do pool):

```tsx
  if (done) {
    const reviewedCount = Object.values(results).reduce((a, b) => a + b, 0);
    return (
      <SessionSummary
        total={reviewedCount}
        results={results}
        removedCount={removedCount}
        modeLabel={config.label}
        timedSeconds={config.timerSeconds !== null ? config.timerSeconds - (secondsLeft ?? 0) : null}
        onFinish={onFinish}
      />
    );
  }
```

A frase "Revisão reagendada." do summary só vale quando grava SRS — condicionar: `{mastered > 0 && (<p>... {writesSrs ? 'Revisão reagendada.' : ''}</p>)}`. Passar `writesSrs` não é necessário: simplificar trocando o texto fixo por `modeLabel === 'Revisar devidos' ? ' Revisão reagendada.' : ''` é frágil — **preferir** adicionar prop `writesSrs: boolean` ao `SessionSummary` e usar:

```tsx
      {mastered > 0 && (
        <p className="text-[13px] text-[var(--c-muted)]">
          <span className="font-bold text-[var(--c-ink)]">{mastered}</span>{' '}
          {mastered === 1 ? 'card com bom desempenho' : 'cards com bom desempenho'}.
          {writesSrs && ' Revisão reagendada.'}
        </p>
      )}
```

- [ ] **Step 7: Verificar**

Run: `npx tsc --noEmit && npx vitest run`
Expected: compila; testes existentes passam

- [ ] **Step 8: Commit**

```bash
git add src/components/caderno/flashcards/FlashcardReviewSession.tsx
git commit -m "feat(flashcards): sessao parametrizada por modo (treino, invertido, timer)"
```

---

### Task 4: `FlashcardPreviewModal`

**Files:**
- Create: `src/components/caderno/flashcards/FlashcardPreviewModal.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
/**
 * FlashcardPreviewModal — preview de um flashcard com flip (frente → verso).
 *
 * Aberto ao clicar no card da listagem. Mostra só a frente; "Mostrar resposta"
 * (ou Espaço) revela o verso. Editar/Excluir no rodapé.
 * Desktop: Dialog. Mobile: bottom sheet (via AdaptiveModal).
 */

import { useEffect, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { AdaptiveModal } from '@/components/caderno/ui';
import { CardFace } from './CardFace';
import { useIsMobile } from '@/hooks/useIsMobile';
import type { Flashcard } from '@/types/caderno';

export interface FlashcardPreviewModalProps {
  card: Flashcard;
  onEdit: (card: Flashcard) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export function FlashcardPreviewModal({ card, onEdit, onDelete, onClose }: FlashcardPreviewModalProps) {
  const prefersReducedMotion = useReducedMotion();
  const isMobile = useIsMobile();
  const [revealed, setRevealed] = useState(false);

  // Espaço revela o verso (paridade com a sessão de revisão).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === ' ' && !revealed) {
        e.preventDefault();
        setRevealed(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [revealed]);

  const flip = prefersReducedMotion
    ? { initial: {}, animate: { opacity: 1, rotateY: 0 }, exit: {} }
    : {
        initial: { opacity: 0, rotateY: -90 },
        animate: { opacity: 1, rotateY: 0 },
        exit: { opacity: 0, rotateY: 90 },
      };

  return (
    <AdaptiveModal
      open
      onOpenChange={(open) => { if (!open) onClose(); }}
      title="Flashcard"
      size="lg"
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { onClose(); onDelete(card.id); }}
            className="gap-1.5 text-[var(--c-muted)] hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
            Excluir
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { onClose(); onEdit(card); }}
              className="gap-1.5 border-[color-mix(in_srgb,var(--c-wine-500)_25%,transparent)] text-[var(--c-wine-600)] hover:border-[var(--c-wine-400)] hover:bg-[var(--c-wine-50)]"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden />
              Editar
            </Button>
            {!revealed && (
              <Button
                size="sm"
                onClick={() => setRevealed(true)}
                className="bg-gradient-to-r from-[var(--c-wine-500)] to-[var(--c-wine-700)] text-white shadow-[var(--c-shadow-glow)] hover:opacity-90"
              >
                Mostrar resposta
                {!isMobile && (
                  <kbd className="ml-2 rounded border border-white/20 bg-white/10 px-1.5 py-0.5 text-[10px] font-mono">
                    Espaço
                  </kbd>
                )}
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div style={{ perspective: '1400px' }} className="py-1">
        <AnimatePresence mode="wait">
          {!revealed ? (
            <motion.div
              key="front"
              initial={false}
              animate={flip.animate}
              exit={flip.exit}
              transition={{ duration: prefersReducedMotion ? 0 : 0.3, ease: [0.22, 1, 0.36, 1] }}
              onClick={() => setRevealed(true)}
              className={cn(
                'cursor-pointer overflow-hidden rounded-[var(--c-radius-card)] border bg-[var(--c-surface)]',
                'border-[color-mix(in_srgb,var(--c-wine-500)_15%,transparent)] shadow-[var(--c-shadow-sm)]',
                'active:scale-[0.99]',
              )}
              role="button"
              aria-label="Mostrar resposta"
            >
              <CardFace md={card.front_md} imageUrl={card.front_image_url} faceLabel="Frente" isMobile={isMobile} />
            </motion.div>
          ) : (
            <motion.div
              key="back"
              initial={flip.initial}
              animate={flip.animate}
              transition={{ duration: prefersReducedMotion ? 0 : 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden rounded-[var(--c-radius-card)] border border-[var(--c-border)] bg-[var(--c-surface-2)] shadow-[var(--c-shadow-sm)]"
            >
              <CardFace md={card.back_md} imageUrl={card.back_image_url} faceLabel="Verso" isMobile={isMobile} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AdaptiveModal>
  );
}
```

- [ ] **Step 2: Verificar compilação**

Run: `npx tsc --noEmit`
Expected: sem erros

- [ ] **Step 3: Commit**

```bash
git add src/components/caderno/flashcards/FlashcardPreviewModal.tsx
git commit -m "feat(flashcards): preview modal com flip frente/verso"
```

---

### Task 5: Redesign do `FlashcardItem` (card vertical de grid)

**Files:**
- Modify: `src/components/caderno/flashcards/FlashcardItem.tsx` (reescrever)

Mudanças: card vertical com cara de carta; imagem vira capa; **sem preview do verso**; clique chama `onPreview` (novo) em vez de `onEdit`; ações no canto superior direito.

- [ ] **Step 1: Reescrever o componente**

Conteúdo completo do arquivo:

```tsx
/**
 * FlashcardItem — carta vertical do flashcard no grid.
 *
 * Clique abre o preview (flip) — edição só pelo lápis.
 * Sem preview da resposta: a frente é a estrela.
 * Imagem da frente vira capa quando existe.
 */

import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Pencil, Trash2, Star, Clock, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CadernoCard } from '@/components/caderno/ui';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { Flashcard } from '@/types/caderno';

/* ── SRS helpers ── */

function formatSrsDue(dueDateStr: string | null): {
  label: string;
  variant: 'due' | 'scheduled' | 'new';
} {
  if (!dueDateStr) return { label: 'Nova', variant: 'new' };
  const due = new Date(dueDateStr);
  const now = new Date();
  if (due <= now) return { label: 'Devida', variant: 'due' };
  const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 1) return { label: 'Amanhã', variant: 'scheduled' };
  return { label: `Em ${diffDays}d`, variant: 'scheduled' };
}

const SRS_VARIANT_STYLES = {
  due: {
    chip: 'bg-orange-500/12 text-orange-500 border-orange-500/20',
    icon: Zap,
  },
  scheduled: {
    chip: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    icon: Clock,
  },
  new: {
    chip: 'bg-[var(--c-surface-2)] text-[var(--c-muted)] border-[var(--c-border)]',
    icon: Star,
  },
} as const;

/* ── Props ── */

export interface FlashcardItemProps {
  card: Flashcard;
  onPreview: (card: Flashcard) => void;
  onEdit: (card: Flashcard) => void;
  onDelete: (id: string) => void;
}

/* ── Component ── */

export function FlashcardItem({ card, onPreview, onEdit, onDelete }: FlashcardItemProps) {
  const prefersReducedMotion = useReducedMotion();
  const [deleteHovered, setDeleteHovered] = useState(false);

  const srs = formatSrsDue(card.srs_due_at);
  const isMastered = !!card.mastered_at;
  const srsStyle = isMastered
    ? { chip: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20', icon: Star }
    : SRS_VARIANT_STYLES[srs.variant];
  const SrsIcon = srsStyle.icon;
  const srsLabel = isMastered ? 'Dominado' : srs.label;

  const cleanFront = card.front_md.replace(/[#*_`[\]]/g, '').trim() || '(frente vazia)';

  return (
    <motion.div
      layout={!prefersReducedMotion}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={prefersReducedMotion ? undefined : { opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className="h-full"
    >
      <CadernoCard
        variant="interactive"
        className={cn(
          'group relative flex h-full flex-col overflow-hidden',
          isMastered && 'opacity-60',
        )}
        onClick={() => onPreview(card)}
        tabIndex={0}
        role="button"
        aria-label={`Ver flashcard: ${cleanFront}`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onPreview(card);
          }
        }}
      >
        {/* Capa (imagem da frente) */}
        {card.front_image_url && (
          <div className="h-28 w-full overflow-hidden border-b border-[var(--c-border)] bg-[var(--c-surface-2)]">
            <img
              src={card.front_image_url}
              alt=""
              aria-hidden
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          </div>
        )}

        {/* Pergunta */}
        <div className="flex flex-1 flex-col gap-3 p-4">
          <p
            className={cn(
              'line-clamp-3 text-[14px] font-semibold leading-snug text-[var(--c-ink)]',
              !card.front_image_url && 'min-h-[3.5rem]',
            )}
          >
            {cleanFront}
          </p>

          {/* Rodapé: badge SRS + revisões */}
          <div className="mt-auto flex items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-[var(--c-radius-pill)] border px-2 py-0.5 text-[10px] font-bold',
                srsStyle.chip,
              )}
            >
              <SrsIcon className="h-2.5 w-2.5" strokeWidth={2.5} aria-hidden />
              {srsLabel}
            </span>
            {card.srs_reps > 0 && (
              <span className="text-[10px] text-[var(--c-muted-2)]">
                {card.srs_reps} {card.srs_reps === 1 ? 'revisão' : 'revisões'}
              </span>
            )}
          </div>
        </div>

        {/* Ações — hover no desktop, sempre visíveis no mobile (sm:) */}
        <div
          className={cn(
            'absolute right-2 top-2 flex gap-1 rounded-lg bg-[color-mix(in_srgb,var(--c-surface)_85%,transparent)] p-0.5 backdrop-blur-sm',
            'opacity-100 transition-opacity duration-150 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100',
          )}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <Tooltip delayDuration={400}>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="Editar flashcard"
                onClick={(e) => { e.stopPropagation(); onEdit(card); }}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-[var(--c-radius-control)]',
                  'text-[var(--c-muted)] transition-colors duration-150',
                  'hover:bg-[var(--c-surface-2)] hover:text-[var(--c-ink)]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--c-wine-500)_50%,transparent)]',
                )}
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Editar</TooltipContent>
          </Tooltip>

          <Tooltip delayDuration={400}>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="Excluir flashcard"
                onMouseEnter={() => setDeleteHovered(true)}
                onMouseLeave={() => setDeleteHovered(false)}
                onClick={(e) => { e.stopPropagation(); onDelete(card.id); }}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-[var(--c-radius-control)]',
                  'transition-colors duration-150',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/50',
                  deleteHovered
                    ? 'bg-destructive/10 text-destructive'
                    : 'text-[var(--c-muted)] hover:bg-[var(--c-surface-2)] hover:text-[var(--c-ink)]',
                )}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Excluir</TooltipContent>
          </Tooltip>
        </div>
      </CadernoCard>
    </motion.div>
  );
}
```

Nota: o TypeScript vai acusar erro no call site da página (falta `onPreview`) até a Task 8 — esperado; a Task 8 fecha a integração. Se preferir manter `tsc` verde em todo commit, executar Task 5 e Task 8 no mesmo commit — decisão do executor; o padrão aqui é commitar junto com a Task 8 **ou** passar `onPreview={handleOpenEditor}` provisório. **Escolha do plano: commit da Task 5 só após a Task 8** (não comitar nada nesta task; o diff fica staged junto).

- [ ] **Step 2: Verificação parcial**

Run: `npx tsc --noEmit`
Expected: erro apenas em `CadernoFlashcardsPage.tsx` (prop `onPreview` ausente) — confirma o contrato novo. Nenhum outro erro.

---

### Task 6: `ReviewModesHub`

**Files:**
- Create: `src/components/caderno/flashcards/ReviewModesHub.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
/**
 * ReviewModesHub — hub de revisão da página de Flashcards.
 *
 * Card protagonista "Revisar devidos" (SRS) + fileira de modos de treino.
 * Modos de treino calculam o pool da lista visível (deck atual ou todos)
 * e ficam desabilitados (com tooltip) quando o pool é vazio.
 */

import { motion } from 'framer-motion';
import {
  Play,
  Layers,
  BookOpen,
  Flame,
  Shuffle,
  ArrowLeftRight,
  Timer,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { REVIEW_MODE_CONFIGS, buildReviewPool } from '@/lib/flashcardReviewModes';
import type { Flashcard, ReviewMode } from '@/types/caderno';

const TRAINING_MODES: { mode: ReviewMode; icon: LucideIcon }[] = [
  { mode: 'free', icon: BookOpen },
  { mode: 'hard', icon: Flame },
  { mode: 'shuffle', icon: Shuffle },
  { mode: 'reversed', icon: ArrowLeftRight },
  { mode: 'timed', icon: Timer },
];

export interface ReviewModesHubProps {
  dueCount: number;
  /** Lista visível (deck selecionado ou todos) — base dos pools de treino. */
  cards: Flashcard[];
  onStart: (mode: ReviewMode) => void;
}

export function ReviewModesHub({ dueCount, cards, onStart }: ReviewModesHubProps) {
  return (
    <section aria-label="Modos de revisão" className="space-y-3">
      {/* Protagonista: Revisar devidos */}
      {dueCount > 0 && (
        <motion.button
          type="button"
          onClick={() => onStart('due')}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className={cn(
            'group flex w-full items-center justify-between gap-4 overflow-hidden rounded-[var(--c-radius-card)]',
            'border border-[color-mix(in_srgb,var(--c-wine-500)_20%,transparent)] bg-gradient-to-r from-[color-mix(in_srgb,var(--c-wine-500)_8%,transparent)] via-[color-mix(in_srgb,var(--c-wine-500)_4%,transparent)] to-transparent',
            'px-5 py-4 transition-all duration-200',
            'hover:border-[color-mix(in_srgb,var(--c-wine-500)_40%,transparent)] hover:shadow-[var(--c-shadow-glow)]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--c-wine-500)_50%,transparent)] focus-visible:ring-offset-2',
          )}
        >
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--c-wine-500)_10%,transparent)]">
              <Layers className="h-5 w-5 text-[var(--c-wine-500)]" aria-hidden />
            </div>
            <div className="min-w-0 text-left">
              <p className="text-[14px] font-bold text-[var(--c-ink)]">Revisar devidos</p>
              <p className="text-[12px] text-[var(--c-muted)]">
                {dueCount} {dueCount === 1 ? 'flashcard' : 'flashcards'} para hoje
              </p>
            </div>
          </div>
          <div
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-xl px-5 py-2.5',
              'bg-gradient-to-r from-[var(--c-wine-500)] to-[var(--c-wine-700)] text-white',
              'text-[13px] font-bold shadow-[var(--c-shadow-glow)]',
              'transition-transform duration-150 group-hover:scale-[1.03]',
            )}
          >
            <Play className="h-3.5 w-3.5 fill-current" aria-hidden />
            Iniciar
          </div>
        </motion.button>
      )}

      {/* Modos de treino */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {TRAINING_MODES.map(({ mode, icon: Icon }) => {
          const config = REVIEW_MODE_CONFIGS[mode];
          const poolSize = buildReviewPool(mode, cards).length;
          const disabled = poolSize === 0;

          const tile = (
            <button
              key={mode}
              type="button"
              disabled={disabled}
              onClick={() => onStart(mode)}
              aria-label={`${config.label} — ${config.description}`}
              className={cn(
                'flex h-full flex-col items-start gap-2 rounded-[var(--c-radius-card)] border bg-[var(--c-surface)] p-3 text-left',
                'border-[var(--c-border)] transition-all duration-150',
                disabled
                  ? 'cursor-not-allowed opacity-45'
                  : 'hover:-translate-y-[1px] hover:border-[color-mix(in_srgb,var(--c-wine-500)_35%,transparent)] hover:shadow-[var(--c-shadow-sm)] motion-reduce:hover:translate-y-0',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--c-wine-500)_50%,transparent)]',
              )}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--c-surface-2)]">
                <Icon className="h-4 w-4 text-[var(--c-wine-500)]" aria-hidden />
              </span>
              <span className="text-[12.5px] font-bold leading-tight text-[var(--c-ink)]">
                {config.label}
              </span>
              <span className="line-clamp-2 text-[10.5px] leading-snug text-[var(--c-muted)]">
                {config.description}
              </span>
            </button>
          );

          if (!disabled) return tile;
          return (
            <Tooltip key={mode} delayDuration={300}>
              {/* span wrapper: tooltip precisa de target habilitado */}
              <TooltipTrigger asChild>
                <span className="h-full">{tile}</span>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {mode === 'hard'
                  ? 'Nenhum card difícil por aqui — bom sinal!'
                  : 'Sem cards disponíveis neste deck'}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verificar compilação**

Run: `npx tsc --noEmit`
Expected: nenhum erro novo (o da Task 5 na página continua até a Task 8)

- [ ] **Step 3: Commit (junto com Task 4 se preferir, senão isolado)**

```bash
git add src/components/caderno/flashcards/ReviewModesHub.tsx
git commit -m "feat(flashcards): hub de modos de revisao com pools por deck"
```

---

### Task 7: `CreateActionsRow`

**Files:**
- Create: `src/components/caderno/flashcards/CreateActionsRow.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
/**
 * CreateActionsRow — CTAs de criação em destaque no corpo da página.
 *
 * Dois cards grandes: "Gerar com Prof. San" (IA, âmbar) e "Criar flashcard"
 * (wine outline). Substituem os botões pequenos do header.
 */

import { Sparkles, Plus, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export interface CreateActionsRowProps {
  onGenerate: () => void;
  onCreate: () => void;
  /** Desabilita "Criar flashcard" quando nenhum deck está selecionado. */
  createDisabled: boolean;
}

export function CreateActionsRow({ onGenerate, onCreate, createDisabled }: CreateActionsRowProps) {
  const createButton = (
    <button
      type="button"
      onClick={onCreate}
      disabled={createDisabled}
      className={cn(
        'group flex flex-1 items-center gap-3 rounded-[var(--c-radius-card)] border p-4 text-left',
        'border-[color-mix(in_srgb,var(--c-wine-500)_25%,transparent)] bg-[var(--c-surface)]',
        'transition-all duration-150',
        createDisabled
          ? 'cursor-not-allowed opacity-50'
          : 'hover:-translate-y-[1px] hover:border-[var(--c-wine-400)] hover:shadow-[var(--c-shadow-sm)] motion-reduce:hover:translate-y-0',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--c-wine-500)_50%,transparent)]',
      )}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--c-wine-50)]">
        <Plus className="h-5 w-5 text-[var(--c-wine-600)]" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-bold text-[var(--c-ink)]">Criar flashcard</span>
        <span className="block text-[11.5px] text-[var(--c-muted)]">
          Escreva frente e verso, com imagem se quiser
        </span>
      </span>
      <ChevronRight
        className="h-4 w-4 shrink-0 text-[var(--c-muted-2)] transition-transform duration-150 group-hover:translate-x-0.5"
        aria-hidden
      />
    </button>
  );

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
      {/* Gerar com IA */}
      <button
        type="button"
        onClick={onGenerate}
        className={cn(
          'group flex flex-1 items-center gap-3 rounded-[var(--c-radius-card)] border p-4 text-left',
          'border-amber-400/40 bg-gradient-to-r from-amber-500/[0.07] to-transparent',
          'transition-all duration-150',
          'hover:-translate-y-[1px] hover:border-amber-400 hover:shadow-[var(--c-shadow-sm)] motion-reduce:hover:translate-y-0',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60',
        )}
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10">
          <Sparkles className="h-5 w-5 text-amber-500" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 text-[13.5px] font-bold text-[var(--c-ink)]">
            Gerar com Prof. San
            <span className="rounded-[var(--c-radius-pill)] bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-600">
              IA
            </span>
          </span>
          <span className="block text-[11.5px] text-[var(--c-muted)]">
            Vários cards de uma vez, a partir dos seus erros ou de um tema
          </span>
        </span>
        <ChevronRight
          className="h-4 w-4 shrink-0 text-[var(--c-muted-2)] transition-transform duration-150 group-hover:translate-x-0.5"
          aria-hidden
        />
      </button>

      {/* Criar manual */}
      {createDisabled ? (
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <span className="flex flex-1">{createButton}</span>
          </TooltipTrigger>
          <TooltipContent side="bottom">Selecione um deck para adicionar um flashcard</TooltipContent>
        </Tooltip>
      ) : (
        createButton
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verificar compilação**

Run: `npx tsc --noEmit`
Expected: nenhum erro novo

- [ ] **Step 3: Commit**

```bash
git add src/components/caderno/flashcards/CreateActionsRow.tsx
git commit -m "feat(flashcards): CTAs de criacao em destaque (Prof. San + manual)"
```

---

### Task 8: Integração na `CadernoFlashcardsPage`

**Files:**
- Modify: `src/pages/CadernoFlashcardsPage.tsx`

- [ ] **Step 1: Imports e estado**

Adicionar imports:

```tsx
import { FlashcardPreviewModal } from '@/components/caderno/flashcards/FlashcardPreviewModal';
import { ReviewModesHub } from '@/components/caderno/flashcards/ReviewModesHub';
import { CreateActionsRow } from '@/components/caderno/flashcards/CreateActionsRow';
import { buildReviewPool } from '@/lib/flashcardReviewModes';
import type { Deck, Flashcard, ReviewMode } from '@/types/caderno';
```

Remover o componente local `ReviewBanner` (linhas 215–259) e seus imports órfãos (`Play` sai do lucide se não usado em outro lugar — verificar).

Trocar o estado de revisão e adicionar preview:

```tsx
  const [reviewMode, setReviewMode] = useState<ReviewMode | null>(null);
  const [reviewCards, setReviewCards] = useState<Flashcard[]>([]);
  const [previewCard, setPreviewCard] = useState<Flashcard | null>(null);
```

(Substitui `const [reviewMode, setReviewMode] = useState(false);`.)

- [ ] **Step 2: Handlers**

Substituir `handleStartReview`:

```tsx
  const handleStartReview = useCallback(
    (mode: ReviewMode) => {
      const pool = mode === 'due' ? dueFlashcards : buildReviewPool(mode, flashcards);
      if (pool.length === 0) return;
      setReviewCards(pool);
      setReviewMode(mode);
      trackEvent('caderno_flashcard_reviewed', {
        source: 'review_session_started',
        mode,
        count: pool.length,
      } as any);
    },
    [dueFlashcards, flashcards],
  );
```

`handleReviewFinish` muda `setReviewMode(false)` → `setReviewMode(null)`.

A condição da sessão muda para:

```tsx
  if (reviewMode && reviewCards.length > 0) {
    return (
      <FlashcardReviewSession
        cards={reviewCards}
        mode={reviewMode}
        onFinish={handleReviewFinish}
      />
    );
  }
```

- [ ] **Step 3: Header sem ações + novas seções**

No `<PageHeaderPremium>`, **remover a prop `primaryAction` inteira** (os dois botões).

Substituir o bloco do banner (`<AnimatePresence>{dueFlashcards.length > 0 && ... ReviewBanner ...}</AnimatePresence>`) por:

```tsx
        {/* Hub de revisão: devidos + modos de treino */}
        <StaggerItem>
          <ReviewModesHub
            dueCount={dueFlashcards.length}
            cards={flashcards}
            onStart={handleStartReview}
          />
        </StaggerItem>

        {/* CTAs de criação */}
        <StaggerItem>
          <CreateActionsRow
            onGenerate={() => setBulkOpen(true)}
            onCreate={() => handleOpenEditor()}
            createDisabled={!selectedDeckId && decks.length > 0}
          />
        </StaggerItem>
```

`AnimatePresence` sai do import do framer-motion **somente se** não restar outro uso (a lista de cards usa `AnimatePresence mode="popLayout"` — mantém).

No `<SectionHeader>`, remover a prop `action` (o botão "+" mobile sai; o CTA grande cobre o caso).

- [ ] **Step 4: Grid + preview**

Trocar o wrapper da lista de `<div className="space-y-3">` para:

```tsx
            <div className="space-y-3">
              {/* Zero devidos (celebratório) */}
              {dueFlashcards.length === 0 && flashcards.length > 0 && (
                <ZeroDueState
                  total={flashcards.filter((c: Flashcard) => !c.mastered_at).length}
                />
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <AnimatePresence mode="popLayout">
                  {flashcards.map((card: Flashcard) => (
                    <FlashcardItem
                      key={card.id}
                      card={card}
                      onPreview={setPreviewCard}
                      onEdit={handleOpenEditor}
                      onDelete={handleDelete}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </div>
```

E após o `BulkGenerateModal` no JSX final, renderizar o preview:

```tsx
      {previewCard && (
        <FlashcardPreviewModal
          card={previewCard}
          onEdit={(card) => { setPreviewCard(null); handleOpenEditor(card); }}
          onDelete={(id) => { setPreviewCard(null); handleDelete(id); }}
          onClose={() => setPreviewCard(null)}
        />
      )}
```

Nota: o `FlashcardPreviewModal` já chama `onClose()` antes de `onEdit`/`onDelete` internamente; o reforço aqui é idempotente e inofensivo.

- [ ] **Step 5: Atualizar o skeleton do grid**

`FlashcardsSkeletonGrid` (linhas 78–100) passa a refletir o grid vertical:

```tsx
function FlashcardsSkeletonGrid() {
  return (
    <div
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
      aria-busy="true"
      aria-label="Carregando flashcards"
    >
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="flex flex-col gap-3 rounded-[var(--c-radius-card)] border border-[var(--c-border)] bg-[var(--c-surface)] p-4"
        >
          <SkeletonLine className="h-3.5 w-full" />
          <SkeletonLine className="h-3.5 w-2/3" />
          <SkeletonLine className="mt-4 h-5 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Verificação completa**

Run: `npx tsc --noEmit && npm run lint -- --quiet && npx vitest run`
Expected: tudo verde

- [ ] **Step 7: Commit (inclui o FlashcardItem da Task 5)**

```bash
git add src/components/caderno/flashcards/FlashcardItem.tsx src/pages/CadernoFlashcardsPage.tsx
git commit -m "feat(flashcards): grid de cartas, preview no clique, hub de modos e CTAs na pagina"
```

---

### Task 9: Verificação manual via preview + ajustes

**Files:** nenhum novo (ajustes pontuais se a verificação achar problema)

- [ ] **Step 1: Subir o dev server e navegar**

Usar as ferramentas `preview_*` (porta 8080, `npm run dev`). Login com usuário admin (a rota `/caderno/flashcards` é admin-only). Verificar:

1. **Clique no card** abre o preview mostrando só a frente; espaço/botão revela o verso; Editar abre o editor; Excluir dispara o toast com Desfazer.
2. **Grid** responsivo: 1 col mobile (preview_resize 380px), 2 cols sm, 3 cols xl; sem resposta visível na listagem.
3. **Hub**: "Revisar devidos" funciona como antes (grava SRS); cada modo de treino inicia com pool coerente; "Difíceis" desabilitado quando não há cards difíceis (tooltip).
4. **Treino não altera SRS**: revisar em modo livre e confirmar que o contador "Para hoje" não muda após `invalidateQueries`.
5. **Invertido** mostra o verso primeiro; **Cronometrado** mostra o timer e encerra aos 0:00 com summary "X cards em Y".
6. **CTAs** visíveis sem scroll no desktop; "Gerar com Prof. San" abre o BulkGenerateModal; "Criar flashcard" desabilitado com tooltip quando em "Todos" sem deck selecionado.
7. **Dark mode** (preview_resize + toggle de tema): tokens `--c-*` ok, sem texto ilegível.
8. Console sem erros (preview_console_logs).

- [ ] **Step 2: Screenshot de prova**

`preview_screenshot` da página e do preview modal aberto.

- [ ] **Step 3: Commit final de ajustes (se houver)**

```bash
git add -A && git commit -m "fix(flashcards): ajustes de verificacao visual"
```

---

## Self-review do plano (executado)

- **Cobertura da spec:** §1 estrutura → Task 8; §2 modos → Tasks 1+3; §3 grid+preview → Tasks 4+5+8; CTAs → Task 7; testes → Task 1; verificação manual → Task 9. Sem lacunas.
- **Tipos consistentes:** `ReviewMode` definido na Task 1 e usado nas Tasks 3/6/8; `ReviewModeConfig.{reversed,writesSrs,timerSeconds}` consistente entre Task 1 e Task 3; `FlashcardItemProps.onPreview` (Task 5) casa com o call site (Task 8); `ReviewModesHubProps`/`CreateActionsRowProps` casam com a Task 8.
- **Sem placeholders:** todos os passos têm código/comando concretos.
