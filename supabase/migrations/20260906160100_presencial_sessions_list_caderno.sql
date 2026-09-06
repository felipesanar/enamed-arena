-- admin_presencial_sessions_list passa a devolver o caderno da sala.
--
-- Bug que isso conserta: o formulario de sessao do admin le
-- `session.caderno_id` para pre-selecionar o "Caderno da sala". Sem a coluna
-- no retorno, ele lia sempre `undefined` -> caia no default "o aluno
-- escolhe" -> e o upsert (que agora grava a coluna) DESTRAVARIA a sala em
-- silencio a cada edicao. Perda de dado invisivel, do tipo que so aparece
-- quando 100 alunos recebem o esqueleto errado.
--
-- Devolve tambem label e cor para a lista poder exibir sem uma segunda
-- consulta. DROP antes de CREATE porque mudar o tipo de retorno de uma
-- funcao existente da 42P13 (mesma pegadinha do upsert); o DROP leva os
-- grants, entao eles sao reconcedidos no fim.

DROP FUNCTION IF EXISTS public.admin_presencial_sessions_list();

CREATE OR REPLACE FUNCTION public.admin_presencial_sessions_list()
RETURNS TABLE(
  id                uuid,
  simulado_id       uuid,
  simulado_title    text,
  code              text,
  label             text,
  opens_at          timestamp with time zone,
  closes_at         timestamp with time zone,
  is_active         boolean,
  submissions_count integer,
  linked_count      integer,
  caderno_id        uuid,
  caderno_label     text,
  caderno_color     text
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
    COUNT(sub.id) FILTER (WHERE sub.status = 'linked')::integer AS linked_count,
    ps.caderno_id, c.label, c.color
  FROM public.presencial_sessions ps
  JOIN public.simulados s ON s.id = ps.simulado_id
  LEFT JOIN public.presencial_cadernos c ON c.id = ps.caderno_id
  LEFT JOIN public.presencial_submissions sub ON sub.session_id = ps.id
  GROUP BY ps.id, ps.simulado_id, s.title, ps.code, ps.label, ps.opens_at,
           ps.closes_at, ps.is_active, ps.caderno_id, c.label, c.color
  ORDER BY ps.opens_at DESC;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_presencial_sessions_list() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_presencial_sessions_list() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_presencial_sessions_list() TO authenticated, service_role;
