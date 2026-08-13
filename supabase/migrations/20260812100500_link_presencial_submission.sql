-- Vínculo tardio de submissão presencial (fila de identidade do admin) e
-- bucket de rate limit do fluxo presencial.
--
-- link_presencial_submission: quando a identificação automática não fecha no
-- dia da prova (e-mail errado, sem conta, desistiu), a submissão fica salva
-- como não vinculada (nome/e-mail auto-declarados). Um humano na fila do
-- admin resolve depois a conta certa e chama esta RPC, que reusa o mesmo
-- caminho de criação/conversão + gravação + finalização já usado no fluxo
-- em tempo real (create_or_convert_presencial_attempt + submit_presencial_answers),
-- para que a nota entre no histórico e no ranking do aluno exatamente como
-- se ele tivesse se identificado corretamente no momento da prova.
--
-- bump_presencial_bucket: rate limit do fluxo presencial (check-in por IP,
-- check-in por e-mail, busca de nome por IP). Mesma tabela e mesma mecânica
-- de janela rolante de bump_guest_signup_bucket (capturado via
-- pg_get_functiondef em produção antes de escrever esta função) — apenas o
-- bucket_type muda. guest_signup_rate_limit não tem CHECK restringindo
-- bucket_type (PK é (bucket_type, bucket_key)), então não há necessidade de
-- ampliar constraint nenhuma.

CREATE OR REPLACE FUNCTION public.link_presencial_submission(
  p_submission_id uuid,
  p_user_id       uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_sub     public.presencial_submissions%ROWTYPE;
  v_attempt uuid;
  v_res     jsonb;
BEGIN
  SELECT * INTO v_sub FROM public.presencial_submissions
  WHERE id = p_submission_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SUBMISSION_NOT_FOUND';
  END IF;
  IF v_sub.status = 'linked' THEN
    RAISE EXCEPTION 'SUBMISSION_ALREADY_LINKED';
  END IF;
  IF jsonb_array_length(COALESCE(v_sub.answers, '[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'SUBMISSION_HAS_NO_ANSWERS';
  END IF;

  v_attempt := public.create_or_convert_presencial_attempt(v_sub.simulado_id, p_user_id);
  v_res     := public.submit_presencial_answers(v_attempt, p_user_id, v_sub.answers);

  UPDATE public.presencial_submissions SET
    linked_user_id    = p_user_id,
    linked_attempt_id = v_attempt,
    status            = 'linked',
    linked_at         = now()
  WHERE id = p_submission_id;

  RETURN v_res;
END;
$function$;

REVOKE ALL ON FUNCTION public.link_presencial_submission(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.link_presencial_submission(uuid, uuid) TO service_role;

-- ─── Rate limit do fluxo presencial ────────────────────────────────────────
-- Espelha bump_guest_signup_bucket linha a linha (mesma tabela
-- guest_signup_rate_limit, mesmo upsert com janela rolante, mesmo retorno do
-- contador pós-incremento); só existe como função separada porque o nome
-- guest_signup_* é do fluxo de cadastro de visitante, semanticamente
-- diferente do check-in presencial.

CREATE OR REPLACE FUNCTION public.bump_presencial_bucket(
  p_bucket_type text,
  p_bucket_key  text,
  p_window_ms   integer DEFAULT 3600000
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_now timestamptz := now();
  v_attempts int;
  v_window_interval interval := make_interval(secs => p_window_ms / 1000);
BEGIN
  INSERT INTO public.guest_signup_rate_limit (bucket_type, bucket_key, attempts, window_start, last_event_at)
  VALUES (p_bucket_type, p_bucket_key, 1, v_now, v_now)
  ON CONFLICT (bucket_type, bucket_key) DO UPDATE
  SET
    attempts = CASE
      WHEN guest_signup_rate_limit.window_start + v_window_interval < v_now THEN 1
      ELSE guest_signup_rate_limit.attempts + 1
    END,
    window_start = CASE
      WHEN guest_signup_rate_limit.window_start + v_window_interval < v_now THEN v_now
      ELSE guest_signup_rate_limit.window_start
    END,
    last_event_at = v_now
  RETURNING attempts INTO v_attempts;

  RETURN v_attempts;
END;
$function$;

REVOKE ALL ON FUNCTION public.bump_presencial_bucket(text, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bump_presencial_bucket(text, text, integer) TO service_role;
