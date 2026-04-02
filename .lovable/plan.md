

# Problem: SSO not saving the user's name

## Root Cause

The `sso-magic-link` edge function only sets the name in one scenario: **when creating a new user** (via `createUser` with `user_metadata: { full_name: fullName }`).

For **existing users** (like `washington.conceicao@sanar.com`), the flow goes straight to `generateLink` which succeeds immediately, and the `fullName` parameter is completely ignored. The name is never written to `profiles.full_name` or `auth.users.raw_user_meta_data`.

Even for new users, there's a secondary issue: the `handle_new_user` trigger correctly reads `raw_user_meta_data->>'full_name'`, but if the user was originally created without a name (e.g., via normal signup), subsequent SSO calls never update it.

## Fix

Modify `supabase/functions/sso-magic-link/index.ts` to **always update the name** when a name is provided, regardless of whether the user is new or existing:

1. After successfully generating the magic link and obtaining the `userId`, add logic to:
   - Update `auth.users` metadata via `supabase.auth.admin.updateUserById(userId, { user_metadata: { full_name: fullName } })`
   - Update `profiles.full_name` via `supabase.from('profiles').update({ full_name: fullName }).eq('id', userId)`

2. Only do this when `fullName` is non-empty, to avoid overwriting with blank values.

This ensures:
- Existing users get their name updated on every SSO login
- New users also get the profile name set (as a safety net beyond the trigger)
- No name is overwritten if the SSO URL doesn't include a `name` param

## Technical Detail

The update block will be placed right after the segment update block (around line 155), before the `actionLink` extraction. Both the auth metadata and profiles table will be updated in parallel since they're independent operations.

