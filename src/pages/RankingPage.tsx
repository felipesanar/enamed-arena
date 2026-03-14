import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { PremiumCard } from "@/components/PremiumCard";
import { SectionHeader } from "@/components/SectionHeader";
import { Trophy, Medal, TrendingUp } from "lucide-react";
import { RANKING_DATA, USER_STATS } from "@/data/mock";

function PositionBadge({ position }: { position: number }) {
  if (position <= 3) {
    const colors = {
      1: 'bg-warning/20 text-warning',
      2: 'bg-muted text-muted-foreground',
      3: 'bg-warning/10 text-warning',
    };
    return (
      <div className={`h-8 w-8 rounded-full flex items-center justify-center ${colors[position as 1 | 2 | 3]}`}>
        <Medal className="h-4 w-4" />
      </div>
    );
  }
  return (
    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-caption font-bold text-muted-foreground">
      {position}
    </div>
  );
}

export default function RankingPage() {
  console.log('[RankingPage] Rendering');

  return (
    <AppLayout>
      <PageHeader
        title="Ranking ENAMED"
        subtitle="Compare seu desempenho com milhares de candidatos."
        badge="Ranking Geral"
      />

      {/* Your position */}
      <PremiumCard className="mb-6 p-5 md:p-6 border-primary/20 bg-gradient-to-r from-accent to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Trophy className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-body-sm text-muted-foreground">Sua posição</p>
              <p className="text-heading-2 text-foreground">#{USER_STATS.rankingPosition} de {USER_STATS.totalParticipants.toLocaleString('pt-BR')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-success">
            <TrendingUp className="h-4 w-4" />
            <span className="text-body font-semibold">{USER_STATS.rankingTrend} posições</span>
          </div>
        </div>
      </PremiumCard>

      {/* Ranking table */}
      <SectionHeader title="Top 10" />
      <PremiumCard className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-overline uppercase text-muted-foreground px-5 py-3.5 w-16">#</th>
                <th className="text-left text-overline uppercase text-muted-foreground px-5 py-3.5">Participante</th>
                <th className="text-left text-overline uppercase text-muted-foreground px-5 py-3.5 hidden sm:table-cell">Instituição</th>
                <th className="text-right text-overline uppercase text-muted-foreground px-5 py-3.5">Nota</th>
              </tr>
            </thead>
            <tbody>
              {RANKING_DATA.map((item) => (
                <tr key={item.position} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-3.5">
                    <PositionBadge position={item.position} />
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="text-body font-medium text-foreground">{item.name}</span>
                  </td>
                  <td className="px-5 py-3.5 hidden sm:table-cell">
                    <span className="text-body-sm text-muted-foreground">{item.institution}</span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <span className="text-body font-semibold text-foreground">{item.score}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PremiumCard>
    </AppLayout>
  );
}
