/**
 * CadernoLayout — casca persistente das abas do Caderno de Erros v2.
 *
 * Renderiza o TabBar UMA vez e troca apenas o conteúdo via <Outlet/>. Assim a
 * barra de navegação nunca desmonta ao trocar de aba (sem "sumir e reaparecer"),
 * e a pílula ativa desliza suavemente entre as seções (framer-motion layoutId).
 *
 * O <Suspense> interno isola o lazy-load de cada página: enquanto o chunk da aba
 * carrega, só a área de conteúdo mostra o skeleton — o TabBar permanece fixo.
 */

import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { TabBar } from '@/components/caderno/TabBar';
import { CadernoSkeleton } from '@/components/caderno/ui';

export function CadernoLayout() {
  return (
    <div className="caderno-root">
      <TabBar />
      <Suspense fallback={<CadernoSkeleton count={4} />}>
        <Outlet />
      </Suspense>
    </div>
  );
}
