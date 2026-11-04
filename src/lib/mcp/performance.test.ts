import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { ToolContext } from '@lovable.dev/mcp-js';
import getMyPerformance from './tools/get-my-performance';
import { resolvePerformanceEdition } from './edition-scope';
import { readFileSync } from 'node:fs';

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }));
const editionA = { id: '11111111-1111-4111-8111-111111111111', code: '2026.2', label: '2026', year: 2026, term: 2, status: 'archived', exam_date: null as string | null };
const editionB = { id: '22222222-2222-4222-8222-222222222222', code: '2027.1', label: '2027', year: 2027, term: 1, status: 'preparing', exam_date: null as string | null };
const caller = new ToolContext({ type: 'oauth', principal: { claims: { sub: 'caller-id' }, sub: 'caller-id', scopes: [],
  issuer: 'https://test.invalid/auth/v1', resource: 'https://test.invalid/mcp', acceptedAudiences: ['authenticated'],
}, bearer: { token: 'caller-token' } });

function mockDb(editions = [editionA, editionB], profile: unknown = null, data: unknown = [{ total_attempts: 2, avg_score: 60 }], rpcError: unknown = null) {
  const eq = vi.fn();
  const from = vi.fn((table: string) => {
    const result = { data: table === 'exam_editions' ? editions : profile, error: null };
    const builder = { select: vi.fn(() => builder), eq: vi.fn((...args) => { eq(...args); return builder; }),
      maybeSingle: async () => result, then: (resolve: (v: typeof result) => unknown) => Promise.resolve(result).then(resolve) };
    return builder;
  });
  const rpc = vi.fn(async () => ({ data, error: rpcError }));
  vi.mocked(createClient).mockReturnValue({ from, rpc } as unknown as ReturnType<typeof createClient>);
  return { from, rpc, eq };
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('SUPABASE_URL', 'https://test.invalid');
  vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', 'public');
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('No network'); }));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('edition-scoped MCP performance', () => {
  it('uses a Zod 4 optional UUID, not an arbitrary user namespace', () => {
    const schema = getMyPerformance.inputSchema!.edition_id;
    expect(schema.safeParse(undefined).success).toBe(true);
    expect(schema.safeParse(editionB.id).success).toBe(true);
    expect(schema.safeParse('other-user').success).toBe(false);
  });
  it('uses the OAuth user, explicit historical edition and release-gated F1 RPC, never the cache', async () => {
    const { from, rpc } = mockDb();
    const result = await getMyPerformance.handler({ edition_id: editionA.id, ...{ user_id: 'victim-id' } }, caller);
    expect(rpc).toHaveBeenCalledExactlyOnceWith('get_user_performance_summary', {
      p_user_id: 'caller-id', p_edition_id: editionA.id, p_include_training: false,
    });
    expect(from).not.toHaveBeenCalledWith('user_performance_summary');
    expect(result).toMatchObject({ structuredContent: { scope: { edition_id: editionA.id, include_training: false }, performance: [{ total_attempts: 2 }] } });
    expect(createClient).toHaveBeenCalledWith('https://test.invalid', 'public', expect.objectContaining({ global: { headers: { Authorization: 'Bearer caller-token' } } }));
  });
  it.each([
    { profile: { target_edition_id: editionA.id, expected_graduation_term: editionB.code }, expected: editionA.id },
    { profile: { expected_graduation_term: editionB.code }, expected: editionB.id },
    { profile: null, expected: editionB.id },
  ])('resolves explicit profile, graduation then catalog without an invented date: $expected', async ({ profile, expected }) => {
    const { rpc, eq } = mockDb(undefined, profile);
    const result = await getMyPerformance.handler({ edition_id: undefined }, caller);
    expect(eq).toHaveBeenCalledWith('user_id', 'caller-id');
    expect(rpc).toHaveBeenCalledWith('get_user_performance_summary', { p_user_id: 'caller-id', p_edition_id: expected, p_include_training: false });
    expect(result).toMatchObject({ structuredContent: { scope: { edition_id: expected } } });
  });
  it('returns neutral with zero editions and never requests a NULL global aggregate', async () => {
    const { rpc } = mockDb([]);
    const result = await getMyPerformance.handler({ edition_id: undefined }, caller);
    expect(rpc).not.toHaveBeenCalled();
    expect(result).toMatchObject({ structuredContent: { scope: null, performance: [] } });
  });
  it('rejects unknown explicit editions instead of falling back to current', async () => {
    const { rpc } = mockDb([]);
    expect(await getMyPerformance.handler({ edition_id: editionA.id }, caller)).toMatchObject({ isError: true });
    expect(rpc).not.toHaveBeenCalled();
  });
  it('reports only the real scope when the RPC releases zero rows', async () => {
    const { rpc } = mockDb(undefined, null, []);
    const result = await getMyPerformance.handler({ edition_id: editionB.id }, caller);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ structuredContent: { scope: { edition_id: editionB.id }, performance: [] } });
  });
  it('does not expose raw errors or bypass RPC failure with a table query', async () => {
    const { from } = mockDb(undefined, null, null, { message: 'sensitive database error' });
    const result = await getMyPerformance.handler({ edition_id: editionB.id }, caller);
    expect(result).toMatchObject({ isError: true });
    expect(JSON.stringify(result)).not.toContain('sensitive');
    expect(from).not.toHaveBeenCalledWith('user_performance_summary');
  });
  it('a second OAuth namespace cannot obtain the first user data via input', async () => {
    const { rpc } = mockDb(undefined, null, []);
    const secondCaller = new ToolContext({ type: 'oauth', principal: { claims: { sub: 'other-id' }, sub: 'other-id', scopes: [],
      issuer: 'https://test.invalid/auth/v1', resource: 'https://test.invalid/mcp', acceptedAudiences: ['authenticated'],
    }, bearer: { token: 'other-token' } });
    const result = await getMyPerformance.handler({ edition_id: editionB.id, ...{ user_id: 'caller-id' } }, secondCaller);
    expect(rpc).toHaveBeenCalledExactlyOnceWith('get_user_performance_summary', { p_user_id: 'other-id', p_edition_id: editionB.id, p_include_training: false });
    expect(result).toMatchObject({ structuredContent: { performance: [] } });
  });
  it('catalog resolution uses only actual calendar dates and preserves undated fallbacks', async () => {
    const now = new Date('2026-11-04T01:00:00Z'); // still November 3 in Sao Paulo
    mockDb([
      { ...editionA, status: 'active', exam_date: '2026-11-03' },
      { ...editionB, exam_date: '2027-06-01' },
    ]);
    expect((await resolvePerformanceEdition(vi.mocked(createClient)('', ''), 'caller-id', undefined, now))?.id).toBe(editionA.id);
    mockDb([{ ...editionB, status: 'planned' }]);
    expect((await resolvePerformanceEdition(vi.mocked(createClient)('', ''), 'caller-id', undefined, now))?.id).toBe(editionB.id);
    mockDb([editionA]);
    expect(await resolvePerformanceEdition(vi.mocked(createClient)('', ''), 'caller-id', undefined, now)).toBeNull();
  });
  it('repository SQL evidence: F1 summary delegates to owned, edition/release-gated history, not the summary cache', () => {
    const sql = readFileSync('supabase/migrations/20261104084903_fase1_performance_scope.sql', 'utf8');
    const summary = sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION public.get_user_performance_summary'), sql.indexOf('-- Preserve the actual production ACL'));
    expect(summary).toContain('public.get_user_performance_history(');
    expect(summary).toContain('WHERE p_user_id=auth.uid()');
    expect(summary).not.toContain('FROM public.user_performance_summary');
    expect(sql).toContain('AND s.results_release_at<=now()');
    expect(sql).toContain('AND (p_edition_id IS NULL OR s.edition_id=p_edition_id)');
    expect(sql).toContain('AND (coalesce(p_include_training,true) OR a.is_within_window=true)');
  });
});
