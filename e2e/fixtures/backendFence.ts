import type { BrowserContext } from '@playwright/test';
import { validateStagingURL, validateSupabaseProjectRef } from './criticalEnvironment';

export async function installBackendFence(context: BrowserContext, staging: string, ref: string) {
  const frontend = validateStagingURL(staging);
  if (!frontend) throw new Error('Backend fence requires a staging origin.');
  const backend = `https://${validateSupabaseProjectRef(ref)}.supabase.co`;
  let blocked = false;
  await context.clearCookies();
  await context.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const publicFont = !url.username && !url.password && ['GET', 'HEAD'].includes(request.method()) && (
      (request.resourceType() === 'stylesheet' && url.origin === 'https://fonts.googleapis.com' && url.pathname === '/css2') ||
      (request.resourceType() === 'font' && url.origin === 'https://fonts.gstatic.com' && /^\/s\/plusjakartasans\/[^?#]+\.(?:woff2?|ttf)$/.test(url.pathname))
    );
    // Fonts are optional presentation assets, not backend violations. Still deny
    // them outright: no external connection, cookies or credentials are forwarded.
    if (publicFont) { await route.abort('blockedbyclient'); return; }
    const backendPath = /^\/(?:auth|rest|functions|storage)\/v1(?:\/|$)/.test(url.pathname);
    const isAsset = url.origin === frontend && !backendPath && ['GET', 'HEAD'].includes(request.method()) &&
      !['fetch', 'xhr', 'eventsource'].includes(request.resourceType());
    if (url.origin === backend || isAsset) {
      await route.fallback();
    } else {
      blocked = true;
      await route.abort('blockedbyclient');
    }
  });
  // HTTP routing does not cover WebSocket handshakes. Do not allow an unknown
  // realtime origin to bypass the same project boundary.
  await context.routeWebSocket('**/*', socket => {
    const url = new URL(socket.url());
    if (url.origin === backend.replace('https:', 'wss:')) socket.connectToServer();
    else { blocked = true; socket.close({ code: 1008, reason: 'Backend fence blocked' }); }
  });
  return {
    blocked: () => blocked,
    assertSafe: () => { if (blocked) throw new Error('Backend fence blocked an unexpected destination; no sensitive request was forwarded.'); },
  };
}
