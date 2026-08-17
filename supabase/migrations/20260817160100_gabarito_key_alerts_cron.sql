-- =====================================================================
-- Agendamento do alerta de suspeita de gabarito errado
-- =====================================================================
-- Agenda a edge function `gabarito-key-alerts` para rodar 1x/dia às
-- 09:00 BRT (= 12:00 UTC), via pg_cron + pg_net, no mesmo padrão de
-- 20260607140000_caderno_reminders_cron.sql.
--
-- ---------------------------------------------------------------------
-- PRÉ-REQUISITOS — devem ser habilitados pelo time (NÃO assumidos aqui)
-- ---------------------------------------------------------------------
--   * Extensão `pg_cron`
--   * Extensão `pg_net`
--   * Secret `NOVU_RELAY_SECRET` no Vault (mesmo valor da edge function)
--   * Secret `GABARITO_ALERT_EMAILS` nas Edge Functions (destinatários)
--
-- Sem qualquer um deles, a migration NÃO falha: emite RAISE WARNING e não
-- cria o agendamento. Idempotente (desagenda antes de reagendar).
--
-- ATENÇÃO — a lição do caderno-reminders: aquele scaffold foi mergeado em
-- 2026-06 e nunca foi configurado, então nunca disparou. Se este também
-- não for configurado, o alerta por e-mail não existe na prática — as
-- superfícies dentro do /admin continuam sendo a defesa real.
-- =====================================================================

DO $$
DECLARE
  v_has_cron boolean;
  v_has_net  boolean;
  v_project_ref text := 'lljnbysgcwvkhlnaqxtt';
  v_fn_url   text;
  v_relay_secret text;
BEGIN
  SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') INTO v_has_cron;
  SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net')  INTO v_has_net;

  IF NOT v_has_cron OR NOT v_has_net THEN
    RAISE WARNING
      '[gabarito-key-alerts-cron] pg_cron (%) / pg_net (%) ausentes — agendamento NÃO criado. Habilitar as extensões e re-rodar esta migration.',
      v_has_cron, v_has_net;
    RETURN;
  END IF;

  v_fn_url := 'https://' || v_project_ref || '.supabase.co/functions/v1/gabarito-key-alerts';

  BEGIN
    SELECT decrypted_secret INTO v_relay_secret
      FROM vault.decrypted_secrets
     WHERE name = 'NOVU_RELAY_SECRET'
     LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_relay_secret := NULL; -- vault indisponível neste ambiente
  END;

  IF v_relay_secret IS NULL THEN
    RAISE WARNING
      '[gabarito-key-alerts-cron] Secret NOVU_RELAY_SECRET não encontrado no Vault — agendamento NÃO criado. Cadastrá-lo e re-rodar esta migration.';
    RETURN;
  END IF;

  PERFORM cron.unschedule('gabarito-key-alerts-daily')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'gabarito-key-alerts-daily');

  -- 09:00 BRT = 12:00 UTC, todos os dias.
  PERFORM cron.schedule(
    'gabarito-key-alerts-daily',
    '0 12 * * *',
    format($job$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-internal-secret', %L
        ),
        body := jsonb_build_object('source', 'pg_cron')
      );
    $job$, v_fn_url, v_relay_secret)
  );

  RAISE NOTICE '[gabarito-key-alerts-cron] Job agendado: 0 12 * * * (09:00 BRT) → %', v_fn_url;
END;
$$;
