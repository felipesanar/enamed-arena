import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ExamHeader } from './ExamHeader';
afterEach(cleanup);
it('labels estimated zero honestly and only announces confirmed expiry after sync', () => {
  const { rerender } = render(<ExamHeader title="Prova" currentQuestion={1} totalQuestions={5}
    timeRemaining={0} clockTrusted={false} onFinalize={vi.fn()} />);
  expect(screen.getByRole('timer')).toHaveAccessibleName('Tempo estimado: 00:00:00');
  expect(screen.getByRole('timer')).toHaveTextContent('Tempo estimado');
  expect(screen.getByRole('timer')).not.toHaveClass('bg-destructive/8');
  expect(screen.getByRole('status')).not.toHaveTextContent('Tempo esgotado');
  rerender(<ExamHeader title="Prova" currentQuestion={1} totalQuestions={5}
    timeRemaining={0} clockTrusted onFinalize={vi.fn()} />);
  expect(screen.getByRole('timer')).toHaveAccessibleName('Tempo restante: 00:00:00');
  expect(screen.getByRole('status')).toHaveTextContent('Tempo esgotado');
});
it('keeps the visual timer silent and exposes the contextual shortcuts on click', () => {
  render(<ExamHeader title="Prova" currentQuestion={1} totalQuestions={5} timeRemaining={90} onFinalize={vi.fn()} />);
  expect(screen.getByRole('timer')).toHaveAttribute('aria-live', 'off');
  expect(screen.getByRole('timer')).toHaveClass('text-foreground', 'motion-reduce:animate-none');
  expect(screen.getByRole('button', { name: 'Finalizar' })).toHaveClass('text-foreground');
  const trigger = screen.getByRole('button', { name: 'Ver atalhos de teclado' });
  fireEvent.click(trigger);
  expect(trigger).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByText(/Antes de responder/)).toBeVisible();
  expect(screen.getByText(/baixa, média e alta/)).toBeVisible();
  fireEvent.click(trigger);
  expect(trigger).toHaveAttribute('aria-expanded', 'false');
});
