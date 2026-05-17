DELETE FROM public.answers WHERE attempt_id IN (SELECT id FROM public.attempts WHERE simulado_id IN ('b9e783a1-f178-4c45-9d15-efb2bb0f32a5','39d0dbda-4d55-498b-8736-2b07e72323b9'))
   OR question_id IN (SELECT id FROM public.questions WHERE simulado_id IN ('b9e783a1-f178-4c45-9d15-efb2bb0f32a5','39d0dbda-4d55-498b-8736-2b07e72323b9'));
DELETE FROM public.attempt_question_results WHERE attempt_id IN (SELECT id FROM public.attempts WHERE simulado_id IN ('b9e783a1-f178-4c45-9d15-efb2bb0f32a5','39d0dbda-4d55-498b-8736-2b07e72323b9'))
   OR question_id IN (SELECT id FROM public.questions WHERE simulado_id IN ('b9e783a1-f178-4c45-9d15-efb2bb0f32a5','39d0dbda-4d55-498b-8736-2b07e72323b9'));
DELETE FROM public.attempt_processing_queue WHERE attempt_id IN (SELECT id FROM public.attempts WHERE simulado_id IN ('b9e783a1-f178-4c45-9d15-efb2bb0f32a5','39d0dbda-4d55-498b-8736-2b07e72323b9'));
DELETE FROM public.user_performance_history WHERE simulado_id IN ('b9e783a1-f178-4c45-9d15-efb2bb0f32a5','39d0dbda-4d55-498b-8736-2b07e72323b9');
DELETE FROM public.error_notebook WHERE simulado_id IN ('b9e783a1-f178-4c45-9d15-efb2bb0f32a5','39d0dbda-4d55-498b-8736-2b07e72323b9')
   OR question_id IN (SELECT id FROM public.questions WHERE simulado_id IN ('b9e783a1-f178-4c45-9d15-efb2bb0f32a5','39d0dbda-4d55-498b-8736-2b07e72323b9'));
DELETE FROM public.attempts WHERE simulado_id IN ('b9e783a1-f178-4c45-9d15-efb2bb0f32a5','39d0dbda-4d55-498b-8736-2b07e72323b9');
DELETE FROM public.question_options WHERE question_id IN (SELECT id FROM public.questions WHERE simulado_id IN ('b9e783a1-f178-4c45-9d15-efb2bb0f32a5','39d0dbda-4d55-498b-8736-2b07e72323b9'));
DELETE FROM public.questions WHERE simulado_id IN ('b9e783a1-f178-4c45-9d15-efb2bb0f32a5','39d0dbda-4d55-498b-8736-2b07e72323b9');
DELETE FROM public.simulados WHERE id IN ('b9e783a1-f178-4c45-9d15-efb2bb0f32a5','39d0dbda-4d55-498b-8736-2b07e72323b9');