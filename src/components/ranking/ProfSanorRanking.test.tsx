import React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { computePercentile } from '@/lib/ranking-percentile';
const { summary } = vi.hoisted(() => ({ summary: vi.fn(() => ({ markdown: null, generatedAt: null, loading: false, error: null, generate: vi.fn(), canGenerate: false })) }));
vi.mock('@/hooks/useAiEditionContext', () => ({ useAiSummary: summary }));
vi.mock('@/components/comparativo/ProfSanorAvatar', () => ({ ProfSanorAvatar: () => null }));
vi.mock('@/hooks/useCutoffContext', () => ({ useCutoffContext: () => ({ cutoffContext: null, loading: true }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
import { ProfSanorRanking } from '@/components/ranking/ProfSanorRanking';

describe('ProfSanorRanking context wiring', () => {
  it('uses real position/population, never the score percentile', () => {
    render(<ProfSanorRanking studentName="Aluno" simuladoId="exam" editionId="ed" currentUser={{ position: 7, score: 83 } as never} stats={{ totalCandidatos: 123, notaMedia: 62, notaCorte: 88 }} />);
    expect(summary).toHaveBeenCalledWith(expect.objectContaining({ kind: 'ranking', simuladoIds: ['exam'], editionIds: ['ed'], percentile: computePercentile(7, 123) }));
  });
});
