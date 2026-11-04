import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { editionsApi } from '@/services/editionsApi';
import { getNextEdition } from '@/lib/editions';

export function useExamEditions() {
  // Re-evaluate calendar boundaries even when the screen stays open overnight.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const query = useQuery({
    queryKey: ['exam-editions'],
    queryFn: editionsApi.getExamEditions,
    staleTime: 60 * 60 * 1000,
  });
  return { ...query, now, nextEdition: query.isSuccess ? getNextEdition(query.data, now) : null };
}
