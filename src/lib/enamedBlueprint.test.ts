import { describe, expect, it } from 'vitest';
import { resolveBlueprintArea, adaptEditionBlueprint } from './enamedBlueprint';
import type { ExamArea } from '@/types/edition';

const areas: ExamArea[] = [
  { id: 'mfc', blueprint_id: 'b', code: 'mfc', label: 'Medicina de Família', aliases: ['MFC'], weight: .6, sort_order: 1 },
  { id: 'sc', blueprint_id: 'b', code: 'sc', label: 'Saúde Coletiva', aliases: [], weight: .4, sort_order: 2 },
];
describe('edition blueprint adapter', () => {
  it('matches exact normalized aliases, never substrings or mixed areas', () => {
    expect(resolveBlueprintArea('  medicina de familia ', areas)?.id).toBe('mfc');
    for (const value of ['Preventiva', 'MFC / Saúde Coletiva', 'Saúde', '']) {
      expect(resolveBlueprintArea(value, areas)).toBeNull();
    }
    expect(resolveBlueprintArea('MFC', [...areas, { ...areas[1], aliases: ['MFC'] }])).toBeNull();
  });
  it('keeps distinct weights and explicit provisional status for two blueprints', () => {
    const a = adaptEditionBlueprint({ id: 'b', code: 'one', label: 'One', weights_provisional: true }, areas);
    const b = adaptEditionBlueprint({ id: 'c', code: 'two', label: 'Two', weights_provisional: false }, [{ ...areas[1], blueprint_id: 'c', weight: 1 }]);
    expect(a.weights_provisional).toBe(true);
    expect(a.areas.map(x => x.weight)).toEqual([.6, .4]);
    expect(b.areas.map(x => x.weight)).toEqual([1]);
  });
});
