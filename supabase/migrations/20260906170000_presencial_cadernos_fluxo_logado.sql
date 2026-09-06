-- Cadernos do presencial — v2, fluxo logado (contrato congelado):
-- docs/superpowers/specs/2026-09-06-presencial-cadernos-v2-fluxo-logado.md
--
-- Contexto: a v1 (edge function `presencial`, sem login) fica no código porém
-- inalcançável hoje — a sala `s7-presencial` foi desativada. A v2 aproveita o
-- fluxo logado que já existe para prova offline em papel
-- (create_offline_attempt_guarded → AnswerSheetPage → submit_offline_answers_guarded,
-- ambas em 20260404180000_offline_exam_mode.sql) e só acrescenta o que falta:
-- o aluno escolher o caderno e a grade ser montada NA ORDEM IMPRESSA daquele
-- caderno, sem nunca vazar enunciado/alternativa/explanation/imagem. O modelo
-- de dados de cadernos (presencial_cadernos / presencial_caderno_items /
-- verify_caderno_map / activate_caderno, 20260906150000..150200) já está em
-- produção e é agnóstico de fluxo — nada dele muda aqui.
--
-- submit_offline_answers_guarded continua recebendo (question_id,
-- selected_option_id) REAIS e não muda: o caderno é só uma lente na hora de
-- montar a grade, nunca no envio.

-- ─── 1. attempts.caderno_id ─────────────────────────────────────────────────
-- Presencial = attempt offline COM caderno; offline de casa (sem QR/caderno)
-- = attempt offline SEM caderno. É assim que a modalidade fica distinguível
-- em relatórios sem precisar inventar um attempt_type novo.
ALTER TABLE public.attempts
  ADD COLUMN IF NOT EXISTS caderno_id uuid REFERENCES public.presencial_cadernos(id);

-- ─── 2. list_active_cadernos ────────────────────────────────────────────────
-- Lista os cadernos ativos de um simulado para a Tela 0 do gabarito ("Qual
-- caderno você recebeu?"). Só is_active=true — um caderno importado mas ainda
-- não verificado/ativado (ver verify_caderno_map) não pode aparecer para o
-- aluno escolher. Devolve só code/label/color: nada aqui precisa saber de
-- questão ou alternativa.
CREATE OR REPLACE FUNCTION public.list_active_cadernos(p_simulado_id uuid)
RETURNS TABLE(
  code  text,
  label text,
  color text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT c.code, c.label, c.color
  FROM public.presencial_cadernos c
  WHERE c.simulado_id = p_simulado_id
    AND c.is_active = true
  ORDER BY c.code;
$function$;

REVOKE ALL ON FUNCTION public.list_active_cadernos(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_active_cadernos(uuid) TO authenticated, service_role;

-- ─── 3. get_caderno_skeleton ────────────────────────────────────────────────
-- Monta o esqueleto (position → question_id + as 4 option_id na ORDEM
-- IMPRESSA A/B/C/D) que o front usa para renderizar a AnswerSheetGrid com a
-- numeração do caderno físico. NUNCA seleciona enunciado, texto de
-- alternativa, explanation ou image_url — só ids e posição: o aluno não pode
-- ganhar nenhuma pista, e a superfície de dados exposta por uma RPC
-- SECURITY DEFINER tem que ser deliberadamente mínima.
--
-- Guarda de completude: se o caderno ativo tiver um número de itens diferente
-- do número de questões do simulado, devolvemos 0 LINHAS — nunca um
-- esqueleto parcial. Um esqueleto de 99 questões (faltando 1) faria o aluno
-- preencher os ~15 minutos da prova normalmente e só descobrir no envio que
-- foi recusado; 0 linhas aciona o estado de erro imediato do front
-- ("Caderno indisponível. Chame o fiscal.") antes de ele perder tempo.
-- Na prática isso não deveria disparar nunca, porque activate_caderno já roda
-- essa mesma invariante (verify_caderno_map, invariante 1) antes de permitir
-- is_active=true — mas checar de novo aqui é barato e é a última linha de
-- defesa contra um caderno que virou incompleto depois de ativado (ex.: uma
-- questão do simulado removida/trocada após a ativação).
-- "position" ENTRE ASPAS: é palavra-chave do Postgres (col_name_keyword) e não
-- passa como nome de parâmetro OUT sem quoting — sem as aspas a migration
-- morre com 42601 "syntax error at or near position". O nome da coluna de
-- saída continua sendo `position`, então o contrato com o front não muda.
CREATE OR REPLACE FUNCTION public.get_caderno_skeleton(p_simulado_id uuid, p_caderno_code text)
RETURNS TABLE(
  "position"  int,
  question_id uuid,
  option_a    uuid,
  option_b    uuid,
  option_c    uuid,
  option_d    uuid
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caderno         public.presencial_cadernos%ROWTYPE;
  v_items_count     integer;
  v_questions_count integer;
BEGIN
  SELECT * INTO v_caderno
  FROM public.presencial_cadernos c
  WHERE c.simulado_id = p_simulado_id
    AND c.code = p_caderno_code
    AND c.is_active = true;

  IF NOT FOUND THEN
    RETURN; -- 0 linhas: caderno inexistente/inativo para este simulado
  END IF;

  SELECT count(*) INTO v_items_count
  FROM public.presencial_caderno_items i
  WHERE i.caderno_id = v_caderno.id;

  SELECT count(*) INTO v_questions_count
  FROM public.questions q
  WHERE q.simulado_id = p_simulado_id;

  IF v_items_count <> v_questions_count THEN
    RETURN; -- 0 linhas: guarda de completude, ver comentário acima
  END IF;

  RETURN QUERY
  SELECT
    i.position,
    i.question_id,
    (i.option_map ->> 'A')::uuid,
    (i.option_map ->> 'B')::uuid,
    (i.option_map ->> 'C')::uuid,
    (i.option_map ->> 'D')::uuid
  FROM public.presencial_caderno_items i
  WHERE i.caderno_id = v_caderno.id
  ORDER BY i.position;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_caderno_skeleton(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_caderno_skeleton(uuid, text) TO authenticated, service_role;

-- ─── 4. set_attempt_caderno_guarded ─────────────────────────────────────────
-- Trava o attempt offline_pending do aluno num caderno escolhido. Idempotente
-- de propósito: o aluno pode errar a escolha e trocar de caderno enquanto o
-- envio não aconteceu ("Não é este caderno?" no front, que também limpa as
-- marcações — isso é responsabilidade do front, não desta RPC).
--
-- Confirmado antes de escrever: o trigger trg_prevent_direct_attempts_update
-- (public.prevent_direct_attempts_update, 20260605120000) só bloqueia UPDATE
-- em attempts vindo de sessão de cliente comum; ele libera a escrita quando
-- current_user IN ('postgres', ...) — que é o caso aqui, porque esta função é
-- SECURITY DEFINER com dono postgres (mesmo mecanismo de
-- create_offline_attempt_guarded / submit_offline_answers_guarded). Também
-- não bloqueia a coluna caderno_id especificamente (só score/status/
-- finished_at/is_within_window/user_id/simulado_id), então o UPDATE abaixo
-- passa por esse trigger sem precisar de tratamento especial.
CREATE OR REPLACE FUNCTION public.set_attempt_caderno_guarded(p_attempt_id uuid, p_caderno_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_attempt public.attempts%ROWTYPE;
  v_caderno public.presencial_cadernos%ROWTYPE;
BEGIN
  -- Lock: só o dono do attempt pode escolher/trocar o caderno dele.
  SELECT * INTO v_attempt
  FROM public.attempts
  WHERE id = p_attempt_id
    AND user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ATTEMPT_NOT_FOUND';
  END IF;

  -- Só pode escolher/trocar caderno antes do envio — depois de enviado o
  -- gabarito já foi corrigido contra o caderno gravado, trocar retroativamente
  -- corromperia a nota em silêncio.
  IF v_attempt.status <> 'offline_pending' THEN
    RAISE EXCEPTION 'ATTEMPT_NOT_PENDING';
  END IF;

  -- O caderno tem que estar ativo E pertencer ao mesmo simulado do attempt —
  -- sem o segundo filtro, um code repetido entre simulados (ex.: "vermelho")
  -- travaria o attempt no caderno errado.
  SELECT * INTO v_caderno
  FROM public.presencial_cadernos c
  WHERE c.simulado_id = v_attempt.simulado_id
    AND c.code = p_caderno_code
    AND c.is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CADERNO_UNAVAILABLE';
  END IF;

  UPDATE public.attempts
  SET caderno_id = v_caderno.id
  WHERE id = p_attempt_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.set_attempt_caderno_guarded(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_attempt_caderno_guarded(uuid, text) TO authenticated, service_role;
