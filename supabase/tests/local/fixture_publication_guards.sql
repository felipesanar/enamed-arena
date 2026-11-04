\set ON_ERROR_STOP on
BEGIN;
\ir fixture-publication-setup.sql
DO $$
DECLARE mode "char";
BEGIN
  SELECT tgenabled INTO STRICT mode FROM pg_trigger WHERE tgrelid='public.simulados'::regclass
    AND tgname='trg_admin_publication';
  PERFORM pg_temp.fixture_publication_begin();
  ASSERT (SELECT tgenabled='D' FROM pg_trigger WHERE tgrelid='public.simulados'::regclass
    AND tgname='trg_admin_publication');
  BEGIN
    PERFORM pg_temp.fixture_publication_begin();
    RAISE EXCEPTION 'nested setup accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'fixture publication setup already active' THEN RAISE; END IF;
  END;
  PERFORM pg_temp.fixture_publication_end();
  ASSERT (SELECT tgenabled=mode FROM pg_trigger WHERE tgrelid='public.simulados'::regclass
    AND tgname='trg_admin_publication');
  PERFORM set_config('request.jwt.claims','{"role":"anon"}',true);
  BEGIN
    PERFORM pg_temp.fixture_publication_begin(); RAISE EXCEPTION 'anon claim accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  PERFORM set_config('request.jwt.claims','{}',true);
  PERFORM set_config('request.jwt.claim.sub','f0000000-0000-0000-0000-000000000001',true);
  BEGIN
    PERFORM pg_temp.fixture_publication_begin(); RAISE EXCEPTION 'actor accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  PERFORM set_config('request.jwt.claim.sub','',true);
  -- Fail-closed on a pre-disabled trigger; never silently repair another job's DDL.
  ALTER TABLE public.simulados DISABLE TRIGGER trg_admin_publication;
  BEGIN
    PERFORM pg_temp.fixture_publication_begin(); RAISE EXCEPTION 'disabled guard accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'unexpected publication trigger state:%' THEN RAISE; END IF;
  END;
  ALTER TABLE public.simulados ENABLE TRIGGER trg_admin_publication;
  ALTER TABLE public.simulados ENABLE ALWAYS TRIGGER trg_admin_publication;
  PERFORM pg_temp.fixture_publication_begin(); PERFORM pg_temp.fixture_publication_end();
  ASSERT (SELECT tgenabled='A' FROM pg_trigger WHERE tgrelid='public.simulados'::regclass
    AND tgname='trg_admin_publication');
  ALTER TABLE public.simulados ENABLE REPLICA TRIGGER trg_admin_publication;
  PERFORM pg_temp.fixture_publication_begin(); PERFORM pg_temp.fixture_publication_end();
  ASSERT (SELECT tgenabled='R' FROM pg_trigger WHERE tgrelid='public.simulados'::regclass
    AND tgname='trg_admin_publication');
  ALTER TABLE public.simulados ENABLE TRIGGER trg_admin_publication;
  -- A failed setup subtransaction must restore the DDL and its saved state.
  BEGIN
    PERFORM pg_temp.fixture_publication_begin();
    RAISE EXCEPTION 'fixture forced setup failure';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'fixture forced setup failure' THEN RAISE; END IF;
  END;
  ASSERT (SELECT tgenabled='O' FROM pg_trigger WHERE tgrelid='public.simulados'::regclass
    AND tgname='trg_admin_publication');
  ASSERT NOT EXISTS(SELECT FROM pg_temp.fixture_publication_state);
END $$;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  ASSERT session_user='postgres' AND current_user='authenticated' AND auth.uid() IS NULL;
  BEGIN PERFORM pg_temp.fixture_publication_begin(); RAISE EXCEPTION 'SET ROLE authenticated accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM pg_temp.fixture_publication_end(); RAISE EXCEPTION 'SET ROLE restore accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SET LOCAL ROLE anon;
DO $$ BEGIN
  BEGIN PERFORM pg_temp.fixture_publication_begin(); RAISE EXCEPTION 'SET ROLE anon accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
DO $$ BEGIN
  ASSERT (SELECT tgenabled='O' FROM pg_trigger WHERE tgrelid='public.simulados'::regclass
    AND tgname='trg_admin_publication'), 'guard enabled before real publication';
  BEGIN
    INSERT INTO public.simulados(title,slug,sequence_number,execution_window_start,execution_window_end,results_release_at)
      VALUES('Must reject','fixture-guard-reject',999999,now(),now()+interval '1 day',now()+interval '2 days');
    RAISE EXCEPTION 'real publication accepted without caller';
  EXCEPTION WHEN SQLSTATE 'P0003' THEN
    IF SQLERRM <> 'unauthorized' THEN RAISE; END IF;
  END;
END $$;
-- Also prove absent-trigger F0 compatibility without altering any persisted schema.
SAVEPOINT absent_trigger;
DROP TRIGGER trg_admin_publication ON public.simulados;
SELECT pg_temp.fixture_publication_begin();
SELECT pg_temp.fixture_publication_end();
ROLLBACK TO absent_trigger;
ROLLBACK;
