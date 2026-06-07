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

  // 2. Vite env var — kill-switch takes priority over server flag.
  //    Setting VITE_CADERNO_V2=false or =0 forces the feature OFF even when
  //    profiles.caderno_v2_enabled is true (kill-switch for rapid rollback).
  if (import.meta.env.VITE_CADERNO_V2 === 'false' || import.meta.env.VITE_CADERNO_V2 === '0') {
    return false;
  }
  if (import.meta.env.VITE_CADERNO_V2 === 'true' || import.meta.env.VITE_CADERNO_V2 === '1') {
    return true;
  }

  // 3. Cutover: V2 é o padrão. Só fica OFF se explicitamente desligado por
  //    usuário (profiles.caderno_v2_enabled === false) — os kill-switches
  //    globais (env / localStorage acima) têm prioridade. undefined/null/true → ON.
  const serverFlag = (profile as any)?.caderno_v2_enabled;
  return serverFlag !== false;
}
