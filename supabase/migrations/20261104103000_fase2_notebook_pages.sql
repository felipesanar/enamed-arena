-- F2-7: read-only cumulative notebook. A single DO is atomic both standalone
-- and inside a migration runner/test transaction; no data backfill or SRS writes.
DO $migration$
BEGIN
  CREATE INDEX IF NOT EXISTS idx_notebook_page_owner_created
    ON public.error_notebook(user_id,created_at DESC,id DESC)
    WHERE deleted_at IS NULL;
  CREATE INDEX IF NOT EXISTS idx_notebook_page_owner_simulado
    ON public.error_notebook(user_id,simulado_id)
    WHERE deleted_at IS NULL;

  EXECUTE $ddl$
  CREATE OR REPLACE FUNCTION public.notebook_page_scope(p_edition_id uuid)
  RETURNS SETOF public.error_notebook
  LANGUAGE plpgsql STABLE SECURITY DEFINER
  SET search_path = pg_catalog, public
  AS $function$
  DECLARE v_user_id uuid := auth.uid();
  BEGIN
    -- Neither JWT metadata nor admin/content capabilities promote a segment.
    -- Also reject service-role impersonation even if granted EXECUTE later.
    IF v_user_id IS NULL OR auth.role() IS DISTINCT FROM 'authenticated'
       OR current_setting('role',true) IN ('anon','service_role')
       OR NOT EXISTS (SELECT 1 FROM public.profiles p
                      WHERE p.id=v_user_id AND p.segment='pro') THEN
      RAISE EXCEPTION 'Current PRO account required' USING ERRCODE='42501';
    END IF;
    RETURN QUERY
      SELECT n.* FROM public.error_notebook n
      LEFT JOIN public.questions q ON q.id=n.question_id
      LEFT JOIN public.simulados s ON s.id=coalesce(n.simulado_id,q.simulado_id)
      WHERE n.user_id=v_user_id AND n.deleted_at IS NULL
        -- A conflicting question/exam must never borrow either exam's edition.
        AND (n.question_id IS NULL OR (q.id IS NOT NULL
          AND (n.simulado_id IS NULL OR n.simulado_id=q.simulado_id)))
        AND (
          (n.simulado_id IS NULL AND n.question_id IS NULL AND p_edition_id IS NULL)
          OR (s.id IS NOT NULL
            -- F1 preserves archived owner history; test remains restricted by
            -- the same real capability used by simulado/F0 question visibility.
            AND (s.status IN ('published','archived')
              OR (s.status='test' AND public.has_capability('content.manage')))
            AND s.execution_window_start<=now() AND s.results_release_at<=now()
            AND EXISTS (SELECT 1 FROM public.attempts a
              WHERE a.user_id=v_user_id AND a.simulado_id=s.id
                AND a.status IN ('submitted','expired') AND a.finished_at IS NOT NULL)
            AND (p_edition_id IS NULL OR s.edition_id=p_edition_id))
        );
  END;
  $function$
  $ddl$;
  REVOKE ALL ON FUNCTION public.notebook_page_scope(uuid) FROM PUBLIC,anon,authenticated,service_role;

  EXECUTE $ddl$
  CREATE OR REPLACE FUNCTION public.list_error_notebook_page(
    p_edition_id uuid DEFAULT NULL,p_limit integer DEFAULT 50,p_offset integer DEFAULT 0)
  RETURNS jsonb
  LANGUAGE plpgsql STABLE SECURITY DEFINER
  SET search_path = pg_catalog, public
  AS $function$
  DECLARE v_result jsonb;
  BEGIN
    IF p_limit IS NULL OR p_limit<1 OR p_limit>100 OR p_offset IS NULL OR p_offset<0 THEN
      RAISE EXCEPTION 'limit must be 1..100 and offset >= 0' USING ERRCODE='22023';
    END IF;
    WITH scoped AS MATERIALIZED (
      SELECT * FROM public.notebook_page_scope(p_edition_id)
    ), page AS (
      SELECT n.* FROM scoped n ORDER BY n.created_at DESC,n.id DESC
      LIMIT p_limit OFFSET p_offset
    )
    SELECT jsonb_build_object(
      'items',coalesce((SELECT jsonb_agg(
        to_jsonb(n)||jsonb_build_object('edition_id',e.id,'edition_code',e.code,'edition_label',e.label)
        ORDER BY n.created_at DESC,n.id DESC)
        FROM page n LEFT JOIN public.questions q ON q.id=n.question_id
        LEFT JOIN public.simulados s ON s.id=coalesce(n.simulado_id,q.simulado_id)
        LEFT JOIN public.exam_editions e ON e.id=s.edition_id),'[]'::jsonb),
      'total',(SELECT count(*) FROM scoped),'limit',p_limit,'offset',p_offset)
    INTO v_result;
    RETURN v_result;
  END;
  $function$
  $ddl$;

  EXECUTE $ddl$
  CREATE OR REPLACE FUNCTION public.get_error_notebook_counts(p_edition_id uuid DEFAULT NULL)
  RETURNS jsonb
  LANGUAGE plpgsql STABLE SECURITY DEFINER
  SET search_path = pg_catalog, public
  AS $function$
  DECLARE v_result jsonb;
  BEGIN
    WITH scoped AS MATERIALIZED (
      SELECT n.*,n.mastered_at IS NOT NULL AS is_mastered,
        n.mastered_at IS NULL AND n.resolved_at IS NULL
          AND coalesce(n.srs_due_at,n.next_review_at,n.created_at)<=now() AS is_due
      FROM public.notebook_page_scope(p_edition_id) n
    ), areas AS (
      SELECT area,count(*) AS total,count(*) FILTER (WHERE is_mastered) AS mastered,
        count(*) FILTER (WHERE is_due) AS due
      FROM scoped GROUP BY area
    )
    SELECT jsonb_build_object('total',count(*),
      'mastered',count(*) FILTER (WHERE is_mastered),'due',count(*) FILTER (WHERE is_due),
      'by_area',coalesce((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.area NULLS LAST)
                         FROM areas a),'[]'::jsonb))
    INTO v_result FROM scoped;
    RETURN v_result;
  END;
  $function$
  $ddl$;
  REVOKE ALL ON FUNCTION public.list_error_notebook_page(uuid,integer,integer) FROM PUBLIC,anon,authenticated,service_role;
  REVOKE ALL ON FUNCTION public.get_error_notebook_counts(uuid) FROM PUBLIC,anon,authenticated,service_role;
  GRANT EXECUTE ON FUNCTION public.list_error_notebook_page(uuid,integer,integer) TO authenticated;
  GRANT EXECUTE ON FUNCTION public.get_error_notebook_counts(uuid) TO authenticated;
END;
$migration$;

-- Manual rollback, preserving ALL notebook/review/history data:
-- BEGIN;
-- DROP FUNCTION IF EXISTS public.list_error_notebook_page(uuid,integer,integer);
-- DROP FUNCTION IF EXISTS public.get_error_notebook_counts(uuid);
-- DROP FUNCTION IF EXISTS public.notebook_page_scope(uuid);
-- DROP INDEX IF EXISTS public.idx_notebook_page_owner_created;
-- DROP INDEX IF EXISTS public.idx_notebook_page_owner_simulado;
-- COMMIT;
