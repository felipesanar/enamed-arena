/**
 * LegacyCadernoGate — redirect de cutover guardado pela flag v2.
 *
 * Quando `useCadernoV2Flag()` é true, qualquer acesso às rotas legadas
 * (`/caderno-erros`, `/caderno-erros/revisao`) é redirecionado para a nova
 * casca, preservando query params e hash (bookmarks/links antigos continuam
 * funcionando). Quando a flag está off, renderiza a página legada normalmente.
 *
 * Isso torna o flip da flag o único gatilho de cutover de rota — sem downtime
 * e com rollback imediato (env kill-switch VITE_CADERNO_V2=false).
 */

import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useCadernoV2Flag } from '@/hooks/useCadernoV2Flag';

interface LegacyCadernoGateProps {
  /** Destino na casca v2 (sem query/hash — estes são preservados da URL atual). */
  to: string;
  /** Página legada renderizada quando a flag está off. */
  legacy: ReactNode;
}

export function LegacyCadernoGate({ to, legacy }: LegacyCadernoGateProps) {
  const v2 = useCadernoV2Flag();
  const location = useLocation();

  if (v2) {
    return <Navigate to={`${to}${location.search}${location.hash}`} replace />;
  }

  return <>{legacy}</>;
}
