import { buildPrompt } from './handler.ts';
import { SummaryError } from '../_shared/aiEditionContext.ts';

function assert(value: unknown): asserts value { if (!value) throw new Error('Assertion failed'); }
function entry(sequenceNumber: number, percentageScore: number, area: number) {
  return { title: `S${sequenceNumber}`, sequenceNumber, percentageScore, totalCorrect: percentageScore,
    totalQuestions: 100, durationSeconds: 7200, tabExits: 0, fullscreenExits: 0, markedForReview: 0,
    highConfidenceTotal: 10, highConfidenceCorrect: 7, byArea: [{ area: 'Pediatria', score: area }] };
}
Deno.test('production comparative analytics sorts the series and retains area deltas, mean and stability', () => {
  const prompt = buildPrompt({ simulados: [entry(2, 60, 70), entry(1, 40, 50)] });
  assert(prompt.includes('"delta":20,"average":50,"best":60,"worst":40,"standardDeviation":10'));
  assert(prompt.includes('"area":"Pediatria","firstScore":50,"lastScore":70,"delta":20'));
  assert(prompt.indexOf('"title":"S1"') < prompt.indexOf('"title":"S2"'));
});
Deno.test('no fixed official format, cutoff goal or score-based approval scenario remains', () => {
  const prompt = buildPrompt({ simulados: [entry(1, 45, 45), entry(2, 60, 60)] });
  for (const forbidden of ['50%', '4 horas', '144s', 'acima_corte', 'rumo_a_corte', 'GOAL']) assert(!prompt.includes(forbidden));
  assert(prompt.includes('escopo desconhecido') && prompt.includes('proficiência TRI'));
});
Deno.test('missing area observations are unknown, never invented zeroes', () => {
  const prompt = buildPrompt({ simulados: [{ ...entry(1, 45, 45), byArea: [] }, entry(2, 60, 60)] });
  assert(prompt.includes('"firstScore":null,"lastScore":60,"delta":null'));
});
for (const simulados of [[], [entry(1, 45, 45)], [{ ...entry(1, 45, 45), durationSeconds: -1 }, entry(2, 60, 60)]]) {
  Deno.test(`production comparative rejects invalid series of size ${simulados.length}`, () => {
    let failed = false;
    try { buildPrompt({ simulados }); } catch (error) { failed = error instanceof SummaryError && error.status === 400; }
    assert(failed);
  });
}
