import { createHandler as performance } from './handler.ts';
import { createHandler as ranking } from '../gemini-ranking-summary/handler.ts';
import { createHandler as comparative } from '../gemini-comparative-summary/handler.ts';
import type { EditionClient } from '../_shared/aiEditionContext.ts';

function assert(value: unknown): asserts value { if (!value) throw new Error('Assertion failed'); }
const editionId = '11111111-1111-4111-8111-111111111111';
const simuladoId = '33333333-3333-4333-8333-333333333333';
const format = { questions: 120, options: 5, duration_minutes: 300, scoring: 'tri' };
const entry = { simuladoId, title: 'S1', sequenceNumber: 1, percentageScore: 60, totalCorrect: 72, totalQuestions: 120,
  durationSeconds: 9000, tabExits: 0, fullscreenExits: 0, markedForReview: 0, highConfidenceTotal: 0, highConfidenceCorrect: 0, byArea: [] };
const fixtures = [
  { name: 'performance', factory: performance, body: { overall: { totalQuestions: 120, totalCorrect: 72, totalAnswered: 120, percentageScore: 60 } } },
  { name: 'ranking', factory: ranking, body: { userScore: 60, userPosition: 3, totalCandidates: 20, averageScore: 55, top10Cutoff: 65 } },
  { name: 'comparative', factory: comparative, body: { simulados: [entry, { ...entry, sequenceNumber: 2 }] } },
];

for (const fixture of fixtures) {
  Deno.test(`${fixture.name}: actual handler uses catalog format, exact percentile and safe model without network`, async () => {
    let captured = '', requestedUrl = '', authenticated = true, calls = 0;
    const handler = fixture.factory({
      env: key => ({ SUPABASE_URL: 'https://test.invalid', SUPABASE_ANON_KEY: 'public', GEMINI_API_KEY: 'fake', GEMINI_MODEL: 'gemini-2.5-pro' })[key],
      createClient: () => ({
        auth: { getUser: () => Promise.resolve({ data: { user: authenticated ? { id: 'caller' } : null }, error: null }) },
        from(table: string) {
          const query = { select: () => query, eq: () => query, maybeSingle: () => Promise.resolve({ error: null,
            data: table === 'simulados' ? { id: simuladoId, edition_id: editionId, results_release_at: '2026-01-01' }
              : { id: editionId, label: 'Edição sem data oficial', format },
          }) };
          return query;
        },
      } as unknown as EditionClient),
      fetch: ((url, init) => {
        calls++; requestedUrl = String(url);
        const payload = JSON.parse(String(init?.body));
        assert(payload.generationConfig.thinkingConfig === undefined);
        captured = payload.contents[0].parts[0].text;
        return Promise.resolve(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Texto — sem travessão' }] } }] })));
      }) as typeof fetch,
    });
    const request = (body: unknown, authorization = 'Bearer token') => new Request('https://test.invalid', {
      method: 'POST', headers: { Authorization: authorization }, body: JSON.stringify(body),
    });
    const body = { ...fixture.body, editionContext: { editionId, editionLabel: 'Edição sem data oficial', format, percentile: 13, cutoffReference: null } };
    let response = await handler(request(body));
    assert(response.status === 200);
    assert((await response.json()).markdown === 'Texto. sem travessão');
    assert(captured.includes('Top 13%') && !captured.includes('Top 87%'));
    assert(captured.includes('120 questões; 5 alternativas; 300 minutos'));
    assert(!captured.includes('100 questões em 4') && !captured.includes('50%'));
    assert(captured.includes('Corte: desconhecido') && requestedUrl.includes('/gemini-2.5-pro:'));
    authenticated = false;
    response = await handler(request(body));
    assert(response.status === 401 && calls === 1);
    response = await handler(request(body, ''));
    assert(response.status === 401 && calls === 1);
    authenticated = true;
    response = await handler(request({}));
    assert(response.status === 400 && calls === 1);
    response = await handler(request({ ...body, editionContext: { ...body.editionContext, percentile: 100 } }));
    assert(response.status === 400 && calls === 1);
    response = await handler(request({ ...fixture.body, cutoffContext: { has_target_cutoff: true, matches: [{ cutoff_general: 50 }] } }));
    assert(response.status === 200);
    assert(!captured.includes('cutoff_general') && captured.includes('Top X%: desconhecido'));
  });
}
