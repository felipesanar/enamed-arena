DELETE FROM public.question_options WHERE question_id IN (SELECT id FROM public.questions WHERE simulado_id = '39d0dbda-4d55-498b-8736-2b07e72323b9');
DELETE FROM public.questions WHERE simulado_id = '39d0dbda-4d55-498b-8736-2b07e72323b9';
UPDATE public.simulados SET questions_count = 0 WHERE id = '39d0dbda-4d55-498b-8736-2b07e72323b9';