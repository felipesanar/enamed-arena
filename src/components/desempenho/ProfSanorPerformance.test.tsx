import React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
const { summary } = vi.hoisted(() => ({ summary: vi.fn(() => ({ markdown: null, generatedAt: null, loading: false, error: null, generate: vi.fn(), canGenerate: false })) }));
vi.mock('@/hooks/useAiEditionContext', () => ({ useAiSummary: summary }));
vi.mock('@/components/comparativo/ProfSanorAvatar', () => ({ ProfSanorAvatar: () => null }));
vi.mock('@/hooks/useCutoffContext', () => ({ useCutoffContext: () => ({ cutoffContext: null, loading: true }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
import { ProfSanorPerformance } from '@/components/desempenho/ProfSanorPerformance';

describe('ProfSanorPerformance context wiring', () => {
  it('signs all performance data and forwards the actual historic exam edition', () => {
    const breakdown = { overall: { totalQuestions: 120, totalCorrect: 80, totalAnswered: 100, percentageScore: 67 }, byArea: [], bySubspecialty: [] } as never;
    render(<ProfSanorPerformance studentName="Aluno" simuladoId="historic-exam" editionId="historic" breakdown={breakdown} />);
    expect(summary).toHaveBeenCalledWith(expect.objectContaining({ kind: 'performance', simuladoIds: ['historic-exam'], editionIds: ['historic'], body: expect.objectContaining({ overall: expect.objectContaining({ totalQuestions: 120 }) }) }));
  });
});
