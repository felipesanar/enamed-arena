import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CutoffScoreModal } from './CutoffScoreModal';

vi.mock('@/services/rankingApi', () => {
  const rows = [
    {
      institution_name: 'Hospital das Clínicas FMUSP',
      practice_scenario: 'HC',
      specialty_name: 'Clínica Médica',
      cutoff_score_general: 91,
      cutoff_score_quota: 78,
    },
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
  ];
  return { fetchAllCutoffScores: vi.fn().mockResolvedValue(rows) };
});

function wrapper({ children }: { children?: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client }, children);
}

function renderModal(props: Partial<React.ComponentProps<typeof CutoffScoreModal>> = {}) {
  return render(
    React.createElement(
      wrapper,
      {},
      React.createElement(CutoffScoreModal, { open: true, onClose: vi.fn(), ...props }),
    ),
  );
}

describe('CutoffScoreModal', () => {
  it('does not render when open=false', () => {
    renderModal({ open: false });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders dialog with title when open=true', () => {
    renderModal();
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Notas de Corte')).toBeTruthy();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.click(screen.getByLabelText('Fechar'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when Escape key is pressed', () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not show hero card when userInstitution is not provided', async () => {
    renderModal({ userSpecialty: 'Clínica Médica' });
    // Wait for data to load (institution row appears)
    await waitFor(() => expect(screen.getByText('Hospital das Clínicas FMUSP')).toBeTruthy());
    // Hero card should not be present even after data loaded
    expect(screen.queryByText('Sua nota de corte')).toBeNull();
  });

  it('shows hero card with cutoff numbers when userInstitution matches a row', async () => {
    renderModal({ userSpecialty: 'Clínica Médica', userInstitution: 'FMUSP' });
    await waitFor(() => {
      expect(screen.getByText('Sua nota de corte')).toBeTruthy();
      expect(screen.getAllByText('91').length).toBeGreaterThan(0);
    });
  });

  it('shows PASSARIA badge when currentUserScore >= cutoff_score_general', async () => {
    renderModal({ userSpecialty: 'Clínica Médica', userInstitution: 'FMUSP', currentUserScore: 92 });
    await waitFor(() => expect(screen.getByText(/PASSARIA ✓/)).toBeTruthy());
  });

  it('shows NÃO PASSARIA badge when currentUserScore < cutoff_score_general', async () => {
    renderModal({ userSpecialty: 'Clínica Médica', userInstitution: 'FMUSP', currentUserScore: 85 });
    await waitFor(() => expect(screen.getByText(/NÃO PASSARIA ✗/)).toBeTruthy());
  });

  it('shows no pass/fail badge when currentUserScore is not provided', async () => {
    renderModal({ userSpecialty: 'Clínica Médica', userInstitution: 'FMUSP' });
    await waitFor(() => {
      expect(screen.getByText('Sua nota de corte')).toBeTruthy();
      expect(screen.queryByText(/PASSARIA/)).toBeNull();
    });
  });

  it('pins user institution row with "Sua instituição" separator', async () => {
    renderModal({ userSpecialty: 'Clínica Médica', userInstitution: 'FMUSP' });
    await waitFor(() => expect(screen.getByText('Sua instituição')).toBeTruthy());
  });

  it('does not show "Sua instituição" separator when userInstitution is not provided', async () => {
    renderModal({ userSpecialty: 'Clínica Médica' });
    await waitFor(() => expect(screen.queryByText('Sua instituição')).toBeNull());
  });

  it('auto-filters to userSpecialty on open', async () => {
    renderModal({ userSpecialty: 'Pediatria' });
    await waitFor(() => expect(screen.getByText('UFBA')).toBeTruthy());
    // HC FMUSP is Clínica Médica — should be filtered out
    expect(screen.queryByText('Hospital das Clínicas FMUSP')).toBeNull();
  });
});
