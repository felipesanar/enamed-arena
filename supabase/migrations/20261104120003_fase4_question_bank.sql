-- F4-2: additive observation layer. Live questions remain authoritative for F0.
BEGIN;
-- Fence content and result writers while installing triggers and observing legacy.
LOCK TABLE public.questions,public.question_options,public.attempt_question_results IN SHARE ROW EXCLUSIVE MODE;
CREATE SCHEMA IF NOT EXISTS question_bank_private;
REVOKE ALL ON SCHEMA question_bank_private FROM PUBLIC,anon,authenticated,service_role;

CREATE TABLE IF NOT EXISTS public.question_bank (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 original_question_id uuid NOT NULL UNIQUE,
 origin_bank_id uuid REFERENCES public.question_bank(id) ON DELETE RESTRICT,
 observed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS public.question_bank_versions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 bank_id uuid NOT NULL REFERENCES public.question_bank(id) ON DELETE RESTRICT,
 version_number integer NOT NULL CHECK(version_number>0),
 payload jsonb NOT NULL,
 content_hash text NOT NULL CHECK(content_hash ~ '^[0-9a-f]{64}$'),
 state text NOT NULL CHECK(state IN ('incomplete','published')),
 provenance text NOT NULL CHECK(provenance IN ('legacy_snapshot','observed')),
 editor_id uuid,
 observed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(bank_id,version_number), UNIQUE(bank_id,id)
);
-- IDs here are deliberately informational, NOT foreign keys to mutable legacy
-- rows. Deleting a question/simulado must neither block nor erase observations.
CREATE TABLE IF NOT EXISTS public.question_bank_usage (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 bank_id uuid NOT NULL REFERENCES public.question_bank(id) ON DELETE RESTRICT,
 version_id uuid NOT NULL,
 original_question_id uuid NOT NULL,
 original_simulado_id uuid NOT NULL,
 original_edition_id uuid NOT NULL,
 question_number integer NOT NULL,
 observed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 archived_at timestamptz,
 FOREIGN KEY(bank_id,version_id) REFERENCES public.question_bank_versions(bank_id,id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX IF NOT EXISTS question_bank_usage_active ON public.question_bank_usage(original_question_id) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS question_bank_usage_version ON public.question_bank_usage(version_id);
CREATE INDEX IF NOT EXISTS question_bank_versions_history ON public.question_bank_versions(bank_id,version_number DESC);

-- Only the reuse RPC can create this binding. No client-controlled GUC, trigger
-- disabling or text/hash inference is used to adopt a canonical identity.
CREATE TABLE IF NOT EXISTS question_bank_private.materializations (
 question_id uuid PRIMARY KEY,
 bank_id uuid NOT NULL,
 source_version_id uuid NOT NULL,
 initializing boolean NOT NULL DEFAULT true,
 observed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(bank_id,source_version_id) REFERENCES public.question_bank_versions(bank_id,id) ON DELETE RESTRICT
);
ALTER TABLE question_bank_private.materializations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON question_bank_private.materializations FROM PUBLIC,anon,authenticated,service_role;

-- Private attribution of the CURRENT AQR observation, not an assertion about
-- content seen during the attempt. Existing AQR has unknown version by design.
CREATE TABLE IF NOT EXISTS question_bank_private.result_observations (
 result_id uuid PRIMARY KEY,
 original_question_id uuid NOT NULL,
 bank_id uuid NOT NULL REFERENCES public.question_bank(id) ON DELETE RESTRICT,
 version_id uuid REFERENCES public.question_bank_versions(id) ON DELETE RESTRICT,
 provenance text NOT NULL CHECK(provenance IN ('legacy_unattributed','result_observed')),
 observed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.question_bank ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_bank_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_bank_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_bank_private.result_observations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.question_bank,public.question_bank_versions,public.question_bank_usage,
 question_bank_private.result_observations FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION question_bank_private.immutable_version()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN RAISE EXCEPTION 'Question bank versions are append-only' USING ERRCODE='23514'; END $$;
DROP TRIGGER IF EXISTS question_bank_version_immutable ON public.question_bank_versions;
CREATE TRIGGER question_bank_version_immutable BEFORE UPDATE OR DELETE ON public.question_bank_versions
 FOR EACH ROW EXECUTE FUNCTION question_bank_private.immutable_version();
DROP TRIGGER IF EXISTS question_bank_version_no_truncate ON public.question_bank_versions;
CREATE TRIGGER question_bank_version_no_truncate BEFORE TRUNCATE ON public.question_bank_versions
 FOR EACH STATEMENT EXECUTE FUNCTION question_bank_private.immutable_version();

CREATE OR REPLACE FUNCTION question_bank_private.snapshot_complete(body jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,public AS $$
DECLARE opts jsonb:=body->'options'; fmt jsonb:=body->'format'; expected integer;
BEGIN
 IF jsonb_typeof(opts) IS DISTINCT FROM 'array' THEN RETURN false; END IF;
 expected:=CASE WHEN jsonb_typeof(fmt->'options')='number' AND fmt->>'options' ~ '^[1-9][0-9]?$'
   THEN (fmt->>'options')::integer END;
 RETURN coalesce(expected BETWEEN 2 AND 26 AND jsonb_array_length(opts)=expected
   AND jsonb_typeof(body->'question'->'text')='string' AND btrim(body->'question'->>'text')<>''
   AND jsonb_typeof(body->'question'->'area')='string' AND btrim(body->'question'->>'area')<>''
   AND (SELECT count(*)=1 FROM jsonb_array_elements(opts) o WHERE o->>'is_correct'='true')
   AND NOT EXISTS(SELECT FROM jsonb_array_elements(opts) WITH ORDINALITY o(value,n)
     WHERE o.value->>'label' IS DISTINCT FROM chr(64+o.n::integer)
       OR jsonb_typeof(o.value->'text') IS DISTINCT FROM 'string' OR btrim(o.value->>'text')=''
       OR jsonb_typeof(o.value->'is_correct') IS DISTINCT FROM 'boolean'),false);
END $$;

CREATE OR REPLACE FUNCTION question_bank_private.capture(p_question_id uuid,p_legacy boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE
 q public.questions%ROWTYPE; b uuid; v public.question_bank_versions%ROWTYPE;
  opts jsonb; body jsonb; h text; fmt jsonb; complete boolean; next_number integer;
  sim uuid; edition uuid; active public.question_bank_usage%ROWTYPE;
  binding question_bank_private.materializations%ROWTYPE;
BEGIN
 SELECT * INTO binding FROM question_bank_private.materializations WHERE question_id=p_question_id;
 -- Private, transaction-local incomplete materialization; all F0/F1 integrity
 -- triggers still run. The RPC finishes with an exact source-payload check.
 IF binding.initializing THEN RETURN; END IF;
 -- Option writers lock this same row BEFORE mutation. Never wait after taking
 -- an option row: a competing statement may already own a different option.
 SELECT * INTO q FROM public.questions WHERE id=p_question_id FOR UPDATE NOWAIT;
 IF NOT FOUND THEN
   UPDATE public.question_bank_usage SET archived_at=clock_timestamp()
   WHERE original_question_id=p_question_id AND archived_at IS NULL;
   RETURN;
 END IF;
 SELECT s.id,s.edition_id,e.format INTO STRICT sim,edition,fmt
 FROM public.simulados s JOIN public.exam_editions e ON e.id=s.edition_id WHERE s.id=q.simulado_id;
  IF binding.bank_id IS NOT NULL THEN b:=binding.bank_id;
  ELSE
    INSERT INTO public.question_bank(original_question_id) VALUES(q.id) ON CONFLICT(original_question_id) DO NOTHING;
    SELECT id INTO STRICT b FROM public.question_bank WHERE original_question_id=q.id;
  END IF;
  -- Serialize numbering across copies; fail fast instead of waiting while
  -- owning a question/option lock needed by another writer of this identity.
  PERFORM 1 FROM public.question_bank WHERE id=b FOR UPDATE NOWAIT;
 SELECT coalesce(jsonb_agg(jsonb_build_object('label',o.label,'text',o.text,'is_correct',o.is_correct)
   ORDER BY o.label COLLATE "C",o.id),'[]'::jsonb) INTO opts FROM public.question_options o WHERE o.question_id=q.id;
 -- IDs/timestamps/placement are not semantic content; media and explanation ARE.
 body:=jsonb_build_object('question',to_jsonb(q)-ARRAY['id','simulado_id','question_number','created_at'],
   'options',opts,'format',fmt);
 h:=encode(sha256(convert_to(body::text,'UTF8')),'hex');
  complete:=question_bank_private.snapshot_complete(body);
  SELECT * INTO active FROM public.question_bank_usage WHERE original_question_id=q.id AND archived_at IS NULL;
  IF active.id IS NOT NULL THEN
    SELECT * INTO STRICT v FROM public.question_bank_versions WHERE id=active.version_id;
  ELSIF binding.source_version_id IS NOT NULL THEN
    SELECT * INTO STRICT v FROM public.question_bank_versions WHERE id=binding.source_version_id;
  ELSE
    SELECT * INTO v FROM public.question_bank_versions WHERE bank_id=b ORDER BY version_number DESC LIMIT 1;
  END IF;
  -- Compare this materialization's terminal observation, NOT another copy's
  -- newest version. A -> B -> A still appends; unrelated uses never move.
  IF v.id IS NULL OR v.content_hash IS DISTINCT FROM h THEN
    SELECT coalesce(max(version_number),0)+1 INTO next_number FROM public.question_bank_versions WHERE bank_id=b;
    INSERT INTO public.question_bank_versions(bank_id,version_number,payload,content_hash,state,provenance,editor_id)
    VALUES(b,next_number,body,h,CASE WHEN complete THEN 'published' ELSE 'incomplete' END,
    CASE WHEN p_legacy THEN 'legacy_snapshot' ELSE 'observed' END,CASE WHEN NOT p_legacy THEN auth.uid() END)
   RETURNING * INTO v;
 END IF;
 IF active.id IS NULL OR ROW(active.version_id,active.original_simulado_id,active.original_edition_id,active.question_number)
   IS DISTINCT FROM ROW(v.id,sim,edition,q.question_number) THEN
   UPDATE public.question_bank_usage SET archived_at=clock_timestamp() WHERE id=active.id;
   INSERT INTO public.question_bank_usage(bank_id,version_id,original_question_id,original_simulado_id,original_edition_id,question_number)
   VALUES(b,v.id,q.id,sim,edition,q.question_number);
 END IF;
END $$;

CREATE OR REPLACE FUNCTION question_bank_private.lock_option_question()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN
   RAISE EXCEPTION 'Question bank writes require READ COMMITTED' USING ERRCODE='25001';
 END IF;
 IF TG_OP='UPDATE' THEN
   PERFORM 1 FROM public.questions WHERE id IN(OLD.question_id,NEW.question_id) ORDER BY id FOR UPDATE NOWAIT;
 ELSE
   PERFORM 1 FROM public.questions WHERE id=CASE WHEN TG_OP='DELETE' THEN OLD.question_id ELSE NEW.question_id END FOR UPDATE NOWAIT;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS bank_00_option_lock ON public.question_options;
CREATE TRIGGER bank_00_option_lock BEFORE INSERT OR UPDATE OR DELETE ON public.question_options
 FOR EACH ROW EXECUTE FUNCTION question_bank_private.lock_option_question();

CREATE OR REPLACE FUNCTION question_bank_private.capture_statement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE ids uuid[]; qid uuid;
BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN
   RAISE EXCEPTION 'Question bank writes require READ COMMITTED' USING ERRCODE='25001';
 END IF;
 -- Separate transition tables per event; capture AFTER the entire statement.
 IF TG_TABLE_NAME='questions' THEN
   IF TG_OP='INSERT' THEN SELECT array_agg(id) INTO ids FROM new_rows;
   ELSIF TG_OP='DELETE' THEN SELECT array_agg(id) INTO ids FROM old_rows;
   ELSE SELECT array_agg(id) INTO ids FROM (SELECT id FROM new_rows UNION SELECT id FROM old_rows) x; END IF;
 ELSE
   IF TG_OP='INSERT' THEN SELECT array_agg(DISTINCT question_id) INTO ids FROM new_rows;
   ELSIF TG_OP='DELETE' THEN SELECT array_agg(DISTINCT question_id) INTO ids FROM old_rows;
   ELSE SELECT array_agg(question_id) INTO ids FROM (SELECT question_id FROM new_rows UNION SELECT question_id FROM old_rows) x; END IF;
 END IF;
 FOR qid IN SELECT DISTINCT x FROM unnest(ids) x ORDER BY x LOOP PERFORM question_bank_private.capture(qid); END LOOP;
 RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS bank_capture_insert ON public.questions;
CREATE TRIGGER bank_capture_insert AFTER INSERT ON public.questions REFERENCING NEW TABLE AS new_rows
 FOR EACH STATEMENT EXECUTE FUNCTION question_bank_private.capture_statement();
DROP TRIGGER IF EXISTS bank_capture_update ON public.questions;
CREATE TRIGGER bank_capture_update AFTER UPDATE ON public.questions REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows
 FOR EACH STATEMENT EXECUTE FUNCTION question_bank_private.capture_statement();
DROP TRIGGER IF EXISTS bank_capture_delete ON public.questions;
CREATE TRIGGER bank_capture_delete AFTER DELETE ON public.questions REFERENCING OLD TABLE AS old_rows
 FOR EACH STATEMENT EXECUTE FUNCTION question_bank_private.capture_statement();
DROP TRIGGER IF EXISTS bank_capture_insert ON public.question_options;
CREATE TRIGGER bank_capture_insert AFTER INSERT ON public.question_options REFERENCING NEW TABLE AS new_rows
 FOR EACH STATEMENT EXECUTE FUNCTION question_bank_private.capture_statement();
DROP TRIGGER IF EXISTS bank_capture_update ON public.question_options;
CREATE TRIGGER bank_capture_update AFTER UPDATE ON public.question_options REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows
 FOR EACH STATEMENT EXECUTE FUNCTION question_bank_private.capture_statement();
DROP TRIGGER IF EXISTS bank_capture_delete ON public.question_options;
CREATE TRIGGER bank_capture_delete AFTER DELETE ON public.question_options REFERENCING OLD TABLE AS old_rows
 FOR EACH STATEMENT EXECUTE FUNCTION question_bank_private.capture_statement();

CREATE OR REPLACE FUNCTION question_bank_private.observe_result()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF TG_OP='UPDATE' AND ROW(NEW.question_id,NEW.attempt_id,NEW.selected_option_id,NEW.correct_option_id,NEW.is_correct,NEW.was_answered)
   IS NOT DISTINCT FROM ROW(OLD.question_id,OLD.attempt_id,OLD.selected_option_id,OLD.correct_option_id,OLD.is_correct,OLD.was_answered) THEN RETURN NEW; END IF;
 INSERT INTO question_bank_private.result_observations(result_id,original_question_id,bank_id,version_id,provenance)
 SELECT NEW.id,NEW.question_id,u.bank_id,u.version_id,'result_observed'
 FROM public.question_bank_usage u WHERE u.original_question_id=NEW.question_id AND u.archived_at IS NULL
 ON CONFLICT(result_id) DO UPDATE SET original_question_id=EXCLUDED.original_question_id,bank_id=EXCLUDED.bank_id,
 version_id=EXCLUDED.version_id,provenance=EXCLUDED.provenance,observed_at=clock_timestamp();
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS bank_result_observation ON public.attempt_question_results;
CREATE TRIGGER bank_result_observation AFTER INSERT OR UPDATE ON public.attempt_question_results
 FOR EACH ROW EXECUTE FUNCTION question_bank_private.observe_result();

-- Reapply only observes identities never seen before; never relabels an edited
-- current version as legacy or assigns authorship from the installer's JWT.
DO $$ DECLARE qid uuid; BEGIN
 FOR qid IN SELECT q.id FROM public.questions q WHERE NOT EXISTS(
    SELECT FROM public.question_bank b WHERE b.original_question_id=q.id)
   AND NOT EXISTS(SELECT FROM question_bank_private.materializations m WHERE m.question_id=q.id) ORDER BY q.id
 LOOP PERFORM question_bank_private.capture(qid,true); END LOOP;
END $$;
INSERT INTO question_bank_private.result_observations(result_id,original_question_id,bank_id,provenance)
 SELECT r.id,r.question_id,b.id,'legacy_unattributed' FROM public.attempt_question_results r
 JOIN public.question_bank b ON b.original_question_id=r.question_id ON CONFLICT(result_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.admin_list_question_bank_versions(p_bank_id uuid,p_limit integer DEFAULT 50,p_offset integer DEFAULT 0)
RETURNS SETOF public.question_bank_versions LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 PERFORM public.admin_require('content.manage');
 IF p_bank_id IS NULL OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 200 OR p_offset IS NULL OR p_offset NOT BETWEEN 0 AND 1000000 THEN
   RAISE EXCEPTION 'bank_id, limit 1..200 and offset 0..1000000 required' USING ERRCODE='22023'; END IF;
 RETURN QUERY SELECT v.* FROM public.question_bank_versions v WHERE v.bank_id=p_bank_id ORDER BY v.version_number DESC LIMIT p_limit OFFSET p_offset;
END $$;

CREATE OR REPLACE FUNCTION public.admin_list_question_bank(p_search text DEFAULT NULL,p_limit integer DEFAULT 50,p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 PERFORM public.admin_require('content.manage');
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 200 OR p_offset IS NULL OR p_offset NOT BETWEEN 0 AND 1000000
   OR length(p_search)>500 THEN RAISE EXCEPTION 'limit 1..200, offset 0..1000000, search up to 500 characters required' USING ERRCODE='22023'; END IF;
 WITH identities AS (
  SELECT b.id AS bank_id,b.original_question_id,b.origin_bank_id,b.observed_at AS identity_observed_at,
   left(translate(regexp_replace(regexp_replace(v.payload->'question'->>'text','<[^>]*>','','g'),
     '[[:cntrl:]]',' ','g'),'<>',''),180) AS title,
   v.id AS latest_version_id,v.version_number AS latest_version_number,v.state AS latest_state,v.observed_at,
   (SELECT count(*) FROM public.question_bank_usage u WHERE u.bank_id=b.id AND u.archived_at IS NULL) AS usage_count
  FROM public.question_bank b JOIN LATERAL (
   SELECT * FROM public.question_bank_versions v0 WHERE v0.bank_id=b.id ORDER BY version_number DESC LIMIT 1
  ) v ON true
  WHERE p_search IS NULL OR p_search='' OR strpos(lower(v.payload->'question'->>'text'),lower(p_search))>0
 ), page AS (SELECT * FROM identities ORDER BY observed_at DESC,bank_id LIMIT p_limit OFFSET p_offset)
 SELECT jsonb_build_object('items',coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.observed_at DESC,p.bank_id) FROM page p),'[]'::jsonb),
  'total',(SELECT count(*) FROM identities),'limit',p_limit,'offset',p_offset) INTO result;
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.admin_add_bank_version_to_simulado(p_version_id uuid,p_simulado_id uuid,p_question_number integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE
 sim public.simulados%ROWTYPE; edition public.exam_editions%ROWTYPE;
 v public.question_bank_versions%ROWTYPE; q public.questions%ROWTYPE;
 qid uuid:=gen_random_uuid(); max_questions integer; result jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 PERFORM public.admin_require('content.manage');
 IF p_version_id IS NULL OR p_simulado_id IS NULL OR p_question_number IS NULL OR p_question_number<1 THEN
  RAISE EXCEPTION 'Version, simulado and positive question number required' USING ERRCODE='22023'; END IF;
 IF current_setting('transaction_isolation')<>'read committed' THEN
  RAISE EXCEPTION 'Question bank writes require READ COMMITTED' USING ERRCODE='25001'; END IF;
 -- Parent first, before any new question/option locks (F0/F1/F2 contract).
 SELECT * INTO sim FROM public.simulados WHERE id=p_simulado_id FOR UPDATE NOWAIT;
 IF NOT FOUND OR sim.status IS DISTINCT FROM 'draft' OR EXISTS(SELECT FROM public.attempts WHERE simulado_id=sim.id) THEN
  RAISE EXCEPTION 'Destination must be a draft without attempts' USING ERRCODE='22023'; END IF;
 SELECT * INTO STRICT edition FROM public.exam_editions WHERE id=sim.edition_id FOR SHARE NOWAIT;
 SELECT * INTO v FROM public.question_bank_versions WHERE id=p_version_id;
 IF NOT FOUND OR v.state<>'published' OR NOT question_bank_private.snapshot_complete(v.payload) THEN
  RAISE EXCEPTION 'Complete source version required' USING ERRCODE='22023'; END IF;
 IF edition.format IS DISTINCT FROM v.payload->'format' OR edition.blueprint_id IS NULL
  OR jsonb_typeof(edition.format->'questions') IS DISTINCT FROM 'number'
  OR edition.format->>'questions' !~ '^[1-9][0-9]{0,8}$' THEN
  RAISE EXCEPTION 'Incompatible edition format or missing blueprint' USING ERRCODE='22023'; END IF;
 max_questions:=(edition.format->>'questions')::integer;
 IF p_question_number>max_questions THEN RAISE EXCEPTION 'Question number outside edition format' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT FROM public.questions WHERE simulado_id=sim.id AND question_number=p_question_number) THEN
  RAISE EXCEPTION 'Question number already used' USING ERRCODE='23505'; END IF;
 SELECT * INTO q FROM jsonb_populate_record(NULL::public.questions,v.payload->'question');
 PERFORM 1 FROM public.exam_blueprints WHERE id=edition.blueprint_id FOR SHARE NOWAIT;
 PERFORM 1 FROM public.exam_areas WHERE id=q.area_id AND blueprint_id=edition.blueprint_id
  AND EXISTS(SELECT FROM unnest(aliases||ARRAY[code,label]) alias
   WHERE public.normalize_exam_area(alias)=public.normalize_exam_area(q.area)) FOR SHARE NOWAIT;
 IF NOT FOUND THEN RAISE EXCEPTION 'Source area must resolve explicitly in destination blueprint' USING ERRCODE='22023'; END IF;
 INSERT INTO question_bank_private.materializations(question_id,bank_id,source_version_id)
 VALUES(qid,v.bank_id,v.id);
 INSERT INTO public.questions(id,simulado_id,question_number,text,area,area_id,theme,difficulty,
  image_url,image_url_2,explanation,explanation_image_url)
 VALUES(qid,sim.id,p_question_number,q.text,q.area,q.area_id,q.theme,q.difficulty,
  q.image_url,q.image_url_2,q.explanation,q.explanation_image_url);
 INSERT INTO public.question_options(question_id,label,text,is_correct)
 SELECT qid,o->>'label',o->>'text',(o->>'is_correct')::boolean FROM jsonb_array_elements(v.payload->'options') o;
 UPDATE question_bank_private.materializations SET initializing=false WHERE question_id=qid;
 PERFORM question_bank_private.capture(qid);
 -- A trigger or schema default must not silently turn reuse into another
 -- version. Failure rolls back all rows, without deleting any version history.
 SELECT jsonb_build_object('question_id',qid,'bank_id',u.bank_id,'version_id',u.version_id,'usage_id',u.id,
  'simulado_id',sim.id,'edition_id',edition.id,'question_number',p_question_number) INTO result
 FROM public.question_bank_usage u WHERE u.original_question_id=qid AND u.archived_at IS NULL AND u.version_id=v.id;
 IF result IS NULL THEN RAISE EXCEPTION 'Materialized payload differs from source version' USING ERRCODE='23514'; END IF;
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.admin_get_question_item_analysis(p_bank_id uuid DEFAULT NULL,p_edition_id uuid DEFAULT NULL)
RETURNS TABLE(bank_id uuid,version_id uuid,edition_id uuid,is_training boolean,provenance text,
 n_responses bigint,n_answered bigint,n_correct bigint,difficulty_observed numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 PERFORM public.admin_require('intel.view');
 RETURN QUERY SELECT o.bank_id,o.version_id,a.edition_id,NOT coalesce(a.is_within_window,false),o.provenance,
 count(*),count(*) FILTER(WHERE r.was_answered),count(*) FILTER(WHERE r.is_correct AND r.was_answered),
 count(*) FILTER(WHERE r.is_correct AND r.was_answered)::numeric/nullif(count(*),0)
 FROM question_bank_private.result_observations o JOIN public.attempt_question_results r ON r.id=o.result_id
 JOIN public.attempts a ON a.id=r.attempt_id JOIN public.simulados s ON s.id=a.simulado_id
 WHERE a.status IN ('submitted','expired') AND a.finished_at IS NOT NULL AND a.score_percentage IS NOT NULL
 AND s.results_release_at IS NOT NULL AND s.results_release_at<=now()
 AND (p_bank_id IS NULL OR o.bank_id=p_bank_id) AND (p_edition_id IS NULL OR a.edition_id=p_edition_id)
 GROUP BY o.bank_id,o.version_id,a.edition_id,NOT coalesce(a.is_within_window,false),o.provenance
 ORDER BY o.bank_id,o.version_id,a.edition_id,NOT coalesce(a.is_within_window,false),o.provenance;
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA question_bank_private FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.admin_list_question_bank_versions(uuid,integer,integer),
 public.admin_get_question_item_analysis(uuid,uuid),public.admin_list_question_bank(text,integer,integer),
 public.admin_add_bank_version_to_simulado(uuid,uuid,integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.admin_list_question_bank_versions(uuid,integer,integer),
 public.admin_get_question_item_analysis(uuid,uuid),public.admin_list_question_bank(text,integer,integer),
 public.admin_add_bank_version_to_simulado(uuid,uuid,integer) TO authenticated;
COMMIT;

-- Non-destructive rollback (operator-reviewed maintenance transaction): disable
-- bank_00_option_lock, bank_capture_{insert,update,delete} on their live tables
-- and bank_result_observation on AQR; revoke the two public RPC EXECUTE grants.
-- KEEP identities, versions, usage and private attribution. Never DROP/CASCADE
-- history or rewrite questions/answers/AQR/scores. Re-enabling after a gap needs
-- explicit reconciliation with observed provenance, NOT a fabricated backfill.
