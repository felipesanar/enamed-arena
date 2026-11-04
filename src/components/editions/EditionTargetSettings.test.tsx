import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { EditionTargetForm, EditionTargetSettings } from './EditionTargetSettings';

const state = vi.hoisted(() => ({ flag: true, id: 'account-a', loading: false, save: vi.fn(), target: null as string | null, catalog: 'ready' }));
vi.mock('@/hooks/useAppConfig', () => ({ useAppConfig: () => state.flag }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: state.id ? { id: state.id } : null, loading: state.loading }) }));
vi.mock('@/contexts/UserContext', () => ({ useUser: () => ({ profile: { id: state.id }, onboarding: { userId: state.id, targetEditionId: state.target, expectedGraduationTerm: null }, isLoading: false, onboardingEditLocked: true, saveTargetEdition: state.save }) }));
vi.mock('@/hooks/useExamEditions', () => ({ useExamEditions: () => ({ data: state.catalog === 'ready' ? [{ id: '69365186-9047-4491-a248-366dd537cc01', code: '2027.1', label: 'Edição real', year: 2027, term: 1, status: 'planned', exam_date: null }] : [], isSuccess: state.catalog === 'ready' || state.catalog === 'empty', isPending: state.catalog === 'loading', isError: state.catalog === 'error', now: new Date(), refetch: vi.fn() }) }));

beforeEach(() => { Object.assign(state, { flag: true, id: 'account-a', loading: false, target: null, catalog: 'ready' }); state.save.mockReset().mockResolvedValue(undefined); });

it('rejects an undefined choice without saving or silently converting it to null', async () => {
  render(<EditionTargetForm initialValue={{ targetEditionId: undefined, expectedGraduationTerm: null }} />);
  fireEvent.click(screen.getByRole('button', { name: 'Salvar edição' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Escolha uma edição ou marque Ainda não sei.');
  expect(state.save).not.toHaveBeenCalled();
  expect(screen.getByRole('radio', { name: /Ainda não sei/ })).not.toBeChecked();
  fireEvent.click(screen.getByRole('radio', { name: /Ainda não sei/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Salvar edição' }));
  await waitFor(() => expect(state.save).toHaveBeenCalledExactlyOnceWith(null, null));
});

it('saves real UUID/null with optional graduation even during academic lock', async () => {
  render(<EditionTargetSettings />);
  fireEvent.click(screen.getByRole('radio', { name: /Edição real/i }));
  fireEvent.click(screen.getByRole('button', { name: 'Salvar edição' }));
  await waitFor(() => expect(state.save).toHaveBeenCalledWith('69365186-9047-4491-a248-366dd537cc01', null));
  await screen.findByText('Edição salva. Você pode alterar sua escolha quando quiser.');
  fireEvent.click(screen.getByRole('radio', { name: /Ainda não sei/i }));
  fireEvent.click(screen.getByRole('button', { name: 'Salvar edição' }));
  await waitFor(() => expect(state.save).toHaveBeenLastCalledWith(null, null));
});

it('preserves fields after failure, validates the graduation pair and retries', async () => {
  state.save.mockRejectedValueOnce(new Error('offline'));
  render(<EditionTargetSettings />);
  fireEvent.change(screen.getByLabelText('Ano de conclusão'), { target: { value: '2035' } });
  fireEvent.click(screen.getByRole('radio', { name: /Ainda não sei/i }));
  fireEvent.click(screen.getByRole('button', { name: 'Salvar edição' }));
  expect(state.save).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Semestre de conclusão'), { target: { value: '2' } });
  fireEvent.click(screen.getByRole('button', { name: 'Salvar edição' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível salvar/i);
  expect(screen.getByLabelText('Ano de conclusão')).toHaveValue('2035');
  expect(screen.getByRole('radio', { name: /Ainda não sei/i })).toBeChecked();
  fireEvent.click(screen.getByRole('button', { name: 'Salvar edição' }));
  await waitFor(() => expect(state.save).toHaveBeenLastCalledWith(null, '2035.2'));
});

it.each(['error', 'empty', 'loading'])('can save explicit null with catalog %s', async catalog => {
  state.catalog = catalog;
  render(<EditionTargetSettings />);
  fireEvent.click(screen.getByRole('radio', { name: /Ainda não sei/i }));
  fireEvent.click(screen.getByRole('button', { name: 'Salvar edição' }));
  await waitFor(() => expect(state.save).toHaveBeenCalledWith(null, null));
});

it('never silently converts a selected UUID to null when catalog fails', async () => {
  const view = render(<EditionTargetSettings />);
  fireEvent.click(screen.getByRole('radio', { name: /Edição real/ }));
  state.catalog = 'error';
  view.rerender(<EditionTargetSettings />);
  fireEvent.click(screen.getByRole('button', { name: 'Salvar edição' }));
  expect(state.save).not.toHaveBeenCalled();
  expect(screen.getByRole('alert')).toHaveTextContent(/conferir a edição selecionada/);
  expect(screen.getByRole('radio', { name: /Ainda não sei/ })).not.toBeChecked();
});

it.each(['account', 'flag', 'logout'])('never applies an old draft after %s changes while the catalog is loading', kind => {
  state.catalog = 'loading';
  const view = render(<EditionTargetSettings />);
  fireEvent.change(screen.getByLabelText('Ano de conclusão'), { target: { value: '2035' } });
  if (kind === 'account') state.id = 'account-b';
  if (kind === 'flag') state.flag = false;
  if (kind === 'logout') state.id = '';
  view.rerender(<EditionTargetSettings />);
  state.catalog = 'ready';
  view.rerender(<EditionTargetSettings />);
  if (kind !== 'account') expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  Object.assign(state, { flag: true, id: 'account-b' });
  view.rerender(<EditionTargetSettings />);
  expect(screen.getByLabelText('Ano de conclusão')).toHaveValue('');
  expect(screen.getByRole('radio', { name: /Edição real/ })).not.toBeChecked();
  expect(state.save).not.toHaveBeenCalled();
});

it.each(['account', 'flag', 'logout', 'loading'])('ignores pending completion after %s transition and never leaks a draft', async kind => {
  let resolve: () => void;
  state.save.mockReturnValue(new Promise<void>(done => { resolve = done; }));
  const view = render(<EditionTargetSettings />);
  fireEvent.change(screen.getByLabelText('Ano de conclusão'), { target: { value: '2035' } });
  fireEvent.change(screen.getByLabelText('Semestre de conclusão'), { target: { value: '2' } });
  fireEvent.click(screen.getByRole('button', { name: 'Salvar edição' }));
  fireEvent.click(screen.getByRole('button', { name: /salvando/i }));
  expect(state.save).toHaveBeenCalledOnce();
  if (kind === 'account') state.id = 'account-b';
  if (kind === 'flag') state.flag = false;
  if (kind === 'logout') state.id = '';
  if (kind === 'loading') state.loading = true;
  view.rerender(<EditionTargetSettings />);
  await act(async () => resolve());
  expect(screen.queryByText(/Edição salva\./)).not.toBeInTheDocument();
  Object.assign(state, { flag: true, id: 'account-b', loading: false });
  view.rerender(<EditionTargetSettings />);
  expect(screen.getByLabelText('Ano de conclusão')).toHaveValue('');
});
