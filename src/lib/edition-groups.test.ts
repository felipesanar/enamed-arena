import { describe, expect, it } from 'vitest';
import { groupSimuladosByEdition, editionBadge } from '@/lib/edition-groups';
import type { SimuladoConfig } from '@/types';

describe('edition groups', () => {
  const current = { id: 'b', editionId: 'new', editionCode: '2027.1', sequenceNumber: 1 };
  const old = { id: 'a', editionId: 'old', editionCode: '2026', sequenceNumber: 1 };

  it('puts the selected edition first without merging repeated sequence numbers', () => {
    const items: Array<Pick<SimuladoConfig, 'id' | 'sequenceNumber' | 'editionId' | 'editionCode'>> = [
      old, current, { id: 'legacy', sequenceNumber: 1 },
    ];
    const groups = groupSimuladosByEdition(items, 'new');
    expect(groups.map(g => g.key)).toEqual(['id:new', 'id:old', 'legacy']);
    expect(groups[0].items).toEqual([current]);
    expect(groups[0].isCurrent).toBe(true);
    expect(groups[1].label).toBe('ENAMED 2026');
    expect(groups[2].label).toBe('Legado sem edição');
  });

  it('keeps all history when no edition is resolved and never invents an edition', () => {
    expect(groupSimuladosByEdition([current, old], null).every(g => !g.isCurrent)).toBe(true);
    expect(editionBadge({})).toBe('ENAMED');
    expect(editionBadge(current)).toBe('ENAMED 2027.1');
  });

  it('uses code only when id is absent, never sequence or the clock', () => {
    expect(groupSimuladosByEdition([{ id: 'c', editionCode: '2027.2' }, { id: 'd' }]).map(g => g.key)).toEqual(['code:2027.2', 'legacy']);
  });
});
