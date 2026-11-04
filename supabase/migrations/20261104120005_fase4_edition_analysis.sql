-- F3-3 / F4-3 / F4-5. Requires F1 references and F2 archived ranking guards.
-- No official best-N policy is seeded. No operational results are written.
-- One statement is atomic and also composes with an outer test transaction.
DO $edition_analysis_migration$
BEGIN
EXECUTE $edition_analysis_ddl$

CREATE TABLE IF NOT EXISTS public.exam_edition_ranking_policies (
 edition_id uuid PRIMARY KEY REFERENCES public.exam_editions(id) ON DELETE RESTRICT,
 best_n integer NOT NULL CHECK (best_n>0),
 minimum_simulados integer NOT NULL CHECK (minimum_simulados>0 AND minimum_simulados<=best_n),
 enabled boolean NOT NULL DEFAULT false,
 updated_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.exam_edition_ranking_policies ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.exam_edition_ranking_policies FROM PUBLIC,anon,authenticated,service_role;
-- RPC-only configuration: no permissive client RLS policy or direct grants.

CREATE OR REPLACE FUNCTION public.get_my_percentile_history(p_edition_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 IF p_edition_id IS NOT NULL AND NOT EXISTS(SELECT FROM public.exam_editions WHERE id=p_edition_id) THEN
  RAISE EXCEPTION 'Unknown edition' USING ERRCODE='22023';
 END IF;
 -- Delegate population, best attempt and ties to the guarded canonical ranking.
 -- Filter the edition before invoking it; never expose its other participants.
 SELECT coalesce(jsonb_agg(jsonb_build_object(
  'simulado_id',s.id,'edition_id',e.id,'code',e.code,'label',e.label,
  'sequence',s.sequence_number,'date',s.results_release_at,
  'position',r.posicao,'population',r.total_candidatos,
  'top_percentile',least(99,greatest(1,ceil(r.posicao::numeric/r.total_candidatos*100))),
  'metadata',jsonb_build_object('small_sample',r.total_candidatos<30))
  ORDER BY s.results_release_at,s.id),'[]'::jsonb) INTO result
 FROM public.simulados s JOIN public.exam_editions e ON e.id=s.edition_id
 CROSS JOIN LATERAL public.get_ranking_for_simulado(s.id) r
 WHERE (p_edition_id IS NULL OR s.edition_id=p_edition_id)
  AND s.status IN ('published','archived') AND s.execution_window_start<=now() AND s.results_release_at<=now()
  AND r.user_id=auth.uid() AND r.finished_at IS NOT NULL;
 RETURN jsonb_build_object('items',result,'metadata',jsonb_build_object(
  'metric','top_percentile','small_sample_threshold',30,
  'warning','Relative position in each participant population; small samples are unstable. Not proficiency or psychometric comparability.',
  'psychometric_comparable',false));
END $$;

CREATE OR REPLACE FUNCTION public.admin_configure_edition_ranking(
 p_edition_id uuid,p_best_n integer,p_minimum_simulados integer,p_enabled boolean,p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE previous jsonb; configured jsonb; offered bigint;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 PERFORM public.admin_require('content.manage');
 PERFORM public.admin_require('intel.view');
 IF p_best_n IS NULL OR p_best_n<=0 OR p_minimum_simulados IS NULL OR p_minimum_simulados<=0
  OR p_minimum_simulados>p_best_n OR p_enabled IS NULL OR nullif(btrim(p_reason),'') IS NULL THEN
  RAISE EXCEPTION 'Positive N, minimum <= N, enabled and reason required' USING ERRCODE='22023';
 END IF;
 -- Edition lock serializes first insert as well as subsequent policy changes.
 PERFORM 1 FROM public.exam_editions WHERE id=p_edition_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Unknown edition' USING ERRCODE='22023'; END IF;
 SELECT count(*) INTO offered FROM public.simulados WHERE edition_id=p_edition_id
  AND status IN ('published','archived') AND execution_window_start<=now() AND results_release_at<=now();
 IF p_enabled AND offered<p_minimum_simulados THEN
  RAISE EXCEPTION 'Not enough released simulados to enable this minimum' USING ERRCODE='22023';
 END IF;
 SELECT to_jsonb(p) INTO previous FROM public.exam_edition_ranking_policies p WHERE edition_id=p_edition_id;
 INSERT INTO public.exam_edition_ranking_policies(edition_id,best_n,minimum_simulados,enabled,updated_by,updated_at)
 VALUES(p_edition_id,p_best_n,p_minimum_simulados,p_enabled,auth.uid(),clock_timestamp())
 ON CONFLICT(edition_id) DO UPDATE SET best_n=excluded.best_n,minimum_simulados=excluded.minimum_simulados,
  enabled=excluded.enabled,updated_by=excluded.updated_by,updated_at=excluded.updated_at;
 SELECT to_jsonb(p) INTO configured FROM public.exam_edition_ranking_policies p WHERE edition_id=p_edition_id;
 PERFORM public.admin_log_action('UPSERT','exam_edition_ranking_policies',p_edition_id,
  'Edition ranking policy configured',jsonb_build_object('before',previous,'after',configured,'reason',btrim(p_reason)));
 RETURN configured;
END $$;

CREATE OR REPLACE FUNCTION public.get_edition_ranking(p_edition_id uuid,p_limit integer DEFAULT 50,p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE policy public.exam_edition_ranking_policies; offered bigint; result jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT FROM public.exam_editions WHERE id=p_edition_id) THEN
  RAISE EXCEPTION 'Unknown edition' USING ERRCODE='22023';
 END IF;
 IF p_limit IS NULL OR p_limit<1 OR p_limit>200 OR p_offset IS NULL OR p_offset<0 THEN
  RAISE EXCEPTION 'Limit must be 1..200 and offset nonnegative' USING ERRCODE='22023';
 END IF;
 SELECT * INTO policy FROM public.exam_edition_ranking_policies WHERE edition_id=p_edition_id;
 IF NOT FOUND OR NOT policy.enabled THEN
  RETURN jsonb_build_object('status','unconfigured','edition_id',p_edition_id,'policy',NULL,'items','[]'::jsonb,'population',0);
 END IF;
 -- Match published metadata access; archived requires the same finished owner
 -- participation as the canonical ranking. Never add a PRO requirement.
 WITH visible AS (
  SELECT s.id FROM public.simulados s WHERE s.edition_id=p_edition_id
   AND s.execution_window_start<=now() AND s.results_release_at<=now()
   AND (s.status='published' OR (s.status='archived' AND EXISTS(
    SELECT FROM public.attempts a WHERE a.simulado_id=s.id AND a.user_id=auth.uid()
     AND a.status IN ('submitted','expired') AND a.finished_at IS NOT NULL)))
 ) SELECT count(*) INTO offered FROM visible;
 IF offered<policy.minimum_simulados THEN
  RETURN jsonb_build_object('status','insufficient_offered','edition_id',p_edition_id,
   'policy',jsonb_build_object('best_n',policy.best_n,'minimum_simulados',policy.minimum_simulados),
   'offered_simulados',offered,'items','[]'::jsonb,'population',0);
 END IF;
 WITH best AS MATERIALIZED (
  SELECT r.user_id,r.simulado_id,r.nota_final,r.finished_at,r.full_name
  FROM public.simulados s CROSS JOIN LATERAL public.get_ranking_for_simulado(s.id) r
  WHERE s.edition_id=p_edition_id AND s.status IN ('published','archived')
   AND s.execution_window_start<=now() AND s.results_release_at<=now() AND r.finished_at IS NOT NULL
 ), ordered AS (
  SELECT *,row_number() OVER(PARTITION BY user_id ORDER BY nota_final DESC,finished_at,simulado_id) AS choice,
   count(*) OVER(PARTITION BY user_id) AS completed_simulados FROM best
 ), averages AS (
  SELECT user_id,min(full_name) AS display_name,avg(nota_final) AS average_score,
   count(*) AS used_simulados,max(completed_simulados) AS completed_simulados,
   max(nota_final) AS highest_score,max(finished_at) AS last_counted_finish
  FROM ordered WHERE choice<=policy.best_n AND completed_simulados>=policy.minimum_simulados GROUP BY user_id
 ), ranked AS (
  SELECT *,row_number() OVER(ORDER BY average_score DESC,highest_score DESC,last_counted_finish,user_id) AS position
  FROM averages
 ), page AS (
  SELECT * FROM ranked ORDER BY position LIMIT p_limit OFFSET p_offset
 ) SELECT jsonb_build_object('status','ready','edition_id',p_edition_id,
  'policy',jsonb_build_object('best_n',policy.best_n,'minimum_simulados',policy.minimum_simulados),
  'offered_simulados',offered,'population',(SELECT count(*) FROM ranked),
  'limit',p_limit,'offset',p_offset,
  'metadata',jsonb_build_object('score_kind','raw_within_edition_only','psychometric_comparable',false,
   'tie_break','average_desc,highest_counted_score_desc,last_counted_finish_asc,user_id_asc',
   'warning','Average uses min(best_n, completed_simulados); compare within this edition only.'),
  'items',coalesce((SELECT jsonb_agg(jsonb_build_object('user_id',user_id,'display_name',display_name,
   'position',position,'average_score',average_score,'used_simulados',used_simulados,
   'completed_simulados',completed_simulados) ORDER BY position) FROM page),'[]'::jsonb)) INTO result;
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.get_cutoff_score_history(
 p_institution_id uuid,p_specialty_id uuid,p_practice_scenario text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE result jsonb; legacy_count bigint;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 IF p_institution_id IS NULL OR p_specialty_id IS NULL THEN
  RAISE EXCEPTION 'Canonical institution and specialty required' USING ERRCODE='22023';
 END IF;
 SELECT count(*) INTO legacy_count FROM public.enamed_cutoff_scores c
 WHERE c.institution_id=p_institution_id AND c.specialty_id=p_specialty_id
  AND (c.reference_edition_id IS NULL OR nullif(btrim(c.source),'') IS NULL)
  AND (p_practice_scenario IS NULL OR lower(btrim(coalesce(c.practice_scenario,'')))=lower(btrim(p_practice_scenario)));
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',c.id,'institution_id',c.institution_id,
  'specialty_id',c.specialty_id,'practice_scenario',c.practice_scenario,
  'source',c.source,'source_version',NULL,'reference_edition_id',e.id,
  'reference_edition_code',e.code,'reference_edition_label',e.label,'year',e.year,'term',e.term,
  'reference_label',e.cutoff_reference_label,'value_general',c.cutoff_score_general,'value_quota',c.cutoff_score_quota,
  'vagas',(SELECT p.vagas FROM public.enamed_programs p WHERE p.institution_id=c.institution_id
   AND p.specialty_id=c.specialty_id AND p.reference_edition_id=c.reference_edition_id AND p.source=c.source
   AND lower(btrim(coalesce(p.cenario_pratica,'')))=lower(btrim(coalesce(c.practice_scenario,'')))),
  'trend_comparable',false) ORDER BY e.year,e.term NULLS FIRST,e.id,c.source,c.id),'[]'::jsonb) INTO result
 FROM public.enamed_cutoff_scores c JOIN public.exam_editions e ON e.id=c.reference_edition_id
 WHERE c.institution_id=p_institution_id AND c.specialty_id=p_specialty_id AND nullif(btrim(c.source),'') IS NOT NULL
  AND (p_practice_scenario IS NULL OR lower(btrim(coalesce(c.practice_scenario,'')))=lower(btrim(p_practice_scenario)));
 RETURN jsonb_build_object('items',result,'legacy_unknown_count',legacy_count,'trend_comparable',false,
  'metadata',jsonb_build_object('reference_only',true,'source_version_available',false,
   'warning','Distinct reference processes and scales; no certified comparable trend. Legacy unknown sources are not plotted.'));
END $$;

REVOKE ALL ON FUNCTION public.get_my_percentile_history(uuid),
 public.admin_configure_edition_ranking(uuid,integer,integer,boolean,text),
 public.get_edition_ranking(uuid,integer,integer),public.get_cutoff_score_history(uuid,uuid,text)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_my_percentile_history(uuid),
 public.admin_configure_edition_ranking(uuid,integer,integer,boolean,text),
 public.get_edition_ranking(uuid,integer,integer),public.get_cutoff_score_history(uuid,uuid,text) TO authenticated;
$edition_analysis_ddl$;
END $edition_analysis_migration$;

-- Manual non-destructive rollback, reviewed and run by the migration owner:
-- BEGIN;
-- UPDATE public.exam_edition_ranking_policies SET enabled=false;
-- DROP FUNCTION public.get_my_percentile_history(uuid);
-- DROP FUNCTION public.get_edition_ranking(uuid,integer,integer);
-- DROP FUNCTION public.get_cutoff_score_history(uuid,uuid,text);
-- DROP FUNCTION public.admin_configure_edition_ranking(uuid,integer,integer,boolean,text);
-- COMMIT;
-- Preserve exam_edition_ranking_policies and admin_audit_log. Never drop data.
