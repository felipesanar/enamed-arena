

## Problem

Simulados #1 and #2 show "Resultado liberado" with "Ver Resultado" buttons even though:
- The user never took them
- They have **zero questions** in the database

This happens because `deriveSimuladoStatus` returns `results_available` whenever `now > resultsReleaseAt`, regardless of user participation.

Meanwhile, **Simulado #3** is the only one with real questions (10 questions, all with 5 options each) and its execution window is currently open (March 9–23, 2026). This is the one real, usable simulado.

## Plan

### 1. Fix status derivation logic

In `src/lib/simulado-helpers.ts`, change `deriveSimuladoStatus` so that:
- `results_available` is only returned when the user **has a finished attempt** and results date has passed (same as `completed` but with the label distinction)
- If the user has **no attempt** and the window + results date are past, return `closed_waiting` (shows "Encerrado" — the user missed it)

This single change fixes the root cause. The two simulados without attempts will show as "Encerrado" instead of "Resultado liberado."

### 2. Adjust SimuladosPage categorization

Update the `past` filter to also include simulados the user missed (no attempt, window closed). Consider renaming the section from "Realizados" to "Anteriores" since it now includes missed simulados too.

### 3. Update SimuladoCard for missed simulados

For `closed_waiting` simulados where results are already out but user didn't participate, the card should say something like "Não realizado" rather than "Aguardando resultado."

### 4. No database changes needed

Simulado #3 already has all 10 questions with correct answers. The full exam flow (start → answer → submit → score → results → correction) should work end-to-end with existing data and code.

### Summary of file changes

| File | Change |
|------|--------|
| `src/lib/simulado-helpers.ts` | Fix `deriveSimuladoStatus` — require user attempt for `results_available`/`completed` |
| `src/pages/SimuladosPage.tsx` | Rename "Realizados" section, adjust filter logic |
| `src/components/SimuladoCard.tsx` | Minor: handle "missed" simulado display |

