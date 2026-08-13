-- Fix round 1/5 do review da Task 7: desempate não-determinístico do
-- DISTINCT ON de admin_presencial_queue.
--
-- O ORDER BY original (subs.id, (pe.id IS NOT NULL) DESC) só desempata entre
-- "casou por e-mail" e "casou por nome" — quando o nome normalizado colide
-- entre VÁRIAS contas (a base tem nomes com até 19 contas, ex.: "Maria
-- Eduarda" normaliza para 19 profiles distintos), não há terceira chave, e o
-- Postgres não garante ordem estável entre linhas empatadas nesse critério.
-- Resultado: o suggested_user_id da mesma submissão pode mudar entre
-- chamadas conforme o plano de execução muda — um admin recarrega a fila e
-- vê outra conta sugerida para a mesma submissão, o que convida ao clique
-- errado (atribuir a nota de um aluno a outro).
--
-- Fix: acrescenta duas chaves determinísticas ao ORDER BY do DISTINCT ON,
-- só relevantes no ramo de nome (pn): created_at ASC (a conta mais antiga é
-- a heurística melhor para "qual é a conta real" quando há duplicata — é
-- exatamente o caso que a fila existe para resolver) e, como critério final
-- à prova de empate, o id (chave total, PK, garante determinismo absoluto).
-- O ramo de e-mail (pe) não precisa de blindagem adicional: confirmado que
-- profiles não tem hoje nenhum e-mail duplicado na prática (auth.users
-- garante unicidade a montante), então esse ramo já é determinístico.
--
-- CREATE OR REPLACE da mesma função já aplicada em
-- 20260812100600_presencial_admin_rpcs.sql (essa migration não é tocada);
-- assinatura, retorno, capability e grants idênticos.

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
    ORDER BY subs.id, (pe.id IS NOT NULL) DESC, pn.created_at ASC, pn.id ASC
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
