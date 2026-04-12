# Ranking Page Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the `/ranking` page with a wine hero card, two KPI cards (performance + nota de corte), a compact top-10 + neighbors table, and a cutoff score modal.

**Architecture:** New `useCutoffScore` hook queries `enamed_cutoff_scores` via React Query; `CutoffScoreModal` loads all rows; `RankingView` is fully rewritten — hero card, KPI cards, restructured table with `buildTableRows` utility, and sticky bar. Callers (`RankingPage`, `AdminRankingPreviewPage`) lose the `header` prop.

**Tech Stack:** React 18, TypeScript, TanStack React Query 5, Tailwind CSS 3.4, Supabase, Vitest 3 + Testing Library

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/services/rankingApi.ts` | Add `CutoffScoreRow` type, `fetchCutoffScore`, `fetchAllCutoffScores` |
| Modify | `src/services/rankingApi.test.ts` | Note: no pure-logic additions; async Supabase functions not unit-tested per project convention |
| Create | `src/hooks/useCutoffScore.ts` | React Query hook for single cutoff score lookup |
| Create | `src/hooks/useCutoffScore.test.ts` | Hook behavior tests with mocked `fetchCutoffScore` |
| Create | `src/components/ranking/CutoffScoreModal.tsx` | Modal listing all cutoff scores, user specialty highlighted |
| Create | `src/components/ranking/CutoffScoreModal.test.tsx` | Modal render + Esc-close tests |
| Modify | `src/components/ranking/RankingView.tsx` | Full UI rewrite — exports `buildTableRows` as named export |
| Create | `src/components/ranking/RankingView.test.tsx` | Tests for `buildTableRows` + component rendering conditions |
| Modify | `src/pages/RankingPage.tsx` | Remove `header` prop from `<RankingView>` call |
| Modify | `src/admin/pages/AdminRankingPreviewPage.tsx` | Add `<PageHeader>` before `<RankingView>`, remove `header` prop |

---

## Task 1: rankingApi — CutoffScoreRow type + fetch functions

**Files:**
- Modify: `src/services/rankingApi.ts`

- [ ] **Step 1: Add `CutoffScoreRow` interface and two async functions at the end of `rankingApi.ts`**

After the last line (`}`), append:

```typescript
// ─── Cutoff scores ────────────────────────────────────────────────────────────

export interface CutoffScoreRow {
  institution_name: string;
  practice_scenario: string;
  specialty_name: string;
  cutoff_score_general: number;
  cutoff_score_quota: number | null;
}

/**
 * Fetches the cutoff score for a specific specialty + institution combination.
 * Uses ilike for case-insensitive matching; institution uses %partial% match.
 * Returns null when no match found or on error.
 */
export async function fetchCutoffScore(
  specialty: string,
  institution: string,
): Promise<CutoffScoreRow | null> {
  logger.log('[rankingApi] Fetching cutoff score');
  const { data, error } = await supabase
    .from('enamed_cutoff_scores')
    .select(
      'institution_name, practice_scenario, specialty_name, cutoff_score_general, cutoff_score_quota',
    )
    .ilike('specialty_name', specialty.trim())
    .ilike('institution_name', `%${institution.trim()}%`)
    .maybeSingle();

  if (error) {
    logger.error('[rankingApi] Error fetching cutoff score:', error);
    return null;
  }
  return data as CutoffScoreRow | null;
}

/**
 * Fetches all cutoff score rows, ordered by institution then specialty.
 * Used by CutoffScoreModal to display the full table.
 */
export async function fetchAllCutoffScores(): Promise<CutoffScoreRow[]> {
  logger.log('[rankingApi] Fetching all cutoff scores');
  const { data, error } = await supabase
    .from('enamed_cutoff_scores')
    .select(
      'institution_name, practice_scenario, specialty_name, cutoff_score_general, cutoff_score_quota',
    )
    .order('institution_name')
    .order('specialty_name');

  if (error) {
    logger.error('[rankingApi] Error fetching all cutoff scores:', error);
    return [];
  }
  return (data || []) as CutoffScoreRow[];
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run build 2>&1 | head -30`
Expected: no new errors related to `enamed_cutoff_scores` types (the generated `types.ts` already has the table definition).

- [ ] **Step 3: Commit**

```bash
git add src/services/rankingApi.ts
git commit -m "feat(ranking): add CutoffScoreRow type and fetch functions to rankingApi"
```

---

## Task 2: useCutoffScore hook

**Files:**
- Create: `src/hooks/useCutoffScore.ts`
- Create: `src/hooks/useCutoffScore.test.ts`

- [ ] **Step 1: Write the failing tests first**

Create `src/hooks/useCutoffScore.test.ts`:

```typescript
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/services/rankingApi', () => ({
  fetchCutoffScore: vi.fn(),
}));

import { fetchCutoffScore } from '@/services/rankingApi';
import { useCutoffScore } from '@/hooks/useCutoffScore';

const mockFetch = vi.mocked(fetchCutoffScore);

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return React.createElement(QueryClientProvider, { client }, children);
}

const mockRow = {
  institution_name: 'UFBA',
  practice_scenario: 'Hospital das Clínicas',
  specialty_name: 'Pediatria',
  cutoff_score_general: 70,
  cutoff_score_quota: 60,
};

describe('useCutoffScore', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('returns loading=false and cutoff=null when specialty is empty — query disabled', () => {
    const { result } = renderHook(() => useCutoffScore('', 'UFBA'), { wrapper });
    expect(result.current.loading).toBe(false);
    expect(result.current.cutoff).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns loading=false and cutoff=null when institution is empty — query disabled', () => {
    const { result } = renderHook(() => useCutoffScore('Pediatria', ''), { wrapper });
    expect(result.current.loading).toBe(false);
    expect(result.current.cutoff).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns cutoff data when fetch resolves with a match', async () => {
    mockFetch.mockResolvedValue(mockRow);
    const { result } = renderHook(
      () => useCutoffScore('Pediatria', 'UFBA'),
      { wrapper },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.cutoff).toEqual(mockRow);
  });

  it('returns cutoff=null when fetch resolves with null (no match)', async () => {
    mockFetch.mockResolvedValue(null);
    const { result } = renderHook(
      () => useCutoffScore('Pediatria', 'UnknownHospital'),
      { wrapper },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.cutoff).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `npm run test -- src/hooks/useCutoffScore.test.ts 2>&1 | tail -20`
Expected: FAIL — "Cannot find module '@/hooks/useCutoffScore'"

- [ ] **Step 3: Create `src/hooks/useCutoffScore.ts`**

```typescript
import { useQuery } from '@tanstack/react-query';
import { fetchCutoffScore, type CutoffScoreRow } from '@/services/rankingApi';

export interface CutoffScoreResult {
  loading: boolean;
  cutoff: CutoffScoreRow | null;
}

/**
 * Queries enamed_cutoff_scores for a single specialty + institution combination.
 * staleTime: Infinity — cutoff scores are static reference data.
 * Query is disabled when either specialty or institution is empty.
 */
export function useCutoffScore(
  specialty: string,
  institution: string,
): CutoffScoreResult {
  const enabled = Boolean(specialty?.trim() && institution?.trim());

  const { isLoading, data } = useQuery({
    queryKey: [
      'cutoff-score',
      specialty?.trim().toLowerCase(),
      institution?.trim().toLowerCase(),
    ],
    queryFn: () => fetchCutoffScore(specialty, institution),
    staleTime: Infinity,
    enabled,
  });

  return {
    loading: enabled && isLoading,
    cutoff: data ?? null,
  };
}
```

- [ ] **Step 4: Run tests to confirm they pass**

Run: `npm run test -- src/hooks/useCutoffScore.test.ts 2>&1 | tail -20`
Expected: PASS — 4 tests passing

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useCutoffScore.ts src/hooks/useCutoffScore.test.ts
git commit -m "feat(ranking): add useCutoffScore hook with React Query"
```

---

## Task 3: CutoffScoreModal component

**Files:**
- Create: `src/components/ranking/CutoffScoreModal.tsx`
- Create: `src/components/ranking/CutoffScoreModal.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/components/ranking/CutoffScoreModal.test.tsx`:

```typescript
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CutoffScoreModal } from './CutoffScoreModal';

vi.mock('@/services/rankingApi', () => ({
  fetchAllCutoffScores: vi.fn().mockResolvedValue([
    {
      institution_name: 'UFBA',
      practice_scenario: 'HC',
      specialty_name: 'Pediatria',
      cutoff_score_general: 70,
      cutoff_score_quota: 60,
    },
    {
      institution_name: 'USP',
      practice_scenario: 'HCFMUSP',
      specialty_name: 'Cirurgia',
      cutoff_score_general: 80,
      cutoff_score_quota: null,
    },
  ]),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client }, children);
}

describe('CutoffScoreModal', () => {
  it('does not render when open=false', () => {
    render(
      React.createElement(wrapper, {}, React.createElement(CutoffScoreModal, { open: false, onClose: vi.fn() })),
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders dialog when open=true', async () => {
    render(
      React.createElement(wrapper, {},
        React.createElement(CutoffScoreModal, { open: true, onClose: vi.fn() }),
      ),
    );
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Notas de Corte ENAMED')).toBeTruthy();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(
      React.createElement(wrapper, {},
        React.createElement(CutoffScoreModal, { open: true, onClose }),
      ),
    );
    fireEvent.click(screen.getByLabelText('Fechar modal'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when Escape key is pressed', () => {
    const onClose = vi.fn();
    render(
      React.createElement(wrapper, {},
        React.createElement(CutoffScoreModal, { open: true, onClose }),
      ),
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `npm run test -- src/components/ranking/CutoffScoreModal.test.tsx 2>&1 | tail -20`
Expected: FAIL — "Cannot find module './CutoffScoreModal'"

- [ ] **Step 3: Create `src/components/ranking/CutoffScoreModal.tsx`**

```tsx
import React, { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { fetchAllCutoffScores } from '@/services/rankingApi';

interface CutoffScoreModalProps {
  open: boolean;
  onClose: () => void;
  userSpecialty?: string;
}

export function CutoffScoreModal({ open, onClose, userSpecialty }: CutoffScoreModalProps) {
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['all-cutoff-scores'],
    queryFn: fetchAllCutoffScores,
    staleTime: Infinity,
    enabled: open,
  });

  // Focus the close button on open
  useEffect(() => {
    if (open) closeBtnRef.current?.focus();
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const normalizedSpecialty = userSpecialty?.toLowerCase() ?? '';
  const userRows = normalizedSpecialty
    ? rows.filter((r) => r.specialty_name.toLowerCase() === normalizedSpecialty)
    : [];
  const otherRows = normalizedSpecialty
    ? rows.filter((r) => r.specialty_name.toLowerCase() !== normalizedSpecialty)
    : rows;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backdropFilter: 'blur(8px)', background: 'rgba(0,0,0,0.6)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Notas de Corte ENAMED"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-2xl max-h-[80vh] flex flex-col"
        style={{
          background: 'linear-gradient(145deg, #2a0e1a 0%, #1a0811 100%)',
          border: '1px solid rgba(255,150,170,0.12)',
          borderRadius: '20px',
          padding: '24px',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4 shrink-0">
          <h2 className="text-base font-bold text-white">Notas de Corte ENAMED</h2>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label="Fechar modal"
            className="h-8 w-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)' }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.12)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)';
            }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 -mx-1 px-1">
          {isLoading && (
            <p className="text-center py-8 text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Carregando...
            </p>
          )}
          {!isLoading && rows.length === 0 && (
            <p className="text-center py-8 text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Nenhuma nota de corte disponível.
            </p>
          )}
          {!isLoading && rows.length > 0 && (
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0" style={{ background: 'rgba(26,8,17,0.98)' }}>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <th
                    className="text-left py-2 px-3 font-bold uppercase tracking-widest"
                    style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)' }}
                  >
                    Instituição
                  </th>
                  <th
                    className="text-left py-2 px-3 font-bold uppercase tracking-widest"
                    style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)' }}
                  >
                    Especialidade
                  </th>
                  <th
                    className="text-right py-2 px-3 font-bold uppercase tracking-widest"
                    style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)' }}
                  >
                    Geral
                  </th>
                  <th
                    className="text-right py-2 px-3 font-bold uppercase tracking-widest"
                    style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)' }}
                  >
                    Cotas
                  </th>
                </tr>
              </thead>
              <tbody>
                {userRows.map((row, i) => (
                  <tr
                    key={`user-${i}`}
                    style={{
                      background: 'rgba(122,26,50,0.2)',
                      borderBottom: '1px solid rgba(255,150,170,0.08)',
                    }}
                  >
                    <td className="py-2.5 px-3" style={{ color: 'rgba(255,255,255,0.7)' }}>
                      {row.institution_name}
                    </td>
                    <td className="py-2.5 px-3 font-semibold" style={{ color: '#ffcbd8' }}>
                      {row.specialty_name}
                    </td>
                    <td className="py-2.5 px-3 text-right font-semibold text-white">
                      {row.cutoff_score_general}%
                    </td>
                    <td className="py-2.5 px-3 text-right" style={{ color: 'rgba(255,255,255,0.5)' }}>
                      {row.cutoff_score_quota != null ? `${row.cutoff_score_quota}%` : '—'}
                    </td>
                  </tr>
                ))}
                {otherRows.map((row, i) => (
                  <tr
                    key={`other-${i}`}
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                  >
                    <td className="py-2.5 px-3" style={{ color: 'rgba(255,255,255,0.5)' }}>
                      {row.institution_name}
                    </td>
                    <td className="py-2.5 px-3" style={{ color: 'rgba(255,255,255,0.5)' }}>
                      {row.specialty_name}
                    </td>
                    <td className="py-2.5 px-3 text-right" style={{ color: 'rgba(255,255,255,0.75)' }}>
                      {row.cutoff_score_general}%
                    </td>
                    <td className="py-2.5 px-3 text-right" style={{ color: 'rgba(255,255,255,0.35)' }}>
                      {row.cutoff_score_quota != null ? `${row.cutoff_score_quota}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to confirm they pass**

Run: `npm run test -- src/components/ranking/CutoffScoreModal.test.tsx 2>&1 | tail -20`
Expected: PASS — 4 tests passing

- [ ] **Step 5: Commit**

```bash
git add src/components/ranking/CutoffScoreModal.tsx src/components/ranking/CutoffScoreModal.test.tsx
git commit -m "feat(ranking): add CutoffScoreModal component"
```

---

## Task 4: RankingView — full UI rewrite

**Files:**
- Modify: `src/components/ranking/RankingView.tsx` (full replacement)
- Create: `src/components/ranking/RankingView.test.tsx`

- [ ] **Step 1: Write failing tests for `buildTableRows`**

Create `src/components/ranking/RankingView.test.tsx`:

```typescript
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { buildTableRows, RankingView } from './RankingView';
import type { RankingParticipant, RankingStats } from '@/services/rankingApi';
import { RANKING_COMPARISON_DEFAULT } from '@/services/rankingApi';

// ── Mocks ──────────────────────────────────────────────────────────────────────
vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }));
vi.mock('@/hooks/useCutoffScore', () => ({
  useCutoffScore: vi.fn(() => ({ loading: false, cutoff: null })),
}));
vi.mock('./CutoffScoreModal', () => ({
  CutoffScoreModal: () => null,
}));

// ── Helpers ────────────────────────────────────────────────────────────────────
function makeParticipant(
  position: number,
  isCurrentUser = false,
): RankingParticipant {
  return {
    position,
    userId: `user-${position}`,
    name: isCurrentUser ? 'Eu' : `Candidato ${position}`,
    score: 100 - position,
    specialty: 'Pediatria',
    institution: 'UFBA',
    segment: 'standard',
    isCurrentUser,
  };
}

const defaultStats: RankingStats = { totalCandidatos: 20, notaMedia: 60, notaCorte: 85 };

function renderView(overrides: Partial<Parameters<typeof RankingView>[0]> = {}) {
  const props = {
    loading: false,
    simuladosWithResults: [{ id: 's1', title: 'Simulado #1', sequence_number: 1 }],
    selectedSimuladoId: 's1',
    setSelectedSimuladoId: vi.fn(),
    filteredParticipants: Array.from({ length: 20 }, (_, i) => makeParticipant(i + 1)),
    currentUser: undefined as RankingParticipant | undefined,
    stats: defaultStats,
    rankingComparison: RANKING_COMPARISON_DEFAULT,
    setRankingComparison: vi.fn(),
    segmentFilter: 'all' as const,
    setSegmentFilter: vi.fn(),
    userSpecialty: '',
    userInstitutions: [],
    allowedSegments: ['all' as const],
    trackSource: 'page' as const,
    participantDisplay: 'public' as const,
    ...overrides,
  };
  return render(
    React.createElement(MemoryRouter, {}, React.createElement(RankingView, props)),
  );
}

// ── buildTableRows ─────────────────────────────────────────────────────────────
describe('buildTableRows', () => {
  it('returns all participants when no currentUser', () => {
    const participants = Array.from({ length: 15 }, (_, i) => makeParticipant(i + 1));
    const result = buildTableRows(participants, undefined);
    expect(result).toHaveLength(15);
  });

  it('returns all participants when currentUser is in top 10', () => {
    const participants = Array.from({ length: 20 }, (_, i) => makeParticipant(i + 1, i === 5));
    const result = buildTableRows(participants, participants[5]);
    expect(result).toHaveLength(20);
  });

  it('shows no separator when user is at position 11 (adjacent to top 10)', () => {
    const participants = Array.from({ length: 20 }, (_, i) => makeParticipant(i + 1, i === 10));
    const result = buildTableRows(participants, participants[10]);
    const separators = result.filter((r) => 'type' in r);
    expect(separators).toHaveLength(0);
    // top10 (10) + vicinity positions 11,12,13 (3) = 13
    expect(result).toHaveLength(13);
  });

  it('shows separator when user is at position 17 (gap = 4 > 3)', () => {
    const participants = Array.from({ length: 30 }, (_, i) => makeParticipant(i + 1, i === 16));
    const result = buildTableRows(participants, participants[16]);
    const separators = result.filter((r): r is { type: 'separator'; from: number; to: number } =>
      'type' in r && (r as any).type === 'separator',
    );
    expect(separators).toHaveLength(1);
    // separator from 11 to vicinityStart-1 = 15-1 = 14
    expect(separators[0]).toEqual({ type: 'separator', from: 11, to: 14 });
    // top10 (10) + separator (1) + vicinity positions 15,16,17,18,19 (5) = 16
    expect(result).toHaveLength(16);
  });

  it('shows no separator when user is at position 16 (gap = 3, not > 3)', () => {
    const participants = Array.from({ length: 25 }, (_, i) => makeParticipant(i + 1, i === 15));
    const result = buildTableRows(participants, participants[15]);
    const separators = result.filter((r) => 'type' in r);
    expect(separators).toHaveLength(0);
  });
});

// ── RankingView component ──────────────────────────────────────────────────────
describe('RankingView', () => {
  it('shows empty state when no participants and no currentUser', () => {
    renderView({ filteredParticipants: [], currentUser: undefined });
    expect(screen.getByText('Sem participantes')).toBeTruthy();
  });

  it('does not show hero card or KPI cards when currentUser is undefined', () => {
    renderView({ currentUser: undefined });
    expect(screen.queryByLabelText(/Sua posição/)).toBeNull();
  });

  it('shows hero card when currentUser exists', () => {
    const user = makeParticipant(5, true);
    const participants = Array.from({ length: 20 }, (_, i) =>
      makeParticipant(i + 1, i === 4),
    );
    renderView({ currentUser: user, filteredParticipants: participants });
    // Hero shows position label
    expect(screen.getByText('#5')).toBeTruthy();
  });

  it('shows low confidence banner when fewer than 30 participants', () => {
    renderView({ filteredParticipants: Array.from({ length: 15 }, (_, i) => makeParticipant(i + 1)) });
    expect(screen.getByText('Ranking com poucos participantes')).toBeTruthy();
  });

  it('does not show low confidence banner when 30 or more participants', () => {
    renderView({
      filteredParticipants: Array.from({ length: 30 }, (_, i) => makeParticipant(i + 1)),
    });
    expect(screen.queryByText('Ranking com poucos participantes')).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `npm run test -- src/components/ranking/RankingView.test.tsx 2>&1 | tail -30`
Expected: FAIL — imports fail or `buildTableRows` not exported

- [ ] **Step 3: Replace `src/components/ranking/RankingView.tsx` with the full new implementation**

Full file content:

```tsx
/**
 * Conteúdo compartilhado entre Ranking (aluno) e preview admin.
 */

import React, {
  useState,
  useEffect,
  useRef,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { Link } from 'react-router-dom';
import { EmptyState } from '@/components/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  Trophy,
  Filter,
  Users,
  Stethoscope,
  Building,
  Globe,
  Crown,
  AlertTriangle,
} from 'lucide-react';
import {
  type SegmentFilter,
  type RankingParticipant,
  type RankingStats,
  type RankingComparisonSelection,
  rankingComparisonAnalyticsLabel,
  RANKING_COMPARISON_DEFAULT,
} from '@/services/rankingApi';
import { useCutoffScore } from '@/hooks/useCutoffScore';
import { CutoffScoreModal } from './CutoffScoreModal';
import { trackEvent } from '@/lib/analytics';

// ─── Table row types ──────────────────────────────────────────────────────────

type SeparatorRow = { type: 'separator'; from: number; to: number };
type TableRow = RankingParticipant | SeparatorRow;

function isSeparator(row: TableRow): row is SeparatorRow {
  return 'type' in row && (row as SeparatorRow).type === 'separator';
}

// ─── buildTableRows ───────────────────────────────────────────────────────────

/**
 * Builds the display rows for the ranking table.
 *
 * - No currentUser → returns all participants.
 * - currentUser in top 10 → returns all participants (row highlighted inline).
 * - currentUser outside top 10 → top 10 + optional separator + vicinity (±2).
 *   Separator shown only when there are more than 3 positions between end of
 *   top 10 (position 10) and start of vicinity (position currentUser.position - 2).
 *   Separator text: "posições 11 – {vicinityStart - 1}".
 */
export function buildTableRows(
  filteredParticipants: RankingParticipant[],
  currentUser: RankingParticipant | undefined,
): TableRow[] {
  if (!currentUser || currentUser.position <= 10) {
    return filteredParticipants;
  }

  const userPos = currentUser.position;
  const top10 = filteredParticipants.filter((p) => p.position <= 10);
  const vicinityStart = Math.max(11, userPos - 2);
  const vicinity = filteredParticipants.filter(
    (p) => p.position >= vicinityStart && p.position <= userPos + 2,
  );

  const result: TableRow[] = [...top10];

  // Show separator only when there are more than 3 skipped positions
  // gap = vicinityStart - 11 (positions between top10 end and vicinity start)
  if (vicinityStart - 11 > 3) {
    result.push({ type: 'separator', from: 11, to: vicinityStart - 1 });
  }

  result.push(...vicinity);
  return result;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SEGMENT_OPTIONS: Array<{ key: SegmentFilter; label: string; icon: React.ElementType }> = [
  { key: 'all', label: 'Todos', icon: Globe },
  { key: 'sanarflix', label: 'Aluno SanarFlix padrão', icon: Users },
  { key: 'pro', label: 'Aluno PRO', icon: Crown },
];

// ─── PositionBadge ────────────────────────────────────────────────────────────

function PositionBadge({
  position,
  isCurrentUser,
}: {
  position: number;
  isCurrentUser?: boolean;
}) {
  if (isCurrentUser) {
    return (
      <div
        className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
        style={{ background: 'rgba(255,150,170,0.15)', color: '#ff9ab0' }}
        aria-label={`${position}ª posição (você)`}
      >
        {position}
      </div>
    );
  }
  const medals: Record<number, { bg: string; color: string; label: string }> = {
    1: { bg: 'rgba(251,191,36,0.15)', color: '#fbbf24', label: '1º lugar' },
    2: { bg: 'rgba(156,163,175,0.15)', color: '#9ca3af', label: '2º lugar' },
    3: { bg: 'rgba(180,83,9,0.15)', color: '#d97706', label: '3º lugar' },
  };
  const medal = medals[position];
  return (
    <div
      className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
      style={
        medal
          ? { background: medal.bg, color: medal.color }
          : { background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.45)' }
      }
      aria-label={medal?.label}
    >
      {position}
    </div>
  );
}

// ─── RankingSkeleton ──────────────────────────────────────────────────────────

function RankingSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-32 w-full rounded-[22px]" />
      <div className="grid grid-cols-2 gap-2.5">
        <Skeleton className="h-28 rounded-[18px]" />
        <Skeleton className="h-28 rounded-[18px]" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

// ─── RankingViewProps ─────────────────────────────────────────────────────────

export type RankingTrackSource = 'page' | 'admin_preview';

export interface RankingViewProps {
  loading: boolean;
  simuladosWithResults: Array<{ id: string; title: string; sequence_number: number }>;
  selectedSimuladoId: string | null;
  setSelectedSimuladoId: (id: string) => void;
  filteredParticipants: RankingParticipant[];
  currentUser: RankingParticipant | undefined;
  stats: RankingStats;
  rankingComparison: RankingComparisonSelection;
  setRankingComparison: Dispatch<SetStateAction<RankingComparisonSelection>>;
  segmentFilter: SegmentFilter;
  setSegmentFilter: (f: SegmentFilter) => void;
  userSpecialty: string;
  userInstitutions: string[];
  allowedSegments: SegmentFilter[];
  trackSource: RankingTrackSource;
  /** public: masks others as Candidato #n; admin: shows profile name when available */
  participantDisplay: 'public' | 'admin';
  toolbar?: React.ReactNode;
}

// ─── RankingView ──────────────────────────────────────────────────────────────

export function RankingView({
  loading,
  simuladosWithResults,
  selectedSimuladoId,
  setSelectedSimuladoId,
  filteredParticipants,
  currentUser,
  stats,
  rankingComparison,
  setRankingComparison,
  segmentFilter,
  setSegmentFilter,
  userSpecialty,
  userInstitutions,
  allowedSegments,
  trackSource,
  participantDisplay,
  toolbar,
}: RankingViewProps) {
  const mountedAtRef = useRef<number>(Date.now());
  const visibleSegmentOptions = SEGMENT_OPTIONS.filter((o) => allowedSegments.includes(o.key));
  const [cutoffModalOpen, setCutoffModalOpen] = useState(false);

  // Must be called unconditionally (Rules of Hooks)
  const { loading: cutoffLoading, cutoff } = useCutoffScore(
    userSpecialty,
    userInstitutions[0] || '',
  );

  // ── Filter handlers ───────────────────────────────────────────────────────

  const applyComparisonUpdate = (next: RankingComparisonSelection) => {
    const oldLabel = rankingComparisonAnalyticsLabel(rankingComparison);
    const newLabel = rankingComparisonAnalyticsLabel(next);
    if (oldLabel !== newLabel) {
      trackEvent('ranking_filter_changed', {
        simulado_id: selectedSimuladoId ?? '',
        filter_type: 'comparison',
        old_value: oldLabel,
        new_value: newLabel,
        source: trackSource,
      });
    }
    setRankingComparison(next);
  };

  const handleSelectAllComparison = () => applyComparisonUpdate(RANKING_COMPARISON_DEFAULT);

  const handleToggleSpecialtyComparison = () => {
    if (!userSpecialty) return;
    applyComparisonUpdate({ ...rankingComparison, bySpecialty: !rankingComparison.bySpecialty });
  };

  const handleToggleInstitutionComparison = () => {
    if (userInstitutions.length === 0) return;
    applyComparisonUpdate({ ...rankingComparison, byInstitution: !rankingComparison.byInstitution });
  };

  const handleSegmentFilterChange = (newValue: SegmentFilter) => {
    trackEvent('ranking_filter_changed', {
      simulado_id: selectedSimuladoId ?? '',
      filter_type: 'segment',
      old_value: segmentFilter,
      new_value: newValue,
      source: trackSource,
    });
    setSegmentFilter(newValue);
  };

  useEffect(() => {
    if (!allowedSegments.includes(segmentFilter)) setSegmentFilter('all');
  }, [allowedSegments, segmentFilter, setSegmentFilter]);

  useEffect(() => {
    trackEvent('ranking_viewed', {
      selected_simulado_id: selectedSimuladoId,
      comparison_filter: rankingComparisonAnalyticsLabel(rankingComparison),
      segment_filter: segmentFilter,
      source: trackSource,
    });
  }, [selectedSimuladoId, rankingComparison, segmentFilter, trackSource]);

  useEffect(() => {
    return () => {
      const seconds = Math.max(1, Math.round((Date.now() - mountedAtRef.current) / 1000));
      trackEvent('ranking_engagement_time', { seconds, source: trackSource });
    };
  }, [trackSource]);

  function participantLabel(item: RankingParticipant): string {
    if (participantDisplay === 'admin') return item.name || `Candidato #${item.position}`;
    return item.isCurrentUser ? item.name : `Candidato #${item.position}`;
  }

  // ── Derived values ────────────────────────────────────────────────────────

  const percentil = currentUser
    ? Math.round((currentUser.position / Math.max(1, filteredParticipants.length)) * 100)
    : 0;

  const perfState: 'good' | 'bad' = percentil <= 50 ? 'good' : 'bad';

  const perfMessage =
    percentil <= 25
      ? 'Entre os melhores 🏆'
      : percentil <= 50
        ? 'Acima da média 💪'
        : 'Em desenvolvimento 💪';

  const perfSubtext =
    perfState === 'good'
      ? `Você está no ${percentil}º percentil — acima de ${100 - percentil}% dos candidatos.`
      : `Você está abaixo de ${percentil}% dos candidatos — tudo bem, é aqui que começa a virada!`;

  const delta = currentUser ? currentUser.score - stats.notaMedia : 0;
  const deltaPrefix = delta >= 0 ? '▲' : '▼';
  const deltaColor = delta >= 0 ? 'rgba(74,222,128,0.7)' : 'rgba(248,113,113,0.7)';

  const hasProfile = Boolean(userSpecialty && userInstitutions[0]);
  const cutoffState: 'no_profile' | 'loading' | 'no_match' | 'pass' | 'fail' = !hasProfile
    ? 'no_profile'
    : cutoffLoading
      ? 'loading'
      : cutoff === null
        ? 'no_match'
        : currentUser && currentUser.score >= cutoff.cutoff_score_general
          ? 'pass'
          : 'fail';

  const lowConfidence = filteredParticipants.length > 0 && filteredParticipants.length < 30;
  const tableRows = buildTableRows(filteredParticipants, currentUser);

  // ── Shared inline styles ──────────────────────────────────────────────────

  const chipActive = {
    background: 'rgba(122,26,50,0.6)',
    border: '1px solid rgba(255,150,170,0.25)',
    color: 'white',
  } as React.CSSProperties;

  const chipInactive = {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.09)',
    color: 'rgba(255,255,255,0.5)',
  } as React.CSSProperties;

  return (
    <>
      {toolbar && <div className="mb-4">{toolbar}</div>}

      {loading && <RankingSkeleton />}

      {!loading && (
        <>
          {/* ── Simulado selector chips ────────────────────────────────────── */}
          {simuladosWithResults.length > 1 && (
            <div className="flex gap-2 mb-5 overflow-x-auto pb-2">
              {simuladosWithResults.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedSimuladoId(s.id)}
                  className="px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap shrink-0"
                  style={s.id === selectedSimuladoId ? chipActive : chipInactive}
                >
                  {s.title}
                </button>
              ))}
            </div>
          )}

          {/* ── Top section: hero + KPI (desktop 2-col, mobile stacked) ────── */}
          {currentUser && (
            <div className="md:grid md:grid-cols-2 md:gap-5 mb-5">
              {/* Hero card */}
              <div
                className="rounded-[22px] p-5 mb-4 md:mb-0 relative overflow-hidden"
                style={{
                  background:
                    'linear-gradient(155deg, #7a1a32 0%, #5c1225 45%, #3d0b18 100%)',
                  boxShadow:
                    '0 24px 56px -14px rgba(142,31,61,0.65), inset 0 1px 0 rgba(255,255,255,0.08)',
                }}
              >
                <div
                  className="absolute pointer-events-none"
                  style={{
                    top: '-50px',
                    right: '-50px',
                    width: '200px',
                    height: '200px',
                    background:
                      'radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%)',
                  }}
                  aria-hidden
                />
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="h-[46px] w-[46px] rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: 'rgba(255,255,255,0.12)' }}
                    >
                      <Trophy className="h-5 w-5 text-white" aria-hidden />
                    </div>
                    <div>
                      <p
                        className="text-xs font-semibold uppercase tracking-widest mb-0.5"
                        style={{ color: 'rgba(255,255,255,0.45)' }}
                      >
                        Sua posição
                      </p>
                      <p
                        className="font-bold text-white md:text-5xl text-3xl tabular-nums leading-none"
                        aria-label={`Posição ${currentUser.position} de ${filteredParticipants.length}`}
                      >
                        #{currentUser.position}
                        <span
                          className="text-base font-semibold ml-1"
                          style={{ color: 'rgba(255,255,255,0.45)' }}
                        >
                          de {filteredParticipants.length}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className="text-xs font-semibold uppercase tracking-widest mb-0.5"
                      style={{ color: 'rgba(255,255,255,0.45)' }}
                    >
                      Sua nota
                    </p>
                    <p
                      className="font-bold tabular-nums md:text-4xl text-2xl leading-none"
                      style={{ color: '#ffcbd8' }}
                      aria-label={`Nota ${currentUser.score}%`}
                    >
                      {currentUser.score}%
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
                      Média: {stats.notaMedia}%
                    </p>
                    <p
                      className="text-xs font-semibold mt-0.5"
                      style={{ color: deltaColor }}
                    >
                      {deltaPrefix} {Math.abs(delta)}pp {delta >= 0 ? 'acima' : 'abaixo'}
                    </p>
                  </div>
                </div>
              </div>

              {/* KPI cards */}
              <div className="grid grid-cols-2 gap-2.5">
                {/* Card 1: Desempenho */}
                <div
                  className="rounded-[18px] relative overflow-hidden flex flex-col justify-between"
                  style={{
                    padding: '15px 13px 13px',
                    minHeight: '110px',
                    background:
                      perfState === 'good'
                        ? 'linear-gradient(135deg, rgba(34,197,94,0.14) 0%, rgba(16,185,129,0.06) 100%)'
                        : 'linear-gradient(135deg, rgba(251,146,60,0.1) 0%, rgba(239,68,68,0.05) 100%)',
                    border:
                      perfState === 'good'
                        ? '1px solid rgba(34,197,94,0.25)'
                        : '1px solid rgba(251,146,60,0.2)',
                    boxShadow:
                      perfState === 'good'
                        ? '0 8px 24px -6px rgba(34,197,94,0.1), inset 0 1px 0 rgba(255,255,255,0.05)'
                        : '0 8px 24px -6px rgba(251,146,60,0.08), inset 0 1px 0 rgba(255,255,255,0.04)',
                  }}
                >
                  <div
                    className="absolute pointer-events-none"
                    style={{
                      top: '-30px',
                      right: '-30px',
                      width: '100px',
                      height: '100px',
                      borderRadius: '50%',
                      background:
                        perfState === 'good'
                          ? 'radial-gradient(circle, rgba(74,222,128,0.12) 0%, transparent 70%)'
                          : 'radial-gradient(circle, rgba(251,146,60,0.1) 0%, transparent 70%)',
                    }}
                    aria-hidden
                  />
                  <div className="relative z-10">
                    <p
                      className="font-bold uppercase mb-[7px]"
                      style={{
                        fontSize: '0.56rem',
                        letterSpacing: '.09em',
                        color:
                          perfState === 'good'
                            ? 'rgba(74,222,128,0.7)'
                            : 'rgba(251,146,60,0.7)',
                      }}
                    >
                      Seu desempenho
                    </p>
                    <p
                      className="font-bold leading-snug mb-[5px]"
                      style={{
                        fontSize: '0.95rem',
                        color: perfState === 'good' ? '#4ade80' : '#fb923c',
                      }}
                    >
                      {perfMessage}
                    </p>
                    <p
                      className="leading-snug"
                      style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.4)' }}
                    >
                      {perfSubtext}
                    </p>
                  </div>
                </div>

                {/* Card 2: Nota de Corte */}
                {(cutoffState === 'no_profile' || cutoffState === 'no_match') && (
                  <div
                    className="rounded-[18px] relative overflow-hidden flex flex-col"
                    style={{
                      padding: '15px 13px 13px',
                      minHeight: '110px',
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.09)',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
                    }}
                  >
                    <p
                      className="font-bold uppercase mb-[7px] relative z-10"
                      style={{
                        fontSize: '0.56rem',
                        letterSpacing: '.09em',
                        color: 'rgba(255,255,255,0.3)',
                      }}
                    >
                      Nota de corte
                    </p>
                    <div className="relative z-10 flex flex-col gap-[5px] flex-1 justify-center">
                      <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>🎯</span>
                      {cutoffState === 'no_profile' ? (
                        <>
                          <p
                            className="leading-snug"
                            style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.3)' }}
                          >
                            Preencha sua especialidade e instituição para ver se você passaria.
                          </p>
                          <Link
                            to="/configuracoes"
                            className="font-semibold inline-flex items-center gap-[3px]"
                            style={{ fontSize: '0.6rem', color: 'rgba(255,150,170,0.65)' }}
                          >
                            Completar perfil →
                          </Link>
                        </>
                      ) : (
                        <>
                          <p
                            className="leading-snug"
                            style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.3)' }}
                          >
                            Não encontramos nota de corte para sua combinação.
                          </p>
                          <button
                            type="button"
                            onClick={() => setCutoffModalOpen(true)}
                            className="font-semibold inline-flex items-center gap-[3px] text-left"
                            style={{ fontSize: '0.6rem', color: 'rgba(255,150,170,0.65)' }}
                          >
                            Ver todas →
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {cutoffState === 'loading' && (
                  <div
                    className="rounded-[18px] flex items-center justify-center"
                    style={{
                      padding: '15px 13px 13px',
                      minHeight: '110px',
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.09)',
                    }}
                  >
                    <p style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.3)' }}>
                      Carregando...
                    </p>
                  </div>
                )}

                {cutoffState === 'pass' && cutoff && (
                  <div
                    className="rounded-[18px] relative overflow-hidden flex flex-col justify-between"
                    style={{
                      padding: '15px 13px 13px',
                      minHeight: '110px',
                      background:
                        'linear-gradient(135deg, rgba(99,179,237,0.12) 0%, rgba(139,92,246,0.06) 100%)',
                      border: '1px solid rgba(99,179,237,0.22)',
                      boxShadow:
                        '0 8px 24px -6px rgba(99,179,237,0.1), inset 0 1px 0 rgba(255,255,255,0.05)',
                    }}
                  >
                    <div
                      className="absolute pointer-events-none"
                      style={{
                        top: '-30px',
                        right: '-30px',
                        width: '100px',
                        height: '100px',
                        borderRadius: '50%',
                        background:
                          'radial-gradient(circle, rgba(125,211,252,0.1) 0%, transparent 70%)',
                      }}
                      aria-hidden
                    />
                    <div className="relative z-10">
                      <p
                        className="font-bold uppercase mb-[7px]"
                        style={{
                          fontSize: '0.56rem',
                          letterSpacing: '.09em',
                          color: 'rgba(125,211,252,0.7)',
                        }}
                      >
                        Nota de corte
                      </p>
                      <p
                        className="font-bold leading-snug mb-[5px]"
                        style={{ fontSize: '0.95rem', color: '#7dd3fc' }}
                      >
                        Passaria ✓
                      </p>
                      <p
                        className="leading-snug"
                        style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.4)' }}
                      >
                        Corte geral:{' '}
                        <strong style={{ color: 'rgba(255,255,255,0.65)' }}>
                          {cutoff.cutoff_score_general}%
                        </strong>
                        {cutoff.cutoff_score_quota != null && (
                          <>
                            {' '}
                            · Cotas:{' '}
                            <strong style={{ color: 'rgba(255,255,255,0.65)' }}>
                              {cutoff.cutoff_score_quota}%
                            </strong>
                          </>
                        )}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCutoffModalOpen(true)}
                      className="relative z-10 inline-flex items-center gap-[3px] mt-[7px]"
                      style={{ fontSize: '0.58rem', color: 'rgba(125,211,252,0.6)' }}
                    >
                      Ver todas as notas ↗
                    </button>
                  </div>
                )}

                {cutoffState === 'fail' && cutoff && currentUser && (
                  <div
                    className="rounded-[18px] relative overflow-hidden flex flex-col justify-between"
                    style={{
                      padding: '15px 13px 13px',
                      minHeight: '110px',
                      background:
                        'linear-gradient(135deg, rgba(239,68,68,0.10) 0%, rgba(220,38,38,0.05) 100%)',
                      border: '1px solid rgba(239,68,68,0.20)',
                      boxShadow:
                        '0 8px 24px -6px rgba(239,68,68,0.08), inset 0 1px 0 rgba(255,255,255,0.04)',
                    }}
                  >
                    <div
                      className="absolute pointer-events-none"
                      style={{
                        top: '-30px',
                        right: '-30px',
                        width: '100px',
                        height: '100px',
                        borderRadius: '50%',
                        background:
                          'radial-gradient(circle, rgba(248,113,113,0.1) 0%, transparent 70%)',
                      }}
                      aria-hidden
                    />
                    <div className="relative z-10">
                      <p
                        className="font-bold uppercase mb-[7px]"
                        style={{
                          fontSize: '0.56rem',
                          letterSpacing: '.09em',
                          color: 'rgba(248,113,113,0.7)',
                        }}
                      >
                        Nota de corte
                      </p>
                      <p
                        className="font-bold leading-snug mb-[5px]"
                        style={{ fontSize: '0.95rem', color: '#f87171' }}
                      >
                        Ainda não ✗
                      </p>
                      <p
                        className="leading-snug"
                        style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.4)' }}
                      >
                        Faltam{' '}
                        <strong style={{ color: '#f87171' }}>
                          {cutoff.cutoff_score_general - currentUser.score}pp
                        </strong>{' '}
                        para o corte geral de{' '}
                        <strong style={{ color: 'rgba(255,255,255,0.65)' }}>
                          {cutoff.cutoff_score_general}%
                        </strong>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCutoffModalOpen(true)}
                      className="relative z-10 inline-flex items-center gap-[3px] mt-[7px]"
                      style={{ fontSize: '0.58rem', color: 'rgba(248,113,113,0.6)' }}
                    >
                      Ver todas as notas ↗
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Low confidence banner ─────────────────────────────────────── */}
          {lowConfidence && (
            <div
              className="flex items-start gap-3 mb-4 rounded-[13px]"
              style={{
                padding: '11px 13px',
                background: 'rgba(251,146,60,0.07)',
                border: '1px solid rgba(251,146,60,0.22)',
              }}
            >
              <AlertTriangle
                className="h-4 w-4 mt-0.5 shrink-0"
                style={{ color: '#fb923c' }}
                aria-hidden
              />
              <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>
                <strong className="text-white">Ranking com poucos participantes</strong> — com menos
                de 30 candidatos, os resultados podem não refletir o desempenho real.{' '}
                <button
                  type="button"
                  onClick={() => setCutoffModalOpen(true)}
                  className="underline underline-offset-2 transition-colors hover:text-white"
                  style={{ color: '#fb923c' }}
                >
                  Consulte a nota de corte oficial →
                </button>
              </p>
            </div>
          )}

          {/* ── Empty state ───────────────────────────────────────────────── */}
          {filteredParticipants.length === 0 && !currentUser && (
            <EmptyState
              icon={Users}
              title="Sem participantes"
              description="Ainda não há participantes suficientes para exibir o ranking deste simulado."
            />
          )}

          {filteredParticipants.length > 0 && (
            <>
              {/* ── Filter bar ────────────────────────────────────────────── */}
              <div
                className="p-4 mb-4 rounded-[15px]"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.07)',
                }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <Filter
                    className="h-4 w-4"
                    style={{ color: 'rgba(255,255,255,0.3)' }}
                    aria-hidden
                  />
                  <span className="text-sm font-semibold text-white">Filtrar ranking</span>
                </div>

                <div className="flex flex-wrap gap-3">
                  <div className="min-w-0 flex-1 basis-[min(100%,20rem)]">
                    <p
                      className="text-xs mb-1.5"
                      style={{ color: 'rgba(255,255,255,0.3)' }}
                    >
                      Comparar com
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={handleSelectAllComparison}
                        aria-pressed={
                          !rankingComparison.bySpecialty && !rankingComparison.byInstitution
                        }
                        aria-label="Todos os candidatos"
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all"
                        style={
                          !rankingComparison.bySpecialty && !rankingComparison.byInstitution
                            ? chipActive
                            : chipInactive
                        }
                      >
                        <Users className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        <span className="hidden sm:inline">Todos</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleToggleSpecialtyComparison}
                        disabled={!userSpecialty}
                        aria-pressed={rankingComparison.bySpecialty}
                        aria-label={
                          userSpecialty
                            ? `Filtrar por especialidade: ${userSpecialty}`
                            : 'Especialidade não configurada'
                        }
                        className={cn(
                          'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all',
                          !userSpecialty && 'cursor-not-allowed opacity-40',
                        )}
                        style={rankingComparison.bySpecialty ? chipActive : chipInactive}
                        title={!userSpecialty ? 'Configure nas Configurações' : undefined}
                      >
                        <Stethoscope className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        <span className="hidden sm:inline">{userSpecialty || 'Especialidade'}</span>
                      </button>
                    </div>

                    {userInstitutions.length > 0 && (
                      <div
                        className="mt-2 flex flex-col gap-1.5 pt-2.5"
                        style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
                      >
                        <span
                          className="text-xs leading-snug"
                          style={{ color: 'rgba(255,255,255,0.3)' }}
                        >
                          Também filtrar pela minha 1ª instituição-alvo (opcional)
                        </span>
                        <button
                          type="button"
                          onClick={handleToggleInstitutionComparison}
                          aria-pressed={rankingComparison.byInstitution}
                          aria-label={`Filtrar também por instituição: ${userInstitutions[0]}`}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all w-fit max-w-full"
                          style={rankingComparison.byInstitution ? chipActive : chipInactive}
                        >
                          <Building className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          <span className="hidden sm:inline truncate">{userInstitutions[0]}</span>
                        </button>
                      </div>
                    )}
                  </div>

                  <div>
                    <p
                      className="text-xs mb-1.5"
                      style={{ color: 'rgba(255,255,255,0.3)' }}
                    >
                      Segmento
                    </p>
                    <div className="flex gap-1.5">
                      {visibleSegmentOptions.map((f) => (
                        <button
                          key={f.key}
                          type="button"
                          onClick={() => handleSegmentFilterChange(f.key)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all"
                          style={
                            segmentFilter === f.key
                              ? chipActive
                              : {
                                  ...chipInactive,
                                  color:
                                    f.key === 'pro'
                                      ? '#c4b5fd'
                                      : 'rgba(255,255,255,0.5)',
                                }
                          }
                        >
                          <f.icon className="h-3.5 w-3.5" aria-hidden />
                          <span className="hidden sm:inline">{f.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {(rankingComparison.bySpecialty || rankingComparison.byInstitution) && (
                  <p
                    className="text-xs mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1"
                    style={{ color: 'rgba(255,255,255,0.35)' }}
                  >
                    {rankingComparison.bySpecialty &&
                      userSpecialty &&
                      rankingComparison.byInstitution &&
                      userInstitutions[0] && (
                        <>
                          <Stethoscope className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          <span>
                            Filtrando por{' '}
                            <strong className="text-white">{userSpecialty}</strong> na{' '}
                            <strong className="text-white">{userInstitutions[0]}</strong>.
                          </span>
                        </>
                      )}
                    {rankingComparison.bySpecialty &&
                      userSpecialty &&
                      !rankingComparison.byInstitution && (
                        <>
                          <Stethoscope className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          <span>
                            Filtrando por especialidade:{' '}
                            <strong className="text-white">{userSpecialty}</strong>
                            <span style={{ color: 'rgba(255,255,255,0.3)' }}>
                              {' '}
                              (todas as instituições).
                            </span>
                          </span>
                        </>
                      )}
                    {!rankingComparison.bySpecialty &&
                      rankingComparison.byInstitution &&
                      userInstitutions[0] && (
                        <>
                          <Building className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          <span>
                            Filtrando por instituição:{' '}
                            <strong className="text-white">{userInstitutions[0]}</strong>
                            <span style={{ color: 'rgba(255,255,255,0.3)' }}>
                              {' '}
                              (todas as especialidades).
                            </span>
                          </span>
                        </>
                      )}
                    {rankingComparison.bySpecialty && !userSpecialty && (
                      <span>
                        Configure sua especialidade nas Configurações para usar este filtro.
                      </span>
                    )}
                  </p>
                )}
              </div>

              {/* ── Table ─────────────────────────────────────────────────── */}
              <div
                className="relative overflow-hidden"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: '15px',
                }}
              >
                {/* Column header */}
                <div
                  className="px-4 py-3"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
                >
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th className="text-left w-10" style={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)' }}>#</th>
                        <th className="text-left" style={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)' }}>Candidato</th>
                        <th className="text-left hidden md:table-cell" style={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)' }}>Especialidade</th>
                        <th className="text-left hidden md:table-cell" style={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)' }}>Instituição</th>
                        <th className="text-right" style={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)' }}>Nota</th>
                      </tr>
                    </thead>
                  </table>
                </div>

                {/* Rows */}
                {tableRows.map((row, i) => {
                  if (isSeparator(row)) {
                    return (
                      <div
                        key={`sep-${i}`}
                        className="px-4 py-2 text-center"
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                      >
                        <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.2)' }}>
                          posições {row.from} – {row.to}
                        </span>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={`${row.userId}-${row.position}`}
                      className="transition-colors"
                      style={{
                        background: row.isCurrentUser ? 'rgba(122,26,50,0.28)' : undefined,
                        borderBottom:
                          i < tableRows.length - 1
                            ? '1px solid rgba(255,255,255,0.05)'
                            : undefined,
                      }}
                    >
                      <table className="w-full px-4">
                        <tbody>
                          <tr>
                            <td className="w-10 pl-4 py-3">
                              <PositionBadge
                                position={row.position}
                                isCurrentUser={row.isCurrentUser}
                              />
                            </td>
                            <td className="pr-2 py-3">
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className="text-sm truncate"
                                  style={{
                                    color: row.isCurrentUser ? '#fff' : 'rgba(255,255,255,0.7)',
                                    fontWeight: row.isCurrentUser ? 600 : 400,
                                  }}
                                >
                                  {participantLabel(row)}
                                </span>
                                {row.isCurrentUser && (
                                  <span
                                    className="text-[0.56rem] font-bold px-1.5 py-0.5 rounded shrink-0"
                                    style={{
                                      background: 'rgba(122,26,50,0.6)',
                                      color: '#ff9ab0',
                                      border: '1px solid rgba(255,150,170,0.2)',
                                    }}
                                  >
                                    Você
                                  </span>
                                )}
                              </div>
                            </td>
                            <td
                              className="pr-2 py-3 hidden md:table-cell"
                              style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.45)' }}
                            >
                              {row.specialty}
                            </td>
                            <td
                              className="pr-2 py-3 hidden md:table-cell"
                              style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.45)' }}
                            >
                              {row.institution}
                            </td>
                            <td className="pr-4 py-3 text-right">
                              <span
                                className="text-sm font-semibold tabular-nums"
                                style={{
                                  color: row.isCurrentUser ? '#ffcbd8' : 'rgba(255,255,255,0.7)',
                                }}
                              >
                                {row.score}%
                              </span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  );
                })}

                {/* Sticky bar */}
                {currentUser && (
                  <div
                    className="sticky bottom-0 flex items-center justify-between px-4 py-2.5"
                    style={{
                      background:
                        'linear-gradient(135deg, rgba(122,26,50,0.72), rgba(60,12,24,0.82))',
                      borderTop: '1px solid rgba(255,150,170,0.14)',
                    }}
                    aria-hidden
                  >
                    <span className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
                      Sua posição
                    </span>
                    <span className="text-sm font-bold text-white">
                      #{currentUser.position} de {filteredParticipants.length}
                    </span>
                    <span
                      className="text-sm font-semibold"
                      style={{ color: '#ffcbd8' }}
                    >
                      {currentUser.score}%
                    </span>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* ── CutoffScoreModal ───────────────────────────────────────────────── */}
      <CutoffScoreModal
        open={cutoffModalOpen}
        onClose={() => setCutoffModalOpen(false)}
        userSpecialty={userSpecialty}
      />
    </>
  );
}

/** Re-export para uso em páginas que só precisam do skeleton */
export { RankingSkeleton };
```

- [ ] **Step 4: Run tests**

Run: `npm run test -- src/components/ranking/RankingView.test.tsx 2>&1 | tail -30`
Expected: PASS — all tests passing

- [ ] **Step 5: Run full test suite to catch regressions**

Run: `npm run test 2>&1 | tail -30`
Expected: all tests passing (no new failures)

- [ ] **Step 6: Commit**

```bash
git add src/components/ranking/RankingView.tsx src/components/ranking/RankingView.test.tsx
git commit -m "feat(ranking): rewrite RankingView with wine hero, KPI cards, and structured table"
```

---

## Task 5: Update callers — remove `header` prop

**Files:**
- Modify: `src/pages/RankingPage.tsx`
- Modify: `src/admin/pages/AdminRankingPreviewPage.tsx`

- [ ] **Step 1: Update `RankingPage.tsx` — remove `header` prop**

Replace the `<RankingView ... header={{...}} ...>` call. The `header` prop no longer exists on `RankingViewProps`. The empty-state `PageHeader` at the top of the file stays.

The full updated file:

```tsx
/**
 * RankingPage — real Supabase ranking data.
 * Uses useRanking hook backed by get_ranking_for_simulado() security definer function.
 */

import React, { useMemo } from 'react';
import { PageTransition } from '@/components/premium/PageTransition';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { useRanking } from '@/hooks/useRanking';
import { Trophy } from 'lucide-react';
import { getAllowedRankingSegmentFilters } from '@/services/rankingApi';
import { useUser } from '@/contexts/UserContext';
import { RankingView } from '@/components/ranking/RankingView';

export default function RankingPage() {
  const {
    loading,
    simuladosWithResults,
    selectedSimuladoId,
    setSelectedSimuladoId,
    filteredParticipants,
    currentUser,
    stats,
    rankingComparison,
    setRankingComparison,
    segmentFilter,
    setSegmentFilter,
    userSpecialty,
    userInstitutions,
  } = useRanking();

  const { profile } = useUser();
  const segment = profile?.segment ?? 'guest';
  const allowedSegments = useMemo(() => getAllowedRankingSegmentFilters(segment), [segment]);

  if (!loading && simuladosWithResults.length === 0) {
    return (
      <>
        <PageHeader
          title="Ranking ENAMED"
          subtitle="Compare seu desempenho com milhares de candidatos."
          badge="Ranking Geral"
        />
        <EmptyState
          icon={Trophy}
          title="Ranking indisponível"
          description="Complete um simulado e aguarde a liberação do resultado para acessar o ranking."
        />
      </>
    );
  }

  return (
    <PageTransition>
      <RankingView
        loading={loading}
        simuladosWithResults={simuladosWithResults}
        selectedSimuladoId={selectedSimuladoId}
        setSelectedSimuladoId={setSelectedSimuladoId}
        filteredParticipants={filteredParticipants}
        currentUser={currentUser}
        stats={stats}
        rankingComparison={rankingComparison}
        setRankingComparison={setRankingComparison}
        segmentFilter={segmentFilter}
        setSegmentFilter={setSegmentFilter}
        userSpecialty={userSpecialty}
        userInstitutions={userInstitutions}
        allowedSegments={allowedSegments}
        trackSource="page"
        participantDisplay="public"
      />
    </PageTransition>
  );
}
```

- [ ] **Step 2: Update `AdminRankingPreviewPage.tsx` — add `PageHeader`, remove `header` prop**

Full updated file:

```tsx
import { useMemo } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { EmptyState } from '@/components/EmptyState'
import { RankingView } from '@/components/ranking/RankingView'
import { useRankingAdminPreview } from '@/hooks/useRankingAdminPreview'
import { getAllowedRankingSegmentFilters } from '@/services/rankingApi'
import { useUser } from '@/contexts/UserContext'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Trophy } from 'lucide-react'

export default function AdminRankingPreviewPage() {
  const {
    loading,
    simuladosWithResults,
    selectedSimuladoId,
    setSelectedSimuladoId,
    filteredParticipants,
    currentUser,
    stats,
    rankingComparison,
    setRankingComparison,
    segmentFilter,
    setSegmentFilter,
    userSpecialty,
    userInstitutions,
    includeTrain,
    setIncludeTrain,
  } = useRankingAdminPreview()

  const { profile } = useUser()
  const segment = profile?.segment ?? 'guest'
  const allowedSegments = useMemo(() => getAllowedRankingSegmentFilters(segment), [segment])

  if (!loading && simuladosWithResults.length === 0) {
    return (
      <>
        <PageHeader
          title="Preview do ranking"
          subtitle="Lista completa para validação de UI (somente administradores)."
          badge="Admin"
        />
        <EmptyState
          icon={Trophy}
          title="Nenhum simulado com tentativas finalizadas"
          description="Quando houver provas concluídas no projeto, elas aparecerão aqui para preview."
        />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Preview do ranking"
        subtitle="Mesma experiência do ranking público, sem depender da liberação de resultados."
        badge="Admin"
      />
      <RankingView
        loading={loading}
        simuladosWithResults={simuladosWithResults}
        selectedSimuladoId={selectedSimuladoId}
        setSelectedSimuladoId={setSelectedSimuladoId}
        filteredParticipants={filteredParticipants}
        currentUser={currentUser}
        stats={stats}
        rankingComparison={rankingComparison}
        setRankingComparison={setRankingComparison}
        segmentFilter={segmentFilter}
        setSegmentFilter={setSegmentFilter}
        userSpecialty={userSpecialty}
        userInstitutions={userInstitutions}
        allowedSegments={allowedSegments}
        trackSource="admin_preview"
        participantDisplay="admin"
        toolbar={
          <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-caption text-muted-foreground max-w-xl">
              Incluir tentativas fora da janela oficial (treino) recalcula posições e pode divergir do
              ranking público.
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <Switch
                id="admin-ranking-include-train"
                checked={includeTrain}
                onCheckedChange={(v) => setIncludeTrain(v)}
              />
              <Label htmlFor="admin-ranking-include-train" className="text-body-sm cursor-pointer">
                Incluir treino (fora da janela)
              </Label>
            </div>
          </div>
        }
      />
    </>
  )
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build 2>&1 | head -40`
Expected: clean build, no TypeScript errors about missing `header` prop or unknown props

- [ ] **Step 4: Run full test suite**

Run: `npm run test 2>&1 | tail -20`
Expected: all tests passing

- [ ] **Step 5: Commit**

```bash
git add src/pages/RankingPage.tsx src/admin/pages/AdminRankingPreviewPage.tsx
git commit -m "feat(ranking): update callers — remove header prop, add PageHeader to admin page"
```
