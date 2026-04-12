import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CutoffScoreModal } from './CutoffScoreModal';

vi.mock('@/services/rankingApi', () => ({
  fetchAllCutoffScores: vi.fn().mockResolvedValue([
    {
      institution_name: 'UFBA',
      practice_scenario: 'HC',
      specialty_name: 'Pediatria',
      cutoff_score_general: 70,
      cutoff_score_quota: 60,
    },
    {
      institution_name: 'USP',
      practice_scenario: 'HCFMUSP',
      specialty_name: 'Cirurgia',
      cutoff_score_general: 80,
      cutoff_score_quota: null,
    },
  ]),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client }, children);
}

describe('CutoffScoreModal', () => {
  it('does not render when open=false', () => {
    render(
      React.createElement(wrapper, {}, React.createElement(CutoffScoreModal, { open: false, onClose: vi.fn() })),
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders dialog when open=true', async () => {
    render(
      React.createElement(wrapper, {},
        React.createElement(CutoffScoreModal, { open: true, onClose: vi.fn() }),
      ),
    );
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Notas de Corte ENAMED')).toBeTruthy();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(
      React.createElement(wrapper, {},
        React.createElement(CutoffScoreModal, { open: true, onClose }),
      ),
    );
    fireEvent.click(screen.getByLabelText('Fechar modal'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when Escape key is pressed', () => {
    const onClose = vi.fn();
    render(
      React.createElement(wrapper, {},
        React.createElement(CutoffScoreModal, { open: true, onClose }),
      ),
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
