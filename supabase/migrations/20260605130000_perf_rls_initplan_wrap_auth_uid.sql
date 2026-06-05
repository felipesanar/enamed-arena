-- =====================================================================
-- Performance — advisor `auth_rls_initplan` (2026-06-05)
-- =====================================================================
-- Aplicado em produção via MCP. Envolve `auth.uid()` em `(select auth.uid())`
-- em todas as ~45 políticas RLS afetadas, para o Postgres avaliar a função uma
-- vez por query (initplan) em vez de uma vez por linha. Transformação
-- semanticamente IDÊNTICA — não altera quem pode ler/escrever.
--
-- Também estabiliza o auth.uid() interno das policies admin que usam
-- has_role(auth.uid(), 'admin'). (O lint só sinaliza funções auth.*/current_setting;
-- has_role em si não é flagged por este lint.)
--
-- Idempotente: pula policies já corrigidas. Atômico: o DO block roda numa transação.
DO $$
DECLARE
  r record;
  v_qual text;
  v_check text;
  v_sql text;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        (coalesce(qual,'')       ~ 'auth\.uid\(\)' AND coalesce(qual,'')       !~* 'select\s+auth\.uid')
        OR (coalesce(with_check,'') ~ 'auth\.uid\(\)' AND coalesce(with_check,'') !~* 'select\s+auth\.uid')
      )
  LOOP
    v_qual := r.qual;
    v_check := r.with_check;
    IF v_qual IS NOT NULL THEN
      v_qual := regexp_replace(v_qual, 'auth\.uid\(\)', '(select auth.uid())', 'g');
    END IF;
    IF v_check IS NOT NULL THEN
      v_check := regexp_replace(v_check, 'auth\.uid\(\)', '(select auth.uid())', 'g');
    END IF;

    v_sql := 'ALTER POLICY ' || quote_ident(r.policyname)
             || ' ON ' || quote_ident(r.schemaname) || '.' || quote_ident(r.tablename);
    IF v_qual IS NOT NULL THEN
      v_sql := v_sql || ' USING (' || v_qual || ')';
    END IF;
    IF v_check IS NOT NULL THEN
      v_sql := v_sql || ' WITH CHECK (' || v_check || ')';
    END IF;
    EXECUTE v_sql;
  END LOOP;
END $$;
