-- Fix analytics_events admin SELECT policy to use user_roles (consistent with admin RPCs)
-- The previous policy used profiles.is_admin; the canonical admin identity is user_roles.

drop policy if exists "Admins can read analytics events" on analytics_events;

create policy "Admins can read analytics events"
  on analytics_events for select
  to authenticated
  using (
    exists (
      select 1 from user_roles
      where user_id = auth.uid() and role = 'admin'
    )
  );
