import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { ProGate } from "@/components/ProGate";
import { BarChart3 } from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import { SEGMENT_ACCESS } from "@/types";

export default function ComparativoPage() {
  const { profile } = useUser();
  const segment = profile?.segment ?? 'guest';
  const hasAccess = SEGMENT_ACCESS[segment].comparativo;

  console.log('[ComparativoPage] Rendering, segment:', segment, 'hasAccess:', hasAccess);

  return (
    <AppLayout>
      <PageHeader
        title="Comparativo entre Simulados"
        subtitle="Acompanhe sua evolução ao longo dos simulados."
        badge="Análise Comparativa"
      />
      {hasAccess ? (
        <div className="text-body text-muted-foreground text-center py-12">
          O comparativo estará disponível após a conclusão de ao menos 2 simulados.
        </div>
      ) : (
        <ProGate
          icon={BarChart3}
          feature="Comparativo entre Simulados"
          description="Compare seu desempenho entre diferentes simulados, identifique padrões e acompanhe sua evolução ao longo do tempo. Disponível para assinantes SanarFlix."
          requiredSegment="standard"
          currentSegment={segment}
        />
      )}
    </AppLayout>
  );
}
