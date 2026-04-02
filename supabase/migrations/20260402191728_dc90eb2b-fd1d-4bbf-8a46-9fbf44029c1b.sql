
-- Enable pg_net extension for HTTP calls from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Function that sends new user data to HubSpot via the edge function
CREATE OR REPLACE FUNCTION public.notify_hubspot_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_supabase_url text;
  v_anon_key text;
BEGIN
  -- Use the project's Supabase URL and anon key
  v_supabase_url := 'https://lljnbysgcwvkhlnaqxtt.supabase.co';
  v_anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxsam5ieXNnY3d2a2hsbmFxeHR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0NDgyMjQsImV4cCI6MjA4OTAyNDIyNH0.sCYdAHzP9SMizifcxmTb9wO11gbXiR4a7lDknf4cuNM';

  PERFORM extensions.http_post(
    url := v_supabase_url || '/functions/v1/hubspot-contact-sync',
    body := jsonb_build_object(
      'email', NEW.email,
      'full_name', NEW.full_name,
      'segment', NEW.segment,
      'created_at', NEW.created_at
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_anon_key
    )
  );

  RETURN NEW;
END;
$$;

-- Trigger on profiles insert (fires after handle_new_user creates the profile)
CREATE TRIGGER on_profile_created_hubspot
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_hubspot_new_user();
