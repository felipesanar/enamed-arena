-- Cadernos do presencial: único caminho para ligar is_active. Contrato:
-- docs/superpowers/specs/2026-09-06-presencial-cadernos.md
--
-- "Não existe caminho de ativação que pule a verificação" — como isso é
-- garantido de fato, e onde a garantia É e NÃO É técnica:
--
--   1. Esta é a ÚNICA função do projeto que faz
--      `UPDATE public.presencial_cadernos SET is_active = true`. Nenhuma
--      outra migration escreve nessa coluna (busque por
--      "is_active = true" ligado a presencial_cadernos e só aparece aqui).
--   2. RLS em presencial_cadernos está ligada e SEM policy (ver
--      20260906150000_presencial_cadernos_schema.sql) — então nenhum client
--      autenticado ou anônimo consegue fazer esse UPDATE direto, com ou sem
--      passar por esta função.
--   3. GAP CONHECIDO (documentado, não uma omissão silenciosa): service_role
--      ignora RLS por padrão e já tem privilégio de tabela via as default
--      privileges do schema public — ou seja, uma chamada feita com a
--      service_role key PODE, tecnicamente, rodar
--      `UPDATE presencial_cadernos SET is_active = true` direto, pulando
--      esta função e pulando verify_caderno_map. Não há CHECK constraint nem
--      trigger aqui que impeça isso (um trigger poderia bloquear todo UPDATE
--      de is_active e exigir uma flag de sessão setada só por esta função,
--      mas isso não foi pedido pelo contrato e adicionaria complexidade não
--      solicitada). A garantia real, hoje, é de DISCIPLINA DE CÓDIGO: a edge
--      function `presencial`, o script de importação
--      (scripts/import-caderno-map.ts) e as RPCs de admin devem SEMPRE
--      chamar public.activate_caderno(...) para ativar um caderno, nunca
--      fazer UPDATE direto na tabela.
--
-- SECURITY DEFINER restrita a service_role — mesmos grants de
-- verify_caderno_map, chamada de dentro desta função (ownership do dono da
-- função, não GRANT, é o que permite a chamada — ver comentário equivalente
-- em verify_caderno_map.sql).

CREATE OR REPLACE FUNCTION public.activate_caderno(p_caderno_id uuid, p_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_result  jsonb;
  v_summary text;
BEGIN
  v_result := public.verify_caderno_map(p_caderno_id, p_key);

  IF NOT COALESCE((v_result ->> 'ok')::boolean, false) THEN
    SELECT string_agg(elem #>> '{}', ' | ') INTO v_summary
    FROM jsonb_array_elements(COALESCE(v_result -> 'problems', '[]'::jsonb)) elem;

    RAISE EXCEPTION 'CADERNO_MAP_INVALID: %', COALESCE(v_summary, 'verificação falhou sem detalhe');
  END IF;

  UPDATE public.presencial_cadernos SET is_active = true WHERE id = p_caderno_id;

  IF NOT FOUND THEN
    -- Defensivo: verify_caderno_map já teria retornado ok=false com
    -- "Caderno não encontrado." se p_caderno_id não existisse, então este
    -- ramo só dispara numa corrida rara (caderno apagado entre a verificação
    -- e o UPDATE). Preferimos falhar alto a devolver sucesso silencioso.
    RAISE EXCEPTION 'CADERNO_NOT_FOUND';
  END IF;

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.activate_caderno(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_caderno(uuid, text) TO service_role;
