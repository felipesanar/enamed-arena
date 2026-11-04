-- QA only: include INSIDE BEGIN/ROLLBACK. Never use in a migration.
-- Invoker security is intentional: session_user alone does not detect SET ROLE.
DO $$ BEGIN
  IF inet_server_addr() IS DISTINCT FROM '127.0.0.1'::inet
    OR inet_server_port() IS DISTINCT FROM 54737
    OR current_database() !~ '^enamed_test_[a-z0-9_]+$'
    OR session_user <> 'postgres' OR current_user <> 'postgres'
    OR auth.uid() IS NOT NULL
    OR coalesce(current_setting('request.jwt.claim.sub',true),'') <> ''
    OR coalesce(current_setting('request.jwt.claim.role',true),'') <> ''
    OR coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb <> '{}'::jsonb
  THEN RAISE EXCEPTION 'fixture publication setup requires local postgres without JWT claims'
    USING ERRCODE='42501';
  END IF;
END $$;
CREATE TEMP TABLE fixture_publication_state (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  previous_mode "char" NOT NULL
) ON COMMIT DROP;

CREATE FUNCTION pg_temp.fixture_publication_check() RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF inet_server_addr() IS DISTINCT FROM '127.0.0.1'::inet
    OR inet_server_port() IS DISTINCT FROM 54737
    OR current_database() !~ '^enamed_test_[a-z0-9_]+$'
    OR session_user <> 'postgres' OR current_user <> 'postgres'
    OR auth.uid() IS NOT NULL
    OR coalesce(current_setting('request.jwt.claim.sub',true),'') <> ''
    OR coalesce(current_setting('request.jwt.claim.role',true),'') <> ''
    OR coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb <> '{}'::jsonb
  THEN RAISE EXCEPTION 'fixture publication setup requires local postgres without JWT claims'
    USING ERRCODE='42501';
  END IF;
END $$;

CREATE FUNCTION pg_temp.fixture_publication_begin() RETURNS void
LANGUAGE plpgsql AS $$
DECLARE mode "char";
BEGIN
  PERFORM pg_temp.fixture_publication_check();
  IF EXISTS (SELECT FROM pg_temp.fixture_publication_state) THEN
    RAISE EXCEPTION 'fixture publication setup already active';
  END IF;
  LOCK TABLE public.simulados IN SHARE ROW EXCLUSIVE MODE;
  SELECT tgenabled INTO mode FROM pg_trigger
    WHERE tgrelid='public.simulados'::regclass AND tgname='trg_admin_publication' AND NOT tgisinternal;
  -- F0-only schemas legitimately predate this trigger.
  IF NOT FOUND THEN RETURN; END IF;
  IF mode NOT IN ('O','R','A') THEN RAISE EXCEPTION 'unexpected publication trigger state: %',mode; END IF;
  INSERT INTO pg_temp.fixture_publication_state(previous_mode) VALUES(mode);
  ALTER TABLE public.simulados DISABLE TRIGGER trg_admin_publication;
END $$;

CREATE FUNCTION pg_temp.fixture_publication_end() RETURNS void
LANGUAGE plpgsql AS $$
DECLARE mode "char"; actual "char";
BEGIN
  PERFORM pg_temp.fixture_publication_check();
  SELECT previous_mode INTO mode FROM pg_temp.fixture_publication_state;
  SELECT tgenabled INTO actual FROM pg_trigger
    WHERE tgrelid='public.simulados'::regclass AND tgname='trg_admin_publication' AND NOT tgisinternal;
  IF mode IS NULL AND actual IS NULL THEN RETURN; END IF;
  IF mode IS NULL OR actual IS DISTINCT FROM 'D'::"char" THEN
    RAISE EXCEPTION 'publication setup state changed unexpectedly';
  END IF;
  CASE mode
    WHEN 'O' THEN ALTER TABLE public.simulados ENABLE TRIGGER trg_admin_publication;
    WHEN 'R' THEN ALTER TABLE public.simulados ENABLE REPLICA TRIGGER trg_admin_publication;
    WHEN 'A' THEN ALTER TABLE public.simulados ENABLE ALWAYS TRIGGER trg_admin_publication;
    ELSE RAISE EXCEPTION 'invalid saved publication trigger state';
  END CASE;
  ASSERT (SELECT tgenabled=mode FROM pg_trigger WHERE tgrelid='public.simulados'::regclass
    AND tgname='trg_admin_publication'), 'publication guard must be restored before JWT actions';
  DELETE FROM pg_temp.fixture_publication_state;
END $$;

SELECT pg_temp.fixture_publication_check();
