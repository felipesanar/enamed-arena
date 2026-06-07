# Caderno de Erros v2 — Pacote de Especificação

Pacote completo pronto para implementação da reformulação do **Caderno de Erros** do SanarFlix PRO Simulados (ENAMED). Reúne a visão estratégica, o contrato técnico canônico, 6 especificações de domínio, o PRD da Fase 1 e o backlog de implementação.

## Como ler (ordem recomendada)

| # | Documento | Para quem | O que é |
|---|---|---|---|
| 🧭 | [`../caderno-de-erros-visao-definitiva.md`](../caderno-de-erros-visao-definitiva.md) | Todos | Visão estratégica: diagnóstico SanarFlix × benchmark Medway, matriz comparativa, feature ideal, inovações, roadmap |
| ⭐ | [`00-contratos-canonicos.md`](00-contratos-canonicos.md) | Eng + Design | **Fonte da verdade** de nomes/enums/eventos/limiares/rotas. Em conflito, vale este doc (inclui §11 Resoluções) |
| 📋 | [`PRD-fase1-mvp.md`](PRD-fase1-mvp.md) | Produto + Eng | Requisitos da Fase 1 (RF-01…), métricas, NFRs, riscos, rollout, Definition of Done |
| 🗂️ | [`backlog-fase1-epicos-historias.md`](backlog-fase1-epicos-historias.md) | Eng + PM | 9 épicos · 52 histórias · 10 tarefas de QA — prontas para o Jira, com critérios de aceite e dependências |
| 01 | [`01-data-model-migration.md`](01-data-model-migration.md) | Backend | Schema: colunas SRS, `review_attempts`, `decks/flashcards`, `answers.confidence`, RLS, RPCs, migração idempotente |
| 02 | [`02-srs-engine.md`](02-srs-engine.md) | Backend | Motor SRS (SM-2-lite) modulado por causa do erro, regra de domínio, leech, RPC `schedule_next_review_guarded` |
| 03 | [`03-active-recall-review-ux.md`](03-active-recall-review-ux.md) | Front + Design | Sessão de recall ativo (re-resolve às cegas + confiança + autoavaliação), estados, atalhos, mobile, a11y |
| 04 | [`04-auto-triage-confidence.md`](04-auto-triage-confidence.md) | Full-stack | Captura de confiança na prova + triagem pós-prova + edge function `classify-exam-errors` + bulk add |
| 05 | [`05-shell-ia-fork-migration.md`](05-shell-ia-fork-migration.md) | Front + Arq | Casca unificada (abas/rotas), `NotebookEntryCard`, e o **plano de migração do fork** (sandbox → produção) |
| 06 | [`06-pattern-engine-telemetry.md`](06-pattern-engine-telemetry.md) | Full-stack + Dados | Motor de padrões / aba Insights (Fase 2) + funil de telemetria completo + métricas de sucesso |

## Decisões de produto travadas

1. **Fork resolvido:** a casca do protótipo `src/sandbox/caderno` (hero-first) torna-se a UI de produção; o motor da produção (sessão de revisão + Prof. San) é re-acoplado. Ver spec 05.
2. **Confiança na origem:** capturada no fluxo de prova (`useExamFlow` + `answers.confidence`) na **Fase 0** — destrava triagem automática e calibração. Ver spec 04.
3. **As 3 alavancas pedagógicas** que superam SanarFlix-hoje e Medway: **recall ativo** (spec 03), **SRS real** (spec 02), **triagem automática** (spec 04). O **motor de padrões** (spec 06) é o diferencial de Fase 2.

## Escopo por fase

- **Fase 0:** migração de schema (01) + captura de confiança (04).
- **Fase 1 (MVP):** casca unificada / aba Revisar (05) + recall ativo (03) + SRS (02) + triagem pós-prova (04) + busca/filtros/lote + paridade mobile + telemetria (06, Parte B). Única edge function nova: `classify-exam-errors`.
- **Fase 2:** Insights / motor de padrões (06) + Flashcards (imagem + IA) + deep-link de aula + abas Favoritos/Anotações + calibração de confiança.
- **Fase 3:** War Room ENAMED + painel de ROI + leech + "simulado do meu caderno" + voz + colaborativo + export.

## Sequência de implementação

A ordem recomendada está no [backlog](backlog-fase1-epicos-historias.md) (grafo de dependências entre épicos). Resumo: **EPIC-0 (schema) → EPIC-0b (confiança) / EPIC-1 (SRS) → EPIC-2 (casca/fork) → EPIC-3 (recall) → EPIC-4 (triagem) → EPIC-5 (busca/lote) / EPIC-6 (mobile) / EPIC-7 (telemetria)**.

## Questões em aberto (não bloqueiam o início)

- **Q1** — origem/atualização da `ENAMED_DATE` por ciclo → dono: Conteúdo/Ops.
- **Q7** — momento de calibrar metas M1–M7 com baseline do beta → dono: Produto/Dados.

Demais divergências de especificação foram resolvidas no contrato canônico ([`00-contratos-canonicos.md`](00-contratos-canonicos.md) §11).
