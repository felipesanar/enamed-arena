import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import { useUserEdition } from '@/hooks/useUserEdition';
import { resolveEditionStudyContext } from '@/lib/retaFinalPlan';
import { blueprintsApi } from '@/services/blueprintsApi';

export function useEditionStudyContext(enabled: boolean) {
  const { user, loading: authLoading } = useAuth();
  const { profile, isLoading } = useUser();
  const ready = enabled && !!user && !authLoading && !isLoading && profile?.id === user.id;
  const editions = useUserEdition(ready);
  const target = ready && editions.isSuccess ? editions.userEdition : null;
  const matrix = useQuery({
    queryKey: ['edition-study-blueprint', user?.id ?? null, target?.id ?? null, target?.blueprint_id ?? null],
    queryFn: () => blueprintsApi.getForEdition(target!.id),
    enabled: !!target,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  // Never let a missing target use the helper's next-global-edition fallback.
  const data = target && matrix.isSuccess && matrix.data.editionId === target.id ? matrix.data.blueprint : null;
  const context = resolveEditionStudyContext(target ? [target] : [], target?.id ?? null, editions.now,
    data ? { blueprint: data, areas: data.areas } : undefined);
  return { context, loading: enabled && (!ready && !!user || ready && editions.isPending || !!target && matrix.isPending),
    error: ready && editions.isError, matrixError: !!target && matrix.isError,
    refetch: () => { void editions.refetch(); if (target) void matrix.refetch(); } };
}
