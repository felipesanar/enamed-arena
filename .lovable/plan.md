

## Plan: SSO Magic Link — Autenticação automática Sanaflix → Simulados

### Goal
Allow Sanaflix users to click a button and land authenticated in the simulados platform without any manual action, via a server-side magic link generation flow.

### Architecture

```text
Sanaflix App
    │
    ▼ redirect
/auth/sso?email=aluno@email.com
    │
    ▼ fetch POST
Edge Function: sso-magic-link
    │ (validates origin, rate limit, generates magic link via admin API)
    ▼ returns { url }
Browser redirects to magic link URL
    │
    ▼ Supabase processes token
/auth/callback  (existing page handles session)
    │
    ▼ redirect
/ (Home)
```

### Steps

#### 1. Database migration — rate limit table

Create `sso_rate_limit` table with RLS disabled (service role only):

```sql
CREATE TABLE public.sso_rate_limit (
  email text PRIMARY KEY,
  attempts int DEFAULT 1,
  window_start timestamptz DEFAULT now()
);

ALTER TABLE public.sso_rate_limit ENABLE ROW LEVEL SECURITY;
-- No RLS policies = only service role can access
```

#### 2. Edge Function — `supabase/functions/sso-magic-link/index.ts`

- **Origin validation**: whitelist `sanaflix.com`, `*.sanaflix.com`, plus preview/production URLs of the simulados platform itself
- **Rate limiting**: query `sso_rate_limit` table — max 20 requests per email per hour; reset window if expired; reject with 429 if exceeded
- **User lookup/creation**: use `supabase.auth.admin.listUsers()` to check if user exists; if not, `admin.createUser()` with `email_confirm: true`
- **Magic link generation**: `admin.generateLink({ type: 'magiclink', email, options: { redirectTo } })`
- **Response**: `{ url: string }` (the hashed_token link)
- **CORS**: allow Sanaflix origins
- **Auth**: uses `SUPABASE_SERVICE_ROLE_KEY` (already available as secret)
- **config.toml**: add `[functions.sso-magic-link]` with `verify_jwt = false` (public endpoint, origin-validated)

#### 3. React page — `src/pages/AuthSSOPage.tsx`

- Read `email` from `?email=` query param
- If user already has active session → redirect to `/` immediately
- Show loading UI ("Entrando na sua conta...")
- POST to `sso-magic-link` edge function with `{ email }`
- On success: `window.location.href = response.url` (redirects to Supabase magic link which lands on `/auth/callback`)
- On error: show friendly message + "Ir para login" button
- Add `<meta name="robots" content="noindex">` via `useEffect`

#### 4. Route registration — `src/App.tsx`

Add public route:
```tsx
<Route path="/auth/sso" element={<AuthSSOPage />} />
```

#### 5. Config.toml update

```toml
[functions.sso-magic-link]
verify_jwt = false
```

### Files changed

| File | Change |
|---|---|
| `supabase/functions/sso-magic-link/index.ts` | New edge function |
| `supabase/config.toml` | Add `sso-magic-link` entry |
| `src/pages/AuthSSOPage.tsx` | New SSO landing page |
| `src/App.tsx` | Add `/auth/sso` route |
| Migration SQL | Create `sso_rate_limit` table |

### Security considerations

- **Origin/Referer validation** is defense-in-depth only (headers can be spoofed). The real protection is that the magic link is sent to the user's email — but here we return it directly. This means the endpoint effectively grants access to any email if called. The origin check + rate limit mitigate abuse but aren't foolproof.
- **Alternative approach**: Instead of returning the magic link URL, we could just trigger `signInWithOtp` (sends email) and have the user click in their inbox. But the requirement says "zero action" — so we return the link directly. The origin whitelist is the main guard.
- Rate limiting prevents brute-force enumeration
- No sensitive data exposed in frontend errors
- Service role key stays server-side only

### Supabase dashboard checklist (manual)

1. Add `https://simulados.sanaflix.com` to Authentication → URL Configuration → Redirect URLs
2. Verify magic link expiry is set to 1 hour (default)

