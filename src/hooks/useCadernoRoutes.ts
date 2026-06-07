/**
 * useCadernoRoutes — resolve os caminhos do Caderno de Erros respeitando a flag v2.
 *
 * Centraliza a decisão de cutover: quando `useCadernoV2Flag()` é true, toda a
 * navegação aponta para a nova casca (`/caderno/*`); caso contrário, para a
 * produção atual (`/caderno-erros/*`). Flipar a flag (env / profiles) é o único
 * gatilho de rollout — nenhum componente de navegação deve hardcodar o caminho.
 *
 * Uso:
 *   const caderno = useCadernoRoutes();
 *   <Link to={caderno.base}>Caderno</Link>
 *   <Link to={caderno.reviewDue}>Revisar hoje</Link>
 */

import { useMemo } from 'react';
import { useCadernoV2Flag } from '@/hooks/useCadernoV2Flag';

export interface CadernoRoutes {
  /** true quando a casca v2 está ativa para o usuário. */
  v2: boolean;
  /** Página inicial do caderno (lista / shell). */
  base: string;
  /** Sessão de revisão (recall ativo no v2; revisão guiada no legado). */
  review: string;
  /** Revisão filtrada pelas questões devidas hoje (SRS). */
  reviewDue: string;
  /** Treino cronometrado (v2). Cai no caderno base no legado. */
  treino: string;
  /** War Room / Reta Final (v2). Cai no caderno base no legado. */
  retaFinal: string;
  /** Favoritos (v2). Cai no caderno base no legado. */
  favoritos: string;
  /** Anotações (v2). Cai no caderno base no legado. */
  anotacoes: string;
  /** Insights (v2). Cai no caderno base no legado. */
  insights: string;
}

export function useCadernoRoutes(): CadernoRoutes {
  const v2 = useCadernoV2Flag();

  return useMemo<CadernoRoutes>(() => {
    if (v2) {
      return {
        v2: true,
        base: '/caderno',
        review: '/caderno/revisao',
        reviewDue: '/caderno/revisao?mode=due',
        treino: '/caderno/treino',
        retaFinal: '/caderno/reta-final',
        favoritos: '/caderno/favoritos',
        anotacoes: '/caderno/anotacoes',
        insights: '/caderno/insights',
      };
    }
    // Legado — produção atual mantida durante o rollout gradual.
    return {
      v2: false,
      base: '/caderno-erros',
      review: '/caderno-erros/revisao',
      reviewDue: '/caderno-erros/revisao',
      treino: '/caderno-erros',
      retaFinal: '/caderno-erros',
      favoritos: '/caderno-erros',
      anotacoes: '/caderno-erros',
      insights: '/caderno-erros',
    };
  }, [v2]);
}
