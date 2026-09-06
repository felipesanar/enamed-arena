-- admin_presencial_queue passa a devolver o caderno da submissao.
--
-- Fecha o ultimo buraco do trio de RPCs do admin no contrato dos cadernos
-- (docs/superpowers/specs/2026-09-06-presencial-cadernos.md): o upsert grava
-- (20260906160000), a lista devolve (20260906160100) e aqui a fila de
-- identidade passa a mostrar COM QUAL caderno cada gabarito foi enviado.
--
-- Por que importa na fila e nao so no relatorio: quem opera a fila esta
-- decidindo de quem e aquela nota. Quando um aluno reclama de nota baixa, a
-- primeira hipotese e "respondeu o esqueleto do caderno errado" -- numa sala
-- com QR unico o aluno escolhe a cor na mao, e escolher errado embaralha
-- todo o gabarito. Sem essa coluna, o admin nao consegue distinguir isso de
-- um erro de vinculo, que e justamente a decisao que ele esta tomando ali.
--
-- Submissoes anteriores aos cadernos (e as de sala sem caderno travado que
-- nao gravaram a coluna) tem caderno_id NULL -- por isso LEFT JOIN, e por
-- isso o front (AdminPresencial, coluna "Caderno") ja trata os tres campos
-- como opcionais e cai num traco. Nenhuma mudanca de front e necessaria.
--
-- DROP antes do CREATE porque acrescentar coluna ao RETURNS TABLE de uma
-- funcao existente da 42P13 (mesma pegadinha das duas migrations irmas); o
-- DROP leva os grants junto, entao eles sao reconcedidos no fim.
--
-- O corpo e o de 20260812100650_presencial_queue_deterministic.sql (o
-- DISTINCT ON deterministico do desempate por nome) mais o LEFT JOIN em
-- presencial_cadernos. O join e por PK, 1:1, entao nao multiplica linha nem
-- afeta a ordenacao. Assinatura, capability e grants identicos.

DROP FUNCTION IF EXISTS public.admin_presencial_queue(text);

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
  suggested_name      text,
  caderno_code        text,
  caderno_label       text,
  caderno_color       text
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
    m.user_id, m.email, m.full_name,
    c.code, c.label, c.color
  FROM subs
  LEFT JOIN matched m ON m.sub_id = subs.id
  LEFT JOIN public.presencial_cadernos c ON c.id = subs.caderno_id
  ORDER BY subs.created_at DESC;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_presencial_queue(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_presencial_queue(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_presencial_queue(text) TO authenticated, service_role;
