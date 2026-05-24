/**
 * Insights acionáveis para a tela de Comparativo.
 * Diferente de computeComparativeInsights (apenas descritivo), aqui geramos
 * recomendações concretas baseadas em delta de área, tempo, comportamento.
 */
import type { ComparativeEntryRich } from '@/hooks/useComparativeData';

export type ActionableSeverity = 'critical' | 'attention' | 'positive' | 'info';

export interface ActionableInsight {
  id: string;
  severity: ActionableSeverity;
  title: string;
  description: string;
  /** Optional metric/label to display large on the right */
  metric?: string;
  /** Optional CTA: { label, href } — fecha o ciclo diagnóstico → ação */
  cta?: { label: string; href: string };
}

const PP = (n: number) => `${n >= 0 ? '+' : ''}${n}pp`;

function fmtMinutes(seconds: number | null): string {
  if (seconds == null) return 'n/d';
  const m = Math.round(seconds / 60);
  return `${m}min`;
}

/**
 * Recebe entries já ordenadas por sequenceNumber (asc) idealmente, mas
 * trabalha defensivamente.
 */
export function computeActionableInsights(entriesIn: ComparativeEntryRich[]): ActionableInsight[] {
  if (entriesIn.length < 2) return [];

  const entries = [...entriesIn].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  const first = entries[0];
  const last = entries[entries.length - 1];
  const insights: ActionableInsight[] = [];

  // ─── 1) Maior queda por área (entre primeiro e último) ───
  const areaDeltas: { area: string; delta: number; firstScore: number; lastScore: number }[] = [];
  const sharedAreas = Object.keys(first.areaScores).filter(a => a in last.areaScores);
  sharedAreas.forEach(area => {
    const fs = first.areaScores[area];
    const ls = last.areaScores[area];
    areaDeltas.push({ area, delta: ls - fs, firstScore: fs, lastScore: ls });
  });
  areaDeltas.sort((a, b) => a.delta - b.delta);

  const biggestDrop = areaDeltas[0];
  if (biggestDrop && biggestDrop.delta < -3) {
    insights.push({
      id: 'area-drop',
      severity: 'critical',
      title: `Foque em ${biggestDrop.area}`,
      description: `Variou de ${biggestDrop.firstScore}% para ${biggestDrop.lastScore}% — área com maior oportunidade de recuperação. Dedique sessões de revisão e questões direcionadas nas próximas 2 semanas.`,
      metric: PP(biggestDrop.delta),
      cta: {
        label: `Ver questões de ${biggestDrop.area}`,
        href: `/caderno-erros?area=${encodeURIComponent(biggestDrop.area)}`,
      },
    });
  }

  // ─── 2) Maior alta por área ───
  const biggestRise = areaDeltas[areaDeltas.length - 1];
  if (biggestRise && biggestRise.delta > 3 && biggestRise.area !== biggestDrop?.area) {
    insights.push({
      id: 'area-rise',
      severity: 'positive',
      title: `Consolide ${biggestRise.area}`,
      description: `Subiu de ${biggestRise.firstScore}% para ${biggestRise.lastScore}%. Reforce com simulados livres na área para manter a evolução.`,
      metric: PP(biggestRise.delta),
      cta: {
        label: 'Ver próximos simulados',
        href: '/simulados',
      },
    });
  }

  // ─── 3) Tempo de prova muito curto (hipótese: chute, desistência) ───
  // Provas presenciais ENAMED ~ 4h pra 100q (~144s/questão). Considera "muito rápido" abaixo de 60s/questão.
  const lastSecPerQ = last.durationSeconds != null && last.totalQuestions > 0
    ? last.durationSeconds / last.totalQuestions
    : null;
  if (lastSecPerQ != null && lastSecPerQ < 60) {
    insights.push({
      id: 'fast-pace',
      severity: 'attention',
      title: 'Ritmo bem acelerado no último simulado',
      description: `Você concluiu em ${fmtMinutes(last.durationSeconds)} (≈${Math.round(lastSecPerQ)}s/questão). Isso pode indicar leitura apressada — vale conferir se você esgotou o tempo disponível ou se está se sentindo confiante demais.`,
      metric: fmtMinutes(last.durationSeconds),
    });
  }

  // ─── 4) Variação grande de tempo entre provas ───
  if (first.durationSeconds && last.durationSeconds) {
    const ratio = last.durationSeconds / first.durationSeconds;
    if (ratio < 0.5) {
      insights.push({
        id: 'time-variation',
        severity: 'attention',
        title: 'Ritmo bem diferente entre as provas',
        description: `Você levou ${fmtMinutes(first.durationSeconds)} no primeiro e ${fmtMinutes(last.durationSeconds)} no último. Pode indicar mudança de estratégia, cansaço ou só circunstância — vale observar nas próximas provas.`,
      });
    }
  }

  // ─── 5) Alta confiança vs acerto ───
  const totalHighConf = entries.reduce((sum, e) => sum + e.highConfidenceTotal, 0);
  const totalHighConfWrong = entries.reduce((sum, e) => sum + e.highConfidenceWrong, 0);
  if (totalHighConf >= 5 && totalHighConfWrong / totalHighConf > 0.25) {
    const pct = Math.round((totalHighConfWrong / totalHighConf) * 100);
    insights.push({
      id: 'overconfidence',
      severity: 'attention',
      title: 'Cuidado com excesso de confiança',
      description: `${pct}% das questões marcadas como "alta confiança" foram erradas (${totalHighConfWrong}/${totalHighConf}). Revise os temas onde você se sente seguro mas erra.`,
      metric: `${pct}%`,
    });
  }

  // ─── 6) Saídas de foco ───
  const totalExits = entries.reduce((s, e) => s + e.tabExits + e.fullscreenExits, 0);
  if (totalExits >= 3) {
    insights.push({
      id: 'focus-loss',
      severity: 'info',
      title: 'Atenção ao foco durante a prova',
      description: `Registramos ${totalExits} saídas de aba/fullscreen entre os simulados. Em provas reais isso seria sinalizado — treine simulando o ambiente oficial.`,
      metric: `${totalExits}×`,
    });
  }

  // ─── 7) Variação geral baixa (parado) ───
  const scoreDelta = last.percentageScore - first.percentageScore;
  if (Math.abs(scoreDelta) <= 2 && areaDeltas.every(a => Math.abs(a.delta) <= 5)) {
    insights.push({
      id: 'plateau',
      severity: 'attention',
      title: 'Desempenho em platô',
      description: `Seu score se manteve em ${last.percentageScore}% (${PP(scoreDelta)}). Mude a estratégia: amplie variedade de questões e revise erros recorrentes do caderno.`,
    });
  }

  // ─── 8) Evolução geral forte ───
  if (scoreDelta >= 8) {
    insights.push({
      id: 'strong-growth',
      severity: 'positive',
      title: 'Evolução consistente',
      description: `Você subiu ${scoreDelta}pp do primeiro ao último simulado. Mantenha cadência de estudo e foco nas especialidades que ainda têm gap.`,
      metric: PP(scoreDelta),
    });
  }

  // Ordena: critical > attention > positive > info
  const order: Record<ActionableSeverity, number> = { critical: 0, attention: 1, positive: 2, info: 3 };
  insights.sort((a, b) => order[a.severity] - order[b.severity]);

  return insights;
}
