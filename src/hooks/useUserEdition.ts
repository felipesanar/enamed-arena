import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import { useExamEditions } from '@/hooks/useExamEditions';
import { resolveUserEdition } from '@/lib/editions';

export function useUserEdition(enabled = true) {
  const editions = useExamEditions(enabled);
  const { user, loading } = useAuth();
  const { onboarding, profile, isLoading } = useUser();
  // UserContext can still hold the previous profile while the next login loads.
  const currentOnboarding = !loading && !isLoading && user && profile?.id === user.id
    && onboarding?.userId === user.id ? onboarding : null;
  const userEdition = enabled && editions.isSuccess
    ? resolveUserEdition(editions.data, currentOnboarding, editions.now) : null;
  return { ...editions, userEdition };
}
