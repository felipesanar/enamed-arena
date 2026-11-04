-- Additive F2-7 filters. One atomic statement; reapplicable, no data writes.
DO $migration$
BEGIN
 EXECUTE $ddl$
 CREATE OR REPLACE FUNCTION public.notebook_filtered_scope(
  p_edition_id uuid,p_reason text,p_area text,p_search text,p_state text)
 RETURNS SETOF public.error_notebook
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public
 AS $function$
 DECLARE v_search text:=nullif(btrim(p_search),'');
 BEGIN
  IF p_state IS NULL OR p_state NOT IN ('all','pending','mastered')
   OR (p_reason IS NOT NULL AND p_reason NOT IN ('did_not_know','did_not_remember',
     'reading_error','confused_alternatives','did_not_understand','guessed_correctly'))
   OR char_length(v_search)>200 THEN
   RAISE EXCEPTION 'Invalid notebook filters' USING ERRCODE='22023';
  END IF;
  RETURN QUERY SELECT n.* FROM public.notebook_page_scope(p_edition_id) n
   WHERE (p_reason IS NULL OR n.reason::text=p_reason)
    AND (p_area IS NULL OR n.area=p_area)
    AND (p_state='all'
      OR (p_state='mastered' AND (n.mastered_at IS NOT NULL OR n.resolved_at IS NOT NULL))
      OR (p_state='pending' AND n.mastered_at IS NULL AND n.resolved_at IS NULL))
    AND (v_search IS NULL OR EXISTS (
      SELECT FROM unnest(ARRAY[n.theme,n.question_text,n.learning_text,n.simulado_title]) t(value)
      WHERE strpos(lower(t.value),lower(v_search))>0));
 END;
 $function$
 $ddl$;
 -- Private aggregation shared by both wrappers. Input is already authorized,
 -- filtered rows; this never exposes an arbitrary user-id read path.
 EXECUTE $ddl$
 CREATE OR REPLACE FUNCTION public.notebook_filtered_counts_json(p_rows jsonb)
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public
 AS $function$
  WITH rows AS (
   SELECT n->>'area' AS area,
    (n->>'mastered_at' IS NOT NULL OR n->>'resolved_at' IS NOT NULL) AS mastered,
    n->>'mastered_at' IS NULL AND n->>'resolved_at' IS NULL
     AND coalesce(n->>'last_review_outcome','') NOT IN ('leech_blocked','awaiting_lesson')
     AND coalesce((n->>'srs_due_at')::timestamptz,(n->>'next_review_at')::timestamptz,
       (n->>'created_at')::timestamptz)<=now() AS due
   FROM jsonb_array_elements(p_rows) n
  ), areas AS (
   SELECT area,count(*) AS total,count(*) FILTER(WHERE mastered) AS mastered,
    count(*) FILTER(WHERE due) AS due FROM rows GROUP BY area
  )
  SELECT jsonb_build_object('total',count(*),'mastered',count(*) FILTER(WHERE mastered),
   'due',count(*) FILTER(WHERE due),'by_area',coalesce(
    (SELECT jsonb_agg(to_jsonb(a) ORDER BY a.area NULLS LAST) FROM areas a),'[]'::jsonb))
  FROM rows;
 $function$
 $ddl$;
 EXECUTE $ddl$
 CREATE OR REPLACE FUNCTION public.list_error_notebook_filtered_page(
  p_edition_id uuid DEFAULT NULL,p_reason text DEFAULT NULL,p_area text DEFAULT NULL,
  p_search text DEFAULT NULL,p_state text DEFAULT 'all',p_limit integer DEFAULT 50,p_offset integer DEFAULT 0)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public
 AS $function$
 DECLARE v_result jsonb;
 BEGIN
  IF p_limit IS NULL OR p_limit<1 OR p_limit>100 OR p_offset IS NULL OR p_offset<0 THEN
   RAISE EXCEPTION 'limit must be 1..100 and offset >= 0' USING ERRCODE='22023';
  END IF;
  WITH scoped AS MATERIALIZED (
   SELECT * FROM public.notebook_filtered_scope(p_edition_id,p_reason,p_area,p_search,p_state)
  ), page AS (
   SELECT * FROM scoped ORDER BY created_at DESC,id DESC LIMIT p_limit OFFSET p_offset
  )
  SELECT jsonb_build_object('items',coalesce((SELECT jsonb_agg(
    to_jsonb(n)||jsonb_build_object('edition_id',e.id,'edition_code',e.code,'edition_label',e.label)
    ORDER BY n.created_at DESC,n.id DESC)
    FROM page n LEFT JOIN public.questions q ON q.id=n.question_id
    LEFT JOIN public.simulados s ON s.id=coalesce(n.simulado_id,q.simulado_id)
    LEFT JOIN public.exam_editions e ON e.id=s.edition_id),'[]'::jsonb),
   'total',(SELECT count(*) FROM scoped),'limit',p_limit,'offset',p_offset,
   'counts',public.notebook_filtered_counts_json(coalesce((SELECT jsonb_agg(to_jsonb(n)) FROM scoped n),'[]'::jsonb)))
  INTO v_result;
  RETURN v_result;
 END;
 $function$
 $ddl$;
 EXECUTE $ddl$
 CREATE OR REPLACE FUNCTION public.get_error_notebook_filtered_counts(
  p_edition_id uuid DEFAULT NULL,p_reason text DEFAULT NULL,p_area text DEFAULT NULL,
  p_search text DEFAULT NULL,p_state text DEFAULT 'all')
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public
 AS $function$
 DECLARE v_rows jsonb;
 BEGIN
  SELECT coalesce(jsonb_agg(to_jsonb(n)),'[]'::jsonb) INTO v_rows
   FROM public.notebook_filtered_scope(p_edition_id,p_reason,p_area,p_search,p_state) n;
  RETURN public.notebook_filtered_counts_json(v_rows);
 END;
 $function$
 $ddl$;
 REVOKE ALL ON FUNCTION public.notebook_filtered_scope(uuid,text,text,text,text) FROM PUBLIC,anon,authenticated,service_role;
 REVOKE ALL ON FUNCTION public.notebook_filtered_counts_json(jsonb) FROM PUBLIC,anon,authenticated,service_role;
 REVOKE ALL ON FUNCTION public.list_error_notebook_filtered_page(uuid,text,text,text,text,integer,integer) FROM PUBLIC,anon,authenticated,service_role;
 REVOKE ALL ON FUNCTION public.get_error_notebook_filtered_counts(uuid,text,text,text,text) FROM PUBLIC,anon,authenticated,service_role;
 GRANT EXECUTE ON FUNCTION public.list_error_notebook_filtered_page(uuid,text,text,text,text,integer,integer) TO authenticated;
 GRANT EXECUTE ON FUNCTION public.get_error_notebook_filtered_counts(uuid,text,text,text,text) TO authenticated;
END;
$migration$;

-- Manual rollback, only these NEW functions, preserving all data:
-- BEGIN;
-- DROP FUNCTION IF EXISTS public.list_error_notebook_filtered_page(uuid,text,text,text,text,integer,integer);
-- DROP FUNCTION IF EXISTS public.get_error_notebook_filtered_counts(uuid,text,text,text,text);
-- DROP FUNCTION IF EXISTS public.notebook_filtered_counts_json(jsonb);
-- DROP FUNCTION IF EXISTS public.notebook_filtered_scope(uuid,text,text,text,text);
-- COMMIT;
