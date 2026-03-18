# Premium UX/UI Audit — enamed-arena (SanarFlix PRO: ENAMED)

**Scope:** Full product experience — login, onboarding, dashboard, simulados list/detail, exam flow, resultado, correção, ranking, desempenho, configurações.  
**Reference:** ux-ui-architect reference.md (quality bar, heuristics, patterns, anti-patterns, screen/flow frameworks).  
**Date:** 2025-03-17.

---

## 1. What is working

- **Design system foundation** — CSS variables (wine, surfaces, success/warning/info), typography scale (display, heading-1–3, body, caption, overline), radius tokens, shadow tokens. Plus Jakarta Sans and a clear premium-card / premium-card-interactive pattern.
- **Global focus and scrollbar** — `:focus-visible` ring and custom scrollbar in `index.css` support accessibility and polish.
- **Login flow** — Clear mode tabs (Entrar / Criar conta), magic link + password paths, sent state with resend and back, error translation, loading state on submit. AnimatePresence for form transitions.
- **Onboarding** — Three steps with progress indicator, search in specialty/institutions, validation and error message, saving state on finish, persisted state so refresh doesn’t lose progress.
- **Dashboard (Index)** — Clear primary CTA (next simulado or onboarding), stats grid, “Últimos Simulados” + “Acesso Rápido”, loading skeleton, empty state for “no simulados completed.”
- **Simulado detail** — Status-driven blocks (upcoming, ready to start, in progress, closed_waiting, hasResults), back link, info cards, execution window section, CTAs per state.
- **Resultado** — Hero score, breakdown (acertos/erros/em branco), best/worst area cards, area progress bars with motion, primary CTA “Ver Correção” and secondary links.
- **Exam (prova)** — Dedicated full-screen layout, progress bar (answered/total), tab-away warning, QuestionDisplay with selected/eliminated states and focus ring, navigation prev/next.
- **Sidebar** — Collapsible, group labels (Navegação, PRO Exclusivo), active state via NavLink, footer with settings and logout. PRO badge on Caderno de Erros.
- **EmptyState** — Reusable component with icon, title, description, optional action; used for “simulado não encontrado” and “sem resultado.”
- **Consistency** — PremiumCard, SectionHeader, PageHeader, StatusBadge reused across pages. Motion (Framer Motion) used for entrance and step transitions without dominating.

---

## 2. Main problems (priority order)

### P1 — Journey and trust

1. **SimuladosPage ignores `error`** — `useSimulados()` returns `error` but the page never shows it. If the list fails to load, the user sees empty sections and no explanation or retry. **Impact:** Loss of trust and confusion when API/Supabase fails.
2. **No global or in-page error boundary feedback** — ErrorBoundary exists but there is no consistent “something went wrong” + retry pattern on data-fetch errors (e.g. simulados, ranking, exam result). **Impact:** Dead ends and uncertainty.
3. **Resultado after exam: no explicit “next”** — ExamCompletedScreen leads to resultado/correção, but the transition and “what just happened / what to do now” could be clearer. **Impact:** Slight drop in confidence and retention after a high-stakes moment.

### P2 — Hierarchy and clarity

4. **Dashboard stats lack a single primary metric** — Four equal StatCards (Simulados realizados, Média geral, Ranking “—”, Simulados). “Ranking” as “—” adds no value; there is no clear “main number” for the day. **Impact:** Weak first impression and no obvious focus (reference: “one primary focus per view”).
5. **Simulado detail: too many equal CTAs when hasResults** — “Ver Resultado”, “Ver Correção”, “Ver Desempenho”, “Ver Ranking” in one row. Primary action (Ver Correção or Ver Resultado) is not visually dominant. **Impact:** Slower decision and diluted emphasis.
6. **Resultado page: multiple equal-weight CTAs** — Same pattern: Ver Correção, Desempenho, Ranking, Comparativo. Primary path (correção) should be the clear next step.

### P3 — States and feedback

7. **Loading states are inconsistent** — Some pages use SkeletonCard (Index, SimuladoDetail, Resultado), SimuladosPage uses 3 SkeletonCards in a grid, exam uses a single spinner. No shared “page loading” pattern or skeleton that matches the final layout. **Impact:** Perceived quality and perceived speed vary by screen.
8. **Buttons: missing or weak pressed/active state** — Many primary buttons use `hover:bg-wine-hover` but no explicit `active:` (e.g. scale or opacity). ProGate and UpgradeBanner CTAs are `<button>`/`<Link>` without `focus-visible` class. **Impact:** Interaction feels less responsive and less premium.
9. **Empty states sometimes lack a single next action** — Dashboard “Nenhum simulado concluído ainda” has no CTA (e.g. “Ir ao calendário”). EmptyState component supports `action` but it’s not always used where it would unblock the user.

### P4 — Responsiveness and touch

10. **Header and sidebar on mobile** — Header is a single row (trigger + “Completar perfil” + segment + avatar); on very small screens this can feel cramped. Sidebar collapses to icons; touch targets (h-10) are acceptable but could be validated. **Impact:** Mobile experience is usable but not clearly optimized.
11. **SimuladosPage table** — Timeline table uses `overflow-x-auto` and hides columns on sm/md; on mobile the table is a horizontal scroll. No card fallback for small screens. **Impact:** Table-heavy experience on mobile.
12. **Exam: question options and eliminate button** — Option buttons are large; eliminate is “opacity-0 group-hover” so on touch there’s no hover. Touch users may not discover eliminate/restore. **Impact:** Feature discoverability on mobile.

### P5 — Accessibility and semantics

13. **Icon-only or decorative icons** — SidebarTrigger (Menu), sidebar icons with text when expanded are OK; some links (e.g. “Ver Resultado” with icon) are fine. ProGate/UpgradeBanner buttons could use explicit `aria-label` if the visible text is not descriptive enough for context. **Impact:** Minor; screen-reader users still get link text.
14. **Onboarding “Voltar” disabled with opacity-0 and pointer-events-none** — When `step === 0`, back is invisible and unfocusable. Correct for “no back,” but focus order and “skip to content” could be checked. **Impact:** Low; flow is linear.
15. **Modal/dialog focus** — SubmitConfirmModal (exam) likely uses Radix; focus trap and Escape should be verified. **Impact:** Critical for keyboard users in exam flow.

### P6 — Design system and consistency

16. **Spacing and density** — Most pages use `gap-3`, `gap-4`, `mb-8`; some use `p-6 md:p-8`. Generally consistent, but a few one-offs (e.g. `mb-2.5`, `mt-0.5`) exist. **Impact:** Small; overall rhythm is good.
17. **ProGate CTA is `<button>` but doesn’t navigate** — ProGate renders a `<button>` “Conhecer o PRO” with no `onClick` or link. User expects to go somewhere. **Impact:** Dead end; conversion and trust drop.
18. **Caderno de Erros for non-PRO** — Caderno appears in sidebar and “Acesso Rápido”; non-PRO users hit ProGate. Flow is correct but the sidebar could soften the affordance (e.g. “PRO” badge only, no misleading “available” feel). **Impact:** Minor; currently clear with PRO badge.

---

## 3. Highest-impact improvements

1. **Add error state and retry on SimuladosPage (and list-based flows)** — When `error` is truthy, show a clear message (“Não foi possível carregar os simulados”) and a “Tentar novamente” button that refetches. Reuse EmptyState or a small inline error card. **Impact:** Restores trust and unblocks the journey.
2. **Define one primary metric on the dashboard** — Make “Simulados realizados” or “Média geral” the hero stat (larger, first); replace “Ranking —” with a real value or a “Ver ranking” link. **Impact:** Stronger first impression and clarity.
3. **Single primary CTA when results are available** — On Simulado detail (hasResults) and Resultado, style one action as primary (e.g. “Ver Correção”) and the rest as secondary (outline or muted). **Impact:** Faster next step and clearer hierarchy.
4. **ProGate CTA must navigate** — Use `<Link to="/configuracoes">` (or a configurable prop) for “Conhecer o PRO” so the button actually goes somewhere. **Impact:** Removes dead end and supports conversion.
5. **Standardize loading UX** — Use SkeletonCard (or a page-specific skeleton that mirrors layout) everywhere data is loading (dashboard, simulados list, detail, resultado). Same pattern for “loading simulado” in exam. **Impact:** Consistent perceived speed and polish.
6. **Empty state + one action** — Where empty states can be resolved by one action (e.g. “Nenhum simulado concluído” → “Ver calendário de simulados”), add that CTA. **Impact:** Reduces dead ends and improves time-to-value.
7. **Button active/pressed and focus-visible** — Add `active:scale-[0.98]` or `active:opacity-90` to primary buttons; ensure all interactive elements use `focus-visible:ring-2` (or inherit from `:focus-visible` in index.css). **Impact:** Better feedback and accessibility.

---

## 4. Premium opportunities

- **Command palette (Cmd+K)** — For power users, quick jump to “Iniciar simulado”, “Ver ranking”, “Desempenho”, “Configurações”. Fits reference “command palette” pattern and elevates perceived product quality.
- **Resultado: micro-celebration** — Short, subtle motion or copy when the user lands on resultado (e.g. “Simulado concluído” with a brief highlight). Keeps tone professional but reinforces completion.
- **Onboarding completion moment** — After “Começar”, a clear success state (“Perfil salvo”) before redirect to dashboard, or a one-line toast “Perfil atualizado” on “/”. Reinforces confidence.
- **Exam: progress persistence** — If not already obvious in the UI, a small “Suas respostas são salvas automaticamente” near the progress bar. Reduces anxiety.
- **Dashboard “next simulado” card** — Slight refinement: one clear label (“Próximo simulado” vs “Disponível agora”) and a single primary label on the CTA (“Iniciar agora” / “Ver detalhes”) to avoid two competing phrases.
- **Unified empty/error component** — Extend EmptyState (or add a small ErrorState) with variants: empty (illustration + CTA), error (message + retry), offline (message + retry when back online). Reuse across list, detail, resultado.
- **Motion: reduced-motion preference** — Respect `prefers-reduced-motion` for entrance animations and progress bar animations (e.g. shorten or disable). Aligns with reference “accessibility is mandatory.”
- **Tablet breakpoint** — Explicit checks for `md` (e.g. simulados grid, resultado layout) so tablet feels designed, not just “small desktop.”

---

## 5. Recommended implementation plan

### Quick wins (1–2 days)

- **SimuladosPage error state** — If `error`, render an error message + “Tentar novamente” (refetch). Reuse EmptyState with an error icon and action, or a small inline card above the grid.
- **ProGate CTA** — Replace `<button>` with `<Link to={...}>` (e.g. `/configuracoes`) so “Conhecer o PRO” navigates. Keep same styling.
- **Dashboard empty state CTA** — In “Nenhum simulado concluído ainda”, add a Link “Ver calendário de simulados” → `/simulados`.
- **Primary vs secondary on result CTAs** — On Simulado detail (hasResults) and Resultado, make “Ver Correção” (or “Ver Resultado” where applicable) the only solid primary button; others secondary (border/muted). One clear next step.

### Medium improvements (3–5 days)

- **Dashboard primary metric** — Restructure stats: one hero stat (e.g. “Simulados realizados” or “Média”) larger and first; remove or replace “Ranking —” with “Ver ranking” link or real value from API.
- **Loading consistency** — Use SkeletonCard (or layout-matched skeletons) on SimuladosPage and any page that currently uses only a spinner or inconsistent skeleton count. Match skeleton structure to final content (e.g. list of cards).
- **Button states** — Add `active:` and ensure `focus-visible` on all primary/secondary buttons and key links (ProGate, UpgradeBanner, onboarding, login, exam). Use utility or shared Button variant if needed.
- **Exam completed → resultado** — Ensure ExamCompletedScreen has one clear CTA (“Ver resultado”) and optional short copy (“Seu desempenho já está disponível”). No change required if already clear; otherwise one line of copy or CTA order.
- **Error boundary + retry** — Ensure ErrorBoundary renders a simple “Algo deu errado” + “Recarregar” UI. Optionally add a small “refetch on error” pattern for React Query (onError + retry button) for list/detail pages.

### Deeper structural improvements (1–2 weeks)

- **Unified error/empty/offline** — Design a single pattern (EmptyState + ErrorState or one component with variant) and use it for: simulados list error, simulado not found, resultado not available, and any future list/detail errors. Include retry and optional “Voltar.”
- **Mobile and touch** — Audit header and sidebar on 320–480px; ensure touch targets ≥44px; consider card layout for SimuladosPage timeline on small screens (e.g. replace or supplement table with cards). Exam: make “eliminate option” discoverable on touch (e.g. always-visible icon or long-press).
- **Accessibility pass** — Run axe or similar on login, onboarding, dashboard, exam, resultado; fix focus order, aria-labels where needed, and SubmitConfirmModal focus trap. Add `prefers-reduced-motion` for animations.
- **Command palette (optional)** — Implement Cmd+K with cmdk (or similar): routes and key actions. Raises perceived quality for heavy users.

---

## 6. Direction for redesign (execution-ready)

- **Fix trust and dead ends first** — Error handling (SimuladosPage + any list/detail) and ProGate CTA. These are blocking and low-effort.
- **Then hierarchy** — One primary metric on dashboard; one primary CTA on result/detail pages. Use existing tokens (primary vs secondary button styles).
- **Then states** — Loading (skeletons), empty (with CTA), button active/focus. Reuse PremiumCard, EmptyState, and design tokens.
- **Then responsiveness and a11y** — Mobile/tablet and touch, then accessibility and reduced-motion. No new visual language; refine what exists.
- **Polish pass** — After the above, do one pass on spacing (consistent gap/margin), CTA copy (“Iniciar agora” vs “Ver detalhes”), and any remaining one-off styles. Align with reference.md “Premium UI heuristics” and “Screen-by-screen evaluation framework.”

This order delivers the highest gain in **clarity, trust, and perceived quality** with minimal risk and keeps the codebase production-grade and maintainable.
