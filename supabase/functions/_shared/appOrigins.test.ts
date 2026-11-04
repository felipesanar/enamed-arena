import { describe, expect, it } from 'vitest';
import { isAllowedOrigin, corsHeaders, ALLOWED_ORIGINS } from './appIdentity';

describe('SSO origin policy (not authentication)', () => {
  it.each([
    'https://sanarflix.com.br', 'https://app.sanarflix.com.br', 'https://a.b.sanarflix.com.br',
    'https://sanar.com.br', 'https://simulados.sanar.com.br',
    'https://enamed-arena.lovable.app',
    'https://id-preview--389ede2e-db02-48e3-8d83-80bfead9e2f1.lovable.app',
    'https://preview.lovableproject.com',
  ])('preserves the legitimate HTTPS origin %s', origin => {
    expect(isAllowedOrigin(origin)).toBe(true);
    expect(corsHeaders(origin)['Access-Control-Allow-Origin']).toBe(origin);
  });

  it.each([
    null, '', 'null', 'invalid', 'https://sanaflix.com', 'https://app.sanaflix.com',
    'http://sanarflix.com.br', 'http://simulados.sanar.com.br', 'http://preview.lovable.app',
    'https://sanarflix.com.br.evil', 'https://evil-sanarflix.com.br',
    'https://sanarflix.com.br@evil.com', 'https://evil.com@sanarflix.com.br',
    'https://user:password@app.sanarflix.com.br',
    'https://app.sanarflix.com.br/path', 'https://app.sanarflix.com.br/',
    'https://app.sanarflix.com.br?x=1', 'https://app.sanarflix.com.br#fragment',
    'https://evil.com', 'https://supabase.co',
  ])('does not reflect or accept malformed/untrusted origin %s', origin => {
    expect(isAllowedOrigin(origin)).toBe(false);
    expect(corsHeaders(origin)['Access-Control-Allow-Origin']).toBe(ALLOWED_ORIGINS[0]);
  });
});
