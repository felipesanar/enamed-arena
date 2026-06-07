import React from 'react';
import { Users } from 'lucide-react';
import type { RankingParticipant } from '@/services/rankingApi';
import { PositionBadge } from './PositionBadge';

type SeparatorRow = { type: 'separator'; from: number; to: number };
type TableRow = RankingParticipant | SeparatorRow;

function isSeparator(row: TableRow): row is SeparatorRow {
  return 'type' in row && (row as SeparatorRow).type === 'separator';
}

interface ThemeTokens {
  surfaceBg: string;
  surfaceBorder: string;
  tableHeaderBorder: string;
  tableHeaderText: string;
  tableRowBorder: string;
  tableUserBg: string;
  tableText: string;
  tableUserText: string;
  tableUserScore: string;
  tableScore: string;
  tableSpecialty: string;
  tableSeparator: string;
  text1: string;
  text2: string;
}

interface Props {
  tableRows: TableRow[];
  filteredParticipants: RankingParticipant[];
  currentUser: RankingParticipant | undefined;
  isDark: boolean;
  t: ThemeTokens;
  participantLabel: (item: RankingParticipant) => string;
  handleClearAllFilters: () => void;
}

export function RankingTable({
  tableRows,
  filteredParticipants,
  currentUser,
  isDark,
  t,
  participantLabel,
  handleClearAllFilters,
}: Props) {
  if (filteredParticipants.length === 0) {
    return (
      <div
        className="rounded-[16px] flex flex-col items-center text-center"
        style={{
          background: t.surfaceBg,
          border: t.surfaceBorder,
          padding: '32px 20px',
        }}
      >
        <div
          className="h-10 w-10 rounded-full flex items-center justify-center mb-3"
          style={{
            background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
          }}
          aria-hidden
        >
          <Users className="h-5 w-5" style={{ color: t.text2 }} />
        </div>
        <p
          className="font-semibold mb-1"
          style={{ fontSize: '0.9rem', color: t.text1 }}
        >
          Nenhum participante neste recorte
        </p>
        <p
          className="leading-snug mb-4 max-w-sm"
          style={{ fontSize: '0.72rem', color: t.text2 }}
        >
          Os filtros aplicados não retornaram candidatos. Ajuste ou limpe os filtros para ver o ranking completo.
        </p>
        <button
          type="button"
          onClick={handleClearAllFilters}
          className="font-semibold rounded-full transition-colors"
          style={{
            padding: '7px 16px',
            fontSize: '0.7rem',
            background: 'rgba(122,26,50,0.85)',
            color: 'white',
            border: '1px solid rgba(255,150,170,0.25)',
          }}
        >
          Limpar filtros
        </button>
      </div>
    );
  }

  return (
    <div
      className="relative overflow-hidden"
      style={{
        background: t.surfaceBg,
        border: t.surfaceBorder,
        borderRadius: '15px',
      }}
    >
      <table className="w-full">
        <thead>
          <tr style={{ borderBottom: t.tableHeaderBorder }}>
            <th className="text-left w-10 px-4 py-3" style={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: t.tableHeaderText }}>#</th>
            <th className="text-left px-2 py-3" style={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: t.tableHeaderText }}>Candidato</th>
            <th className="text-left px-2 py-3 hidden md:table-cell" style={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: t.tableHeaderText }}>Especialidade</th>
            <th className="text-left px-2 py-3 hidden md:table-cell" style={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: t.tableHeaderText }}>Instituição</th>
            <th className="text-right px-4 py-3" style={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: t.tableHeaderText }}>Nota</th>
          </tr>
        </thead>
        <tbody>
          {tableRows.map((row, i) => {
            if (isSeparator(row)) {
              return (
                <tr key={`sep-${i}`} style={{ borderBottom: t.tableRowBorder }}>
                  <td colSpan={5} className="px-4 py-2 text-center">
                    <span style={{ fontSize: '0.6rem', color: t.tableSeparator }}>
                      posições {row.from} – {row.to}
                    </span>
                  </td>
                </tr>
              );
            }

            return (
              <tr
                key={`${row.userId}-${row.position}`}
                className="transition-colors"
                style={{
                  background: row.isCurrentUser ? t.tableUserBg : undefined,
                  borderBottom:
                    i < tableRows.length - 1
                      ? t.tableRowBorder
                      : undefined,
                }}
              >
                <td className="w-10 pl-4 py-3">
                  <PositionBadge
                    position={row.position}
                    isCurrentUser={row.isCurrentUser}
                    isDark={isDark}
                  />
                </td>
                <td className="pr-2 py-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="text-sm truncate"
                      style={{
                        color: row.isCurrentUser ? t.tableUserText : t.tableText,
                        fontWeight: row.isCurrentUser ? 600 : 400,
                      }}
                    >
                      {participantLabel(row)}
                    </span>
                    {row.isCurrentUser && (
                      <span
                        className="text-[0.56rem] font-bold px-1.5 py-0.5 rounded shrink-0"
                        style={{
                          background: 'rgba(122,26,50,0.6)',
                          color: '#ff9ab0',
                          border: '1px solid rgba(255,150,170,0.2)',
                        }}
                      >
                        Você
                      </span>
                    )}
                  </div>
                </td>
                <td
                  className="pr-2 py-3 hidden md:table-cell"
                  style={{ fontSize: '0.8rem', color: t.tableSpecialty }}
                >
                  {row.specialty}
                </td>
                <td
                  className="pr-2 py-3 hidden md:table-cell"
                  style={{ fontSize: '0.8rem', color: t.tableSpecialty }}
                >
                  {row.institution}
                </td>
                <td className="pr-4 py-3 text-right">
                  <span
                    className="text-sm font-semibold tabular-nums"
                    style={{
                      color: row.isCurrentUser ? t.tableUserScore : t.tableScore,
                    }}
                  >
                    {row.score}%
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Sticky bar */}
      {currentUser && (
        <div
          className="sticky bottom-0 flex items-center justify-between px-4 py-2.5"
          style={{
            background:
              'linear-gradient(135deg, rgba(122,26,50,0.72), rgba(60,12,24,0.82))',
            borderTop: '1px solid rgba(255,150,170,0.14)',
          }}
          aria-hidden
        >
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Sua posição
          </span>
          <span className="text-sm font-bold text-white">
            #{currentUser.position} de {filteredParticipants.length}
          </span>
          <span
            className="text-sm font-semibold"
            style={{ color: '#ffcbd8' }}
          >
            {currentUser.score}%
          </span>
        </div>
      )}
    </div>
  );
}
