import { beforeEach, describe, expect, it, vi } from 'vitest';
const { from } = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from } }));
import { blueprintsApi } from './blueprintsApi';

describe('blueprintsApi', () => {
  beforeEach(() => from.mockReset());
  function fixture(options = 5, direct = false) {
    const responses = [
      { edition_id: 'edition-of-sim' },
      { id: 'edition-of-sim', code: '2027.2', blueprint_id: 'blue', format: { questions: 120, options, duration_minutes: 300, scoring: 'raw' } },
      { id: 'blue', code: 'b', label: 'Matriz', weights_provisional: true },
      [{ id: 'a', blueprint_id: 'blue', code: 'ped', label: 'Pediatria', aliases: [], weight: 1, sort_order: 1 }],
    ];
    if (direct) responses.shift();
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
  it('loads the target edition directly without consulting a simulado', async () => {
    fixture(5, true);
    const result = await blueprintsApi.getForEdition('edition-of-sim');
    expect(result).toMatchObject({ editionId: 'edition-of-sim', editionCode: '2027.2', format: { options: 5 }, blueprint: { weights_provisional: true } });
    expect(from.mock.calls.map(x => x[0])).toEqual(['exam_editions', 'exam_blueprints', 'exam_areas']);
    expect(from.mock.results[0].value.eq).toHaveBeenCalledWith('id', 'edition-of-sim');
  });
  it('rejects invalid target formats without reading another matrix', async () => {
    fixture(0, true);
    await expect(blueprintsApi.getForEdition('edition-of-sim')).rejects.toThrow('Formato ou matriz');
    expect(from).toHaveBeenCalledTimes(1);
  });
  it('rejects missing associations and invalid formats, never legacy fallbacks', async () => {
    fixture(0);
    await expect(blueprintsApi.getForSimulado('sim')).rejects.toThrow();
    from.mockImplementation(() => ({ select: () => ({ eq: () => ({ single: async () => ({ data: null, error: new Error('missing') }) }) }) }));
    await expect(blueprintsApi.getForSimulado('sim')).rejects.toThrow('missing');
  });
});
