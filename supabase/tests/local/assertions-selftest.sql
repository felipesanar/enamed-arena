BEGIN;
\ir assertions.sql
DO $$
DECLARE item text; rejected boolean;
BEGIN
  FOREACH item IN ARRAY ARRAY[
    $s$SELECT extensions.ok(false,'false must fail')$s$,
    $s$SELECT extensions.ok(NULL,'null must fail')$s$,
    $s$SELECT extensions.is(1,2,'different values must fail')$s$,
    $s$SELECT extensions.throws_ok('SELECT 1','P0001',NULL,'no exception must fail')$s$,
    $s$SELECT extensions.throws_ok('SELECT 1/0','42501',NULL,'wrong SQLSTATE must fail')$s$,
    $s$SELECT extensions.throws_ok('SELECT 1/0','22012','wrong message','message mismatch must fail')$s$,
    $s$SELECT extensions.lives_ok('SELECT 1/0','unexpected exception must fail')$s$
  ] LOOP
    rejected := false;
    BEGIN EXECUTE item; EXCEPTION WHEN OTHERS THEN rejected := true; END;
    IF NOT rejected THEN RAISE EXCEPTION 'Assertion helper fabricated a pass: %',item; END IF;
  END LOOP;
END $$;
SELECT extensions.ok(true,'positive assertion');
SELECT extensions.is(1,1,'equal values');
SELECT extensions.throws_ok('SELECT 1/0','22012',NULL,'expected SQLSTATE');
SELECT extensions.lives_ok('SELECT 1','valid statement');
CREATE TEMP TABLE caller_probe(id integer);
SET LOCAL ROLE authenticated;
SELECT extensions.throws_ok('SELECT * FROM caller_probe','42501',NULL,'dynamic SQL retains caller permissions');
RESET ROLE;
SELECT * FROM extensions.finish();
ROLLBACK;
