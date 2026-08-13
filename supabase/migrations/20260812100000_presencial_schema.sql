-- Aplicação presencial: schema base.
-- attempt_type ganha 'presencial'; 3 tabelas novas (sala, submissão, duplicatas)
-- e a tabela de backup das respostas online supersedidas pela conversão.
-- RLS ligada e SEM policy: acesso só por service_role e RPC SECURITY DEFINER.

-- ─── attempts.attempt_type ────────────────────────────────────────────────────
ALTER TABLE public.attempts DROP CONSTRAINT IF EXISTS attempts_attempt_type_check;
ALTER TABLE public.attempts
  ADD CONSTRAINT attempts_attempt_type_check
  CHECK (attempt_type IN ('online', 'offline', 'presencial'));

-- ─── Backup das respostas supersedidas ────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS backup;

CREATE TABLE IF NOT EXISTS backup.presencial_superseded_answers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id      uuid NOT NULL,
  user_id         uuid NOT NULL,
  simulado_id     uuid NOT NULL,
  answers         jsonb NOT NULL,
  previous_status text,
  previous_score  numeric(5,2),
  superseded_at   timestamptz NOT NULL DEFAULT now()
);

-- ─── Sala presencial (o que o QR aponta) ──────────────────────────────────────
CREATE TABLE public.presencial_sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  simulado_id uuid NOT NULL REFERENCES public.simulados(id) ON DELETE CASCADE,
  code        text NOT NULL UNIQUE,
  label       text NOT NULL,
  opens_at    timestamptz NOT NULL,
  closes_at   timestamptz NOT NULL,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT presencial_sessions_window_ck CHECK (closes_at > opens_at),
  CONSTRAINT presencial_sessions_code_ck   CHECK (code ~ '^[a-z0-9-]{3,32}$')
);

-- ─── Submissão do evento (escrita SEMPRE, vinculada ou não) ───────────────────
CREATE TABLE public.presencial_submissions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id          uuid NOT NULL REFERENCES public.presencial_sessions(id),
  simulado_id         uuid NOT NULL REFERENCES public.simulados(id),
  declared_name       text NOT NULL,
  declared_email      text NOT NULL,
  identification_path text NOT NULL
    CHECK (identification_path IN ('email_direct','name_suggestion','new_account','unlinked')),
  answers             jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_correct       integer,
  score_percentage    numeric(5,2),
  linked_user_id      uuid REFERENCES auth.users(id),
  linked_attempt_id   uuid REFERENCES public.attempts(id),
  status              text NOT NULL DEFAULT 'unlinked'
    CHECK (status IN ('linked','unlinked')),
  ip_hash             text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  submitted_at        timestamptz,
  linked_at           timestamptz
);

-- Um envio presencial por conta por simulado. É esta trava que implementa
-- "1 envio por conta, irreversível" da spec.
CREATE UNIQUE INDEX presencial_submissions_one_per_user_simulado
  ON public.presencial_submissions (linked_user_id, simulado_id)
  WHERE linked_user_id IS NOT NULL;

CREATE INDEX presencial_submissions_pending_idx
  ON public.presencial_submissions (status, created_at DESC);

-- ─── Pares de possível duplicata (subproduto do desempate por nome) ───────────
CREATE TABLE public.presencial_duplicate_candidates (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        uuid NOT NULL REFERENCES public.presencial_sessions(id),
  submission_id     uuid REFERENCES public.presencial_submissions(id) ON DELETE CASCADE,
  candidate_user_id uuid NOT NULL REFERENCES auth.users(id),
  chosen            boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- ─── RLS: ligada, sem policy ──────────────────────────────────────────────────
ALTER TABLE public.presencial_sessions             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presencial_submissions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presencial_duplicate_candidates ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.presencial_sessions             FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.presencial_submissions          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.presencial_duplicate_candidates FROM PUBLIC, anon, authenticated;
