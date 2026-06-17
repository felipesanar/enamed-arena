import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { setSuperProperties } from '@/lib/analytics';
import { useUser } from '@/contexts/UserContext';

/**
 * Componente headless que mantém as super-props de contexto atualizadas.
 * Deve ser montado dentro de BrowserRouter + UserProvider.
 *
 * - Rota: sincronizada a cada navegação via useLocation.
 * - Segment / especialidade / instituições: sincronizados quando o perfil carrega.
 */
export function AnalyticsSync() {
  const { pathname } = useLocation();
  const { profile, onboarding } = useUser();

  useEffect(() => {
    setSuperProperties({ route: pathname });
  }, [pathname]);

  useEffect(() => {
    if (!profile) return;
    setSuperProperties({ segment: profile.segment });
  }, [profile?.segment]);

  useEffect(() => {
    if (!onboarding) return;
    setSuperProperties({
      specialty: onboarding.specialty || undefined,
      target_institutions: onboarding.targetInstitutions?.join(',') || undefined,
    });
  }, [onboarding?.specialty, onboarding?.targetInstitutions?.join(',')]);

  return null;
}
