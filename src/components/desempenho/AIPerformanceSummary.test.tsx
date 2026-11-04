import React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
const { summary } = vi.hoisted(() => ({ summary: vi.fn(() => ({ markdown: null, generatedAt: null, loading: false, error: null, generate: vi.fn(), canGenerate: false })) }));
vi.mock('@/hooks/useAiEditionContext', () => ({ useAiSummary: summary }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
import { AIPerformanceSummary } from '@/components/desempenho/AIPerformanceSummary';

describe('manual performance summary', () => {
  it('uses the same isolated lifecycle and never automatically invokes AI', () => {
    render(<AIPerformanceSummary studentName="Aluno" simuladoId="exam" editionId="ed" breakdown={{ overall: {}, byArea: [], bySubspecialty: [] } as never} />);
    expect(summary).toHaveBeenCalledWith(expect.objectContaining({ kind: 'performance', auto: false, simuladoIds: ['exam'], editionIds: ['ed'] }));
  });
});
