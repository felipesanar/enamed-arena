
-- 1. Drop broken trigger
DROP TRIGGER IF EXISTS on_profile_created_hubspot ON public.profiles;

-- 2. Drop broken function
DROP FUNCTION IF EXISTS public.notify_hubspot_new_user();

-- 3. Recreate function using net.http_post (pg_net async)
CREATE OR REPLACE FUNCTION public.notify_hubspot_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://lljnbysgcwvkhlnaqxtt.supabase.co/functions/v1/hubspot-contact-sync',
    body := jsonb_build_object(
      'email', NEW.email,
      'full_name', NEW.full_name,
      'segment', NEW.segment,
      'created_at', NEW.created_at
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxsam5ieXNnY3d2a2hsbmFxeHR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0NDgyMjQsImV4cCI6MjA4OTAyNDIyNH0.sCYdAHzP9SMizifcxmTb9wO11gbXiR4a7lDknf4cuNM'
    )
  );
  RETURN NEW;
END;
$$;

-- 4. Recreate trigger
CREATE TRIGGER on_profile_created_hubspot
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_hubspot_new_user();
