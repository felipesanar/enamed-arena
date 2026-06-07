# Criar flashcards em lote com Prof. San — Fase 2 (Plano de Implementação)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar 4 novas fontes ao wizard de geração em lote — Anotações, Pontos fracos, Simulado concluído e Favoritas — reaproveitando o motor (`generate-flashcards-batch`) e os métodos de serviço já existentes da Fase 1.

**Architecture:** Cada fonte normaliza seus dados para um `BatchGenerateInput` existente: Anotações→`text`, Pontos fracos→`topic`, Simulado/Favoritas→`questions`. Helpers puros novos em `src/lib/bulkFlashcards.ts` fazem o mapeamento (testados). Cada picker é um componente isolado em `src/components/caderno/flashcards/bulk/`. O `BulkGenerateModal` ganha 4 tiles e renderiza o picker certo. Nenhuma mudança no motor, no service de geração/insert, ou no schema.

**Tech Stack:** React 18 + TS, TanStack Query, shadcn/ui, Supabase, Vitest.

**Worktree:** `C:/Users/felipe.souza/Documents/Projetos (Sanar)/enamed-arena/.claude/worktrees/busy-swirles-62271e` (branch `claude/busy-swirles-62271e`). Todos os caminhos são relativos a este worktree.

---

## Fatos verificados do código (base para o plano)

- `Question` (`src/types/index.ts`): `{ id, number, text, area, theme, options: {id,label,text}[], correctOptionId, ... }`. **`correctOptionId` é o id de uma option**; o label é `options.find(o => o.id === correctOptionId)?.label`.
- `BatchQuestionInput` (`src/lib/bulkFlashcards.ts`): `{ sourceRef:{entryId?,questionId?}, questionStem (obrigatório), options?, correctOptionLabel?, area?, theme?, aiReviewMd?, learningNote? }`.
- `BatchGenerateInput`: `{ mode:'topic'|'questions'|'text', count?, area?, theme?, rawText?, questions? }`. Helpers existentes: `clampCount`, `MAX_TOPIC_COUNT=15`, `MAX_QUESTIONS=20`, `DEFAULT_COUNT=10`, `suggestDeckName`, `buildCadernoQuestionsInput`, `mapGeneratedCardsToPayloads`.
- Serviço (`src/services/simuladosApi.ts`):
  - `getQuestions(simuladoId, includeCorrectAnswers=false): Promise<Question[]>` — carrega todas as questões+options de um simulado.
  - `getUserAttempts(userId, 'online', limit=200): Promise<AttemptRow[]>` — `AttemptRow` tem `id, simulado_id, status, score_percentage, finished_at, total_correct, total_questions, started_at`.
  - `getAttemptQuestionResults(attemptId): Promise<{ question_id, selected_option_id, correct_option_id, is_correct, was_answered }[]>`.
  - `listFavorites(): Promise<QuestionFavorite[]>` — `{ id, question_id, simulado_id|null, area|null, theme|null, ... }`.
  - `listNotes(): Promise<UserNote[]>` — `{ id, title, body_md, area, theme, ... }`.
  - `getErrorNotebook(userId): Promise<rows[]>` — linhas com `id, area, theme, reason, created_at, mastered_at, srs_lapses, srs_reps, srs_due_at`.
  - `getSimulado(idOrSlug): Promise<SimuladoConfig|null>` — `SimuladoConfig` tem `title` (entre outros).
- `src/lib/weakAreas.ts`: `WeakAreaEntry { id, area, theme, reason, addedAt, masteredAt?, srsLapses?, srsReps?, srsDueAt? }`; `rankWeakThemes(entries, maxItems=12): RankedWeakArea[]` e `rankWeakAreas(...)`; `RankedWeakArea { area, theme|null, total, pending, totalLapses, score, topReason, entryIds }`.
- `useUser()` (`@/contexts/UserContext`) → `{ profile }`, `profile?.id` é o user id.
- Padrão dos pickers da Fase 1 (`TopicSourceForm`, `CadernoSourcePicker`): recebem `onChange: (input: BatchGenerateInput | null) => void`, e o `BulkGenerateModal` passa `setInput` (setter estável) — emitir dentro de `useEffect` é seguro, sem loop.
- Estilo: tokens CSS-var (`var(--c-wine-500)`, `var(--c-border)`, `var(--c-radius-control)`, etc.). Seguir `CadernoSourcePicker.tsx` como referência visual.

---

## Estrutura de arquivos

**Criar:**
- `src/components/caderno/flashcards/bulk/AnotacoesSourceForm.tsx` — fonte Anotações (`text`).
- `src/components/caderno/flashcards/bulk/WeakAreasSourcePicker.tsx` — fonte Pontos fracos (`topic`).
- `src/components/caderno/flashcards/bulk/SimuladoSourcePicker.tsx` — fonte Simulado concluído (`questions`).
- `src/components/caderno/flashcards/bulk/FavoritesSourcePicker.tsx` — fonte Favoritas (`questions`).

**Modificar:**
- `src/lib/bulkFlashcards.ts` — adicionar helpers `mapQuestionToBatchInput`, `buildQuestionsInput`, `buildTopicInput`, `mapErrorRowsToWeakEntries`.
- `src/lib/bulkFlashcards.test.ts` — testes dos novos helpers.
- `src/components/caderno/flashcards/BulkGenerateModal.tsx` — 4 novos tiles + render dos 4 pickers.

---

## Task 1: Novos helpers puros + testes

**Files:**
- Modify: `src/lib/bulkFlashcards.ts`
- Modify: `src/lib/bulkFlashcards.test.ts`

- [ ] **Step 1: Escrever os testes (append ao arquivo de teste existente)**

Adicione ao FINAL de `src/lib/bulkFlashcards.test.ts` (mantendo os imports existentes; estenda o `import { ... } from './bulkFlashcards'` para incluir os novos nomes e adicione `import type { Question } from '@/types';`):

```typescript
import {
  mapQuestionToBatchInput,
  buildQuestionsInput,
  buildTopicInput,
  mapErrorRowsToWeakEntries,
} from './bulkFlashcards';
import type { Question } from '@/types';

const sampleQuestion: Question = {
  id: 'q1',
  number: 3,
  text: 'Conduta na IC com FE reduzida?',
  area: 'Cardiologia',
  theme: 'Insuficiência Cardíaca',
  options: [
    { id: 'o1', label: 'A', text: 'Opção A' },
    { id: 'o2', label: 'B', text: 'Opção B' },
    { id: 'o3', label: 'C', text: 'Opção C' },
  ],
  correctOptionId: 'o2',
};

describe('mapQuestionToBatchInput', () => {
  it('resolve correctOptionLabel a partir do correctOptionId', () => {
    const r = mapQuestionToBatchInput(sampleQuestion);
    expect(r.correctOptionLabel).toBe('B');
  });
  it('usa stem, options, sourceRef.questionId e area/theme da questão', () => {
    const r = mapQuestionToBatchInput(sampleQuestion);
    expect(r.questionStem).toBe('Conduta na IC com FE reduzida?');
    expect(r.options).toEqual([
      { label: 'A', text: 'Opção A' },
      { label: 'B', text: 'Opção B' },
      { label: 'C', text: 'Opção C' },
    ]);
    expect(r.sourceRef).toEqual({ questionId: 'q1' });
    expect(r.area).toBe('Cardiologia');
    expect(r.theme).toBe('Insuficiência Cardíaca');
  });
  it('aceita overrides de area/theme/entryId', () => {
    const r = mapQuestionToBatchInput(sampleQuestion, { area: 'X', theme: 'Y', entryId: 'e9' });
    expect(r.area).toBe('X');
    expect(r.theme).toBe('Y');
    expect(r.sourceRef).toEqual({ questionId: 'q1', entryId: 'e9' });
  });
  it('correctOptionLabel é null quando o id não bate', () => {
    const r = mapQuestionToBatchInput({ ...sampleQuestion, correctOptionId: 'zzz' });
    expect(r.correctOptionLabel).toBeNull();
  });
});

describe('buildQuestionsInput', () => {
  it('monta modo questions a partir de itens', () => {
    const input = buildQuestionsInput([
      { q: sampleQuestion },
      { q: { ...sampleQuestion, id: 'q2', text: 'Outra?' }, area: 'Pneumo' },
    ]);
    expect(input.mode).toBe('questions');
    expect(input.questions).toHaveLength(2);
    expect(input.questions![0].sourceRef.questionId).toBe('q1');
    expect(input.questions![1].area).toBe('Pneumo');
  });
});

describe('buildTopicInput', () => {
  it('monta modo topic com count clampado', () => {
    expect(buildTopicInput('Cardio', 'IC', 99)).toEqual({ mode: 'topic', area: 'Cardio', theme: 'IC', count: 15 });
  });
  it('normaliza strings vazias para null', () => {
    expect(buildTopicInput('', '', 10)).toEqual({ mode: 'topic', area: null, theme: null, count: 10 });
  });
});

describe('mapErrorRowsToWeakEntries', () => {
  it('mapeia campos do error_notebook para WeakAreaEntry', () => {
    const rows = [{
      id: 'e1', area: 'Cardio', theme: 'IC', reason: 'did_not_know',
      created_at: '2026-01-01', mastered_at: null, srs_lapses: 2, srs_reps: 1, srs_due_at: '2026-02-01',
    }];
    const out = mapErrorRowsToWeakEntries(rows);
    expect(out[0]).toMatchObject({
      id: 'e1', area: 'Cardio', theme: 'IC', reason: 'did_not_know',
      addedAt: '2026-01-01', masteredAt: null, srsLapses: 2, srsReps: 1, srsDueAt: '2026-02-01',
    });
  });
});
```

- [ ] **Step 2: Rodar e confirmar que FALHA**

Run: `npm run test -- src/lib/bulkFlashcards.test.ts`
Expected: FAIL — funções novas indefinidas.

- [ ] **Step 3: Implementar os helpers**

No FINAL de `src/lib/bulkFlashcards.ts`, e adicione `import type { Question } from '@/types';` ao topo (junto ao import de `CreateFlashcardPayload`). Acrescente:

```typescript
/** Item de origem para buildQuestionsInput. */
export interface QuestionSourceItem {
  q: Question;
  area?: string | null;
  theme?: string | null;
  entryId?: string;
}

/** Converte uma Question carregada num BatchQuestionInput (resolve o label do gabarito). */
export function mapQuestionToBatchInput(
  q: Question,
  opts: { area?: string | null; theme?: string | null; entryId?: string } = {},
): BatchQuestionInput {
  const correctOptionLabel = q.options.find((o) => o.id === q.correctOptionId)?.label ?? null;
  return {
    sourceRef: { questionId: q.id, ...(opts.entryId ? { entryId: opts.entryId } : {}) },
    questionStem: q.text,
    options: q.options.map((o) => ({ label: o.label, text: o.text })),
    correctOptionLabel,
    area: opts.area ?? q.area ?? null,
    theme: opts.theme ?? q.theme ?? null,
    aiReviewMd: null,
    learningNote: null,
  };
}

/** Monta um BatchGenerateInput modo `questions` a partir de questões carregadas. */
export function buildQuestionsInput(items: QuestionSourceItem[]): BatchGenerateInput {
  return {
    mode: 'questions',
    questions: items.map((it) => mapQuestionToBatchInput(it.q, { area: it.area, theme: it.theme, entryId: it.entryId })),
  };
}

/** Monta um BatchGenerateInput modo `topic` (count clampado em [1, MAX_TOPIC_COUNT]). */
export function buildTopicInput(
  area: string | null | undefined,
  theme: string | null | undefined,
  count: number,
): BatchGenerateInput {
  return {
    mode: 'topic',
    area: area?.trim() || null,
    theme: theme?.trim() || null,
    count: clampCount(count, MAX_TOPIC_COUNT),
  };
}

/** Linha crua de error_notebook para o ranqueamento de pontos fracos. */
export interface ErrorNotebookWeakRow {
  id: string;
  area: string | null;
  theme: string | null;
  reason: string;
  created_at: string;
  mastered_at?: string | null;
  srs_lapses?: number | null;
  srs_reps?: number | null;
  srs_due_at?: string | null;
}

/** Mapeia linhas de error_notebook para o shape WeakAreaEntry de weakAreas.ts. */
export function mapErrorRowsToWeakEntries(rows: ErrorNotebookWeakRow[]) {
  return rows.map((r) => ({
    id: r.id,
    area: r.area,
    theme: r.theme,
    reason: r.reason,
    addedAt: r.created_at,
    masteredAt: r.mastered_at ?? null,
    srsLapses: r.srs_lapses ?? null,
    srsReps: r.srs_reps ?? null,
    srsDueAt: r.srs_due_at ?? null,
  }));
}
```

- [ ] **Step 4: Rodar e confirmar que PASSA**

Run: `npm run test -- src/lib/bulkFlashcards.test.ts`
Expected: PASS (testes antigos + novos).

- [ ] **Step 5: Commit**

```bash
git add src/lib/bulkFlashcards.ts src/lib/bulkFlashcards.test.ts
git commit -m "feat(flashcards): helpers fase 2 (question→batch, topic, weak entries) + testes"
```
(Ignore o aviso de identidade do git. Um monitor de worktree pode auto-commitar antes; se já estiver commitado, reporte o SHA.)

---

## Task 2: AnotacoesSourceForm (modo `text`)

**Files:**
- Create: `src/components/caderno/flashcards/bulk/AnotacoesSourceForm.tsx`

Picker com dois modos internos: colar texto livre OU escolher uma anotação salva (usa `body_md`). Mais seletor de quantidade.

- [ ] **Step 1: Criar o componente**

```tsx
/**
 * AnotacoesSourceForm — fonte "Anotações" (modo text).
 * O usuário cola um texto livre OU escolhe uma anotação salva (body_md).
 * Emite BatchGenerateInput modo 'text' (ou null) via onChange.
 */
import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { simuladosApi } from '@/services/simuladosApi';
import { DEFAULT_COUNT, MAX_TOPIC_COUNT, clampCount, type BatchGenerateInput } from '@/lib/bulkFlashcards';
import type { UserNote } from '@/types/caderno';

const COUNT_OPTIONS = [5, 10, 15];

interface AnotacoesSourceFormProps {
  onChange: (input: BatchGenerateInput | null) => void;
}

export function AnotacoesSourceForm({ onChange }: AnotacoesSourceFormProps) {
  const [mode, setMode] = useState<'paste' | 'note'>('paste');
  const [text, setText] = useState('');
  const [noteId, setNoteId] = useState<string>('');
  const [count, setCount] = useState<number>(DEFAULT_COUNT);

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['caderno', 'notes', 'bulk-picker'],
    queryFn: () => simuladosApi.listNotes(),
  });

  const selectedNote = (notes as UserNote[]).find((n) => n.id === noteId);
  const rawText = mode === 'paste' ? text.trim() : (selectedNote?.body_md?.trim() ?? '');

  useEffect(() => {
    onChange(rawText
      ? { mode: 'text', rawText, count: clampCount(count, MAX_TOPIC_COUNT) }
      : null);
  }, [rawText, count, onChange]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          type="button" onClick={() => setMode('paste')}
          className={cn(
            'flex-1 rounded-[var(--c-radius-control)] border px-3 py-2 text-[12px] font-semibold transition-colors',
            mode === 'paste' ? 'border-[var(--c-wine-500)] bg-[var(--c-wine-50)] text-[var(--c-wine-700)]' : 'border-[var(--c-border)] text-[var(--c-muted)]',
          )}
        >
          Colar texto
        </button>
        <button
          type="button" onClick={() => setMode('note')}
          className={cn(
            'flex-1 rounded-[var(--c-radius-control)] border px-3 py-2 text-[12px] font-semibold transition-colors',
            mode === 'note' ? 'border-[var(--c-wine-500)] bg-[var(--c-wine-50)] text-[var(--c-wine-700)]' : 'border-[var(--c-border)] text-[var(--c-muted)]',
          )}
        >
          Usar anotação salva
        </button>
      </div>

      {mode === 'paste' ? (
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          placeholder="Cole aqui seu resumo ou anotação… o Prof. San fatia em flashcards."
          aria-label="Texto para gerar flashcards"
          className="w-full resize-none rounded-xl border border-[var(--c-border)] bg-[var(--c-surface-2)] px-3.5 py-3 text-[13px] leading-relaxed text-[var(--c-ink)] placeholder:text-[var(--c-muted-2)] outline-none focus:border-[var(--c-wine-400)]"
        />
      ) : isLoading ? (
        <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-[var(--c-muted)]" aria-hidden /></div>
      ) : (notes as UserNote[]).length === 0 ? (
        <p className="py-6 text-center text-[13px] text-[var(--c-muted)]">Você ainda não tem anotações salvas.</p>
      ) : (
        <select
          aria-label="Anotação"
          value={noteId}
          onChange={(e) => setNoteId(e.target.value)}
          className="w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-surface-2)] px-3 py-2 text-[13px] text-[var(--c-ink)] outline-none focus:border-[var(--c-wine-400)]"
        >
          <option value="">Selecione uma anotação…</option>
          {(notes as UserNote[]).map((n) => <option key={n.id} value={n.id}>{n.title}</option>)}
        </select>
      )}

      <div className="space-y-1.5">
        <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--c-muted)]">Quantidade</span>
        <div className="flex gap-2">
          {COUNT_OPTIONS.map((n) => (
            <button
              key={n} type="button" onClick={() => setCount(n)}
              className={cn(
                'flex-1 rounded-[var(--c-radius-control)] border py-2 text-[13px] font-bold transition-colors',
                count === n ? 'border-[var(--c-wine-500)] bg-[var(--c-wine-50)] text-[var(--c-wine-700)]' : 'border-[var(--c-border)] text-[var(--c-muted)] hover:border-[var(--c-wine-300)]',
              )}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit -p tsconfig.json` (sem novos erros).
```bash
git add src/components/caderno/flashcards/bulk/AnotacoesSourceForm.tsx
git commit -m "feat(flashcards): picker Anotações (modo text)"
```

---

## Task 3: WeakAreasSourcePicker (modo `topic`)

**Files:**
- Create: `src/components/caderno/flashcards/bulk/WeakAreasSourcePicker.tsx`

Carrega o caderno, ranqueia temas fracos, deixa escolher um e gera no modo `topic`.

- [ ] **Step 1: Criar o componente**

```tsx
/**
 * WeakAreasSourcePicker — fonte "Pontos fracos" (modo topic).
 * Ranqueia os temas mais fracos do Caderno de Erros (rankWeakThemes) e deixa
 * o usuário escolher um; emite BatchGenerateInput modo 'topic' via onChange.
 */
import { useState, useEffect, useMemo } from 'react';
import { Loader2, TrendingDown } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { simuladosApi } from '@/services/simuladosApi';
import { useUser } from '@/contexts/UserContext';
import { rankWeakThemes } from '@/lib/weakAreas';
import {
  buildTopicInput, mapErrorRowsToWeakEntries, DEFAULT_COUNT,
  type BatchGenerateInput, type ErrorNotebookWeakRow,
} from '@/lib/bulkFlashcards';

const COUNT_OPTIONS = [5, 10, 15];

interface WeakAreasSourcePickerProps {
  onChange: (input: BatchGenerateInput | null) => void;
}

export function WeakAreasSourcePicker({ onChange }: WeakAreasSourcePickerProps) {
  const { profile } = useUser();
  const userId = profile?.id;
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [count, setCount] = useState<number>(DEFAULT_COUNT);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['caderno', 'weak-areas', 'bulk-picker', userId],
    queryFn: () => simuladosApi.getErrorNotebook(userId!),
    enabled: !!userId,
  });

  const ranked = useMemo(
    () => rankWeakThemes(mapErrorRowsToWeakEntries(rows as ErrorNotebookWeakRow[])),
    [rows],
  );

  const selected = ranked.find((r) => `${r.area}|${r.theme}` === selectedKey) ?? null;

  useEffect(() => {
    onChange(selected ? buildTopicInput(selected.area, selected.theme, count) : null);
  }, [selected, count, onChange]);

  if (isLoading) {
    return <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-[var(--c-muted)]" aria-hidden /></div>;
  }
  if (ranked.length === 0) {
    return <p className="py-8 text-center text-[13px] text-[var(--c-muted)]">Sem pontos fracos suficientes ainda. Marque mais questões no Caderno de Erros.</p>;
  }

  return (
    <div className="space-y-4">
      <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--c-muted)]">Seu ponto fraco</span>
      <div className="max-h-[280px] space-y-1.5 overflow-y-auto pr-1">
        {ranked.map((r) => {
          const key = `${r.area}|${r.theme}`;
          const active = key === selectedKey;
          return (
            <button
              key={key} type="button" onClick={() => setSelectedKey(key)}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors',
                active ? 'border-[var(--c-wine-500)] bg-[var(--c-wine-50)]' : 'border-[var(--c-border)] hover:border-[var(--c-wine-300)]',
              )}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
                <TrendingDown className="h-4 w-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px] font-semibold text-[var(--c-ink)] truncate">{r.theme}</span>
                <span className="block text-[11px] text-[var(--c-muted)]">{r.area} · {r.pending} pendente{r.pending === 1 ? '' : 's'}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="space-y-1.5">
        <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--c-muted)]">Quantidade</span>
        <div className="flex gap-2">
          {COUNT_OPTIONS.map((n) => (
            <button
              key={n} type="button" onClick={() => setCount(n)}
              className={cn(
                'flex-1 rounded-[var(--c-radius-control)] border py-2 text-[13px] font-bold transition-colors',
                count === n ? 'border-[var(--c-wine-500)] bg-[var(--c-wine-50)] text-[var(--c-wine-700)]' : 'border-[var(--c-border)] text-[var(--c-muted)] hover:border-[var(--c-wine-300)]',
              )}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit -p tsconfig.json` (sem novos erros).
```bash
git add src/components/caderno/flashcards/bulk/WeakAreasSourcePicker.tsx
git commit -m "feat(flashcards): picker Pontos fracos (modo topic)"
```

---

## Task 4: SimuladoSourcePicker (modo `questions`)

**Files:**
- Create: `src/components/caderno/flashcards/bulk/SimuladoSourcePicker.tsx`

Lista simulados concluídos, ao escolher um carrega as questões ERRADAS (com enunciado) e gera 1 card por questão.

- [ ] **Step 1: Criar o componente**

```tsx
/**
 * SimuladoSourcePicker — fonte "Simulado concluído" (modo questions).
 * Lista attempts finalizados; ao escolher um, carrega as questões erradas
 * (is_correct=false) com enunciado e gera 1 card por questão.
 * Emite BatchGenerateInput modo 'questions' via onChange.
 */
import { useState, useEffect, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { simuladosApi } from '@/services/simuladosApi';
import { useUser } from '@/contexts/UserContext';
import { buildQuestionsInput, MAX_QUESTIONS, type BatchGenerateInput } from '@/lib/bulkFlashcards';
import type { Question } from '@/types';

interface SimuladoSourcePickerProps {
  onChange: (input: BatchGenerateInput | null) => void;
}

export function SimuladoSourcePicker({ onChange }: SimuladoSourcePickerProps) {
  const { profile } = useUser();
  const userId = profile?.id;
  const [attemptId, setAttemptId] = useState<string>('');
  const [deselected, setDeselected] = useState<Set<string>>(new Set());

  // 1) Attempts finalizados + títulos dos simulados.
  const { data: attempts = [], isLoading: loadingAttempts } = useQuery({
    queryKey: ['flashcards', 'finished-attempts', userId],
    queryFn: async () => {
      const rows = await simuladosApi.getUserAttempts(userId!, 'online', 200);
      const finished = rows.filter((a: any) => !!a.finished_at);
      const ids = Array.from(new Set(finished.map((a: any) => a.simulado_id)));
      const sims = await Promise.all(ids.map((id) => simuladosApi.getSimulado(id as string)));
      const titleById = new Map(ids.map((id, i) => [id, sims[i]?.title ?? 'Simulado']));
      return finished.map((a: any) => ({
        id: a.id as string,
        simuladoId: a.simulado_id as string,
        title: titleById.get(a.simulado_id) as string,
        score: a.score_percentage as number | null,
        finishedAt: a.finished_at as string,
      }));
    },
    enabled: !!userId,
  });

  const chosen = (attempts as any[]).find((a) => a.id === attemptId) ?? null;

  // 2) Questões erradas do attempt escolhido (com enunciado).
  const { data: wrongQuestions = [], isLoading: loadingQuestions } = useQuery({
    queryKey: ['flashcards', 'attempt-wrong-questions', attemptId],
    queryFn: async () => {
      const [results, questions] = await Promise.all([
        simuladosApi.getAttemptQuestionResults(chosen!.id),
        simuladosApi.getQuestions(chosen!.simuladoId, true),
      ]);
      const wrongIds = new Set(
        (results as any[]).filter((r) => r.is_correct === false).map((r) => r.question_id),
      );
      return (questions as Question[]).filter((q) => wrongIds.has(q.id));
    },
    enabled: !!chosen,
  });

  const selectedQuestions = useMemo(
    () => (wrongQuestions as Question[]).filter((q) => !deselected.has(q.id)).slice(0, MAX_QUESTIONS),
    [wrongQuestions, deselected],
  );

  useEffect(() => {
    onChange(selectedQuestions.length > 0
      ? buildQuestionsInput(selectedQuestions.map((q) => ({ q })))
      : null);
  }, [selectedQuestions, onChange]);

  const toggle = (id: string) => {
    setDeselected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  if (loadingAttempts) {
    return <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-[var(--c-muted)]" aria-hidden /></div>;
  }
  if ((attempts as any[]).length === 0) {
    return <p className="py-8 text-center text-[13px] text-[var(--c-muted)]">Você ainda não concluiu nenhum simulado.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--c-muted)]">Simulado concluído</span>
        <select
          aria-label="Simulado concluído"
          value={attemptId}
          onChange={(e) => { setAttemptId(e.target.value); setDeselected(new Set()); }}
          className="w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-surface-2)] px-3 py-2 text-[13px] text-[var(--c-ink)] outline-none focus:border-[var(--c-wine-400)]"
        >
          <option value="">Selecione…</option>
          {(attempts as any[]).map((a) => (
            <option key={a.id} value={a.id}>
              {a.title}{a.score != null ? ` — ${Math.round(a.score)}%` : ''}
            </option>
          ))}
        </select>
      </div>

      {chosen && (
        loadingQuestions ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-[var(--c-muted)]" aria-hidden /></div>
        ) : (wrongQuestions as Question[]).length === 0 ? (
          <p className="py-6 text-center text-[13px] text-[var(--c-muted)]">Nenhuma questão errada neste simulado. 🎉</p>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--c-muted)]">Questões erradas</span>
              <span className="text-[11px] font-semibold text-[var(--c-muted)]">{selectedQuestions.length} selecionada{selectedQuestions.length === 1 ? '' : 's'}</span>
            </div>
            <div className="max-h-[260px] space-y-1.5 overflow-y-auto pr-1">
              {(wrongQuestions as Question[]).map((q) => {
                const checked = !deselected.has(q.id);
                return (
                  <button
                    key={q.id} type="button" onClick={() => toggle(q.id)}
                    className={cn(
                      'flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors',
                      checked ? 'border-[var(--c-wine-500)] bg-[var(--c-wine-50)]' : 'border-[var(--c-border)] hover:border-[var(--c-wine-300)]',
                    )}
                  >
                    <span className={cn(
                      'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                      checked ? 'border-[var(--c-wine-500)] bg-[var(--c-wine-500)] text-white' : 'border-[var(--c-muted-2)]',
                    )}>
                      {checked && <span className="text-[10px] leading-none">✓</span>}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[12.5px] font-medium text-[var(--c-ink)] line-clamp-2">{q.text}</span>
                      <span className="mt-0.5 block text-[11px] text-[var(--c-muted)]">{[q.area, q.theme].filter(Boolean).join(' · ')}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            {(wrongQuestions as Question[]).length > MAX_QUESTIONS && (
              <p className="text-[11px] text-amber-600">Serão usadas as primeiras {MAX_QUESTIONS} questões selecionadas.</p>
            )}
          </div>
        )
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit -p tsconfig.json` (sem novos erros).
```bash
git add src/components/caderno/flashcards/bulk/SimuladoSourcePicker.tsx
git commit -m "feat(flashcards): picker Simulado concluído (questões erradas, modo questions)"
```

---

## Task 5: FavoritesSourcePicker (modo `questions`)

**Files:**
- Create: `src/components/caderno/flashcards/bulk/FavoritesSourcePicker.tsx`

Lista favoritas, carrega os enunciados (agrupando por simulado) e gera 1 card por favorita selecionada.

- [ ] **Step 1: Criar o componente**

```tsx
/**
 * FavoritesSourcePicker — fonte "Favoritas" (modo questions).
 * Carrega as questões favoritas, resolve o enunciado de cada uma (agrupando por
 * simulado), deixa selecionar e gera 1 card por favorita.
 * Favoritas sem simulado_id não podem ter o enunciado carregado e são omitidas.
 * Emite BatchGenerateInput modo 'questions' via onChange.
 */
import { useState, useEffect, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';
import { simuladosApi } from '@/services/simuladosApi';
import { buildQuestionsInput, MAX_QUESTIONS, type BatchGenerateInput } from '@/lib/bulkFlashcards';
import type { Question } from '@/types';
import type { QuestionFavorite } from '@/types/caderno';

interface ResolvedFavorite {
  favoriteId: string;
  question: Question;
  area: string | null;
  theme: string | null;
}

interface FavoritesSourcePickerProps {
  onChange: (input: BatchGenerateInput | null) => void;
}

export function FavoritesSourcePicker({ onChange }: FavoritesSourcePickerProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery({
    queryKey: ['flashcards', 'favorites-resolved', 'bulk-picker'],
    queryFn: async () => {
      const favorites = (await simuladosApi.listFavorites()) as QuestionFavorite[];
      const withSimulado = favorites.filter((f) => !!f.simulado_id);
      const skipped = favorites.length - withSimulado.length;
      if (skipped > 0) logger.log('[FavoritesSourcePicker] favoritas sem simulado omitidas:', skipped);

      const simuladoIds = Array.from(new Set(withSimulado.map((f) => f.simulado_id as string)));
      const questionLists = await Promise.all(
        simuladoIds.map((id) => simuladosApi.getQuestions(id, true)),
      );
      const byId = new Map<string, Question>();
      for (const list of questionLists) for (const q of list as Question[]) byId.set(q.id, q);

      const resolved: ResolvedFavorite[] = [];
      for (const f of withSimulado) {
        const q = byId.get(f.question_id);
        if (q) resolved.push({ favoriteId: f.id, question: q, area: f.area, theme: f.theme });
      }
      return { resolved, skipped };
    },
  });

  const resolved = data?.resolved ?? [];
  const skipped = data?.skipped ?? 0;
  const atCap = selected.size >= MAX_QUESTIONS;

  const selectedItems = useMemo(
    () => resolved.filter((r) => selected.has(r.favoriteId)),
    [resolved, selected],
  );

  useEffect(() => {
    onChange(selectedItems.length > 0
      ? buildQuestionsInput(selectedItems.map((r) => ({ q: r.question, area: r.area, theme: r.theme })))
      : null);
  }, [selectedItems, onChange]);

  const toggle = (favId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(favId)) next.delete(favId);
      else if (next.size < MAX_QUESTIONS) next.add(favId);
      return next;
    });
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-[var(--c-muted)]" aria-hidden /></div>;
  }
  if (resolved.length === 0) {
    return <p className="py-8 text-center text-[13px] text-[var(--c-muted)]">Você ainda não tem questões favoritas (com simulado) para usar.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--c-muted)]">Selecione as favoritas</span>
        <span className={cn('text-[11px] font-semibold', atCap ? 'text-amber-600' : 'text-[var(--c-muted)]')}>{selected.size}/{MAX_QUESTIONS}</span>
      </div>

      <div className="max-h-[300px] space-y-1.5 overflow-y-auto pr-1">
        {resolved.map((r) => {
          const checked = selected.has(r.favoriteId);
          const disabled = !checked && atCap;
          return (
            <button
              key={r.favoriteId} type="button" disabled={disabled} onClick={() => toggle(r.favoriteId)}
              className={cn(
                'flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors',
                'disabled:cursor-not-allowed disabled:opacity-40',
                checked ? 'border-[var(--c-wine-500)] bg-[var(--c-wine-50)]' : 'border-[var(--c-border)] hover:border-[var(--c-wine-300)]',
              )}
            >
              <span className={cn(
                'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                checked ? 'border-[var(--c-wine-500)] bg-[var(--c-wine-500)] text-white' : 'border-[var(--c-muted-2)]',
              )}>
                {checked && <span className="text-[10px] leading-none">✓</span>}
              </span>
              <span className="min-w-0">
                <span className="block text-[12.5px] font-medium text-[var(--c-ink)] line-clamp-2">{r.question.text}</span>
                {(r.area || r.theme) && (
                  <span className="mt-0.5 block text-[11px] text-[var(--c-muted)]">{[r.area, r.theme].filter(Boolean).join(' · ')}</span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {skipped > 0 && (
        <p className="text-[11px] text-[var(--c-muted-2)]">{skipped} favorita{skipped === 1 ? '' : 's'} sem simulado não pôde{skipped === 1 ? '' : 'ram'} ser carregada{skipped === 1 ? '' : 's'}.</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit -p tsconfig.json` (sem novos erros).
```bash
git add src/components/caderno/flashcards/bulk/FavoritesSourcePicker.tsx
git commit -m "feat(flashcards): picker Favoritas (modo questions)"
```

---

## Task 6: Integrar os 4 pickers no BulkGenerateModal

**Files:**
- Modify: `src/components/caderno/flashcards/BulkGenerateModal.tsx`

- [ ] **Step 1: Importar os pickers**

Após os imports existentes dos pickers (`TopicSourceForm`, `CadernoSourcePicker`, `DeckTargetSelect`), adicionar:

```tsx
import { AnotacoesSourceForm } from './bulk/AnotacoesSourceForm';
import { WeakAreasSourcePicker } from './bulk/WeakAreasSourcePicker';
import { SimuladoSourcePicker } from './bulk/SimuladoSourcePicker';
import { FavoritesSourcePicker } from './bulk/FavoritesSourcePicker';
```

- [ ] **Step 2: Importar os ícones**

Na linha de import de `lucide-react` (atualmente `Sparkles, Loader2, BookOpen, Layers, ArrowLeft`), adicionar `FileText, TrendingDown, ClipboardCheck, Star`:

```tsx
import { Sparkles, Loader2, BookOpen, Layers, ArrowLeft, FileText, TrendingDown, ClipboardCheck, Star } from 'lucide-react';
```

- [ ] **Step 3: Estender o tipo SourceKey e a lista SOURCES**

Trocar `type SourceKey = 'topic' | 'caderno';` por:
```tsx
type SourceKey = 'topic' | 'caderno' | 'anotacoes' | 'fracos' | 'simulado' | 'favoritas';
```

E substituir o array `SOURCES` por:
```tsx
const SOURCES: SourceTile[] = [
  { key: 'topic', label: 'Tema / área', description: 'O Prof. San cria cards sobre um assunto', icon: <Layers className="h-5 w-5" aria-hidden /> },
  { key: 'caderno', label: 'Caderno de erros', description: 'Vira suas questões erradas em cards', icon: <BookOpen className="h-5 w-5" aria-hidden /> },
  { key: 'fracos', label: 'Pontos fracos', description: 'Foca nos temas em que você mais erra', icon: <TrendingDown className="h-5 w-5" aria-hidden /> },
  { key: 'simulado', label: 'Simulado concluído', description: 'Cards das questões que você errou', icon: <ClipboardCheck className="h-5 w-5" aria-hidden /> },
  { key: 'favoritas', label: 'Favoritas', description: 'Usa as questões que você favoritou', icon: <Star className="h-5 w-5" aria-hidden /> },
  { key: 'anotacoes', label: 'Anotações', description: 'Cola um resumo ou usa uma anotação salva', icon: <FileText className="h-5 w-5" aria-hidden /> },
];
```

- [ ] **Step 4: Renderizar os novos pickers no passo de configuração**

Onde hoje há:
```tsx
            {source === 'topic' && <TopicSourceForm onChange={setInput} />}
            {source === 'caderno' && <CadernoSourcePicker onChange={setInput} />}
```
Acrescentar logo abaixo:
```tsx
            {source === 'fracos' && <WeakAreasSourcePicker onChange={setInput} />}
            {source === 'simulado' && <SimuladoSourcePicker onChange={setInput} />}
            {source === 'favoritas' && <FavoritesSourcePicker onChange={setInput} />}
            {source === 'anotacoes' && <AnotacoesSourceForm onChange={setInput} />}
```

- [ ] **Step 5: Typecheck + lint + commit**

Run: `npx tsc --noEmit -p tsconfig.json` (sem novos erros).
Run: `npx eslint src/components/caderno/flashcards/BulkGenerateModal.tsx "src/components/caderno/flashcards/bulk/"` (0 erros).
```bash
git add src/components/caderno/flashcards/BulkGenerateModal.tsx
git commit -m "feat(flashcards): integra 4 fontes (anotações, pontos fracos, simulado, favoritas) no wizard"
```

---

## Task 7: Verificação

**Files:** nenhum.

- [ ] **Step 1: Suite automatizada**

Run: `npx tsc --noEmit -p tsconfig.json` → limpo.
Run: `npm run test -- src/lib/bulkFlashcards.test.ts` → todos os testes do lote passam.
Run: `npm run build` → build de produção OK.
Run (lint só dos arquivos novos/alterados): `npx eslint "src/components/caderno/flashcards/bulk/" src/components/caderno/flashcards/BulkGenerateModal.tsx src/lib/bulkFlashcards.ts` → 0 erros.

(Observação: existem 17 testes pré-existentes falhando em páginas não relacionadas — Desempenho/Resultado/SimuladoDetail/Ranking — que NÃO fazem parte deste changeset e não devem ser tratados aqui.)

- [ ] **Step 2: Verificação manual (gated pelo usuário, requer PRO + deploy da edge function)**

Logar como PRO em `/caderno/flashcards` → "Gerar em lote" → para cada nova fonte:
1. **Anotações:** colar texto → gera N cards no deck escolhido; e via anotação salva.
2. **Pontos fracos:** escolher um tema fraco → gera N cards de topic.
3. **Simulado concluído:** escolher simulado → questões erradas pré-marcadas → gera 1 card por questão; conferir `question_id` gravado.
4. **Favoritas:** selecionar favoritas → 1 card por favorita; conferir contagem e omissão de favoritas sem simulado.

---

## Self-Review (cobertura)

- ✅ Anotações → `text` (Task 2): colar OU anotação salva + count.
- ✅ Pontos fracos → `topic` (Task 3): rankWeakThemes + escolha + count.
- ✅ Simulado concluído → `questions` (Task 4): attempts finalizados → questões erradas com enunciado → 1 card/questão; cap MAX_QUESTIONS.
- ✅ Favoritas → `questions` (Task 5): listFavorites + resolução de enunciado por simulado; omite favoritas sem simulado (logado + aviso na UI); cap MAX_QUESTIONS.
- ✅ Helpers puros testados (Task 1): mapeamento de gabarito (correctOptionId→label), topic, weak entries.
- ✅ Integração no wizard (Task 6): 6 tiles, render condicional; reuso de `setInput` estável.
- ✅ Motor/insert/deck/curadoria/analytics da Fase 1 reaproveitados sem mudança.
- ✅ `suggestDeckName` já cobre os modos: topic→tema/área, text→"Resumo", questions→"Área — erros"/"Caderno de erros".

**Decisões registradas:**
- Favoritas sem `simulado_id` são omitidas (não há loader de questão por id avulso; evitamos adicionar RPC/método novo nesta fase). Logado + avisado na UI.
- Rótulo dos simulados concluídos vem de `getSimulado().title` (uma chamada por simulado distinto, em paralelo).
- Pontos fracos usa granularidade de TEMA (rankWeakThemes) para alimentar area+theme no modo topic.
