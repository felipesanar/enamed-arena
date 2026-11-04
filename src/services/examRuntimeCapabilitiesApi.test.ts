import { beforeEach, expect, it, vi } from 'vitest';
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc } }));
import { examRuntimeCapabilitiesApi } from './examRuntimeCapabilitiesApi';
beforeEach(() => vi.resetAllMocks());
const capabilities = { version: 1, answer_freshness_v1: true, safe_auto_finalize: true,
  question_explanations: true, attempt_counts: true, server_clock: true, exam_editions: true };
it('returns the shared DTO without coupling independent feature flags', async () => {
  for (const flag of Object.keys(capabilities).filter(key => key !== 'version')) {
    const data = { ...capabilities, [flag]: false };
    rpc.mockResolvedValueOnce({ data, error: null });
    expect(await examRuntimeCapabilitiesApi.get()).toEqual(data);
  }
});
const missingProbe = { code: 'PGRST202', message: 'Could not find the function public.get_exam_runtime_capabilities without parameters in the schema cache' };
it.each([404, undefined])('returns null only when the exact zero-argument probe is absent (status %s)', async status => {
  rpc.mockResolvedValue({ data: null, error: missingProbe, status });
  expect(await examRuntimeCapabilitiesApi.get()).toBeNull();
  expect(rpc).toHaveBeenCalledWith('get_exam_runtime_capabilities');
});
it('recognizes the exact empty-parentheses signature', async () => {
  rpc.mockResolvedValue({ data: null, error: { ...missingProbe, message: 'Could not find the function public.get_exam_runtime_capabilities() in the schema cache' }, status: 404 });
  expect(await examRuntimeCapabilitiesApi.get()).toBeNull();
});
it.each([
  { code: 'PGRST202' },
  { ...missingProbe, message: 'Could not find the function public.get_server_time without parameters in the schema cache' },
  { ...missingProbe, message: 'Could not find the function public.get_exam_runtime_capabilities(p_user_id) in the schema cache' },
  { ...missingProbe, message: 'Internal call failed: Could not find the function public.get_exam_runtime_capabilities without parameters in the schema cache' },
  { ...missingProbe, message: 'Project not found', details: missingProbe.message },
])('does not infer a missing probe from an unrelated or ambiguous PGRST202 (%j)', async error => {
  rpc.mockResolvedValue({ data: null, error, status: 404 });
  await expect(examRuntimeCapabilitiesApi.get()).rejects.toBe(error);
});
it.each([0, 200, 401, 403, 500])('does not downgrade probe-shaped errors with non-404 HTTP status %s', async status => {
  rpc.mockResolvedValue({ data: null, error: missingProbe, status });
  await expect(examRuntimeCapabilitiesApi.get()).rejects.toBe(missingProbe);
});
it('preserves rejected network errors for retry', async () => {
  const error = new TypeError('Failed to fetch');
  rpc.mockRejectedValue(error);
  await expect(examRuntimeCapabilitiesApi.get()).rejects.toBe(error);
});
it.each([{ code: 'PGRST301' }, { message: 'Failed to fetch' }, { code: 'PGRST204' },
  { code: '42883' }, { code: '403' }, { code: '404', message: 'Project not found' }])('does not downgrade other errors, including generic 404 (%j)', async error => {
  rpc.mockResolvedValue({ data: null, error, status: 404 });
  await expect(examRuntimeCapabilitiesApi.get()).rejects.toBe(error);
});
it.each([null, {}, { version: 1, answer_freshness_v1: true }, { ...capabilities, version: 2 },
  ...Object.keys(capabilities).filter(key => key !== 'version').map(key => ({ ...capabilities, [key]: 'true' }))])('rejects invalid or unknown capability payload (%j)', async data => {
  rpc.mockResolvedValue({ data, error: null });
  await expect(examRuntimeCapabilitiesApi.get()).rejects.toThrow('Invalid exam runtime capabilities');
});
