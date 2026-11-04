import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { CadernoExportEntry } from '@/lib/cadernoExport';
vi.mock('@/services/notebookApi', () => ({ notebookApi: { getForExport: vi.fn() } }));
vi.mock('@/services/simuladosApi', () => ({ simuladosApi: { getErrorNotebookForExport: vi.fn() } }));
vi.mock('@/lib/cadernoExport', () => ({ exportNotebookPdf: vi.fn() }));
import { CadernoExportMenu } from '@/components/caderno/CadernoExportMenu';
import { notebookApi } from '@/services/notebookApi';
import { simuladosApi } from '@/services/simuladosApi';
import { exportNotebookPdf } from '@/lib/cadernoExport';
const entry: CadernoExportEntry = { id: 'demo', area: null, theme: 'Demo', question_number: null, question_text: null, reason: 'did_not_know', learning_text: null, simulado_title: null, ai_review_md: null, created_at: '2026-01-01', options: [], correct_label: null, explanation: null };
describe('filtered export boundary', () => {
  beforeEach(() => { cleanup(); vi.resetAllMocks(); });
  it('exports all returned entries once with edition and filters, not just the visible 50', async () => {
    vi.mocked(notebookApi.getForExport).mockResolvedValue(Array.from({ length: 1500 }, (_, i) => ({ ...entry, id: String(i), edition_id: 'edition-b', edition_code: 'B', edition_label: 'Demo B' })));
    render(<CadernoExportMenu userId="owner" editionsEnabled editionLabel="Demo B" notebookFilters={{ editionId: 'edition-b', search: 'cardio', state: 'pending' }} />);
    const button = screen.getByRole('button'); fireEvent.click(button); fireEvent.click(button);
    await waitFor(() => expect(exportNotebookPdf).toHaveBeenCalledOnce());
    expect(vi.mocked(exportNotebookPdf).mock.calls[0][0]).toHaveLength(1500);
    expect(notebookApi.getForExport).toHaveBeenCalledOnce();
    expect(vi.mocked(exportNotebookPdf).mock.calls[0][1]).toContain('Demo B');
  });
  it('keeps the old API when the flag is false', async () => {
    vi.mocked(simuladosApi.getErrorNotebookForExport).mockResolvedValue([entry]);
    render(<CadernoExportMenu userId="owner" />); fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(exportNotebookPdf).toHaveBeenCalledWith([entry], undefined));
    expect(notebookApi.getForExport).not.toHaveBeenCalled();
  });
  it('does not download stale export after changing scope or owner', async () => {
    let finish!: (rows: Awaited<ReturnType<typeof notebookApi.getForExport>>) => void;
    vi.mocked(notebookApi.getForExport).mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const view = render(<CadernoExportMenu userId="owner" editionsEnabled notebookFilters={{ editionId: 'edition-a' }} />);
    fireEvent.click(screen.getByRole('button'));
    view.rerender(<CadernoExportMenu userId="other" editionsEnabled notebookFilters={{ editionId: 'edition-b' }} />);
    await act(async () => finish([{ ...entry, edition_id: 'edition-a', edition_code: 'A', edition_label: 'Demo A' }]));
    expect(exportNotebookPdf).not.toHaveBeenCalled();
  });
});
