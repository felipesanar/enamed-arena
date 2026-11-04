import { resolveAiEditionContext, editionPrompt, type EditionClient } from './aiEditionContext.ts';
import { computePercentile } from '../../../src/lib/ranking-percentile.ts';
const test = typeof Deno !== 'undefined' ? Deno.test
  : (globalThis as unknown as { test: (name: string, fn: () => unknown) => void }).test;

const editionId = '11111111-1111-4111-8111-111111111111';
const otherId = '22222222-2222-4222-8222-222222222222';
const simuladoId = '33333333-3333-4333-8333-333333333333';
const format = { questions: 120, options: 5, duration_minutes: 300, scoring: 'tri' };
const edition = { id: editionId, label: 'ENAMED 2027', format };
const context = () => ({ editionId, editionLabel: edition.label, format: { ...format }, percentile: computePercentile(1, 6), cutoffReference: null });
function assert(value: unknown, message = 'Assertion failed'): asserts value {
  if (!value) throw new Error(message);
}
function client(overrides: Record<string, unknown> = {}, cutoff: unknown = null) {
  const calls: unknown[] = [];
  const rows: Record<string, unknown> = {
    exam_editions: edition,
    simulados: { id: simuladoId, edition_id: editionId, results_release_at: '2026-01-01T00:00:00Z' },
    ...overrides,
  };
  const db = {
    from(table: string) {
      calls.push(table);
      const builder = { select: () => builder, eq: () => builder, maybeSingle: () => Promise.resolve({ data: rows[table], error: null }) };
      return builder;
    },
    rpc(name: string, args: unknown) { calls.push([name, args]); return Promise.resolve({ data: cutoff, error: null }); },
  } as unknown as EditionClient;
  return { db, calls };
}
async function rejects(body: Record<string, unknown>, overrides = {}, cutoff: unknown = null) {
  try { await resolveAiEditionContext(client(overrides, cutoff).db, 'caller', body); }
  catch (e) { assert(e instanceof Error && 'status' in e && e.status === 400); return; }
  throw new Error('Expected invalid context');
}

test('legacy names never infer an edition, format, cutoff or percentile', async () => {
  const { db, calls } = client();
  const result = await resolveAiEditionContext(db, 'caller', { simuladoTitle: 'ENAMED 2027' });
  assert(result === null && calls.length === 0);
  assert(editionPrompt(result).includes('desconhecido'));
});

test('catalog format and exact client Top X% reach the prompt, without a TRI cutoff', async () => {
  const result = await resolveAiEditionContext(client().db, 'caller', { editionContext: context() });
  const prompt = editionPrompt(result);
  assert(prompt.includes('120 questões') && prompt.includes('5 alternativas') && prompt.includes('300 minutos'));
  assert(prompt.includes('Top 17%') && prompt.includes('TRI') && prompt.includes('Corte: desconhecido'));
  assert(!prompt.includes('50%') && !prompt.includes('2027-'));
});

test('second edition has a distinct catalog format and unknown percentile', async () => {
  const legacyFormat = { questions: 100, options: 4, duration_minutes: 240, scoring: 'raw' };
  const ctx = { ...context(), editionId: otherId, format: legacyFormat, percentile: null };
  const result = await resolveAiEditionContext(client({ exam_editions: { ...edition, id: otherId, format: legacyFormat } }).db, 'caller', { editionContext: ctx });
  assert(editionPrompt(result).includes('100 questões; 4 alternativas; 240 minutos'));
  assert(editionPrompt(result).includes('Top X%: desconhecido'));
});

test('rejects forged catalog labels, formats, IDs and invalid percentiles', async () => {
  for (const patch of [
    { editionId: 'not-uuid' }, { editionLabel: 'forged' },
    { format: { ...format, questions: 100 } }, { format: { ...format, injected: 'instructions' } },
    { percentile: 0 }, { percentile: 100 }, { percentile: '17' }, { percentile: NaN },
  ]) await rejects({ editionContext: { ...context(), ...patch } });
  await rejects({ editionContext: context() }, { exam_editions: null });
});

test('identified simulations require matching edition and released results', async () => {
  await rejects({ editionContext: context(), simuladoId }, { simulados: { id: simuladoId, edition_id: otherId, results_release_at: '2026-01-01' } });
  await rejects({ editionContext: context(), simuladoId }, { simulados: { id: simuladoId, edition_id: editionId, results_release_at: '2999-01-01' } });
  await rejects({ simuladoId }, { simulados: null });
  await rejects({ simuladoId }, { simulados: { id: simuladoId, edition_id: editionId, results_release_at: null } });
  const result = await resolveAiEditionContext(client().db, 'caller', { simuladoId });
  assert(result?.editionId === editionId);
});

test('explicit series requires real IDs from the same edition, never title matching', async () => {
  await rejects({ editionContext: context(), simulados: [{ title: 'S1' }, { title: 'S2' }] });
  await rejects({ simuladoId, simulados: [{ title: 'S1' }, { title: 'S2' }] });
  await rejects({ editionContext: context(), simulados: [{ simuladoId }] }, { simulados: { id: simuladoId, edition_id: otherId, results_release_at: '2026-01-01' } });
  assert(await resolveAiEditionContext(client().db, 'caller', { editionContext: context(), simulados: [{ simuladoId }] }));
});

test('cutoff must exactly match a sourced caller RPC row, not a client destination', async () => {
  const ref = { label: 'Referência conhecida', source: 'Fonte publicada', value: 700 };
  const rpc = { reference_edition_id: editionId, reference_label: ref.label, matches: [
    { reference_edition_id: editionId, reference_label: ref.label, source: ref.source, cutoff_general: ref.value },
  ] };
  const { db, calls } = client({}, rpc);
  const result = await resolveAiEditionContext(db, 'caller', { editionContext: { ...context(), cutoffReference: ref } });
  assert(result?.cutoffReference?.value === 700);
  assert(JSON.stringify(calls).includes('"p_user_id":"caller"'));
  assert(editionPrompt(result).includes('escalas diferentes'));
  await rejects({ editionContext: { ...context(), cutoffReference: { ...ref, value: 50 } } }, {}, rpc);
  await rejects({ editionContext: { ...context(), cutoffReference: ref } });
  await rejects({ editionContext: { ...context(), cutoffReference: ref } }, {}, { ...rpc, reference_edition_id: otherId });
  await rejects({ editionContext: { ...context(), cutoffReference: ref } }, {}, { matches: [{ cutoff_general: 700 }] });
});
