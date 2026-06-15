import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CutoffScoreModal } from './CutoffScoreModal';

vi.mock('@/services/rankingApi', () => {
  const rows = [
    {
      institution_id: 'inst-1',
      institution_name: 'Hospital das Clínicas FMUSP',
      practice_scenario: 'HC',
      specialty_name: 'Clínica Médica',
      cutoff_score_general: 91,
      cutoff_score_quota: 78,
    },
    {
      institution_id: 'inst-2',
      institution_name: 'UNIFESP',
      practice_scenario: 'HSP',
      specialty_name: 'Clínica Médica',
      cutoff_score_general: 84,
      cutoff_score_quota: 70,
    },
    {
      institution_id: 'inst-3',
      institution_name: 'UFBA',
      practice_scenario: 'HC',
      specialty_name: 'Pediatria',
      cutoff_score_general: 70,
      cutoff_score_quota: 60,
    },
    {
      institution_id: 'inst-4',
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

  it('does not render a hero card (verdict lives in the page panel)', async () => {
    renderModal({
      userSpecialty: 'Clínica Médica',
      userInstitutions: ['Hospital das Clínicas FMUSP'],
      currentUserScore: 95,
    });
    await waitFor(() => expect(screen.getByText('Hospital das Clínicas FMUSP')).toBeTruthy());
    expect(screen.queryByText('Sua nota de corte')).toBeNull();
    expect(screen.queryByText(/PASSARIA/)).toBeNull();
  });

  it('pins multiple user institutions under "Suas instituições"', async () => {
    renderModal({
      userSpecialty: 'Clínica Médica',
      userInstitutions: ['Hospital das Clínicas FMUSP', 'UNIFESP'],
    });
    await waitFor(() => expect(screen.getByText('Suas instituições')).toBeTruthy());
    expect(screen.getByText('Hospital das Clínicas FMUSP')).toBeTruthy();
    expect(screen.getByText('UNIFESP')).toBeTruthy();
    // Pinned rows are excluded from the scrollable list (no duplicates)
    expect(screen.getAllByText('Hospital das Clínicas FMUSP')).toHaveLength(1);
    expect(screen.getAllByText('UNIFESP')).toHaveLength(1);
  });

  it('does not show "Suas instituições" when userInstitutions is not provided', async () => {
    renderModal({ userSpecialty: 'Clínica Médica' });
    await waitFor(() => expect(screen.getByText('Hospital das Clínicas FMUSP')).toBeTruthy());
    expect(screen.queryByText('Suas instituições')).toBeNull();
  });

  it('shows pass badge per pinned row when currentUserScore >= cutoff', async () => {
    renderModal({
      userSpecialty: 'Clínica Médica',
      userInstitutions: ['Hospital das Clínicas FMUSP', 'UNIFESP'],
      currentUserScore: 92,
    });
    await waitFor(() =>
      expect(screen.getAllByLabelText('acima do corte')).toHaveLength(2),
    );
    expect(screen.queryByLabelText('abaixo do corte')).toBeNull();
  });

  it('shows fail badge per pinned row when currentUserScore < cutoff', async () => {
    renderModal({
      userSpecialty: 'Clínica Médica',
      userInstitutions: ['Hospital das Clínicas FMUSP', 'UNIFESP'],
      currentUserScore: 60,
    });
    await waitFor(() =>
      expect(screen.getAllByLabelText('abaixo do corte')).toHaveLength(2),
    );
    expect(screen.queryByLabelText('acima do corte')).toBeNull();
  });

  it('shows mixed badges when score is between the two cutoffs', async () => {
    renderModal({
      userSpecialty: 'Clínica Médica',
      userInstitutions: ['Hospital das Clínicas FMUSP', 'UNIFESP'],
      currentUserScore: 85, // >= 84 (UNIFESP), < 91 (FMUSP)
    });
    await waitFor(() =>
      expect(screen.getAllByLabelText('acima do corte')).toHaveLength(1),
    );
    expect(screen.getAllByLabelText('abaixo do corte')).toHaveLength(1);
  });

  it('shows no pass/fail badges when currentUserScore is not provided', async () => {
    renderModal({
      userSpecialty: 'Clínica Médica',
      userInstitutions: ['Hospital das Clínicas FMUSP'],
    });
    await waitFor(() => expect(screen.getByText('Suas instituições')).toBeTruthy());
    expect(screen.queryByLabelText('acima do corte')).toBeNull();
    expect(screen.queryByLabelText('abaixo do corte')).toBeNull();
  });

  it('auto-filters to userSpecialty on open', async () => {
    renderModal({ userSpecialty: 'Pediatria' });
    await waitFor(() => expect(screen.getByText('UFBA')).toBeTruthy());
    // FMUSP is Clínica Médica — should be filtered out
    expect(screen.queryByText('Hospital das Clínicas FMUSP')).toBeNull();
  });

  it('filters rows by search text', async () => {
    renderModal();
    await waitFor(() => expect(screen.getByText('UFBA')).toBeTruthy());
    fireEvent.change(screen.getByLabelText('Buscar instituição ou especialidade'), {
      target: { value: 'cirurgia' },
    });
    expect(screen.getByText('USP')).toBeTruthy();
    expect(screen.queryByText('UFBA')).toBeNull();
  });
});
