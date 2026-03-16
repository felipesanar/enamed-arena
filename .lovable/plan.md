

## Problem Diagnosis

The confirmation email link redirects to `http://localhost:3000` because you signed up from localhost. The `emailRedirectTo: window.location.origin` captures whatever origin you're on at signup time.

Looking at the auth logs, the email **was confirmed successfully** (the `/verify` call returned 303, and there's a subsequent login). So the auth flow works — the problem is just the redirect URL pointing to localhost instead of your deployed app.

## Fix Plan

### 1. Update `emailRedirectTo` in AuthContext

Change the signup redirect to use the deployed app URL as a fallback:

```typescript
// In signUp function
emailRedirectTo: window.location.origin.includes('localhost')
  ? 'https://enamed-arena.lovable.app'
  : window.location.origin
```

### 2. Configure Supabase Site URL

The Supabase project's **Site URL** should be set to `https://enamed-arena.lovable.app` in the Supabase dashboard (Authentication → URL Configuration). This ensures default redirects go to the production app.

Also add the preview URL (`https://id-preview--389ede2e-db02-48e3-8d83-80bfead9e2f1.lovable.app`) to the **Redirect URLs** allowlist.

### 3. Handle hash-based token on page load

Supabase's `onAuthStateChange` should automatically detect the `#access_token=...` fragment in the URL. Verify that `LoginPage` properly redirects when a session is detected (it already has `if (!loading && user) return <Navigate to="/" />`, which should work).

### Impact
- Minimal code change (1 line in AuthContext)
- Dashboard config change (Site URL + redirect allowlist)
- No breaking changes to existing flows

