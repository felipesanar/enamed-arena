import { geminiUrl, resolveGeminiModel, createSummaryHandler } from './geminiModel.ts';
import type { EditionClient } from './aiEditionContext.ts';
const test = typeof Deno !== 'undefined' ? Deno.test
  : (globalThis as unknown as { test: (name: string, fn: () => unknown) => void }).test;

function assert(value: unknown): asserts value { if (!value) throw new Error('Assertion failed'); }
test('model preserves actual fallback, validates configuration and escapes the key', () => {
  assert(resolveGeminiModel(undefined) === 'gemini-2.5-flash');
  assert(resolveGeminiModel('gemini-2.5-pro') === 'gemini-2.5-pro');
  assert(geminiUrl('gemini-2.5-pro', 'a&secret=?').endsWith('key=a%26secret%3D%3F'));
  for (const value of ['', '../model', 'models/model', 'model?key=evil', 'model\n', ' model']) {
    let failed = false;
    try { resolveGeminiModel(value); } catch { failed = true; }
    assert(failed);
  }
});

test('HTTP gates, real JWT verification, caller-only client and private failures', async () => {
  let authCalls = 0, fetchCalls = 0, valid = false;
  const options = {
    env: (key: string) => ({ SUPABASE_URL: 'https://test.invalid', SUPABASE_ANON_KEY: 'public', GEMINI_API_KEY: 'key' })[key],
    createClient: (_url: string, key: string, config: { global: { headers: { Authorization: string } } }) => {
      assert(key === 'public' && config.global.headers.Authorization === 'Bearer token');
      return { auth: { getUser: (token: string) => {
        authCalls++; assert(token === 'token');
        return Promise.resolve({ data: { user: valid ? { id: 'caller' } : null }, error: valid ? null : new Error('PII') });
      } } } as unknown as EditionClient;
    },
    fetch: (() => { fetchCalls++; return Promise.resolve(new Response('sensitive upstream payload', { status: 400 })); }) as typeof fetch,
  };
  const handler = createSummaryHandler(() => 'prompt', options);
  const request = (method = 'POST', token = true, body = '{}') => new Request('https://test.invalid', {
    method, headers: token ? { Authorization: 'Bearer token' } : {}, ...(method === 'POST' ? { body } : {}),
  });
  assert((await handler(request('OPTIONS', false))).status === 200);
  assert((await handler(request('GET', false))).status === 405);
  assert((await handler(request('POST', false))).status === 401);
  assert(authCalls === 0);
  assert((await handler(request())).status === 401);
  assert(fetchCalls === 0);
  valid = true;
  assert((await handler(request('POST', true, 'invalid json'))).status === 400);
  const response = await handler(request());
  assert(response.status === 502 && !(await response.text()).includes('sensitive'));
  assert(Number(fetchCalls) === 1);
});

test('retries only transient upstream statuses and sanitizes the actual successful text', async () => {
  let calls = 0, waits = 0;
  const handler = createSummaryHandler(() => 'prompt', {
    env: key => ({ SUPABASE_URL: 'https://test.invalid', SUPABASE_ANON_KEY: 'public', GEMINI_API_KEY: 'fake' })[key],
    createClient: () => ({ auth: { getUser: () => Promise.resolve({ data: { user: { id: 'caller' } }, error: null }) } }) as unknown as EditionClient,
    fetch: (() => {
      calls++;
      return Promise.resolve(calls === 1 ? new Response('private error', { status: 429 })
        : new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Antes — depois' }] } }] })));
    }) as typeof fetch,
    wait: ms => { waits++; assert(ms === 1200); return Promise.resolve(); },
  });
  const response = await handler(new Request('https://test.invalid', { method: 'POST', headers: { Authorization: 'Bearer token' }, body: '{}' }));
  assert(response.status === 200 && (await response.json()).markdown === 'Antes. depois');
  assert(calls === 2 && waits === 1);
});

test('network, malformed provider output and invalid model configuration never echo private data', async () => {
  for (const mode of ['network', 'malformed', 'model', 'missing-key', 'requester']) {
    let calls = 0;
    const handler = createSummaryHandler(() => {
      if (mode === 'requester') throw new Error('PRIVATE_NAME');
      return 'prompt';
    }, {
      env: key => ({ SUPABASE_URL: 'https://test.invalid', SUPABASE_ANON_KEY: 'public',
        GEMINI_API_KEY: mode === 'missing-key' ? undefined : 'fake', GEMINI_MODEL: mode === 'model' ? '../PRIVATE_NAME' : undefined })[key],
      createClient: () => ({ auth: { getUser: () => Promise.resolve({ data: { user: { id: 'caller' } }, error: null }) } }) as unknown as EditionClient,
      fetch: (() => {
        calls++;
        if (mode === 'network') throw new Error('PRIVATE_NAME');
        return Promise.resolve(new Response('PRIVATE_NAME'));
      }) as typeof fetch,
    });
    const response = await handler(new Request('https://test.invalid', { method: 'POST', headers: { Authorization: 'Bearer token' }, body: '{}' }));
    assert(response.status === (['network', 'malformed'].includes(mode) ? 502 : 500));
    assert(!(await response.text()).includes('PRIVATE_NAME'));
    assert(calls === (['network', 'malformed'].includes(mode) ? 1 : 0));
  }
});
