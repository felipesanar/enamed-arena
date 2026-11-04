// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPatternHandler } from './handler';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const aggregate = () => ({ total_entries: 5, total_mastered: 1,
  area_cause_dist: [{ area: 'CM', reason: 'reading_error', cnt: 5, mastered_cnt: 1 }],
  overconf: [{ area: 'CM', high_conf_wrong: 3, high_conf_total: 5 }],
  roi_data: [{ area: 'CM', first_mastered_at: '2026-10-01', score_before: 0.1, score_after: 0.9 }],
  recurring_confusion_candidates: [], question_samples: [] });
const insight = { id: 'cause', type: 'dominant_cause', severity: 'attention', title: 'Leitura', body: 'Revise a leitura.', cta: { label: 'Revisar', href: '/caderno?edition=wrong&area=CM' }, data: {} };
function fixture() {
  const state = { segment: 'pro', user: { id: 'owner' } as { id: string; role?: string } | null,
    data: aggregate() as unknown, rpcError: false, catalogError: false, cache: null as any, readError: false, writeError: false };
  const getUser = vi.fn(async (_token?: string) => ({ data: { user: state.user }, error: null }));
  const eq = vi.fn();
  const upsert = vi.fn(async (row: any) => { if (state.writeError) throw new Error('PRIVATE'); state.cache = row; return { error: null }; });
  const client = { auth: { getUser }, rpc: vi.fn(async (name: string, _args?: unknown) => ({
    data: name === 'get_exam_editions' ? [{ id: A, label: 'ENAMED 2027.1', format: { questions: 80, options: 4, duration_minutes: 180, scoring: 'raw' } }, { id: B, label: 'ENAMED 2027.2' }] : state.data,
    error: (name === 'get_exam_editions' ? state.catalogError : state.rpcError) ? { message: 'PRIVATE', code: 'PGRST202' } : null,
  })), from: vi.fn((table: string) => ({
    select: () => ({ eq: (key: string, value: unknown) => {
      eq(table, key, value);
      const read = async () => { if (table === 'profiles') return { data: { segment: state.segment }, error: null }; if (state.readError) throw new Error('PRIVATE'); return { data: state.cache, error: null }; };
      return { single: read, maybeSingle: read };
    } }), upsert,
  })) };
  const fetchAI = vi.fn(async (_url: unknown, _init?: RequestInit) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ insights: [insight, { ...insight, id: 'roi', type: 'roi' }] }) }] } }] })));
  const env: Record<string, string> = { SUPABASE_URL: 'https://local.invalid', SUPABASE_ANON_KEY: 'anon', GEMINI_API_KEY: 'private-key' };
  const createClient = vi.fn(() => client);
  const handler = createPatternHandler({ env: key => env[key], createClient, fetch: fetchAI, wait: async () => {} });
  const request = (body: unknown = {}, headers: Record<string, string> = { authorization: 'bEaReR verified-token' }) => handler(new Request('https://local.invalid', { method: 'POST', headers, ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }) }));
  return { state, client, fetchAI, env, createClient, handler, request, eq, upsert };
}
afterEach(() => vi.useRealTimers());
describe('pattern handler real request boundary', () => {
  it('supports OPTIONS, rejects methods, missing bearer and invalid JWT before RPC/AI', async () => {
    const f = fixture();
    expect((await f.handler(new Request('https://local.invalid', { method: 'OPTIONS' }))).status).toBe(200);
    expect((await f.handler(new Request('https://local.invalid'))).status).toBe(405);
    for (const authorization of ['', 'Basic secret', 'Bearer x extra']) expect((await f.request({}, { authorization })).status).toBe(401);
    f.state.user = null; expect((await f.request()).status).toBe(401);
    expect(f.client.rpc).not.toHaveBeenCalled(); expect(f.fetchAI).not.toHaveBeenCalled();
  });
  it('forwards anon key and verified token; ignores forged identity, profile and metadata', async () => {
    const f = fixture();
    const res = await f.request({ editionId: A, userId: 'victim', studentName: 'PRIVATE-NAME', segment: 'pro', profile: {}, editionLabel: 'FAKE', format: { questions: 999 } }, { AUTHORIZATION: 'bearer verified-token', 'x-extra': 'PRIVATE-HEADER' });
    expect(res.status).toBe(200); expect(f.client.auth.getUser).toHaveBeenCalledWith('verified-token');
    expect(f.createClient).toHaveBeenCalledWith('https://local.invalid', 'anon', expect.objectContaining({ global: { headers: { Authorization: 'Bearer verified-token' } } }));
    expect(f.eq).toHaveBeenCalledWith('profiles', 'id', 'owner');
    expect(f.client.rpc).toHaveBeenLastCalledWith('get_caderno_pattern_data', { p_user_id: 'owner', p_edition_id: A });
    const payload = await res.json(); expect(payload).toMatchObject({ editionId: A, editionLabel: 'ENAMED 2027.1', from_cache: false });
    expect(payload.insights[0].cta.href).toBe(`/caderno?area=CM&edition=${A}`);
    const prompt = JSON.parse(f.fetchAI.mock.calls[0][1]!.body as string).contents[0].parts[0].text;
    expect(prompt).toContain('ENAMED 2027.1'); expect(prompt).toContain('80'); expect(prompt).toContain('score_before');
    for (const privateValue of ['owner', 'victim', 'PRIVATE-NAME', 'PRIVATE-HEADER', 'FAKE', A, '999']) expect(prompt).not.toContain(privateValue);
    expect(f.upsert.mock.calls[0][0].user_id).toBe('owner');
  });
  it('rejects non PRO and service-role user before data access', async () => {
    const f = fixture(); f.state.segment = 'standard'; expect((await f.request({ segment: 'pro' })).status).toBe(403);
    f.state.segment = 'pro'; f.state.user = { id: 'owner', role: 'service_role' }; expect((await f.request()).status).toBe(401);
    expect(f.client.rpc).not.toHaveBeenCalled();
  });
  it('validates JSON, byte limit, edition types, catalog errors and unknown IDs without fallback', async () => {
    const f = fixture();
    expect((await f.request('{')).status).toBe(400);
    for (const body of ['null', '[]', '1']) expect((await f.request(body)).status).toBe(400);
    expect((await f.request(JSON.stringify({ x: 'é'.repeat(70000) }))).status).toBe(413);
    for (const editionId of [4, false, {}, [], '', 'bad', '33333333-3333-4333-8333-333333333333']) expect((await f.request({ editionId })).status).toBe(400);
    f.state.catalogError = true; expect((await f.request({ editionId: A })).status).toBe(503);
    expect(f.client.rpc.mock.calls.filter(([name]) => name === 'get_caderno_pattern_data')).toHaveLength(0);
  });
  it('accepts legacy empty body and null cumulative scope, removes ROI from prompt and response', async () => {
    const f = fixture();
    const res = await f.request(''); expect(res.status).toBe(200);
    const result = await res.json(); expect(result).toMatchObject({ editionId: null, editionLabel: 'Todas as edições' });
    expect(result.insights.map((x: any) => x.type)).not.toContain('roi'); expect(result.message).toContain('edição');
    const prompt = JSON.parse(f.fetchAI.mock.calls[0][1]!.body as string).contents[0].parts[0].text;
    expect(prompt).not.toContain('score_before'); expect(prompt).not.toContain('score_after'); expect(prompt).toContain('indisponível');
    expect(f.client.rpc).toHaveBeenLastCalledWith('get_caderno_pattern_data', { p_user_id: 'owner', p_edition_id: null });
    expect((await f.request({ editionId: null })).status).toBe(200);
  });
  it('fails honestly on missing RPC signature and malformed aggregate instead of generating empty data', async () => {
    const f = fixture(); f.state.rpcError = true; expect((await f.request()).status).toBe(503);
    expect(f.client.rpc).toHaveBeenCalledTimes(1); f.state.rpcError = false;
    for (const data of [null, [], {}, { ...aggregate(), total_entries: '5' }, { ...aggregate(), overconf: [{}] }]) {
      f.state.data = data; expect((await f.request()).status).toBe(502);
    }
    expect(f.fetchAI).not.toHaveBeenCalled();
  });
  it('returns insufficient data with edition metadata and without AI configuration', async () => {
    const f = fixture(); f.state.data = { ...aggregate(), total_entries: 4 }; delete f.env.GEMINI_API_KEY;
    expect(await (await f.request({ editionId: A })).json()).toMatchObject({ insights: [], has_sufficient_data: false, editionId: A, editionLabel: 'ENAMED 2027.1' });
    expect(f.fetchAI).not.toHaveBeenCalled();
  });
  it('verifies auth errors and thrown auth failures without exposing their content', async () => {
    const f = fixture();
    f.client.auth.getUser.mockResolvedValue({ data: { user: { id: 'owner' } }, error: new Error('PRIVATE') } as never);
    expect((await f.request()).status).toBe(401);
    f.client.auth.getUser.mockRejectedValue(new Error('PRIVATE'));
    const res = await f.request(); expect(res.status).toBe(401); expect(await res.text()).not.toContain('PRIVATE');
    expect(f.client.rpc).not.toHaveBeenCalled(); expect(f.fetchAI).not.toHaveBeenCalled();
  });
  it('does not forward arbitrary aggregate keys or manual question text into Gemini', async () => {
    const f = fixture(); f.state.data = { ...aggregate(), studentName: 'PRIVATE-STUDENT', user_id: 'PRIVATE-ID',
      question_samples: [{ area: 'CM', theme: 'Tema', question_text: 'PRIVATE-MANUAL-TEXT', reason: 'confused_alternatives' }] };
    await f.request(); const prompt = JSON.parse(f.fetchAI.mock.calls[0][1]!.body as string).contents[0].parts[0].text;
    for (const word of ['PRIVATE-STUDENT', 'PRIVATE-ID', 'PRIVATE-MANUAL-TEXT']) expect(prompt).not.toContain(word);
    expect(prompt).toContain('high_conf_wrong'); expect(prompt).toContain('reading_error');
  });
  it('retries transient failures once, and accepts a successful retry with no raw error exposure', async () => {
    const f = fixture(); f.fetchAI.mockResolvedValueOnce(new Response('PRIVATE', { status: 503 }));
    const res = await f.request(); expect(res.status).toBe(200); expect(f.fetchAI).toHaveBeenCalledTimes(2);
    expect(await res.text()).not.toContain('PRIVATE');
  });
  it('ignores malformed/untagged caches and returned cache write errors', async () => {
    const f = fixture();
    await f.request({ editionId: A });
    const valid = structuredClone(f.state.cache);
    for (const change of [{ cache_version: undefined }, { editionId: B }, { insights: [{}] }, { generated_at: 'bad' }, { versionContext: 'old' }, { dataHash: 'wrong' }]) {
      f.state.cache = { ...valid, payload: { ...valid.payload, ...change } };
      expect((await (await f.request({ editionId: A })).json()).from_cache).toBe(false);
    }
    f.state.cache = null; f.upsert.mockResolvedValueOnce({ error: { message: 'PRIVATE' } } as never);
    expect((await f.request({ editionId: A })).status).toBe(200);
  });
  it('never shares equal-count edition caches; checks version, hash, TTL and ignores cache failures', async () => {
    const f = fixture(); await f.request({ editionId: A });
    expect((await (await f.request({ editionId: A })).json()).from_cache).toBe(true); expect(f.fetchAI).toHaveBeenCalledTimes(1);
    await f.request({ editionId: B }); expect(f.fetchAI).toHaveBeenCalledTimes(2);
    f.state.data = { ...aggregate(), total_mastered: 2 }; await f.request({ editionId: B }); expect(f.fetchAI).toHaveBeenCalledTimes(3);
    f.state.cache.payload.cache_version = 1; await f.request({ editionId: B }); expect(f.fetchAI).toHaveBeenCalledTimes(4);
    f.state.cache.generated_at = '2000-01-01'; await f.request({ editionId: B }); expect(f.fetchAI).toHaveBeenCalledTimes(5);
    f.state.readError = true; f.state.writeError = true;
    expect((await f.request({ editionId: B })).status).toBe(200); expect(f.fetchAI).toHaveBeenCalledTimes(6);
  });
  it('uses model helper default/configuration and rejects unsafe or empty model', async () => {
    const f = fixture(); await f.request(); expect(String(f.fetchAI.mock.calls[0][0])).toContain('/models/gemini-2.5-flash:generateContent');
    f.state.cache = null; f.env.GEMINI_MODEL = 'gemini-custom'; await f.request(); expect(String(f.fetchAI.mock.calls[1][0])).toContain('/models/gemini-custom:generateContent');
    for (const model of ['', '../escape?key=x', 'gemini/foo']) { f.state.cache = null; f.env.GEMINI_MODEL = model; expect((await f.request()).status).toBe(500); }
  });
  it('retries rate and upstream errors without leaking bodies, and rejects malformed responses', async () => {
    const f = fixture(); f.fetchAI.mockImplementation(async () => new Response('PRIVATE-UPSTREAM', { status: 429 }));
    const res = await f.request(); expect(res.status).toBe(429); expect(await res.text()).not.toContain('PRIVATE'); expect(f.fetchAI).toHaveBeenCalledTimes(2);
    f.fetchAI.mockImplementation(async () => new Response('PRIVATE-UPSTREAM', { status: 500 })); expect((await f.request()).status).toBe(502);
    for (const body of ['{}', 'invalid', JSON.stringify({ candidates: [{ content: { parts: [{ text: '{}' }] } }] }), JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"insights":[{}]}' }] } }] })]) {
      f.fetchAI.mockImplementation(async () => new Response(body)); expect((await f.request()).status).toBe(502);
    }
  });
  it('aborts Gemini after 25 seconds and returns 504', async () => {
    vi.useFakeTimers(); const f = fixture();
    f.fetchAI.mockImplementation(async (_url, init) => new Promise((_resolve, reject) => init!.signal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))));
    const pending = f.request(); await vi.waitFor(() => expect(f.fetchAI).toHaveBeenCalledTimes(1));
    await vi.advanceTimersByTimeAsync(25001);
    expect((await pending).status).toBe(504);
  });
});
