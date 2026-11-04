import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import type { PropsWithChildren } from 'react';
import type { HTMLMotionProps } from 'framer-motion';
import ConfiguracoesPage from '../ConfiguracoesPage';

const state = vi.hoisted(() => ({ flag: true, save: vi.fn() }));
vi.mock('@/hooks/useAppConfig', () => ({ useAppConfig: () => state.flag }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'account-a', email: 'test@example.test' }, loading: false, signOut: vi.fn() }) }));
vi.mock('@/contexts/UserContext', () => ({ useUser: () => ({ profile: { id: 'account-a', name: 'Pessoa', segment: 'pro' }, onboarding: { userId: 'account-a', specialty: 'Clínica', specialtyId: 's1', targetInstitutionIds: [], targetInstitutions: [], targetEditionId: null }, isLoading: false, isOnboardingComplete: true, onboardingEditLocked: true, saveTargetEdition: state.save }) }));
vi.mock('@/hooks/useExamEditions', () => ({ useExamEditions: () => ({ data: [], isSuccess: true, isPending: false, isError: false, now: new Date(), refetch: vi.fn() }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/components/profile/AcademicProfileEditor', () => ({ AcademicProfileEditor: () => <div>Editor acadêmico</div> }));
vi.mock('@/components/settings/SettingsHero', () => ({ SettingsHero: () => <h1>Configurações</h1> }));
vi.mock('@/components/settings/NotificationsSection', () => ({ NotificationsSection: () => null }));
vi.mock('@/components/settings/InlineNameEdit', () => ({ InlineNameEdit: ({ value }: { value: string }) => <span>{value}</span> }));
vi.mock('@/components/settings/CopyableText', () => ({ CopyableText: ({ value }: { value: string }) => <span>{value}</span> }));
vi.mock('@/components/settings/SettingsNav', () => ({ SettingsNav: ({ sections, onSelect }: { sections: { id: string; label: string }[]; onSelect: (id: string) => void }) => <nav>{sections.map(s => <button key={s.id} onClick={() => onSelect(s.id)}>{s.label}</button>)}</nav> }));
vi.mock('framer-motion', async () => {
  const { createElement, forwardRef } = await import('react');
  return { AnimatePresence: ({ children }: PropsWithChildren) => children, useReducedMotion: () => true, motion: {
    div: ({ children, initial: _i, animate: _a, exit: _e, transition: _t, ...props }: PropsWithChildren<Omit<HTMLMotionProps<'div'>, 'children'>>) => createElement('div', props, children),
    section: forwardRef<HTMLElement, PropsWithChildren<Omit<HTMLMotionProps<'section'>, 'children'>>>(({ children, initial: _i, whileInView: _w, viewport: _v, transition: _t, ...props }, ref) => createElement('section', { ...props, ref }, children)),
  } };
});

beforeEach(() => { state.flag = true; state.save.mockReset().mockResolvedValue(undefined); });
it('keeps edition target writable while academic editing remains locked', async () => {
  render(<ConfiguracoesPage />);
  fireEvent.click(screen.getByRole('button', { name: 'Perfil acadêmico' }));
  expect(screen.getByText('Edição bloqueada durante janela ativa')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Salvar edição' }));
  await waitFor(() => expect(state.save).toHaveBeenCalledWith(null, null));
});

it('does not mount new target controls with flag off', () => {
  state.flag = false;
  render(<ConfiguracoesPage />);
  fireEvent.click(screen.getByRole('button', { name: 'Perfil acadêmico' }));
  expect(screen.queryByRole('button', { name: 'Salvar edição' })).not.toBeInTheDocument();
  expect(screen.getByText('Edição bloqueada durante janela ativa')).toBeInTheDocument();
});
