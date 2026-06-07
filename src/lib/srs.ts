/**
 * SM-2-lite reference implementation — Caderno de Erros v2
 *
 * PURPOSE: Pure-TypeScript mirror of the `schedule_next_review_guarded` SQL RPC
 * defined in docs/specs/02-srs-engine.md. Serves as an executable spec, enabling
 * unit-tested previews of SRS scheduling without hitting Supabase.
 *
 * IMPORTANT: The source of truth at runtime is the SQL RPC
 * `schedule_next_review_guarded`. This module replicates its logic for:
 *   1. Unit tests / spec validation
 *   2. Client-side "preview next review date" UI hints
 *
 * Any divergence between this file and the RPC is a bug — fix both.
 *
 * Spec: docs/specs/02-srs-engine.md
 * Canonical contracts: docs/specs/00-contratos-canonicos.md §4
 */

import type { DbReason } from '@/lib/errorNotebookReasons';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SrsOutcome = 'errei' | 'dificil' | 'bom' | 'facil';
export type SrsConfidence = 'baixa' | 'media' | 'alta';

/**
 * The SRS state fields stored in `error_notebook`.
 * Mirrors the columns defined in spec 01 / contratos-canonicos.md §3.
 */
export interface SrsState {
  srsEase: number;       // float, default 2.5
  srsInterval: number;   // int, days
  srsReps: number;       // int, consecutive successful reviews
  srsLapses: number;     // int, accumulated lapses
  reason: DbReason;
  /**
   * The last two review confidences, most-recent first.
   * Used only for Chute promotion check (spec 02 §3.5).
   * Pass [] when no prior review_attempts exist.
   */
  lastTwoConfidences?: SrsConfidence[];
}

export interface SrsReviewInput {
  outcome: SrsOutcome;
  confidence: SrsConfidence;
}

export interface SrsResult {
  srsEase: number;
  srsInterval: number;
  srsReps: number;
  srsLapses: number;
  /**
   * Relative interval in days. The caller computes
   * `srs_due_at = now + srsInterval days`.
   * Not returned as an absolute date so this module stays timezone-free.
   */
  mastered: boolean;
  isLeech: boolean;
}

// ---------------------------------------------------------------------------
// Constants (spec 02 appendix — parametrizáveis)
// ---------------------------------------------------------------------------

const EASE_DEFAULT = 2.5;
const EASE_LACUNA = 2.1;
const EASE_DIFERENCIAL = 2.3;
const EASE_ATENCAO = 2.8;
const EASE_MIN = 1.3;

const LAPSE_INTERVAL_FACTOR = 0.2;
const LAPSE_EASE_PENALTY = 0.2;

const INTERVAL_REPS_1 = 1;  // days for reps 0→1 (standard)
const INTERVAL_REPS_2 = 4;  // days for reps 1→2 (standard)
const INTERVAL_ATENCAO_REPS_1 = 2;  // days for reps 0→1 (reading_error)
const INTERVAL_ATENCAO_REPS_2 = 6;  // days for reps 1→2 (reading_error)

const LEECH_THRESHOLD = 4;
const MASTERY_MIN_REPS = 3;
const MASTERY_MIN_INTERVAL = 21;
const CHUTE_PROMOTION_REPS = 2;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** SM-2 quality mapping */
function outcomeToQuality(outcome: SrsOutcome): number {
  switch (outcome) {
    case 'errei':   return 0;
    case 'dificil': return 2;
    case 'bom':     return 3;
    case 'facil':   return 4;
  }
}

/** Ease base when reps = 0 (first review) — modulated by reason */
function initialEaseForReason(reason: DbReason): number {
  switch (reason) {
    case 'did_not_know':
    case 'guessed_correctly':
      return EASE_LACUNA;          // 2.1
    case 'confused_alternatives':
      return EASE_DIFERENCIAL;     // 2.3
    case 'reading_error':
      return EASE_ATENCAO;         // 2.8
    default:
      // did_not_remember, did_not_understand (legacy)
      return EASE_DEFAULT;         // 2.5
  }
}

/** Round half-up, matching SQL ROUND() */
function sqlRound(x: number): number {
  return Math.round(x);
}

function clamp(value: number, min: number): number {
  return Math.max(value, min);
}

// ---------------------------------------------------------------------------
// Core function
// ---------------------------------------------------------------------------

/**
 * Computes the next SRS state given the current state and a review event.
 *
 * Mirrors `schedule_next_review_guarded` PL/pgSQL logic (spec 02 §7.2).
 *
 * Steps:
 *   1. Resolve ease_base (initial or current)
 *   2. Apply low-confidence override (confidence='baixa' forces q=2)
 *   3. Lapse or success path
 *   4. Chute promotion (guessed_correctly §3.5)
 *   5. Leech detection
 *   6. Mastery check
 */
export function computeNextReview(
  state: SrsState,
  review: SrsReviewInput,
): SrsResult {
  const { outcome, confidence } = review;
  const { srsEase, srsInterval, srsReps, srsLapses, reason, lastTwoConfidences = [] } = state;

  // Step 1: resolve ease_base
  //
  // The reason-specific initial ease (2.1/2.3/2.8) is set on the entry at
  // CREATION time and stored in srs_ease from the very first write.
  // At review time we always use the stored srs_ease — including after a lapse
  // where srs_reps was reset to 0 but srs_ease already holds the (penalised) value.
  //
  // The pseudocode in spec §7.2 step 5 (`WHEN srs_reps = 0 THEN initial_ease`)
  // describes the case where the entry was just created and never reviewed:
  // the DB row would have srs_ease = default (2.5) regardless of reason if the
  // reason-specific initialisation were not applied. In the reference model here,
  // the caller is responsible for passing srs_ease = initialEaseForReason(reason)
  // for brand-new entries (srs_reps=0 AND srs_ease still at DB default 2.5).
  //
  // To mirror the RPC faithfully: use srs_reps=0 sentinel ONLY when srs_ease
  // equals the database column default (2.5), i.e., the entry was never touched.
  // After any lapse, srs_ease will differ from 2.5, so stored value is used.
  const isFirstEverReview = srsReps === 0 && srsEase === 2.5;
  const easeBase = isFirstEverReview ? initialEaseForReason(reason) : srsEase;

  // Step 2: map outcome → quality; apply confidence-baixa override
  let q = outcomeToQuality(outcome);
  if (confidence === 'baixa' && q > 2) {
    q = 2; // treat as Difícil regardless of self-grade (spec 02 §4)
  }

  let newReps: number;
  let newLapses: number;
  let newEase: number;
  let newInterval: number;

  if (q === 0) {
    // ---- Lapse path (spec 02 §1.2, §6.1) ----
    newReps     = 0;
    newLapses   = srsLapses + 1;
    newEase     = clamp(easeBase - LAPSE_EASE_PENALTY, EASE_MIN);
    newInterval = Math.max(1, sqlRound(srsInterval * LAPSE_INTERVAL_FACTOR));
  } else {
    // ---- Success path (spec 02 §1.2) ----
    newReps   = srsReps + 1;
    newLapses = srsLapses; // lapses unchanged on success

    const deltaEase = 0.1 - (4 - q) * (0.08 + (4 - q) * 0.02);
    newEase = clamp(easeBase + deltaEase, EASE_MIN);

    // Interval modulated by reason=reading_error (spec 02 §3.3)
    if (reason === 'reading_error') {
      if (newReps === 1) {
        newInterval = INTERVAL_ATENCAO_REPS_1; // 2
      } else if (newReps === 2) {
        newInterval = INTERVAL_ATENCAO_REPS_2; // 6
      } else {
        newInterval = sqlRound(srsInterval * newEase);
      }
    } else {
      if (newReps === 1) {
        newInterval = INTERVAL_REPS_1; // 1
      } else if (newReps === 2) {
        newInterval = INTERVAL_REPS_2; // 4
      } else {
        newInterval = sqlRound(srsInterval * newEase);
      }
    }

    // Step 4: Chute promotion (spec 02 §3.5)
    // If guessed_correctly AND reps >= CHUTE_PROMOTION_REPS AND last two confidences
    // are both >= 'media', treat ease as if it were Memória (2.5).
    if (reason === 'guessed_correctly' && newReps >= CHUTE_PROMOTION_REPS) {
      // The current review confidence counts as the latest; lastTwoConfidences[0]
      // is the one before it.
      const lastConfOk = (c: SrsConfidence) => c === 'media' || c === 'alta';
      const currentOk = lastConfOk(confidence);
      const prevOk = lastTwoConfidences.length >= 1 && lastConfOk(lastTwoConfidences[0]);
      if (currentOk && prevOk && newEase < EASE_DEFAULT) {
        newEase = EASE_DEFAULT; // boost to 2.5
      }
    }
  }

  // Step 5: Leech detection (spec 02 §6.2–6.3)
  const isLeech = newLapses >= LEECH_THRESHOLD;

  // Step 6: Mastery check (spec 02 §5.1)
  // Only on success, not blocked by leech.
  // Conditions A, B, C, D, E, F (G is handled by Chute promotion above):
  //   A: newReps >= MASTERY_MIN_REPS
  //   B: srsLapses_recentes = 0 (we use srsLapses from input, pre-this-lapse;
  //      if this was a success and srsLapses was 0 before, it remains 0)
  //   C+D: last two confidences >= 'media' (current + previous)
  //   E: newInterval >= MASTERY_MIN_INTERVAL
  //   F: outcome in ('bom', 'facil')
  //   G: not blocked by legacy lacuna/chute rules — handled: chute gets promoted ease first
  let mastered = false;
  if (q > 0 && !isLeech) {
    const condA = newReps >= MASTERY_MIN_REPS;
    const condB = srsLapses === 0; // no lapse in current streak (recentes)
    const condE = newInterval >= MASTERY_MIN_INTERVAL;
    const condF = outcome === 'bom' || outcome === 'facil';
    // C+D: current confidence + previous from lastTwoConfidences
    const lastConfOk = (c: SrsConfidence) => c === 'media' || c === 'alta';
    const condC = lastConfOk(confidence); // current (most recent after this review)
    const condD = lastTwoConfidences.length >= 1 && lastConfOk(lastTwoConfidences[0]);
    mastered = condA && condB && condC && condD && condE && condF;
  }

  return {
    srsEase: newEase,
    srsInterval: newInterval,
    srsReps: newReps,
    srsLapses: newLapses,
    mastered,
    isLeech,
  };
}
