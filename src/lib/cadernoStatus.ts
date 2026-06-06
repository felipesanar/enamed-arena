/**
 * cadernoStatus — pure helpers to derive the SRS state of an error_notebook entry.
 *
 * All functions are side-effect free and testable without any DOM or network.
 * Source of truth for thresholds: docs/specs/00-contratos-canonicos.md §4
 * and docs/specs/02-srs-engine.md §6.2.
 *
 * Usage:
 *   import { isLeechEntry, isAwaitingLesson, deriveEntryStatus } from '@/lib/cadernoStatus';
 */

import type { LastReviewOutcome } from '@/types/caderno';

// ─── Constants (mirrors srs_config in DB) ───────────────────────────────────

/** Accumulated lapses required to block an entry as leech. */
export const LEECH_THRESHOLD = 4;

// ─── Minimal SRS shape accepted by helpers ──────────────────────────────────

/**
 * Subset of error_notebook columns that the helpers need.
 * All SRS fields are optional so callers can pass the NotebookEntry shape
 * (which marks them `?`) without extra work.
 */
export interface SrsEntryFields {
  /** DB column: last_review_outcome */
  last_review_outcome?: string | null;
  /** DB column: srs_lapses */
  srs_lapses?: number | null;
  /** DB column: mastered_at */
  mastered_at?: string | null;
  /** DB column: srs_due_at */
  srs_due_at?: string | null;
  /** DB column: srs_reps */
  srs_reps?: number | null;
}

// ─── Derived status union ────────────────────────────────────────────────────

export type CadernoEntryStatus =
  | 'awaiting_lesson'   // Lacuna (did_not_know) not yet studied; blocks re-test
  | 'leech_blocked'     // >= 4 lapses; blocked until intervention
  | 'mastered'          // mastered_at IS NOT NULL
  | 'due'               // srs_due_at <= now (or no due date set)
  | 'scheduled'         // active, not yet due
  | 'active';           // fallback: in the cycle, no special state

// ─── Predicate helpers ───────────────────────────────────────────────────────

/**
 * Returns true when the entry is blocked because the student has not yet
 * studied the lesson for a "Lacuna" (did_not_know) entry.
 * Condition: last_review_outcome === 'awaiting_lesson'
 */
export function isAwaitingLesson(entry: SrsEntryFields): boolean {
  return (entry.last_review_outcome as LastReviewOutcome) === 'awaiting_lesson';
}

/**
 * Returns true when the entry has accumulated enough lapses to be considered
 * a "leech" and is blocked from re-testing until the student intervenes.
 * Condition: last_review_outcome === 'leech_blocked' OR srs_lapses >= LEECH_THRESHOLD
 *
 * The OR covers entries that were flagged before the `leech_blocked` outcome
 * was introduced (backward compat with legacy rows that only have srs_lapses set).
 */
export function isLeechEntry(entry: SrsEntryFields): boolean {
  if ((entry.last_review_outcome as LastReviewOutcome) === 'leech_blocked') return true;
  const lapses = (entry.srs_lapses ?? 0) as number;
  return lapses >= LEECH_THRESHOLD;
}

/**
 * Returns the accumulated lapse count, defaulting to 0 when the field is absent.
 */
export function getLapseCount(entry: SrsEntryFields): number {
  return (entry.srs_lapses ?? 0) as number;
}

/**
 * Returns true when the entry is mastered (mastered_at IS NOT NULL).
 */
export function isMastered(entry: SrsEntryFields): boolean {
  return !!(entry.mastered_at);
}

/**
 * Returns true when the entry's next review is due (srs_due_at <= now).
 * Entries with no srs_due_at are treated as due.
 */
export function isDue(entry: SrsEntryFields): boolean {
  const due = entry.srs_due_at as string | null | undefined;
  if (!due) return true;
  return new Date(due).getTime() <= Date.now();
}

// ─── Master status derivation ────────────────────────────────────────────────

/**
 * Returns the canonical status for an entry, evaluated in priority order:
 *
 * 1. awaiting_lesson  — Lacuna blocked until student studies
 * 2. leech_blocked    — too many lapses, needs intervention
 * 3. mastered         — domínio automático atingido
 * 4. due              — scheduled review is due today or overdue
 * 5. scheduled        — active and not yet due
 * 6. active           — fallback
 */
export function deriveEntryStatus(entry: SrsEntryFields): CadernoEntryStatus {
  if (isAwaitingLesson(entry)) return 'awaiting_lesson';
  if (isLeechEntry(entry)) return 'leech_blocked';
  if (isMastered(entry)) return 'mastered';
  if (isDue(entry)) return 'due';
  if (entry.srs_due_at) return 'scheduled';
  return 'active';
}

/**
 * Returns true when the entry is in a blocked state that prevents re-testing.
 * Blocked states: 'awaiting_lesson' | 'leech_blocked'
 */
export function isReviewBlocked(entry: SrsEntryFields): boolean {
  const status = deriveEntryStatus(entry);
  return status === 'awaiting_lesson' || status === 'leech_blocked';
}
