-- Cadernos do presencial: admin_presencial_session_upsert passa a aceitar
-- p_caderno_id (a sala pode ficar travada num caderno; NULL = o aluno
-- escolhe, que e o modelo usado no S7).
--
-- Por que DROP antes de CREATE, e nao so CREATE OR REPLACE: acrescentar um
-- parametro cria uma SOBRECARGA, nao substitui a funcao. Com a versao de 7
-- args e a de 8 args (a nova com DEFAULT) coexistindo, uma chamada com 7
-- argumentos fica AMBIGUA e o PostgREST passa a errar em vez de resolver.
-- Some-se a isso o 42P13 de mudar assinatura/retorno. Entao: DROP explicito
-- da assinatura antiga, CREATE da nova, e regrant (o DROP leva os grants
-- embora) -- mesma receita ja usada no projeto para
-- finalize_attempt_with_results.
--
-- Contexto do bug que isso conserta: o admin ja passou a enviar
-- p_caderno_id, e sem esta migration TODO salvamento de sessao presencial
-- falharia com PGRST202 ("function not found in schema cache") -- incluindo
-- desligar is_active, que e o kill switch da sala no dia da prova.

DROP FUNCTION IF EXISTS public.admin_presencial_session_upsert(
  uuid, uuid, text, text, timestamptz, timestamptz, boolean
);

CREATE OR REPLACE FUNCTION public.admin_presencial_session_upsert(
  p_id uuid,
  p_simulado_id uuid,
  p_code text,
  p_label text,
  p_opens_at timestamptz,
  p_closes_at timestamptz,
  p_is_active boolean,
  p_caderno_id uuid DEFAULT NULL
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

  -- Um caderno so trava uma sala do PROPRIO simulado dela. Sem esta guarda,
  -- um clique errado no admin serviria o esqueleto de outra prova para a
  -- sala inteira.
  IF p_caderno_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.presencial_cadernos c
    WHERE c.id = p_caderno_id AND c.simulado_id = p_simulado_id
  ) THEN
    RAISE EXCEPTION 'CADERNO_NOT_IN_SIMULADO';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.presencial_sessions (simulado_id, code, label, opens_at, closes_at, is_active, caderno_id)
    VALUES (p_simulado_id, p_code, p_label, p_opens_at, p_closes_at, p_is_active, p_caderno_id)
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.presencial_sessions
    SET simulado_id = p_simulado_id,
        code        = p_code,
        label       = p_label,
        opens_at    = p_opens_at,
        closes_at   = p_closes_at,
        is_active   = p_is_active,
        caderno_id  = p_caderno_id
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
      'Sessao presencial ' || CASE WHEN p_id IS NULL THEN 'criada' ELSE 'atualizada' END || ': ' || p_label,
      jsonb_build_object('code', p_code, 'simulado_id', p_simulado_id, 'is_active', p_is_active, 'caderno_id', p_caderno_id)
    );
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN v_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_presencial_session_upsert(uuid, uuid, text, text, timestamptz, timestamptz, boolean, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_presencial_session_upsert(uuid, uuid, text, text, timestamptz, timestamptz, boolean, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_presencial_session_upsert(uuid, uuid, text, text, timestamptz, timestamptz, boolean, uuid) TO authenticated, service_role;
