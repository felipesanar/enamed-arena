export const APP_ORIGIN = 'https://simulados.sanar.com.br';
export const LOGO_URL = `${APP_ORIGIN}/logo.svg`;
export const DEFAULT_AUTH_REDIRECT = APP_ORIGIN;

export const ALLOWED_ACTION_HOSTS: ReadonlyArray<RegExp> = [
  /^simulados\.sanar\.com\.br$/i,
  /^([a-z0-9-]+\.)*sanar\.com\.br$/i,
  /^([a-z0-9-]+\.)*sanarflix\.com\.br$/i,
  /^enamed-arena\.lovable\.app$/i,
  /^id-preview--[a-z0-9-]+\.lovable\.app$/i,
  /^([a-z0-9-]+\.)*supabase\.co$/i,
];

export const ALLOWED_ORIGINS = [
  'https://sanarflix.com.br',
  'https://app.sanarflix.com.br',
  APP_ORIGIN,
  'https://enamed-arena.lovable.app',
  'https://id-preview--389ede2e-db02-48e3-8d83-80bfead9e2f1.lovable.app',
] as const;

export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  try {
    const url = new URL(origin);
    // An Origin is only scheme + authority, never a Referer URL or credentials.
    if (url.protocol !== 'https:' || url.origin !== origin) return false;
    const hostname = url.hostname;
    return hostname === 'sanarflix.com.br' || hostname.endsWith('.sanarflix.com.br')
      || hostname === 'sanar.com.br' || hostname.endsWith('.sanar.com.br')
      || ALLOWED_ORIGINS.some(allowed => allowed === origin)
      || hostname.endsWith('.lovable.app') || hostname.endsWith('.lovableproject.com');
  } catch {
    return false;
  }
}

export function corsHeaders(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin && isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };
}
