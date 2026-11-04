import { fireEvent, render, screen } from '@testing-library/react';
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
const { useExamFlow } = vi.hoisted(() => ({ useExamFlow: vi.fn() }));
vi.mock('@/hooks/useExamFlow', () => ({ useExamFlow }));
vi.mock('@/hooks/useCadernoV2Flag', () => ({ useCadernoV2Flag: () => false }));
vi.mock('@/contexts/UserContext', () => ({ useHasAccess: () => false }));
vi.mock('@/services/simuladosApi', () => ({ simuladosApi: {} }));
vi.mock('@/components/exam/ExamCompletedScreen', () => ({ ExamCompletedScreen: () => null }));
vi.mock('@/components/exam/ExamHeader', () => ({ ExamHeader: ({ onFinalize }: any) => <button onClick={onFinalize}>Finalizar</button> }));
vi.mock('@/components/exam/SubmitConfirmModal', () => ({ SubmitConfirmModal: () => null }));
import SimuladoExamPage from '@/pages/SimuladoExamPage';

const originalScroll = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView');
beforeAll(() => Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() }));
afterAll(() => {
  if (originalScroll) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', originalScroll);
  else Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
});
let flow: any;
beforeEach(() => {
  const question = { id: 'q', number: 1, text: 'Questão de teste', area: 'Clínica', theme: 'Teste',
    options: [{ id: 'opt', letter: 'A', text: 'Resposta de teste' }] };
  flow = { loading: false, isCompleted: false, interactionLocked: false, submitting: false,
    simulado: { id: 'sim', title: 'Prova de teste' }, questions: [question], questionIds: ['q'], currentQuestion: question,
    state: { status: 'in_progress', answers: {} }, currentIndex: 0, currentAnswer: { selectedOption: 'opt', eliminatedAlternatives: [] },
    summary: { answered: 1, total: 1, unanswered: 0 }, timeRemaining: 60,
    tabLease: { status: 'owned', blocked: false, takeover: vi.fn() },
    preparation: { status: 'ready', retry: vi.fn() },
     focusControl: { isTabAway: false, isFullscreenLost: false }, setShowSubmitModal: vi.fn(),
     finalize: vi.fn(),
    handleSelectOption: vi.fn(), handleEliminateOption: vi.fn(), handleSetConfidence: vi.fn(),
    toggleReview: vi.fn(), toggleHighConfidence: vi.fn(), handleNavigate: vi.fn(), setShowNavigator: vi.fn(),
  };
  useExamFlow.mockImplementation(() => flow);
});
it('natively disables answers, confidence and marks on expiry, without disabling finalization', () => {
  const { rerender } = render(<SimuladoExamPage />);
  const answer = screen.getByRole('radio', { name: /Resposta de teste/ });
  expect(answer).toBeEnabled();
  flow = { ...flow, interactionLocked: true, timeRemaining: 0 };
  rerender(<SimuladoExamPage />);
  expect(answer).toBeDisabled();
  expect(screen.getByRole('radio', { name: /Chute/ })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Marcar p/ revisar' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Alta certeza' })).toBeDisabled();
  // Native click respects a disabled fieldset; fireEvent dispatches synthetically.
  (answer as HTMLButtonElement).click();
  expect(flow.handleSelectOption).not.toHaveBeenCalled();
  expect(screen.getByRole('status')).toHaveTextContent(/Tempo esgotado/);
  const retry = screen.getByRole('button', { name: 'Tentar finalizar novamente' });
  expect(retry).toBeEnabled();
  fireEvent.click(retry);
  expect(flow.finalize).toHaveBeenCalledWith(true);
  expect(screen.getByRole('button', { name: 'Finalizar' })).toBeEnabled();
});
it('keeps the submission lock readable and separate from fullscreen loss', () => {
  flow = { ...flow, interactionLocked: true, submitting: true,
    focusControl: { isTabAway: false, isFullscreenLost: true, enterFullscreen: vi.fn() } };
  render(<SimuladoExamPage />);
  expect(screen.getByRole('status')).toHaveTextContent(/Confirmando/);
  expect(screen.getByRole('button', { name: 'Voltar à tela cheia' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Marcar p/ revisar' })).toBeDisabled();
});
it('keeps another-tab ownership distinct from expiry and offers a guarded takeover', () => {
  flow = { ...flow, interactionLocked: true,
    tabLease: { status: 'blocked', blocked: true, takeover: vi.fn() } };
  render(<SimuladoExamPage />);
  expect(screen.getByRole('status')).toHaveTextContent('Esta prova está aberta em outra aba');
  expect(screen.queryByText(/Tempo esgotado/)).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Tentar finalizar novamente' })).not.toBeInTheDocument();
  const answer = screen.getByRole('radio', { name: /Resposta de teste/ });
  expect(answer).toBeDisabled();
  (answer as HTMLButtonElement).click();
  expect(flow.handleSelectOption).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Finalizar' }));
  expect(flow.setShowSubmitModal).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Continuar nesta aba' }));
  expect(flow.tabLease.takeover).toHaveBeenCalledOnce();
  expect(flow.finalize).not.toHaveBeenCalled();
});

it('does not present estimated zero or a pending clock as confirmed expiry', () => {
  flow = { ...flow, interactionLocked: true, clockTrusted: false, timeRemaining: 0 };
  const { rerender } = render(<SimuladoExamPage />);
  expect(screen.queryByText(/Tempo esgotado/)).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Tentar finalizar novamente' })).not.toBeInTheDocument();
  flow = { ...flow, timeRemaining: 300 };
  rerender(<SimuladoExamPage />);
  expect(screen.queryByText('Restam 5 minutos para o término da prova.')).not.toBeInTheDocument();
});

it('offers enabled preparation retry after clock failure and disables it while retry is pending', () => {
  flow = { ...flow, clockTrusted: false, interactionLocked: true,
    preparation: { status: 'error', retry: vi.fn() } };
  const { rerender } = render(<SimuladoExamPage />);
  const retry = screen.getByRole('button', { name: 'Tentar novamente' });
  expect(retry).toBeEnabled();
  fireEvent.click(retry);
  expect(flow.preparation.retry).toHaveBeenCalledOnce();
  flow = { ...flow, preparation: { ...flow.preparation, status: 'preparing' } };
  rerender(<SimuladoExamPage />);
  expect(screen.getByRole('button', { name: 'Preparando...' })).toBeDisabled();
  expect(screen.queryByText(/Tempo esgotado/)).not.toBeInTheDocument();
});

it('does not mistake other interaction locks for an expired deadline', () => {
  flow = { ...flow, clockTrusted: true, interactionLocked: true, timeRemaining: 60 };
  render(<SimuladoExamPage />);
  expect(screen.queryByText(/Tempo esgotado/)).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Tentar finalizar novamente' })).not.toBeInTheDocument();
});
