// Selector hooks split out of UserContext.tsx so that file only exports the
// Provider + the base useUser hook. Keeping non-component exports next to the
// Provider trips eslint-plugin-react-refresh ("only-export-components") and
// can break Vite HMR for components that consume these.

import { SEGMENT_ACCESS, type UserSegment } from '@/types';
import { useUser } from './UserContext';

/** Current user's segment, falling back to 'guest' when not loaded. */
export function useSegment(): UserSegment {
  const { profile } = useUser();
  return profile?.segment ?? 'guest';
}

/** Whether the current segment has access to the given feature flag. */
export function useHasAccess(feature: keyof typeof SEGMENT_ACCESS['guest']): boolean {
  const segment = useSegment();
  return SEGMENT_ACCESS[segment]?.[feature] ?? false;
}
