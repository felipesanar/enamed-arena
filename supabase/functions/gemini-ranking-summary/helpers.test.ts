import { buildPrompt } from './handler.ts';
import { SummaryError } from '../_shared/aiEditionContext.ts';

function assert(value: unknown): asserts value { if (!value) throw new Error('Assertion failed'); }
const body = { userScore: 70, userPosition: 3, totalCandidates: 20, averageScore: 55, top10Cutoff: 65 };
Deno.test('ranking prompt retains actual class comparisons, not an alternate percentile', () => {
  const prompt = buildPrompt(body);
  assert(prompt.includes('"aheadOfAverage":15') && prompt.includes('"gapToTop10":-5'));
  assert(!prompt.includes('percentile":') && !prompt.includes('top 85%'));
});
Deno.test('legacy unsourced cutoff and destinations cannot become approval evidence', () => {
  const prompt = buildPrompt({ ...body, institutions: ['FORGED_DESTINATION'], specialty: 'FORGED_SPECIALTY',
    cutoffContext: { has_target_cutoff: true, matches: [{ matched_institution: 'FORGED_DESTINATION', cutoff_general: 50 }] } });
  assert(!prompt.includes('FORGED') && !prompt.includes('cutoff_general') && !prompt.includes('50%'));
});
for (const patch of [{ userPosition: 0 }, { totalCandidates: 2 }, { userScore: 101 }, { top10Cutoff: null }]) {
  Deno.test(`ranking rejects invalid metrics ${JSON.stringify(patch)}`, () => {
    let failed = false;
    try { buildPrompt({ ...body, ...patch }); } catch (error) { failed = error instanceof SummaryError && error.status === 400; }
    assert(failed);
  });
}
