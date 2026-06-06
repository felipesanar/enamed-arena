/**
 * Feature flag for Caderno de Erros v2 (new shell).
 *
 * Priority (first truthy wins):
 *   1. localStorage key `caderno_v2`   — DEV override
 *   2. VITE_CADERNO_V2 env var         — DEV / staging override
 *   3. profiles.caderno_v2_enabled     — server-side rollout (may be undefined if column not yet migrated)
 */

import { useUser } from '@/contexts/UserContext';

export function useCadernoV2Flag(): boolean {
  const { profile } = useUser();

  // 1. localStorage DEV override
  if (typeof window !== 'undefined') {
    const ls = window.localStorage.getItem('caderno_v2');
    if (ls === 'true' || ls === '1') return true;
    if (ls === 'false' || ls === '0') return false;
  }

  // 2. Vite env var DEV/staging override
  if (import.meta.env.VITE_CADERNO_V2 === 'true' || import.meta.env.VITE_CADERNO_V2 === '1') {
    return true;
  }

  // 3. Server-side flag on profile (column may not exist yet → treat undefined as false)
  const serverFlag = (profile as any)?.caderno_v2_enabled;
  return serverFlag === true;
}
