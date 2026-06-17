-- =====================================================================
-- Fase 2, passo 3: Idempotência de eventos de analytics
-- Adiciona event_id (UUID cliente), client_timestamp e route.
-- Retry não duplica: ON CONFLICT (event_id) DO NOTHING.
-- =====================================================================

-- Novas colunas — nullable para não quebrar dados existentes.
ALTER TABLE analytics_events
  ADD COLUMN IF NOT EXISTS event_id          text,
  ADD COLUMN IF NOT EXISTS client_timestamp  timestamptz,
  ADD COLUMN IF NOT EXISTS route             text;

-- Índice único parcial: apenas linhas com event_id preenchido competem.
-- NULLs não conflitam (comportamento padrão UNIQUE em SQL).
CREATE UNIQUE INDEX IF NOT EXISTS analytics_events_event_id_uidx
  ON analytics_events (event_id)
  WHERE event_id IS NOT NULL;

-- Remove a assinatura antiga (2 parâmetros) para evitar ambiguidade no PostgREST.
-- A nova assinatura tem os mesmos 2 primeiros params + 3 opcionais com DEFAULT NULL,
-- então clientes antigos que passam apenas p_event_name/p_payload continuam funcionando.
DROP FUNCTION IF EXISTS log_analytics_event(text, jsonb);

-- Nova versão com suporte a dedup por event_id.
CREATE OR REPLACE FUNCTION log_analytics_event(
  p_event_name        text,
  p_payload           jsonb        DEFAULT '{}',
  p_event_id          text         DEFAULT NULL,
  p_client_timestamp  timestamptz  DEFAULT NULL,
  p_route             text         DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_event_name IS NULL OR trim(p_event_name) = '' THEN
    RETURN;
  END IF;

  IF p_event_id IS NOT NULL THEN
    -- Com event_id: insert idempotente. Retry não duplica.
    INSERT INTO analytics_events
      (user_id, event_name, payload, event_id, client_timestamp, route)
    VALUES
      (auth.uid(), p_event_name, COALESCE(p_payload, '{}'),
       p_event_id, p_client_timestamp, p_route)
    ON CONFLICT (event_id) WHERE event_id IS NOT NULL
    DO NOTHING;
  ELSE
    -- Sem event_id (caminho legado): insert simples, sem dedup.
    INSERT INTO analytics_events
      (user_id, event_name, payload, client_timestamp, route)
    VALUES
      (auth.uid(), p_event_name, COALESCE(p_payload, '{}'),
       p_client_timestamp, p_route);
  END IF;
END;
$$;

-- Grant na nova assinatura.
GRANT EXECUTE ON FUNCTION log_analytics_event(text, jsonb, text, timestamptz, text)
  TO authenticated, anon;
