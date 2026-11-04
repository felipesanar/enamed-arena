-- =====================================================================
-- ⚠️ STAGING-ONLY — NÃO APLICADO EM PRODUÇÃO (2026-06-05)
-- =====================================================================
-- Re-trabalho seguro das seções deferidas da 20260420000000_security_hardening
-- (a original está marcada "NÃO APLICAR COMO ESTÁ"). O prefixo "_STAGING_" e o
-- underscore inicial mantêm este arquivo FORA da ordem normal de migrations até
-- ser validado. Para promover: testar em staging, renomear para
-- `20260605140000_security_hardening_rework.sql` e aplicar via db push.
--
-- O que faz (corrige os 2 bugs da original):
--   1. Cria current_user_has_role(app_role) — wrapper ligado a auth.uid().
--   2. Reescreve as 24 políticas RLS admin: troca has_role(auth.uid(),'admin')
--      por (select current_user_has_role('admin'::app_role)). SÓ DEPOIS disso é
--      seguro revogar has_role dos clientes (a original revogava ANTES, quebrando RLS).
--   3. REVOKE EXECUTE em has_role(uuid, app_role) de anon/authenticated.
--   4. get_ranking_for_simulado: gate por results_release_at (esconde ranking antes
--      da liberação). MUDANÇA DE COMPORTAMENTO visível — validar com produto.
--
-- Pré-requisito: rodar DEPOIS de 20260605130000 (wrap auth.uid()), pois reescreve
-- as mesmas policies. É idempotente o suficiente para rodar em qualquer ordem.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. current_user_has_role
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_user_has_role(_role app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = _role
  );
$$;

GRANT EXECUTE ON FUNCTION public.current_user_has_role(app_role) TO authenticated;

-- ---------------------------------------------------------------------
-- 2. Reescreve as policies admin: has_role(...) -> (select current_user_has_role(...))
--    Cobre ambas as formas (auth.uid() cru ou já embrulhado em (select auth.uid())).
-- ---------------------------------------------------------------------
DO $$
DECLARE
  r record;
  v_qual text;
  v_check text;
  v_sql text;
  v_pat text := 'has_role\(\s*\(?\s*(select\s+)?auth\.uid\(\)(\s+as\s+uid)?\s*\)?\s*,\s*''admin''::app_role\s*\)';
  v_repl text := '(select current_user_has_role(''admin''::app_role))';
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname='public'
      AND (coalesce(qual,'') ~* 'has_role\(' OR coalesce(with_check,'') ~* 'has_role\(')
  LOOP
    v_qual := r.qual;
    v_check := r.with_check;
    IF v_qual IS NOT NULL THEN
      v_qual := regexp_replace(v_qual, v_pat, v_repl, 'gi');
    END IF;
    IF v_check IS NOT NULL THEN
      v_check := regexp_replace(v_check, v_pat, v_repl, 'gi');
    END IF;

    v_sql := 'ALTER POLICY ' || quote_ident(r.policyname)
             || ' ON ' || quote_ident(r.schemaname) || '.' || quote_ident(r.tablename);
    IF v_qual IS NOT NULL THEN v_sql := v_sql || ' USING (' || v_qual || ')'; END IF;
    IF v_check IS NOT NULL THEN v_sql := v_sql || ' WITH CHECK (' || v_check || ')'; END IF;
    EXECUTE v_sql;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 3. Revoga has_role dos clientes (seguro agora que nenhuma policy o usa)
-- ---------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. get_ranking_for_simulado: esconde ranking antes de results_release_at
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_ranking_for_simulado(p_simulado_id uuid)
RETURNS TABLE(user_id uuid, simulado_id uuid, nota_final numeric, total_correct integer, total_answered integer, finished_at timestamp with time zone, full_name text, segment user_segment, especialidade text, instituicoes_alvo text[], posicao bigint, total_candidatos bigint)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_released boolean;
BEGIN
  SELECT s.results_release_at IS NULL OR s.results_release_at <= now()
  INTO v_released
  FROM simulados s
  WHERE s.id = p_simulado_id;

  IF v_released IS NULL OR v_released = false THEN
    RETURN; -- não liberado: vazio (admins usam admin_get_ranking_for_simulado)
  END IF;

  RETURN QUERY
  SELECT
    a.user_id, a.simulado_id, a.score_percentage AS nota_final,
    a.total_correct, a.total_answered, a.finished_at,
    p.full_name, p.segment, op.specialty AS especialidade,
    op.target_institutions AS instituicoes_alvo,
    ROW_NUMBER() OVER (ORDER BY a.score_percentage DESC NULLS LAST, a.finished_at ASC NULLS LAST)::bigint AS posicao,
    COUNT(*) OVER ()::bigint AS total_candidatos
  FROM attempts a
  JOIN profiles p ON p.id = a.user_id
  LEFT JOIN onboarding_profiles op ON op.user_id = a.user_id
  WHERE a.simulado_id = p_simulado_id
    AND a.status IN ('submitted', 'expired')
    AND a.score_percentage IS NOT NULL
    AND a.is_within_window = true
  ORDER BY a.score_percentage DESC NULLS LAST, a.finished_at ASC NULLS LAST;
END;
$$;
