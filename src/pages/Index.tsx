import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { PremiumCard } from "@/components/PremiumCard";
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

const nextSimulado = {
  title: "Simulado ENAMED #3",
  date: "22 de Março, 2026",
  timeLeft: "8 dias",
  questions: 120,
  duration: "5 horas",
};

const stats = [
  { label: "Simulados realizados", value: "2", icon: Target, trend: null },
  { label: "Média geral", value: "72%", icon: TrendingUp, trend: "+5%" },
  { label: "Posição no ranking", value: "#142", icon: Trophy, trend: "+18" },
  { label: "Participantes", value: "3.241", icon: Users, trend: null },
];

const recentSimulados = [
  { id: 1, title: "Simulado ENAMED #2", date: "15 Fev 2026", score: 76, status: "completed" as const },
  { id: 2, title: "Simulado ENAMED #1", date: "18 Jan 2026", score: 68, status: "completed" as const },
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
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8"
      >
        <Link to="/simulados" className="block">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-wine-hover p-6 md:p-8 text-primary-foreground group cursor-pointer transition-all duration-300 hover:shadow-xl">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
            
            <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="h-4 w-4 opacity-80" />
                  <span className="text-body-sm opacity-80">Próximo simulado</span>
                </div>
                <h2 className="text-heading-2 mb-1">{nextSimulado.title}</h2>
                <p className="text-body opacity-80">
                  {nextSimulado.date} · {nextSimulado.questions} questões · {nextSimulado.duration}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 bg-white/10 rounded-xl px-4 py-2.5 backdrop-blur-sm">
                  <Clock className="h-4 w-4" />
                  <span className="text-body font-semibold">Faltam {nextSimulado.timeLeft}</span>
                </div>
                <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                  <ArrowRight className="h-5 w-5" />
                </div>
              </div>
            </div>
          </div>
        </Link>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-8">
        {stats.map((stat, i) => (
          <PremiumCard key={stat.label} delay={i * 0.08} className="p-4 md:p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="h-9 w-9 rounded-lg bg-primary/8 flex items-center justify-center">
                <stat.icon className="h-[18px] w-[18px] text-primary" />
              </div>
              {stat.trend && (
                <span className="text-caption font-semibold text-success">{stat.trend}</span>
              )}
            </div>
            <p className="text-heading-2 text-foreground">{stat.value}</p>
            <p className="text-body-sm text-muted-foreground mt-0.5">{stat.label}</p>
          </PremiumCard>
        ))}
      </div>

      {/* Recent Simulados */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <div>
          <h2 className="text-heading-3 text-foreground mb-4">Últimos Simulados</h2>
          <div className="space-y-3">
            {recentSimulados.map((sim, i) => (
              <PremiumCard key={sim.id} interactive delay={i * 0.1} className="p-4">
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
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-heading-3 text-foreground mb-4">Acesso Rápido</h2>
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
