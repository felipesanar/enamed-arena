-- Cadernos do presencial: RPCs de admin. Contrato:
-- docs/superpowers/specs/2026-09-06-presencial-cadernos.md
--
-- Mesmo padrão de 20260812100600_presencial_admin_rpcs.sql (capturado lá via
-- pg_get_functiondef em produção): 1º statement `perform
-- public.admin_require('<capability>')`; leitura = `stable security definer
-- set search_path to 'public'`; escrita loga com admin_log_action dentro de
-- `begin...exception when others then null; end;`; grants em linhas
-- separadas (REVOKE PUBLIC, REVOKE anon, GRANT authenticated+service_role).
--
-- Nenhuma das duas RPCs abaixo ativa caderno (isso é
-- public.activate_caderno, chamado só pelo script de importação com
-- service_role, per contrato — "nada de CRUD de itens na UI"). São só
-- leitura/consulta para o painel read-only por caderno do admin.

-- ─── 1. admin_presencial_cadernos_list ─────────────────────────────────────
-- Cadernos de um simulado com contagem de itens e o resumo da última
-- verificação (verify_caderno_map é STABLE e não grava nada, então rodá-la
-- aqui — sem p_key — é seguro e barato; ela só compara o mapa contra si
-- mesmo, sem chave impressa, então "verification_ok" aqui reflete só as
-- invariantes estruturais, não divergência contra o gabarito impresso).

CREATE OR REPLACE FUNCTION public.admin_presencial_cadernos_list(p_simulado_id uuid)
RETURNS TABLE(
  id                    uuid,
  code                  text,
  label                 text,
  color                 text,
  is_active             boolean,
  total_itens           integer,
  verification_ok       boolean,
  verification_problems integer,
  derived_key           text
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
    c.id, c.code, c.label, c.color, c.is_active,
    (SELECT count(*)::integer FROM public.presencial_caderno_items i WHERE i.caderno_id = c.id) AS total_itens,
    (v.result ->> 'ok')::boolean AS verification_ok,
    COALESCE(jsonb_array_length(v.result -> 'problems'), 0)::integer AS verification_problems,
    v.result ->> 'derived_key' AS derived_key
  FROM public.presencial_cadernos c
  CROSS JOIN LATERAL (SELECT public.verify_caderno_map(c.id) AS result) v
  WHERE c.simulado_id = p_simulado_id
  ORDER BY c.code;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_presencial_cadernos_list(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_presencial_cadernos_list(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_presencial_cadernos_list(uuid) TO authenticated, service_role;

-- ─── 2. admin_presencial_caderno_verify ────────────────────────────────────
-- Wrapper de verify_caderno_map para o botão "reverificar contra a chave
-- impressa" do painel do admin (o admin cola o gabarito impresso num
-- textarea e reenvia). Não altera is_active — quem faz isso é
-- activate_caderno, fora do alcance do admin autenticado por desenho do
-- contrato (só o script de importação, com service_role).
--
-- Pode chamar verify_caderno_map (GRANT restrito a service_role) porque é
-- SECURITY DEFINER com o mesmo dono (postgres) — ownership dá privilégio de
-- execução implícito, independente de GRANT/REVOKE. Mesmo mecanismo já em
-- produção em admin_presencial_link → link_presencial_submission
-- (20260812100600_presencial_admin_rpcs.sql / 20260812100500_link_presencial_submission.sql).

CREATE OR REPLACE FUNCTION public.admin_presencial_caderno_verify(p_caderno_id uuid, p_key text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  PERFORM public.admin_require('content.manage');

  v_result := public.verify_caderno_map(p_caderno_id, p_key);

  BEGIN
    PERFORM public.admin_log_action(
      'verify_presencial_caderno', 'presencial_caderno', p_caderno_id,
      'Verificação do mapa do caderno rodada pelo admin',
      jsonb_build_object(
        'ok', v_result -> 'ok',
        'problems_count', jsonb_array_length(COALESCE(v_result -> 'problems', '[]'::jsonb)),
        'key_informado', (p_key IS NOT NULL AND btrim(p_key) <> '')
      )
    );
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_presencial_caderno_verify(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_presencial_caderno_verify(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_presencial_caderno_verify(uuid, text) TO authenticated, service_role;
