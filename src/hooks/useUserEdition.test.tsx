import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import { useUserEdition } from '@/hooks/useUserEdition';
import type { ExamEdition } from '@/types/edition';
import type { EditionTargetProfile } from '@/types/edition';

const mocks = vi.hoisted(() => ({
  auth: { user: { id: 'u1' } as { id: string } | null, loading: false },
  user: { profile: { id: 'u1' } as { id: string } | null,
    onboarding: { userId: 'u1', targetEditionId: 'old' } as (EditionTargetProfile & { userId: string }) | null, isLoading: false },
  editions: { data: [] as ExamEdition[], isSuccess: true, now: new Date('2026-11-28T12:00:00Z'), nextEdition: null },
}));
vi.mock('@/hooks/useExamEditions', () => ({ useExamEditions: () => mocks.editions }));
vi.mock('@/contexts/UserContext', () => ({ useUser: () => mocks.user }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => mocks.auth }));
const edition = (id: string, overrides: Partial<ExamEdition> = {}): ExamEdition => ({ id, code: id, year: 2027,
  term: 1, label: id, status: 'planned', exam_date: null, exam_date_confirmed: false,
  official_results_at: null, format: {}, created_at: '', updated_at: '', ...overrides });
afterEach(() => { cleanup(); mocks.auth.user = { id: 'u1' }; mocks.user.profile = { id: 'u1' };
  mocks.user.onboarding = { userId: 'u1', targetEditionId: 'old' }; mocks.editions.isSuccess = true; });

describe('useUserEdition', () => {
  it('disabled never resolves cached target', () => {
    mocks.editions.data = [edition('old')];
    const { result } = renderHook(() => useUserEdition(false));
    expect(result.current.userEdition).toBeNull();
  });
  it('combina alvo com edicoes sem alterar perfil, preserva nextEdition', () => {
    const old = edition('old', { status: 'archived' });
    const next = edition('next');
    mocks.editions.data = [old, next];
    const { result } = renderHook(() => useUserEdition());
    expect(result.current.userEdition).toBe(old);
    expect(result.current.nextEdition).toBeNull();
    expect(mocks.user.onboarding?.targetEditionId).toBe('old');
  });
  it('troca/login/logout ignora onboarding antigo mesmo antes do contexto atualizar', () => {
    mocks.editions.data = [edition('old', { status: 'archived' }), edition('next')];
    const { result, rerender } = renderHook(() => useUserEdition());
    expect(result.current.userEdition?.id).toBe('old');
    mocks.auth.user = { id: 'u2' };
    rerender();
    expect(result.current.userEdition?.id).toBe('next');
    mocks.user.profile = { id: 'u2' };
    mocks.user.onboarding = { userId: 'u2', expectedGraduationTerm: 'old' };
    rerender();
    expect(result.current.userEdition?.id).toBe('old');
    mocks.auth.user = null;
    rerender();
    expect(result.current.userEdition?.id).toBe('next');
  });
  it('reage a datas/refetch e erro sem reter edicao anterior', () => {
    mocks.user.onboarding = null;
    mocks.editions.data = [edition('first', { exam_date: '2026-11-28' }), edition('second', { exam_date: '2026-11-29' })];
    mocks.editions.now = new Date('2026-11-28T12:00:00Z');
    const { result, rerender } = renderHook(() => useUserEdition());
    expect(result.current.userEdition?.id).toBe('first');
    mocks.editions.now = new Date('2026-11-29T12:00:00Z');
    rerender();
    expect(result.current.userEdition?.id).toBe('second');
    mocks.editions.isSuccess = false;
    rerender();
    expect(result.current.userEdition).toBeNull();
  });
});
