-- Cadernos do presencial: verificação das 4 invariantes de integridade do
-- mapa impresso → real. Contrato:
-- docs/superpowers/specs/2026-09-06-presencial-cadernos.md
--
-- Um caderno só é utilizável se TODAS valerem, porque um mapa errado
-- corrompe a nota de 100 alunos em silêncio — a mesma classe de erro que já
-- mordeu o gabarito do S5 e do S6 (ver
-- gabarito-errado-classe-de-erro-e-reprocessamento no histórico do projeto).
-- Por isso esta função só LÊ e nunca decide sozinha ativar nada: quem faz
-- isso é public.activate_caderno, que chama esta função como gate (arquivo
-- seguinte, 20260906150200_activate_caderno.sql).
--
-- As 4 invariantes do contrato, e onde cada uma é checada abaixo:
--   1. count(items) = count(questions do simulado)              → bloco "invariante 1"
--   2. position cobre 1..N sem buraco e sem repetição            → bloco "invariante 2"
--      (repetição é impossível por construção: PK é (caderno_id, position))
--   3. o conjunto de question_id dos itens é EXATAMENTE o conjunto
--      de questões do simulado (não só a contagem)                → bloco "invariante 3"
--   4. option_map tem exatamente as chaves A,B,C,D; os 4 valores
--      são distintos; e todos pertencem à question_id do item      → bloco "invariante 4"
--
-- Decisão além do contrato literal (reportada no resumo da task): dentro do
-- loop da invariante 4 também tentamos derivar, para cada posição, qual
-- letra corresponde à alternativa CORRETA da questão (necessário para
-- construir o derived_key pedido pelo contrato). Se nenhuma das 4
-- alternativas mapeadas for a correta, isso não está listado como uma das 4
-- invariantes numeradas, mas vira um "problem" mesmo assim — sem isso o
-- derived_key ficaria com um "?" na posição e ninguém saberia por quê, e é
-- exatamente o tipo de furo silencioso que este contrato existe para evitar.
--
-- SECURITY DEFINER restrita a service_role: quem chama esta função direto é
-- a edge function `presencial` (import/ativação) e o admin via wrapper
-- (admin_presencial_caderno_verify, que é SECURITY DEFINER e portanto pode
-- chamar esta apesar do GRANT restrito — mesmo padrão já usado por
-- admin_presencial_link → link_presencial_submission).

CREATE OR REPLACE FUNCTION public.verify_caderno_map(p_caderno_id uuid, p_key text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caderno           public.presencial_cadernos%ROWTYPE;
  v_problems          text[] := ARRAY[]::text[];
  v_items_count       integer;
  v_questions_count   integer;
  v_missing_positions int[];
  v_extra_positions   int[];
  v_missing_questions integer;
  v_extra_questions   integer;
  v_item              record;
  v_derived_parts     text[] := ARRAY[]::text[];
  v_derived_key       text;
  v_expected_map      jsonb := '{}'::jsonb;
  v_pair              text;
  v_pos               int;
  v_letter            text;
BEGIN
  SELECT * INTO v_caderno FROM public.presencial_cadernos WHERE id = p_caderno_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'problems', jsonb_build_array('Caderno não encontrado.'),
      'derived_key', NULL
    );
  END IF;

  -- ── Invariante 1: count(items) = count(questions do simulado) ──────────────
  SELECT count(*) INTO v_items_count
  FROM public.presencial_caderno_items WHERE caderno_id = p_caderno_id;

  SELECT count(*) INTO v_questions_count
  FROM public.questions WHERE simulado_id = v_caderno.simulado_id;

  IF v_items_count <> v_questions_count THEN
    v_problems := array_append(v_problems, format(
      'O caderno tem %s item(ns) mas o simulado tem %s questão(ões) — os totais precisam ser iguais.',
      v_items_count, v_questions_count
    ));
  END IF;

  -- ── Invariante 2: position cobre 1..N sem buraco (N = questões do simulado) ─
  -- Repetição de position é impossível por construção (PK (caderno_id,
  -- position)); aqui só checamos buraco (posição esperada ausente) e posição
  -- fora do intervalo esperado (indício de N errado ou item deslocado).
  SELECT array_agg(gs ORDER BY gs) INTO v_missing_positions
  FROM generate_series(1, v_questions_count) gs
  WHERE NOT EXISTS (
    SELECT 1 FROM public.presencial_caderno_items i
    WHERE i.caderno_id = p_caderno_id AND i.position = gs
  );

  IF v_missing_positions IS NOT NULL AND array_length(v_missing_positions, 1) > 0 THEN
    v_problems := array_append(v_problems, format(
      'Faltam itens nas posições: %s.', array_to_string(v_missing_positions, ', ')
    ));
  END IF;

  SELECT array_agg(i.position ORDER BY i.position) INTO v_extra_positions
  FROM public.presencial_caderno_items i
  WHERE i.caderno_id = p_caderno_id AND (i.position < 1 OR i.position > v_questions_count);

  IF v_extra_positions IS NOT NULL AND array_length(v_extra_positions, 1) > 0 THEN
    v_problems := array_append(v_problems, format(
      'Posições fora do intervalo esperado (1..%s): %s.',
      v_questions_count, array_to_string(v_extra_positions, ', ')
    ));
  END IF;

  -- ── Invariante 3: o conjunto de question_id dos itens é EXATAMENTE o
  --    conjunto de questões do simulado (não basta a contagem bater) ─────────
  SELECT count(*) INTO v_missing_questions
  FROM public.questions q
  WHERE q.simulado_id = v_caderno.simulado_id
    AND NOT EXISTS (
      SELECT 1 FROM public.presencial_caderno_items i
      WHERE i.caderno_id = p_caderno_id AND i.question_id = q.id
    );

  IF v_missing_questions > 0 THEN
    v_problems := array_append(v_problems, format(
      '%s questão(ões) do simulado não aparecem em nenhum item deste caderno.', v_missing_questions
    ));
  END IF;

  SELECT count(*) INTO v_extra_questions
  FROM public.presencial_caderno_items i
  WHERE i.caderno_id = p_caderno_id
    AND NOT EXISTS (
      SELECT 1 FROM public.questions q
      WHERE q.simulado_id = v_caderno.simulado_id AND q.id = i.question_id
    );

  IF v_extra_questions > 0 THEN
    v_problems := array_append(v_problems, format(
      '%s item(ns) do caderno apontam para questão(ões) que não pertencem a este simulado.', v_extra_questions
    ));
  END IF;

  -- ── Parse do gabarito impresso (p_key), se informado ────────────────────────
  -- Formato "1:B,2:C,...". Guardamos posição→letra num jsonb para comparar
  -- item a item no loop abaixo.
  IF p_key IS NOT NULL AND btrim(p_key) <> '' THEN
    FOR v_pair IN SELECT unnest(string_to_array(p_key, ',')) LOOP
      v_pair := btrim(v_pair);
      CONTINUE WHEN v_pair = '';

      IF v_pair !~ '^[0-9]+\s*:\s*[A-Da-d]$' THEN
        v_problems := array_append(v_problems, format(
          'Gabarito impresso mal formatado no trecho "%s" — esperado "posição:letra", ex.: "1:B".', v_pair
        ));
        CONTINUE;
      END IF;

      v_pos := split_part(v_pair, ':', 1)::int;
      v_letter := upper(btrim(split_part(v_pair, ':', 2)));
      v_expected_map := v_expected_map || jsonb_build_object(v_pos::text, v_letter);
    END LOOP;
  END IF;

  -- ── Invariante 4 (por item) + derivação do gabarito (derived_key) ──────────
  FOR v_item IN
    SELECT i.position, i.question_id, i.option_map
    FROM public.presencial_caderno_items i
    WHERE i.caderno_id = p_caderno_id
    ORDER BY i.position
  LOOP
    DECLARE
      v_keys           text[];
      v_values         text[];
      v_distinct_count int;
      v_valid_count    int;
      v_correct_letter text;
      v_expected_letter text;
      v_shape_ok       boolean := true;
    BEGIN
      -- 4a. exatamente as chaves A, B, C, D
      SELECT array_agg(k ORDER BY k) INTO v_keys FROM jsonb_object_keys(v_item.option_map) k;

      IF v_keys IS DISTINCT FROM ARRAY['A', 'B', 'C', 'D'] THEN
        v_problems := array_append(v_problems, format(
          'Posição %s: option_map deveria ter exatamente as chaves A, B, C, D — encontrado: %s.',
          v_item.position, COALESCE(array_to_string(v_keys, ', '), '(vazio)')
        ));
        v_shape_ok := false;
      END IF;

      IF v_shape_ok THEN
        SELECT array_agg(v_item.option_map ->> letter) INTO v_values
        FROM unnest(ARRAY['A', 'B', 'C', 'D']) letter;

        -- 4b. os 4 valores são distintos
        SELECT count(DISTINCT val) INTO v_distinct_count FROM unnest(v_values) val;
        IF v_distinct_count <> 4 THEN
          v_problems := array_append(v_problems, format(
            'Posição %s: os 4 valores de option_map precisam ser distintos entre si.', v_item.position
          ));
        END IF;

        -- 4c. todos os 4 valores pertencem à question_id do item
        SELECT count(*) INTO v_valid_count
        FROM unnest(v_values) val
        JOIN public.question_options qo
          ON qo.question_id = v_item.question_id
         AND qo.id::text = val;

        IF v_valid_count <> 4 THEN
          v_problems := array_append(v_problems, format(
            'Posição %s: uma ou mais alternativas de option_map não pertencem à questão deste item.', v_item.position
          ));
        END IF;

        -- Derivação da letra correta (para o derived_key) — só tenta se o
        -- shape básico (4 chaves certas) é válido; com shape quebrado não dá
        -- pra confiar em nenhuma leitura de option_map->>letter.
        SELECT letter INTO v_correct_letter
        FROM unnest(ARRAY['A', 'B', 'C', 'D']) letter
        JOIN public.question_options qo
          ON qo.question_id = v_item.question_id
         AND qo.id::text = (v_item.option_map ->> letter)
        WHERE qo.is_correct = true
        LIMIT 1;

        IF v_correct_letter IS NULL THEN
          v_problems := array_append(v_problems, format(
            'Posição %s: nenhuma das 4 alternativas mapeadas é a alternativa correta da questão — não é possível derivar o gabarito.',
            v_item.position
          ));
        END IF;
      END IF;

      v_derived_parts := array_append(v_derived_parts, format('%s:%s', v_item.position, COALESCE(v_correct_letter, '?')));

      -- Comparação posição a posição contra o gabarito impresso (p_key)
      IF v_expected_map ? v_item.position::text THEN
        v_expected_letter := v_expected_map ->> v_item.position::text;
        IF v_correct_letter IS DISTINCT FROM v_expected_letter THEN
          v_problems := array_append(v_problems, format(
            'Posição %s: gabarito impresso diz %s, mas o mapa do caderno produz %s.',
            v_item.position, v_expected_letter, COALESCE(v_correct_letter, '(indeterminado)')
          ));
        END IF;
      END IF;
    END;
  END LOOP;

  -- Posições que aparecem no gabarito impresso mas não têm item no caderno
  -- (ex.: p_key com N diferente do caderno) — sem isso, uma divergência de
  -- tamanho passaria batido pelo loop acima, que só varre os itens que existem.
  IF v_expected_map <> '{}'::jsonb THEN
    FOR v_pos IN SELECT (jsonb_object_keys(v_expected_map))::int LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.presencial_caderno_items
        WHERE caderno_id = p_caderno_id AND position = v_pos
      ) THEN
        v_problems := array_append(v_problems, format(
          'Posição %s existe no gabarito impresso, mas não há item nessa posição neste caderno.', v_pos
        ));
      END IF;
    END LOOP;
  END IF;

  v_derived_key := array_to_string(v_derived_parts, ',');

  RETURN jsonb_build_object(
    'ok', COALESCE(array_length(v_problems, 1), 0) = 0,
    'problems', to_jsonb(v_problems),
    'derived_key', v_derived_key
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.verify_caderno_map(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_caderno_map(uuid, text) TO service_role;
