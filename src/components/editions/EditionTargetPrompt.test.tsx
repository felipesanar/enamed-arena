import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { EditionTargetPrompt } from './EditionTargetPrompt';

const state = vi.hoisted(() => ({ flag: true, id: 'account-a', loading: false, profileId: 'account-a', target: null as string | null, save: vi.fn() }));
vi.mock('@/hooks/useAppConfig', () => ({ useAppConfig: () => state.flag }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: state.id ? { id: state.id } : null, loading: state.loading }) }));
vi.mock('@/contexts/UserContext', () => ({ useUser: () => ({ profile: { id: state.profileId }, onboarding: { userId: state.profileId, targetEditionId: state.target, expectedGraduationTerm: null }, isLoading: false, saveTargetEdition: state.save }) }));
vi.mock('@/hooks/useExamEditions', () => ({ useExamEditions: () => ({ data: [], isSuccess: true, isPending: false, isError: false, now: new Date(), refetch: vi.fn() }) }));

function Page() { return <><h1 data-edition-target-focus tabIndex={-1}>Início</h1><EditionTargetPrompt /><a href="/simulados">Simulados</a></>; }
beforeEach(() => { Object.assign(state, { flag: true, id: 'account-a', profileId: 'account-a', loading: false, target: null }); state.save.mockReset().mockResolvedValue(undefined); });

it('opens a Radix dialog, closes with Escape/Cancel and returns focus without blocking navigation', async () => {
  render(<Page />);
  const trigger = screen.getByRole('button', { name: 'Escolher edição' });
  fireEvent.click(trigger);
  const dialog = await screen.findByRole('dialog');
  expect(dialog).toBeInTheDocument();
  screen.getByText('Simulados').focus();
  expect(dialog).toContainElement(document.activeElement as HTMLElement);
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  await waitFor(() => expect(trigger).toHaveFocus());
  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
  await waitFor(() => expect(trigger).toHaveFocus());
  fireEvent.click(screen.getByRole('button', { name: 'Agora não' }));
  expect(screen.queryByRole('button', { name: 'Escolher edição' })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Simulados' })).toHaveAttribute('href', '/simulados');
});

it('saves null only after explicit undecided and focuses the existing home anchor after success', async () => {
  render(<Page />);
  expect(screen.getByRole('heading', { name: 'Início' })).not.toHaveFocus();
  fireEvent.click(screen.getByRole('button', { name: 'Escolher edição' }));
  fireEvent.click(screen.getByRole('button', { name: 'Salvar edição' }));
  expect(state.save).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('radio', { name: /Ainda não sei/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Salvar edição' }));
  await waitFor(() => expect(state.save).toHaveBeenCalledWith(null, null));
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Início' })).toHaveFocus());
  expect(screen.queryByRole('button', { name: 'Escolher edição' })).not.toBeInTheDocument();
});

it('does not leak a dismissal across accounts or an old save after flag/account transitions', async () => {
  const view = render(<Page />);
  fireEvent.click(screen.getByRole('button', { name: 'Agora não' }));
  state.id = 'account-b'; state.profileId = 'account-b';
  view.rerender(<Page />);
  fireEvent.click(screen.getByRole('button', { name: 'Escolher edição' }));
  let resolve: () => void;
  state.save.mockReturnValue(new Promise<void>(done => { resolve = done; }));
  fireEvent.click(screen.getByRole('radio', { name: /Ainda não sei/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Salvar edição' }));
  state.flag = false;
  view.rerender(<Page />);
  await act(async () => resolve());
  expect(screen.queryByText(/Edição salva/)).not.toBeInTheDocument();
  state.flag = true;
  view.rerender(<Page />);
  expect(screen.getByRole('button', { name: 'Escolher edição' })).toBeInTheDocument();
});

it('waits for the save promise even when the context refresh already contains an explicit target', async () => {
  let resolve: () => void;
  state.save.mockReturnValue(new Promise<void>(done => { resolve = done; }));
  const view = render(<Page />);
  fireEvent.click(screen.getByRole('button', { name: 'Escolher edição' }));
  fireEvent.click(screen.getByRole('radio', { name: /Ainda não sei/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Salvar edição' }));
  state.target = '69365186-9047-4491-a248-366dd537cc01';
  view.rerender(<Page />);
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(screen.queryByText(/Edição salva\./)).not.toBeInTheDocument();
  await act(async () => resolve());
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Início' })).toHaveFocus());
});

it.each(['flag', 'loading', 'stale', 'explicit', 'logout'])('hides for %s without redirect', kind => {
  if (kind === 'flag') state.flag = false;
  if (kind === 'loading') state.loading = true;
  if (kind === 'stale') state.profileId = 'previous-account';
  if (kind === 'explicit') state.target = '69365186-9047-4491-a248-366dd537cc01';
  if (kind === 'logout') state.id = '';
  render(<Page />);
  expect(screen.queryByRole('button', { name: 'Escolher edição' })).not.toBeInTheDocument();
});
