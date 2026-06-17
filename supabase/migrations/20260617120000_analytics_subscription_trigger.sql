-- =====================================================================
-- Fase 2, passo 7: captura server-side de mudanças de segment/assinatura
-- Trigger em profiles.segment — imune a falha de cliente.
-- =====================================================================

CREATE OR REPLACE FUNCTION _analytics_on_segment_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.segment IS DISTINCT FROM NEW.segment THEN
    INSERT INTO analytics_events (user_id, event_name, payload)
    VALUES (
      NEW.id,
      'subscription_changed',
      jsonb_build_object(
        'old_segment', OLD.segment,
        'new_segment', NEW.segment,
        'server_side', true
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_analytics_segment_change ON profiles;
CREATE TRIGGER trg_analytics_segment_change
  AFTER UPDATE OF segment ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION _analytics_on_segment_change();
