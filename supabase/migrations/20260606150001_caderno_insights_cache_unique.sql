-- ============================================================
-- Migração: UNIQUE index em caderno_pattern_insights_cache.user_id
-- Necessário para que o upsert { onConflict: 'user_id' } da edge
-- function caderno-pattern-insights funcione corretamente.
--
-- Estratégia idempotente:
--   1. Deduplica: mantém a linha mais recente por user_id,
--      deleta as demais (caso existam duplicatas acidentais).
--   2. Cria o índice UNIQUE IF NOT EXISTS — seguro re-executar.
-- ============================================================

BEGIN;

-- Passo 1: deduplicar — manter apenas a linha mais recente por user_id
DELETE FROM public.caderno_pattern_insights_cache
WHERE id IN (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY user_id
        ORDER BY generated_at DESC NULLS LAST, id DESC
      ) AS rn
    FROM public.caderno_pattern_insights_cache
  ) ranked
  WHERE rn > 1
);

-- Passo 2: criar índice UNIQUE (idempotente via IF NOT EXISTS)
CREATE UNIQUE INDEX IF NOT EXISTS uq_caderno_pattern_insights_cache_user
  ON public.caderno_pattern_insights_cache (user_id);

COMMIT;
