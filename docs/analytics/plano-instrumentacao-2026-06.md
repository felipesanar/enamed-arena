# Plano de Instrumentação de Telemetria — ENAMED Arena

> **Entregável da Fase 1.** Auditoria do que existe, avaliação de confiabilidade e
> plano de endurecimento + cobertura. Nenhum código de captura foi escrito ainda.
>
> Data: 2026-06-17 · Autor: auditoria assistida · Status: **aguardando aprovação para Fase 2**

---

## 0. Decisão de arquitetura (travada)

- **Caminho A — camada própria no Supabase.** Confirmado e **já implementado em produção**.
- Não há greenfield. A missão foi reenquadrada de *"construir a camada"* para
  **"endurecer a camada existente até passar na régua de qualidade, sem quebrar os call-sites atuais, e então completar cobertura e admin"**.
- Caminho B (ferramenta externa tipo PostHog) permanece **opcional** como handler adicional, não como destino primário. Fora de escopo agora.

---

## 1. Stack confirmada (lida no código, não assumida)

| Camada | Tecnologia | Versão | Evidência |
|---|---|---|---|
| Build | Vite + TypeScript | 5.4 / 5.8 | `package.json` |
| UI | React + React Router (declarativo, v6) | 18.3 / 6.30 | `src/App.tsx` |
| Componentes | shadcn/ui (Radix) + Tailwind 3.4 + Framer 12 | — | `package.json` |
| Estado/dados | TanStack React Query 5 + Context API | 5.83 | `src/App.tsx` |
| Validação | Zod | 3.25 | **já é dependência** — usaremos para validação de runtime |
| Backend | Supabase (Auth + Postgres RLS + SECURITY DEFINER RPC) | js 2.99 | `src/integrations/supabase/client.ts` |
| Analytics 3rd-party | **nenhuma** (sem PostHog/Segment/Amplitude/GA/Sentry) | — | `package.json` |

**Roteamento:** `BrowserRouter` → `Routes`/`Route` declarativo, lazy por página. Árvore de
providers em `src/App.tsx`: `ErrorBoundary` → `QueryClientProvider` → `ThemeProvider` →
`TooltipProvider` → `AuthProvider` → `UserProvider` → `Toaster` → `BrowserRouter`.
Não há listener global de rota hoje — ponto de injeção natural para contexto de tela.

---

## 2. Inventário da telemetria existente

| Peça | Estado | Local |
|---|---|---|
| Plano de eventos tipado | union `AnalyticsEventName` (>100 nomes) + ~30 interfaces de payload | `src/lib/analytics.ts` |
| Função de captura | `trackEvent(name, payload)` + `registerAnalyticsHandler` + `setSuperProperties` | `src/lib/analytics.ts:181` |
| Handlers | console (DEV) + RPC `log_analytics_event` (sempre) | `src/main.tsx:75-91` |
| Super properties | `session_id`, `platform`, `app_version`, `utm_*` | `src/main.tsx:68-73` |
| Tabela | `analytics_events (id, user_id, event_name, payload, created_at)` + RLS + 3 índices | migration `20260405200000` |
| RPC de escrita | `log_analytics_event` SECURITY DEFINER, `auth.uid()`, grant a `authenticated, anon` | migration `20260405200000` |
| RPCs de leitura (admin) | `admin_dashboard_kpis`, `admin_events_timeseries`, `admin_funnel_stats`, `admin_simulado_engagement`, `admin_live_signals` | migration `20260405210000` |
| Admin UI | página "Jornada" (funil, timeseries, fontes UTM, tempo por etapa) | `src/admin/pages/AdminAnalytics.tsx` |
| Call-sites | **64 arquivos** chamam `trackEvent` | `src/**` |
| Documentação | `event-catalog.md` (936 linhas), `gaps.md`, `instrumentation-guide.md`, `super-properties.md`, `tracking-plan.ts` | `docs/analytics/` |

**Fragmentação a resolver:** existem duas "fontes": `src/lib/analytics.ts` (a viva) e
`docs/analytics/tracking-plan.ts` (doc). O brief exige **fonte única**. Decisão do plano:
`src/lib/analytics.ts` é a fonte; o catálogo e o `tracking-plan.ts` passam a ser **derivados** dela.

---

## 3. Avaliação de confiabilidade (régua dos 7 critérios)

A v1 foi construída para alimentar dashboards, não para ser à prova de duplicação/perda.
Resultado contra a definição operacional de "dado confiável":

| # | Critério | Status | Diagnóstico |
|---|---|---|---|
| 1 | Tipado na origem | 🟡 Parcial | Nome validado em compile-time; **payload é `Record<string, any>`** — não amarrado ao evento. |
| 2 | Validado em runtime | 🔴 Falta | Sem Zod antes de persistir; malformado é gravado. |
| 3 | Idempotente | 🔴 Falta | `id` gerado no **servidor**; sem `event_id` de cliente, sem dedup, sem `ON CONFLICT`. Retry duplica. |
| 4 | Identidade resolvida | 🟡 Parcial | `user_id` confiável (server). Sem `anonymous_id` persistente; **sem religação anônimo→usuário no login**; `session_id` em sessionStorage (reseta por aba, sem timeout de 30 min). |
| 5 | Contexto completo | 🟡 Parcial | Tem sessão/UTM/versão. **Falta rota automática e atributos de corte** (segment/faculdade/estágio); **client_timestamp é descartado** (handler só envia nome+payload). |
| 6 | Sem PII desnecessária | 🟡 Parcial | Sem violação evidente, mas sem guard/allowlist que impeça vazamento. |
| 7 | Resiliente | 🔴 Falta | Handler é `rpc()` fire-and-forget: sem await/retry/batch/fila/`sendBeacon`. Falha de rede = perda silenciosa; 1 request por evento. |
| + | Crítico no servidor | 🔴 Falta | Tudo client-fired; conversão/cancelamento nem existem como eventos. |

Os gaps em `docs/analytics/gaps.md` são quase todos de **cobertura** (e marcados RESOLVED).
Os gaps de **confiabilidade** acima **não** estão endereçados lá — são o foco da Fase 2.

---

## 4. Fluxos de valor priorizados

Jornada: entrar → onboarding → iniciar atividade → responder → concluir → ver resultado →
revisar erro → voltar → converter/cancelar.

### Prioridade ALTA / MÁXIMA

| Fluxo | Por quê | Cobertura atual | Arquivos-chave |
|---|---|---|---|
| **Motor de prova** (criar/iniciar, responder, navegar, integridade, finalizar) | Coração do produto; precisão crítica | Boa, mas a confiabilidade (idempotência/perda) impacta justo aqui | `src/hooks/useExamFlow.ts`, `src/hooks/exam/*`, `useExamStorageReal.ts`, `useFocusControl.ts` |
| **Conversão / assinatura** (gate visto, upsell, upgrade, cancelamento) | Receita; MRR e churn | Mínima (`feature_gate_seen`, `upsell_clicked`); upgrade/cancel **inexistentes** e devem ser **server-side** | `src/components/ProGate.tsx`, segment em `profiles` |
| **Autenticação / entrada** | Conversão fundamental | Boa (login ok/fail) | `src/contexts/AuthContext.tsx` |
| **Onboarding** | Gate de ativação | Boa | `src/pages/OnboardingPage.tsx`, `UserContext` |
| **Resultados / revisão** | Valor imediato pós-prova | Parcial | `src/pages/CorrecaoPage.tsx` |
| **Caderno de erros** (PRO) | Diferenciador de retenção/receita | Boa (v2) | `src/pages/Caderno*`, componentes do caderno |

### Prioridade MÉDIA

| Fluxo | Por quê | Observação |
|---|---|---|
| **Ranking** | Engajamento/retenção | `ranking_viewed` ambíguo em 2 contextos (GAP-12) |
| **Desempenho / comparativo** | Diagnóstico | Cobertura básica |

### Prioridade BAIXA (não agora)

- Telemetria fina de tempo-por-questão (GAP-13): valiosa mas ruidosa; depende de decisão de produto.
- Eventos de sandbox/dev e showcase v3.

---

## 5. Propriedades de contexto globais (alvo)

Toda chamada de captura deve carregar, **automaticamente** (o dev só descreve o que aconteceu):

| Propriedade | Origem | Estado |
|---|---|---|
| `event_id` (UUID cliente, dedup) | gerado no `trackEvent` | **a criar** |
| `client_timestamp` | `trackEvent` | existe no objeto, **mas é descartado** — persistir |
| `server_timestamp` | `now()` no insert | existe (`created_at`) |
| `session_id` (timeout 30 min) | storage | existe parcial — **falta timeout** |
| `anonymous_id` (persistente) | localStorage | **a criar** |
| `user_id` | `auth.uid()` server-side | existe |
| `route` / tela | listener de rota | **a criar** |
| `segment` (guest/standard/pro) | `UserContext` | hoje ad-hoc — **promover a super property** |
| `specialty` / `target_institutions` / estágio do ciclo | `onboarding_profiles` | hoje ad-hoc — **promover a super property** |
| `platform`, `app_version`, `utm_*` | já existentes | manter |

---

## 6. Plano da Fase 2 — endurecimento da fundação (proposto)

Ordem sugerida, **cada item é um commit pequeno**, sem alterar comportamento de produto e
sem quebrar os 64 call-sites:

1. **Tipagem amarrada nome→payload.** Mapa `EventName → PayloadSchema` (tipo + Zod) em
   `src/lib/analytics.ts`. `trackEvent<E>(name, payload)` infere o payload do evento.
   Compatível com chamadas atuais (migração incremental dos call-sites).
2. **Validação de runtime.** Zod valida antes de enfileirar; inválido é rejeitado e logado
   (`logger.error`), nunca gravado pela metade.
3. **Idempotência.** `event_id` UUID no cliente; coluna + **unique constraint**; RPC passa a
   `ON CONFLICT (event_id) DO NOTHING`. Persistir `client_timestamp` e `route`.
4. **Resiliência.** Handler de produção vira fila + envio em lote (RPC batch
   `log_analytics_events(jsonb[])`), com retry/backoff e `flush` via `sendBeacon`/`visibilitychange`.
   A UI nunca espera.
5. **Identidade.** `anonymous_id` persistente; `session_id` com timeout de 30 min; religação
   anônimo→usuário no login (evento `identity_linked` + coluna no insert).
6. **Contexto automático.** Listener de rota (wrapper do `BrowserRouter`) e ligação do
   `AuthProvider/UserProvider` ao `setSuperProperties` (segment, especialidade, instituições).
7. **Captura server-side dos eventos críticos.** Conversão/cancelamento via trigger/Edge Function
   sobre mudança de `profiles.segment` — não confiar no cliente.
8. **Fonte única + catálogo derivado.** Reconciliar `tracking-plan.ts` → derivar de `analytics.ts`;
   gerar catálogo a partir da fonte.
9. **Modo de verificação (QA).** Painel/console estruturado já existe em DEV; estender com inspeção
   "ao vivo" (consumir `analytics_events` recentes) para validar cada fluxo na Fase 3.

**Entregável da Fase 2:** camada passando nos 7 critérios, com evento de teste comprovando
validação ativa, idempotência (retry não duplica) e modo de verificação operante.

---

## 7. O que NÃO instrumentar agora (e por quê)

- **Tempo-por-questão fino** (GAP-13): alto ruído, baixo retorno imediato; depende de decisão de produto.
- **Eventos de sandbox/dev/showcase**: não são produto real.
- **Provider externo (PostHog/Amplitude)**: opcional; só se o time quiser um segundo destino.
- **Dedup por sessão de `correction_viewed`** (ambiguidade B do gaps): decisão de produto pendente.
- **Detecção de fraude a partir de `exam_integrity_event`**: o evento é capturado, mas o uso/política de privacidade é decisão de produto (ambiguidade GAP-08).

---

## 8. Riscos e decisões pendentes para o time

1. **Migração de nomes/propriedades** já normalizados (snake_case): não quebrar dashboards existentes.
2. **Worktree do admin:** mudanças de admin devem respeitar o fluxo `feat/admin-*` (não trabalhar admin fora do worktree).
3. **`exam_integrity_event` e privacidade:** definir política antes de usar como sinal.
4. **`ranking_viewed` ambíguo (GAP-12):** separar em `ranking_page_viewed` / `ranking_modal_opened`?
