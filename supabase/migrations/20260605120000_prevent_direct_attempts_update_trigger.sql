-- =====================================================================
-- P0 security fix (2026-06-05) — Trigger anti-adulteração em `attempts`
-- =====================================================================
-- Contexto: a auditoria de drift (docs/AUDITORIA_DRIFT_MIGRATIONS_2026-06-05.md)
-- constatou que a Seção 2 da migration 20260420000000_security_hardening NUNCA
-- pegou em produção — e que, como escrita, NÃO funcionaria: ela checa
-- `session_user IN ('postgres', ...)`, mas as RPCs (finalize_attempt_with_results,
-- update_attempt_progress_guarded, create/submit_offline) são owned por `postgres`
-- + SECURITY DEFINER, então dentro delas `current_user = 'postgres'` enquanto
-- `session_user` permanece o papel da conexão (authenticator/authenticated). Logo
-- o guard original bloquearia o próprio finalize.
--
-- Esta migration aplica a versão CORRIGIDA (checa `current_user`). Sem ela, a
-- policy RLS "Users can update own attempts" permitia ao cliente dar UPDATE direto
-- em score_percentage/status/finished_at/is_within_window → adulteração de nota.
--
-- As demais seções da 20260420000000 (revoke de has_role, gate de ranking) ficaram
-- DELIBERADAMENTE de fora aqui por terem efeitos colaterais que exigem teste em
-- staging — ver o doc de auditoria.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.prevent_direct_attempts_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_elevated boolean;
BEGIN
  -- Permitido quando a escrita vem de um RPC SECURITY DEFINER (current_user = owner = postgres),
  -- de uma conexão de service_role/superuser, ou de uma sessão administrativa direta.
  v_is_elevated := (
    current_user IN ('postgres', 'supabase_admin', 'supabase_auth_admin', 'service_role')
    OR session_user IN ('postgres', 'supabase_admin', 'supabase_auth_admin')
    OR current_setting('request.jwt.claim.role', true) = 'service_role'
  );

  IF v_is_elevated THEN
    RETURN NEW;
  END IF;

  -- Bloqueia mudanças em colunas protegidas vindas de sessões de cliente (authenticated).
  IF NEW.score_percentage IS DISTINCT FROM OLD.score_percentage THEN
    RAISE EXCEPTION 'attempts.score_percentage is read-only for clients (use finalize_attempt_with_results)' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.total_correct IS DISTINCT FROM OLD.total_correct THEN
    RAISE EXCEPTION 'attempts.total_correct is read-only for clients' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.total_answered IS DISTINCT FROM OLD.total_answered THEN
    RAISE EXCEPTION 'attempts.total_answered is read-only for clients' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.finished_at IS DISTINCT FROM OLD.finished_at THEN
    RAISE EXCEPTION 'attempts.finished_at is read-only for clients' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.is_within_window IS DISTINCT FROM OLD.is_within_window THEN
    RAISE EXCEPTION 'attempts.is_within_window is read-only for clients' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'attempts.status must be changed via finalize RPC' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'attempts.user_id is immutable' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.simulado_id IS DISTINCT FROM OLD.simulado_id THEN
    RAISE EXCEPTION 'attempts.simulado_id is immutable' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_direct_attempts_update ON public.attempts;

CREATE TRIGGER trg_prevent_direct_attempts_update
BEFORE UPDATE ON public.attempts
FOR EACH ROW
EXECUTE FUNCTION public.prevent_direct_attempts_update();
