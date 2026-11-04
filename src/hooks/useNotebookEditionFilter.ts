import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { editionsApi } from '@/services/editionsApi';

/** Enabled catalog boundary: unlike the incumbent useExamEditions, no read when off. */
export function useNotebookEditionFilter(enabled: boolean) {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const editionId = enabled ? params.get('edition') || null : null;
  const catalog = useQuery({
    queryKey: ['exam-editions', 'notebook', user?.id ?? null],
    queryFn: editionsApi.getExamEditions, enabled: enabled && !!user,
    retry: false, staleTime: 60 * 60 * 1000,
  });
  const invalid = enabled && !!editionId && catalog.isSuccess && !catalog.data.some(e => e.id === editionId);
  return {
    editionId, catalog, invalid,
    ready: enabled && !!user && catalog.isSuccess && !invalid,
    label: editionId ? catalog.data?.find(e => e.id === editionId)?.label ?? 'Edição não disponível' : 'Todas as edições',
    setEdition: (id: string | null) => setParams(prev => {
      const next = new URLSearchParams(prev);
      if (id) next.set('edition', id); else next.delete('edition');
      return next;
    }),
  };
}
