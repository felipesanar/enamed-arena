import { beforeEach, describe, expect, it, vi } from 'vitest';
const { from } = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from } }));
import { blueprintsApi } from './blueprintsApi';

describe('blueprintsApi', () => {
  beforeEach(() => from.mockReset());
  function fixture(options = 5) {
    const responses = [
      { edition_id: 'edition-of-sim' },
      { id: 'edition-of-sim', code: '2027.2', blueprint_id: 'blue', format: { questions: 120, options, duration_minutes: 300, scoring: 'raw' } },
      { id: 'blue', code: 'b', label: 'Matriz', weights_provisional: true },
      [{ id: 'a', blueprint_id: 'blue', code: 'ped', label: 'Pediatria', aliases: [], weight: 1, sort_order: 1 }],
    ];
    from.mockImplementation(() => {
      const data = responses.shift();
      const chain = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: async () => ({ data, error: null }), order: async () => ({ data, error: null }) };
      return chain;
    });
  }
  it('loads the edition attached to the simulado with validated format', async () => {
    fixture();
    expect(await blueprintsApi.getForSimulado('sim')).toMatchObject({ editionCode: '2027.2', format: { options: 5 }, blueprint: { weights_provisional: true } });
    expect(from.mock.calls.map(x => x[0])).toEqual(['simulados','exam_editions','exam_blueprints','exam_areas']);
  });
  it('rejects missing associations and invalid formats, never legacy fallbacks', async () => {
    fixture(0);
    await expect(blueprintsApi.getForSimulado('sim')).rejects.toThrow();
    from.mockImplementation(() => ({ select: () => ({ eq: () => ({ single: async () => ({ data: null, error: new Error('missing') }) }) }) }));
    await expect(blueprintsApi.getForSimulado('sim')).rejects.toThrow('missing');
  });
});
