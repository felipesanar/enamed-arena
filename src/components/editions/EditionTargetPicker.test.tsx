import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { vi } from 'vitest';
import { EditionTargetPicker, type EditionTargetValue } from './EditionTargetPicker';

const state = vi.hoisted(() => ({ flag: true, reads: vi.fn(), query: { data: [], isSuccess: true, isPending: false, isError: false, refetch: vi.fn(), now: new Date('2026-11-04') } }));
vi.mock('@/hooks/useAppConfig', () => ({ useAppConfig: () => state.flag }));
vi.mock('@/hooks/useExamEditions', () => ({ useExamEditions: () => { state.reads(); return state.query; } }));

function Picker() {
  const [value, onChange] = useState<EditionTargetValue>({ targetEditionId: undefined, expectedGraduationTerm: null });
  return <><EditionTargetPicker value={value} onChange={onChange} /><pre>{JSON.stringify(value)}</pre></>;
}

beforeEach(() => {
  state.flag = true;
  Object.assign(state.query, { data: [{ id: '69365186-9047-4491-a248-366dd537cc01', code: '2035.2', label: 'ENAMED com nome longo', year: 2035, term: 2, status: 'planned', exam_date: null }], isSuccess: true, isPending: false, isError: false });
  state.query.refetch.mockClear();
  state.reads.mockClear();
});

it('uses catalog UUIDs, supports years beyond the demo, and never auto-selects a suggestion', () => {
  render(<Picker />);
  fireEvent.change(screen.getByLabelText('Ano de conclusão'), { target: { value: '2035' } });
  fireEvent.change(screen.getByLabelText('Semestre de conclusão'), { target: { value: '2' } });
  expect(screen.getByRole('status')).toHaveTextContent(/sugestão.*ENAMED com nome longo/i);
  expect(screen.getAllByRole('radio').every(radio => !(radio as HTMLInputElement).checked)).toBe(true);
  fireEvent.click(screen.getByRole('radio', { name: /ENAMED com nome longo/i }));
  expect(screen.getByRole('status')).toHaveTextContent('Sugestão');
  expect(screen.getByRole('status').parentElement).toHaveTextContent('2035.2');
  expect(screen.getByRole('radio', { name: /ENAMED com nome longo/i })).toHaveAttribute('value', '69365186-9047-4491-a248-366dd537cc01');
});

it.each(['error', 'empty', 'loading'])('keeps explicit undecided available with catalog %s', kind => {
  Object.assign(state.query, { data: [], isSuccess: kind === 'empty', isError: kind === 'error', isPending: kind === 'loading' });
  render(<Picker />);
  fireEvent.click(screen.getByRole('radio', { name: /Ainda não sei/i }));
  expect(screen.getByRole('radio', { name: /Ainda não sei/i })).toBeChecked();
  if (kind !== 'loading') {
    fireEvent.click(screen.getByRole('button', { name: /tentar novamente/i }));
    expect(state.query.refetch).toHaveBeenCalledOnce();
  }
});

it('removes the picker when the flag is off', () => {
  state.flag = false;
  render(<Picker />);
  expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  expect(state.reads).not.toHaveBeenCalled();
});
