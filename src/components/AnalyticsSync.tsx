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

  // Primitivos estáveis → efeitos dependem exatamente do que usam (sem disable do exhaustive-deps).
  const segment = profile?.segment;
  const specialty = onboarding?.specialty;
  const targetInstitutions = onboarding?.targetInstitutions?.join(',');

  useEffect(() => {
    setSuperProperties({ route: pathname });
  }, [pathname]);

  useEffect(() => {
    if (segment == null) return;
    setSuperProperties({ segment });
  }, [segment]);

  useEffect(() => {
    if (specialty === undefined && targetInstitutions === undefined) return;
    setSuperProperties({
      specialty: specialty || undefined,
      target_institutions: targetInstitutions || undefined,
    });
  }, [specialty, targetInstitutions]);

  return null;
}
