import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { PremiumCard } from "@/components/PremiumCard";
import { Trophy, Medal, TrendingUp } from "lucide-react";

const rankingData = [
  { position: 1, name: "Ana C.", score: 92, institution: "USP" },
  { position: 2, name: "Lucas M.", score: 89, institution: "UNICAMP" },
  { position: 3, name: "Maria S.", score: 87, institution: "UFMG" },
  { position: 4, name: "João P.", score: 85, institution: "UFBA" },
  { position: 5, name: "Carla D.", score: 84, institution: "UFRJ" },
  { position: 6, name: "Pedro H.", score: 82, institution: "UnB" },
  { position: 7, name: "Beatriz R.", score: 80, institution: "UFPE" },
  { position: 8, name: "Rafael A.", score: 79, institution: "UFPR" },
  { position: 9, name: "Juliana F.", score: 78, institution: "UFSC" },
  { position: 10, name: "Thiago L.", score: 76, institution: "USP-RP" },
];

function PositionBadge({ position }: { position: number }) {
  if (position === 1) return <div className="h-8 w-8 rounded-full bg-warning/20 flex items-center justify-center"><Medal className="h-4 w-4 text-warning" /></div>;
  if (position === 2) return <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center"><Medal className="h-4 w-4 text-muted-foreground" /></div>;
  if (position === 3) return <div className="h-8 w-8 rounded-full bg-warning/10 flex items-center justify-center"><Medal className="h-4 w-4 text-warning" /></div>;
  return <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-caption font-bold text-muted-foreground">{position}</div>;
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
      <PremiumCard className="mb-6 bg-gradient-to-r from-primary/5 to-transparent border-primary/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Trophy className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-body-sm text-muted-foreground">Sua posição</p>
              <p className="text-heading-2 text-foreground">#142 de 3.241</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-success">
            <TrendingUp className="h-4 w-4" />
            <span className="text-body font-semibold">+18 posições</span>
          </div>
        </div>
      </PremiumCard>

      {/* Ranking table */}
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
              {rankingData.map((item, i) => (
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
