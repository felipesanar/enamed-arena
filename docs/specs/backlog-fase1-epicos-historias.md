# Backlog Fase 1 (MVP) — Caderno de Erros v2

**Produto:** SanarFlix PRO Simulados (ENAMED)
**Escopo deste documento:** épicos e histórias de usuário da **Fase 1 (MVP)**, prontos para colar no Jira.
**Fonte da verdade de nomes/enums/eventos/limiares:** [`00-contratos-canonicos.md`](00-contratos-canonicos.md). Em qualquer divergência com as specs 01–06, vale o canônico.
**Specs de referência:** `01-data-model-migration.md`, `02-srs-engine.md`, `03-active-recall-review-ux.md`, `04-auto-triage-confidence.md`, `05-shell-ia-fork-migration.md`, `06-pattern-engine-telemetry.md`.
**Data:** Junho/2026

> **Escopo Fase 1 (MVP):** captura de confiança na prova + migração de schema (Fase 0) + casca unificada aba **Revisar** (migração do fork) + **recall ativo** + **motor SRS** + **triagem automática pós-prova** + busca/filtros/ações em lote + paridade mobile + telemetria.
>
> **Fora de escopo (não há histórias aqui):** aba **Insights** (motor de padrões), **Flashcards** (decks/imagem/IA), **Favoritos**, **Anotações** rich-text, **War Room** ENAMED, **ROI**, dashboard de calibração. O *schema* de `decks`/`flashcards` e `caderno_pattern_insights_cache` entra na migração da Fase 0 (criado uma vez), mas **sem UI nem RPC de consumo** na Fase 1.

---

## 1. Visão geral & sequenciamento

### 1.1 Épicos

| Épico | Título | Prioridade | Tamanho |
|---|---|---|---|
| **EPIC-0** | Fundação de dados (migração de schema, RLS, RPCs) | P0 | G |
| **EPIC-0b** | Captura de confiança na prova (upstream `useExamFlow`/`answers`) | P0 | M |
| **EPIC-1** | Motor SRS (RPCs de agendamento, lapso, leech, domínio) | P0 | G |
| **EPIC-2** | Casca unificada & migração do fork (aba Revisar) | P0 | G |
| **EPIC-3** | Recall ativo (sessão de revisão) | P0 | G |
| **EPIC-4** | Triagem automática pós-prova + `classify-exam-errors` + bulk add | P0 | G |
| **EPIC-5** | Busca, filtros, ações em lote, quick actions | P1 | M |
| **EPIC-6** | Paridade mobile | P1 | M |
| **EPIC-7** | Telemetria Fase 1 | P1 | M |

### 1.2 Grafo de dependências entre épicos

```
EPIC-0  (schema + RLS + RPCs)
  ├──► EPIC-0b (confidence depende da coluna answers.confidence)
  ├──► EPIC-1  (SRS depende dos campos srs_* e de review_attempts)
  ├──► EPIC-2  (casca depende de schema só p/ status SRS; UI pode iniciar com fallback legado)
  └──► EPIC-4  (bulk add depende de add_to_notebook_bulk_guarded + answers.confidence)

EPIC-1 (Motor SRS)
  └──► EPIC-3  (recall ativo chama record_review_attempt_guarded + schedule_next_review_guarded)

EPIC-2 (Casca unificada / rotas /caderno*)
  ├──► EPIC-3  (sessão é acionada pelo HeroNextCard da casca; rota /caderno/revisao)
  ├──► EPIC-5  (busca/filtros/lote operam sobre a fila segmentada da casca)
  └──► EPIC-6  (paridade mobile cobre casca + sessão)

EPIC-0b (confiança) ──► EPIC-4 (triagem usa answers.confidence p/ candidatos e heurística)

EPIC-3 + EPIC-4 ──► EPIC-7 (telemetria instrumenta recall, triagem, casca)
```

Resumo das arestas: **EPIC-0 é raiz de tudo.** EPIC-1 depende só de EPIC-0. EPIC-3 depende de EPIC-1 + EPIC-2. EPIC-4 depende de EPIC-0 + EPIC-0b. EPIC-5/6 dependem de EPIC-2 (e EPIC-3 para a parte de sessão). EPIC-7 é transversal e instrumenta o que os demais entregam.

### 1.3 Ordem recomendada por ondas (sprints)

- **Onda A — Fundação (paralelizável internamente):**
  - EPIC-0 (migração SQL idempotente, RLS, esqueleto das RPCs) — bloqueante.
  - EPIC-0b pode começar em paralelo (a UI do slider) e fecha quando `answers.confidence` existir.
- **Onda B — Motor & Casca (em paralelo após Onda A):**
  - EPIC-1 (SRS) — depende só de EPIC-0.
  - EPIC-2 (casca/rotas) — depende de EPIC-0; usa fallback legado de segmentação até SRS estar pronto.
- **Onda C — Experiências de usuário:**
  - EPIC-3 (recall ativo) — precisa de EPIC-1 + EPIC-2.
  - EPIC-4 (triagem) — precisa de EPIC-0 + EPIC-0b; pode rodar em paralelo a EPIC-3.
- **Onda D — Acabamento & medição:**
  - EPIC-5 (busca/filtros/lote) e EPIC-6 (mobile) sobre a casca + sessão já entregues.
  - EPIC-7 (telemetria) instrumenta tudo; fecha por último, mas eventos-chave podem ser adicionados junto de cada história.

> **Feature flag de rollout:** `VITE_CADERNO_NEW_SHELL` (rota paralela `/caderno` vs `/caderno-erros`) e flag por segmento `caderno_v2_enabled` para ativar o motor SRS a um subconjunto de PRO antes do rollout geral (spec 01 §9.3).

---

## 2. Definition of Ready (DoR) & Definition of Done (DoD)

### Definition of Ready (geral)

Uma história está pronta para entrar em sprint quando:
- Tem critérios de aceite testáveis e usa os **nomes canônicos** (RPC `_guarded`, enums `baixa|media|alta` / `errei|dificil|bom|facil`, eventos `caderno_*`, rotas `/caderno*`, componentes `NotebookEntryCard` etc.).
- Dependências de épico/história estão concluídas ou stubadas atrás de feature flag.
- O contrato de dados (coluna/RPC/edge function) referenciado existe no canônico/spec 01.
- Gate PRO (`useHasAccess('cadernoErros')`) e impacto em RLS estão definidos quando aplicável.
- Eventos de analytics relevantes estão nomeados (mesmo que a instrumentação seja história separada em EPIC-7).

### Definition of Done (geral)

Uma história está concluída quando:
- Código revisado, mergeado e atrás de flag quando o canônico exigir transição gradual.
- `npm run lint`, `npm run test` e `npm run build` verdes; testes unitários novos onde o canônico exige (SRS, helpers, migração).
- Sem regressão no fluxo de produção atual (`/caderno-erros` continua funcional durante a transição).
- RPCs novas são `SECURITY DEFINER`, `SET search_path = public`, validam ownership por `auth.uid()` e jamais aceitam `user_id` no payload.
- A11y mínima WCAG AA nos componentes tocados (foco, ARIA roles, contraste, `prefers-reduced-motion`).
- Eventos `caderno_*` adicionados ao union `AnalyticsEventName` em `src/lib/analytics.ts` quando a história dispara telemetria.
- Logging via `logger`, toasts via `@/hooks/use-toast`/`sonner`; nunca `console.log`.

---

## 3. Épicos & Histórias

> Legenda: **Tamanho** P (pequeno) · M (médio) · G (grande). **Prioridade** P0 (bloqueante MVP) · P1 (MVP, não bloqueante do core).

---

### EPIC-0 — Fundação de dados (migração de schema, RLS, RPCs)

**Objetivo:** entregar a migração SQL idempotente que adiciona os campos SRS + confiança + domínio em `error_notebook`, cria `review_attempts`, adiciona `answers.confidence` e `attempt_question_results.ai_suggested_reason`, cria o schema (sem UI) de `decks`/`flashcards`/`caderno_pattern_insights_cache`, aplica RLS e backfills, e expõe os esqueletos das RPCs `_guarded`. É a raiz de todo o pacote.

**Specs de referência:** 01 (todas as seções), 00 (§1 RPCs, §3 colunas, §4 limiares).

#### HU-0.1 — Migração idempotente de `error_notebook` (campos SRS + confiança + domínio)
*História técnica.* Como engenheiro de plataforma, quero adicionar as colunas `srs_ease`, `srs_interval`, `srs_reps`, `srs_lapses`, `srs_due_at`, `confidence_at_answer`, `last_review_outcome`, `mastered_at` a `error_notebook`, para que o motor SRS e a captura de confiança tenham onde persistir.

**Critérios de aceite**
- `ADD COLUMN IF NOT EXISTS` para cada coluna com os defaults canônicos: `srs_ease=2.5`, `srs_interval=1`, `srs_reps=0`, `srs_lapses=0`, `srs_due_at` nullable, `confidence_at_answer` (CHECK `baixa|media|alta`), `last_review_outcome` (CHECK `errei|dificil|bom|facil`... ver nota), `mastered_at` nullable.
- O script é reexecutável sem efeito colateral (idempotente), dentro de `BEGIN/COMMIT`.
- `last_review_outcome` aceita os 4 de self_grade **+** `snoozed|awaiting_lesson|leech_blocked` (00 §2). Ajustar o CHECK ou usá-lo sem CHECK restritivo conforme o conjunto canônico.
- Índices criados: `idx_error_notebook_srs_due`, `idx_error_notebook_mastered`, `idx_error_notebook_leech`.

**Dependências:** nenhuma. **Tamanho:** M. **Prioridade:** P0.

#### HU-0.2 — Backfill de `srs_due_at` e `mastered_at`
*História técnica.* Como engenheiro, quero popular `srs_due_at` e `mastered_at` para entradas existentes, para que a fila e o estado "Dominada" funcionem na transição sem quebrar histórico.

**Critérios de aceite**
- Given entrada com `resolved_at IS NOT NULL`, When backfill roda, Then `srs_due_at = NULL` e `mastered_at = resolved_at`.
- Given entrada com `next_review_at IS NOT NULL` e não resolvida, Then `srs_due_at = next_review_at`.
- Given entrada sem `next_review_at` e sem `resolved_at`, Then `srs_due_at = now()`.
- Backfill só toca linhas com `srs_due_at IS NULL` (idempotente).

**Dependências:** HU-0.1. **Tamanho:** P. **Prioridade:** P0.

#### HU-0.3 — Coluna `answers.confidence` + backfill a partir de `high_confidence`
*História técnica.* Como engenheiro, quero adicionar `answers.confidence` (`baixa|media|alta`, nullable) e backfillar a partir do booleano legado, para suportar a captura trifásica sem remover `high_confidence`.

**Critérios de aceite**
- `ADD COLUMN IF NOT EXISTS confidence text CHECK (confidence IS NULL OR confidence IN ('baixa','media','alta'))`.
- Backfill: `high_confidence = true → 'alta'`; `false/NULL → NULL` (não inferir `'baixa'`/`'media'`).
- `high_confidence` permanece intacto (compatibilidade com `get_user_attempt_behavior_stats`/admin).

**Dependências:** nenhuma (pode rodar em paralelo a HU-0.1). **Tamanho:** P. **Prioridade:** P0.

#### HU-0.4 — Tabela `review_attempts` + índices + RLS
*História técnica.* Como engenheiro, quero criar `review_attempts` (log imutável de re-resoluções) com RLS restrita ao dono e INSERT só via RPC, para registrar o histórico de recall ativo.

**Critérios de aceite**
- Colunas exatas: `id`, `entry_id` (FK `error_notebook` ON DELETE CASCADE), `user_id` (FK `auth.users`), `selected_option_id` (FK `question_options` ON DELETE SET NULL, nullable), `was_correct`, `confidence` (CHECK `baixa|media|alta`), `self_grade` (CHECK `errei|dificil|bom|facil`), `reviewed_at`, `created_at`.
- Índices `idx_review_attempts_entry_id` e `idx_review_attempts_user_id`.
- RLS: SELECT só `auth.uid() = user_id`; INSERT `WITH CHECK (false)` (apenas via RPC `SECURITY DEFINER`); sem policy de UPDATE/DELETE (deny por padrão).

**Dependências:** HU-0.1. **Tamanho:** M. **Prioridade:** P0.

#### HU-0.5 — Coluna `attempt_question_results.ai_suggested_reason`
*História técnica.* Como engenheiro, quero adicionar `ai_suggested_reason text` como cache persistente da triagem, para que reabrir a triagem não re-chame a edge function.

**Critérios de aceite**
- `ADD COLUMN IF NOT EXISTS ai_suggested_reason text NULL`.
- Quando preenchido para todas as candidatas, o cliente não chama `classify-exam-errors` (contrato consumido na EPIC-4).

**Dependências:** nenhuma. **Tamanho:** P. **Prioridade:** P0.

#### HU-0.6 — Schema (sem UI) de `decks`, `flashcards`, `caderno_pattern_insights_cache`
*História técnica.* Como engenheiro, quero criar o schema de Fase 2 (decks/flashcards/cache de insights) já na migração única da Fase 0, para evitar nova migração depois, mantendo o motor SRS compartilhado por design.

**Critérios de aceite**
- Tabelas `decks` e `flashcards` criadas conforme spec 01 §4 (flashcards com os mesmos campos `srs_*`), com índices e RLS de ownership.
- `caderno_pattern_insights_cache` (`user_id`, `payload jsonb`, `generated_at`, `entry_count`) criada com RLS restrita ao próprio usuário.
- **Nenhuma UI, RPC de consumo ou rota** dessas tabelas é entregue na Fase 1 (apenas o DDL).

**Dependências:** HU-0.1. **Tamanho:** M. **Prioridade:** P1.

#### HU-0.7 — Ajuste de `snooze_error_notebook_entry` (override que também grava `srs_due_at`)
*História técnica.* Como engenheiro, quero que a RPC existente `snooze_error_notebook_entry(p_entry_id, p_days)` passe a atualizar **também** `srs_due_at` e setar `last_review_outcome='snoozed'`, sem alterar parâmetros SRS, para que o adiar manual respeite o filtro SRS.

**Critérios de aceite**
- Assinatura pública inalterada (`snooze_error_notebook_entry(p_entry_id uuid, p_days int)`), nome mantido.
- UPDATE grava `next_review_at` (compat) **e** `srs_due_at` = `now() + p_days dias`; seta `last_review_outcome='snoozed'`.
- **Não** altera `srs_ease`, `srs_interval`, `srs_reps`, `srs_lapses` e **não** insere em `review_attempts`.

**Dependências:** HU-0.1. **Tamanho:** P. **Prioridade:** P0.

#### HU-0.8 — Script de rollback documentado
*História técnica.* Como engenheiro, quero um script de rollback aditivo testado, para reverter a migração com segurança caso o rollout precise ser abortado.

**Critérios de aceite**
- `DROP COLUMN IF EXISTS` para colunas novas; `DROP TABLE IF EXISTS` para `review_attempts`/`flashcards`/`decks`/cache; remoção da linha `srs_due_at` da `snooze_error_notebook_entry`.
- Documentado que colunas aditivas com default não quebram o app atual (spec 01 §9).

**Dependências:** HU-0.1..0.7. **Tamanho:** P. **Prioridade:** P1.

---

### EPIC-0b — Captura de confiança na prova (upstream `useExamFlow`/`answers`)

**Objetivo:** capturar a confiança trifásica (`baixa|media|alta`) no momento da resposta dentro do simulado, persistindo em `answers.confidence` pelo mesmo caminho de upsert já existente, de forma opcional e não bloqueante. É a única dependência *upstream* (toca o motor de prova).

**Specs de referência:** 04 §1, 01 §5, 00 §2.

#### HU-0b.1 — Campo `confidence` em `ExamAnswer` e estado do `useExamFlow`
*História técnica.* Como engenheiro, quero adicionar `confidence: 'baixa'|'media'|'alta'|null` em `ExamAnswer` (`src/types/exam.ts`) e um `handleSetConfidence(level)` em `useExamFlow`, para manter o estado de confiança por questão.

**Critérios de aceite**
- `ExamAnswer` ganha `confidence` opcional; `handleSetConfidence` chama `markAnswerDirty` + `updateState` (UI otimista), análogo a `toggleHighConfidence`.
- `high_confidence` continua sendo gravado em paralelo (transição).

**Dependências:** HU-0.3. **Tamanho:** P. **Prioridade:** P0.

#### HU-0b.2 — Persistência de `confidence` no upsert e no fallback `keepalive`
*História técnica.* Como engenheiro, quero incluir `confidence` em `simuladosApi.upsertAnswer`, `bulkUpsertAnswers` e no payload `fetch keepalive` do `beforeunload`, para que a confiança persista junto das demais colunas.

**Critérios de aceite**
- As três rotas de escrita incluem `confidence: ans.confidence ?? null`.
- Reusa o debounce de 2s e o `on_conflict=attempt_id,question_id merge-duplicates` existentes.
- Em `beforeunload`, o objeto `rows` inclui `confidence`.

**Dependências:** HU-0b.1, HU-0.3. **Tamanho:** M. **Prioridade:** P0.

#### HU-0b.3 — Seletor de confiança inline na questão (UI)
Como aluno em prova, quero marcar minha confiança ("Chute / Parcial / Tenho certeza") logo após escolher uma alternativa, para que o caderno personalize minha revisão sem me atrapalhar.

**Critérios de aceite**
- O seletor (3 chips) só aparece após uma alternativa estar selecionada; nunca em questões em branco.
- Microcopy: rótulo "Quão certo você está?"; chips "Chute" (baixa) / "Parcial" (media) / "Tenho certeza" (alta); tooltip "Sua certeza ajuda a personalizar o caderno de erros".
- É **opcional**: o aluno avança com `→` sem interagir; trocar de alternativa **não** reseta a confiança.
- A captura é não bloqueante e não afeta o timer.

**Dependências:** HU-0b.1. **Tamanho:** M. **Prioridade:** P0.

#### HU-0b.4 — Atalhos `1/2/3` para confiança sem colisão com `1-5` de alternativas
*História técnica.* Como aluno, quero usar `1/2/3` para definir confiança após marcar a alternativa, para acelerar o fluxo por teclado sem ambiguidade.

**Critérios de aceite**
- `1-5` continuam mapeando alternativas; `1/2/3` só agem na confiança quando `selectedOption !== null` (handler de menor prioridade, naturalmente sequencial).
- Sem disparo quando foco está em input/textarea.

**Dependências:** HU-0b.3. **Tamanho:** P. **Prioridade:** P1.

#### HU-0b.5 — Comportamento gracioso para simulados antigos (confiança ausente)
Como aluno com simulados antigos, quero que a ausência de confiança não gere comportamento incorreto, para que entradas legadas sejam tratadas como "desconhecida".

**Critérios de aceite**
- `confidence = null` é "desconhecida": acertos sem confiança **não** viram `guessed_correctly` automaticamente.
- Sem badge de confiança quando o valor é nulo (UI tolera ausência).

**Dependências:** HU-0b.1. **Tamanho:** P. **Prioridade:** P1.

---

### EPIC-1 — Motor SRS

**Objetivo:** implementar o SM-2-lite via RPCs `SECURITY DEFINER`, modulado por causa do erro, com confiança influenciando reps/domínio, lapso/leech e domínio automático (`mastered_at`). O cliente nunca calcula SRS.

**Specs de referência:** 02 (todas), 01 §7, 00 §1/§4.

#### HU-1.1 — RPC `schedule_next_review_guarded` (núcleo SM-2-lite)
*História técnica.* Como engenheiro, quero a RPC `schedule_next_review_guarded(p_entry_id uuid, p_outcome text, p_confidence text) → jsonb`, para aplicar o algoritmo após cada revisão e devolver o estado SRS atualizado.

**Critérios de aceite**
- Assinatura canônica `(p_entry_id, p_outcome, p_confidence)` (00 §1); valida ownership por `auth.uid()` e enums (`outcome ∈ errei|dificil|bom|facil`, `confidence ∈ baixa|media|alta`).
- Mapeia outcome→q (`errei=0, dificil=2, bom=3, facil=4`); aplica Δease = `0.1 - (4-q)*(0.08+(4-q)*0.02)`, clamp ease ≥ 1.3.
- Intervalos: reps 0→1 = 1d, 1→2 = 4d, ≥2 = `ROUND(interval*ease)`; lapso → `interval = MAX(1, ROUND(interval*0.20))`, `reps=0`, `lapses+1`, `ease-0.20`.
- `srs_due_at = now() + interval`; retorna jsonb `{srs_due_at, srs_interval, srs_reps, srs_ease, mastered, is_leech}` (+ `review_hint`).
- Override de confiança `baixa`: se `confidence='baixa'` e q>2, trata como q=2 (Difícil).

**Dependências:** HU-0.1, HU-0.4. **Tamanho:** G. **Prioridade:** P0.

#### HU-1.2 — Modulação por causa do erro (ease inicial + curvas especiais)
*História técnica.* Como engenheiro, quero modular o SRS por `reason`, para refletir a estratégia pedagógica de cada causa.

**Critérios de aceite**
- Ease inicial (reps=0): `did_not_know=2.1`, `guessed_correctly=2.1`, `confused_alternatives=2.3`, `reading_error=2.8`, demais/`did_not_understand`=2.5.
- `reading_error`: intervalos reps 1=2d, 2=6d; `srs_due_at` inicial na meia-noite local do dia seguinte.
- `did_not_know`: entrada nasce `last_review_outcome='awaiting_lesson'` (bloqueada até aula/declaração); RPC rejeita revisão enquanto bloqueada.
- `guessed_correctly`: promoção a Memória (ease ≥ 2.5) quando `reps>=2` e últimas 2 confianças `>= media`.

**Dependências:** HU-1.1. **Tamanho:** M. **Prioridade:** P0.

#### HU-1.3 — Domínio automático (`mastered_at`) e recaída
*História técnica.* Como engenheiro, quero setar `mastered_at` pelas condições canônicas e revertê-lo em lapso, para que "Dominada" emerja do SRS e não seja autodeclarada.

**Critérios de aceite**
- Seta `mastered_at` quando: `srs_reps>=3` E `srs_interval>=21` E confiança das 2 últimas `>= media` E `last_review_outcome ∈ (bom,facil)` E sem lapso na sequência atual E (`reason ∉ {did_not_know, guessed_correctly}` OU promoção de Chute atingida).
- Lapso (`was_correct=false` OU `outcome='errei'`) → `mastered_at = NULL`, `reps=0`.
- Verificação das condições B/C/D lê os 2 últimos `review_attempts` da entrada.

**Dependências:** HU-1.1, HU-1.2. **Tamanho:** M. **Prioridade:** P0.

#### HU-1.4 — Leech e RPC `reset_leech_guarded`
*História técnica.* Como engenheiro, quero bloquear entradas com `srs_lapses >= 4` (leech) e oferecer `reset_leech_guarded(p_entry_id) → void`, para forçar intervenção pedagógica antes de novo re-teste.

**Critérios de aceite**
- Ao atingir `srs_lapses>=4`, `last_review_outcome='leech_blocked'`; `schedule_next_review_guarded` rejeita com erro `LEECH_INTERVENTION_REQUIRED`.
- `is_leech` é derivado (`srs_lapses >= 4`), sem coluna física (índice parcial já criado em EPIC-0).
- `reset_leech_guarded`: valida ownership; mantém `srs_lapses`; seta `srs_interval=1`, `srs_ease=1.3`, `srs_reps=0`, `last_review_outcome=NULL`.

**Dependências:** HU-1.1. **Tamanho:** M. **Prioridade:** P0.

#### HU-1.5 — RPC `record_review_attempt_guarded` (registro da re-resolução)
*História técnica.* Como engenheiro, quero `record_review_attempt_guarded(p_entry_id, p_selected_option_id, p_was_correct, p_confidence, p_self_grade) → uuid`, para registrar a re-resolução em `review_attempts`; o cálculo SRS é feito em seguida, numa chamada separada a `schedule_next_review_guarded`.

**Critérios de aceite**
- Valida ownership e enums; aceita `p_selected_option_id` NULL (timeout/saída).
- Insere em `review_attempts` e retorna o id do attempt (uuid, canônico 00 §1). **NÃO** calcula SRS — isso é responsabilidade de `schedule_next_review_guarded`, chamado em seguida pelo cliente. O registro pode ser otimista/não-bloqueante para não somar latência ao loop de recall.

**Dependências:** HU-1.1, HU-0.4. **Tamanho:** M. **Prioridade:** P0.

#### HU-1.6 — Parâmetros SRS configuráveis
*História técnica.* Como engenheiro, quero extrair os limiares (ease por causa, `LEECH_THRESHOLD`, `MASTERY_MIN_REPS=3`, `MASTERY_MIN_INTERVAL=21`, etc.) para constantes nomeadas ou tabela `srs_config`, para ajustar sem re-deploy.

**Critérios de aceite**
- Todos os parâmetros do Apêndice da spec 02 nomeados num único ponto.
- Mudança de parâmetro não exige alterar a lógica da RPC.

**Dependências:** HU-1.1. **Tamanho:** P. **Prioridade:** P1.

---

### EPIC-2 — Casca unificada & migração do fork (aba Revisar)

**Objetivo:** resolver o fork produção × sandbox — casca visual do sandbox + motor da produção — entregando a página `CadernoPage` com abas (só **Revisar** funcional na Fase 1), rotas `/caderno*` com aliases, `NotebookEntryCard` unificado, fila segmentada, hero com countdown ENAMED e estados de página, eliminando os anti-padrões Medway.

**Specs de referência:** 05 (todas), 00 §6/§7/§9.

#### HU-2.1 — Tipo unificado `NotebookEntry`
*História técnica.* Como engenheiro, quero um `NotebookEntry` canônico em `src/types/index.ts` (`reason: DbReason`, `addedAt`, `learningNote`, campos SRS, `resolvedAt`), para eliminar a divergência de tipos do fork.

**Critérios de aceite**
- Tipo único; componentes migrados importam de `@/types`.
- `errorTypes.ts` do sandbox marcado para deleção; fonte da verdade é `src/lib/errorNotebookReasons.ts` (`DbReason`, `getReasonMeta`).

**Dependências:** nenhuma. **Tamanho:** P. **Prioridade:** P0.

#### HU-2.2 — Rotas `/caderno*`, aliases e gate PRO
*História técnica.* Como engenheiro, quero registrar `/caderno` (default Revisar) e `/caderno/revisao` com gate PRO, mantendo `/caderno-erros*` como `Navigate` de retrocompatibilidade, para migrar sem quebrar deep-links.

**Critérios de aceite**
- `/caderno` → `CadernoPage`; `/caderno/revisao` → `CadernoRevisaoPage`; abas Fase 2 (`/caderno/favoritos|anotacoes|flashcards|insights`) existem como rota porém **disabled + badge "Em breve"**.
- `/caderno-erros` e `/caderno-erros/revisao` redirecionam via `<Navigate replace>`.
- Gate PRO (`SEGMENT_ACCESS[segment].cadernoErros` / `<ProGate feature="cadernoErros">`) em todas as sub-rotas; nenhuma bypassa.
- `SidebarProSection` e `MobileBottomNav` apontam para `/caderno` (label "Caderno").

**Dependências:** HU-2.1. **Tamanho:** M. **Prioridade:** P0.

#### HU-2.3 — `TabBar` do caderno (labels fixos)
Como aluno PRO, quero abas com URL própria e nomes consistentes, para navegar sem o anti-padrão de modal sem URL (Medway m1).

**Critérios de aceite**
- Labels fixos: **Revisar · Favoritos · Anotações · Flashcards · Insights** (sem variação entre telas).
- `<NavLink>` com URL própria; abas Fase 2 `disabled` + badge "Em breve".

**Dependências:** HU-2.2. **Tamanho:** P. **Prioridade:** P0.

#### HU-2.4 — `PageHero` unificado com countdown ENAMED
Como aluno PRO, quero um hero com progresso, streak, contagens e "Faltam N dias para o ENAMED", para entender meu estado de revisão num relance.

**Critérios de aceite**
- Funde visual do sandbox (grid de stats + ProgressBar) com countdown da produção; tokens migrados para Tailwind/design system (`wine` etc.).
- `ENAMED_DATE` em `src/lib/constants.ts`; linha de countdown some quando `N <= 0`.
- Mostra total "N questões · M especialidades", pendentes e resolvidas.

**Dependências:** HU-2.2. **Tamanho:** M. **Prioridade:** P0.

#### HU-2.5 — `HeroNextCard` "Para revisar agora"
Como aluno PRO, quero um card destacado com as questões devidas hoje e CTA para iniciar a sessão, para começar a revisar com um clique.

**Critérios de aceite**
- Aparece quando há entradas devidas; mostra Q/área/tema, causa, nota do aluno e contagem.
- CTA varia: 1 questão → "Revisar esta questão"; 2–5 → "Iniciar sessão (N)"; >5 → "Iniciar sessão (N questões para hoje)".
- Clique navega para `/caderno/revisao` (modo `due` por padrão).

**Dependências:** HU-2.4. **Tamanho:** M. **Prioridade:** P0.

#### HU-2.6 — `NotebookEntryCard` unificado
Como aluno PRO, quero um card de entrada padronizado (barra de cor por causa, badge com label, preview expansível, resposta×correta, status SRS, ações de rodapé), para escanear e agir sem inconsistências.

**Critérios de aceite**
- Substitui `QueueRow` (produção) e `EntryCard` (sandbox); usado em todas as abas.
- Barra de cor e badge via `getReasonMeta(entry.reason)`; badge **sempre com label** (anti m13).
- Preview de 2 linhas com "ver mais" inline (sem modal); status SRS textual ("volta em 3d"/"devida hoje"/"dominada") com cor semântica.
- Rodapé: [Revisar] → `/caderno/revisao?entry={id}`; [⋯] com "Editar anotação" e "Remover"; toda ação de ícone com tooltip/`aria-label`.
- `NotebookEntryCardSkeleton` para loading (anti m14).

**Dependências:** HU-2.1. **Tamanho:** G. **Prioridade:** P0.

#### HU-2.7 — Fila segmentada (Devidas hoje / Em aprendizado / Agendadas / Dominadas)
Como aluno PRO, quero a lista dividida por estado de revisão com contagem por seção, para priorizar o que está devido.

**Critérios de aceite**
- Seções e critérios: Devidas (`srs_due_at <= fim do dia local` e não dominada), Em aprendizado (`srs_reps>=1` e `srs_due_at>now` e `interval<=14`), Agendadas (`srs_due_at>now` e `interval>14`), Dominadas (`mastered_at IS NOT NULL`, colapsável).
- **Fallback Fase 1** quando colunas SRS ainda não estiverem em uso: Devidas = `next_review_at <= now OR NULL`, Agendadas = `next_review_at > now`, Dominadas = `resolved_at IS NOT NULL` (transição transparente para a UI).
- Cada seção exibe contagem no cabeçalho (anti m11); "devida hoje" usa fim do dia em `America/Sao_Paulo`.

**Dependências:** HU-2.6, (SRS de EPIC-1 para o critério final). **Tamanho:** M. **Prioridade:** P0.

#### HU-2.8 — Estados de página (loading, erro, vazio, zero pendentes, filtro vazio)
Como aluno PRO, quero estados claros para cada situação, para nunca ver tela ambígua ou flash de "vazio".

**Critérios de aceite**
- `CadernoSkeleton` no fetch inicial; `EmptyState variant="error"` em erro; `EmptyState` "Seu Caderno está vazio" + CTA simulados quando nunca adicionou.
- `ZeroPendingState` "Caderno zerado 🎯" com próxima data devida e streak quando há entradas mas nenhuma devida/em aprendizado.
- Filtro sem resultado: mensagem + "Limpar filtros"; nunca vazio silencioso (anti m2).
- O estado "Vazio" não aparece durante o primeiro carregamento.

**Dependências:** HU-2.4, HU-2.7. **Tamanho:** M. **Prioridade:** P0.

#### HU-2.9 — Conectar casca a dados reais (substituir mocks do sandbox)
*História técnica.* Como engenheiro, quero trocar `MOCK_ENTRIES`/`useNotebookEntries` do sandbox por `simuladosApi.getErrorNotebook` via React Query, optimistic updates em resolver/remover e toasts de produção, para que a casca opere sobre o backend real.

**Critérios de aceite**
- React Query (`['notebook', userId]`, staleTime 5min) substitui o mock; `toggleResolvedEntry`/`deleteErrorNotebookEntry` com optimistic update.
- Toasts via `@/hooks/use-toast`/`sonner`; `useNotebookStreak` migrado de `useReviewStreak` com dados reais.

**Dependências:** HU-2.1, HU-2.6. **Tamanho:** M. **Prioridade:** P0.

#### HU-2.10 — `AddToNotebookModal` aprimorado (visual do sandbox + API de produção)
*História técnica.* Como engenheiro, quero manter o modal de produção (API real) e incorporar os subcomponentes visuais do sandbox (`ReasonCard`, `StepIndicator`, `DuplicateBanner`), para um editor único e consistente (anti m3).

**Critérios de aceite**
- Modal de 2 passos (motivo → nota), botão "Salvar" sempre visível no viewport (inclusive mobile), dica "Esc para fechar".
- Detecção de duplicata e toasts de sucesso preservados; `LocalReason`/`ErrorTypeKey` mapeiam para `DbReason` antes de persistir.

**Dependências:** HU-2.1. **Tamanho:** M. **Prioridade:** P1.

#### HU-2.11 — Atualizar links internos e deletar arquivos do sandbox
*História técnica.* Como engenheiro, quero atualizar todos os hardcodes `/caderno-erros` → `/caderno` e deletar os arquivos do fork marcados para DROP após validação, para concluir a migração sem débito.

**Critérios de aceite**
- Links em `CadernoRevisaoPage`, `SessionSummary`, `SidebarProSection` atualizados; nomes de eventos analytics não são renomeados (append-only).
- Arquivos sandbox de DROP removidos (exceto `CadernoSandboxPage.tsx`) após QA em staging; ordem de execução segura da spec 05 §5.8 seguida (rota paralela / flag).

**Dependências:** HU-2.2..2.10. **Tamanho:** M. **Prioridade:** P1.

---

### EPIC-3 — Recall ativo (sessão de revisão)

**Objetivo:** redesenhar `CadernoRevisaoPage` como FSM de 5 fases (responder às cegas → confiança → revelar+Prof. San → autoavaliação → SRS agenda), removendo "Já dominei" e o snooze 1/3/7 manual, integrando `record_review_attempt_guarded` e `schedule_next_review_guarded`.

**Specs de referência:** 03 (todas), 02 §7, 00 §1.

#### HU-3.1 — Hook `useActiveRecallSession` (FSM + fila)
*História técnica.* Como engenheiro, quero `useActiveRecallSession` que carrega a fila (`srs_due_at <= now` e não resolvida, ordenada por devida mais antiga e `srs_ease` asc), gerencia `currentIndex`/`phase`/`selectedOptionId`/`confidence`/`selfGrade` e coordena as RPCs, para orquestrar a sessão sem reusar `useExamFlow`.

**Critérios de aceite**
- Fases `answering | confidence | revealed | self_grade` (+ transição); `useExamFlow` **não** é reusado (sem timer/fullscreen).
- Modo `due` (padrão) vs `all` por query param; ordenação canônica.
- `record_review_attempt_guarded` é fire-and-forget na revelação; `schedule_next_review_guarded` bloqueia a transição (spinner; timeout 3s avança com aviso).

**Dependências:** EPIC-1 (HU-1.1, HU-1.5), HU-2.2. **Tamanho:** G. **Prioridade:** P0.

#### HU-3.2 — `RecallQuestionCard` (gabarito oculto até revelar)
Como aluno PRO, quero ver enunciado e alternativas neutras e responder às cegas, para praticar recall ativo de verdade.

**Critérios de aceite**
- Prop `revealCorrect: boolean`; com `false`, todas as alternativas neutras (sem cor/gabarito) e nenhum badge "sua resposta anterior".
- Com `true`, destaca correta (success) / escolhida errada (destructive) e exibe racionais por alternativa (`ai_option_rationales`).
- O `correctOptionId` não é exibido antes da Fase 3 mesmo que retornado pela query.

**Dependências:** HU-3.1. **Tamanho:** M. **Prioridade:** P0.

#### HU-3.3 — `ConfidenceSelector` (Fase 2)
Como aluno PRO, quero marcar confiança (Baixa/Média/Alta) antes de ver o gabarito, para alimentar o SRS honestamente.

**Critérios de aceite**
- Aparece em `phase==='confidence'` após seleção; atalhos `1/2/3`; microcopy "Seja honesto — isso ajusta sua agenda de revisão.".
- Selecionar avança automaticamente para revelação; `role="radiogroup"` com `aria-label`.

**Dependências:** HU-3.1. **Tamanho:** P. **Prioridade:** P0.

#### HU-3.4 — Revelação + integração do Prof. San (Fase 3)
Como aluno PRO, quero ver a correção e a análise do Prof. San após responder, para entender o erro.

**Critérios de aceite**
- Revelação imediata no cliente (não aguarda RPC); `record_review_attempt_guarded` disparado ao confirmar confiança.
- Bloco do Prof. San (`ai_review_md`, 3 blocos + CTA "Treinar N questões de {tema}"); skeleton "Prof. San pensando…" com `aria-live` enquanto gera; chat existente (limite 10/entrada, `Esc` fecha).

**Dependências:** HU-3.2, HU-3.3. **Tamanho:** M. **Prioridade:** P0.

#### HU-3.5 — `SelfGradeSelector` (Fase 4) e agendamento SRS (Fase 5)
Como aluno PRO, quero autoavaliar (Errei/Difícil/Bom/Fácil) e ter a próxima revisão agendada automaticamente, para que o domínio emerja do SRS.

**Critérios de aceite**
- 4 botões com subtítulos; "Fácil" desabilitado quando `was_correct===false` (tooltip "Só disponível quando você acerta"); atalhos `1-4`.
- Ao avaliar, chama `schedule_next_review_guarded(entry_id, outcome: self_grade, confidence)`; entrada sai da fila (otimista).
- Se `mastered`: toast "Dominada! Q{n} sai da fila por um bom tempo." + incremento animado; se não, sem toast.

**Dependências:** HU-3.1, HU-3.4, EPIC-1. **Tamanho:** M. **Prioridade:** P0.

#### HU-3.6 — Remover "Já dominei" e snooze 1/3/7 manual; `useRecallKeyboard`
*História técnica.* Como engenheiro, quero o mapa de teclado sem colisão (A–E na Fase 1; 1–3 na Fase 2; 1–4 na Fase 4; ←→; R) e remover "Já dominei" (D) e o dropdown de snooze 1/3/7, mantendo "Adiar manualmente" só no menu "...".

**Critérios de aceite**
- `useRecallKeyboard` verifica `currentPhase` e foco antes de agir; `D` passa a marcar alternativa; `J` removido.
- "Adiar manualmente" continua via `snooze_error_notebook_entry` (override) no menu "...".
- Legenda de atalhos dinâmica no rodapé (desktop).

**Dependências:** HU-3.1. **Tamanho:** M. **Prioridade:** P0.

#### HU-3.7 — `SessionSummary` revisado (`scheduled`, `nextDueDate`)
Como aluno PRO, quero um resumo com dominadas/agendadas/restantes/tempo, top-3 áreas e próxima data devida, para fechar a sessão com clareza.

**Critérios de aceite**
- `snoozed` renomeado para `scheduled`; adiciona `nextDueDate`.
- Exibe estatísticas locais da sessão: dominadas, agendadas, restantes, tempo total e top-áreas — sem chamada a edge functions externas.
- CTAs: "Treinar mais um simulado →", "← Voltar ao caderno", e "Continuar revisão (N restantes)" quando aplicável.
- **[Fase 2]** Bloco de insight do Prof. San (edge function `gemini-caderno-session-insight`, falha silenciosa) — fora do escopo da Fase 1.

**Dependências:** HU-3.1. **Tamanho:** M. **Prioridade:** P1.

#### HU-3.8 — Estados da sessão (loading, vazio, zero pendentes, filtro vazio, erro)
Como aluno PRO, quero estados consistentes na sessão, para nunca ficar perdido.

**Critérios de aceite**
- `SkeletonCard` no load; `EmptyState`/`ZeroPendingState`/filtro vazio/erro conforme spec 03 §6; "Próxima revisão" calculada do menor `srs_due_at` entre não dominadas.

**Dependências:** HU-3.1. **Tamanho:** P. **Prioridade:** P1.

---

### EPIC-4 — Triagem automática pós-prova + `classify-exam-errors` + `add_to_notebook_bulk_guarded`

**Objetivo:** após o `finalize`, exibir a tela "Transforme seus erros em plano de estudo" (`/simulados/:id/triagem`, PRO-only) com candidatos pré-classificados pela IA (ou heurística), permitindo confirmar/ajustar em lote (1 toque) e adicionar tudo via `add_to_notebook_bulk_guarded`, eliminando o atrito de adição (G3).

**Specs de referência:** 04 (todas), 01 §7.3, 00 §1/§4/§8.

#### HU-4.1 — RPC `add_to_notebook_bulk_guarded`
*História técnica.* Como engenheiro, quero `add_to_notebook_bulk_guarded(p_entries jsonb) → jsonb {added, skipped}`, idempotente por `(user_id, question_id)`, para inserir várias entradas numa transação sem duplicar.

**Critérios de aceite**
- `user_id = auth.uid()` sempre (nunca aceito no payload); valida `reason` via cast `::error_reason`; trunca `question_text` (500) e `learning_text` (300).
- Idempotência: duplicata ativa → `skipped`; soft-deletada → ressuscita e atualiza `reason` → `added`.
- Limite de **100** entradas por chamada (00 §4); SRS defaults na inserção (`srs_due_at = now()`).
- Copia `confidence_at_answer` quando presente e válido.

**Dependências:** HU-0.1. **Tamanho:** M. **Prioridade:** P0.

#### HU-4.2 — Edge function `classify-exam-errors`
*História técnica.* Como engenheiro, quero a edge function `classify-exam-errors` (Prof. Sanor, batch 15, `temperature 0.3`, structured output), para pré-classificar os candidatos em `DbReason` com racional curto.

**Critérios de aceite**
- Input `{ attemptId, questions[] }` (enunciado ≤600, explicação ≤400, sem dados pessoais do aluno); output `{ classifications[], partial }` com `suggestedReason ∈ DbReason`, `rationale` (≤20 palavras, sem travessão), `aiCertainty` (`'alta'|'baixa'`, certeza da própria classificação ≠ confiança do aluno).
- **Nunca** retorna `did_not_understand`; batches sequenciais de 15; reusa `stripEmDashes`/`stripOpeningCompliments`.
- Tratamento de timeout (25s)/429/502 → `partial:true`; cliente cai na heurística silenciosamente.

**Dependências:** HU-0.5. **Tamanho:** G. **Prioridade:** P0.

#### HU-4.3 — Heurística de fallback (sem IA)
*História técnica.* Como engenheiro, quero `heuristicReason(input)` determinística, para sugerir um motivo plausível quando a IA estiver indisponível ou para simulados antigos.

**Critérios de aceite**
- Ordem de regras: acerto+`baixa`→`guessed_correctly`; erro+`alta`→`confused_alternatives`; alternativas adjacentes→`confused_alternatives`; em branco→`did_not_know`; residual→`did_not_know`.
- Usada imediatamente nos cards enquanto a IA carrega e quando `partial:true`.

**Dependências:** nenhuma (lib cliente). **Tamanho:** P. **Prioridade:** P0.

#### HU-4.4 — `TriagemPage` e rota `/simulados/:id/triagem` (PRO-only)
Como aluno PRO, quero ver minhas questões candidatas logo após finalizar a prova, pré-classificadas, para transformar erros em plano de estudo sem atrito.

**Critérios de aceite**
- `finalize()` navega PRO → `/simulados/:id/triagem`; não-PRO → `/simulados/:id/resultado` (comportamento atual preservado).
- Candidatos: errou e respondeu; acertou com `confidence='baixa'`; marcou com `baixa` confiança; em branco **não** é candidato. Ordenação por `question_number`.
- Carrega candidatos e duplicatas em paralelo à classificação; cards aparecem com heurística e atualizam quando a IA chega (não bloqueia).
- "Agora não — ver resultado" navega direto sem chamada ao banco.

**Dependências:** HU-4.1, HU-4.2, HU-4.3, HU-0b.2. **Tamanho:** G. **Prioridade:** P0.

#### HU-4.5 — Confirmação/ajuste em lote + add em lote
Como aluno PRO, quero ajustar o motivo de cada candidata com 1 toque e adicionar todas as selecionadas de uma vez, para montar o caderno em segundos.

**Critérios de aceite**
- Todos selecionados por padrão; chip de motivo abre seletor inline (5 motivos), marca "editado por você" vs "IA"; "Pular" como link discreto.
- Questões já no caderno mostram badge "Já no caderno · [motivo]" (carregadas via `getErrorNotebook` filtrado por `simulado_id`).
- "Adicionar X ao caderno" chama `addToNotebookBulk`; toast com `added`/`skipped` ("3 adicionadas, 1 já existia") e navega ao resultado; erro → toast destrutivo com retry, sem navegar.

**Dependências:** HU-4.4, HU-4.1. **Tamanho:** M. **Prioridade:** P0.

#### HU-4.6 — Cache de classificação em `ai_suggested_reason`
*História técnica.* Como engenheiro, quero persistir a classificação em `attempt_question_results.ai_suggested_reason` e respeitá-la, para não re-chamar a IA ao reabrir a triagem.

**Critérios de aceite**
- Se todas as candidatas têm `ai_suggested_reason`, a edge function não é chamada.
- React Query cacheia por 5min no cliente; gravação persistente após classificação.

**Dependências:** HU-4.2, HU-0.5. **Tamanho:** P. **Prioridade:** P1.

#### HU-4.7 — Método `simuladosApi.addToNotebookBulk`
*História técnica.* Como engenheiro, quero `simuladosApi.addToNotebookBulk(entries)` chamando a RPC e tratando erro, sem alterar o `addToErrorNotebook` individual existente.

**Critérios de aceite**
- Novo método retorna `{ added, skipped }`; `addToErrorNotebook` (modal individual) permanece intacto e coexiste.

**Dependências:** HU-4.1. **Tamanho:** P. **Prioridade:** P0.

---

### EPIC-5 — Busca, filtros combináveis, ações em lote, quick actions

**Objetivo:** entregar busca textual, filtros combináveis (causa + área) com estado ativo sempre visível, quick actions no card e confirmação/undo + toasts, corrigindo as lacunas G4/G7 e os anti-padrões Medway m2/m4/m5.

**Specs de referência:** 05 §3/§6, 00 §7.

#### HU-5.1 — Busca textual no caderno
Como aluno PRO, quero buscar por questão, área ou simulado, para achar entradas rapidamente quando o caderno cresce.

**Critérios de aceite**
- Input "Buscar" com placeholder "Questão, área ou simulado…"; filtra a fila por texto (case-insensitive) combinando com filtros ativos.
- Sem resultado → mensagem + "Limpar filtros".

**Dependências:** HU-2.7. **Tamanho:** M. **Prioridade:** P1.

#### HU-5.2 — `FilterBar` combinável com estado ativo visível
Como aluno PRO, quero filtros por Causa e Área com estado ativo claro, para refinar a lista sem ambiguidade (anti m2/m6).

**Critérios de aceite**
- Faixa "Causa" (chips com contagem) e faixa "Área" (quando >1); labels fixos "Causa"/"Área".
- `FilterChip` com `aria-checked` + cor ativa + ícone de check; filtros combinam entre si e com a busca; "Limpar filtros" reseta para `all`.

**Dependências:** HU-2.6. **Tamanho:** M. **Prioridade:** P1.

#### HU-5.3 — Quick actions no card + confirmação/undo + toasts
Como aluno PRO, quero ações rápidas no card (Revisar, Editar anotação, Remover) com confirmação e desfazer, para gerenciar entradas com segurança (anti m4/m5).

**Critérios de aceite**
- Remover → optimistic update → toast com `ToastAction "Desfazer"` (5s) → persiste só após timeout.
- Toda mutação emite toast (salvar, dominar, reabrir, agendar/adiar, remover, erro de rede com retry).
- Ícones com tooltip/`aria-label`; atalhos exibidos no tooltip.

**Dependências:** HU-2.6, HU-2.9. **Tamanho:** M. **Prioridade:** P1.

#### HU-5.4 — Ações em lote na lista
Como aluno PRO, quero selecionar várias entradas e agir em lote (ex.: remover, agendar/adiar), para organizar o caderno em massa.

**Critérios de aceite**
- Seleção múltipla com contagem; ações em lote disparam toasts agregados e undo quando aplicável.
- Reusa `snooze_error_notebook_entry`/`deleteErrorNotebookEntry` por item; sem cálculo SRS no cliente.

**Dependências:** HU-5.3. **Tamanho:** M. **Prioridade:** P1.

---

### EPIC-6 — Paridade mobile

**Objetivo:** garantir que casca e sessão de recall funcionem plenamente em mobile (G8): fila em bottom sheet, action bar por fase, gestos de swipe, enunciado longo rolável e a11y mobile.

**Specs de referência:** 03 §7, 03 §10.

#### HU-6.1 — Fila da sessão em bottom sheet (mobile)
Como aluno PRO no celular, quero abrir a fila da sessão num bottom sheet, para navegar entre questões sem o painel lateral desktop.

**Critérios de aceite**
- `< lg`: botão "Lista ▾" no header abre `Sheet` (side="bottom", ~60vh) com o conteúdo do `SessionPanel`; `lg+` mantém painel lateral sticky.
- FocusTrap do Sheet; foco gerido ao abrir/fechar.

**Dependências:** HU-3.1. **Tamanho:** M. **Prioridade:** P1.

#### HU-6.2 — Action bar mobile por fase
Como aluno PRO no celular, quero uma barra de ação que muda por fase, para responder/confirmar com o polegar.

**Critérios de aceite**
- CTA principal por fase (Fase 1 desabilitado → "Confirmar resposta"; Fase 2 = 3 botões de confiança; Fase 4 = grid 2×2 de autoavaliação); [← Ant], [🗑], [Pular →] acessíveis.

**Dependências:** HU-3.1, HU-3.3, HU-3.5. **Tamanho:** M. **Prioridade:** P1.

#### HU-6.3 — Gestos de swipe e enunciado longo rolável
Como aluno PRO no celular, quero navegar por swipe e rolar enunciados longos sem perder a action bar.

**Critérios de aceite**
- Swipe direita → próxima (Fase 1); swipe esquerda → anterior; threshold 60px horizontal / 30px vertical máx.
- Card da questão com `max-h-[50vh] overflow-y-auto` no mobile; desktop rola a página.
- `prefers-reduced-motion`: swipe funciona sem animação de deslize.

**Dependências:** HU-3.1. **Tamanho:** M. **Prioridade:** P1.

#### HU-6.4 — A11y mobile da casca e da sessão
*História técnica.* Como engenheiro, quero garantir foco, ARIA e contraste WCAG AA em mobile, para que o fluxo seja completável por teclado/leitor de tela.

**Critérios de aceite**
- Radiogroups (alternativas/confiança/autoavaliação) com setas + atalhos; `role`/`aria-label` conforme spec 03 §10.3; foco movido ao `h2` da questão na transição.
- Contrastes dos badges/botões verificados; `motion-safe:animate-pulse` nos skeletons.

**Dependências:** HU-2.6, HU-3.1. **Tamanho:** M. **Prioridade:** P1.

---

### EPIC-7 — Telemetria Fase 1

**Objetivo:** instrumentar o funil triagem → adição → sessão → recall → domínio, todos no namespace `caderno_*`, adicionando ao union `AnalyticsEventName` e respeitando o mapeamento de `srs_*` para canônico. Insights/ROI ficam fora da Fase 1.

**Specs de referência:** 06 Parte B, 00 §5.

#### HU-7.1 — Estender `AnalyticsEventName` com os eventos de Fase 1
*História técnica.* Como engenheiro, quero adicionar os eventos novos ao union em `src/lib/analytics.ts`, para que a instrumentação seja tipada.

**Critérios de aceite**
- Adiciona: `caderno_triage_viewed`, `caderno_triage_item_toggled`, `caderno_triage_batch_added`, `caderno_recall_answer_selected`, `caderno_recall_confidence_set`, `caderno_recall_revealed`, `caderno_recall_self_graded`, `caderno_entry_snoozed`, `caderno_revisao_session_ended` (Insights/ROI ficam para Fase 2).
- Super-properties `user_segment` e `caderno_total_entries` setadas ao montar a página.

**Dependências:** nenhuma. **Tamanho:** P. **Prioridade:** P1.

#### HU-7.2 — Instrumentar funil de triagem
*História técnica.* Como PM/engenheiro, quero eventos da triagem, para medir conversão triagem → adição (M7).

**Critérios de aceite**
- `caderno_triage_viewed` (`attempt_id`, `candidate_count`, `simulado_id`); `caderno_triage_item_toggled` (`question_id`, `action`, `reason`, `reason_changed`); `caderno_triage_batch_added` (`added_count`, `rejected_count`, `attempt_id`).
- `error_added_to_notebook` passa a incluir `via_triage`, `was_batch`, `batch_size`.

**Dependências:** EPIC-4, HU-7.1. **Tamanho:** P. **Prioridade:** P1.

#### HU-7.3 — Instrumentar recall ativo e domínio
*História técnica.* Como PM/engenheiro, quero eventos por fase do recall, para medir completude do ciclo (M3) e domínio (M4).

**Critérios de aceite**
- `caderno_recall_answer_selected`, `caderno_recall_confidence_set`, `caderno_recall_revealed`, `caderno_recall_self_graded` (com `entry_id`, `was_correct`, `confidence`/`grade`, `srs_next_interval_days`).
- `caderno_entry_mastered` com `{ via_srs: true }`; `caderno_entry_leech_triggered`; `caderno_revisao_session_ended`.
- **Mapeamento canônico** respeitado: nada de `srs_*` no código (00 §5).

**Dependências:** EPIC-3, EPIC-1, HU-7.1. **Tamanho:** M. **Prioridade:** P1.

#### HU-7.4 — Instrumentar casca + manter compat de `caderno_entry_snoozed`
*História técnica.* Como engenheiro, quero complementar os eventos existentes da casca e migrar `caderno_revisao_snoozed` → `caderno_entry_snoozed` com compat reversa.

**Critérios de aceite**
- `caderno_erros_viewed` (+`entry_count`, `pending_count`, `tab`), `caderno_erros_filtered` (+`result_count`), `caderno_revisao_cta_clicked`/`started` complementados.
- `caderno_entry_snoozed` (`entry_id`, `days_snoozed`, `reason='manual_override'`); handler mantém `caderno_revisao_snoozed` legado até migração completa.

**Dependências:** EPIC-2, HU-7.1. **Tamanho:** P. **Prioridade:** P1.

---

## 4. Tarefas de QA / validação transversais

| ID | Tarefa | Cobre | Prioridade |
|---|---|---|---|
| QA-1 | **Testes unitários do SRS** em `src/lib` (helper espelho da lógica SM-2-lite): reproduzir os 4 exemplos trabalhados da spec 02 §8 (Memória, Lacuna c/ bloqueio, Atenção, Chute c/ promoção), incluindo override de confiança baixa, lapso, leech e domínio. | EPIC-1 | P0 |
| QA-2 | **Testes da migração** (idempotência: rodar 2×; backfills de `srs_due_at`/`mastered_at`/`answers.confidence`; RLS de `review_attempts` bloqueia INSERT direto e permite via RPC). | EPIC-0 | P0 |
| QA-3 | **Testes de RPC** (`schedule_next_review_guarded`, `record_review_attempt_guarded`, `add_to_notebook_bulk_guarded`, `reset_leech_guarded`, `snooze_error_notebook_entry`): ownership (`auth.uid()`), enums inválidos, limites (bulk 100 / batch 15), idempotência e ressurreição de soft-delete. | EPIC-0/1/4 | P0 |
| QA-4 | **Regressão da produção durante o fork**: `/caderno-erros*` segue funcional via `Navigate`; add individual (`addToErrorNotebook`) intacto; `snooze` e `toggleResolved` sem quebra; nenhum bypass do gate PRO. | EPIC-2 | P0 |
| QA-5 | **A11y (WCAG AA)** na casca, sessão e triagem: foco na transição, radiogroups com setas+atalhos, contraste de badges/botões, `aria-live` no "Prof. San pensando", `prefers-reduced-motion`, tooltip/`aria-label` em ícones, dica de Esc no modal. | EPIC-2/3/4/6 | P0 |
| QA-6 | **Heurística de triagem**: cobrir as 5 regras de `heuristicReason` + comportamento com `confidence=null` (simulados antigos) e com `classify-exam-errors` em `partial:true`/429/502. | EPIC-4 | P1 |
| QA-7 | **Recall sem colisão de teclado**: validar A–E (Fase 1), 1–3 (Fase 2), 1–4 (Fase 4), ←→, R; "Fácil" desabilitado quando errou; ausência de "Já dominei"/snooze 1·3·7. | EPIC-3 | P1 |
| QA-8 | **Paridade mobile**: bottom sheet da fila, action bar por fase, swipe com thresholds, enunciado longo rolável; smoke em viewport estreito. | EPIC-6 | P1 |
| QA-9 | **Telemetria**: schema dos eventos `caderno_*` (props), super-properties presentes, ausência de nomes `srs_*` no código, compat reversa de `caderno_revisao_snoozed`. | EPIC-7 | P1 |
| QA-10 | **Build/CI gates**: `npm run lint` + `npm run test` + `npm run build` verdes; regerar tipos do Supabase após migração e confirmar que `integrations/supabase/types.ts` reflete as colunas novas. | Todos | P0 |

---

## 5. Matriz história → spec (rastreabilidade)

| História | 00 | 01 | 02 | 03 | 04 | 05 | 06 |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| HU-0.1 | ✓ | ✓ | ✓ | | | | |
| HU-0.2 | | ✓ | | | | | |
| HU-0.3 | ✓ | ✓ | | | ✓ | | |
| HU-0.4 | ✓ | ✓ | ✓ | | | | |
| HU-0.5 | ✓ | ✓ | | | ✓ | | |
| HU-0.6 | ✓ | ✓ | | | | | ✓ |
| HU-0.7 | ✓ | ✓ | ✓ | | | | |
| HU-0.8 | | ✓ | | | | | |
| HU-0b.1 | ✓ | ✓ | | | ✓ | | |
| HU-0b.2 | | ✓ | | | ✓ | | |
| HU-0b.3 | | | | | ✓ | | |
| HU-0b.4 | | | | | ✓ | | |
| HU-0b.5 | ✓ | ✓ | | | ✓ | | |
| HU-1.1 | ✓ | ✓ | ✓ | | | | |
| HU-1.2 | ✓ | | ✓ | | | | |
| HU-1.3 | ✓ | ✓ | ✓ | | | | |
| HU-1.4 | ✓ | ✓ | ✓ | | | | |
| HU-1.5 | ✓ | ✓ | ✓ | ✓ | | | |
| HU-1.6 | ✓ | | ✓ | | | | |
| HU-2.1 | ✓ | | | | | ✓ | |
| HU-2.2 | ✓ | | | | | ✓ | |
| HU-2.3 | ✓ | | | | | ✓ | |
| HU-2.4 | | | | | | ✓ | |
| HU-2.5 | | | | ✓ | | ✓ | |
| HU-2.6 | ✓ | | | | | ✓ | |
| HU-2.7 | ✓ | | ✓ | | | ✓ | |
| HU-2.8 | | | | ✓ | | ✓ | |
| HU-2.9 | | | | | | ✓ | |
| HU-2.10 | | | | | | ✓ | |
| HU-2.11 | | | | | | ✓ | ✓ |
| HU-3.1 | ✓ | | ✓ | ✓ | | | |
| HU-3.2 | | | | ✓ | | | |
| HU-3.3 | ✓ | | | ✓ | | | |
| HU-3.4 | | | | ✓ | | | |
| HU-3.5 | ✓ | ✓ | ✓ | ✓ | | | |
| HU-3.6 | ✓ | | ✓ | ✓ | | | |
| HU-3.7 | | | | ✓ | | ✓ | |
| HU-3.8 | | | ✓ | ✓ | | | |
| HU-4.1 | ✓ | ✓ | | | ✓ | | |
| HU-4.2 | ✓ | | | | ✓ | | |
| HU-4.3 | | | | | ✓ | | |
| HU-4.4 | ✓ | | | | ✓ | | |
| HU-4.5 | | | | | ✓ | | |
| HU-4.6 | | ✓ | | | ✓ | | |
| HU-4.7 | | | | | ✓ | | |
| HU-5.1 | | | | | | ✓ | |
| HU-5.2 | ✓ | | | | | ✓ | |
| HU-5.3 | ✓ | | | | | ✓ | |
| HU-5.4 | | | | | | ✓ | |
| HU-6.1 | | | | ✓ | | | |
| HU-6.2 | | | | ✓ | | | |
| HU-6.3 | | | | ✓ | | | |
| HU-6.4 | | | | ✓ | | ✓ | |
| HU-7.1 | ✓ | | ✓ | | | | ✓ |
| HU-7.2 | | | | | ✓ | | ✓ |
| HU-7.3 | ✓ | | ✓ | ✓ | | | ✓ |
| HU-7.4 | ✓ | | | | | ✓ | ✓ |

---

**Totais:** 9 épicos (EPIC-0, 0b, 1–7) · 52 histórias de usuário/técnicas + 10 tarefas transversais de QA.
