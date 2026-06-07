# 00 — Contratos Canônicos (fonte da verdade)

> Este documento **supersede** qualquer divergência de nome/enum/limiar/evento nas specs 01–06. Em conflito, vale o que está aqui. Engenharia e Design devem usar exatamente estes nomes.

**Contexto:** Caderno de Erros v2 do SanarFlix PRO Simulados (ENAMED). Decisões de produto finais: (1) casca do sandbox + motor da produção; (2) confiança capturada na origem (Fase 0).

---

## 1. RPCs (Postgres, SECURITY DEFINER)

Convenção do projeto: **mutações com checagem de ownership/limite usam sufixo `_guarded`** (como `create_attempt_guarded`, `update_attempt_progress_guarded`, `save_onboarding_guarded`). Reads não usam sufixo.

| RPC | Tipo | Assinatura | Retorno |
|---|---|---|---|
| `schedule_next_review_guarded` | mutação | `(p_entry_id uuid, p_outcome text, p_confidence text)` | `jsonb {srs_due_at, srs_interval, srs_reps, srs_ease, mastered bool, is_leech bool}` |
| `record_review_attempt_guarded` | mutação | `(p_entry_id uuid, p_selected_option_id uuid, p_was_correct bool, p_confidence text, p_self_grade text)` | `uuid` (id do attempt registrado) |
| `add_to_notebook_bulk_guarded` | mutação | `(p_entries jsonb)` | `jsonb {added int, skipped int, entry_ids uuid[]}` |
| `reset_leech_guarded` | mutação | `(p_entry_id uuid)` | `void` |
| `snooze_error_notebook_entry` | mutação (EXISTENTE) | `(p_entry_id uuid, p_days int)` | `timestamptz` |
| `get_caderno_pattern_data` | read | `(p_user_id uuid)` | `jsonb` |
| `get_area_score_history` | read (Fase 2) | `(p_user_id uuid)` | `jsonb` |

- `snooze_error_notebook_entry` **mantém o nome existente** (não renomear para `snooze_entry`). Passa a ser "adiar/override" manual: ajusta `srs_due_at` mas **não** mexe em `srs_reps`/`srs_ease`.
- O cliente **nunca** calcula SRS; tudo via `schedule_next_review_guarded`.

## 2. Enums (valores canônicos)

| Conceito | Onde | Valores |
|---|---|---|
| **confiança** | `answers.confidence`, `review_attempts.confidence` | `'baixa' \| 'media' \| 'alta'` (sem acento) |
| **autoavaliação** | `review_attempts.self_grade` | `'errei' \| 'dificil' \| 'bom' \| 'facil'` (sem acento) |
| **resultado da revisão** | `error_notebook.last_review_outcome` | os 4 de autoavaliação **+** `'snoozed' \| 'awaiting_lesson' \| 'leech_blocked'` |
| **causa do erro** | `error_notebook.reason` (existente) | `did_not_know \| did_not_remember \| reading_error \| confused_alternatives \| guessed_correctly` (+ `did_not_understand` legado, **só leitura**) |

- Confiança é **`baixa/media/alta` em todo lugar** (descarta `low/medium/high`). Backfill de `answers.confidence` a partir do booleano existente `high_confidence`: `true → 'alta'`; `false/null → NULL` (desconhecida).
- A IA de triagem **nunca** retorna `did_not_understand`.

## 3. Colunas (nomes canônicos)

**`error_notebook` (+):** `srs_ease` (default `2.5`), `srs_interval` (int, dias), `srs_reps` (int), `srs_lapses` (int), `srs_due_at` (timestamptz — **fonte da verdade de agendamento**, substitui `next_review_at`), `confidence_at_answer` (text), `last_review_outcome` (text), `mastered_at` (timestamptz — domínio **automático**, ≠ `resolved_at`).

**`review_attempts` (nova):** `id`, `entry_id`, `user_id`, `selected_option_id`, `was_correct`, `confidence`, `self_grade`, `reviewed_at`.

**`answers` (+):** `confidence` (text, nullable).

**`attempt_question_results` (+):** `ai_suggested_reason` (text, cache da triagem — se preenchido, cliente não chama a edge function).

**`decks` / `flashcards`** (Fase 2): conforme spec 01.

**`caderno_pattern_insights_cache`** (Fase 2): `user_id`, `payload jsonb`, `generated_at`, `entry_count` — RLS restrito ao próprio usuário.

## 4. Limiares (parametrizáveis; SRS spec 02 é a autoridade do algoritmo)

- **Leech:** `srs_lapses >= 4` → bloqueia re-teste até consumir aula; Prof. San muda abordagem.
- **Domínio automático** (set `mastered_at`): `srs_reps >= 3` **E** `srs_interval >= 21` **E** confiança das 2 últimas revisões `>= 'media'` **E** `last_review_outcome IN ('bom','facil')` **E** sem lapso na sequência atual.
- **"Devida hoje":** `srs_due_at <= fim do dia local (America/Sao_Paulo)`.
- Confiança `'baixa'` **não** conta para a sequência de domínio.
- **Triagem:** batch de **15** questões por chamada de IA; **bulk add** limite **100** entradas/chamada (cobre um ENAMED completo).
- **Chat Prof. San:** limite **10**/entrada (existente).

## 5. Eventos de analytics (namespace canônico = `caderno_*`)

A spec 06 é a autoridade de telemetria. Os eventos `srs_*` propostos na spec 02 são **mapeados**:

| Proposto (spec 02) | Canônico (spec 06) |
|---|---|
| `srs_review_completed` | `caderno_recall_self_graded` |
| `srs_entry_mastered` | `caderno_entry_mastered` (`{ via_srs: true }`) |
| `srs_leech_triggered` | `caderno_entry_leech_triggered` |
| `lesson_accessed` | `caderno_lesson_accessed` |
| `caderno_revisao_snoozed` (legado) | `caderno_entry_snoozed` (manter compat reversa) |

Lista completa de eventos novos + existentes: ver `06-pattern-engine-telemetry.md`. Todos prefixados `caderno_`. Adicionar ao union `AnalyticsEventName` em `src/lib/analytics.ts`.

## 6. Rotas

`/caderno` (default = aba Revisar) · `/caderno/revisao` · `/caderno/favoritos` · `/caderno/anotacoes` · `/caderno/flashcards` · `/caderno/insights`. Gate PRO em todas. Triagem pós-prova: `/simulados/:id/triagem` (área de prova, PRO-only).

## 7. Abas (labels fixos)

**Revisar · Favoritos · Anotações · Flashcards · Insights** (sem variação de nomenclatura entre telas/specs).

## 8. Edge functions

| Nome | Status | Papel |
|---|---|---|
| `gemini-error-notebook-review` | existente | Análise micro do Prof. San (1 questão) |
| `gemini-error-notebook-chat` | existente | Chat do Prof. San (limite 10/entrada) |
| `classify-exam-errors` | novo | Triagem/classificação pós-prova (batch 15) |
| `caderno-pattern-insights` | novo | Prof. San macro / insights (cache 24h) |

## 9. Componentes canônicos

`CadernoPage`, `CadernoRevisaoPage`, `NotebookEntryCard`, `PageHero` (caderno), `FilterBar` (caderno), `TabBar` (caderno) — em `src/components/caderno/` e `src/pages/`. **Fonte da verdade de causa do erro:** `src/lib/errorNotebookReasons.ts` (`DbReason`, `getReasonMeta`). O `errorTypes.ts` do sandbox será **deletado**. Padrão de undo: optimistic update + `toast` com ação "Desfazer" (5s) em toda exclusão.

## 10. Fases

- **Fase 0:** migração de schema + captura de confiança na prova.
- **Fase 1 (MVP):** casca unificada (aba Revisar) + recall ativo + SRS + triagem pós-prova + busca/lote/mobile.
- **Fase 2:** Insights (motor de padrões) + Flashcards (imagem + IA) + deep-link aula + abas Favoritos/Anotações + calibração.
- **Fase 3:** War Room ENAMED + ROI + leech + "simulado do meu caderno" + voz + colaborativo + export.

## 11. Resoluções de divergências (supersede specs 01/03/04)

- **Bulk add — contrato único:** `add_to_notebook_bulk_guarded(p_entries jsonb) → jsonb {added int, skipped int, entry_ids uuid[]}` (o `entry_ids` lista os ids das entradas efetivamente criadas/ressuscitadas; consumidores podem ler só `added`/`skipped`). Limite **100** entradas/chamada. A triagem por IA processa em lotes de **15** internamente (chunk), mas a adição ao caderno é **uma** chamada.
- **Chave de deduplicação:** uma entrada por **`(user_id, question_id)`**. A mesma questão errada em simulados diferentes **não** duplica (conta como `skipped`). Soft-deletes (`deleted_at`) são **ressuscitados** (reabre a entrada existente, não cria nova).
- **Insight de resumo de sessão:** na Fase 1, o `SessionSummary` mostra **apenas estatísticas locais** (dominadas / agendadas / restantes / tempo / top-áreas) — **sem chamada de IA**. O insight macro do Prof. San e a edge function `caderno-pattern-insights` são **Fase 2**. A **única** edge function nova da Fase 1 é `classify-exam-errors`.
- **Feature flag:** flag primária por usuário em `profiles.caderno_v2_enabled` (rollout gradual server-side) + kill-switch de ambiente. Rota nova `/caderno` roda **em paralelo** à atual `/caderno-erros` durante a transição (sem downtime).
- **Desbloqueio de Lacuna (sem deep-link de aula na Fase 1):** o estado `awaiting_lesson` é satisfeito por confirmação manual **"Já estudei isso"** no card/sessão. O deep-link para a aula (inovação I5) e o disparo automático de `caderno_lesson_accessed` entram na **Fase 2**.
- **Em aberto (donos a definir — NÃO bloqueiam a implementação):** (a) origem/atualização da `ENAMED_DATE` por ciclo — dono: Conteúdo/Ops; (b) momento de calibrar as metas M1–M7 com baseline do beta — dono: Produto/Dados.

## 12. Contratos Fase 2 (Insights · Flashcards · Notas · Favoritos · deep-link)

### Tabelas novas
- `caderno_pattern_insights_cache`: `id`, `user_id`, `payload jsonb`, `generated_at timestamptz`, `entry_count int`. RLS: dono. Cache de 24h dos insights.
- `user_notes` (Anotações): `id`, `user_id`, `title text`, `body_md text`, `question_id uuid?`, `simulado_id uuid?`, `area text?`, `theme text?`, `created_at`, `updated_at`, `deleted_at`. RLS dono.
- `question_favorites` (Favoritos): `id`, `user_id`, `question_id uuid`, `simulado_id uuid?`, `area text?`, `theme text?`, `created_at`. `UNIQUE(user_id, question_id)`. RLS dono.
- `decks` / `flashcards` já existem (Fase 0). Storage bucket **`flashcard-images`** (privado; policy por path `user_id/...`).

### RPCs novas
- `get_caderno_pattern_data(p_user_id uuid) → jsonb` (read) — agrega dados para insights.
- `get_area_score_history(p_user_id uuid) → jsonb` (read) — histórico de score por área (ROI).
- `schedule_flashcard_review_guarded(p_flashcard_id uuid, p_outcome text) → jsonb` — SM-2-lite para flashcards (sem reason/confidence; `p_outcome` ∈ errei|dificil|bom|facil). Retorna `{srs_due_at, srs_interval, srs_reps, srs_ease, mastered, is_leech}`.
- `clear_awaiting_lesson_guarded(p_entry_id uuid) → void` — limpa `last_review_outcome='awaiting_lesson'` ("já estudei" / deep-link).

### CRUD direto (sem RPC, protegido por RLS — padrão `addToErrorNotebook`)
`user_notes`, `question_favorites`, `decks`, `flashcards`: INSERT/UPDATE/SELECT direto do cliente com RLS; soft-delete via `deleted_at`.

### Edge functions novas
- `caderno-pattern-insights` — Prof. San macro (insights estruturados, cache 24h em `caderno_pattern_insights_cache`).
- `generate-flashcard` — gera frente/verso (markdown) a partir de uma entry/questão + análise; carrega imagem da questão se houver.

### Rotas (já reservadas em App.tsx como placeholders)
`/caderno/insights` · `/caderno/flashcards` · `/caderno/favoritos` · `/caderno/anotacoes`.

### Eventos (namespace `caderno_*`)
Insights/ROI já declarados na Fase 1. Adicionar: `caderno_flashcard_created`, `caderno_flashcard_ai_generated`, `caderno_flashcard_reviewed`, `caderno_note_created`, `caderno_note_updated`, `caderno_favorite_added`, `caderno_favorite_removed`. `caderno_lesson_accessed` já existe.

### InsightType (canônico, spec 06): `weak_area | dominant_cause | recurring_confusion | overconfidence | roi`.

## 13. Contratos Fase 3 (War Room · Export · Voz · Treino)

**Tudo client-side** — sem novas tabelas, RPCs ou edge functions (opera sobre dados já existentes: `getErrorNotebook`, campos SRS, `getAreaScoreHistory`).

### Rotas novas
- `/caderno/reta-final` — War Room ENAMED (plano de revisão por contagem regressiva).
- `/caderno/treino` — "Treino do meu caderno" (drill focado nos temas mais fracos).

### Libs novas
- `src/lib/enamedBlueprint.ts` — pesos das grandes áreas no ENAMED (constante; usado na priorização). Marcar dono Conteúdo para validar pesos.
- `src/lib/retaFinalPlan.ts` — algoritmo puro de priorização: `score = f(dias_até_ENAMED, vencida(srs_due_at), srs_lapses, não_dominada, peso_ENAMED_da_área, frequência_de_erro_na_área)` → distribui entradas em um plano dia-a-dia até a prova.
- `src/lib/cadernoExport.ts` — export PDF (lib de PDF já presente no projeto, ex.: jsPDF) + CSV importável no Anki (frente;verso). `.apkg` é fora de escopo (usar CSV).

### TTS (voz)
Web Speech API (`window.speechSynthesis`, locale pt-BR) na sessão de recall: botão "ouvir" lê a análise do Prof. San. Sem dependência externa. Respeita ausência de suporte (degrada).

### Eventos novos (namespace `caderno_*`)
`caderno_reta_final_viewed`, `caderno_export_pdf`, `caderno_export_anki`, `caderno_tts_played`, `caderno_treino_started`.

### Entry points
War Room: card/CTA na home premium e no hero do `/caderno` quando faltam ≤ N dias para o ENAMED. Treino: CTA na aba Revisar e no `SessionSummary`.
