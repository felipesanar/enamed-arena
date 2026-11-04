import { test, expect } from '@playwright/test';
import { validateStagingURL, validateSupabaseProjectRef } from './fixtures/criticalEnvironment';
import { installBackendFence } from './fixtures/backendFence';

test('configuration rejects production, ambiguous origins and invalid project refs', () => {
  for (const value of ['https://app.sanar.com.br', 'http://staging.example.test', 'https://notstaging.example.test', 'https://staging.example.test/?token=private', 'https://user:pass@staging.example.test']) {
    expect(() => validateStagingURL(value)).toThrow();
  }
  expect(validateStagingURL('https://arena-staging.example.test')).toBe('https://arena-staging.example.test');
  expect(validateStagingURL(undefined)).toBeUndefined();
  for (const ref of [undefined, '', 'lljnbysgcwvkhlnaqxtt', 'INVALID', 'https://fixture.supabase.co', 'a'.repeat(21)]) {
    expect(() => validateSupabaseProjectRef(ref)).toThrow();
  }
  expect(validateSupabaseProjectRef('abcdefghijklmnopqrst')).toBe('abcdefghijklmnopqrst');
});

test('mock staging pointed at production fails before secrets or mutations leave the browser', async ({ context, page }) => {
  const forwarded: string[] = [];
  await context.addCookies([{ name: 'old-session', value: 'synthetic', domain: '.supabase.co', path: '/' }]);
  await context.route('**/*', route => {
    forwarded.push(route.request().url());
    return route.fulfill({ contentType: 'text/html', body: '<input id="email"><script>fetch("https://lljnbysgcwvkhlnaqxtt.supabase.co/auth/v1/settings").catch(() => {});</script>' });
  });
  const fence = await installBackendFence(context, 'https://arena-staging.example.test', 'abcdefghijklmnopqrst');
  expect(await context.cookies()).toEqual([]);
  await page.goto('https://arena-staging.example.test/login');
  await expect.poll(() => fence.blocked()).toBe(true);
  expect(() => fence.assertSafe()).toThrow('Backend fence blocked');
  expect(await page.locator('#email').inputValue()).toBe('');
  expect(forwarded).toEqual(['https://arena-staging.example.test/login']);
});

test('public font assets are denied without hiding a production auth violation', async ({ context, page }) => {
  const forwarded: string[] = [];
  await context.route('**/*', route => {
    forwarded.push(route.request().url());
    return route.fulfill({ contentType: 'text/html', body: '<p>Mock only</p>' });
  });
  const fence = await installBackendFence(context, 'https://arena-staging.example.test', 'abcdefghijklmnopqrst');
  await page.goto('https://arena-staging.example.test/login');
  await page.evaluate(async () => {
    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans&display=swap';
    await new Promise<void>(resolve => {
      style.onload = style.onerror = () => resolve();
      document.head.append(style);
    });
    const font = new FontFace('FixtureFont', 'url(https://fonts.gstatic.com/s/plusjakartasans/v1/fixture.woff2)');
    await font.load().catch(() => {});
  });
  expect(forwarded).toEqual(['https://arena-staging.example.test/login']);
  expect(fence.blocked()).toBe(false);
  expect(() => fence.assertSafe()).not.toThrow();
  await page.evaluate(async () => {
    await fetch('https://lljnbysgcwvkhlnaqxtt.supabase.co/auth/v1/token', {
      method: 'POST', body: 'synthetic',
    }).catch(() => {});
  });
  expect(forwarded).toEqual(['https://arena-staging.example.test/login']);
  expect(fence.blocked()).toBe(true);
  expect(() => fence.assertSafe()).toThrow('Backend fence blocked');
});

test('redirects, service workers and unknown WebSockets cannot bypass the fence', async ({ context, page }) => {
  const forwarded: string[] = [];
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    forwarded.push(url.origin);
    if (url.pathname === '/redirect') return route.fulfill({ status: 302, headers: { location: 'https://lljnbysgcwvkhlnaqxtt.supabase.co/auth/v1/token' } });
    return route.fulfill({ contentType: 'text/html', body: '<p>Mock only</p>' });
  });
  const fence = await installBackendFence(context, 'https://arena-staging.example.test', 'abcdefghijklmnopqrst');
  await page.goto('https://arena-staging.example.test/login');
  await page.evaluate(async () => {
    await navigator.serviceWorker.register('/worker.js').catch(() => {});
  });
  expect(context.serviceWorkers()).toHaveLength(0);
  expect(forwarded).toEqual(['https://arena-staging.example.test']);
  await page.evaluate(async () => {
    await new Promise<void>(resolve => {
      const image = new Image();
      image.onload = image.onerror = () => resolve();
      image.src = '/redirect';
    });
    await new Promise<void>(resolve => {
      const socket = new WebSocket('wss://unknown.example.test/socket');
      socket.onclose = () => resolve();
      socket.onerror = () => resolve();
    });
  });
  expect(fence.blocked()).toBe(true);
  expect(forwarded.every(origin => origin === 'https://arena-staging.example.test')).toBe(true);
});

test('fence only permits the exact expected backend and staging assets', async ({ context, page }) => {
  const forwarded: string[] = [];
  await context.route('**/*', route => {
    forwarded.push(route.request().url());
    return route.fulfill({ contentType: 'text/html', body: '<p>Mock only</p>', headers: { 'Access-Control-Allow-Origin': '*' } });
  });
  const fence = await installBackendFence(context, 'https://arena-staging.example.test', 'abcdefghijklmnopqrst');
  await page.goto('https://arena-staging.example.test/login');
  await page.evaluate(async () => {
    await fetch('https://abcdefghijklmnopqrst.supabase.co/auth/v1/settings');
    for (const origin of ['https://lljnbysgcwvkhlnaqxtt.supabase.co', 'https://unknown.example.test', 'https://abcdefghijklmnopqrst.supabase.co.evil.test']) {
      for (const path of ['/auth/v1/token', '/rest/v1/answers', '/functions/v1/test', '/storage/v1/object/test']) {
        await fetch(origin + path, { method: 'POST', body: 'synthetic' }).catch(() => {});
      }
    }
    await fetch('/rest/v1/answers', { method: 'POST', body: 'synthetic' }).catch(() => {});
  });
  expect(fence.blocked()).toBe(true);
  expect(forwarded).toEqual(['https://arena-staging.example.test/login', 'https://abcdefghijklmnopqrst.supabase.co/auth/v1/settings']);
});
