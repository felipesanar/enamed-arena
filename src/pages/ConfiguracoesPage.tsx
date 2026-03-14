import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { PremiumCard } from "@/components/PremiumCard";
import { Settings, User, Bell, Shield } from "lucide-react";

export default function ConfiguracoesPage() {
  console.log('[ConfiguracoesPage] Rendering');

  return (
    <AppLayout>
      <PageHeader
        title="Configurações"
        subtitle="Gerencie seu perfil e preferências."
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
        {[
          { title: "Perfil", desc: "Dados pessoais e especialidade", icon: User },
          { title: "Notificações", desc: "Alertas de simulados e resultados", icon: Bell },
          { title: "Plano", desc: "Gerenciar assinatura", icon: Shield },
          { title: "Preferências", desc: "Personalizar experiência", icon: Settings },
        ].map((item, i) => (
          <PremiumCard key={item.title} interactive delay={i * 0.08} className="p-5">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-primary/8 flex items-center justify-center shrink-0">
                <item.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-body font-medium text-foreground">{item.title}</p>
                <p className="text-body-sm text-muted-foreground">{item.desc}</p>
              </div>
            </div>
          </PremiumCard>
        ))}
      </div>
    </AppLayout>
  );
}
