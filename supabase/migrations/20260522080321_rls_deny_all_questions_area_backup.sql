-- Bloqueia acesso público à tabela interna de backup. Nenhuma policy
-- significa deny-all via PostgREST. SECURITY DEFINER funcs e service role
-- continuam podendo acessar.
ALTER TABLE public._questions_area_backup_20260522 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public._questions_area_backup_20260522 FROM anon, authenticated;
