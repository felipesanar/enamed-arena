import { useQuery } from '@tanstack/react-query';
import { blueprintsApi } from '@/services/blueprintsApi';

/** Uses the simulado's edition, never the student's target. Disabled means no read. */
export function useEditionBlueprint(simuladoId: string | undefined, enabled: boolean) {
  const query = useQuery({
    queryKey: ['edition-blueprint', simuladoId],
    enabled: enabled && !!simuladoId,
    queryFn: () => blueprintsApi.getForSimulado(simuladoId!),
    retry: false,
  });
  const status = !enabled || !simuladoId ? 'unknown' : query.isError ? 'error' : query.isSuccess ? 'ready' : 'loading';
  return { status, data: enabled && query.isSuccess ? query.data : undefined, error: query.error, refetch: query.refetch };
}
