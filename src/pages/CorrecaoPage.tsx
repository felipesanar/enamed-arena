import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { FileText } from "lucide-react";

export default function CorrecaoPage() {
  console.log('[CorrecaoPage] Rendering');

  return (
    <AppLayout>
      <PageHeader
        title="Correção"
        subtitle="Revise suas respostas e entenda cada questão."
        badge="Gabarito Comentado"
      />
      <EmptyState
        icon={FileText}
        title="Aguardando resultado"
        description="A correção detalhada será liberada após o encerramento da janela do simulado."
      />
    </AppLayout>
  );
}
