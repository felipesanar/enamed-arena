import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ExamTabOwnershipNotice } from './ExamTabOwnershipNotice';

describe('ownership notice', () => {
  it('announces blocking and requires an explicit action', () => {
    const takeover = vi.fn();
    render(<ExamTabOwnershipNotice status="blocked" onTakeover={takeover} />);
    expect(screen.getByRole('status')).toHaveTextContent('Esta prova está aberta em outra aba');
    fireEvent.click(screen.getByRole('button', { name: 'Continuar nesta aba' }));
    expect(takeover).toHaveBeenCalledOnce();
  });
  it('disables takeover during synchronization', () => {
    render(<ExamTabOwnershipNotice status="syncing" onTakeover={() => {}} />);
    expect(screen.getByRole('button')).toBeDisabled();
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
  });
});
