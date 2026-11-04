import React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
const { summary } = vi.hoisted(() => ({ summary: vi.fn(() => ({ markdown: null, generatedAt: null, loading: false, error: null, generate: vi.fn(), canGenerate: false })) }));
vi.mock('@/hooks/useAiEditionContext', () => ({ useAiSummary: summary }));
vi.mock('@/components/comparativo/ProfSanorAvatar', () => ({ ProfSanorAvatar: () => null }));
vi.mock('@/hooks/useCutoffContext', () => ({ useCutoffContext: () => ({ cutoffContext: null, loading: true }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
import { ComparativoHero } from '@/components/comparativo/ComparativoHero';

describe('ComparativoHero context wiring', () => {
  it('keeps every series ID and edition, so mixed series fail closed in the shared hook', () => {
    const entries = [{ simuladoId: 'one', editionId: 'old', areaScores: { cirurgia: 50 } }, { simuladoId: 'two', editionId: 'new', areaScores: { cirurgia: 60 } }];
    render(<ComparativoHero studentName="Aluno" entries={entries as never} />);
    expect(summary).toHaveBeenCalledWith(expect.objectContaining({ kind: 'comparative', simuladoIds: ['one', 'two'], editionIds: ['old', 'new'], body: expect.objectContaining({ simulados: [expect.objectContaining({ simuladoId: 'one', editionId: 'old' }), expect.objectContaining({ simuladoId: 'two', editionId: 'new' })] }) }));
  });
});
