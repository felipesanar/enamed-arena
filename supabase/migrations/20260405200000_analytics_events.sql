-- =====================================================================
-- Analytics Events — persistent event log for admin dashboard
-- =====================================================================

-- Table
create table analytics_events (
  id          uuid        not null default gen_random_uuid() primary key,
  user_id     uuid        references auth.users(id) on delete set null,
  event_name  text        not null,
  payload     jsonb       not null default '{}',
  created_at  timestamptz not null default now()
);

-- Indexes for common admin queries
create index analytics_events_event_name_idx  on analytics_events (event_name);
create index analytics_events_user_id_idx     on analytics_events (user_id);
create index analytics_events_created_at_idx  on analytics_events (created_at desc);

-- RLS: enable (no direct client read; writes via SECURITY DEFINER RPC only)
alter table analytics_events enable row level security;

-- Admin read policy (requires is_admin on profiles — added below)
create policy "Admins can read analytics events"
  on analytics_events for select
  to authenticated
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.is_admin = true
    )
  );

-- =====================================================================
-- SECURITY DEFINER RPC — callable by both authenticated and anon roles
-- Inserts one analytics event; user_id comes from auth.uid() (null for anon).
-- =====================================================================
create or replace function log_analytics_event(
  p_event_name  text,
  p_payload     jsonb default '{}'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_event_name is null or trim(p_event_name) = '' then
    return;
  end if;

  insert into analytics_events (user_id, event_name, payload)
  values (
    auth.uid(),
    p_event_name,
    coalesce(p_payload, '{}')
  );
end;
$$;

-- Grant execute to authenticated and anonymous callers
grant execute on function log_analytics_event(text, jsonb) to authenticated, anon;

-- =====================================================================
-- Add is_admin flag to profiles (used by the admin SELECT policy above)
-- Set manually per admin user via Supabase dashboard or service_role.
-- =====================================================================
alter table profiles
  add column if not exists is_admin boolean not null default false;
