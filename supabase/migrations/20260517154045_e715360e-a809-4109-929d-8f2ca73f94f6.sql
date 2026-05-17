INSERT INTO public.simulados (title, slug, sequence_number, description, duration_minutes, execution_window_start, execution_window_end, results_release_at, status)
VALUES (
  'DEBUG Upload Imagens ' || to_char(now(), 'YYYY-MM-DD HH24:MI'),
  'debug-upload-imagens-' || extract(epoch from now())::bigint,
  999,
  'Simulado descartavel para debug do pipeline de upload de imagens',
  300,
  now() + interval '7 days',
  now() + interval '7 days 5 hours',
  now() + interval '8 days',
  'test'
);