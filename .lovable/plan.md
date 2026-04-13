

# Fix: DesempenhoPage data + layout

## Problem 1: All scores show 0 (CRITICAL)

**Root cause**: `rowsToQuestion()` in `simuladosApi.ts` always sets `correctOptionId: ''` (line 150). It never fetches `is_correct` from `question_options`. So `computePerformanceBreakdown` compares user answers against `''` and everything shows as incorrect.

Additionally, `getQuestions()` only selects `id, question_id, label, text` from `question_options` — missing the `is_correct` column.

The DesempenhoPage calls `useSimuladoDetail()` without `includeCorrectAnswers=true`, and even if it did, the function ignores that flag.

**Fix**:
1. **`src/services/simuladosApi.ts`**: 
   - Add `is_correct` to `QuestionOptionRow` interface
   - In `getQuestions()`, when `includeCorrectAnswers=true`, select `is_correct` from `question_options`
   - In `rowsToQuestion()`, when `includeCorrectAnswers=true`, find the option with `is_correct=true` and set `correctOptionId` to its `id`

2. **`src/pages/DesempenhoPage.tsx`**: Call `useSimuladoDetail(selectedSimuladoId, true)` to request correct answers

## Problem 2: Layout — card should be full-width

**Current**: `DesempenhoSimuladoPanel` is a rounded card (`rounded-[22px]`) centered in the page, with `PageHeader` outside it.

**Fix in `src/pages/DesempenhoPage.tsx`**: Remove `PageHeader` and pass title info into the panel.

**Fix in `src/components/desempenho/DesempenhoSimuladoPanel.tsx`**:
- Remove the outer `rounded-[22px]` border/shadow wrapper — make it full-width
- Move the page title ("Desempenho" / "Sua evolução por área e tema.") into the hero header section
- The hero gradient becomes the page header, spanning full width
- The white content area below also spans full width (no rounded corners on the outer container)

## Files to edit

| File | Change |
|------|--------|
| `src/services/simuladosApi.ts` | Add `is_correct` to option row type + query; use it in `rowsToQuestion` when flag is true |
| `src/pages/DesempenhoPage.tsx` | Pass `includeCorrectAnswers=true` to hook; remove `PageHeader`; remove it from skeleton/empty states too or integrate into panel |
| `src/components/desempenho/DesempenhoSimuladoPanel.tsx` | Remove rounded card wrapper; integrate page title into hero header; make layout full-width |

