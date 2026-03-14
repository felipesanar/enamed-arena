import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { ProGate } from "@/components/ProGate";
import { BookOpen } from "lucide-react";

export default function CadernoErrosPage() {
  console.log('[CadernoErrosPage] Rendering');

  return (
    <AppLayout>
      <PageHeader
        title="Caderno de Erros"
        subtitle="Revise e pratique as questões que você errou."
        badge="PRO: ENAMED Exclusivo"
      />
      <ProGate
        icon={BookOpen}
        feature="Caderno de Erros"
        description="Acesse todas as questões que você errou, organizadas por tema e grande área. Recurso exclusivo para assinantes PRO: ENAMED."
      />
    </AppLayout>
  );
}
