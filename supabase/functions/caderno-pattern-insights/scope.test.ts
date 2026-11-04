// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { loadPatternScope, patternFingerprint, cacheMatches, scopeInsights, safeCta, parsePatternData } from './scope';
function client(segment = 'pro') {
  const rpc = vi.fn(async (name: string) => ({ data: name === 'get_exam_editions' ? [{ id: '11111111-1111-4111-8111-111111111111', label: 'ENAMED 2027.1' }] : {
    total_entries: 5, total_mastered: 0, area_cause_dist: [], overconf: [], roi_data: [], recurring_confusion_candidates: [], question_samples: [],
  }, error: null }));
  const read = async () => ({ data: { segment }, error: null });
  return { auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'owner' } as { id: string } | null }, error: null })) },
    from: vi.fn(() => ({ select: () => ({ eq: () => ({ single: read, maybeSingle: read }) }), upsert: async () => ({ error: null }) })), rpc };
}
describe('pattern insights scope boundary', () => {
  it('ignores body userId, checks real profile and forwards only validated edition scope', async () => {
    const c = client(); const editionId = '11111111-1111-4111-8111-111111111111';
    expect(await loadPatternScope(c, { userId: 'victim', segment: 'pro', editionId })).toMatchObject({ userId: 'owner', editionId });
    expect(c.rpc).toHaveBeenLastCalledWith('get_caderno_pattern_data', { p_user_id: 'owner', p_edition_id: editionId });
  });
  it('rejects non PRO and unauthenticated users before any RPC', async () => {
    const c = client('standard'); await expect(loadPatternScope(c, {})).rejects.toMatchObject({ status: 403 }); expect(c.rpc).not.toHaveBeenCalled();
    c.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(loadPatternScope(c, {})).rejects.toMatchObject({ status: 401 });
  });
  it('rejects malformed/unknown editions; missing edition-aware RPC returns 503 without fallback', async () => {
    const c = client();
    await expect(loadPatternScope(c, { editionId: 'bad' })).rejects.toMatchObject({ status: 400 });
    await expect(loadPatternScope(c, { editionId: '22222222-2222-4222-8222-222222222222' })).rejects.toMatchObject({ status: 400 });
    c.rpc.mockImplementation(async name => name === 'get_exam_editions' ? { data: [], error: null } : { data: null, error: { code: 'PGRST202', message: 'SECRET' } } as never);
    await expect(loadPatternScope(c, { editionId: null })).rejects.toMatchObject({ status: 503 });
    expect(c.rpc.mock.calls.filter(([name]) => name === 'get_caderno_pattern_data')).toHaveLength(1);
  });
  it('hashes actual data not entry counts; rejects untagged, wrong scope/hash and expired caches', async () => {
    const hash = await patternFingerprint({ total: 5, area: 'A' });
    expect(await patternFingerprint({ area: 'A', total: 5 })).toBe(hash);
    expect(await patternFingerprint({ total: 5, area: 'B' })).not.toBe(hash);
    const payload = { cache_version: 2, versionContext: 'notebook-pattern-edition-v2', editionScope: 'a', editionId: 'a', patternHash: hash, dataHash: hash };
    expect(cacheMatches({ payload, generated_at: new Date().toISOString() }, 'a', hash)).toBe(true);
    for (const [scope, h] of [['b', hash], ['a', 'other']]) expect(cacheMatches({ payload, generated_at: new Date().toISOString() }, scope, h)).toBe(false);
    expect(cacheMatches({ payload: {}, generated_at: new Date().toISOString() }, null, hash)).toBe(false);
    expect(cacheMatches({ payload, generated_at: '2000-01-01' }, 'a', hash)).toBe(false);
  });
  it('removes cumulative ROI and blocks external CTA while preserving edition on valid internal links', () => {
    const insights = [{ type: 'roi', cta: null }, { type: 'dominant_cause', cta: { label: 'Revisar', href: '/caderno?area=A' } }, { type: 'weak_area', cta: { href: 'https://evil.invalid' } }];
    expect(scopeInsights(insights, null)).toHaveLength(2);
    expect(scopeInsights(insights, 'edition-a')[1].cta?.href).toBe('/caderno?area=A&edition=edition-a');
    expect(scopeInsights(insights, null)[1].cta).toBeNull();
  });
  it('rejects unsafe root-path variants and replaces every model edition parameter', () => {
    for (const href of ['//evil.invalid', '/\\evil.invalid', 'javascript:alert(1)', 'caderno', '/%2f%2fevil.invalid', '/caderno\n', '/%5cevil.invalid', '/%00evil', 'https://evil.invalid']) {
      expect(safeCta({ label: 'Revisar', href }, 'a')).toBeNull();
    }
    expect(safeCta({ label: 'Revisar', href: '/caderno/revisao?edition=bad&edition=bad2&editionId=bad&reason=reading_error' }, 'a')?.href)
      .toBe('/caderno/revisao?reason=reading_error&edition=a');
    expect(safeCta({ label: 'Revisar', href: '/caderno?edition=bad&area=CM' }, null)?.href).toBe('/caderno?area=CM');
    expect(safeCta({ label: 'Revisar', href: '/desempenho' }, 'a')?.href).toBe('/desempenho');
  });
  it('never accepts future/invalid cache timestamps or expired boundary', () => {
    const now = Date.now(), payload = { cache_version: 2, versionContext: 'notebook-pattern-edition-v2', editionScope: null, editionId: null, patternHash: 'hash', dataHash: 'hash' };
    for (const generated_at of ['invalid', new Date(now + 1).toISOString(), new Date(now - 86400000).toISOString()]) {
      expect(cacheMatches({ payload, generated_at }, null, 'hash', now)).toBe(false);
    }
  });
  it('requires the aggregate contract including valid row types and real numbers', () => {
    const data = { total_entries: 5, total_mastered: 0, area_cause_dist: [], overconf: [], roi_data: [], recurring_confusion_candidates: [], question_samples: [] };
    for (const change of [{ total_entries: -1 }, { total_mastered: 6 }, { total_entries: NaN }, { total_entries: 1.5 },
      { area_cause_dist: [{}] }, { roi_data: [{ area: 'CM', first_mastered_at: 'bad', score_before: 0, score_after: 1 }] },
      { roi_data: [{ area: 'CM', first_mastered_at: '2026-01-01', score_before: 2, score_after: 1 }] },
      { overconf: [{ area: 'CM', high_conf_wrong: 2, high_conf_total: 1 }] },
      { recurring_confusion_candidates: [null] }, { question_samples: 'bad' }]) {
      expect(() => parsePatternData({ ...data, ...change })).toThrow();
    }
    expect(parsePatternData({ ...data, area_cause_dist: null }).area_cause_dist).toEqual([]);
  });
});
