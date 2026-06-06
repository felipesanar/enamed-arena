import { describe, it, expect } from 'vitest';
import {
  clampCount,
  MAX_TOPIC_COUNT,
  MAX_QUESTIONS,
  suggestDeckName,
  mapGeneratedCardsToPayloads,
  buildCadernoQuestionsInput,
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
