# Gaps de Analytics — SanarFlix PRO: ENAMED

> Eventos que deveriam existir mas não existem, lacunas em eventos existentes,
> e ambiguidades do código que precisam de decisão antes da instrumentação.
>
> Organizado por prioridade: P0 primeiro.

---

## GAP-01: `simulado_completed` está incompleto [P0]

**Evento existente:** `trackEvent('simulado_completed', { simuladoId, answered, total })`
**Fonte:** `src/hooks/useExamFlow.ts:218`

**Problema:** O evento é disparado **antes** de `fetchAttempt()` retornar `is_within_window` do servidor. Além disso, faltam as propriedades mais valiosas para análise de produto:

| Propriedade faltando | Disponível onde |
|---|---|
| `attempt_id` | `state.attemptId` (já existe no state) |
| `score_percentage` | `attempt.score_percentage` (após `submitAttempt()`) |
| `duration_minutes` | `Date.now() - new Date(state.startedAt).getTime()` |
| `tab_exit_count` | `state.tabExitCount` |
| `fullscreen_exit_count` | `state.fullscreenExitCount` |
| `is_within_window` | `attempt.is_within_window` (retorno do RPC) |

**Também:** o campo `simuladoId` usa camelCase — o padrão do catalog define snake_case. Deve ser `simulado_id`.

**Ação:** Mover o trackEvent para depois de `fetchAttempt()` retornar, enriquecer com os campos acima. Ver `src/hooks/useExamFlow.ts` — função `finalize()`.

**Status: RESOLVED** — Implementado no plano de instrumentação 2026-04-05. `finalize()` agora enriquece `simulado_completed` com todos os campos acima após `getAttempt()` retornar. Ref: Task 4.

---

## GAP-02: `simulado_started` sem modo (online vs offline) [P0]

**Evento existente:** `trackEvent('simulado_started', { simuladoId, attemptId })`
**Fonte:** `src/hooks/useExamStorageReal.ts:172`

**Problema:** Não distingue se o attempt foi criado para prova online ou offline. A prova offline tem um path completamente diferente (`offlineApi.createOfflineAttempt()`), e não há `simulado_started` lá.

**Ação:**
- Adicionar `mode: "online" | "offline"` ao `simulado_started`
- Adicionar `trackEvent(EVENTS.OFFLINE_ATTEMPT_CREATED)` em `offlineApi.createOfflineAttempt()`

**Status: RESOLVED** — Implementado no plano de instrumentação 2026-04-05. `simulado_started` agora inclui `mode: 'online'`; `offline_attempt_created` adicionado em `offlineApi.createOfflineAttempt()`. Refs: Tasks 3 e 6.

---

## GAP-03: Zero instrumentação no caminho de autenticação [P0]

**Problema:** `AuthContext.tsx` não tem nenhum trackEvent. Impossível medir:
- Taxa de sucesso de login por método
- Frequência de erros de autenticação
- Conversão de signup (cadastros novos vs retornos)

**Ação:** Adicionar eventos em `AuthContext.tsx`:
- `auth_login_succeeded` no handler `onAuthStateChange` com `event === 'SIGNED_IN'`
- `auth_login_failed` no catch de `signInWithPassword` e `sendLoginLink`

**Status: RESOLVED** — Implementado no plano de instrumentação 2026-04-05. `auth_login_succeeded` e `auth_login_failed` adicionados em `signInWithPassword` e `sendLoginLink`. `auth_profile_load_failed` adicionado em `UserContext`. Ref: Task 5.

---

## GAP-04: `exam_submit_failed` e `exam_storage_fallback` não existem [P0]

**Problema:** Falhas silenciosas no motor de prova não são visíveis. O toast de erro aparece na UI, mas nenhum evento de analytics é disparado. Impossível saber com que frequência usuários perdem dados ou falham ao finalizar.

**Ação:**
- `exam_submit_failed`: adicionar no catch de `finalize()` em `src/hooks/useExamFlow.ts`
- `exam_storage_fallback`: adicionar no path de toast destrutivo em `src/hooks/useExamStorageReal.ts`

**Status: RESOLVED** — Implementado no plano de instrumentação 2026-04-05. `exam_submit_failed` adicionado no catch de `finalize()`; `exam_storage_fallback` adicionado no catch de `loadState()`. Refs: Tasks 3 e 4.

---

## GAP-05: `error_boundary_triggered` não existe [P0]

**Problema:** `ErrorBoundary` captura crashes da app mas não os reporta para analytics. Impossível saber se usuários estão vendo tela de erro.

**Fonte:** `src/components/ErrorBoundary.tsx`

**Ação:** Em `componentDidCatch()`, chamar `trackEvent(EVENTS.ERROR_BOUNDARY_TRIGGERED, {...})`.

**Status: RESOLVED** — Implementado no plano de instrumentação 2026-04-05. `error_boundary_triggered` adicionado em `componentDidCatch()` com `error_message`, `component_stack` (truncado em 500 chars), e `route`. Ref: Task 5.

---

## GAP-06: Nomes de propriedades inconsistentes (camelCase vs snake_case) [P1]

**Problema:** Os 8 eventos existentes usam `camelCase` nas propriedades:
```
simuladoId     → deve ser simulado_id
attemptId      → deve ser attempt_id
simuladoTitle  → deve ser simulado_title
institutionsCount → deve ser institutions_count
selectedSimuladoId → deve ser selected_simulado_id
comparisonFilter   → deve ser comparison_filter
segmentFilter      → deve ser segment_filter
currentSegment     → deve ser current_segment
requiredSegment    → deve ser required_segment
ctaTo              → deve ser cta_to
```

**Impacto:** Quando um novo handler (Posthog, Amplitude) for adicionado, as propriedades chegarão com nomes mistos, dificultando queries.

**Ação:** Normalizar para snake_case em todos os `trackEvent()` existentes. Mudança de nomenclatura — não quebra funcionalidade, mas exige migração de queries existentes se já houver analytics em produção.

**Status: RESOLVED** — Implementado no plano de instrumentação 2026-04-05. Todos os 8 eventos existentes normalizados para snake_case em `CorrecaoPage`, `RankingPage`, `ProGate`, `MobileDashboardHeader`, `UpgradeBanner`, `OnboardingPage`, `useExamStorageReal` e `useExamFlow`. Ref: Tasks 2, 3, 4.

---

## GAP-07: `landing_page_viewed` não existe [P1]

**Problema:** Impossível medir quantos usuários chegam à landing, de onde vêm (UTM), e qual é a taxa de conversão landing → lead.

**Ação:** Adicionar `useEffect` em `src/pages/LandingPage.tsx` que dispara `landing_page_viewed` com UTM params extraídos de `window.location.search`.

**Status: RESOLVED** — Implementado no plano de instrumentação 2026-04-05. `landing_page_viewed` adicionado com `referrer`, `utm_source`, `utm_medium`, `utm_campaign`. Ref: Task 7.

---

## GAP-08: `exam_integrity_event` não existe [P1]

**Problema:** `tabExitCount` e `fullscreenExitCount` são persistidos no banco mas nunca trackados como eventos em tempo real. Impossível saber se exits de tab são correlacionados com scores melhores (potencial cheat signal).

**Fonte:** `src/hooks/useExamFlow.ts` — `handleTabExit()`, `handleFullscreenExit()`

**Ambiguidade:** O produto deve decidir se este evento deve ser enviado apenas como P0 de integridade ou também como sinal para detecção de padrões. Impacta privacy policy.

**Status: RESOLVED** — Implementado no plano de instrumentação 2026-04-05. `exam_integrity_event` adicionado em `onTabExit` e `onFullscreenExit` com `event_type`, `count_so_far` e `time_remaining_seconds`. Nota: decisão de privacy policy permanece pendente — o evento é disparado mas a interpretação/uso fica a critério do produto. Ref: Task 4.

---

## GAP-09: `resultado_viewed` não existe [P1]

**Problema:** Impossível medir quantos usuários que completam a prova chegam a ver o resultado. Um drop neste funil (completou → viu resultado) indicaria problema no fluxo pós-submissão.

**Ação:** Adicionar `trackEvent` em `src/pages/ResultadoPage.tsx` quando dados de resultado estiverem carregados.

**Status: RESOLVED** — Implementado no plano de instrumentação 2026-04-05. `resultado_viewed` adicionado com `simulado_id`, `score_percentage`, `total_correct`, `total_questions`, `worst_area`, `best_area`, `segment`. Ref: Task 7.

---

## GAP-10: `offline_answers_submitted` não existe [P0]

**Problema:** O fluxo offline é uma funcionalidade central do produto (permite participar sem internet). Zero cobertura de analytics no path mais crítico: submissão das respostas offline.

**Questão aberta:** `is_within_window` é retornado pelo RPC. Se `false`, o attempt não conta para ranking — deveria existir um evento separado `offline_attempt_rejected` ou o campo no `offline_answers_submitted` é suficiente?

**Status: RESOLVED** — Implementado no plano de instrumentação 2026-04-05. `offline_answers_submitted` adicionado com `attempt_id`, `simulado_id`, `answers_count`, `is_within_window`. `offline_answers_submit_failed` adicionado no path de erro. Decisão sobre `offline_attempt_rejected`: o campo `is_within_window: false` no evento existente é suficiente por ora. Ref: Task 6.

---

## GAP-11: `AnalyticsEventName` no analytics.ts não inclui todos os eventos [P1]

**Problema:** `src/lib/analytics.ts` tem um union type `AnalyticsEventName` com apenas 8 valores. Isso significa que `trackEvent()` rejeita TypeScript todos os novos eventos em tempo de compilação.

**Ação:** Ao implementar novos eventos, atualizar o union type em `analytics.ts` (ou mover para o `tracking-plan.ts` e importar de lá).

**Status: RESOLVED** — Implementado no plano de instrumentação 2026-04-05. Union type expandido de 8 para 47 eventos em `src/lib/analytics.ts`. Ref: Task 1.

---

## GAP-12: `ranking_viewed` é disparado em dois contextos diferentes [P2]

**Problema:** O mesmo evento `ranking_viewed` é usado para:
1. Acesso direto à página `/ranking` (com `selectedSimuladoId`, `comparisonFilter`, `segmentFilter`)
2. Abertura do modal de ranking pelo sino mobile (com `source: "mobile_header_bell"`)

As propriedades são incompatíveis entre si (caso 1 tem filtros, caso 2 só tem `source`).

**Opções:**
- A) Manter um evento só, tornando os campos opcionais (situação atual)
- B) Separar em `ranking_page_viewed` e `ranking_modal_opened`

**Recomendação:** Separar (opção B) — permite medir engajamento do modal vs página de forma independente.

---

## GAP-13: Sem tracking de tempo na prova [P2]

**Problema:** Impossível saber:
- Quanto tempo médio leva para responder uma questão
- Em quais questões os usuários passam mais tempo
- Se questões de alta dificuldade geram mais tempo (correlação)

**Ação:** Adicionar `time_on_question_ms` ao `exam_answer_saved` (timestamp quando questão abriu vs quando respondeu).

---

## GAP-14: `AnalyticsHandler` é síncrono — sem provider de analytics em produção [P1]

**Problema:** `src/lib/analytics.ts` tem handlers registráveis, mas nenhum handler real está registrado no codebase (`registerAnalyticsHandler` nunca é chamado no código de produção). Todos os `trackEvent()` só fazem `logger.log` — nenhum evento chega a um sistema externo.

**Ação:** Registrar handler real (Posthog/Amplitude/etc.) em `src/main.tsx` ou em um módulo de inicialização da app:
```ts
// src/main.tsx
import { registerAnalyticsHandler } from "@/lib/analytics";
import posthog from "posthog-js";

registerAnalyticsHandler((event) => {
  posthog.capture(event.name, event.payload);
});
```

**Status: PARTIALLY RESOLVED** — Implementado no plano de instrumentação 2026-04-05. Handler de desenvolvimento adicionado em `src/main.tsx` (console.groupCollapsed em modo DEV). Handler de produção (Posthog/Amplitude) pendente — requer decisão de provider e configuração de `VITE_POSTHOG_KEY` ou equivalente. Ref: Task 1.

---

## GAP-15: `onboarding_edit_blocked` não existe [P2]

**Problema:** Usuários que tentam editar onboarding durante janela de prova recebem um bloqueio mas não sabemos com que frequência isso acontece. Pode indicar confusão na UX do calendário de janelas.

**Status: RESOLVED** — Implementado no plano de instrumentação 2026-04-05. `onboarding_edit_blocked` adicionado em `handleNext` e `handleFinish` quando `isEditingBlocked === true`, com `reason: 'active_exam_window'` e `next_editable_at`. Ref: Task 8.

---

## Ambiguidades e Perguntas de Produto

### A. `available_late` deve contar para ranking?

O código define `available_late` como: janela fechou mas simulado ainda disponível; attempt **não conta para ranking**. O `is_within_window` no banco reflete isso, mas não há evento específico para attempts late. Deveria existir `simulado_late_attempt_started`?

### B. Quantos `correction_viewed` por sessão?

O evento é disparado toda vez que a página monta. Se o usuário navegar para outra rota e voltar, dispara de novo. Isso é intencional (medir retornos) ou deve ter deduplicação por sessão?

### C. `high_confidence` e `marked_for_review` no `exam_answer_saved`

Estes campos existem no estado de cada resposta mas são raramente usados pelos alunos. Logar a cada resposta pode criar muito ruído. Alternativa: logar apenas quando `high_confidence` ou `marked_for_review` mudar de valor.
