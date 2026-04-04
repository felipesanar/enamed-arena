-- Offline exam mode: add attempt_type and offline_answers_submitted_at to attempts
-- Adds RPCs: create_offline_attempt_guarded, submit_offline_answers_guarded

-- ─── Schema changes ───────────────────────────────────────────────────────────

ALTER TABLE public.attempts
  ADD COLUMN IF NOT EXISTS attempt_type text NOT NULL DEFAULT 'online',
  ADD COLUMN IF NOT EXISTS offline_answers_submitted_at timestamptz;

ALTER TABLE public.attempts
  DROP CONSTRAINT IF EXISTS attempts_attempt_type_check;

ALTER TABLE public.attempts
  ADD CONSTRAINT attempts_attempt_type_check CHECK (attempt_type IN ('online', 'offline'));

-- ─── RPC: create_offline_attempt_guarded ─────────────────────────────────────
-- Creates an offline attempt (status='offline_pending') for a simulado.
-- Server sets started_at via now() — client cannot influence timing.
-- Returns existing offline_pending attempt if one already exists (idempotent).

CREATE OR REPLACE FUNCTION public.create_offline_attempt_guarded(p_simulado_id uuid)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_simulado   public.simulados%ROWTYPE;
  v_existing   public.attempts%ROWTYPE;
  v_now        TIMESTAMPTZ := now();
  v_in_window  BOOLEAN;
  v_exam_secs  INTEGER;
  v_new        public.attempts%ROWTYPE;
BEGIN
  SELECT * INTO v_simulado
  FROM public.simulados
  WHERE id = p_simulado_id AND status IN ('published', 'test');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Simulado not found or not published';
  END IF;

  v_exam_secs := v_simulado.duration_minutes * 60;
  v_in_window := (v_now >= v_simulado.execution_window_start AND v_now <= v_simulado.execution_window_end);

  -- Return existing offline_pending attempt (idempotent)
  SELECT * INTO v_existing
  FROM public.attempts
  WHERE simulado_id = p_simulado_id
    AND user_id = auth.uid()
    AND status = 'offline_pending';

  IF FOUND THEN
    RETURN jsonb_build_object(
      'attempt_id',           v_existing.id,
      'started_at',           v_existing.started_at,
      'exam_duration_seconds', v_exam_secs,
      'simulado_slug',        v_simulado.slug
    );
  END IF;

  -- Block if already submitted
  SELECT * INTO v_existing
  FROM public.attempts
  WHERE simulado_id = p_simulado_id
    AND user_id = auth.uid()
    AND status IN ('submitted', 'expired');

  IF FOUND THEN
    RAISE EXCEPTION 'Attempt already submitted for this simulado';
  END IF;

  -- Block if online attempt is in progress
  SELECT * INTO v_existing
  FROM public.attempts
  WHERE simulado_id = p_simulado_id
    AND user_id = auth.uid()
    AND status = 'in_progress';

  IF FOUND THEN
    RAISE EXCEPTION 'An online attempt is already in progress for this simulado';
  END IF;

  INSERT INTO public.attempts (
    simulado_id, user_id, status, attempt_type,
    started_at, effective_deadline,
    current_question_index, tab_exit_count, fullscreen_exit_count,
    is_within_window
  )
  VALUES (
    p_simulado_id, auth.uid(), 'offline_pending', 'offline',
    v_now, v_now + (v_simulado.duration_minutes || ' minutes')::interval,
    0, 0, 0,
    v_in_window
  )
  RETURNING * INTO v_new;

  RETURN jsonb_build_object(
    'attempt_id',           v_new.id,
    'started_at',           v_new.started_at,
    'exam_duration_seconds', v_exam_secs,
    'simulado_slug',        v_simulado.slug
  );
END;
$function$;

-- ─── RPC: submit_offline_answers_guarded ─────────────────────────────────────
-- Validates timing entirely server-side. Computes is_within_window as:
--   (1) attempt.started_at within simulado execution window
--   (2) submission time - started_at <= exam_duration_seconds
-- Both conditions must be true to enter the ranking.
-- Client NEVER writes is_within_window directly.

CREATE OR REPLACE FUNCTION public.submit_offline_answers_guarded(
  p_attempt_id uuid,
  p_answers    jsonb  -- [{ question_id: uuid, selected_option_id: uuid | null }, ...]
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_attempt         public.attempts%ROWTYPE;
  v_simulado        public.simulados%ROWTYPE;
  v_now             TIMESTAMPTZ := now();
  v_elapsed_secs    DOUBLE PRECISION;
  v_exam_secs       INTEGER;
  v_in_time         BOOLEAN;
  v_in_window       BOOLEAN;
  v_is_within       BOOLEAN;
  v_ans             jsonb;
  v_q_id            uuid;
  v_opt_id          uuid;
BEGIN
  -- Lock the attempt row
  SELECT * INTO v_attempt
  FROM public.attempts
  WHERE id = p_attempt_id
    AND user_id = auth.uid()
    AND attempt_type = 'offline'
    AND status = 'offline_pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Offline attempt not found or already submitted';
  END IF;

  SELECT * INTO v_simulado
  FROM public.simulados
  WHERE id = v_attempt.simulado_id;

  v_exam_secs    := v_simulado.duration_minutes * 60;
  v_elapsed_secs := EXTRACT(EPOCH FROM (v_now - v_attempt.started_at));
  v_in_time      := v_elapsed_secs <= v_exam_secs;

  v_in_window := (
    v_attempt.started_at >= v_simulado.execution_window_start
    AND v_attempt.started_at <= v_simulado.execution_window_end
  );

  v_is_within := v_in_window AND v_in_time;

  -- Upsert answers
  FOR v_ans IN SELECT * FROM jsonb_array_elements(p_answers)
  LOOP
    v_q_id := (v_ans->>'question_id')::uuid;

    IF (v_ans->>'selected_option_id') IS NOT NULL THEN
      v_opt_id := (v_ans->>'selected_option_id')::uuid;
    ELSE
      v_opt_id := NULL;
    END IF;

    INSERT INTO public.answers (
      attempt_id, question_id, selected_option_id,
      marked_for_review, high_confidence, eliminated_options, answered_at
    )
    VALUES (
      p_attempt_id, v_q_id, v_opt_id,
      false, false, '{}',
      CASE WHEN v_opt_id IS NOT NULL THEN v_now ELSE NULL END
    )
    ON CONFLICT (attempt_id, question_id)
    DO UPDATE SET
      selected_option_id = EXCLUDED.selected_option_id,
      answered_at        = EXCLUDED.answered_at;
  END LOOP;

  -- Set timing metadata before finalization
  UPDATE public.attempts SET
    offline_answers_submitted_at = v_now,
    finished_at                  = v_now,
    is_within_window             = v_is_within
  WHERE id = p_attempt_id;

  -- Finalize: calculates score, sets status = 'submitted'
  PERFORM public.finalize_attempt_with_results(p_attempt_id);

  -- Re-assert is_within_window after finalize (finalize may overwrite it)
  UPDATE public.attempts SET
    is_within_window = v_is_within
  WHERE id = p_attempt_id;

  RETURN jsonb_build_object(
    'attempt_id',      p_attempt_id,
    'is_within_window', v_is_within
  );
END;
$function$;
