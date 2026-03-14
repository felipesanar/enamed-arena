import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { ProGate } from "@/components/ProGate";
import { BookOpen } from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import { SEGMENT_ACCESS } from "@/types";

export default function CadernoErrosPage() {
  const { profile } = useUser();
  const segment = profile?.segment ?? 'guest';
  const hasAccess = SEGMENT_ACCESS[segment].cadernoErros;

  console.log('[CadernoErrosPage] Rendering, segment:', segment, 'hasAccess:', hasAccess);

  return (
    <AppLayout>
      <PageHeader
        title="Caderno de Erros"
        subtitle="Revise e pratique as questões que você errou."
        badge="PRO: ENAMED Exclusivo"
      />
      {hasAccess ? (
        <div className="text-body text-muted-foreground text-center py-12">
          O Caderno de Erros estará disponível após a conclusão de seu primeiro simulado.
        </div>
      ) : (
        <ProGate
          icon={BookOpen}
          feature="Caderno de Erros"
          description="Acesse todas as questões que você errou, organizadas por tema e grande área. Recurso exclusivo para assinantes PRO: ENAMED."
          requiredSegment="pro"
          currentSegment={segment}
        />
      )}
    </AppLayout>
  );
}
