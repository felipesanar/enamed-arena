-- F3-6. Additive and transactional: no backfill, score/deadline changes or F0 replacement.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- Fail closed if the prerequisite protection was removed/disabled. PostgreSQL
-- executes same-kind BEFORE triggers by name: F0 must run before our no-op.
DO $$
DECLARE v_fingerprint text; v_marker text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger
    WHERE tgrelid='public.answers'::regclass AND tgname='trg_enforce_answer_integrity'
      AND tgfoid='public.enforce_answer_integrity()'::regprocedure AND tgenabled='O'
      AND (tgtype & 23)=23) THEN
    RAISE EXCEPTION 'F3 freshness requires the active F0 answer integrity trigger';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.answers'::regclass
    AND tgname='zzzz_answer_freshness' AND (
      tgfoid IS DISTINCT FROM to_regprocedure('public.enforce_answer_freshness()')
      OR tgtype<>23 OR tgenabled<>'O' OR tgnargs<>0 OR tgqual IS NOT NULL
      OR tgattr::text<>'')) THEN
    RAISE EXCEPTION 'F3 freshness trigger drift: refusing to replace an unknown guard';
  END IF;
  SELECT md5(pg_get_functiondef(p.oid) || pg_get_userbyid(p.proowner) || COALESCE(p.proacl::text,'')),
    obj_description(p.oid,'pg_proc') INTO v_fingerprint,v_marker
    FROM pg_proc p WHERE p.oid=to_regprocedure('public.enforce_answer_freshness()');
  IF FOUND AND v_marker IS DISTINCT FROM 'F3-6 fingerprint:' || v_fingerprint
    -- Exact, unmarked development predecessor from this job, not arbitrary SQL.
    AND NOT (v_marker IS NULL AND v_fingerprint='e8313ac54313651fcda8be3decb1c855') THEN
    RAISE EXCEPTION 'F3 freshness function drift: refusing to replace an unknown helper or metadata';
  END IF;
END $$;

ALTER TABLE public.answers ADD COLUMN IF NOT EXISTS client_updated_at timestamptz;
COMMENT ON COLUMN public.answers.client_updated_at IS
  'Client mutation version (server-synced clock); null for legacy. Not authorization or a deadline.';

CREATE OR REPLACE FUNCTION public.enforce_answer_freshness()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  -- Validate INSERT too: PostgREST upserts pass through both INSERT and UPDATE.
  -- Old finite timestamps are intentionally allowed for pending offline writes.
  IF NEW.client_updated_at IS NOT NULL AND (
    NOT isfinite(NEW.client_updated_at)
    OR NEW.client_updated_at > clock_timestamp() + interval '2 minutes'
  ) THEN
    RAISE EXCEPTION 'invalid answer client_updated_at' USING ERRCODE='22023';
  END IF;
  IF TG_OP='UPDATE' AND OLD.client_updated_at IS NOT NULL AND (
    NEW.client_updated_at IS NULL OR NEW.client_updated_at <= OLD.client_updated_at
  ) THEN
    -- Only effective SQL owners of the guarded paper RPCs, never JWT/GUC roles.
    -- F0 ran first and checked identity/content. Do not erase version history
    -- when the existing DEFINER upsert omits the new column.
    IF current_user IN ('postgres', 'supabase_admin')
      AND EXISTS (SELECT 1 FROM public.attempts a WHERE a.id=NEW.attempt_id
        AND a.attempt_type IN ('offline','presencial') AND a.status='offline_pending') THEN
      NEW.client_updated_at := OLD.client_updated_at;
      RETURN NEW;
    END IF;
    -- F0 already validated ownership, immutable keys, option, status and deadline.
    -- Skip only this row, preserving the rest of a legitimate bulk replay.
    RETURN NULL;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.enforce_answer_freshness() FROM PUBLIC, anon, authenticated, service_role;
DO $$ DECLARE v_fingerprint text; BEGIN
  SELECT md5(pg_get_functiondef(p.oid) || pg_get_userbyid(p.proowner) || COALESCE(p.proacl::text,''))
    INTO v_fingerprint FROM pg_proc p WHERE p.oid='public.enforce_answer_freshness()'::regprocedure;
  EXECUTE format('COMMENT ON FUNCTION public.enforce_answer_freshness() IS %L', 'F3-6 fingerprint:' || v_fingerprint);
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.answers'::regclass AND tgname='zzzz_answer_freshness') THEN
    CREATE TRIGGER zzzz_answer_freshness BEFORE INSERT OR UPDATE ON public.answers
    FOR EACH ROW EXECUTE FUNCTION public.enforce_answer_freshness();
  END IF;
END $$;
-- No RLS/ACL changes. Existing answers table privileges cover this nonsensitive column.
COMMIT;

-- Manual rollback, only after disabling/draining new clients:
-- ROLLBACK SQL START
-- BEGIN;
-- SET LOCAL lock_timeout='5s';
-- DO $$ BEGIN
--   IF NOT EXISTS (SELECT 1 FROM pg_proc p
--     WHERE p.oid=to_regprocedure('public.enforce_answer_freshness()')
--       AND obj_description(p.oid,'pg_proc') = 'F3-6 fingerprint:' ||
--         md5(pg_get_functiondef(p.oid) || pg_get_userbyid(p.proowner) || COALESCE(p.proacl::text,'')))
--     OR NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.answers'::regclass
--       AND tgname='zzzz_answer_freshness' AND tgfoid=to_regprocedure('public.enforce_answer_freshness()')
--       AND tgtype=23 AND tgenabled='O' AND tgnargs=0 AND tgqual IS NULL AND tgattr::text='') THEN
--     RAISE EXCEPTION 'F3 freshness rollback drift: refusing to drop an unknown guard';
--   END IF;
-- END $$;
-- DROP TRIGGER zzzz_answer_freshness ON public.answers;
-- DROP FUNCTION public.enforce_answer_freshness();
-- COMMIT;
-- ROLLBACK SQL END
-- Keep client_updated_at and every answer intact. Dropping the column would
-- destroy version history and is NOT part of rollback. No F0 object is modified.
