-- =====================================================================
-- Agendamento do lembrete diário do Caderno de Erros (plano 08 §3.1)
-- =====================================================================
-- Agenda a edge function `caderno-reminders` para rodar 1x/dia às
-- 08:00 BRT (= 11:00 UTC) via pg_cron + pg_net (net.http_post), seguindo
-- o mesmo padrão de net.http_post já usado no projeto (ver migration
-- 20260402193053, notify_hubspot_new_user).
--
-- ---------------------------------------------------------------------
-- PRÉ-REQUISITOS — devem ser habilitados pelo time (NÃO assumidos aqui)
-- ---------------------------------------------------------------------
--   * Extensão `pg_cron`  (Supabase: Dashboard → Database → Extensions)
--   * Extensão `pg_net`   (já em uso no projeto via net.http_post)
--   * Secret do relay interno (NOVU_RELAY_SECRET) — o mesmo valor que a
--     edge function espera no header `x-internal-secret`. Como o cron roda
--     no Postgres (não na plataforma de Edge Functions), NÃO temos acesso
--     ao Deno.env aqui: o segredo precisa ser injetado de forma segura.
--     Recomendação: usar Vault (vault.decrypted_secrets) — ver bloco abaixo.
--
-- Este arquivo é IDEMPOTENTE: desagenda antes de reagendar. Todo o corpo
-- está GUARDADO num DO-block que só executa se pg_cron estiver presente;
-- caso contrário, apenas emite um aviso e não falha a migration.
-- =====================================================================

DO $$
DECLARE
  v_has_cron boolean;
  v_has_net  boolean;
  v_project_ref text := 'lljnbysgcwvkhlnaqxtt'; -- mesmo ref usado em net.http_post existente
  v_fn_url   text;
  v_relay_secret text;
BEGIN
  SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') INTO v_has_cron;
  SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net')  INTO v_has_net;

  IF NOT v_has_cron OR NOT v_has_net THEN
    RAISE WARNING
      '[caderno-reminders-cron] pg_cron (%) / pg_net (%) ausentes — agendamento NÃO criado. O time deve habilitar as extensões e re-rodar esta migration.',
      v_has_cron, v_has_net;
    RETURN;
  END IF;

  v_fn_url := 'https://' || v_project_ref || '.supabase.co/functions/v1/caderno-reminders';

  -- Recupera o segredo do relay do Vault, se disponível. Sem ele, a edge
  -- function recusa (503) — então não criamos um cron que só dispararia 403/503.
  -- TODO(team): criar o secret `NOVU_RELAY_SECRET` no Supabase Vault
  --   (Dashboard → Project Settings → Vault) com o MESMO valor usado pela
  --   edge function novu-email. O nome do secret abaixo deve bater.
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
      '[caderno-reminders-cron] Secret NOVU_RELAY_SECRET não encontrado no Vault — agendamento NÃO criado. O time deve cadastrá-lo e re-rodar esta migration.';
    RETURN;
  END IF;

  -- Idempotência: desagenda o job anterior se existir.
  PERFORM cron.unschedule('caderno-reminders-daily')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'caderno-reminders-daily');

  -- 08:00 BRT = 11:00 UTC, todos os dias.
  PERFORM cron.schedule(
    'caderno-reminders-daily',
    '0 11 * * *',
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

  RAISE NOTICE '[caderno-reminders-cron] Job agendado: 0 11 * * * (08:00 BRT) → %', v_fn_url;
END;
$$;
