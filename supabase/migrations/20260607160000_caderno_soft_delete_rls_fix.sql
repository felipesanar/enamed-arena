-- Caderno v2 — fix: soft-delete bloqueado por RLS (user_notes, flashcards, decks).
--
-- Problema: as policies de SELECT dessas tabelas incluíam `deleted_at IS NULL`.
-- No Postgres, um UPDATE precisa que a linha resultante continue satisfazendo a
-- policy de SELECT; ao marcar `deleted_at` (soft-delete), a nova linha deixava de
-- satisfazer (`deleted_at` não-nulo) e o UPDATE era rejeitado com
-- 42501 "new row violates row-level security policy". Isso quebrava excluir
-- anotações, flashcards e decks pela UI.
--
-- Correção: remover `deleted_at IS NULL` do RLS de SELECT (mantendo owner-scope
-- `auth.uid() = user_id`). As queries do app já filtram `deleted_at IS NULL`
-- no client (listNotes / listFlashcards / listDecks / getDueFlashcards), então
-- itens excluídos continuam ocultos na UI. INSERT/UPDATE/DELETE policies
-- permanecem inalteradas (owner-only).
--
-- Aplicado no remoto via migration `caderno_soft_delete_rls_fix`.

alter policy user_notes_select_own on public.user_notes using (auth.uid() = user_id);
alter policy flashcards_select_own on public.flashcards using (auth.uid() = user_id);
alter policy decks_select_own     on public.decks     using (auth.uid() = user_id);
