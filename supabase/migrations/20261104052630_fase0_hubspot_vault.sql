-- Local preparation for I-01. No secrets or extension provisioning here.
-- Existing on_profile_created_hubspot AFTER INSERT trigger is preserved.
CREATE OR REPLACE FUNCTION public.notify_hubspot_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_secret text;
  v_secret_count bigint;
  v_request_id bigint;
BEGIN
  -- The existing profiles trigger is the capability, not an end-user JWT.
  IF TG_TABLE_SCHEMA <> 'public' OR TG_TABLE_NAME <> 'profiles' OR TG_OP <> 'INSERT' THEN
    RAISE WARNING '[hubspot-sync] Unexpected trigger context; request not queued';
    RETURN NEW;
  END IF;

  BEGIN
    SELECT count(*), min(decrypted_secret) INTO v_secret_count, v_secret
      FROM vault.decrypted_secrets WHERE name = 'HUBSPOT_SYNC_SECRET';
    IF v_secret_count <> 1 OR nullif(btrim(v_secret), '') IS NULL THEN
      RAISE WARNING '[hubspot-sync] Configure exactly one nonempty HUBSPOT_SYNC_SECRET in Vault; request not queued';
      RETURN NEW;
    END IF;

    SELECT net.http_post(
      url := 'https://lljnbysgcwvkhlnaqxtt.supabase.co/functions/v1/hubspot-contact-sync',
      body := jsonb_build_object(
        'email', NEW.email,
        'full_name', NEW.full_name,
        'segment', NEW.segment,
        'created_at', NEW.created_at
      ),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-internal-secret', v_secret
      )
    ) INTO v_request_id;
    IF v_request_id IS NULL THEN
      RAISE WARNING '[hubspot-sync] pg_net returned no request id; inspect integration health';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- SQLERRM/DETAIL may contain the HTTP headers or a student's payload.
    RAISE WARNING '[hubspot-sync] Vault lookup or pg_net enqueue failed; inspect dependencies and permissions; signup preserved';
  END;
  RETURN NEW;
END;
$function$;

-- Trigger invocation does not require EXECUTE at row-insert time.
-- Only its owner can attach it to a table. No direct RPC callers needed.
REVOKE ALL ON FUNCTION public.notify_hubspot_new_user() FROM PUBLIC, anon, authenticated, service_role;
COMMENT ON FUNCTION public.notify_hubspot_new_user() IS
  'Profiles INSERT integration: Vault HUBSPOT_SYNC_SECRET at runtime, no signup failure on enqueue error. Owner-only trigger function.';

-- Rollback (authorized operator only, safe stop; do not restore unauthenticated HTTP):
-- DROP TRIGGER IF EXISTS on_profile_created_hubspot ON public.profiles;
-- DROP FUNCTION IF EXISTS public.notify_hubspot_new_user();
-- To resume, reapply this function, then recreate the original trigger:
-- CREATE TRIGGER on_profile_created_hubspot AFTER INSERT ON public.profiles
-- FOR EACH ROW EXECUTE FUNCTION public.notify_hubspot_new_user();
