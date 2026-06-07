import { describe, it, expect } from 'vitest';
import { questionRef, buildRefMap, mapParsedCards, parseCardsLenient } from './cardMapping';

describe('questionRef', () => {
  it('produces a stable token per position', () => {
    expect(questionRef(0)).toBe('q0');
    expect(questionRef(3)).toBe('q3');
  });
});

describe('buildRefMap', () => {
  it('maps each ref token to the question sourceRef', () => {
    const map = buildRefMap([
      { sourceRef: { entryId: 'e0', questionId: 'qid0' } },
      { sourceRef: { entryId: 'e1' } },
    ]);
    expect(map.get('q0')).toEqual({ entryId: 'e0', questionId: 'qid0' });
    expect(map.get('q1')).toEqual({ entryId: 'e1' });
  });

  it('skips questions without a sourceRef', () => {
    const map = buildRefMap([{}, { sourceRef: { entryId: 'e1' } }]);
    expect(map.has('q0')).toBe(false);
    expect(map.get('q1')).toEqual({ entryId: 'e1' });
  });
});

describe('parseCardsLenient', () => {
  it('parses a complete JSON array as non-partial', () => {
    const raw = JSON.stringify([
      { ref: 'q0', front_md: 'Frente 0', back_md: 'Verso 0' },
      { ref: 'q1', front_md: 'Frente 1', back_md: 'Verso 1' },
    ]);
    const { cards, partial } = parseCardsLenient(raw);
    expect(cards).toHaveLength(2);
    expect(partial).toBe(false);
    expect(cards[1]).toEqual({ ref: 'q1', front_md: 'Frente 1', back_md: 'Verso 1' });
  });

  it('returns empty non-partial for blank input', () => {
    expect(parseCardsLenient('')).toEqual({ cards: [], partial: false });
    expect(parseCardsLenient('   ')).toEqual({ cards: [], partial: false });
  });

  it('returns empty non-partial when valid JSON is not an array', () => {
    expect(parseCardsLenient('{"front_md":"x","back_md":"y"}')).toEqual({ cards: [], partial: false });
  });

  it('recovers complete objects from a JSON array truncated mid-object (MAX_TOKENS)', () => {
    // Gemini cut off while writing the 3rd object's back_md.
    const raw =
      '[{"ref":"q0","front_md":"F0","back_md":"V0"},' +
      '{"ref":"q1","front_md":"F1","back_md":"V1"},' +
      '{"ref":"q2","front_md":"F2","back_md":"V2 incomple';
    const { cards, partial } = parseCardsLenient(raw);
    expect(partial).toBe(true);
    expect(cards).toHaveLength(2);
    expect(cards[0]).toEqual({ ref: 'q0', front_md: 'F0', back_md: 'V0' });
    expect(cards[1]).toEqual({ ref: 'q1', front_md: 'F1', back_md: 'V1' });
  });

  it('does not get confused by braces or escaped quotes inside string content', () => {
    const raw =
      '[{"ref":"q0","front_md":"Use {chave} e \\"aspas\\"","back_md":"V0"},' +
      '{"ref":"q1","front_md":"F1 } com chave solta","back_md":"V1"},' +
      '{"ref":"q2","front_md":"F2","back_md":"trunc';
    const { cards, partial } = parseCardsLenient(raw);
    expect(partial).toBe(true);
    expect(cards).toHaveLength(2);
    expect(cards[0].front_md).toBe('Use {chave} e "aspas"');
    expect(cards[1].front_md).toBe('F1 } com chave solta');
  });

  it('returns empty partial when nothing complete can be recovered', () => {
    const raw = '[{"ref":"q0","front_md":"F0","back_md":"V0 trun';
    const { cards, partial } = parseCardsLenient(raw);
    expect(partial).toBe(true);
    expect(cards).toEqual([]);
  });
});

describe('mapParsedCards (questions mode)', () => {
  const refMap = buildRefMap([
    { sourceRef: { entryId: 'e0', questionId: 'qid0' } },
    { sourceRef: { entryId: 'e1', questionId: 'qid1' } },
  ]);

  it('links each card to its sourceRef by ref', () => {
    const { cards, unlinked, orphanRefs } = mapParsedCards(
      [
        { ref: 'q0', front_md: 'Frente 0', back_md: 'Verso 0' },
        { ref: 'q1', front_md: 'Frente 1', back_md: 'Verso 1' },
      ],
      'questions',
      refMap,
    );
    expect(cards).toHaveLength(2);
    expect(cards[0].sourceRef).toEqual({ entryId: 'e0', questionId: 'qid0' });
    expect(cards[1].sourceRef).toEqual({ entryId: 'e1', questionId: 'qid1' });
    expect(unlinked).toBe(0);
    expect(orphanRefs).toEqual([]);
  });

  it('keeps linkage correct when the AI reorders the cards', () => {
    const { cards } = mapParsedCards(
      [
        { ref: 'q1', front_md: 'Frente 1', back_md: 'Verso 1' },
        { ref: 'q0', front_md: 'Frente 0', back_md: 'Verso 0' },
      ],
      'questions',
      refMap,
    );
    // Position 0 carries ref q1 -> must resolve to e1, NOT to position-0's e0.
    expect(cards[0].sourceRef).toEqual({ entryId: 'e1', questionId: 'qid1' });
    expect(cards[1].sourceRef).toEqual({ entryId: 'e0', questionId: 'qid0' });
  });

  it('keeps a card but drops linkage when ref is missing (orphan), and reports it', () => {
    const { cards, unlinked, orphanRefs } = mapParsedCards(
      [{ front_md: 'Sem ref', back_md: 'Verso' }],
      'questions',
      refMap,
    );
    expect(cards).toHaveLength(1);
    expect(cards[0].sourceRef).toBeUndefined();
    expect(unlinked).toBe(1);
    expect(orphanRefs).toHaveLength(1);
  });

  it('keeps a card but drops linkage when ref is unknown / out of range', () => {
    const { cards, unlinked, orphanRefs } = mapParsedCards(
      [
        { ref: 'q99', front_md: 'Alucinado', back_md: 'Verso' },
        { ref: 'q-1', front_md: 'Negativo', back_md: 'Verso' },
      ],
      'questions',
      refMap,
    );
    expect(cards).toHaveLength(2);
    expect(cards[0].sourceRef).toBeUndefined();
    expect(cards[1].sourceRef).toBeUndefined();
    expect(unlinked).toBe(2);
    expect(orphanRefs).toEqual(['q99', 'q-1']);
  });

  it('drops cards missing front_md or back_md', () => {
    const { cards } = mapParsedCards(
      [
        { ref: 'q0', front_md: '', back_md: 'Verso' },
        { ref: 'q1', front_md: 'Frente', back_md: '' },
      ],
      'questions',
      refMap,
    );
    expect(cards).toHaveLength(0);
  });

  it('strips em-dashes and trims content', () => {
    const { cards } = mapParsedCards(
      [{ ref: 'q0', front_md: '  Conduta — imediata  ', back_md: 'Verso' }],
      'questions',
      refMap,
    );
    expect(cards[0].front_md).not.toContain('—');
    expect(cards[0].front_md.startsWith(' ')).toBe(false);
  });
});

describe('mapParsedCards (non-questions modes)', () => {
  it('ignores ref and never links a sourceRef in topic/text mode', () => {
    const refMap = buildRefMap([{ sourceRef: { entryId: 'e0' } }]);
    const { cards, unlinked } = mapParsedCards(
      [{ ref: 'q0', front_md: 'Frente', back_md: 'Verso' }],
      'topic',
      refMap,
    );
    expect(cards[0].sourceRef).toBeUndefined();
    expect(unlinked).toBe(0);
  });
});
