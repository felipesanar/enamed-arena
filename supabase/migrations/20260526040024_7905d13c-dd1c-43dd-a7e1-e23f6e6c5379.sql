ALTER TABLE public.error_notebook
  ADD COLUMN IF NOT EXISTS chat_count integer NOT NULL DEFAULT 0;