import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
vi.mock('@/admin/services/adminEditionsApi', () => ({ adminEditionsApi: { clone: vi.fn() } }));
import { adminEditionsApi } from '@/admin/services/adminEditionsApi';
import { CloneSimuladoDialog } from '@/admin/components/editions/CloneSimuladoDialog';

describe('CloneSimuladoDialog', () => {
  beforeEach(() => vi.clearAllMocks());
  it('preserves input on error and sends only a draft clone request on retry', async () => {
    vi.mocked(adminEditionsApi.clone).mockRejectedValueOnce(new Error('conflict')).mockResolvedValueOnce('clone-id');
    const done = vi.fn();
    render(<CloneSimuladoDialog source={{ id: 'source', title: 'Original' }} editions={[{ id: 'e', code: '2027.1', label: 'Destino' } as never]} onClose={vi.fn()} onCloned={done} />);
    fireEvent.change(screen.getByLabelText('Edição de destino'), { target: { value: 'e' } });
    fireEvent.change(screen.getByLabelText('Abre em (horário de Brasília)'), { target: { value: '2027-01-01T08:00' } });
    fireEvent.change(screen.getByLabelText('Fecha em (horário de Brasília)'), { target: { value: '2027-01-02T08:00' } });
    fireEvent.change(screen.getByLabelText('Libera resultados (horário de Brasília)'), { target: { value: '2027-01-03T08:00' } });
    fireEvent.click(screen.getByLabelText('Copiar questões e alternativas com novos IDs'));
    fireEvent.click(screen.getByRole('button', { name: 'Clonar como rascunho' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Seus valores foram mantidos');
    expect(screen.getByLabelText('Edição de destino')).toHaveValue('e');
    expect(done).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Clonar como rascunho' }));
    await waitFor(() => expect(done).toHaveBeenCalledWith('clone-id'));
    expect(adminEditionsApi.clone).toHaveBeenLastCalledWith({ sourceSimuladoId: 'source', editionId: 'e', windowStart: '2027-01-01T11:00:00.000Z', windowEnd: '2027-01-02T11:00:00.000Z', resultsReleaseAt: '2027-01-03T11:00:00.000Z', copyQuestions: true });
  });
});
