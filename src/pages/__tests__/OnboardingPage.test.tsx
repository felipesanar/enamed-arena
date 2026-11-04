import { act, render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import OnboardingPage from "../OnboardingPage";
import { trackEvent } from '@/lib/analytics';

const { saveOnboarding, navigateMock, toastMock, state } = vi.hoisted(() => ({
  saveOnboarding: vi.fn(),
  navigateMock: vi.fn(),
  toastMock: vi.fn(),
  state: { flag: false, id: 'account-a', loading: false, completed: false, saveTarget: vi.fn() },
}));

vi.mock('@/hooks/useAppConfig', () => ({ useAppConfig: () => state.flag }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: state.id ? { id: state.id } : null, loading: state.loading }) }));
vi.mock('@/hooks/useExamEditions', () => ({ useExamEditions: () => ({ data: [{ id: '69365186-9047-4491-a248-366dd537cc01', code: '2035.2', label: 'Edição do catálogo', year: 2035, term: 2, status: 'planned', exam_date: null }], isSuccess: true, isPending: false, isError: false, now: new Date(), refetch: vi.fn() }) }));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock("@/contexts/UserContext", () => ({
  useUser: () => ({
    profile: { id: state.id, segment: "pro" },
    onboarding: null as any,
    isOnboardingComplete: state.completed,
    isLoading: false,
    saveOnboarding,
    saveTargetEdition: state.saveTarget,
    onboardingEditLocked: false,
    onboardingNextEditableAt: null as any,
  }),
}));

// Step mocks interativos — expõem o novo contrato baseado em objetos { id, name }
vi.mock("@/components/onboarding/SpecialtyStep", () => ({
  SpecialtyStep: ({ selection, onSelect }: any) => (
    <div data-testid="specialty-step">
      <button
        onClick={() => onSelect({ id: "spec-1", name: "Clínica Médica" })}
      >
        Selecionar Clínica Médica
      </button>
      <span data-testid="selected-specialty-name">{selection?.name ?? ""}</span>
    </div>
  ),
}));
vi.mock("@/components/onboarding/InstitutionStep", () => ({
  InstitutionStep: ({ onToggleInstitution, onToggleUndecided }: any) => (
    <div data-testid="institution-step">
      <button onClick={() => onToggleInstitution({ id: "inst-1", name: "USP" })}>
        Selecionar USP
      </button>
      <button onClick={() => onToggleUndecided()}>Marcar indeciso</button>
    </div>
  ),
}));
vi.mock("@/components/onboarding/ConfirmationStep", () => ({
  ConfirmationStep: ({ specialtyName, institutionNames }: any) => (
    <div data-testid="confirmation-step">
      <span data-testid="confirmation-specialty">{specialtyName}</span>
      <span data-testid="confirmation-institutions">
        {institutionNames.join(",")}
      </span>
    </div>
  ),
}));
vi.mock("@/hooks/usePersistedState", async () => {
  const { useState } = await import("react");
  return {
    usePersistedState: (_key: string, initial: unknown) => useState(initial),
    clearPersistedStateByPrefix: vi.fn(),
  };
});
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));
vi.mock("@/hooks/use-toast", () => ({ toast: toastMock }));
vi.mock("@/components/brand/BrandMark", () => ({
  BrandLogo: () => <span>Logo</span>,
}));
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, initial: _i, animate: _a, exit: _e, transition: _t, ...rest }: any) => (
      <div {...rest}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
  useReducedMotion: () => true,
}));

function Wrapper({ children }: { children: React.ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

beforeEach(() => {
  Object.assign(state, { flag: false, id: 'account-a', loading: false, completed: false });
  state.saveTarget.mockReset().mockResolvedValue(undefined);
  saveOnboarding.mockClear().mockResolvedValue(undefined);
  navigateMock.mockClear();
  toastMock.mockClear();
  vi.mocked(trackEvent).mockClear();
});

it("renders onboarding header and step 0 by default", () => {
  render(<OnboardingPage />, { wrapper: Wrapper });
  expect(screen.getByText("Logo")).toBeInTheDocument();
  expect(screen.getByTestId("specialty-step")).toBeInTheDocument();
  expect(screen.getByText(/Etapa 1 de 3/)).toBeInTheDocument();
  expect(state.saveTarget).not.toHaveBeenCalled();
});

it("renders Continuar button on step 0", () => {
  render(<OnboardingPage />, { wrapper: Wrapper });
  expect(screen.getByRole("button", { name: /continuar/i })).toBeInTheDocument();
});

describe('edition step integration', () => {
  it('groups each number and full label in one passive progress item and advances only after target save', async () => {
    state.flag = true;
    let finish!: () => void;
    state.saveTarget.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
    render(<OnboardingPage />, { wrapper: Wrapper });
    const progress = screen.getByRole('list', { name: 'Progresso do cadastro' });
    const items = within(progress).getAllByRole('listitem');
    expect(items).toHaveLength(4);
    expect(within(items[0]).getByText('Sua edição')).toBeVisible();
    expect(within(items[0]).getByText('1')).toBeInTheDocument();
    expect(within(items[1]).getByText('Especialidade')).toBeVisible();
    expect(within(items[1]).getByText('2')).toBeInTheDocument();
    expect(within(items[2]).getByText('Instituições')).toBeVisible();
    expect(within(items[2]).getByText('3')).toBeInTheDocument();
    expect(within(items[3]).getByText('Confirmação')).toBeVisible();
    expect(within(items[3]).getByText('4')).toBeInTheDocument();
    expect(progress.querySelectorAll('[aria-current="step"]')).toHaveLength(1);
    expect(items[0]).toHaveAttribute('aria-current', 'step');
    expect(within(progress).queryByRole('button')).not.toBeInTheDocument();
    expect(within(progress).queryByRole('link')).not.toBeInTheDocument();
    expect(progress.querySelector('[tabindex]')).toBeNull();
    fireEvent.click(within(items[3]).getByText('Confirmação'));
    expect(screen.getByText(/Etapa 1 de 4: Sua edição/)).toBeInTheDocument();
    expect(saveOnboarding).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Salvar e continuar' }));
    expect(state.saveTarget).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('radio', { name: /Ainda não sei/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar e continuar' }));
    expect(items[0]).toHaveAttribute('aria-current', 'step');
    await act(async () => finish());
    await screen.findByTestId('specialty-step');
    expect(items[1]).toHaveAttribute('aria-current', 'step');
    expect(items[0]).not.toHaveAttribute('aria-current');
    expect(screen.getByText(/Etapa 2 de 4: Especialidade/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Selecionar Clínica Médica'));
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }));
    expect(items[2]).toHaveAttribute('aria-current', 'step');
    expect(screen.getByText(/Etapa 3 de 4: Instituições/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Marcar indeciso'));
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }));
    expect(items[3]).toHaveAttribute('aria-current', 'step');
    expect(screen.getByText(/Etapa 4 de 4: Confirmação/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /voltar/i }));
    expect(items[2]).toHaveAttribute('aria-current', 'step');
    expect(progress.querySelectorAll('[aria-current="step"]')).toHaveLength(1);
  });

  it.each([false, true])('keeps the legacy progress for flag=%s when no new target step is needed', flag => {
    state.flag = flag;
    state.completed = flag;
    render(<OnboardingPage />, { wrapper: Wrapper });
    expect(screen.queryByRole('list', { name: 'Progresso do cadastro' })).not.toBeInTheDocument();
    expect(screen.getByText(/Etapa 1 de 3: Especialidade/)).toBeInTheDocument();
    expect(screen.queryByText('Sua edição')).not.toBeInTheDocument();
  });

  it.each(['explicit', 'undecided'])('saves %s before advancing with no graduation and preserves safe presencial next', async kind => {
    state.flag = true;
    render(<MemoryRouter initialEntries={['/onboarding?next=%2Fpresencial%2Fcheckin%3Fid%3D123']}><OnboardingPage /></MemoryRouter>);
    expect(screen.getByText(/Etapa 1 de 4/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Salvar e continuar' }));
    expect(state.saveTarget).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('radio', { name: kind === 'explicit' ? /Edição do catálogo/ : /Ainda não sei/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar e continuar' }));
    await waitFor(() => expect(state.saveTarget).toHaveBeenCalledWith(kind === 'explicit' ? '69365186-9047-4491-a248-366dd537cc01' : null, null));
    await screen.findByTestId('specialty-step');
    fireEvent.click(screen.getByText('Selecionar Clínica Médica'));
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }));
    fireEvent.click(screen.getByText('Marcar indeciso'));
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }));
    expect(screen.getByText(/Etapa 4 de 4/)).toBeInTheDocument();
    expect(screen.getByText('Conclusão prevista')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /começar/i }));
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/presencial/checkin?id=123'));
    expect(saveOnboarding).toHaveBeenCalledWith({ specialtyId: 'spec-1', targetInstitutionIds: [] });
    expect(trackEvent).not.toHaveBeenCalledWith('onboarding_completed', expect.anything());
  });

  it('does not force completed students through the new step', () => {
    state.flag = true; state.completed = true;
    render(<OnboardingPage />, { wrapper: Wrapper });
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(screen.getByText(/Etapa 1 de 3/)).toBeInTheDocument();
  });

  it('keeps target fields on a failed save and advances only after successful retry', async () => {
    state.flag = true;
    state.saveTarget.mockRejectedValueOnce(new Error('offline'));
    render(<OnboardingPage />, { wrapper: Wrapper });
    fireEvent.click(screen.getByRole('radio', { name: /Ainda não sei/ }));
    fireEvent.change(screen.getByLabelText('Ano de conclusão'), { target: { value: '2035' } });
    fireEvent.change(screen.getByLabelText('Semestre de conclusão'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar e continuar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Suas escolhas foram mantidas/);
    expect(screen.getByLabelText('Ano de conclusão')).toHaveValue('2035');
    expect(screen.queryByTestId('specialty-step')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Salvar e continuar' }));
    await screen.findByTestId('specialty-step');
    expect(state.saveTarget).toHaveBeenLastCalledWith(null, '2035.2');
  });

  it('ignores an old academic save after account switch without redirecting the next student', async () => {
    let resolve: () => void;
    saveOnboarding.mockReturnValue(new Promise<void>(done => { resolve = done; }));
    const view = render(<OnboardingPage />, { wrapper: Wrapper });
    fireEvent.click(screen.getByText('Selecionar Clínica Médica'));
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }));
    fireEvent.click(screen.getByText('Marcar indeciso'));
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }));
    fireEvent.click(screen.getByRole('button', { name: /começar/i }));
    state.id = 'account-b';
    view.rerender(<OnboardingPage />);
    await act(async () => resolve());
    expect(navigateMock).not.toHaveBeenCalled();
    expect(screen.getByTestId('selected-specialty-name')).toHaveTextContent('');
  });

  it.each(['//external.test', 'https://external.test'])('does not navigate to unsafe next %s', async next => {
    render(<MemoryRouter initialEntries={[`/onboarding?next=${encodeURIComponent(next)}`]}><OnboardingPage /></MemoryRouter>);
    fireEvent.click(screen.getByText('Selecionar Clínica Médica'));
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }));
    fireEvent.click(screen.getByText('Marcar indeciso'));
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }));
    fireEvent.click(screen.getByRole('button', { name: /começar/i }));
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/'));
    expect(state.saveTarget).not.toHaveBeenCalled();
  });

  it.each(['account', 'flag', 'logout'])('discards stale target completion after %s', async kind => {
    state.flag = true;
    let resolve: () => void;
    state.saveTarget.mockReturnValue(new Promise<void>(done => { resolve = done; }));
    const view = render(<OnboardingPage />, { wrapper: Wrapper });
    fireEvent.click(screen.getByRole('radio', { name: /Ainda não sei/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar e continuar' }));
    if (kind === 'account') state.id = 'account-b';
    if (kind === 'flag') state.flag = false;
    if (kind === 'logout') state.id = '';
    view.rerender(<OnboardingPage />);
    await act(async () => resolve());
    expect(navigateMock).not.toHaveBeenCalled();
    if (kind === 'account') expect(screen.getByText(/Etapa 1 de 4/)).toBeInTheDocument();
    if (kind === 'flag') expect(screen.getByText(/Etapa 1 de 3/)).toBeInTheDocument();
    if (kind === 'logout') expect(screen.queryByTestId('specialty-step')).not.toBeInTheDocument();
  });
});

describe("desktop left column", () => {
  it("renders step 0 title text in the DOM (left column)", () => {
    render(<OnboardingPage />, { wrapper: Wrapper });
    // STEP_META[0].title is rendered by the left column — always in DOM even if hidden via CSS
    const els = screen.getAllByText("Qual sua especialidade desejada?");
    expect(els.length).toBeGreaterThanOrEqual(1);
  });

  it("renders step 0 desktop tips in the DOM", () => {
    render(<OnboardingPage />, { wrapper: Wrapper });
    expect(
      screen.getByText("Aparece no seu ranking e comparativos")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Editável entre janelas de prova")
    ).toBeInTheDocument();
  });
});

describe("fluxo completo por ID canônico", () => {
  it("salva specialtyId e targetInstitutionIds ao concluir", async () => {
    render(<OnboardingPage />, { wrapper: Wrapper });

    // Step 0: seleciona especialidade (objeto { id, name })
    fireEvent.click(screen.getByText("Selecionar Clínica Médica"));
    expect(screen.getByTestId("selected-specialty-name")).toHaveTextContent(
      "Clínica Médica"
    );
    fireEvent.click(screen.getByRole("button", { name: /continuar/i }));

    // Step 1: seleciona instituição
    expect(screen.getByTestId("institution-step")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Selecionar USP"));
    fireEvent.click(screen.getByRole("button", { name: /continuar/i }));

    // Step 2: confirmação exibe nomes resolvidos
    expect(screen.getByTestId("confirmation-specialty")).toHaveTextContent(
      "Clínica Médica"
    );
    expect(screen.getByTestId("confirmation-institutions")).toHaveTextContent(
      "USP"
    );

    fireEvent.click(screen.getByRole("button", { name: /começar/i }));
    await waitFor(() =>
      expect(saveOnboarding).toHaveBeenCalledWith({
        specialtyId: "spec-1",
        targetInstitutionIds: ["inst-1"],
      })
    );
    expect(navigateMock).toHaveBeenCalledWith("/");
    expect(trackEvent).not.toHaveBeenCalledWith('onboarding_completed', expect.anything());
  });

  it("instituições indecisas salvam array vazio e mostram toast ao limpar seleção", async () => {
    render(<OnboardingPage />, { wrapper: Wrapper });

    fireEvent.click(screen.getByText("Selecionar Clínica Médica"));
    fireEvent.click(screen.getByRole("button", { name: /continuar/i }));

    // Seleciona uma instituição e depois marca indeciso — toast de remoção sobe da página
    fireEvent.click(screen.getByText("Selecionar USP"));
    fireEvent.click(screen.getByText("Marcar indeciso"));
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringContaining("Seleção anterior removida"),
      })
    );

    fireEvent.click(screen.getByRole("button", { name: /continuar/i }));
    fireEvent.click(screen.getByRole("button", { name: /começar/i }));
    await waitFor(() =>
      expect(saveOnboarding).toHaveBeenCalledWith({
        specialtyId: "spec-1",
        targetInstitutionIds: [],
      })
    );
  });
});
