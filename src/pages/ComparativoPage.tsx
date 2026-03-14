import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { ProGate } from "@/components/ProGate";
import { BarChart3 } from "lucide-react";

export default function ComparativoPage() {
  console.log('[ComparativoPage] Rendering');

  // TODO: Check user segment and show content or gate
  const userSegment = 'guest' as const;

  return (
    <AppLayout>
      <PageHeader
        title="Comparativo entre Simulados"
        subtitle="Acompanhe sua evolução ao longo dos simulados."
        badge="Análise Comparativa"
      />
      {userSegment === 'guest' ? (
        <ProGate
          icon={BarChart3}
          feature="Comparativo entre Simulados"
          description="Compare seu desempenho entre diferentes simulados, identifique padrões e acompanhe sua evolução ao longo do tempo. Disponível para assinantes SanarFlix."
          requiredSegment="standard"
          currentSegment="guest"
        />
      ) : (
        <div>{/* Comparativo content will be implemented in Phase 5-6 */}</div>
      )}
    </AppLayout>
  );
}
