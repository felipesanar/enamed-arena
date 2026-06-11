-- ── 1. Nota de corte por join exato de ID ─────────────────────────────────
-- Uma linha por instituição-alvo (na ordem do array do usuário).
-- Instituições sem corte simplesmente não retornam (frontend deriva "indisponível").
CREATE OR REPLACE FUNCTION public.get_cutoff_scores(
  p_specialty_id uuid,
  p_institution_ids uuid[]
)
RETURNS TABLE(
  institution_id uuid,
  institution_name text,
  practice_scenario text,
  specialty_name text,
  cutoff_score_general numeric,
  cutoff_score_quota numeric
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT DISTINCT ON (t.ord)
    ei.id,
    ei.name,
    cs.practice_scenario,
    cs.specialty_name,
    cs.cutoff_score_general,
    cs.cutoff_score_quota
  FROM unnest(p_institution_ids) WITH ORDINALITY AS t(id, ord)
  JOIN public.enamed_institutions ei ON ei.id = t.id
  JOIN public.enamed_cutoff_scores cs
    ON cs.institution_id = t.id
   AND cs.specialty_id = p_specialty_id
  ORDER BY t.ord, cs.cutoff_score_general DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_cutoff_scores(uuid, uuid[]) TO authenticated;

-- ── 2. Save de onboarding por ID (nova sobrecarga; nomes derivados) ────────
CREATE OR REPLACE FUNCTION public.save_onboarding_guarded(
  p_specialty_id uuid,
  p_target_institution_ids uuid[]
)
RETURNS public.onboarding_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_now timestamptz := now();
  v_specialty_name text := NULL;
  v_inst_ids uuid[] := COALESCE(p_target_institution_ids, '{}');
  v_inst_names text[] := '{}';
  v_result public.onboarding_profiles%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado';
  END IF;

  -- specialty_id NULL = "Ainda não sei" (permitido)
  IF p_specialty_id IS NOT NULL THEN
    SELECT name INTO v_specialty_name
    FROM public.enamed_specialties WHERE id = p_specialty_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Especialidade invalida';
    END IF;
  END IF;

  -- valida instituições e deriva nomes na mesma ordem
  IF cardinality(v_inst_ids) > 0 THEN
    SELECT array_agg(ei.name ORDER BY t.ord) INTO v_inst_names
    FROM unnest(v_inst_ids) WITH ORDINALITY AS t(id, ord)
    JOIN public.enamed_institutions ei ON ei.id = t.id;
    IF COALESCE(cardinality(v_inst_names), 0) <> cardinality(v_inst_ids) THEN
      RAISE EXCEPTION 'Instituicao invalida';
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM public.onboarding_profiles o WHERE o.user_id = v_user_id) THEN
    IF public.is_any_simulado_window_open(v_now) THEN
      RAISE EXCEPTION 'Perfil so pode ser editado entre janelas de execucao';
    END IF;
    UPDATE public.onboarding_profiles
    SET specialty_id = p_specialty_id,
        specialty = v_specialty_name,
        target_institution_ids = v_inst_ids,
        target_institutions = v_inst_names,
        status = 'completed',
        completed_at = COALESCE(completed_at, v_now),
        updated_at = v_now
    WHERE user_id = v_user_id
    RETURNING * INTO v_result;
  ELSE
    INSERT INTO public.onboarding_profiles (
      user_id, specialty_id, specialty, target_institution_ids,
      target_institutions, status, completed_at
    ) VALUES (
      v_user_id, p_specialty_id, v_specialty_name, v_inst_ids,
      v_inst_names, 'completed', v_now
    )
    RETURNING * INTO v_result;
  END IF;

  RETURN v_result;
END;
$$;

-- ── 3. Sobrecarga antiga (text) passa a sincronizar os IDs ─────────────────
-- Fecha a janela entre backfill e cutover do frontend: salvar por texto
-- também resolve os IDs por match exato ("Ainda não sei" => NULL/{}).
CREATE OR REPLACE FUNCTION public.save_onboarding_guarded(
  p_specialty text,
  p_target_institutions text[]
)
RETURNS public.onboarding_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_spec_id uuid;
  v_inst_ids uuid[];
BEGIN
  IF p_specialty IS NULL OR btrim(p_specialty) = '' THEN
    RAISE EXCEPTION 'Especialidade obrigatoria';
  END IF;
  IF COALESCE(array_length(p_target_institutions, 1), 0) < 1 THEN
    RAISE EXCEPTION 'Selecione ao menos uma instituicao ou marque Ainda nao sei';
  END IF;

  SELECT es.id INTO v_spec_id
  FROM public.enamed_specialties es
  WHERE normalize_text_for_match(es.name) = normalize_text_for_match(p_specialty);

  SELECT COALESCE(array_agg(ei.id ORDER BY t.ord) FILTER (WHERE ei.id IS NOT NULL), '{}')
  INTO v_inst_ids
  FROM unnest(p_target_institutions) WITH ORDINALITY AS t(name, ord)
  LEFT JOIN public.enamed_institutions ei
    ON normalize_text_for_match(ei.name) = normalize_text_for_match(t.name);

  RETURN public.save_onboarding_guarded(v_spec_id, v_inst_ids);
END;
$$;

-- ── 4. Ranking deriva nomes canônicos dos IDs (fallback: texto) ────────────
CREATE OR REPLACE FUNCTION public.get_ranking_for_simulado(p_simulado_id uuid)
RETURNS TABLE(user_id uuid, simulado_id uuid, nota_final numeric, total_correct integer, total_answered integer, finished_at timestamptz, full_name text, segment user_segment, especialidade text, instituicoes_alvo text[], posicao bigint, total_candidatos bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    a.user_id,
    a.simulado_id,
    a.score_percentage AS nota_final,
    a.total_correct,
    a.total_answered,
    a.finished_at,
    p.full_name,
    p.segment,
    COALESCE(es.name, op.specialty) AS especialidade,
    COALESCE(
      (SELECT array_agg(ei.name ORDER BY t.ord)
       FROM unnest(op.target_institution_ids) WITH ORDINALITY AS t(id, ord)
       JOIN enamed_institutions ei ON ei.id = t.id),
      op.target_institutions
    ) AS instituicoes_alvo,
    ROW_NUMBER() OVER (
      ORDER BY a.score_percentage DESC NULLS LAST, a.finished_at ASC NULLS LAST
    ) AS posicao,
    COUNT(*) OVER () AS total_candidatos
  FROM attempts a
  JOIN profiles p ON p.id = a.user_id
  LEFT JOIN onboarding_profiles op ON op.user_id = a.user_id
  LEFT JOIN enamed_specialties es ON es.id = op.specialty_id
  WHERE a.simulado_id = p_simulado_id
    AND a.status IN ('submitted', 'expired')
    AND a.score_percentage IS NOT NULL
    AND a.is_within_window = true
  ORDER BY a.score_percentage DESC NULLS LAST, a.finished_at ASC NULLS LAST
$$;

-- ── 5. Mesma derivação no preview admin ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_get_ranking_for_simulado(p_simulado_id uuid, p_include_train boolean DEFAULT false)
RETURNS TABLE(user_id uuid, simulado_id uuid, nota_final numeric, total_correct integer, total_answered integer, finished_at timestamptz, full_name text, segment user_segment, especialidade text, instituicoes_alvo text[], posicao bigint, total_candidatos bigint)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = 'P0003';
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
    COALESCE(es.name, op.specialty) AS especialidade,
    COALESCE(
      (SELECT array_agg(ei.name ORDER BY t.ord)
       FROM unnest(op.target_institution_ids) WITH ORDINALITY AS t(id, ord)
       JOIN public.enamed_institutions ei ON ei.id = t.id),
      op.target_institutions
    ) AS instituicoes_alvo,
    ROW_NUMBER() OVER (
      ORDER BY a.score_percentage DESC NULLS LAST, a.finished_at ASC NULLS LAST
    )::bigint AS posicao,
    COUNT(*) OVER ()::bigint AS total_candidatos
  FROM public.attempts a
  JOIN public.profiles p ON p.id = a.user_id
  LEFT JOIN public.onboarding_profiles op ON op.user_id = a.user_id
  LEFT JOIN public.enamed_specialties es ON es.id = op.specialty_id
  WHERE a.simulado_id = p_simulado_id
    AND a.status IN ('submitted', 'expired')
    AND a.score_percentage IS NOT NULL
    AND (p_include_train OR a.is_within_window = true)
  ORDER BY a.score_percentage DESC NULLS LAST, a.finished_at ASC NULLS LAST;
END;
$$;
