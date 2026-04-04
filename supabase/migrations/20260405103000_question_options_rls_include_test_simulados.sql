-- Simulados com status 'test' (ex.: Simulado Teste) podem ser iniciados via create_attempt_guarded,
-- mas a política de question_options criada no hardening só permitia 'published', deixando options vazias no cliente.

BEGIN;

DROP POLICY IF EXISTS "Authenticated can read options from published simulados" ON public.question_options;

CREATE POLICY "Authenticated can read options from published or test simulados"
  ON public.question_options
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.questions q
      JOIN public.simulados s ON s.id = q.simulado_id
      WHERE q.id = question_options.question_id
        AND s.status IN ('published', 'test')
    )
  );

COMMIT;
