import { describe, expect, it } from 'vitest';
import { APP_ORIGIN, LOGO_URL, DEFAULT_AUTH_REDIRECT, ALLOWED_ACTION_HOSTS } from './appIdentity';

describe('email application identity', () => {
  it('uses the existing first-party origin without changing the logo path', () => {
    expect(APP_ORIGIN).toBe('https://simulados.sanar.com.br');
    expect(LOGO_URL).toBe(`${APP_ORIGIN}/logo.svg`);
    expect(DEFAULT_AUTH_REDIRECT).toBe(APP_ORIGIN);
  });

  it.each(['sanarflix.com.br', 'app.sanarflix.com.br', 'a.b.sanarflix.com.br',
    'simulados.sanar.com.br', 'x.supabase.co', 'enamed-arena.lovable.app', 'id-preview--abc.lovable.app'])('allows email action hostname %s', host => {
    expect(ALLOWED_ACTION_HOSTS.some(pattern => pattern.test(host))).toBe(true);
  });
  it.each(['sanaflix.com', 'app.sanaflix.com', 'sanarflix.com.br.evil', 'evil-sanarflix.com.br',
    'evil.com', 'preview.lovable.app', 'x.supabase.in', 'preview.lovableproject.com'])('rejects email action hostname %s without broadening this context', host => {
    expect(ALLOWED_ACTION_HOSTS.some(pattern => pattern.test(host))).toBe(false);
  });
});
