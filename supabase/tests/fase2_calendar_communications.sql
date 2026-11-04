-- Local disposable clone of enamed_test_integrated_20261104_0920 only.
\set ON_ERROR_STOP on
-- Optional concurrent harness: setup, then launch two psql processes with
-- -v worker=1; both assert exactly one disjoint claim while holding its lock.
\if :{?concurrency_setup}
DO $$ BEGIN
 ASSERT current_database() LIKE 'enamed_test_comms_%' AND inet_server_addr()='127.0.0.1'::inet;
END $$;
UPDATE public.communication_config SET enabled=true WHERE job='ops';
INSERT INTO public.communication_queue(channel,event_key,event_name,due_at)
 VALUES('ops','concurrency-one','ops_incident',now()),('ops','concurrency-two','ops_incident',now());
\quit
\endif
\if :{?worker}
BEGIN;
SET LOCAL statement_timeout='8s';
DO $$ BEGIN
 ASSERT current_database() LIKE 'enamed_test_comms_%' AND inet_server_addr()='127.0.0.1'::inet;
END $$;
CREATE TEMP TABLE claimed AS SELECT * FROM public.claim_communications('ops',1);
DO $$ BEGIN ASSERT (SELECT count(*)=1 FROM claimed), 'worker must get exactly one unique claim'; END $$;
SELECT pg_sleep(2);
SELECT id FROM claimed;
COMMIT;
\quit
\endif
BEGIN;
DO $$ BEGIN
  ASSERT current_database() LIKE 'enamed_test_comms_%', 'disposable comms database required';
  ASSERT inet_server_addr() = '127.0.0.1'::inet, 'local PostgreSQL required';
  ASSERT to_regclass('public.communication_config') IS NOT NULL, 'calendar migration missing';
  ASSERT NOT has_table_privilege('authenticated','public.communication_queue','SELECT');
  ASSERT NOT has_function_privilege('authenticated','public.claim_communications(text,integer)','EXECUTE');
  ASSERT NOT has_function_privilege('anon','public.ops_health_snapshot()','EXECUTE');
  ASSERT NOT has_function_privilege('authenticated','public.invoke_communication_job(text)','EXECUTE');
  ASSERT NOT has_function_privilege('service_role','public.notify_hubspot_new_user()','EXECUTE');
END $$;
-- Fixtures are not publishable exams. Disable only the content gate locally;
-- transaction rollback restores it and no production database is accepted above.
ALTER TABLE public.simulados DISABLE TRIGGER trg_admin_publication;

INSERT INTO auth.users(id,email) VALUES
 ('c6000000-0000-0000-0000-000000000001','comms-one@example.invalid'),
 ('c6000000-0000-0000-0000-000000000002','comms-two@example.invalid'),
 ('c6000000-0000-0000-0000-000000000003','comms-undecided@example.invalid'),
 ('c6000000-0000-0000-0000-000000000004','comms-internal@sanar.com.br');
UPDATE auth.users SET email_confirmed_at=now() WHERE id::text LIKE 'c6000000%';
INSERT INTO public.user_roles(user_id,role) VALUES ('c6000000-0000-0000-0000-000000000001','admin');
SELECT set_config('request.jwt.claims','{"sub":"c6000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
SELECT set_config('request.jwt.claim.sub','c6000000-0000-0000-0000-000000000001',true);
INSERT INTO public.exam_editions(id,code,year,term,label,status) VALUES
 ('c6000000-0000-0000-0000-000000000011','2196.1',2196,1,'Calendar A','active'),
 ('c6000000-0000-0000-0000-000000000012','2196.2',2196,2,'Calendar B','preparing');
INSERT INTO public.onboarding_profiles(user_id,target_edition_id) VALUES
 ('c6000000-0000-0000-0000-000000000001','c6000000-0000-0000-0000-000000000011'),
 ('c6000000-0000-0000-0000-000000000002','c6000000-0000-0000-0000-000000000012'),
 ('c6000000-0000-0000-0000-000000000004','c6000000-0000-0000-0000-000000000011');
INSERT INTO public.notification_preferences(user_id,calendar_notifications)
 SELECT id,true FROM public.profiles WHERE id::text LIKE 'c6000000%';
INSERT INTO public.simulados(id,title,slug,sequence_number,edition_id,execution_window_start,execution_window_end,results_release_at,status) VALUES
 ('c6000000-0000-0000-0000-000000000021','Calendar A','comms-a',9601,'c6000000-0000-0000-0000-000000000011',now()-interval '1 minute',now()+interval '2 days',now()+interval '3 days','published'),
 ('c6000000-0000-0000-0000-000000000022','Calendar B','comms-b',9602,'c6000000-0000-0000-0000-000000000012',now()-interval '2 days',now()+interval '23 hours 59 minutes',now()+interval '2 days','published'),
 ('c6000000-0000-0000-0000-000000000023','Obsolete','comms-old',9603,'c6000000-0000-0000-0000-000000000011',now()-interval '365 days',now()-interval '364 days',now()-interval '363 days','published');
DO $$ DECLARE a record; b record; n integer; BEGIN
 ASSERT NOT (SELECT enabled FROM public.communication_config WHERE job='calendar');
 PERFORM public.prepare_calendar_communications(100);
 ASSERT NOT EXISTS(SELECT 1 FROM public.communication_queue), 'disabled must not queue';
 UPDATE public.communication_config SET enabled=true,watermark=now()-interval '365 days' WHERE job='calendar';
 PERFORM public.prepare_calendar_communications(100);
 ASSERT (SELECT count(*)=2 FROM public.communication_queue WHERE channel='calendar'), 'edition audience, internal suppression and bounded retrospective';
 ASSERT NOT EXISTS(SELECT 1 FROM public.communication_queue WHERE simulado_id='c6000000-0000-0000-0000-000000000023');
 SELECT * INTO a FROM public.claim_communications('calendar',1);
 SELECT * INTO b FROM public.claim_communications('calendar',1);
 ASSERT a.id IS NOT NULL AND b.id IS NOT NULL AND a.id<>b.id, 'two claims must be disjoint';
 PERFORM public.start_communication(a.id,a.lease_token);
  PERFORM public.complete_communication(a.id,a.lease_token,'uncertain');
  PERFORM public.start_communication(b.id,b.lease_token);
 PERFORM public.complete_communication(b.id,b.lease_token,'sent');
 ASSERT NOT EXISTS(SELECT 1 FROM public.claim_communications('calendar',100)), 'lost ack never automatically retried';
 BEGIN
   PERFORM public.complete_communication(b.id,b.lease_token,'sent');
   RAISE EXCEPTION 'stale lease accepted';
 EXCEPTION WHEN serialization_failure THEN NULL; END;
 UPDATE public.simulados SET execution_window_start=now()-interval '30 seconds' WHERE id='c6000000-0000-0000-0000-000000000021';
 UPDATE public.communication_config SET watermark=now()-interval '1 minute' WHERE job='calendar';
 PERFORM public.prepare_calendar_communications(100);
 ASSERT NOT EXISTS(SELECT 1 FROM public.claim_communications('calendar',100)), 'revision must not resend sent or uncertain semantic event';
 ASSERT (public.ops_health_snapshot()->>'cron_dependency')='not_installed', 'missing cron reported';
 ASSERT (public.ops_health_snapshot()->>'pending_over_10m')::integer>=0;
END $$;

-- Attempt-owned edition fallback is explicit, not resolved app fallback. A
-- missing preference row and an unverified address still exclude that user.
INSERT INTO public.attempts(id,simulado_id,user_id,status,attempt_type,started_at,effective_deadline)
 VALUES('c6000000-0000-0000-0000-000000000031','c6000000-0000-0000-0000-000000000021','c6000000-0000-0000-0000-000000000003','in_progress','online',now(),now()+interval '1 hour');
INSERT INTO public.attempt_processing_queue(attempt_id,user_id,status,created_at)
 VALUES('c6000000-0000-0000-0000-000000000031','c6000000-0000-0000-0000-000000000003','pending',now()-interval '11 minutes');
DO $$ BEGIN
 ASSERT public.communication_eligible('c6000000-0000-0000-0000-000000000003','c6000000-0000-0000-0000-000000000011');
 ASSERT (public.ops_health_snapshot()->>'pending_over_10m')::integer>=1;
 DELETE FROM public.notification_preferences WHERE user_id='c6000000-0000-0000-0000-000000000003';
 ASSERT NOT public.communication_eligible('c6000000-0000-0000-0000-000000000003','c6000000-0000-0000-0000-000000000011');
END $$;

INSERT INTO public.simulados(id,title,slug,sequence_number,edition_id,execution_window_start,execution_window_end,results_release_at,status)
 VALUES('c6000000-0000-0000-0000-000000000024','Release fixture','comms-release',9604,'c6000000-0000-0000-0000-000000000011',now()-interval '2 days',now()-interval '1 day',now()-interval '15 seconds','published');
DO $$ BEGIN
 UPDATE public.communication_config SET watermark=now()-interval '1 minute' WHERE job='calendar';
 PERFORM public.prepare_calendar_communications(1);
 PERFORM public.prepare_calendar_communications(1);
 PERFORM public.prepare_calendar_communications(100);
 ASSERT EXISTS(SELECT 1 FROM public.communication_queue WHERE simulado_id='c6000000-0000-0000-0000-000000000024' AND event_name='results_released');
 UPDATE public.exam_editions SET status='closed' WHERE id='c6000000-0000-0000-0000-000000000012';
 UPDATE public.simulados SET execution_window_end=now()-interval '10 seconds',results_release_at=now()-interval '5 seconds' WHERE id='c6000000-0000-0000-0000-000000000022';
 UPDATE public.communication_config SET watermark=now()-interval '1 minute' WHERE job='calendar';
 PERFORM public.prepare_calendar_communications(100);
 ASSERT NOT EXISTS(SELECT 1 FROM public.communication_events WHERE simulado_id='c6000000-0000-0000-0000-000000000022' AND event_name='results_released'), 'closed editions never rediscovered';
 UPDATE public.exam_editions SET status='preparing' WHERE id='c6000000-0000-0000-0000-000000000012';
 UPDATE public.simulados SET execution_window_end=now()+interval '23 hours 59 minutes',results_release_at=now()+interval '2 days' WHERE id='c6000000-0000-0000-0000-000000000022';
END $$;

-- Revalidate immediately before HTTP, not only at audience expansion/claim.
DO $$ DECLARE a record; BEGIN
 UPDATE public.communication_queue SET status='skipped' WHERE channel='calendar';
 INSERT INTO public.communication_queue(channel,event_key,event_name,simulado_id,user_id,revision,due_at)
 SELECT 'calendar','revalidation-fixture','last24h',s.id,'c6000000-0000-0000-0000-000000000002',
 md5(jsonb_build_array(s.edition_id,s.execution_window_start,s.execution_window_end,s.results_release_at)::text),now()
 FROM public.simulados s WHERE id='c6000000-0000-0000-0000-000000000022';
 SELECT * INTO a FROM public.claim_communications('calendar',1);
 ASSERT a.id IS NOT NULL;
 UPDATE public.notification_preferences SET calendar_notifications=false WHERE user_id=a.recipient_id;
 BEGIN
  PERFORM public.start_communication(a.id,a.lease_token);
  RAISE EXCEPTION 'opt-out after claim allowed send';
 EXCEPTION WHEN serialization_failure THEN NULL; END;
 UPDATE public.communication_queue SET status='skipped',lease_token=NULL,lease_until=NULL WHERE id=a.id;
 ASSERT NOT public.communication_eligible('c6000000-0000-0000-0000-000000000003','c6000000-0000-0000-0000-000000000011'), 'undecided is not a mailing list';
 INSERT INTO public.communication_suppressions(user_id,unsubscribed) VALUES('c6000000-0000-0000-0000-000000000001',true);
 ASSERT NOT public.communication_eligible('c6000000-0000-0000-0000-000000000001','c6000000-0000-0000-0000-000000000011');
 DELETE FROM public.communication_suppressions;
 UPDATE auth.users SET email_confirmed_at=NULL WHERE id='c6000000-0000-0000-0000-000000000001';
 ASSERT NOT public.communication_eligible('c6000000-0000-0000-0000-000000000001','c6000000-0000-0000-0000-000000000011');
END $$;

DO $$ DECLARE n integer; a record; BEGIN
 UPDATE public.communication_config SET enabled=true WHERE job='ops';
 PERFORM public.prepare_ops_communications();
 SELECT count(*) INTO n FROM public.communication_queue WHERE channel='ops';
 ASSERT n>=1, 'missing cron and uncertain delivery must be incidents';
 PERFORM public.prepare_ops_communications();
 ASSERT (SELECT count(*) FROM public.communication_queue WHERE channel='ops')=n, 'sustained incident is deduped';
 INSERT INTO public.communication_queue(channel,event_key,event_name,due_at) VALUES('ops','lease-fixture','ops_incident',now()-interval '1 day');
 SELECT * INTO a FROM public.claim_communications('ops',1);
 PERFORM public.start_communication(a.id,a.lease_token);
 UPDATE public.communication_queue SET lease_until=now()-interval '1 second' WHERE id=a.id;
 PERFORM public.claim_communications('ops',1);
 ASSERT (SELECT status='uncertain' FROM public.communication_queue WHERE id=a.id), 'expired sending lease becomes uncertain, not retry';
 BEGIN
  PERFORM public.complete_communication(a.id,a.lease_token,'sent');
  RAISE EXCEPTION 'expired lease completed';
 EXCEPTION WHEN serialization_failure THEN NULL; END;
END $$;

-- pg_cron catalog double: never installs/enables an extension or executes a job.
CREATE TABLE cron.job_run_details(jobid bigint,status text,end_time timestamptz);
INSERT INTO cron.job(jobid,jobname,schedule,command) OVERRIDING SYSTEM VALUE VALUES(96001,'fixture-processing','* * * * *','fixture only');
INSERT INTO cron.job_run_details VALUES(96001,'failed',now());
DO $$ DECLARE h jsonb; BEGIN
 h:=public.ops_health_snapshot();
 ASSERT h->>'cron_dependency'='installed' AND (h->>'cron_failures_5m')::integer=1;
 ASSERT h->'job_names' ? 'fixture-processing';
 PERFORM public.prepare_ops_communications();
 ASSERT EXISTS(SELECT 1 FROM public.communication_queue WHERE event_key='ops:cron_failed:1');
 UPDATE cron.job_run_details SET end_time=now()-interval '1 hour';
 PERFORM public.prepare_ops_communications();
 ASSERT NOT EXISTS(SELECT 1 FROM public.communication_queue WHERE event_key='ops:cron_failed:2'), 'recovery rate limited within 5 minutes';
 UPDATE public.communication_incidents SET changed_at=now()-interval '6 minutes';
 PERFORM public.prepare_ops_communications();
 ASSERT EXISTS(SELECT 1 FROM public.communication_queue WHERE event_key='ops:cron_failed:2' AND event_name='ops_recovery');
 ALTER TABLE public.attempt_processing_queue RENAME TO comms_unavailable_queue;
 BEGIN
  PERFORM public.ops_health_snapshot();
  RAISE EXCEPTION 'broken queue masked as healthy';
 EXCEPTION WHEN undefined_table THEN NULL; END;
 ALTER TABLE public.comms_unavailable_queue RENAME TO attempt_processing_queue;
END $$;

-- Local HTTP/Vault doubles only. No secrets are read from any real Vault.
CREATE TEMP TABLE comms_http_calls(body jsonb);
CREATE OR REPLACE FUNCTION net.http_post(url text,body jsonb DEFAULT '{}',params jsonb DEFAULT '{}',headers jsonb DEFAULT '{}',timeout_milliseconds integer DEFAULT 1000)
RETURNS bigint LANGUAGE plpgsql AS $$ BEGIN
 IF current_setting('test.comms_http_fail',true)='true' THEN RAISE EXCEPTION 'fixture sensitive error'; END IF;
 INSERT INTO pg_temp.comms_http_calls VALUES(body); RETURN 1;
END $$;
INSERT INTO vault.decrypted_secrets(name,decrypted_secret) VALUES('HUBSPOT_SYNC_SECRET','local-fixture-only');
DO $$ DECLARE n integer; BEGIN
 UPDATE public.profiles SET full_name='Changed canonical name' WHERE id='c6000000-0000-0000-0000-000000000001';
 ASSERT (SELECT count(*)=1 FROM pg_temp.comms_http_calls), 'changed profile queues one sync';
 UPDATE public.profiles SET full_name=full_name,segment=segment,email=email WHERE id='c6000000-0000-0000-0000-000000000001';
 ASSERT (SELECT count(*)=1 FROM pg_temp.comms_http_calls), 'noop update queues nothing';
 UPDATE public.onboarding_profiles SET target_edition_id=NULL WHERE user_id='c6000000-0000-0000-0000-000000000001';
 ASSERT (SELECT count(*)=2 FROM pg_temp.comms_http_calls), 'NULL target transition queued';
 ASSERT (SELECT bool_and(body=jsonb_build_object('user_id','c6000000-0000-0000-0000-000000000001'::uuid)) FROM pg_temp.comms_http_calls), 'identity-only allowlist';
 UPDATE public.onboarding_profiles SET target_edition_id=NULL WHERE user_id='c6000000-0000-0000-0000-000000000001';
 ASSERT (SELECT count(*)=2 FROM pg_temp.comms_http_calls), 'noop NULL target queues nothing';
 PERFORM set_config('test.comms_http_fail','true',true);
 UPDATE public.profiles SET full_name='Network failure preserves update' WHERE id='c6000000-0000-0000-0000-000000000001';
 ASSERT (SELECT full_name='Network failure preserves update' FROM public.profiles WHERE id='c6000000-0000-0000-0000-000000000001');
END $$;
DO $$ BEGIN
 PERFORM set_config('test.comms_http_fail','false',true);
 BEGIN PERFORM public.invoke_communication_job('ops-health-alerts'); RAISE EXCEPTION 'missing Vault relay secret accepted';
 EXCEPTION WHEN object_not_in_prerequisite_state THEN NULL; END;
 BEGIN PERFORM public.invoke_communication_job('https://attacker.invalid'); RAISE EXCEPTION 'arbitrary relay accepted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 INSERT INTO vault.decrypted_secrets VALUES('NOVU_RELAY_SECRET','local-relay-fixture');
 ASSERT public.invoke_communication_job('ops-health-alerts')=1;
 ASSERT (SELECT count(*)=3 FROM pg_temp.comms_http_calls);
 INSERT INTO vault.decrypted_secrets VALUES('HUBSPOT_SYNC_SECRET','duplicate-fixture');
 UPDATE public.profiles SET full_name='Duplicate secret preserves update' WHERE id='c6000000-0000-0000-0000-000000000001';
 ASSERT (SELECT count(*)=3 FROM pg_temp.comms_http_calls), 'duplicate secret fails closed';
END $$;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN PERFORM public.claim_communications('calendar',1); RAISE EXCEPTION 'student claimed PII';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.ops_health_snapshot(); RAISE EXCEPTION 'student read health';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
ROLLBACK;
