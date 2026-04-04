# Offline Exam Mode — Design Spec

## Overview

Students can download a beautifully designed PDF of the exam, print it, take it on paper, then return to fill in a digital answer sheet to see their performance and enter the ranking.

**Goal:** Best-in-class offline exam experience — impactful PDF, ultra-functional answer sheet, zero ranking advantage over online students, server-enforced timing rules.

---

## User Flow

```
SimuladosPage → "Modo Offline" button
    → create_offline_attempt_guarded RPC (server records started_at)
    → download signed PDF URL → browser downloads file
    → FloatingOfflineTimer appears (persists across all pages)
    → student prints, takes exam on paper
    → returns to platform → /simulados/:slug/gabarito
    → fills answer sheet (A/B/C/D bubbles, 2-col, auto-advance)
    → submit_offline_answers_guarded RPC (server validates timing)
    → ResultadoPage (with or without ranking per rules)
```

---

## Ranking Rules

A student's offline attempt enters the ranking **only if both conditions are met server-side:**

1. **Started within the execution window** — `created_at` of the attempt falls inside `simulado.start_at … simulado.end_at`
2. **Submitted within exam duration** — `offline_answers_submitted_at - created_at ≤ exam_duration_seconds`

If either condition fails: student sees their result and performance breakdown, but `is_within_window = false` → not ranked.

Starting outside the execution window = never ranked, regardless of submission timing.

---

## Timer Rules

- Timer starts at download time (= `attempt.created_at`, set server-side)
- `FloatingOfflineTimer` displays remaining time: `exam_duration_seconds - elapsed`
- Timer persists across all page navigations (rendered at root layout level)
- When timer reaches zero: auto-navigate to `/simulados/:slug/gabarito`
- If student had the platform closed when timer expired: email notification via Novu ("Seu tempo acabou — preencha o gabarito agora")

---

## Database Changes

### `attempts` table — new columns

| Column | Type | Description |
|--------|------|-------------|
| `attempt_type` | `text` | `'online'` \| `'offline'` — default `'online'` |
| `offline_answers_submitted_at` | `timestamptz` | When the answer sheet was submitted (set server-side) |

`status` gains new value: `'offline_pending'` (downloaded, not yet submitted).

Existing `is_within_window` and `created_at` columns are reused as-is.

### New RPCs (SECURITY DEFINER)

**`create_offline_attempt_guarded(simulado_id uuid)`**
- Creates attempt: `attempt_type='offline'`, `status='offline_pending'`
- `created_at` = `now()` (server clock — client cannot influence)
- `exam_duration_seconds` derived from `simulados.duration_hours * 3600`
- Returns: `{ attempt_id, started_at, exam_duration_seconds, simulado_slug }`
- Prevents duplicate: if a `offline_pending` attempt already exists for this user+simulado, returns existing one

**`submit_offline_answers_guarded(attempt_id uuid, answers jsonb)`**
- `answers` format: `[{ question_id, selected_option_id }, ...]`
- Sets `offline_answers_submitted_at = now()` (server clock)
- Computes `is_within_window`:
  - `created_at` must be within simulado execution window
  - `offline_answers_submitted_at - created_at ≤ exam_duration_seconds`
  - Both must be true
- Sets `status = 'completed'`
- Calls `finalize_attempt_with_results(attempt_id)` internally
- Returns: `{ attempt_id, is_within_window }`
- Client **never** writes `is_within_window` directly

---

## PDF Generation

### Edge Function: `generate-exam-pdf`

- Triggered on first download request for a simulado
- Checks Supabase Storage for `exam-pdfs/{simulado_id}.pdf` — if exists, skips generation
- Generates PDF with all questions + options (A/B/C/D only — no option E in this platform)
- Stores in Supabase Storage bucket `exam-pdfs`
- Returns a signed URL (1-hour expiry) for the client to trigger download

### PDF Visual Design (approved)

- **Header:** `hsl(345, 70%, 22%)` dark wine — SanarFlix PRO logo (icon + name) left, "ENAMED 2025 · 100 questões · 5 horas" right
- **Body:** 2-column layout, Georgia serif font, 4 questions per page (2 per column)
- **Question number:** wine accent `hsl(345, 65%, 42%)`, uppercase small label
- **Question text:** black `#000`, maximum contrast
- **Option letters:** circles with border + text `hsl(345, 65%, 28%)` dark wine
- **Option text:** black `#000`
- **Footer:** "ENAMED 2025 · SanarFlix PRO · Modo Offline · Uso exclusivo do candidato" + "Página N de 28" in wine accent
- **No area/theme tags** on questions
- **Cover page:** exam instructions + QR code linking to `/simulados/:slug/gabarito`
- **Last page:** blank answer sheet (for optional paper marking before digital entry)
- **No option E** — all questions have exactly 4 alternatives (A/B/C/D)

---

## Answer Sheet Page (`/simulados/:slug/gabarito`)

### Layout

- 2 columns, 10 questions per column (all 100 questions visible on page, scrollable)
- Each row: question number + 4 bubble options (A/B/C/D)
- Auto-advance: selecting an option scrolls/focuses next unanswered question
- Progress bar at top: "X de 100 respondidas"
- Floating "Enviar gabarito" button (sticky bottom), disabled until all answered or with warning for incomplete
- Confirmation modal before final submission

### States

| State | UI |
|-------|----|
| Unanswered | Empty bubbles |
| Answered | Filled bubble (wine color) |
| Auto-focused | Highlighted row |
| Submitted | Disabled, loading → redirect to ResultadoPage |

### Timer integration

- If student arrives before timer expires: timer still visible (floating chip)
- If student arrives after timer expired (e.g., from email link): answer sheet is still submittable but `is_within_window` will be `false` server-side

---

## FloatingOfflineTimer Component

- Rendered at root layout level in `App.tsx`
- Only visible when there is an active `offline_pending` attempt
- Data source: `useOfflineAttempt` hook (fetches from DB; fallback from localStorage for offline resilience)
- Displays: `"Prova offline · Xh Ym restantes"` — compact chip, bottom-right corner, above any other floating elements
- Color states: normal → amber (≤ 30 min) → red (≤ 10 min)
- Clicking opens a small popover: simulado name, time remaining, "Preencher gabarito" CTA
- When time hits zero: auto-navigate to `/simulados/:slug/gabarito` with toast notification

---

## Reminder System (Novu)

### In-app banner

- `SimuladosPage` shows a persistent alert card when `offline_pending` attempt exists with window still open
- Message: "Você baixou a prova offline mas ainda não enviou o gabarito. Tempo restante: Xh Ym."
- CTA: "Preencher agora" → `/simulados/:slug/gabarito`

### Email: "Tempo esgotado"

- Triggered when `started_at + exam_duration < now()` and `status = 'offline_pending'`
- Via pg_cron or Supabase scheduled Edge Function: `notify-offline-timeout`
- Template: informs student their exam time expired, they can still submit (without ranking), links to gabarito page

### Email: "Janela fechando"

- Triggered 2 hours before `simulado.end_at` for all `offline_pending` attempts
- Via scheduled Edge Function: `notify-offline-reminder`
- Template: reminds student to submit gabarito before ranking window closes

---

## New Routes

| Route | Component | Description |
|-------|-----------|-------------|
| `/simulados/:slug/gabarito` | `AnswerSheetPage` | Digital answer sheet |

`ResultadoPage` at `/simulados/:slug/resultado/:attemptId` is reused unchanged for showing offline results.

---

## New Files

| File | Type | Responsibility |
|------|------|----------------|
| `src/pages/AnswerSheetPage.tsx` | Page | Answer sheet UI |
| `src/components/exam/AnswerSheetGrid.tsx` | Component | Bubble grid (2-col, A/B/C/D) |
| `src/components/FloatingOfflineTimer.tsx` | Component | Persistent countdown chip |
| `src/hooks/useOfflineAttempt.ts` | Hook | Fetches/manages active offline attempt |
| `src/services/offlineApi.ts` | Service | createOfflineAttempt, downloadPdf, submitAnswers |
| `supabase/functions/generate-exam-pdf/index.ts` | Edge Function | PDF generation + Storage (use `pdf-lib` — Deno-compatible) |
| `supabase/functions/notify-offline-timeout/index.ts` | Edge Function | Email when time expires |
| `supabase/functions/notify-offline-reminder/index.ts` | Edge Function | Email before window closes |

---

## Modified Files

| File | Change |
|------|--------|
| `src/App.tsx` | Add `/gabarito` route + render `FloatingOfflineTimer` |
| `src/pages/SimuladosPage.tsx` | Enable "Modo Offline" button + in-app reminder banner |
| `supabase/migrations/` | New migration: `attempt_type` column + `offline_answers_submitted_at` column |

---

## Security Model

| Risk | Mitigation |
|------|-----------|
| Client manipulates countdown | `started_at = attempt.created_at` set server-side; client is read-only |
| Client submits after time expires | `submit_offline_answers_guarded` computes timing from server clock; `is_within_window` set server-side |
| Client writes `is_within_window` directly | Column not writable by authenticated role; only via SECURITY DEFINER RPC |
| Download outside execution window | `create_offline_attempt_guarded` records window status at creation; ranking blocked even if submitted in time |
| Duplicate submissions | RPC checks for existing `offline_pending` attempt; `status` transitions are one-way |

---

## Out of Scope

- Offline-first PWA / service worker caching (student needs internet to submit)
- Image rendering in PDF (questions without images only in v1; image support is a future enhancement)
- Multiple simultaneous offline attempts for the same simulado

---

## Success Criteria

- Student downloads PDF in < 2 seconds (pre-generated, signed URL)
- Answer sheet handles 100 questions smoothly on mobile
- Timer persists across page navigations and browser refresh (localStorage fallback)
- `is_within_window` is never determined by client-side data
- Ranking rule parity: offline student cannot gain time advantage over online student
