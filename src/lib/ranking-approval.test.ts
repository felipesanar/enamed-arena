import { describe, it, expect } from 'vitest';
import { deriveApprovalEntries } from '@/lib/ranking-approval';
import type { CutoffScoreRow } from '@/services/rankingApi';

const cutoff = (over: Partial<CutoffScoreRow>): CutoffScoreRow => ({
  institution_id: 'i1',
  institution_name: 'UFBA',
  practice_scenario: 'HC',
  specialty_name: 'PEDIATRIA',
  cutoff_score_general: 70,
  cutoff_score_quota: 60,
  ...over,
});

const targets = [
  { id: 'i1', name: 'UFBA' },
  { id: 'i2', name: 'UFPR' },
];

describe('deriveApprovalEntries', () => {
  it('marca pass quando nota >= corte geral', () => {
    const entries = deriveApprovalEntries(targets, [cutoff({ institution_id: 'i1' })], 75);
    expect(entries[0]).toMatchObject({
      institutionId: 'i1',
      status: 'pass',
      cutoffGeneral: 70,
      gap: 5,
    });
  });

  it('marca fail com gap positivo quando nota < corte', () => {
    const entries = deriveApprovalEntries(targets, [cutoff({ institution_id: 'i1' })], 62);
    expect(entries[0]).toMatchObject({ status: 'fail', gap: 8 });
  });

  it('marca unavailable para instituição sem linha de corte', () => {
    const entries = deriveApprovalEntries(targets, [cutoff({ institution_id: 'i1' })], 75);
    expect(entries[1]).toMatchObject({
      institutionId: 'i2',
      institutionName: 'UFPR',
      status: 'unavailable',
      cutoffGeneral: null,
    });
  });

  it('preserva a ordem das instituições-alvo', () => {
    const entries = deriveApprovalEntries(targets, [cutoff({ institution_id: 'i2', institution_name: 'UFPR' })], 75);
    expect(entries.map((e) => e.institutionId)).toEqual(['i1', 'i2']);
  });

  it('sem nota do usuário (null) => status unknown com corte exibido', () => {
    const entries = deriveApprovalEntries(targets, [cutoff({ institution_id: 'i1' })], null);
    expect(entries[0]).toMatchObject({ status: 'unknown', cutoffGeneral: 70 });
  });

  it('retorna [] sem instituições', () => {
    expect(deriveApprovalEntries([], [], 75)).toEqual([]);
  });
});
