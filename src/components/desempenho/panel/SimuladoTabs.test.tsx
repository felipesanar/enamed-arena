import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SimuladoTabs } from './SimuladoTabs';
const state = vi.hoisted(() => ({ enabled: true }));
vi.mock('@/hooks/useAppConfig', () => ({ useAppConfig: () => state.enabled }));

describe('SimuladoTabs editions', () => {
  const items = [{ id: 'old', title: 'Antigo', editionId: 'e1', editionCode: '2026', sequenceNumber: 1 },
    { id: 'new', title: 'Novo', editionId: 'e2', editionCode: '2027.1', sequenceNumber: 1 }];
  it('uses grouped options without overriding the selected id', () => {
    state.enabled = true;
    const onSelect = vi.fn();
    render(<SimuladoTabs simulados={items} selectedId="old" onSelect={onSelect} />);
    expect(screen.getByRole('combobox')).toHaveValue('old');
    expect(screen.getByRole('option', { name: '2027.1 · Simulado 1' })).toHaveValue('new');
    expect(onSelect).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'new' } });
    expect(onSelect).toHaveBeenCalledWith('new');
  });
  it('keeps tabs when the flag is false', () => {
    state.enabled = false;
    render(<SimuladoTabs simulados={items} selectedId="old" onSelect={vi.fn()} />);
    expect(screen.getAllByRole('tab')).toHaveLength(2);
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });
});
