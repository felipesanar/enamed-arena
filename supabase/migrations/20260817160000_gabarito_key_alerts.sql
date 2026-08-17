-- =====================================================================
-- gabarito_key_alerts — dedup dos alertas de suspeita de gabarito errado
-- =====================================================================
-- Ver docs/superpowers/specs/2026-08-17-blindagem-gabarito-design.md
--
-- A edge function `gabarito-key-alerts` roda 1x/dia e avisa quando o sinal
-- de distribuição aponta gabarito errado (taxa de acerto muito baixa +
-- maioria esmagadora numa outra alternativa). Sem esta tabela, o cron
-- reenviaria o MESMO alerta todos os dias até alguém corrigir a questão.
--
-- Uma linha por (simulado, questão) alertada. `resolved_at` é preenchido à
-- mão quando a suspeita foi analisada (corrigida ou descartada como falso
-- positivo) — enquanto for null, a questão não é realertada.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.gabarito_key_alerts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  simulado_id     uuid NOT NULL REFERENCES public.simulados(id) ON DELETE CASCADE,
  question_number integer NOT NULL,
  -- Snapshot do sinal no momento do alerta: sem isso não há como auditar
  -- depois por que a questão foi (ou não foi) apontada.
  correct_rate    numeric,
  top_wrong_label text,
  top_wrong_pct   numeric,
  total_responses integer,
  alerted_at      timestamptz NOT NULL DEFAULT now(),
  resolved_at     timestamptz,
  CONSTRAINT gabarito_key_alerts_unique_question UNIQUE (simulado_id, question_number)
);

CREATE INDEX IF NOT EXISTS gabarito_key_alerts_open_idx
  ON public.gabarito_key_alerts (simulado_id)
  WHERE resolved_at IS NULL;

ALTER TABLE public.gabarito_key_alerts ENABLE ROW LEVEL SECURITY;

-- Só admin lê/escreve pela API. A edge function roda com service_role, que
-- bypassa RLS por definição — não precisa de policy própria.
DROP POLICY IF EXISTS "Admins podem ver alertas de gabarito" ON public.gabarito_key_alerts;
CREATE POLICY "Admins podem ver alertas de gabarito"
  ON public.gabarito_key_alerts
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins podem resolver alertas de gabarito" ON public.gabarito_key_alerts;
CREATE POLICY "Admins podem resolver alertas de gabarito"
  ON public.gabarito_key_alerts
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- [grant-hygiene] Sem acesso anônimo. Ver memória hardening-grants-supabase.
REVOKE ALL ON TABLE public.gabarito_key_alerts FROM PUBLIC;
REVOKE ALL ON TABLE public.gabarito_key_alerts FROM anon;
GRANT SELECT, UPDATE ON TABLE public.gabarito_key_alerts TO authenticated;
GRANT ALL ON TABLE public.gabarito_key_alerts TO service_role;

COMMENT ON TABLE public.gabarito_key_alerts IS
  'Dedup dos alertas de suspeita de gabarito errado (edge function gabarito-key-alerts). resolved_at null = suspeita aberta, não realertar.';

-- =====================================================================
-- gabarito_key_stats — agregação mínima para o alerta agendado
-- =====================================================================
-- Por que não reusar `admin_simulado_question_stats`: aquele RPC começa com
-- `perform public.admin_require('content.manage')`, que depende de auth.uid().
-- A edge function agendada roda com service_role, FORA de um contexto de
-- usuário — não tem auth.uid() e o admin_require rejeitaria.
--
-- Esta função devolve só os 4 números de que o sinal precisa, com a MESMA
-- base do RPC de admin (tentativas `submitted` e `is_within_window`, para não
-- contaminar com treino). O índice de discriminação não entra: na UI ele é só
-- reforço textual, não faz parte do critério.
--
-- Os LIMIARES ficam do lado do chamador (edge function), não aqui — assim o
-- critério mora num lugar só por caminho, e a SQL fica sendo pura agregação.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.gabarito_key_stats(p_simulado_id uuid)
RETURNS TABLE(
  question_number integer,
  correct_rate numeric,
  top_wrong_label text,
  top_wrong_pct numeric,
  total_responses bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH valid AS (
    SELECT id FROM attempts
     WHERE simulado_id = p_simulado_id
       AND status = 'submitted'
       AND is_within_window = true
  ),
  results AS (
    SELECT aqr.question_id, aqr.is_correct, aqr.was_answered, aqr.selected_option_id
      FROM attempt_question_results aqr
      JOIN valid v ON v.id = aqr.attempt_id
  ),
  per_question AS (
    SELECT r.question_id,
           count(*) FILTER (WHERE r.was_answered) AS answered,
           count(*) FILTER (WHERE r.is_correct)   AS correct
      FROM results r GROUP BY r.question_id
  ),
  wrong_ranked AS (
    SELECT r.question_id, qo.label, count(*) AS cnt,
           ROW_NUMBER() OVER (PARTITION BY r.question_id ORDER BY count(*) DESC) AS rn
      FROM results r
      JOIN question_options qo ON qo.id = r.selected_option_id
     WHERE r.is_correct = false AND r.was_answered = true
     GROUP BY r.question_id, qo.label
  )
  SELECT q.question_number,
         COALESCE(ROUND(pq.correct::numeric / NULLIF(pq.answered, 0) * 100, 1), 0) AS correct_rate,
         tw.label AS top_wrong_label,
         CASE WHEN tw.cnt IS NOT NULL AND pq.answered > 0
              THEN ROUND(tw.cnt::numeric / pq.answered * 100, 1) END AS top_wrong_pct,
         COALESCE(pq.answered, 0) AS total_responses
    FROM questions q
    LEFT JOIN per_question pq ON pq.question_id = q.id
    LEFT JOIN wrong_ranked tw ON tw.question_id = q.id AND tw.rn = 1
   WHERE q.simulado_id = p_simulado_id
   ORDER BY q.question_number;
$function$;

-- [grant-hygiene] Só a função agendada (service_role) precisa disso. O admin
-- usa `admin_simulado_question_stats`, que já é gated por capability.
REVOKE ALL ON FUNCTION public.gabarito_key_stats(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gabarito_key_stats(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.gabarito_key_stats(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.gabarito_key_stats(uuid) TO service_role;
