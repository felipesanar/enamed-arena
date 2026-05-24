-- Normaliza questions.area do Simulado 2 para as 5 Grandes Áreas canônicas
-- (padrão Simulado 1 / ENAMED): Clínica Médica, Cirurgia, Ginecologia e
-- Obstetrícia, Pediatria, Preventiva.
--
-- Não toca em answers/attempts/attempt_question_results — a relação dessas
-- tabelas é por question_id, não pelo nome da área. Para auditoria, criamos
-- uma tabela de backup com snapshot pré/pós-update.

CREATE TABLE IF NOT EXISTS public._questions_area_backup_20260522 (
  question_id uuid PRIMARY KEY,
  area_before text NOT NULL,
  area_after text,
  backed_up_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public._questions_area_backup_20260522 (question_id, area_before)
SELECT id, area FROM public.questions
ON CONFLICT (question_id) DO NOTHING;

WITH updates AS (
  SELECT q.id,
    CASE TRIM(q.area)
      WHEN 'Cirurgia geral'                     THEN 'Cirurgia'
      WHEN 'Otorrinolaringologia'               THEN 'Cirurgia'
      WHEN 'Oftalmologia'                       THEN 'Cirurgia'
      WHEN 'Urologia'                           THEN 'Cirurgia'
      WHEN 'Coloproctologia'                    THEN 'Cirurgia'
      WHEN 'Trauma'                             THEN 'Cirurgia'
      WHEN 'Ginecologia'                        THEN 'Ginecologia e Obstetrícia'
      WHEN 'Obstetrícia'                        THEN 'Ginecologia e Obstetrícia'
      WHEN 'Saúde Mental'                       THEN 'Clínica Médica'
      WHEN 'Medicina da Família e Comunidade'   THEN 'Preventiva'
      ELSE TRIM(q.area)
    END AS new_area
  FROM public.questions q
)
UPDATE public.questions q
SET area = u.new_area
FROM updates u
WHERE q.id = u.id
  AND q.area IS DISTINCT FROM u.new_area;

UPDATE public._questions_area_backup_20260522 b
SET area_after = q.area
FROM public.questions q
WHERE q.id = b.question_id AND b.area_after IS NULL;
