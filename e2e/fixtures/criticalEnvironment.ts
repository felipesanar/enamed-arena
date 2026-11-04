export function validateStagingURL(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
      !/(^|[.-])staging([.-]|$)/i.test(url.hostname)) throw Error();
    return url.origin;
  } catch { throw new Error('E2E_BASE_URL must be an explicit HTTPS staging origin, never production.'); }
}
export function criticalEnvironment() {
  const baseURL = validateStagingURL(process.env.E2E_BASE_URL);
  const rawRef = process.env.E2E_EXPECTED_SUPABASE_PROJECT_REF;
  const projectRef = rawRef === undefined ? undefined : validateSupabaseProjectRef(rawRef);
  const ready = process.env.CRITICAL_E2E_ENV === 'STAGING' && !!baseURL &&
    !!projectRef &&
    !!process.env.E2E_FIXTURE_EMAIL && !!process.env.E2E_FIXTURE_PASSWORD &&
    !!process.env.E2E_FIXTURE_SIMULADO_ID && process.env.E2E_ALLOW_FIXTURE_MUTATION === 'true';
  const id = process.env.E2E_FIXTURE_SIMULADO_ID;
  if (id && !/^[a-zA-Z0-9_-]{1,128}$/.test(id)) throw Error('Invalid isolated fixture ID.');
  return { baseURL, projectRef, ready, reason: 'SKIPPED: requires STAGING origin, non-production Supabase project ref, isolated fixture credentials/ID and explicit fixture mutation opt-in.' };
}

export function validateSupabaseProjectRef(value: string | undefined): string {
  if (!value || !/^[a-z0-9]{20}$/.test(value) || value === 'lljnbysgcwvkhlnaqxtt') {
    throw new Error('E2E_EXPECTED_SUPABASE_PROJECT_REF must identify an isolated non-production Supabase project.');
  }
  return value;
}
