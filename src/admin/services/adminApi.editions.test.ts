import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/admin/services/adminEditionsApi', () => ({ adminEditionsApi: { publish: vi.fn() } }));
import { adminApi } from './adminApi';
import { adminEditionsApi } from './adminEditionsApi';

describe('edition-aware simulado save', () => {
  const values = { edition_id: 'e', status: 'published' } as Parameters<typeof adminApi.createSimulado>[0];
  beforeEach(() => {
    vi.restoreAllMocks(); vi.clearAllMocks();
    vi.spyOn(adminApi, 'createSimulado').mockResolvedValue({ id: 'draft' } as never);
    vi.spyOn(adminApi, 'updateSimulado').mockResolvedValue({ id: 'draft' } as never);
  });
  it('saves draft before publication, exposes ID even if publication fails', async () => {
    vi.mocked(adminEditionsApi.publish).mockRejectedValueOnce(new Error('incomplete'));
    const saved = vi.fn();
    await expect(adminApi.saveSimuladoWithEdition(null, values, saved)).rejects.toThrow('incomplete');
    expect(adminApi.createSimulado).toHaveBeenCalledWith({ edition_id: 'e', status: 'draft' });
    expect(saved).toHaveBeenCalledWith('draft');
    expect(adminEditionsApi.publish).toHaveBeenCalledWith('draft');
  });
  it('retry updates the same draft without cloning anything', async () => {
    vi.mocked(adminEditionsApi.publish).mockResolvedValueOnce();
    await adminApi.saveSimuladoWithEdition('draft', values, vi.fn());
    expect(adminApi.createSimulado).not.toHaveBeenCalled();
    expect(adminApi.updateSimulado).toHaveBeenCalledWith('draft', { edition_id: 'e', status: 'draft' });
  });
  it('refuses missing edition and never publishes a save failure', async () => {
    await expect(adminApi.saveSimuladoWithEdition(null, { ...values, edition_id: '' }, vi.fn())).rejects.toThrow('Selecione');
    vi.mocked(adminApi.createSimulado).mockRejectedValueOnce(new Error('save failed'));
    await expect(adminApi.saveSimuladoWithEdition(null, values, vi.fn())).rejects.toThrow('save failed');
    expect(adminEditionsApi.publish).not.toHaveBeenCalled();
  });
});
