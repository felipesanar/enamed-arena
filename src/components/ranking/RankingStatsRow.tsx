import React from 'react';
import type { RankingParticipant, RankingStats } from '@/services/rankingApi';

interface Props {
  currentUser: RankingParticipant;
  totalParticipants: number;
  stats: RankingStats;
}

export function RankingStatsRow({ currentUser, totalParticipants, stats }: Props) {
  const percentil = Math.min(
    99,
    Math.round((currentUser.position / Math.max(1, totalParticipants)) * 100),
  );
  const delta = currentUser.score - stats.notaMedia;

  return (
    <div className="grid grid-cols-3 gap-2.5 mb-5">
      <div className="rounded-xl border border-border bg-card px-4 py-3">
        <p className="text-overline uppercase text-muted-foreground">Posição</p>
        <p className="text-heading-3 font-bold text-foreground tabular-nums">
          #{currentUser.position}
          <span className="text-caption font-medium text-muted-foreground"> de {totalParticipants}</span>
        </p>
      </div>
      <div className="rounded-xl border border-border bg-card px-4 py-3">
        <p className="text-overline uppercase text-muted-foreground">Percentil</p>
        <p className="text-heading-3 font-bold text-foreground tabular-nums">Top {percentil}%</p>
      </div>
      <div className="rounded-xl border border-border bg-card px-4 py-3">
        <p className="text-overline uppercase text-muted-foreground">Vs. média ({stats.notaMedia}%)</p>
        <p
          className={
            'text-heading-3 font-bold tabular-nums ' +
            (delta >= 0 ? 'text-success' : 'text-destructive')
          }
        >
          {delta >= 0 ? '+' : ''}
          {delta}%
        </p>
      </div>
    </div>
  );
}
