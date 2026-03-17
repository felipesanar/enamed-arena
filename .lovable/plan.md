

## Problem

The `answers` table in Supabase is **completely empty** — zero rows. The attempt exists with `score_percentage=10, total_correct=1`, but no individual answer rows were persisted. The correction page (`CorrecaoPage`) and result page load answers exclusively from DB via `useExamResult` → `getAnswers(attemptId)`, find nothing, and show 0/10 with all questions as "Em branco."

## Root Cause

In `submitAttempt`, the function calls `flushPendingState()` which:
1. Clears the debounce timer
2. Loads state from `localStorage`
3. Calls `syncToDb(localState)`

But the `finalState` parameter (which has all the answers) is **never used for syncing**. The flush relies on localStorage which may have stale or incomplete data. Additionally, `syncToDb` silently catches errors — if the upsert fails (e.g., RLS timing, network), answers are lost forever.

## Fix Plan

### 1. Fix `submitAttempt` in `useExamStorageReal.ts`

- Use the `finalState` parameter directly for syncing answers, not localStorage
- Call `syncToDb(finalState)` explicitly before submitting the attempt status
- Add a retry: if first sync fails, try once more before proceeding

### 2. Fix `useExamResult.ts` — add localStorage fallback

- If DB returns zero answer rows but the attempt is submitted, check localStorage for cached answers
- This provides resilience for the existing attempt that has no DB answers

### 3. Fix `flushPendingState` to accept state parameter

- Change signature to `flushPendingState(state?: ExamState)` so `submitAttempt` can pass the definitive final state instead of relying on localStorage

| File | Change |
|------|--------|
| `src/hooks/useExamStorageReal.ts` | Fix `submitAttempt` to sync `finalState` directly; update `flushPendingState` |
| `src/hooks/useExamResult.ts` | Add localStorage fallback when DB answers are empty |

