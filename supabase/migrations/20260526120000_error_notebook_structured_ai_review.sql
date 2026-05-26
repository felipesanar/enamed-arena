-- =====================================================================
-- Análise IA estruturada do caderno de erros
-- =====================================================================
-- A edge function gemini-error-notebook-review passa a retornar um JSON
-- estruturado em vez de só markdown. Cacheamos os campos novos junto à
-- entrada pra evitar regenerar a cada visita.
--
-- Campos:
--   ai_practice           jsonb  { topic, area, theme, suggestedCount }
--                                Sugestão concreta de tópico pra treinar.
--                                Usado no CTA "Treinar N questões de X".
--   ai_option_rationales  jsonb  { "A": "...", "B": "...", ... }
--                                Explicação curta de por que cada
--                                alternativa errada está errada. Usado
--                                como tooltip nas alternativas C/D.
--
-- Ambos são opcionais (a IA pode falhar em extrair); o cliente trata
-- null gracefully.
-- =====================================================================

ALTER TABLE public.error_notebook
  ADD COLUMN IF NOT EXISTS ai_practice jsonb,
  ADD COLUMN IF NOT EXISTS ai_option_rationales jsonb;
