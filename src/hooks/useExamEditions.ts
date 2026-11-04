import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getNextEdition } from '@/lib/editions';
import type { ExamEdition } from '@/types/edition';

export function useExamEditions() {
  // Re-evaluate calendar boundaries even when the screen stays open overnight.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const query = useQuery({
    queryKey: ['exam-editions'],
    queryFn: async (): Promise<ExamEdition[]> => {
      const { data, error } = await supabase.rpc('get_exam_editions' as never);
      if (error) throw error;
      return (data ?? []) as unknown as ExamEdition[];
    },
    staleTime: 60 * 60 * 1000,
  });
  return { ...query, nextEdition: query.isSuccess ? getNextEdition(query.data, now) : null };
}
