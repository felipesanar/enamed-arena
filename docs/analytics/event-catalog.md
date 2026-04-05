# Event Catalog — SanarFlix PRO: ENAMED

> Gerado em: 2026-04-05
> Baseado em análise estática do código-fonte. Cada evento tem origem rastreável.
> Convenção de nomenclatura: `objeto_verbo` em `snake_case`.

---

## Índice

1. [Funil de Conversão (Landing)](#1-funil-de-conversão-landing)
2. [Autenticação](#2-autenticação)
3. [Onboarding](#3-onboarding)
4. [Simulados — Listagem e Detalhe](#4-simulados--listagem-e-detalhe)
5. [Motor de Prova (Exam Engine)](#5-motor-de-prova-exam-engine)
6. [Resultados e Correção](#6-resultados-e-correção)
7. [Ranking](#7-ranking)
8. [Desempenho e Comparativo](#8-desempenho-e-comparativo)
9. [Caderno de Erros](#9-caderno-de-erros)
10. [Monetização e Upsell](#10-monetização-e-upsell)
11. [Fluxo Offline](#11-fluxo-offline)
12. [Erros e Integridade](#12-erros-e-integridade)

---

## 1. Funil de Conversão (Landing)

---

**EVENTO: `lead_captured`**
Gatilho: Usuário clica em qualquer CTA da landing page que leva ao login/cadastro
Side: client
Prioridade: **P0**
Status: ✅ Já implementado (6 chamadas)

Propriedades:
```
source: string   — origem do clique
  valores: "landing_hero_primary" | "landing_nav_login" | "landing_nav_primary"
           | "landing_cta_primary" | "landing_cta_secondary"
           | "landing_exam_demo_create_account"
```

Fontes: `src/components/landing/LandingHero.tsx:366`, `LandingNavbar.tsx:165,177`, `LandingCta.tsx:121,140`, `LandingExamDemo.tsx:231`

---

**EVENTO: `landing_page_viewed`**
Gatilho: Componente `LandingPage` monta (route `/landing`)
Side: client
Prioridade: **P1**
Status: ❌ Não implementado

Propriedades:
```
referrer: string         — document.referrer (ou "direct")
utm_source: string?      — URL param
utm_medium: string?      — URL param
utm_campaign: string?    — URL param
```

Fonte: `src/pages/LandingPage.tsx` (não possui useEffect de tracking)

---

**EVENTO: `landing_section_viewed`**
Gatilho: IntersectionObserver detecta seção visível durante scroll
Side: client
Prioridade: **P2**
Status: ❌ Não implementado

Propriedades:
```
section_id: string   — "hero" | "diferenciais" | "como-funciona" | "experiencia"
                        | "performance" | "pro" | "cta-final"
scroll_depth: number — % da página no momento do trigger
```

Fonte: `src/components/landing/LandingNavbar.tsx` (IntersectionObserver exist mas só atualiza activeId, não tracka)

---

## 2. Autenticação

---

**EVENTO: `auth_login_attempted`**
Gatilho: Usuário submete o form de login (email + senha ou magic link)
Side: client
Prioridade: **P1**
Status: ❌ Não implementado

Propriedades:
```
method: "password" | "magic_link" | "sso"
```

Fonte: `src/pages/LoginPage.tsx` (forma tem onSubmit, sem tracking)

---

**EVENTO: `auth_login_succeeded`**
Gatilho: `onAuthStateChange` com evento `SIGNED_IN`
Side: client
Prioridade: **P0**
Status: ❌ Não implementado

Propriedades:
```
method: "password" | "magic_link" | "sso"
is_new_user: boolean   — primeiro login (derivado de created_at vs last_sign_in_at)
segment: string        — "guest" | "standard" | "pro"
```

Fonte: `src/contexts/AuthContext.tsx` (onAuthStateChange handler)

---

**EVENTO: `auth_login_failed`**
Gatilho: signInWithPassword() ou sendLoginLink() retorna erro
Side: client
Prioridade: **P1**
Status: ❌ Não implementado

Propriedades:
```
method: "password" | "magic_link"
error_code: string   — código de erro do Supabase
```

Fonte: `src/pages/LoginPage.tsx`

---

**EVENTO: `auth_signup_attempted`**
Gatilho: signUpWithPassword() chamado
Side: client
Prioridade: **P1**
Status: ❌ Não implementado

Propriedades:
```
segment: string   — vindo do SSO param
```

---

**EVENTO: `auth_password_reset_requested`**
Gatilho: Usuário submete form de forgot password
Side: client
Prioridade: **P2**
Status: ❌ Não implementado

Propriedades:
```
(nenhuma — não logar email por PII)
```

---

## 3. Onboarding

---

**EVENTO: `onboarding_completed`**
Gatilho: Usuário conclui os 3 passos e salva
Side: client
Prioridade: **P0**
Status: ✅ Já implementado

Propriedades:
```
segment: string           — "guest" | "standard" | "pro"
specialty: string         — especialidade escolhida
institutions_count: number — número de instituições-alvo selecionadas
```

Fonte: `src/pages/OnboardingPage.tsx:150`

---

**EVENTO: `onboarding_started`**
Gatilho: Usuário autentica e chega na tela de onboarding pela primeira vez
Side: client
Prioridade: **P1**
Status: ❌ Não implementado

Propriedades:
```
segment: string
from_sso: boolean   — se veio de AuthSSOPage
```

---

**EVENTO: `onboarding_step_viewed`**
Gatilho: Usuário avança para um passo do onboarding
Side: client
Prioridade: **P2**
Status: ❌ Não implementado

Propriedades:
```
step: number   — 1 (Specialty) | 2 (Institution) | 3 (Confirmation)
step_name: string
```

Fonte: `src/pages/OnboardingPage.tsx` — tem `currentStep` state mas sem tracking

---

**EVENTO: `onboarding_edit_blocked`**
Gatilho: Usuário tenta editar onboarding durante janela de exame e recebe bloqueio
Side: client
Prioridade: **P1**
Status: ❌ Não implementado

Propriedades:
```
reason: string              — mensagem do guard
next_editable_at: string?   — ISO timestamp
```

Fonte: `src/contexts/UserContext.tsx` — `onboardingEditLocked` state

---

## 4. Simulados — Listagem e Detalhe

---

**EVENTO: `simulados_list_viewed`**
Gatilho: Componente `SimuladosPage` monta
Side: client
Prioridade: **P1**
Status: ❌ Não implementado

Propriedades:
```
total_simulados: number
available_count: number     — status: available | available_late
in_progress_count: number
completed_count: number
has_active_offline: boolean — se há offline_pending attempt
```

Fonte: `src/pages/SimuladosPage.tsx`

---

**EVENTO: `simulado_detail_viewed`**
Gatilho: Componente `SimuladoDetailPage` monta
Side: client
Prioridade: **P1**
Status: ❌ Não implementado

Propriedades:
```
simulado_id: string
simulado_sequence: number
simulado_status: string     — status derivado (available | in_progress | etc.)
user_started: boolean       — já iniciou antes
checklist_required: boolean — isFirstTime (não veteran)
```

Fonte: `src/pages/SimuladoDetailPage.tsx`

---

**EVENTO: `simulado_checklist_completed`**
Gatilho: Usuário marca todos os itens do checklist e habilita o botão de início
Side: client
Prioridade: **P2**
Status: ❌ Não implementado

Propriedades:
```
simulado_id: string
time_to_complete_seconds: number   — tempo desde que abriu a página
```

---

## 5. Motor de Prova (Exam Engine)

---

**EVENTO: `simulado_started`**
Gatilho: useExamStorageReal inicializa attempt (cria no DB via RPC)
Side: client
Prioridade: **P0**
Status: ✅ Já implementado

Propriedades:
```
simulado_id: string
attempt_id: string
```

Fonte: `src/hooks/useExamStorageReal.ts:172`

Nota: Não inclui `is_late` (se já passou a janela) nem `mode: "online" | "offline"`. Ver gaps.md.

---

**EVENTO: `simulado_completed`**
Gatilho: submitAttempt() finaliza com sucesso; após RPC de finalização no backend
Side: client
Prioridade: **P0**
Status: ✅ Já implementado (parcialmente)

Propriedades atuais:
```
simulado_id: string
answered: number     — questões respondidas
total: number        — total de questões
```

Propriedades faltando (ver gaps.md):
```
attempt_id: string
score_percentage: number
duration_minutes: number
tab_exit_count: number
fullscreen_exit_count: number
is_within_window: boolean
```

Fonte: `src/hooks/useExamFlow.ts:218`

---

**EVENTO: `exam_answer_saved`**
Gatilho: Usuário seleciona uma opção e a resposta é persistida no DB (após debounce)
Side: client
Prioridade: **P2**
Status: ❌ Não implementado

Propriedades:
```
simulado_id: string
attempt_id: string
question_index: number       — posição na prova (não ID por privacidade de gabarito)
time_on_question_ms: number  — tempo desde que abriu a questão
is_change: boolean           — se estava alterando resposta anterior
has_eliminations: boolean    — se usou ferramenta de eliminação
high_confidence: boolean
marked_for_review: boolean
```

Fonte: `src/hooks/useExamFlow.ts` — `handleAnswer()` + `handleConfidenceToggle()`

---

**EVENTO: `exam_question_navigated`**
Gatilho: Usuário muda de questão (próxima, anterior, pelo grid)
Side: client
Prioridade: **P3**
Status: ❌ Não implementado

Propriedades:
```
simulado_id: string
from_index: number
to_index: number
method: "next" | "prev" | "grid" | "keyboard"
```

---

**EVENTO: `exam_integrity_event`**
Gatilho: Tab exit ou Fullscreen exit detectado durante prova
Side: client
Prioridade: **P0**
Status: ❌ Não implementado

Propriedades:
```
simulado_id: string
attempt_id: string
event_type: "tab_exit" | "fullscreen_exit"
count_so_far: number   — tab_exit_count ou fullscreen_exit_count no momento
time_remaining_seconds: number
```

Fonte: `src/hooks/useExamFlow.ts` — `handleTabExit()`, `handleFullscreenExit()`

---

**EVENTO: `exam_resumed`**
Gatilho: Usuário volta para uma prova `in_progress` que já havia iniciado
Side: client
Prioridade: **P1**
Status: ❌ Não implementado

Propriedades:
```
simulado_id: string
attempt_id: string
time_elapsed_since_start_minutes: number
answered_before_resume: number
time_remaining_seconds: number
```

Fonte: `src/hooks/useExamFlow.ts` — init logic detecta `in_progress`

---

**EVENTO: `exam_auto_submitted`**
Gatilho: Timer expira e a prova é finalizada automaticamente
Side: client
Prioridade: **P0**
Status: ❌ Não implementado

Propriedades:
```
simulado_id: string
attempt_id: string
answered: number
total: number
reason: "timer_expired" | "past_deadline_on_init"
```

Fonte: `src/hooks/useExamFlow.ts` — `autoFinalize()` path

---

**EVENTO: `exam_submit_attempted`**
Gatilho: Usuário clica "Finalizar" no SubmitConfirmModal e confirma
Side: client
Prioridade: **P1**
Status: ❌ Não implementado

Propriedades:
```
simulado_id: string
attempt_id: string
answered: number
total: number
unanswered: number
time_remaining_seconds: number
```

---

**EVENTO: `exam_submit_failed`**
Gatilho: submitAttempt() lança exceção
Side: client
Prioridade: **P0**
Status: ❌ Não implementado

Propriedades:
```
simulado_id: string
attempt_id: string
error_message: string   — mensagem sanitizada, sem dados de usuário
retry_count: number
```

Fonte: `src/hooks/useExamFlow.ts` — try-catch em finalize()

---

**EVENTO: `exam_offline_detected`**
Gatilho: `navigator.onLine` muda para `false` durante prova
Side: client
Prioridade: **P1**
Status: ❌ Não implementado

Propriedades:
```
simulado_id: string
attempt_id: string
time_remaining_seconds: number
answered_at_disconnect: number
```

---

## 6. Resultados e Correção

---

**EVENTO: `resultado_viewed`**
Gatilho: Componente `ResultadoPage` monta com dados carregados
Side: client
Prioridade: **P1**
Status: ❌ Não implementado

Propriedades:
```
simulado_id: string
score_percentage: number
total_correct: number
total_questions: number
worst_area: string     — área com pior desempenho
best_area: string      — área com melhor desempenho
segment: string
```

Fonte: `src/pages/ResultadoPage.tsx`

---

**EVENTO: `correction_viewed`**
Gatilho: CorrecaoPage monta (gabarito comentado)
Side: client
Prioridade: **P1**
Status: ✅ Já implementado

Propriedades:
```
simulado_id: string
simulado_title: string
segment: string
```

Fonte: `src/pages/CorrecaoPage.tsx:70`

---

**EVENTO: `correction_question_viewed`**
Gatilho: Usuário navega para uma questão específica na correção
Side: client
Prioridade: **P3**
Status: ❌ Não implementado

Propriedades:
```
simulado_id: string
question_index: number
was_correct: boolean
had_reviewed: boolean   — estava marcada para revisão
```

---

**EVENTO: `error_added_to_notebook`**
Gatilho: Usuário clica "Adicionar ao Caderno de Erros" na correção
Side: client
Prioridade: **P1**
Status: ❌ Não implementado

Propriedades:
```
simulado_id: string
question_id: string
area: string
```

Fonte: `src/components/AddToNotebookModal.tsx` (modal existe no codebase)

---

## 7. Ranking

---

**EVENTO: `ranking_viewed`**
Gatilho: RankingPage monta; também em MobileDashboardHeader (bell icon)
Side: client
Prioridade: **P1**
Status: ✅ Já implementado (2 chamadas)

Propriedades:
```
selected_simulado_id: string
comparison_filter: "all" | "specialty" | "institutions"
segment_filter: "all" | "sanarflix" | "pro"
source: "page" | "mobile_header_bell"    — apenas na 2ª chamada
```

Fonte: `src/pages/RankingPage.tsx:107`, `src/components/premium/MobileDashboardHeader.tsx:112`

---

**EVENTO: `ranking_engagement_time`**
Gatilho: RankingPage desmonta (cleanup de useEffect)
Side: client
Prioridade: **P2**
Status: ✅ Já implementado

Propriedades:
```
seconds: number
```

Fonte: `src/pages/RankingPage.tsx:117`

---

**EVENTO: `ranking_filter_changed`**
Gatilho: Usuário altera filtro de comparação ou segmento no ranking
Side: client
Prioridade: **P2**
Status: ❌ Não implementado

Propriedades:
```
simulado_id: string
filter_type: "comparison" | "segment"
old_value: string
new_value: string
```

---

## 8. Desempenho e Comparativo

---

**EVENTO: `desempenho_viewed`**
Gatilho: DesempenhoPage monta
Side: client
Prioridade: **P1**
Status: ❌ Não implementado

Propriedades:
```
simulados_with_results: number
avg_score: number?
best_score: number?
```

---

**EVENTO: `comparativo_viewed`**
Gatilho: ComparativoPage monta (PRO only)
Side: client
Prioridade: **P1**
Status: ❌ Não implementado

Propriedades:
```
simulados_count: number
segment: string   — sempre "pro" aqui
```

---

**EVENTO: `comparativo_filter_applied`**
Gatilho: Usuário altera filtro de área/tema/dificuldade no comparativo
Side: client
Prioridade: **P2**
Status: ❌ Não implementado

Propriedades:
```
filter_type: "area" | "theme" | "difficulty"
value: string
```

---

## 9. Caderno de Erros

---

**EVENTO: `caderno_erros_viewed`**
Gatilho: CadernoErrosPage monta (PRO only)
Side: client
Prioridade: **P1**
Status: ❌ Não implementado

Propriedades:
```
total_errors: number
segment: string   — sempre "pro"
```

---

**EVENTO: `caderno_erros_filtered`**
Gatilho: Usuário usa busca ou filtro por área/tema
Side: client
Prioridade: **P2**
Status: ❌ Não implementado

Propriedades:
```
filter_type: "search" | "area" | "theme"
result_count: number
```

---

## 10. Monetização e Upsell

---

**EVENTO: `upsell_clicked`**
Gatilho: Usuário clica em upgrade/upsell em ProGate ou UpgradeBanner
Side: client
Prioridade: **P0**
Status: ✅ Já implementado (3 chamadas)

Propriedades:
```
source: "pro_gate" | "upgrade_banner" | "mobile_header_upsell"
feature: string?          — feature que estava tentando acessar
current_segment: string?  — segmento atual do usuário
required_segment: string? — segmento necessário
cta_to: string            — URL de destino
```

Fontes: `src/components/ProGate.tsx:79`, `src/components/UpgradeBanner.tsx:43`, `src/components/premium/MobileDashboardHeader.tsx:140`

---

**EVENTO: `feature_gate_seen`**
Gatilho: ProGate renderiza (usuário vê o bloqueio de feature)
Side: client
Prioridade: **P1**
Status: ❌ Não implementado

Propriedades:
```
feature: string          — "comparativo" | "caderno_erros"
current_segment: string
required_segment: string
```

Fonte: `src/components/ProGate.tsx` — renderiza o lock screen, sem evento de visualização

---

## 11. Fluxo Offline

---

**EVENTO: `offline_attempt_created`**
Gatilho: offlineApi.createOfflineAttempt() bem-sucedido
Side: client
Prioridade: **P0**
Status: ❌ Não implementado

Propriedades:
```
simulado_id: string
attempt_id: string
```

Fonte: `src/services/offlineApi.ts` — `createOfflineAttempt()`

---

**EVENTO: `offline_pdf_generated`**
Gatilho: offlineApi.getSignedPdfUrl() retorna URL com sucesso
Side: client
Prioridade: **P1**
Status: ❌ Não implementado

Propriedades:
```
simulado_id: string
forced_regeneration: boolean   — `force` param foi true
```

---

**EVENTO: `offline_answers_submitted`**
Gatilho: offlineApi.submitOfflineAnswers() bem-sucedido
Side: client
Prioridade: **P0**
Status: ❌ Não implementado

Propriedades:
```
attempt_id: string
simulado_id: string
answers_count: number
is_within_window: boolean   — se conta para o ranking
```

Fonte: `src/services/offlineApi.ts` — `submitOfflineAnswers()`

---

**EVENTO: `offline_answers_submit_failed`**
Gatilho: offlineApi.submitOfflineAnswers() lança erro
Side: client
Prioridade: **P0**
Status: ❌ Não implementado

Propriedades:
```
attempt_id: string
simulado_id: string
error_message: string
```

---

## 12. Erros e Integridade

---

**EVENTO: `exam_storage_fallback`**
Gatilho: DB load falha; sistema usa localStorage como fallback
Side: client
Prioridade: **P0**
Status: ❌ Não implementado

Propriedades:
```
simulado_id: string
attempt_id: string?
error_message: string
fallback_source: "localStorage"
```

Fonte: `src/hooks/useExamStorageReal.ts` — toast "Dados carregados do cache local" (destructive)

---

**EVENTO: `exam_storage_retry`**
Gatilho: withRetry() faz uma tentativa adicional após falha
Side: client
Prioridade: **P1**
Status: ❌ Não implementado

Propriedades:
```
operation: string   — label da operação
attempt_number: number
max_attempts: number
error_message: string
```

Fonte: `src/hooks/useExamStorageReal.ts` — `withRetry(operation, label, attempts=3)`

---

**EVENTO: `auth_profile_load_failed`**
Gatilho: Fetch do perfil do usuário falha no UserContext
Side: client
Prioridade: **P0**
Status: ❌ Não implementado

Propriedades:
```
error_message: string
fallback_segment: "guest"
```

Fonte: `src/contexts/UserContext.tsx` — catch em fetchProfile()

---

**EVENTO: `error_boundary_triggered`**
Gatilho: ErrorBoundary captura erro não tratado
Side: client
Prioridade: **P0**
Status: ❌ Não implementado

Propriedades:
```
error_message: string
component_stack: string   — stack do React (sanitizado)
route: string             — window.location.pathname
```

Fonte: `src/components/ErrorBoundary.tsx`

---

## Resumo de Cobertura

| Área | Total Eventos | Implementados | Gap |
|------|:---:|:---:|:---:|
| Funil Landing | 3 | 1 | 2 |
| Autenticação | 5 | 0 | 5 |
| Onboarding | 4 | 1 | 3 |
| Simulados (listagem/detalhe) | 3 | 0 | 3 |
| Motor de Prova | 9 | 2 | 7 |
| Resultados e Correção | 4 | 1 | 3 |
| Ranking | 3 | 2 | 1 |
| Desempenho/Comparativo | 3 | 0 | 3 |
| Caderno de Erros | 2 | 0 | 2 |
| Monetização | 2 | 1 | 1 |
| Fluxo Offline | 4 | 0 | 4 |
| Erros e Integridade | 4 | 0 | 4 |
| **Total** | **46** | **8** | **38** |

---

## Apêndice: Cruzamentos P0/P1 Mais Valiosos

> Perguntas de negócio que exigem cruzar múltiplos eventos.

### 1. Funil completo de conversão
`landing_page_viewed` → `lead_captured` → `auth_login_succeeded { is_new_user: true }` → `onboarding_completed` → `simulado_started`

**Pergunta respondida:** Qual é a taxa de conversão do início ao fim do funil de ativação? Em qual etapa há mais drop?

---

### 2. Taxa de conclusão de prova por segmento
`simulado_started { segment }` → `simulado_completed { is_within_window }`

**Pergunta respondida:** Alunos PRO têm taxa de conclusão maior? Alunos que iniciam fora da janela (`available_late`) concluem menos?

---

### 3. Impacto de integridade no score
`exam_integrity_event { event_type, count_so_far }` → `simulado_completed { score_percentage }`

**Pergunta respondida:** Usuários com mais saídas de tab têm scores sistematicamente maiores (sinal de cola)?

---

### 4. Funil de upsell
`feature_gate_seen { feature }` → `upsell_clicked { source }` → (fora da plataforma) → `auth_login_succeeded { segment: "pro" }`

**Pergunta respondida:** Qual feature gate tem maior taxa de conversão para PRO? Qual CTA source converte melhor?

---

### 5. Retenção pós-resultado
`simulado_completed` → `resultado_viewed` → `correction_viewed` → `error_added_to_notebook`

**Pergunta respondida:** Qual % de alunos que completam a prova chegam a estudar a correção? Qual % usa o caderno de erros?

---

### 6. Performance vs engajamento com ranking
`simulado_completed { score_percentage }` + `ranking_engagement_time { seconds }`

**Pergunta respondida:** Alunos com scores melhores passam mais tempo no ranking (vaidade)? Ou alunos com scores piores (motivação de recuperar)?

---

### 7. Offline: taxa de submissão dentro da janela
`offline_attempt_created` → `offline_answers_submitted { is_within_window }`

**Pergunta respondida:** Qual % de tentativas offline são submetidas dentro do prazo? O processo offline tem fricção suficiente para causar perda de janela?
