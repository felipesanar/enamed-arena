-- =====================================================================
-- Cache de revisão IA por entrada do caderno de erros
-- =====================================================================
-- O modo de revisão guiada (/caderno-erros/revisao) chama a edge function
-- gemini-error-notebook-review pra gerar uma análise personalizada da
-- questão. Pra não regenerar a cada visita (e gastar tokens à toa),
-- cacheamos o markdown direto na entrada.
--
-- Quem invalida o cache: se o aluno editar a anotação ou o reason no
-- futuro, é responsabilidade do call-site limpar ai_review_md e
-- ai_review_generated_at. Por ora, esses campos são imutáveis após o
-- insert no caderno.
-- =====================================================================

ALTER TABLE public.error_notebook
  ADD COLUMN IF NOT EXISTS ai_review_md text,
  ADD COLUMN IF NOT EXISTS ai_review_generated_at timestamptz;
