import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { OfflineModeSimpleDialog } from "./OfflineModeSimpleDialog";
import { offlineApi } from '@/services/offlineApi';
import { persistOfflineAttempt } from '@/hooks/useOfflineAttempt';
let userId = 'u1';
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: userId } }) }));

// ── react-router-dom — stub useNavigate ──────────────────────────────────────
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

// ── Side-effect deps (not exercised by the online path) ──────────────────────
vi.mock("@/services/offlineApi", () => ({
  offlineApi: {
    createOfflineAttempt: vi.fn(),
    getSignedPdfUrl: vi.fn(),
  },
}));
vi.mock("@/hooks/useOfflineAttempt", () => ({
  persistOfflineAttempt: vi.fn(),
  useOfflineAttempt: () => ({ activeAttempt: null }),
}));
vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
}));

const sim = {
  id: "11111111-1111-1111-1111-111111111111",
  slug: "simulado-8-enamed",
  title: "Simulado Teste",
  description: "Desc",
  sequenceNumber: 8,
  status: "available" as const,
  questionsCount: 100,
  estimatedDuration: "5h",
  estimatedDurationMinutes: 300,
  themeTags: [] as string[],
  resultsReleaseAt: "2026-04-15T12:00:00Z",
  executionWindowStart: "2026-04-01T08:00:00Z",
  executionWindowEnd: "2026-04-01T18:00:00Z",
  userState: { simuladoId: "sim-8", started: false, finished: false },
} as any;

describe("OfflineModeSimpleDialog — online mode start", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetAllMocks(); userId = 'u1';
    vi.unstubAllGlobals();
  });

  it('persists before PDF failure and retries same attempt without force', async () => {
    vi.mocked(offlineApi.createOfflineAttempt).mockResolvedValue({ attempt_id: 'a1', started_at: '2026-04-01T08:00:00Z', exam_duration_seconds: 18000, simulado_slug: sim.slug });
    vi.mocked(offlineApi.getSignedPdfUrl).mockRejectedValue(new Error('PDF failed'));
    render(<OfflineModeSimpleDialog open onOpenChange={vi.fn()} sim={sim} />);
    fireEvent.click(screen.getByText('Experiência offline'));
    fireEvent.click(screen.getByRole('button', { name: /continuar e baixar/i }));
    await screen.findByRole('button', { name: /tentar baixar PDF novamente/i });
    expect(persistOfflineAttempt).toHaveBeenCalledWith('u1', expect.objectContaining({ id: 'a1' }));
    expect(vi.mocked(persistOfflineAttempt).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(offlineApi.getSignedPdfUrl).mock.invocationCallOrder[0]);
    fireEvent.click(screen.getByRole('button', { name: /tentar baixar PDF novamente/i }));
    await waitFor(() => expect(offlineApi.getSignedPdfUrl).toHaveBeenCalledTimes(2));
    expect(offlineApi.getSignedPdfUrl).toHaveBeenCalledWith(sim.id, false, expect.any(AbortSignal));
    expect(offlineApi.createOfflineAttempt).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: /retomar gabarito/i }));
    expect(mockNavigate).toHaveBeenCalledWith(`/simulados/${sim.slug}/gabarito`);
  });

  it('ignores create result when auth changed before it resolved', async () => {
    let resolve!: (v: any) => void;
    vi.mocked(offlineApi.createOfflineAttempt).mockImplementation(() => new Promise(r => { resolve = r; }));
    const { rerender } = render(<OfflineModeSimpleDialog open onOpenChange={vi.fn()} sim={sim} />);
    fireEvent.click(screen.getByText('Experiência offline'));
    fireEvent.click(screen.getByRole('button', { name: /continuar e baixar/i }));
    userId = 'u2'; rerender(<OfflineModeSimpleDialog open onOpenChange={vi.fn()} sim={sim} />);
    resolve({ attempt_id: 'old' });
    await waitFor(() => expect(screen.getByText('Experiência offline')).toBeInTheDocument());
    expect(persistOfflineAttempt).not.toHaveBeenCalled();
    expect(offlineApi.getSignedPdfUrl).not.toHaveBeenCalled();
  });

  it('rejects unsuccessful HTTP downloads and keeps recovery without reading the error body as PDF', async () => {
    vi.mocked(offlineApi.createOfflineAttempt).mockResolvedValue({ attempt_id: 'a1', started_at: '2026-04-01T08:00:00Z', exam_duration_seconds: 18000, simulado_slug: sim.slug });
    vi.mocked(offlineApi.getSignedPdfUrl).mockResolvedValue('https://example.invalid/pdf');
    const blob = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 403, blob });
    vi.stubGlobal('fetch', fetchMock);
    render(<OfflineModeSimpleDialog open onOpenChange={vi.fn()} sim={sim} />);
    fireEvent.click(screen.getByText('Experiência offline'));
    fireEvent.click(screen.getByRole('button', { name: /continuar e baixar/i }));
    await screen.findByRole('button', { name: /tentar baixar PDF novamente/i });
    expect(blob).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith('https://example.invalid/pdf', { signal: expect.any(AbortSignal) });
    expect(screen.getByRole('button', { name: /retomar gabarito/i })).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('aborts download on unmount and never navigates a stale callback', async () => {
    vi.mocked(offlineApi.createOfflineAttempt).mockResolvedValue({ attempt_id: 'a1', started_at: '2026-04-01T08:00:00Z', exam_duration_seconds: 18000, simulado_slug: sim.slug });
    vi.mocked(offlineApi.getSignedPdfUrl).mockResolvedValue('https://example.invalid/pdf');
    const fetchMock = vi.fn(() => new Promise<Response>(() => {}));
    vi.stubGlobal('fetch', fetchMock);
    const { unmount } = render(<OfflineModeSimpleDialog open onOpenChange={vi.fn()} sim={sim} />);
    fireEvent.click(screen.getByText('Experiência offline'));
    fireEvent.click(screen.getByRole('button', { name: /continuar e baixar/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const signal = (fetchMock.mock.calls[0] as unknown as [string, { signal: AbortSignal }])[1].signal;
    unmount();
    expect(signal.aborted).toBe(true);
    expect(mockNavigate).not.toHaveBeenCalled();
  });
  it('cleans the temporary object URL after a successful download', async () => {
    vi.mocked(offlineApi.createOfflineAttempt).mockResolvedValue({ attempt_id: 'a1', started_at: '2026-04-01T08:00:00Z', exam_duration_seconds: 18000, simulado_slug: sim.slug });
    vi.mocked(offlineApi.getSignedPdfUrl).mockResolvedValue('https://example.invalid/pdf');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(['%PDF-test'], { type: 'application/pdf' }) }));
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:test'), revokeObjectURL });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const onOpenChange = vi.fn();
    render(<OfflineModeSimpleDialog open onOpenChange={onOpenChange} sim={sim} />);
    fireEvent.click(screen.getByText('Experiência offline'));
    fireEvent.click(screen.getByRole('button', { name: /continuar e baixar/i }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:test');
    expect(document.querySelector('a[download]')).toBeNull();
  });

  it("navigates to the exam route (/prova) when choosing 'Experiência online'", () => {
    render(
      <OfflineModeSimpleDialog open onOpenChange={vi.fn()} sim={sim} />
    );

    fireEvent.click(
      screen.getByText("Experiência online").closest("button")!
    );

    expect(mockNavigate).toHaveBeenCalledWith(`/simulados/${sim.slug}/prova`);
    // Must NOT bounce back to the pre-exam detail route, which loops the flow.
    expect(mockNavigate).not.toHaveBeenCalledWith(`/simulados/${sim.slug}/start`);
  });
});
