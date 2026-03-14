import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { PremiumCard } from "@/components/PremiumCard";
import { SectionHeader } from "@/components/SectionHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { motion } from "framer-motion";
import { 
  Calendar, 
  BarChart3, 
  Trophy, 
  Clock, 
  ArrowRight, 
  TrendingUp,
  Target,
  Users 
} from "lucide-react";
import { Link } from "react-router-dom";
import { NEXT_SIMULADO, RECENT_SIMULADOS, USER_STATS } from "@/data/mock";

const stats = [
  { label: "Simulados realizados", value: String(USER_STATS.simuladosCompleted), icon: Target, trend: null },
  { label: "Média geral", value: `${USER_STATS.averageScore}%`, icon: TrendingUp, trend: USER_STATS.scoreTrend },
  { label: "Posição no ranking", value: `#${USER_STATS.rankingPosition}`, icon: Trophy, trend: USER_STATS.rankingTrend },
  { label: "Participantes", value: USER_STATS.totalParticipants.toLocaleString('pt-BR'), icon: Users, trend: null },
];

export default function DashboardPage() {
  console.log('[DashboardPage] Rendering');

  return (
    <AppLayout>
      <PageHeader
        title="Bem-vindo de volta"
        subtitle="Acompanhe sua evolução e prepare-se para o próximo simulado."
        badge="Plataforma de Simulados"
      />

      {/* Next Simulado CTA */}
      {NEXT_SIMULADO && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <Link to={`/simulados/${NEXT_SIMULADO.id}`} className="block">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-wine-hover p-6 md:p-8 text-primary-foreground group cursor-pointer transition-all duration-300 hover:shadow-xl">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
              
              <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="h-4 w-4 opacity-80" />
                    <span className="text-body-sm opacity-80">Próximo simulado</span>
                  </div>
                  <h2 className="text-heading-2 mb-1">{NEXT_SIMULADO.title}</h2>
                  <p className="text-body opacity-80">
                    {NEXT_SIMULADO.date} · {NEXT_SIMULADO.questions} questões · {NEXT_SIMULADO.duration}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 bg-white/10 rounded-xl px-4 py-2.5 backdrop-blur-sm">
                    <Clock className="h-4 w-4" />
                    <span className="text-body font-semibold">Ver detalhes</span>
                  </div>
                  <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                    <ArrowRight className="h-5 w-5" />
                  </div>
                </div>
              </div>
            </div>
          </Link>
        </motion.div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-8">
        {stats.map((stat, i) => (
          <StatCard key={stat.label} {...stat} delay={i * 0.08} />
        ))}
      </div>

      {/* Recent Simulados & Quick Access */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <div>
          <SectionHeader title="Últimos Simulados" />
          <div className="space-y-3">
            {RECENT_SIMULADOS.map((sim, i) => (
              <Link key={sim.id} to={`/simulados/${sim.id}`}>
                <PremiumCard interactive delay={i * 0.1} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                        <BarChart3 className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-body font-medium text-foreground">{sim.title}</p>
                        <p className="text-body-sm text-muted-foreground">{sim.date}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-heading-3 text-foreground">{sim.score}%</p>
                      </div>
                      <StatusBadge status={sim.status} />
                    </div>
                  </div>
                </PremiumCard>
              </Link>
            ))}
          </div>
        </div>

        <div>
          <SectionHeader title="Acesso Rápido" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { title: "Calendário", desc: "Ver todos os simulados", icon: Calendar, to: "/simulados" },
              { title: "Ranking", desc: "Sua posição geral", icon: Trophy, to: "/ranking" },
              { title: "Desempenho", desc: "Análise detalhada", icon: BarChart3, to: "/desempenho" },
              { title: "Correção", desc: "Revisar questões", icon: Target, to: "/correcao" },
            ].map((item, i) => (
              <Link key={item.title} to={item.to}>
                <PremiumCard interactive delay={i * 0.08} className="p-4 h-full">
                  <item.icon className="h-5 w-5 text-primary mb-3" />
                  <p className="text-body font-medium text-foreground">{item.title}</p>
                  <p className="text-body-sm text-muted-foreground">{item.desc}</p>
                </PremiumCard>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
