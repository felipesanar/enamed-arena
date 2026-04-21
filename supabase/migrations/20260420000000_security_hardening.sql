-- =====================================================================
-- Security Hardening Migration (2026-04-20)
-- =====================================================================
-- Addresses audit findings:
--   1. admin_simulado_question_stats regression — missing admin role check
--   2. attempts UPDATE allowed user to mutate score_percentage / status
--   3. get_ranking_for_simulado — filter by results_release_at
--   4. log_analytics_event — rate-limit abuse (anon + authenticated)
--   5. has_role — prevent enumeration of third-party admin status
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Re-add admin role check to admin_simulado_question_stats
-- ---------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.admin_simulado_question_stats(uuid);

CREATE OR REPLACE FUNCTION public.admin_simulado_question_stats(p_simulado_id uuid)
RETURNS TABLE(
  question_number integer,
  text text,
  correct_rate numeric,
  discrimination_index numeric,
  most_common_wrong_label text,
  most_common_wrong_pct numeric,
  area text,
  theme text,
  total_responses bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Guard: only admins can call this RPC
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = 'P0003';
  END IF;

  RETURN QUERY
  WITH submitted AS (
    SELECT id
    FROM attempts
    WHERE simulado_id = p_simulado_id
      AND status = 'submitted'
  ),
  results AS (
    SELECT
      aqr.question_id,
      aqr.is_correct,
      aqr.was_answered,
      aqr.selected_option_id
    FROM attempt_question_results aqr
    JOIN submitted s ON s.id = aqr.attempt_id
  ),
  per_question AS (
    SELECT
      r.question_id,
      count(*) FILTER (WHERE r.was_answered) AS total_answered,
      count(*) FILTER (WHERE r.is_correct)   AS total_correct
    FROM results r
    GROUP BY r.question_id
  ),
  wrong_options AS (
    SELECT
      r.question_id,
      qo.label,
      count(*) AS cnt,
      ROW_NUMBER() OVER (PARTITION BY r.question_id ORDER BY count(*) DESC) AS rn
    FROM results r
    JOIN question_options qo ON qo.id = r.selected_option_id
    WHERE r.is_correct = false AND r.was_answered = true
    GROUP BY r.question_id, qo.label
  ),
  top_wrong AS (
    SELECT question_id, label, cnt
    FROM wrong_options
    WHERE rn = 1
  ),
  top_bottom AS (
    SELECT
      aqr.question_id,
      aqr.is_correct,
      CASE
        WHEN a.score_percentage >= (
          SELECT PERCENTILE_CONT(0.73) WITHIN GROUP (ORDER BY a2.score_percentage)
          FROM attempts a2
          WHERE a2.simulado_id = p_simulado_id AND a2.status = 'submitted'
        ) THEN 'top'
        WHEN a.score_percentage <= (
          SELECT PERCENTILE_CONT(0.27) WITHIN GROUP (ORDER BY a2.score_percentage)
          FROM attempts a2
          WHERE a2.simulado_id = p_simulado_id AND a2.status = 'submitted'
        ) THEN 'bottom'
      END AS tier
    FROM attempt_question_results aqr
    JOIN attempts a ON a.id = aqr.attempt_id
    WHERE a.simulado_id = p_simulado_id AND a.status = 'submitted'
  ),
  disc AS (
    SELECT
      tb.question_id,
      COALESCE(
        (count(*) FILTER (WHERE tb.tier = 'top' AND tb.is_correct)::numeric
         / NULLIF(count(*) FILTER (WHERE tb.tier = 'top'), 0))
        -
        (count(*) FILTER (WHERE tb.tier = 'bottom' AND tb.is_correct)::numeric
         / NULLIF(count(*) FILTER (WHERE tb.tier = 'bottom'), 0))
      , 0) AS discrimination_index
    FROM top_bottom tb
    WHERE tb.tier IS NOT NULL
    GROUP BY tb.question_id
  )
  SELECT
    q.question_number,
    q.text,
    COALESCE(ROUND(pq.total_correct::numeric / NULLIF(pq.total_answered, 0) * 100, 1), 0) AS correct_rate,
    COALESCE(ROUND(d.discrimination_index, 2), 0) AS discrimination_index,
    tw.label AS most_common_wrong_label,
    CASE WHEN tw.cnt IS NOT NULL AND pq.total_answered > 0
      THEN ROUND(tw.cnt::numeric / pq.total_answered * 100, 1)
      ELSE NULL
    END AS most_common_wrong_pct,
    q.area,
    q.theme,
    COALESCE(pq.total_answered, 0) AS total_responses
  FROM questions q
  LEFT JOIN per_question pq ON pq.question_id = q.id
  LEFT JOIN disc d ON d.question_id = q.id
  LEFT JOIN top_wrong tw ON tw.question_id = q.id
  WHERE q.simulado_id = p_simulado_id
  ORDER BY correct_rate ASC, q.question_number ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_simulado_question_stats(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_simulado_question_stats(uuid) TO authenticated;

-- ---------------------------------------------------------------------
-- 2. Harden attempts — prevent user-side mutation of protected columns
-- ---------------------------------------------------------------------
-- Users may update their own attempts row via the progress RPC, but
-- score_percentage, status (beyond in_progress), finished_at, total_correct
-- and is_within_window MUST only change through SECURITY DEFINER RPCs
-- (finalize_attempt_with_results, update_attempt_progress_guarded, etc.).
-- A trigger rejects direct updates coming from non-superuser sessions.

CREATE OR REPLACE FUNCTION public.prevent_direct_attempts_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_service_role boolean;
BEGIN
  -- Detect service_role / superuser / SECURITY DEFINER functions:
  -- When called from RPCs, current_setting('request.jwt.claim.role') is set to service_role
  -- or the function itself is running with elevated permissions.
  -- If this trigger runs inside a SECURITY DEFINER function owned by postgres/supabase_admin,
  -- session_user will be different from "authenticated".
  v_is_service_role := (
    current_setting('request.jwt.claim.role', true) = 'service_role'
    OR session_user IN ('postgres', 'supabase_admin', 'supabase_auth_admin')
  );

  IF v_is_service_role THEN
    RETURN NEW;
  END IF;

  -- Block changes to protected columns from client sessions
  IF NEW.score_percentage IS DISTINCT FROM OLD.score_percentage THEN
    RAISE EXCEPTION 'attempts.score_percentage is read-only for clients (use finalize_attempt_with_results)' USING ERRCODE = 'P0001';
  END IF;

  IF NEW.total_correct IS DISTINCT FROM OLD.total_correct THEN
    RAISE EXCEPTION 'attempts.total_correct is read-only for clients' USING ERRCODE = 'P0001';
  END IF;

  IF NEW.total_answered IS DISTINCT FROM OLD.total_answered THEN
    RAISE EXCEPTION 'attempts.total_answered is read-only for clients' USING ERRCODE = 'P0001';
  END IF;

  IF NEW.finished_at IS DISTINCT FROM OLD.finished_at THEN
    RAISE EXCEPTION 'attempts.finished_at is read-only for clients' USING ERRCODE = 'P0001';
  END IF;

  IF NEW.is_within_window IS DISTINCT FROM OLD.is_within_window THEN
    RAISE EXCEPTION 'attempts.is_within_window is read-only for clients' USING ERRCODE = 'P0001';
  END IF;

  -- Status: clients can only set in_progress -> in_progress (no-op) or
  -- same value. Transition to submitted/expired must go through RPC.
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'attempts.status must be changed via finalize RPC' USING ERRCODE = 'P0001';
  END IF;

  -- Users cannot change ownership or simulado_id either
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'attempts.user_id is immutable' USING ERRCODE = 'P0001';
  END IF;

  IF NEW.simulado_id IS DISTINCT FROM OLD.simulado_id THEN
    RAISE EXCEPTION 'attempts.simulado_id is immutable' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_direct_attempts_update ON public.attempts;

CREATE TRIGGER trg_prevent_direct_attempts_update
BEFORE UPDATE ON public.attempts
FOR EACH ROW
EXECUTE FUNCTION public.prevent_direct_attempts_update();

-- ---------------------------------------------------------------------
-- 3. get_ranking_for_simulado: hide ranking before results_release_at
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_ranking_for_simulado(p_simulado_id uuid)
RETURNS TABLE(user_id uuid, simulado_id uuid, nota_final numeric, total_correct integer, total_answered integer, finished_at timestamp with time zone, full_name text, segment user_segment, especialidade text, instituicoes_alvo text[], posicao bigint, total_candidatos bigint)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_released boolean;
BEGIN
  SELECT
    s.results_release_at IS NULL OR s.results_release_at <= now()
  INTO v_released
  FROM simulados s
  WHERE s.id = p_simulado_id;

  -- If simulado not found or results not yet released, return empty.
  -- Admins still see everything via admin_get_ranking_for_simulado.
  IF v_released IS NULL OR v_released = false THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    a.user_id,
    a.simulado_id,
    a.score_percentage AS nota_final,
    a.total_correct,
    a.total_answered,
    a.finished_at,
    p.full_name,
    p.segment,
    op.specialty AS especialidade,
    op.target_institutions AS instituicoes_alvo,
    ROW_NUMBER() OVER (
      ORDER BY a.score_percentage DESC NULLS LAST, a.finished_at ASC NULLS LAST
    )::bigint AS posicao,
    COUNT(*) OVER ()::bigint AS total_candidatos
  FROM attempts a
  JOIN profiles p ON p.id = a.user_id
  LEFT JOIN onboarding_profiles op ON op.user_id = a.user_id
  WHERE a.simulado_id = p_simulado_id
    AND a.status IN ('submitted', 'expired')
    AND a.score_percentage IS NOT NULL
    AND a.is_within_window = true
  ORDER BY a.score_percentage DESC NULLS LAST, a.finished_at ASC NULLS LAST;
END;
$$;

-- ---------------------------------------------------------------------
-- 4. has_role — prevent enumeration of third-party admin status
-- ---------------------------------------------------------------------
-- Keep the 2-arg signature (used by RLS/internal functions) unchanged,
-- but drop EXECUTE from anon/authenticated so clients can only use the
-- 1-arg wrapper bound to auth.uid().

CREATE OR REPLACE FUNCTION public.current_user_has_role(_role app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = _role
  );
$$;

GRANT EXECUTE ON FUNCTION public.current_user_has_role(app_role) TO authenticated;

-- Revoke direct access to the 2-arg version for normal clients.
-- Internal RLS policies continue to use it because they run with the
-- definer rights of the table owner, not the caller's EXECUTE permission.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------
-- 5. log_analytics_event — rate-limit + payload size cap
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.log_analytics_event(
  p_event_name text,
  p_payload    jsonb default '{}'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recent_count integer;
  v_payload_size integer;
BEGIN
  IF p_event_name IS NULL OR trim(p_event_name) = '' THEN
    RETURN;
  END IF;

  -- Truncate over-long event names
  IF length(p_event_name) > 120 THEN
    p_event_name := left(p_event_name, 120);
  END IF;

  -- Cap payload size (rough JSON text length)
  v_payload_size := coalesce(length(p_payload::text), 0);
  IF v_payload_size > 8192 THEN
    p_payload := jsonb_build_object('truncated', true, 'original_size', v_payload_size);
  END IF;

  -- Per-user rate limit: max 120 events/minute (authenticated users).
  -- Anonymous callers (auth.uid() IS NULL) are limited to 30/minute globally
  -- via a lightweight check. Both prevent runaway client loops/abuse.
  IF auth.uid() IS NOT NULL THEN
    SELECT count(*) INTO v_recent_count
    FROM analytics_events
    WHERE user_id = auth.uid()
      AND created_at > now() - interval '1 minute';

    IF v_recent_count >= 120 THEN
      RETURN; -- silently drop
    END IF;
  ELSE
    SELECT count(*) INTO v_recent_count
    FROM analytics_events
    WHERE user_id IS NULL
      AND created_at > now() - interval '1 minute';

    IF v_recent_count >= 30 THEN
      RETURN;
    END IF;
  END IF;

  INSERT INTO analytics_events (user_id, event_name, payload)
  VALUES (auth.uid(), p_event_name, coalesce(p_payload, '{}'));
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_analytics_event(text, jsonb) TO authenticated, anon;

-- ---------------------------------------------------------------------
-- Done.
-- ---------------------------------------------------------------------
