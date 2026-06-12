import React from 'react';
import { Users } from 'lucide-react';
import type { RankingParticipant } from '@/services/rankingApi';
import { PositionBadge } from './PositionBadge';

type SeparatorRow = { type: 'separator'; from: number; to: number };
type TableRow = RankingParticipant | SeparatorRow;

function isSeparator(row: TableRow): row is SeparatorRow {
  return 'type' in row && (row as SeparatorRow).type === 'separator';
}

interface Props {
  tableRows: TableRow[];
  filteredParticipants: RankingParticipant[];
  currentUser: RankingParticipant | undefined;
  participantLabel: (item: RankingParticipant) => string;
  handleClearAllFilters: () => void;
}

const th = 'px-2 py-3 text-micro-label font-bold uppercase tracking-wider text-muted-foreground';

export function RankingTable({
  tableRows,
  filteredParticipants,
  currentUser,
  participantLabel,
  handleClearAllFilters,
}: Props) {
  if (filteredParticipants.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card flex flex-col items-center text-center px-5 py-8">
        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mb-3" aria-hidden>
          <Users className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-body font-semibold text-foreground mb-1">Nenhum participante neste recorte</p>
        <p className="text-caption text-muted-foreground leading-snug mb-4 max-w-sm">
          Os filtros aplicados não retornaram candidatos. Ajuste ou limpe os filtros para ver o ranking completo.
        </p>
        <button
          type="button"
          onClick={handleClearAllFilters}
          className="rounded-full bg-primary px-4 py-1.5 text-caption font-semibold text-white hover:bg-wine-hover transition-colors"
        >
          Limpar filtros
        </button>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            <th className={`${th} text-left w-10 pl-4`}>#</th>
            <th className={`${th} text-left`}>Candidato</th>
            <th className={`${th} text-left hidden md:table-cell`}>Especialidade</th>
            <th className={`${th} text-left hidden md:table-cell`}>Instituição</th>
            <th className={`${th} text-right pr-4`}>Nota</th>
          </tr>
        </thead>
        <tbody>
          {tableRows.map((row, i) => {
            if (isSeparator(row)) {
              return (
                <tr key={`sep-${i}`} className="border-b border-border">
                  <td colSpan={5} className="px-4 py-2 text-center">
                    <span className="text-micro-label text-muted-foreground">
                      posições {row.from} – {row.to}
                    </span>
                  </td>
                </tr>
              );
            }
            return (
              <tr
                key={`${row.userId}-${row.position}`}
                className={
                  (row.isCurrentUser ? 'bg-primary/5 dark:bg-primary/15 ' : '') +
                  (i < tableRows.length - 1 ? 'border-b border-border' : '')
                }
              >
                <td className="w-10 pl-4 py-3">
                  <PositionBadge position={row.position} isCurrentUser={row.isCurrentUser} />
                </td>
                <td className="pr-2 py-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={
                        'text-sm truncate ' +
                        (row.isCurrentUser ? 'font-semibold text-foreground' : 'text-foreground/80')
                      }
                    >
                      {participantLabel(row)}
                    </span>
                    {row.isCurrentUser && (
                      <span className="rounded bg-primary px-1.5 py-0.5 text-[0.6rem] font-bold text-white shrink-0">
                        Você
                      </span>
                    )}
                  </div>
                </td>
                <td className="pr-2 py-3 hidden md:table-cell text-caption text-muted-foreground">
                  {row.specialty}
                </td>
                <td className="pr-2 py-3 hidden md:table-cell text-caption text-muted-foreground">
                  {row.institution}
                </td>
                <td className="pr-4 py-3 text-right">
                  <span
                    className={
                      'text-sm font-semibold tabular-nums ' +
                      (row.isCurrentUser ? 'text-primary' : 'text-foreground/80')
                    }
                  >
                    {row.score}%
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Sticky bar — superfície wine always-dark (padrão do projeto) */}
      {currentUser && (
        <div
          className="sticky bottom-0 flex items-center justify-between px-4 py-2.5 text-white"
          style={{ background: 'linear-gradient(135deg, hsl(345 65% 32%), hsl(345 70% 18%))' }}
          aria-hidden
        >
          <span className="text-xs text-white/60">Sua posição</span>
          <span className="text-sm font-bold">#{currentUser.position} de {filteredParticipants.length}</span>
          <span className="text-sm font-semibold text-white/85">{currentUser.score}%</span>
        </div>
      )}
    </div>
  );
}
