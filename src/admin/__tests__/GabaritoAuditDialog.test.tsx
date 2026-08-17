import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GabaritoAuditDialog } from '@/admin/components/GabaritoAuditDialog';
import type { GabaritoSummary } from '@/admin/lib/gabaritoCheck';
import type { GabaritoAiFinding } from '@/admin/services/adminApi';

const summaryWithFindings: GabaritoSummary = {
  errors: [
    {
      questionNumber: 49,
      checkType: 'key_comment_conflict',
      severity: 'error',
      proposedLabel: 'C',
      what: 'Comentário marca a alternativa C como CORRETA, mas o gabarito está em B',
      how: 'Corrija o gabarito para C ou ajuste o comentário.',
      evidence: 'Alternativa C: CORRETA. Explicação da aloimunização...',
    },
  ],
  warnings: [
    {
      questionNumber: 46,
      checkType: 'option_letter_misalignment',
      severity: 'warning',
      proposedLabel: 'D',
      what: 'O parágrafo da alternativa C casa melhor com o texto da alternativa D',
      how: 'Confira se os parágrafos do comentário não foram trocados.',
      evidence: 'cardiopatias congênitas são a causa mais comum...',
    },
  ],
  unverifiableCount: 0,
  blockedQuestionNumbers: [49],
};

const baseProps = {
  open: true,
  onOpenChange: vi.fn(),
  onRunAiSecondOpinion: vi.fn(),
  onBackToFix: vi.fn(),
  onPublishAnyway: vi.fn(),
};

describe('GabaritoAuditDialog', () => {
  it('mostra os achados de erro e de aviso, com a letra proposta', () => {
    render(<GabaritoAuditDialog {...baseProps} summary={summaryWithFindings} />);

    expect(screen.getByText('1 questão com erro')).toBeInTheDocument();
    expect(screen.getByText('1 aviso')).toBeInTheDocument();
    expect(screen.getByText('Questão 49')).toBeInTheDocument();
    expect(screen.getByText('Questão 46')).toBeInTheDocument();
    expect(screen.getByText(/Comentário marca a alternativa C como CORRETA/)).toBeInTheDocument();
    expect(screen.getByText(/casa melhor com o texto da alternativa D/)).toBeInTheDocument();

    const proposedLabels = screen.getAllByText(/Proposta:/);
    expect(proposedLabels).toHaveLength(2);
    expect(screen.getByText('Proposta: C')).toBeInTheDocument();
    expect(screen.getByText('Proposta: D')).toBeInTheDocument();
  });

  it('não mostra a linha agregada de "sem marcação verificável" quando unverifiableCount é 0', () => {
    render(<GabaritoAuditDialog {...baseProps} summary={summaryWithFindings} />);
    expect(screen.queryByText(/sem marcação verificável/)).not.toBeInTheDocument();
  });

  it('mostra a linha agregada quando unverifiableCount > 0', () => {
    const summary: GabaritoSummary = { ...summaryWithFindings, unverifiableCount: 12 };
    render(<GabaritoAuditDialog {...baseProps} summary={summary} />);
    expect(screen.getByText(/12 questões sem marcação verificável/)).toBeInTheDocument();
  });

  it('"Publicar mesmo assim" chama onPublishAnyway', () => {
    const onPublishAnyway = vi.fn();
    render(<GabaritoAuditDialog {...baseProps} summary={summaryWithFindings} onPublishAnyway={onPublishAnyway} />);
    fireEvent.click(screen.getByRole('button', { name: 'Publicar mesmo assim' }));
    expect(onPublishAnyway).toHaveBeenCalledTimes(1);
  });

  it('"Voltar e corrigir" chama onBackToFix', () => {
    const onBackToFix = vi.fn();
    render(<GabaritoAuditDialog {...baseProps} summary={summaryWithFindings} onBackToFix={onBackToFix} />);
    fireEvent.click(screen.getByRole('button', { name: 'Voltar e corrigir' }));
    expect(onBackToFix).toHaveBeenCalledTimes(1);
  });

  it('"Conferir também com a IA" chama onRunAiSecondOpinion e mostra estado de carregamento', () => {
    const onRunAiSecondOpinion = vi.fn();
    const { rerender } = render(
      <GabaritoAuditDialog {...baseProps} summary={summaryWithFindings} onRunAiSecondOpinion={onRunAiSecondOpinion} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Conferir também com a IA/ }));
    expect(onRunAiSecondOpinion).toHaveBeenCalledTimes(1);

    rerender(
      <GabaritoAuditDialog
        {...baseProps}
        summary={summaryWithFindings}
        onRunAiSecondOpinion={onRunAiSecondOpinion}
        aiLoading
      />,
    );
    expect(screen.getByText(/Conferindo com a IA/)).toBeInTheDocument();
  });

  it('injeta achados da IA na mesma lista, identificados como vindos da IA', () => {
    const aiFindings: GabaritoAiFinding[] = [
      {
        question_number: 12,
        source: 'ai',
        check_type: 'key_semantic_mismatch',
        proposed_label: 'A',
        severity: 'warning',
        evidence: 'O raciocínio do comentário conclui em A, não em B.',
      },
    ];
    render(<GabaritoAuditDialog {...baseProps} summary={summaryWithFindings} aiFindings={aiFindings} />);
    expect(screen.getByText('Questão 12')).toBeInTheDocument();
    expect(screen.getByText('Proposta: A')).toBeInTheDocument();
    expect(screen.getByText(/O raciocínio do comentário conclui em A/)).toBeInTheDocument();
  });
});
