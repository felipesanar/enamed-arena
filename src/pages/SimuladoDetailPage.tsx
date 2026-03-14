import { useParams, Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { PremiumCard } from "@/components/PremiumCard";
import { EmptyState } from "@/components/EmptyState";
import { SIMULADOS } from "@/data/mock";
import { StatusBadge } from "@/components/StatusBadge";
import { ArrowLeft, Calendar, Clock, FileText, Play } from "lucide-react";

export default function SimuladoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const simulado = SIMULADOS.find(s => s.id === id);

  console.log('[SimuladoDetailPage] Rendering for id:', id);

  if (!simulado) {
    return (
      <AppLayout>
        <EmptyState
          title="Simulado não encontrado"
          description="O simulado que você procura não existe ou foi removido."
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mb-4">
        <Link to="/simulados" className="inline-flex items-center gap-1.5 text-body-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar ao calendário
        </Link>
      </div>

      <PageHeader
        title={simulado.title}
        subtitle={`${simulado.questions} questões · ${simulado.duration}`}
        badge={simulado.date}
        action={<StatusBadge status={simulado.status} />}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Questões', value: String(simulado.questions), icon: FileText },
          { label: 'Duração', value: simulado.duration, icon: Clock },
          { label: 'Data', value: simulado.date, icon: Calendar },
        ].map((item, i) => (
          <PremiumCard key={item.label} delay={i * 0.08} className="p-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center shrink-0">
                <item.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-heading-3 text-foreground">{item.value}</p>
                <p className="text-body-sm text-muted-foreground">{item.label}</p>
              </div>
            </div>
          </PremiumCard>
        ))}
      </div>

      {simulado.status === 'available' && (
        <PremiumCard className="p-6 md:p-8 text-center">
          <Play className="h-8 w-8 text-primary mx-auto mb-4" />
          <h2 className="text-heading-2 text-foreground mb-2">Pronto para começar?</h2>
          <p className="text-body text-muted-foreground mb-6 max-w-md mx-auto">
            Ao iniciar, o cronômetro começará automaticamente. Você terá {simulado.duration} para completar {simulado.questions} questões.
          </p>
          <button className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-primary text-primary-foreground text-body font-semibold hover:bg-wine-hover transition-colors">
            <Play className="h-4 w-4" />
            Iniciar Simulado
          </button>
          <p className="text-body-sm text-muted-foreground mt-4">
            O resultado será liberado após o fechamento da janela.
          </p>
        </PremiumCard>
      )}

      {simulado.status === 'completed' && simulado.score !== undefined && (
        <PremiumCard className="p-6 md:p-8 text-center">
          <div className="text-display text-primary mb-2">{simulado.score}%</div>
          <p className="text-body text-muted-foreground mb-6">Sua nota neste simulado</p>
          <div className="flex items-center justify-center gap-3">
            <Link
              to="/correcao"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-body font-semibold hover:bg-wine-hover transition-colors"
            >
              Ver Correção
            </Link>
            <Link
              to="/desempenho"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-secondary text-secondary-foreground text-body font-medium hover:bg-muted transition-colors"
            >
              Ver Desempenho
            </Link>
          </div>
        </PremiumCard>
      )}

      {(simulado.status === 'upcoming' || simulado.status === 'locked') && (
        <EmptyState
          icon={Clock}
          title="Simulado indisponível"
          description="Este simulado ainda não está disponível. Aguarde a abertura da janela de execução."
        />
      )}
    </AppLayout>
  );
}
