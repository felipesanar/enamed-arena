# Handoff geral — Transição ENAMED 2027 (Fases 0 a 4)

**De:** sessão Claude Code (Opus), 03–04/11/2026 · **Para:** Codex como orquestrador, com o OpenCode Sanar escrevendo o código.
**Worktree:** `C:\Users\felipe.souza\Documents\Projetos (Sanar)\enamed-arena\.claude\worktrees\fase0-2027` (branch `feat/fase0-2027`, criada de `origin/main` @ `88937e9`).

Documentos irmãos, que este arquivo pressupõe:
- `HANDOFF-FASE0.md` (mesma pasta): **detalhe operacional da Fase 0**, avisos de ambiente e o passo a passo do OpenCode. Ler primeiro.
- `docs/auditoria-enamed-2027.md` (na `main`): auditoria com a matriz de 104 itens. Os IDs (S-, R-, D-, C-, U-, A-, I-, F-) usados aqui vêm de lá. A seção 4 (Entregável C) tem o SQL de referência do modelo `exam_editions` e a estratégia de migração.
- Claude Doc com o mesmo conteúdo: https://claude.ai/artifact/Vzcc75vXUKEpre5adQ5BqV

---

## 1. Visão geral

| Fase | Meta | Objetivo | Bloqueia |
|---|---|---|---|
| 0 | **27/11/2026** (prazo duro) | Fechar os riscos ativos em produção e tirar a data fixa do código | Tudo |
| 1 | 31/01/2027 (recalibrar com o edital do Inep) | Modelo de edição completo, admin de edições, front por edição, edição-alvo do aluno | Abertura do 1º simulado do 2027.1 |
| 2 | fev → mai/2027 | 2027.1 ativa + 2027.2 em preparação ao mesmo tempo: métricas, admin, comunicação e SSO por edição | Abertura da série do 2027.2 |
| 3 | mai → set/2027 | Experiência, engajamento, robustez e performance | — |
| 4 | 2º sem./2027+ | Diferenciais estratégicos (TRI, banco de questões, ranking da edição) | — |

**Fatos de produção que orientam tudo** (03/11/2026):
- 7 simulados de 2026, nenhum aberto.
- 10.178 usuários, dos quais 550 PRO.
- 1.461 alunos com prova enviada; 1.006 cadastros desde 07/09 sem nenhum simulado disponível.
- 399 tentativas presas na fila e 1.655 `in_progress` vencidas.
- Sem `pg_cron`, com drift entre repo e produção.

## 2. Regras de trabalho (todas as fases)

1. **Papéis.** Codex orquestra: lê, decide contratos e tipos compartilhados, escreve um prompt por tarefa, revisa o diff, roda lint, tsc e testes, e commita. O OpenCode escreve o código via `node /c/Users/felipe.souza/.claude/skills/opencode/scripts/oc.mjs` (comandos em `HANDOFF-FASE0.md` §4).
2. **Um job por tarefa**, com `--worktree <nome>` e escopo de arquivos explícito. Incluir desde o início os arquivos de integração prováveis: rotas (`src/App.tsx`), `src/admin/AdminApp.tsx`, tipos em `src/types/`, `src/integrations/supabase/types.ts` e serviços.
3. **Contratos primeiro.** Antes de disparar uma onda que compartilha tipos ou RPCs, o orquestrador commita no branch da fase os tipos TS e as assinaturas SQL. O OpenCode implementa contra eles.
4. **Migrations.** Prefixo `AAAAMMDDHHMMSS_` real, idempotentes, bloco `-- rollback` comentado no fim, nunca `DELETE` em massa. Antes de reescrever uma função, pegar a definição atual de **produção** com `select pg_get_functiondef('public.<fn>'::regproc)`, porque o repo pode estar defasado.
5. **Produção só com ok explícito do Felipe, por ação:** aplicar migration, deploy de edge function, habilitar extensão, apagar algo, enviar dados a terceiros (HubSpot, e-mail).
6. **Ensaio de SQL:** branch do Supabase (`create_branch`, que tem custo; pedir ok) ou `begin; …; rollback;` em produção com ok. Não há Docker.
7. **Ordem de deploy:** migrations (expand) → front que usa as RPCs novas → limpeza (contract). RPCs novas sempre com parâmetros `DEFAULT NULL`, para um front em cache seguir funcionando.
8. **Flag de UI:** a partir da Fase 1, as telas "por edição" ficam atrás de `editions_ui`, lida de uma tabela `app_config` (não localStorage). Ligar só depois do backfill verificado.
9. **UI e design.** Pela regra do Felipe, qualquer tela nova ou redesenho segue o combo de design (`C:\Users\felipe.souza\.claude\CLAUDE.md`, seção "Design de interface"): brief `DESIGN.md` + `PRODUCT.md`, Dendê / sanar-ui-kit, protótipo e capturas anexados ao prompt do OpenCode. Fora do Claude Code, aplicar o mesmo brief manualmente.
10. **Validação de cada tarefa:** `npm run lint`, `npx tsc -p tsconfig.app.json --noEmit`, `npm run test`, além dos testes SQL da tarefa. Só então `oc.mjs integrate`.
11. **Um PR por fase** (ou por bloco grande) para `main`, com o CI verde (já está verde desde o PR #30).

## 3. Decisões do Felipe (bloqueiam tarefas marcadas com 🔒)

| # | Decisão | Recomendação | Bloqueia |
|---|---|---|---|
| D1 | Destino das 399 + 1.655 tentativas presas | Finalizar como treino (`is_within_window=false`) e avisar os 399 | F0 (backlog histórico) |
| D2 | SSO com a SanarFlix (S-08, I-07) | HMAC + segmento com validade; até lá, não devolver o link de login | F0 (mitigação), F2 (validade) |
| D3 | Numeração dos simulados | Reinicia por edição, exibida como "2027.1 · Simulado 1" | F1-1 |
| D4 | Edição-alvo obrigatória? | Opcional e derivável; obrigatória só no cadastro novo, com "Ainda não sei" | F1-8 |
| D5 | 2026 em 2027 | Treino + histórico com selo "ENAMED 2026", fora dos KPIs da edição | F1-6, F1-7 |
| D6 | Nota de corte de referência por edição | Conteúdo/Produto define; a UI sempre mostra a referência | F1-5 |
| D7 | Média da home | Por edição, sem treino | F1-7 |
| D8 | Visão longitudinal | Percentil entre edições; % bruto só dentro da edição | F2-1, F3 |
| D9 | Caderno | Cumulativo + filtro por edição | F2-7 |
| D10 | Público do 4º ano | Avaliar; justifica `expected_graduation_term` | F1-8, F3 |
| D11 | Observabilidade | Sentry (ou similar): precisa de conta e DSN | F1-10 |
| D12 | Funções one-off em produção (S-09) | Revisar uma a uma com o Felipe; `mentoria-export` é trabalho ativo | F0/F1 |
| D13 | Calendário oficial | Esperar o edital do Inep; enquanto isso, datas nulas | Todas |

## 4. Fase 0 — Bloqueadores (detalhe em `HANDOFF-FASE0.md`)

Resumo das tarefas:
- **T1** — `exam_editions` mínima + data vinda do banco (C-01, U-14, U-15).
- **T2** — Integridade no banco (S-02, S-03, S-04, S-05, R-04, R-15, R-16).
- **T3** — Comentário e questões fora da hora (S-06).
- **T4** — Finalização com questões em branco, fila e `pg_cron` (R-01, R-02, R-03 parcial, F-01).
- **T5** — Preservação e PDF (D-11, A-09, S-07).
- **Orquestrador:** F-02 mínimo (migrations faltantes no repo, arquivos perigosos movidos), I-01 HubSpot, I-05 alertas de gabarito.

**Critério de conclusão:**
- os 8 riscos da seção 0.1 do relatório resolvidos e verificados em produção;
- fila zerada;
- em 29/11 nenhuma tela diz "a prova já passou" nem mostra dias negativos.

## 5. Fase 1 — Obrigatório para o 2027.1

**Pré-requisitos:** Fase 0 concluída; decisões D3, D4, D5, D6 e D7.
**Branch:** `feat/fase1-edicoes`, criada da `main` depois do merge da Fase 0.

### F1-0 Baseline do drift completo (orquestrador) — F-02
- Objetivo: `supabase db diff` contra produção sai vazio a partir do repo.
- Como:
  1. Sem Docker, o `db dump` da CLI não roda. Usar `pg_dump --schema-only` com a connection string de produção, que precisa ser pedida ao Felipe, sem ler `.env`.
  2. Gerar `supabase/migrations/<ts>_baseline_prod_schema.sql`.
  3. Mover as migrations antigas para `archive/migrations-pre-baseline/`.
  4. Registrar no `migrations-log.md` que ele ficou histórico.
  5. Regenerar `src/integrations/supabase/types.ts` (MCP `generate_typescript_types`).
- Aceite: `db diff` vazio; `types.ts` sem `rpc as any` nas RPCs usadas.

### F1-1 Modelo completo de edição (SQL) — D-01, D-02, D-03, D-13, D-17, C-02 (parte do banco)
- Estende a `exam_editions` criada no T1 com `blueprint_id` e `cutoff_reference_label`.
- Cria `exam_blueprints` e `exam_areas` (com `aliases`). Seed do blueprint `inep-478-2025`, com as 7 áreas oficiais: Clínica Médica, Cirurgia Geral, GO, Pediatria, MFC, Saúde Mental e Saúde Coletiva. **Pesos: pedir ao Conteúdo**; enquanto isso, uniformes, com o TODO registrado.
- `simulados`:
  - `+edition_id` e `+source_simulado_id`;
  - backfill dos 7 simulados para `2026`;
  - `NOT NULL`;
  - `UNIQUE (edition_id, sequence_number)`;
  - CHECK `execution_window_start < execution_window_end <= results_release_at` (antes, verificar que os dados atuais passam: o S7 tem `results_release_at` 2 min **antes** do fim da janela, então corrigir o dado ou relaxar para `<=` no início);
  - convenção de slug para os novos simulados: `enamed-2027-1-simulado-1`.
- `attempts`: `+edition_id` (trigger a partir do simulado), `+specialty_id_at_finish`, `+target_institution_ids_at_finish`, `+snapshot_backfilled`; backfill com o perfil atual (`snapshot_backfilled=true`).
- `questions`: `+area_id`. Backfill pelas aliases das 16 grafias atuais: "Cirurgia" e "Cirurgia Geral"; "Preventiva", "Preventiva " (com espaço) e "Saúde Coletiva / Preventiva"; MFC em 4 variantes; "Ginecologia" e "Obstetrícia" separadas; "Clínica Médica / Preventiva". **"Preventiva" vira Saúde Coletiva ou MFC? Pedir ao Conteúdo.** Gerar um relatório do que não casou.
- FKs de preservação já ficaram `RESTRICT` no T5.
- RLS: `simulados` com `archived` legível para quem tem tentativa nele (D-13).
- Aceite:
  - 0 nulos;
  - contagens de `attempts`, `answers` e `attempt_question_results` iguais antes e depois;
  - ranking de S1–S7 idêntico, comparado com o snapshot do `backup`;
  - `select count(distinct area_id)` = 7.

### F1-2 Tipos, hooks e funções puras de edição (front, sem UI)
- `src/types/edition.ts` completo (`ExamEdition`, `ExamFormat`, `EditionStatus`).
- `SimuladoConfig` ganha `editionId`, `editionCode` e `editionLabel`; `rowToSimuladoConfig` (`src/services/simuladosApi.ts`) e `listSimulados` passam a trazer a edição via join, ordenando por `(edition.exam_date nulls last, sequence_number)`.
- `src/lib/editions.ts`:
  - `resolveUserEdition(editions, profile, now)` (regra da seção C.3 do relatório);
  - `selectCurrentSimulado(simulados, edition, now)`, que substitui as 3 regras atuais;
  - `formatSimuladoLabel(sim)` → "2027.1 · Simulado 3".
- Hooks: `useExamEditions` (já criado no T1) e `useUserEdition`.
- Testes unitários de todas as funções puras, incluindo 2 janelas abertas de edições diferentes, edição sem data e nenhum simulado na edição.

### F1-3 Admin de edições e clonagem — A-01, A-02, A-09
- Página `src/admin/pages/AdminEdicoes.tsx` (lista + formulário: código, rótulo, status, data e flag "confirmada", resultado oficial, formato, blueprint, referência de corte). Rota em `src/admin/AdminApp.tsx` e item no menu admin.
- RPC `admin_upsert_edition(...)` com `admin_require('content.manage')` e auditoria.
- `AdminSimuladoForm.tsx`: seletor de edição obrigatório; o `sequence_number` sugere o próximo da edição. `AdminSimulados.tsx`: filtro por edição e coluna de edição.
- RPC `admin_clone_simulado(p_source uuid, p_edition_id uuid, p_window_start, p_window_end, p_results_release_at, p_copy_questions boolean)`: copia metadados e, opcionalmente, questões e alternativas com ids novos, grava `source_simulado_id`, nasce como `draft` e nunca copia tentativas.
- Aceite: criar o 2027.1, clonar o S1 de 2026 com questões e publicar pelo admin, sem SQL; a original fica intacta.

### F1-4 Importador transacional e matriz por edição — D-12, C-02 (UI)
- `UNIQUE (simulado_id, question_number)` em `questions` (antes, verificar que não há duplicatas).
- RPC `admin_import_questions(p_simulado_id uuid, p_rows jsonb)`, transacional: valida gabarito (A–D, 4 alternativas, conforme o formato da edição) e área contra o blueprint da edição; devolve as falhas linha a linha; não grava nada se houver falha.
- `supabase/functions/admin-upload-questions/index.ts` e `src/admin/pages/AdminUploadQuestions.tsx` passam a usar a RPC. A validação de área sai de `src/lib/enamedBlueprint.ts` e vai para o blueprint do banco.
- `src/lib/enamedBlueprint.ts` vira um adaptador do blueprint da edição (usado pela Reta Final e pelo badge "X% do ENAMED").
- Atenção ao `xlsxImageExtractor`, que tem bugs conhecidos (memória `xlsx-image-extractor-bugs.md`): não regredir.
- Aceite: uma linha inválida não grava nada e devolve um relatório; um reenvio duplicado é rejeitado.

### F1-5 Nota de corte com referência — D-04, D-05, U-05, U-19, A-10 (🔒 D6)
- `enamed_cutoff_scores` e `enamed_programs`: `+reference_edition_id`, `+source`; backfill dos 1.058 cortes atuais com a referência que o Felipe confirmar (provavelmente o processo do Enare 2026/2027); chave única `(institution_id, specialty_id, practice_scenario, reference_edition_id)`.
- `get_cutoff_scores(…, p_reference_edition_id default null)` e `get_user_cutoff_context`: null = referência da edição corrente; sem `DISTINCT ON … ORDER BY cutoff DESC` entre anos.
- `src/components/ranking/CutoffScoreModal.tsx`: eyebrow "Corte de referência: {label} · {fonte}" e ressalva fixa ("estimativa; provas e escalas diferentes; o ENAMED usa TRI").
- Admin: importador de cortes por referência (CSV/XLSX).
- Aceite: com cortes de dois processos carregados, uma linha por chave da referência pedida; o simulado de 2026 continua mostrando o mesmo corte.

### F1-6 Rótulos, listas e estados vazios por edição — U-01..U-04, U-06, U-08, U-09, U-17, U-18, U-20, U-21, R-13 (🔒 D5)
- Remover todos os literais "ENAMED 2026":
  - `SimuladosPage.tsx:115,124,143`;
  - `SimuladoDetailPage.tsx:268`;
  - `RankingPage.tsx:77,97,115`, `RankingHero.tsx:46`;
  - `DesempenhoPage.tsx:91,113,132,151`;
  - `CutoffScoreModal.tsx:159`;
  - `src/lib/pdf/pdfHelpers.ts:80,150` (badge como parâmetro; rodapé "Simulados SanarFlix").
- `R-13`: `src/hooks/exam/useExamLifecycle.ts:179` ("Seu resultado sai em 07/09") passa a usar `resultsReleaseAt`.
- `SimuladosPage` + `SimuladosTimelineSection`: seções por edição (a do aluno primeiro; as anteriores recolhidas como "ENAMED 2026 · Treino").
- Seletores de ranking e desempenho (`RankingSimuladoSelector.tsx`, `SimuladoTabs.tsx`) agrupados por edição. Padrão: o último simulado liberado da edição do aluno.
- `#${sequenceNumber}` → `formatSimuladoLabel` em todos os lugares: `SimuladoCard`, timeline, comparativo, radar (`dataKey` por `id`), drawer, agenda (`simulado-helpers.ts:195`), alerts.
- Landing (`LandingHowItWorks.tsx:96-108`): só a edição ativa ou a próxima.
- Estado vazio (`simuladoBannerScenario.ts:76`, `NextSimuladoBanner.tsx`): "Calendário do ENAMED {edição} em breve" + atalho para os treinos de 2026.
- Tudo atrás da flag `editions_ui`.
- Aceite: `grep -rn "ENAMED 2026" src` = 0; um aluno de 2027.1 vê 2027.1 no topo; links antigos (UUID e slug) abrem.

### F1-7 Home e "simulado atual" — U-10, U-11, U-12, U-13, D-07 (parte) (🔒 D7)
- SQL: `get_user_performance_summary(p_edition_id default null, p_include_training default true)` e `get_user_performance_history(…, p_edition_id default null)`, sem o limite fixo de 20.
- `src/lib/home-hero-state.ts`: `results_ready` expira N dias depois da liberação (sugestão: 14) e filtra pela edição.
- `src/hooks/useRanking.ts:134-135` + `src/services/rankingApi.ts:113`: o padrão vira o último liberado da edição (corrige o bug atual que mostra o S1). A chave de sessionStorage `ranking:simuladoId` passa a ser validada contra a lista.
- `simuladoBannerScenario.ts`, `SimuladosPage.tsx:86` e `home-hero-state.ts:136` usam `selectCurrentSimulado`.
- `HomePagePremium.tsx`: KPIs da edição sem treino; o "Top X%" passa a vir do percentil real (`src/lib/ranking-percentile.ts`), não de `100 − nota`.
- Testes: `home-hero-state.test.ts` (2026 concluído + 2027 upcoming → `upcoming`), banner e home com 2 janelas abertas.
- Aceite: sem seleção salva, home e ranking abrem no último simulado liberado da edição do aluno.

### F1-8 Edição-alvo do aluno — D-14, D-15 (🔒 D4, D10)
- SQL: `onboarding_profiles.target_edition_id` (null = indeciso), `expected_graduation_term`; tabela `user_edition_targets` (histórico); RPC `set_target_edition_guarded(p_edition_id, p_expected_graduation_term)` sem trava de janela.
- `save_onboarding_guarded` e `is_any_simulado_window_open`: a trava passa a valer só para a janela de simulados da edição do aluno. A memória `perfil-academico-edit-lock-paridade.md` explica a paridade guard × save: os dois precisam concordar.
- Onboarding (`OnboardingPage.tsx`, `components/onboarding`): novo passo "Quando você conclui o curso?" → sugere a edição, com "Ainda não sei". Vale só para cadastros novos.
- Aluno antigo: aviso não bloqueante na home e em `/simulados` quando `target_edition_id` é nulo. Não bloquear no `ProtectedRoute`, porque quebraria o `?next=` do presencial.
- Configurações (`AcademicProfileEditor`): editar a edição-alvo a qualquer momento.
- Analytics: `onboarding_completed` e `target_edition_set` com `edition_code`.
- Aceite: um aluno de 2026 entra direto na home, vê o aviso, escolhe e não é redirecionado; com uma janela de 2027.2 aberta, um aluno de 2027.1 edita o perfil.

### F1-9 Confiabilidade restante da prova — R-03 (restante, 🔒 D1), R-05, R-07, R-11, R-08, R-09, R-10, R-12
- `useExamStorageReal.ts`:
  - flush no unmount e em `visibilitychange=hidden`;
  - na retomada, merge pelo `lastSavedAt` mais novo;
  - flush no evento `online`;
  - `attemptId` salvo no cache local, com recarga em background.
- `deriveSimuladoStatus`: estado "treino em andamento" com CTA de continuar.
- `create_attempt_guarded`: bloquear antes da janela; `ON CONFLICT DO NOTHING`.
- `useExamIntegrity`: `setState` + `GREATEST` na RPC.
- Datas em America/Sao_Paulo com o rótulo "(horário de Brasília)"; `server_now` via RPC.
- Aplicar a D1 às tentativas históricas (job único, com relatório).
- Aceite: os testes de hook descritos na matriz; zero `in_progress` vencidas.

### F1-10 Observabilidade e testes do caminho crítico — F-04, F-05 (🔒 D11)
- Sentry (ou o que o Felipe escolher) no front + handler de `unhandledrejection`.
- Alerta de fila e jobs: `attempt_processing_queue` com pendente há mais de 10 min e falhas em `cron.job_run_details`, via e-mail Novu `ops_*`.
- E2E Playwright da prova completa (criar, responder, recarregar, finalizar, ver o resultado após a liberação) rodando no CI com um usuário de teste. As credenciais vêm de secret do GitHub, nunca do repo.
- Aceite: o CI roda o E2E; um erro de finalização gera alerta em 5 min.

### Ondas sugeridas da Fase 1
1. Orquestrador: F1-0, depois os contratos (SQL de assinatura + `src/types/edition.ts`).
2. Onda A (paralela): F1-1 (SQL) e F1-2 (front puro).
3. Onda B: F1-3, F1-4, F1-5, F1-8 (escopos disjuntos; F1-3 e F1-4 dividem `src/admin/AdminApp.tsx`, então definir as rotas no contrato).
4. Onda C: F1-6 e F1-7 (dividem `SimuladosPage.tsx`; rodar em sequência), depois F1-9 e F1-10.

**Critério de conclusão da Fase 1:**
- o admin cria o 2027.1 e um simulado de teste sem código;
- um aluno de 2026 vê o histórico separado e escolhe a edição;
- grep "ENAMED 2026" = 0;
- ranking de 2026 idêntico ao snapshot;
- E2E verde;
- flag `editions_ui` ligada em produção.

## 6. Fase 2 — Consolidação do modelo semestral

**Pré-requisito:** Fase 1 em produção. **Branch:** `feat/fase2-semestral`.

| Tarefa | Itens | Escopo principal | Aceite |
|---|---|---|---|
| **F2-1** Análises por edição (🔒 D8) | D-06, D-07 (restante), D-08, U-16 | Aposentar `user_performance_summary` (a tool MCP `src/lib/mcp/tools/get-my-performance.ts` passa a usar RPC com gate de liberação); `get_area_score_history`, `get_user_attempt_behavior_stats`, `get_caderno_pattern_data`, `get_confidence_calibration` com `p_edition_id`; Comparativo (`useComparativeData.ts`, `resultHelpers.ts:240-298`, `comparativeInsights.ts:36-49`, gráficos) com padrão na edição e visão histórica por percentil, com separadores | Nenhum insight cita simulados de edições diferentes; a série respeita a edição |
| **F2-2** IA por edição | C-03, C-04, `gemini-*` | Prompts recebem `editionLabel`, formato e série da edição; remover "100q em 4h" e `GOAL=50`; corte real da referência; percentil calculado no front e repassado (o percentil da IA diverge hoje); variável `GEMINI_MODEL` (C-06) | Payload com a edição; nenhum literal de formato ou corte no prompt |
| **F2-3** Foto de perfil no ranking | D-09 | `get_ranking_for_simulado` filtra especialidade e instituição pela foto da tentativa em edições `closed` | Trocar a especialidade não altera o ranking filtrado antigo |
| **F2-4** Admin por edição | A-03, A-04, A-05, A-06, A-07, A-08, C-05 | `p_edition_id` em `admin_score_evolution`, `admin_segment_breakdown`, `admin_cohort_retention`, `admin_intel_insights`, `admin_score_distribution`, `admin_performance_by_*`; seletor global de edição no `AdminPeriodContext`; período livre; publicação via `admin_publish_simulado` com gate no servidor; recálculo explícito de janela; regra presencial por sessão; edge functions de admin com `admin_require(capability)`; auditoria com diff | Relatório "2026 × 2027.1" sem SQL; `content_editor` importa ponta a ponta |
| **F2-5** Reprocessamento em uma RPC | D-10 | `admin_reprocess_simulado(p_simulado_id, p_reason)`: reaplica gabarito e recalcula notas, ranking, histórico e caderno, com relatório; usar a receita validada nos incidentes S5/S6 (memórias `gabarito-errado-classe-de-erro-e-reprocessamento.md` e `simulado-6-auditoria-gabarito-imagem-2026-08-09.md`) + botão no admin | Corrigir gabarito → 1 clique → notas corretas |
| **F2-6** Comunicação por calendário | I-02, I-03, I-04, I-05, U-23 | Job pg_cron + `novu-email`: "janela abriu", "faltam 24h", "resultado saiu" por edição; HubSpot sincroniza `segment` e `enamed_edicao_alvo` também no UPDATE; `caderno-reminders` implementado com workflow Novu (ou toggle removido); toggle "Reta final" implementado ou escondido | E-mails gerados a partir de `simulados` sem código por simulado; execuções 2xx diárias |
| **F2-7** Caderno por edição (🔒 D9) | U-24, U-25 | Selo da edição nos cards e na exportação; filtro por edição; contagens via RPC e listas paginadas (hoje não há paginação; teto do PostgREST de 1.000, máximo atual de 215 por usuário) | 1.500 entradas: contador = `COUNT`; o filtro muda lista e insights |
| **F2-8** SSO com validade (🔒 D2) | S-08, I-07 | Modo HMAC acordado com a SanarFlix; `segment_valid_until` e rebaixamento; refresh do segmento com sessão aberta (`AuthSSOPage.tsx:44-49`) | POST sem assinatura não recebe URL; PRO expira sem renovação |

**Critério de conclusão:** 2027.1 `active` e 2027.2 `preparing` funcionando juntos; relatório admin por edição; e-mails automáticos; SSO hardened.

## 7. Fase 3 — Experiência e produto

**Branch:** uma por iniciativa. Cada iniciativa de UI passa pelo combo de design antes do OpenCode (regra 9).

| Tarefa | Itens | O que é | Aceite |
|---|---|---|---|
| F3-1 Calendário da edição | — | Página/aba "Calendário 2027.x" + `.ics`/Google Agenda por edição | Aluno exporta o calendário da edição |
| F3-2 Onboarding por etapa (🔒 D10) | — | Público do 4º ano (1ª etapa); jornadas por etapa | Funil separado por etapa no admin |
| F3-3 Percentil longitudinal | D8 | Evolução por percentil entre edições | Gráfico histórico sem % bruto entre edições |
| F3-4 Plano por tempo restante | — | Reta Final generalizada até a edição do aluno, com a matriz da edição | Plano muda ao trocar a edição-alvo |
| F3-5 Recuperação do offline pendente | — | 2.618 gabaritos offline nunca enviados: lembrete + investigação de UX | Taxa de envio do gabarito offline medida e subindo |
| F3-6 Multi-aba seguro | R-06 | `answers.client_updated_at` + upsert condicional + lock de aba (`BroadcastChannel`) | E2E com 2 abas: prevalece a mais nova |
| F3-7 Performance | F-06 | Migrar `useRanking`, `useUserPerformance`, `useExamResult` e `useComparativeData` para React Query; rodar o visualizer de bundle | Voltar à home não refaz chamadas em 5 min |
| F3-8 Acessibilidade e prova | U-26, a11y | Skip link, timer anunciado ao leitor de tela, mapa de atalhos (1/2/3 × confiança; Esc sem penalidade), `vite:preloadError` (R-14) | Auditoria a11y sem bloqueadores |
| F3-9 Higiene | U-22, U-27, U-28, R-16, I-06, I-08, F-07, F-08 | Erro na home, copy ("oficiais"), código morto (`Index.tsx`, `KpiGrid` e outros 10), domínio próprio nos e-mails, allowlist `sanaflix`, CLAUDE.md, alvo de deploy único | typecheck/lint/testes verdes |
| F3-10 Upgrades com prazo | `audit-allowlist.json` | `@lovable.dev/mcp-js` 3.x (prazo **15/12/2026**: o CI volta a falhar quando vencer), zod 4, vitest 5, vite 7 | Allowlist sem exceção vencida |

**Atenção:** a exceção do MCP SDK vence em **15/12/2026**, no meio da Fase 1. Puxar F3-10 (mcp-js) para dezembro ou renovar a exceção com justificativa.

## 8. Fase 4 — Evoluções estratégicas

| Tarefa | O que é | Depende de | Risco |
|---|---|---|---|
| F4-1 Estimativa de proficiência (TRI) | Calibrar os itens com as ~394 mil respostas; mostrar "estimativa de proficiência" com intervalo e o corte oficial de 60 | Estatístico; volume por item; D-17 | Prometer precisão que não existe |
| F4-2 Banco de questões versionado | `question_bank` + versões + uso por simulado; análise por item | F1-1, F2-5 | Migrar 700 questões |
| F4-3 Ranking da edição | Agregado (média dos N melhores simulados da edição) | F1-1 | Comparabilidade entre provas |
| F4-4 PRO por período ponta a ponta | Acesso por edição/assinatura | F2-8 | Contrato com a SanarFlix |
| F4-5 Notas de corte com histórico | Vários processos por instituição; tendência de corte | F1-5 | Fonte dos dados |

## 9. Checklist de cada ida para produção

1. Snapshot no schema `backup` (ranking por simulado, contagens, somas de nota) antes de migrar.
2. Migrations ensaiadas em branch (ou com rollback), com os testes SQL da tarefa verdes.
3. Ok do Felipe para aplicar, citando exatamente o que vai mudar.
4. Aplicar as migrations → verificar os invariantes → deploy de edge functions (se houver) → merge do front.
5. Conferir em produção: contagens, ranking de 2026 idêntico, `cron.job_run_details`, logs das edge functions, console sem erro.
6. Atualizar `docs/auditoria-enamed-2027.md` (status dos itens) e a memória do projeto.

## 10. Onde está cada coisa

| O quê | Onde |
|---|---|
| Relatório da auditoria | `docs/auditoria-enamed-2027.md` (na `main`) · Claude Doc acima |
| Handoff detalhado da Fase 0 | `HANDOFF-FASE0.md` (este worktree) |
| Regras globais do Felipe | `C:\Users\felipe.souza\.claude\CLAUDE.md` |
| Skill do OpenCode | `C:\Users\felipe.souza\.claude\skills\opencode\` (`SKILL.md`, `README.md`, `prompts/COMMON.md`, `scripts/oc.mjs`) |
| Memória do projeto | `C:\Users\felipe.souza\.claude\projects\C--Users-felipe-souza-Documents-Projetos--Sanar--enamed-arena\memory\` (índice em `MEMORY.md`) |
| Projeto Supabase | ref `lljnbysgcwvkhlnaqxtt` |
| Repo | `felipesanar/enamed-arena` (PRs #29, #30 e #31 já mergeados) |
