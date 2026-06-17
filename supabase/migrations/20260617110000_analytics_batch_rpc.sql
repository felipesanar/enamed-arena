-- =====================================================================
-- Fase 2, passo 4: RPC em lote para flush resiliente da fila
-- Recebe um array de eventos em JSONB; insere todos com dedup.
-- =====================================================================
CREATE OR REPLACE FUNCTION log_analytics_events(events jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ev jsonb;
BEGIN
  FOR ev IN SELECT * FROM jsonb_array_elements(events)
  LOOP
    CONTINUE WHEN (ev->>'event_name') IS NULL OR trim(ev->>'event_name') = '';

    IF (ev->>'event_id') IS NOT NULL THEN
      INSERT INTO analytics_events
        (user_id, event_name, payload, event_id, client_timestamp, route)
      VALUES
        (auth.uid(),
         ev->>'event_name',
         COALESCE((ev->'payload')::jsonb, '{}'),
         ev->>'event_id',
         (ev->>'client_timestamp')::timestamptz,
         ev->>'route')
      ON CONFLICT (event_id) WHERE event_id IS NOT NULL
      DO NOTHING;
    ELSE
      INSERT INTO analytics_events
        (user_id, event_name, payload, client_timestamp, route)
      VALUES
        (auth.uid(),
         ev->>'event_name',
         COALESCE((ev->'payload')::jsonb, '{}'),
         (ev->>'client_timestamp')::timestamptz,
         ev->>'route');
    END IF;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION log_analytics_events(jsonb) TO authenticated, anon;
