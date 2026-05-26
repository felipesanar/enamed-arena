-- =====================================================================
-- Rate limit do chat do Prof. San por questão do caderno
-- =====================================================================
-- Cada usuário tem um limite fixo de interações com o Prof. San por
-- entrada do caderno. O contador é decrementado a cada resposta bem
-- sucedida da edge function gemini-error-notebook-chat e é zerado se
-- a entry for excluída/recriada.
--
-- O limite atual padrão é 10 (ver CHAT_LIMIT_PER_ENTRY no edge function).
-- Pra "resetar" a conversa de uma questão, o aluno pode marcar como
-- pendente e dominar de novo, ou simplesmente esperar 24h se quisermos
-- janela rotativa no futuro (não implementado por enquanto).
-- =====================================================================

ALTER TABLE public.error_notebook
  ADD COLUMN IF NOT EXISTS chat_count integer NOT NULL DEFAULT 0;
