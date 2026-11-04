import { describe, expect, it } from 'vitest';
import { deriveScenario } from './simuladoBannerScenario';
import type { SimuladoWithStatus } from '@/types';
import type { ExamEdition } from '@/types/edition';
const edition = { id: 'e' } as ExamEdition;
const now = new Date('2027-02-01T12:00:00Z');
function sim(id: string, overrides = {}): SimuladoWithStatus {
  return { id, title: id, editionId: 'e', executionWindowStart: '2027-01-31', executionWindowEnd: '2027-02-03',
    resultsReleaseAt: '2027-02-04', status: 'available', ...overrides } as SimuladoWithStatus;
}
describe('scoped simulado banner', () => {
  it('uses the same earliest closing window and ignores other editions', () => {
    expect(deriveScenario([sim('other', { editionId: 'old', executionWindowEnd: '2027-02-01T13:00:00Z' }),
      sim('later'), sim('first', { executionWindowEnd: '2027-02-02' })], edition, now)).toMatchObject({ type: 'open_not_done', simuladoId: 'first' });
  });
  it('old completed does not hide upcoming; missing target never falls back globally', () => {
    const sims = [sim('old', { editionId: 'old', userState: { finished: true } }),
      sim('next', { executionWindowStart: '2027-02-02' })];
    expect(deriveScenario(sims, edition, now).type).toBe('before_window');
    expect(deriveScenario(sims, null, now).type).toBe('no_upcoming');
  });
  it('expires released result on day 14 and tolerates invalid dates', () => {
    const done = sim('done', { resultsReleaseAt: '2027-01-18T00:00:00-03:00', userState: { finished: true }, status: 'completed' });
    expect(deriveScenario([done], edition, now).type).toBe('no_upcoming');
    expect(() => deriveScenario([sim('bad', { executionWindowEnd: 'invalid', resultsReleaseAt: 'invalid' })], edition, now)).not.toThrow();
  });
});
