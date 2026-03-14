
ALTER TABLE public.error_notebook 
  ADD COLUMN IF NOT EXISTS question_number integer,
  ADD COLUMN IF NOT EXISTS question_text text,
  ADD COLUMN IF NOT EXISTS simulado_title text;
