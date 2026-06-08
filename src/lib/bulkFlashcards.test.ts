import { describe, it, expect, vi } from 'vitest';
import type { Question } from '@/types';
import {
  clampCount,
  MAX_TOPIC_COUNT,
  MAX_QUESTIONS,
  QUESTIONS_CHUNK_SIZE,
  suggestDeckName,
  mapGeneratedCardsToPayloads,
  buildCadernoQuestionsInput,
  mapQuestionToBatchInput,
  buildQuestionsInput,
  buildTopicInput,
  mapErrorRowsToWeakEntries,
  chunkBatchInput,
  mapWithConcurrency,
  type BatchGenerateInput,
  type BatchQuestionInput,
  type GeneratedCard,
} from './bulkFlashcards';

describe('clampCount', () => {
  it('mantém valores dentro do range', () => {
    expect(clampCount(10, MAX_TOPIC_COUNT)).toBe(10);
  });
  it('clampa abaixo de 1 para 1', () => {
    expect(clampCount(0, MAX_TOPIC_COUNT)).toBe(1);
    expect(clampCount(-5, MAX_TOPIC_COUNT)).toBe(1);
  });
  it('clampa acima do máximo', () => {
    expect(clampCount(99, MAX_TOPIC_COUNT)).toBe(MAX_TOPIC_COUNT);
    expect(clampCount(99, MAX_QUESTIONS)).toBe(MAX_QUESTIONS);
  });
  it('trata NaN/undefined como 1', () => {
    expect(clampCount(NaN, MAX_TOPIC_COUNT)).toBe(1);
    expect(clampCount(undefined as unknown as number, MAX_TOPIC_COUNT)).toBe(1);
  });
});

describe('suggestDeckName', () => {
  it('usa o tema no modo topic', () => {
    expect(suggestDeckName({ mode: 'topic', area: 'Cardiologia', theme: 'Insuficiência Cardíaca', count: 10 }))
      .toBe('Insuficiência Cardíaca');
  });
  it('cai para a área quando não há tema', () => {
    expect(suggestDeckName({ mode: 'topic', area: 'Cardiologia', count: 10 }))
      .toBe('Cardiologia');
  });
  it('nomeia o lote do caderno pela área quando uniforme', () => {
    expect(suggestDeckName({
      mode: 'questions',
      questions: [
        { sourceRef: { entryId: 'a' }, questionStem: 'x', area: 'Pediatria' },
        { sourceRef: { entryId: 'b' }, questionStem: 'y', area: 'Pediatria' },
      ],
    })).toBe('Pediatria — erros');
  });
  it('usa rótulo genérico para caderno com áreas mistas', () => {
    expect(suggestDeckName({
      mode: 'questions',
      questions: [
        { sourceRef: { entryId: 'a' }, questionStem: 'x', area: 'Pediatria' },
        { sourceRef: { entryId: 'b' }, questionStem: 'y', area: 'Cardiologia' },
      ],
    })).toBe('Caderno de erros');
  });
  it('tem fallback final', () => {
    expect(suggestDeckName({ mode: 'topic', count: 10 })).toBe('Flashcards');
  });
});

describe('mapGeneratedCardsToPayloads', () => {
  const cards: GeneratedCard[] = [
    { front_md: 'P1', back_md: 'R1', sourceRef: { entryId: 'e1', questionId: 'q1' } },
    { front_md: 'P2', back_md: 'R2' },
  ];
  it('mapeia front/back e deck_id', () => {
    const out = mapGeneratedCardsToPayloads(cards, 'deck-9');
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ deck_id: 'deck-9', front_md: 'P1', back_md: 'R1' });
  });
  it('propaga sourceRef para entry_id/question_id', () => {
    const out = mapGeneratedCardsToPayloads(cards, 'deck-9');
    expect(out[0].entry_id).toBe('e1');
    expect(out[0].question_id).toBe('q1');
    expect(out[1].entry_id).toBeNull();
    expect(out[1].question_id).toBeNull();
  });
  it('descarta cards sem frente e sem verso', () => {
    const out = mapGeneratedCardsToPayloads(
      [{ front_md: '  ', back_md: '' }, { front_md: 'ok', back_md: 'ok' }],
      'd',
    );
    expect(out).toHaveLength(1);
  });
});

describe('buildCadernoQuestionsInput', () => {
  const rows = [
    { id: 'e1', question_id: 'q1', question_text: 'Enunciado 1', area: 'Cardio', theme: 'IC', ai_review_md: 'rev1', learning_text: 'nota1' },
    { id: 'e2', question_id: null, question_text: 'Enunciado 2', area: null, theme: null, ai_review_md: null, learning_text: null },
    { id: 'e3', question_id: 'q3', question_text: '', area: 'X', theme: 'Y', ai_review_md: null, learning_text: null },
  ];
  it('inclui só as entradas selecionadas com enunciado não-vazio', () => {
    const input = buildCadernoQuestionsInput(rows, new Set(['e1', 'e2', 'e3']));
    expect(input.mode).toBe('questions');
    expect(input.questions).toHaveLength(2);
    expect(input.questions!.map((q) => q.sourceRef.entryId)).toEqual(['e1', 'e2']);
  });
  it('mapeia contexto e sourceRef corretamente', () => {
    const input = buildCadernoQuestionsInput(rows, new Set(['e1']));
    expect(input.questions![0]).toMatchObject({
      sourceRef: { entryId: 'e1', questionId: 'q1' },
      questionStem: 'Enunciado 1',
      area: 'Cardio',
      theme: 'IC',
      aiReviewMd: 'rev1',
      learningNote: 'nota1',
    });
  });
});

const sampleQuestion: Question = {
  id: 'q1',
  number: 3,
  text: 'Conduta na IC com FE reduzida?',
  area: 'Cardiologia',
  theme: 'Insuficiência Cardíaca',
  options: [
    { id: 'o1', label: 'A', text: 'Opção A' },
    { id: 'o2', label: 'B', text: 'Opção B' },
    { id: 'o3', label: 'C', text: 'Opção C' },
  ],
  correctOptionId: 'o2',
};

describe('mapQuestionToBatchInput', () => {
  it('resolve correctOptionLabel a partir do correctOptionId', () => {
    expect(mapQuestionToBatchInput(sampleQuestion).correctOptionLabel).toBe('B');
  });
  it('usa stem, options, sourceRef.questionId e area/theme da questão', () => {
    const r = mapQuestionToBatchInput(sampleQuestion);
    expect(r.questionStem).toBe('Conduta na IC com FE reduzida?');
    expect(r.options).toEqual([
      { label: 'A', text: 'Opção A' },
      { label: 'B', text: 'Opção B' },
      { label: 'C', text: 'Opção C' },
    ]);
    expect(r.sourceRef).toEqual({ questionId: 'q1' });
    expect(r.area).toBe('Cardiologia');
    expect(r.theme).toBe('Insuficiência Cardíaca');
  });
  it('aceita overrides de area/theme/entryId', () => {
    const r = mapQuestionToBatchInput(sampleQuestion, { area: 'X', theme: 'Y', entryId: 'e9' });
    expect(r.area).toBe('X');
    expect(r.theme).toBe('Y');
    expect(r.sourceRef).toEqual({ questionId: 'q1', entryId: 'e9' });
  });
  it('correctOptionLabel é null quando o id não bate', () => {
    expect(mapQuestionToBatchInput({ ...sampleQuestion, correctOptionId: 'zzz' }).correctOptionLabel).toBeNull();
  });
});

describe('buildQuestionsInput', () => {
  it('monta modo questions a partir de itens', () => {
    const input = buildQuestionsInput([
      { q: sampleQuestion },
      { q: { ...sampleQuestion, id: 'q2', text: 'Outra?' }, area: 'Pneumo' },
    ]);
    expect(input.mode).toBe('questions');
    expect(input.questions).toHaveLength(2);
    expect(input.questions![0].sourceRef.questionId).toBe('q1');
    expect(input.questions![1].area).toBe('Pneumo');
  });
});

describe('buildTopicInput', () => {
  it('monta modo topic com count clampado', () => {
    expect(buildTopicInput('Cardio', 'IC', 99)).toEqual({ mode: 'topic', area: 'Cardio', theme: 'IC', count: 15 });
  });
  it('normaliza strings vazias para null', () => {
    expect(buildTopicInput('', '', 10)).toEqual({ mode: 'topic', area: null, theme: null, count: 10 });
  });
});

describe('chunkBatchInput', () => {
  const makeQuestions = (n: number): BatchQuestionInput[] =>
    Array.from({ length: n }, (_, i) => ({
      sourceRef: { entryId: `e${i}` },
      questionStem: `Enunciado ${i}`,
    }));

  it('fatia o modo questions em grupos do tamanho pedido', () => {
    const input: BatchGenerateInput = { mode: 'questions', questions: makeQuestions(13) };
    const chunks = chunkBatchInput(input, 6);
    expect(chunks).toHaveLength(3);
    expect(chunks.map((c) => c.questions!.length)).toEqual([6, 6, 1]);
    expect(chunks.every((c) => c.mode === 'questions')).toBe(true);
  });

  it('preserva todas as questões na ordem original', () => {
    const input: BatchGenerateInput = { mode: 'questions', questions: makeQuestions(10) };
    const flat = chunkBatchInput(input, 4).flatMap((c) => c.questions!);
    expect(flat.map((q) => q.sourceRef.entryId)).toEqual(makeQuestions(10).map((q) => q.sourceRef.entryId));
  });

  it('não fatia quando cabe num chunk só', () => {
    const input: BatchGenerateInput = { mode: 'questions', questions: makeQuestions(6) };
    expect(chunkBatchInput(input, 6)).toEqual([input]);
  });

  it('usa QUESTIONS_CHUNK_SIZE como padrão', () => {
    const input: BatchGenerateInput = { mode: 'questions', questions: makeQuestions(QUESTIONS_CHUNK_SIZE + 1) };
    expect(chunkBatchInput(input)).toHaveLength(2);
  });

  it('não fatia topic nem text (single-call)', () => {
    const topic: BatchGenerateInput = { mode: 'topic', area: 'Cardio', count: 15 };
    const text: BatchGenerateInput = { mode: 'text', rawText: 'x', count: 10 };
    expect(chunkBatchInput(topic, 6)).toEqual([topic]);
    expect(chunkBatchInput(text, 6)).toEqual([text]);
  });
});

describe('mapWithConcurrency', () => {
  it('processa todos os itens', async () => {
    const seen: number[] = [];
    await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (n) => { seen.push(n); });
    expect(seen.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
  });

  it('nunca passa do limite de tarefas simultâneas', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    await mapWithConcurrency(Array.from({ length: 10 }, (_, i) => i), 3, async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
    });
    expect(maxInFlight).toBeLessThanOrEqual(3);
  });

  it('lista vazia resolve sem chamar o worker', async () => {
    const worker = vi.fn(async () => {});
    await mapWithConcurrency([], 3, worker);
    expect(worker).not.toHaveBeenCalled();
  });
});

describe('mapErrorRowsToWeakEntries', () => {
  it('mapeia campos do error_notebook para WeakAreaEntry', () => {
    const rows = [{
      id: 'e1', area: 'Cardio', theme: 'IC', reason: 'did_not_know',
      created_at: '2026-01-01', mastered_at: null as string | null, srs_lapses: 2, srs_reps: 1, srs_due_at: '2026-02-01',
    }];
    const out = mapErrorRowsToWeakEntries(rows);
    expect(out[0]).toMatchObject({
      id: 'e1', area: 'Cardio', theme: 'IC', reason: 'did_not_know',
      addedAt: '2026-01-01', masteredAt: null, srsLapses: 2, srsReps: 1, srsDueAt: '2026-02-01',
    });
  });
});
