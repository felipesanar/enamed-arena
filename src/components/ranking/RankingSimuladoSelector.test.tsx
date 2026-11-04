import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RankingSimuladoSelector } from './RankingSimuladoSelector';

describe('RankingSimuladoSelector editions', () => {
  const items = [
    { id: 'old', title: 'Prova', sequence_number: 1, editionId: 'e-old', editionCode: '2026' },
    { id: 'new', title: 'Prova', sequence_number: 1, editionId: 'e-new', editionCode: '2027.1' },
  ];
  it('groups repeated sequence numbers and never resets a valid selection on rerender', () => {
    const onSelect = vi.fn();
    const props = { simuladosWithResults: items, selectedSimuladoId: 'old', setSelectedSimuladoId: onSelect, editionsUi: true };
    const { rerender } = render(<RankingSimuladoSelector {...props} />);
    const select = screen.getByRole('combobox', { name: 'Escolher simulado do ranking' });
    expect(select).toHaveValue('old');
    expect(within(screen.getByRole('group', { name: 'ENAMED 2027.1' })).getByRole('option')).toHaveTextContent('2027.1 · Simulado 1');
    rerender(<RankingSimuladoSelector {...props} simuladosWithResults={[...items]} />);
    expect(onSelect).not.toHaveBeenCalled();
    fireEvent.change(select, { target: { value: 'new' } });
    expect(onSelect).toHaveBeenCalledWith('new');
  });
  it('preserves legacy buttons with flag false', () => {
    render(<RankingSimuladoSelector simuladosWithResults={items} selectedSimuladoId="old" setSelectedSimuladoId={vi.fn()} />);
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });
});
