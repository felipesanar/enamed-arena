-- Fix round 3/5 do review da Task 10 (Critical/Important remanescente do
-- teto por sessão introduzido no round 2).
--
-- O round 2 fechou a variante de "diferenciar by_area ENTRE submissões"
-- (múltiplos e-mails/IPs) com um teto de MAX_UNLINKED_PER_SESSION
-- submissões `unlinked` por sessão. Mas a contagem ("quantas unlinked já
-- existem?") e o INSERT da nova submissão aconteciam em duas chamadas
-- PostgREST separadas dentro do index.ts (SELECT count depois INSERT), sem
-- nenhum lock entre elas. O revisor apontou, corretamente, que o próprio
-- perfil de atacante que motiva este fix inteiro é alguém dispost a
-- automatizar e paralelizar — um script disparando dezenas de
-- `start-unlinked` concorrentes para a mesma sessão leria o mesmo `count`
-- defasado antes de qualquer INSERT commitar, e o teto estouraria por uma
-- fração relevante do lote, não por "alguns pontos" de ruído.
--
-- Fix: mover contagem + inserção para dentro desta função, serializadas por
-- `SELECT ... FROM presencial_sessions WHERE id = p_session_id FOR UPDATE`.
-- Chamadas concorrentes para a MESMA sessão bloqueiam nesse SELECT até a
-- transação anterior commitar (ou fazer rollback); a que destrava em
-- seguida enxerga, sob READ COMMITTED, o COUNT já incluindo o INSERT
-- committed pela chamada anterior — não há janela entre contar e inserir
-- porque as duas ações vivem dentro da MESMA transação implícita desta
-- única chamada de função (`.rpc()` do supabase-js = uma única invocação =
-- uma única transação, sem `BEGIN`/`COMMIT` explícito do lado do cliente).
-- Chamadas para sessões DIFERENTES não se bloqueiam entre si (o lock é por
-- linha de `presencial_sessions`, não global).
--
-- Não toca `presencial_sessions`, `admin_presencial_session_upsert` nem
-- qualquer outra RPC de admin de sessão — função nova, chamada só por
-- `supabase/functions/presencial/index.ts`.

CREATE OR REPLACE FUNCTION public.claim_presencial_unlinked_submission(
  p_session_id     uuid,
  p_simulado_id    uuid,
  p_declared_name  text,
  p_declared_email text,
  p_ip_hash        text,
  p_max_unlinked   integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer;
  v_id    uuid;
BEGIN
  -- Serializa por SESSÃO: qualquer chamada concorrente para o MESMO
  -- p_session_id bloqueia aqui até esta transação terminar. Se a sessão não
  -- existir (não deveria acontecer — index.ts já validou via
  -- loadOpenSession antes de chamar esta função), PERFORM simplesmente não
  -- trava nada e o INSERT abaixo falha por FK, o que é seguro.
  PERFORM 1 FROM public.presencial_sessions WHERE id = p_session_id FOR UPDATE;

  SELECT count(*) INTO v_count
  FROM public.presencial_submissions
  WHERE session_id = p_session_id AND status = 'unlinked';

  IF v_count >= p_max_unlinked THEN
    RAISE EXCEPTION 'PRESENCIAL_UNLINKED_CAP_REACHED';
  END IF;

  INSERT INTO public.presencial_submissions (
    session_id, simulado_id, declared_name, declared_email,
    identification_path, ip_hash, linked_user_id, linked_attempt_id, status
  )
  VALUES (
    p_session_id, p_simulado_id, p_declared_name, p_declared_email,
    'unlinked', p_ip_hash, NULL, NULL, 'unlinked'
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.claim_presencial_unlinked_submission(uuid, uuid, text, text, text, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_presencial_unlinked_submission(uuid, uuid, text, text, text, integer)
  TO service_role;
