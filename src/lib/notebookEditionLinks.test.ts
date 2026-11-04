import { describe, expect, it } from 'vitest';
import { notebookEditionLink } from '@/lib/notebookEditionLinks';
describe('notebook edition navigation', () => {
  it('preserves existing mode/entry and encodes scope only while enabled', () => {
    expect(notebookEditionLink('/caderno/revisao?mode=due&entry=q1', 'edition-a', true)).toBe('/caderno/revisao?mode=due&entry=q1&edition=edition-a');
    expect(notebookEditionLink('/caderno?mode=due&edition=old', null, false)).toBe('/caderno?mode=due');
  });
  it('does not promise filtering on favorites or flashcards', () => {
    expect(notebookEditionLink('/caderno/favoritos', 'edition-a', true)).toBe('/caderno/favoritos');
    expect(notebookEditionLink('/caderno/insights', 'edition-a', true)).toBe('/caderno/insights?edition=edition-a');
  });
});
