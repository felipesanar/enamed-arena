-- Task 7 da aplicação presencial: RPCs de admin (sessões, fila de identidade,
-- vínculo e reatribuição). Diferente das RPCs anteriores do presencial
-- (service_role only, chamadas pela edge function no dia da prova), estas são
-- chamadas pelo frontend de admin autenticado — GRANT para authenticated,
-- não só service_role.
--
-- Padrão capturado via pg_get_functiondef em produção antes de escrever
-- (admin_simulado_results_roster, admin_cancel_attempt, admin_delete_attempt,
-- admin_log_action, admin_require):
--   1º statement sempre `perform public.admin_require('<capability>')`.
--   RPCs de leitura: `language plpgsql stable security definer set search_path to 'public'`.
--   RPCs de escrita: sem `stable`; ao final, chamam
--     `perform public.admin_log_action(action, entity_type, entity_id, summary, metadata)`
--     dentro de um `begin ... exception when others then null; end;` — o audit
--     log nunca pode derrubar a operação principal.
--   Grants: `REVOKE ALL ... FROM PUBLIC` + `REVOKE ALL ... FROM anon` (linhas
--     separadas — grant-hygiene) + `GRANT EXECUTE ... TO authenticated, service_role`.

-- ─── 1. admin_presencial_sessions_list ─────────────────────────────────────
-- Lista as salas presenciais com contagem de submissões (total e vinculadas).

CREATE OR REPLACE FUNCTION public.admin_presencial_sessions_list()
RETURNS TABLE(
  id                uuid,
  simulado_id       uuid,
  simulado_title    text,
  code              text,
  label             text,
  opens_at          timestamptz,
  closes_at         timestamptz,
  is_active         boolean,
  submissions_count integer,
  linked_count      integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.admin_require('content.manage');

  RETURN QUERY
  SELECT
    ps.id, ps.simulado_id, s.title,
    ps.code, ps.label, ps.opens_at, ps.closes_at, ps.is_active,
    COUNT(sub.id)::integer AS submissions_count,
    COUNT(sub.id) FILTER (WHERE sub.status = 'linked')::integer AS linked_count
  FROM public.presencial_sessions ps
  JOIN public.simulados s ON s.id = ps.simulado_id
  LEFT JOIN public.presencial_submissions sub ON sub.session_id = ps.id
  GROUP BY ps.id, ps.simulado_id, s.title, ps.code, ps.label, ps.opens_at, ps.closes_at, ps.is_active
  ORDER BY ps.opens_at DESC;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_presencial_sessions_list() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_presencial_sessions_list() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_presencial_sessions_list() TO authenticated, service_role;

-- ─── 2. admin_presencial_session_upsert ────────────────────────────────────
-- p_id NULL => cria sala nova; p_id preenchido => atualiza. Constraints da
-- própria tabela (closes_at > opens_at, code ~ padrão, code único) seguem
-- valendo — não duplicamos validação aqui, só o "não encontrado" no update
-- (mesmo padrão de admin_cancel_attempt/admin_delete_attempt).

CREATE OR REPLACE FUNCTION public.admin_presencial_session_upsert(
  p_id          uuid,
  p_simulado_id uuid,
  p_code        text,
  p_label       text,
  p_opens_at    timestamptz,
  p_closes_at   timestamptz,
  p_is_active   boolean
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
BEGIN
  PERFORM public.admin_require('content.manage');

  IF p_id IS NULL THEN
    INSERT INTO public.presencial_sessions (simulado_id, code, label, opens_at, closes_at, is_active)
    VALUES (p_simulado_id, p_code, p_label, p_opens_at, p_closes_at, p_is_active)
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.presencial_sessions
    SET simulado_id = p_simulado_id,
        code        = p_code,
        label       = p_label,
        opens_at    = p_opens_at,
        closes_at   = p_closes_at,
        is_active   = p_is_active
    WHERE id = p_id
    RETURNING id INTO v_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'SESSION_NOT_FOUND';
    END IF;
  END IF;

  BEGIN
    PERFORM public.admin_log_action(
      CASE WHEN p_id IS NULL THEN 'create_presencial_session' ELSE 'update_presencial_session' END,
      'presencial_session', v_id,
      'Sessão presencial ' || CASE WHEN p_id IS NULL THEN 'criada' ELSE 'atualizada' END || ': ' || p_label,
      jsonb_build_object('code', p_code, 'simulado_id', p_simulado_id, 'is_active', p_is_active)
    );
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN v_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_presencial_session_upsert(uuid, uuid, text, text, timestamptz, timestamptz, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_presencial_session_upsert(uuid, uuid, text, text, timestamptz, timestamptz, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_presencial_session_upsert(uuid, uuid, text, text, timestamptz, timestamptz, boolean) TO authenticated, service_role;

-- ─── 3. admin_presencial_queue ──────────────────────────────────────────────
-- Fila de identidade: submissões (por padrão as 'unlinked') com a conta
-- sugerida pela mesma regra da Tela 1 (e-mail exato primeiro, nome
-- normalizado depois). DISTINCT ON (subs.id) evita multiplicar linhas quando
-- o nome declarado colide com várias contas (base tem nomes com até 19
-- contas) — prioriza o match por e-mail quando existe.
--
-- Comparação de nome reusa public.normalize_text_for_match (lower + unaccent
-- + colapso de espaço), já usada por match_cutoff_score — em vez de inlinar
-- unaccent() aqui: unaccent vive no schema `extensions`, não em `public`, e
-- chamar public.normalize_text_for_match resolve isso porque a própria
-- função tem `SET search_path = public, extensions` (confirmado só depois
-- de um smoke falhar com `unaccent(text) does not exist` — inlinar teria
-- exigido `extensions.unaccent` explícito ou ampliar o search_path desta
-- RPC).

CREATE OR REPLACE FUNCTION public.admin_presencial_queue(p_status text DEFAULT 'unlinked')
RETURNS TABLE(
  submission_id       uuid,
  session_label       text,
  declared_name       text,
  declared_email      text,
  identification_path text,
  total_correct       integer,
  score_percentage    numeric,
  created_at          timestamptz,
  ip_hash             text,
  suggested_user_id   uuid,
  suggested_email     text,
  suggested_name      text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.admin_require('attempts.manage');

  RETURN QUERY
  WITH subs AS (
    SELECT s.*, ps.label AS sess_label
    FROM public.presencial_submissions s
    JOIN public.presencial_sessions ps ON ps.id = s.session_id
    WHERE p_status = 'all' OR s.status = p_status
  ),
  matched AS (
    SELECT DISTINCT ON (subs.id)
      subs.id AS sub_id,
      COALESCE(pe.id, pn.id)               AS user_id,
      COALESCE(pe.email, pn.email)         AS email,
      COALESCE(pe.full_name, pn.full_name) AS full_name
    FROM subs
    LEFT JOIN public.profiles pe
      ON lower(btrim(pe.email)) = lower(btrim(subs.declared_email))
    LEFT JOIN public.profiles pn
      ON pe.id IS NULL
     AND public.normalize_text_for_match(pn.full_name)
       = public.normalize_text_for_match(subs.declared_name)
    ORDER BY subs.id, (pe.id IS NOT NULL) DESC
  )
  SELECT
    subs.id, subs.sess_label, subs.declared_name, subs.declared_email,
    subs.identification_path, subs.total_correct, subs.score_percentage,
    subs.created_at, subs.ip_hash,
    m.user_id, m.email, m.full_name
  FROM subs
  LEFT JOIN matched m ON m.sub_id = subs.id
  ORDER BY subs.created_at DESC;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_presencial_queue(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_presencial_queue(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_presencial_queue(text) TO authenticated, service_role;

-- ─── 4. admin_presencial_link ───────────────────────────────────────────────
-- Vincula uma submissão presencial à conta escolhida pelo admin na fila.
-- Só repassa para link_presencial_submission (service_role only — funciona
-- porque esta função é SECURITY DEFINER com owner postgres) e registra no
-- audit log. As guardas de negócio (já vinculada, sem respostas, submissão
-- inexistente) vivem em link_presencial_submission — não duplicadas aqui.

CREATE OR REPLACE FUNCTION public.admin_presencial_link(p_submission_id uuid, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  PERFORM public.admin_require('attempts.manage');

  v_result := public.link_presencial_submission(p_submission_id, p_user_id);

  BEGIN
    PERFORM public.admin_log_action(
      'link_presencial_submission', 'presencial_submission', p_submission_id,
      'Submissão presencial vinculada à conta',
      jsonb_build_object('user_id', p_user_id, 'attempt_id', v_result->'attempt_id')
    );
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_presencial_link(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_presencial_link(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_presencial_link(uuid, uuid) TO authenticated, service_role;

-- ─── 5. admin_presencial_reassign ───────────────────────────────────────────
-- Move um attempt (não só presencial — qualquer attempt) para outra conta.
-- attempts.user_id é declarado imutável para clientes pelo trigger
-- prevent_direct_attempts_update, mas o trigger libera SECURITY DEFINER
-- (current_user = postgres, dono desta função). Move também a linha de
-- user_performance_history (não tem unique em (user_id, simulado_id), só em
-- attempt_id — mover não colide) e recalcula o resumo nas DUAS contas
-- (origem e destino), senão as duas ficam com resumo desatualizado. Se o
-- attempt movido é presencial e tem submissão vinculada, o linked_user_id da
-- submissão acompanha o attempt (WHERE não casa nada em attempts não-
-- presenciais, então é seguro incondicionalmente).
--
-- Gap conhecido, fora do escopo desta task: entradas de error_notebook do
-- attempt ficam com o user_id de origem (tabela não referencia attempt_id,
-- só user_id/simulado_id/question_id — mover exigiria decisão de produto
-- própria sobre o Caderno de Erros, não pedida no brief).

CREATE OR REPLACE FUNCTION public.admin_presencial_reassign(p_attempt_id uuid, p_to_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_attempt      public.attempts%ROWTYPE;
  v_from_user_id uuid;
BEGIN
  PERFORM public.admin_require('attempts.manage');

  SELECT * INTO v_attempt FROM public.attempts WHERE id = p_attempt_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ATTEMPT_NOT_FOUND';
  END IF;

  v_from_user_id := v_attempt.user_id;

  IF v_from_user_id = p_to_user_id THEN
    RAISE EXCEPTION 'ATTEMPT_ALREADY_ASSIGNED_TO_USER';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_to_user_id) THEN
    RAISE EXCEPTION 'TARGET_USER_NOT_FOUND';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.attempts
    WHERE simulado_id = v_attempt.simulado_id
      AND user_id = p_to_user_id
      AND attempt_type = v_attempt.attempt_type
      AND id <> p_attempt_id
  ) THEN
    RAISE EXCEPTION 'TARGET_USER_ALREADY_HAS_ATTEMPT';
  END IF;

  UPDATE public.attempts SET user_id = p_to_user_id WHERE id = p_attempt_id;

  UPDATE public.user_performance_history
  SET user_id = p_to_user_id
  WHERE attempt_id = p_attempt_id;

  UPDATE public.presencial_submissions
  SET linked_user_id = p_to_user_id
  WHERE linked_attempt_id = p_attempt_id;

  PERFORM public.recalculate_user_performance(v_from_user_id);
  PERFORM public.recalculate_user_performance(p_to_user_id);

  BEGIN
    PERFORM public.admin_log_action(
      'reassign_attempt', 'attempt', p_attempt_id,
      'Tentativa reatribuída entre contas',
      jsonb_build_object('from_user_id', v_from_user_id, 'to_user_id', p_to_user_id)
    );
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object(
    'attempt_id', p_attempt_id,
    'from_user_id', v_from_user_id,
    'to_user_id', p_to_user_id
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_presencial_reassign(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_presencial_reassign(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_presencial_reassign(uuid, uuid) TO authenticated, service_role;
