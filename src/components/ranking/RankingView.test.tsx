import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { buildTableRows, RankingView } from './RankingView';
import type { RankingParticipant, RankingStats } from '@/services/rankingApi';
import { RANKING_COMPARISON_DEFAULT } from '@/services/rankingApi';

// ── Mocks ──────────────────────────────────────────────────────────────────────
vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }));
vi.mock('@/hooks/useCutoffScores', () => ({
  useCutoffScores: vi.fn(() => ({ loading: false, cutoffs: [] })),
}));
vi.mock('./CutoffScoreModal', () => ({
  CutoffScoreModal: (): null => null,
}));

// ── Helpers ────────────────────────────────────────────────────────────────────
function makeParticipant(
  position: number,
  isCurrentUser = false,
): RankingParticipant {
  return {
    position,
    userId: `user-${position}`,
    name: isCurrentUser ? 'Eu' : `Candidato ${position}`,
    score: 100 - position,
    specialty: 'Pediatria',
    institution: 'UFBA',
    segment: 'standard',
    isCurrentUser,
  };
}

const defaultStats: RankingStats = { totalCandidatos: 20, notaMedia: 60, notaCorte: 85 };

function renderView(overrides: Partial<Parameters<typeof RankingView>[0]> = {}) {
  const props: Parameters<typeof RankingView>[0] = {
    loading: false,
    simuladosWithResults: [{ id: 's1', title: 'Simulado #1', sequence_number: 1 }],
    selectedSimuladoId: 's1',
    setSelectedSimuladoId: vi.fn(),
    filteredParticipants: Array.from({ length: 20 }, (_, i) => makeParticipant(i + 1)),
    currentUser: undefined as RankingParticipant | undefined,
    stats: defaultStats,
    rankingComparison: RANKING_COMPARISON_DEFAULT,
    setRankingComparison: vi.fn(),
    segmentFilter: 'all' as const,
    setSegmentFilter: vi.fn(),
    userSpecialty: '',
    userInstitutions: [],
    userSpecialtyId: null,
    userInstitutionIds: [],
    allowedSegments: ['all' as const],
    trackSource: 'page' as const,
    participantDisplay: 'public' as const,
    ...overrides,
  };
  return render(
    React.createElement(MemoryRouter, {}, React.createElement(RankingView, props)),
  );
}

// ── buildTableRows ─────────────────────────────────────────────────────────────
describe('buildTableRows', () => {
  it('returns all participants when no currentUser', () => {
    const participants = Array.from({ length: 15 }, (_, i) => makeParticipant(i + 1));
    const result = buildTableRows(participants, undefined);
    expect(result).toHaveLength(15);
  });

  it('returns all participants when currentUser is in top 10', () => {
    const participants = Array.from({ length: 20 }, (_, i) => makeParticipant(i + 1, i === 5));
    const result = buildTableRows(participants, participants[5]);
    expect(result).toHaveLength(20);
  });

  it('shows no separator when user is at position 11 (adjacent to top 10)', () => {
    const participants = Array.from({ length: 20 }, (_, i) => makeParticipant(i + 1, i === 10));
    const result = buildTableRows(participants, participants[10]);
    const separators = result.filter((r) => 'type' in r);
    expect(separators).toHaveLength(0);
    // top10 (10) + vicinity positions 11,12,13 (3) = 13
    expect(result).toHaveLength(13);
  });

  it('shows separator when user is at position 17 (gap = 4 > 3)', () => {
    const participants = Array.from({ length: 30 }, (_, i) => makeParticipant(i + 1, i === 16));
    const result = buildTableRows(participants, participants[16]);
    const separators = result.filter((r): r is { type: 'separator'; from: number; to: number } =>
      'type' in r && (r as any).type === 'separator',
    );
    expect(separators).toHaveLength(1);
    // separator from 11 to vicinityStart-1 = 15-1 = 14
    expect(separators[0]).toEqual({ type: 'separator', from: 11, to: 14 });
    // top10 (10) + separator (1) + vicinity positions 15,16,17,18,19 (5) = 16
    expect(result).toHaveLength(16);
  });

  it('shows no separator when user is at position 16 (gap = 3, not > 3)', () => {
    const participants = Array.from({ length: 25 }, (_, i) => makeParticipant(i + 1, i === 15));
    const result = buildTableRows(participants, participants[15]);
    const separators = result.filter((r) => 'type' in r);
    expect(separators).toHaveLength(0);
  });
});

// ── RankingView component ──────────────────────────────────────────────────────
describe('RankingView', () => {
  it('shows empty state when no participants and no currentUser', () => {
    renderView({ filteredParticipants: [], currentUser: undefined });
    expect(screen.getByText('Sem participantes')).toBeTruthy();
  });

  it('shows aspirational hero when currentUser is undefined', () => {
    renderView({ currentUser: undefined });
    expect(screen.getByText('Você ainda não está no ranking')).toBeTruthy();
  });

  it('shows hero standing (posição/frase) from fallback when currentUser exists', () => {
    const user = makeParticipant(5, true);
    const participants = Array.from({ length: 20 }, (_, i) => makeParticipant(i + 1, i === 4));
    // sem heroStanding → fallback: position 5 de 20 → supera 15 candidatos
    renderView({ currentUser: user, filteredParticipants: participants });
    expect(screen.getByText('Você supera 15 candidatos')).toBeTruthy();
  });

  it('uses explicit heroStanding (global) over the filtered fallback', () => {
    const user = makeParticipant(5, true);
    const participants = Array.from({ length: 20 }, (_, i) => makeParticipant(i + 1, i === 4));
    renderView({
      currentUser: user,
      filteredParticipants: participants,
      heroStanding: { position: 1, total: 100, percentil: 1, score: 99 },
    });
    // global: position 1 de 100 → supera 99 (não o fallback de 15)
    expect(screen.getByText('Você supera 99 candidatos')).toBeTruthy();
  });

  it('shows cutoff card (always visible) with the institution row', () => {
    renderView({
      userSpecialty: 'Pediatria',
      userInstitutions: ['Hospital X'],
      userSpecialtyId: 'spec-1',
      userInstitutionIds: ['inst-1'],
    });
    // card visível direto (sem collapse)
    expect(screen.getByText('Você passaria?')).toBeTruthy();
    expect(screen.getByText('Sua nota vs. notas de corte')).toBeTruthy();
    // cutoffs mock vazio → instituição listada como indisponível
    expect(screen.getByText('Hospital X')).toBeTruthy();
    expect(screen.getByText('corte indisponível')).toBeTruthy();
  });

  it('hides cutoff section entirely when showApprovalPanel is false (admin)', () => {
    renderView({ showApprovalPanel: false });
    expect(screen.queryByText('Você passaria?')).toBeNull();
  });

  it('shows low confidence banner when fewer than 30 participants', () => {
    renderView({ filteredParticipants: Array.from({ length: 15 }, (_, i) => makeParticipant(i + 1)) });
    expect(screen.getByText('Poucos candidatos nesse recorte')).toBeTruthy();
  });

  it('does not show low confidence banner when 30 or more participants', () => {
    renderView({
      filteredParticipants: Array.from({ length: 30 }, (_, i) => makeParticipant(i + 1)),
    });
    expect(screen.queryByText('Poucos candidatos nesse recorte')).toBeNull();
  });
});
