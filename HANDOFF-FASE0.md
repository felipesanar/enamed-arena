# Handoff — Transição ENAMED 2027 · Fase 0

**De:** sessão Claude Code (Opus) de 03–04/11/2026 · **Para:** Codex, usando o OpenCode Sanar como executor de código.
**Onde continuar:** este worktree, `C:\Users\felipe.souza\Documents\Projetos (Sanar)\enamed-arena\.claude\worktrees\fase0-2027`, na branch `feat/fase0-2027` (criada de `origin/main` @ `88937e9`; ainda sem commits).

---

## 1. Contexto em 30 segundos

- O ENAMED vira semestral em 2027 (2027.1 e 2027.2): MP 1.370/2026 + PLV 14/2026, com sanção prevista até 06/11. **Não há calendário oficial de 2027.**
- A auditoria completa está em `docs/auditoria-enamed-2027.md` (já na `main`, PR #31) e no Claude Doc https://claude.ai/artifact/Vzcc75vXUKEpre5adQ5BqV. Os IDs abaixo (S-02, R-01, C-01…) são os da matriz desse documento. **Leia as seções 0, 3 (matriz) e 6 (roadmap) antes de começar.**
- A plataforma não tem o conceito de edição. A Fase 0 fecha os riscos que já estão ativos em produção e prepara o terreno. A Fase 1 cria o modelo `exam_editions` (seção 4/C do relatório).

## 2. O que já foi feito (não refazer)

| Item | Estado |
|---|---|
| S-01 `temp-change-email` | Apagada de produção em 03/11 (`supabase functions delete`, 404 confirmado) e do repo (PR #29, merged) |
| CI do `main` | Verde de novo (PR #30, merged): `npm ci` sem `--omit=optional`, lint, pins das Edge Functions, gate de audit `scripts/check-npm-audit.mjs` + `audit-allowlist.json` (exceções com prazo: MCP SDK até **15/12/2026**; zod/tinypool/vite até 31/01/2027) |
| Relatório | `docs/auditoria-enamed-2027.md` na `main` (PR #31) |
| Memória do projeto | `C:\Users\felipe.souza\.claude\projects\C--Users-felipe-souza-Documents-Projetos--Sanar--enamed-arena\memory\auditoria-enamed-2027.md` |

**Nada da Fase 0 foi implementado ainda.** O worktree só tem o `origin/main` + junction de `node_modules` para o checkout principal.

## 3. Avisos de ambiente (importantes)

- **O checkout principal (`enamed-arena/`, branch `main`) está desatualizado** (80+ commits atrás do `origin/main`) e tem alterações de outras sessões que **não devem ser commitadas nem descartadas sem o Felipe**:
  - `supabase/functions/mcp/index.ts` modificado: é corrupção do `vite build` no Windows (ver memória `mcp-js-plugin-windows-corrompe-funcao.md`). **Nunca commitar.**
  - `supabase/functions/generate-exam-pdf/index.ts` modificado (origem incerta).
  - 6 migrations não rastreadas, **já aplicadas em produção**: `20260804185037…`, `20260804190842…`, `20260804190948…`, `20260804191135…`, `20260804191331…`, `20260817143000_fix_gabarito_s6_q49_reprocessa_notas.sql`. Elas precisam entrar no repo (item F-02 abaixo). Copie-as do checkout principal para este worktree.
- Trabalhe **sempre neste worktree** (sessões paralelas compartilham o diretório principal).
- `node_modules` aqui é **junction** para o do checkout principal. Nunca apagar com remoção recursiva.
- **Sem Docker** na máquina: não dá para subir o Supabase local. Para ensaiar SQL, veja a seção 7.
- Supabase de produção: project ref `lljnbysgcwvkhlnaqxtt`. Supabase CLI v2.117 está logada (`supabase functions delete/deploy` funcionaram).
- `pg_cron` **não está instalado** em produção (extensões: plpgsql, pg_stat_statements, pgcrypto, supabase_vault, unaccent, uuid-ossp, pg_net).
- Drift: produção tem 175 migrations com timestamps diferentes dos arquivos do repo; `20260906215529_presencial_sempre_entra_no_ranking` existe **só em produção**; `20260817160000_gabarito_key_alerts.sql` e `…160100_…_cron.sql` existem **só no repo** (nunca aplicadas).

## 4. Como usar o OpenCode (regra do Felipe: OpenCode programa, o orquestrador revisa e commita)

Regras completas em `C:\Users\felipe.souza\.claude\CLAUDE.md` (seção "Divisão de modelos") e na skill `C:\Users\felipe.souza\.claude\skills\opencode\` (`SKILL.md`, `README.md`, `prompts/COMMON.md` — o COMMON entra sozinho em todo prompt).

Script único:

```bash
OC="node /c/Users/felipe.souza/.claude/skills/opencode/scripts/oc.mjs"
$OC server start                       # servidor único na porta 47096 (o run sobe sozinho se precisar)
$OC run --prompt-file <tarefa.md> --repo "<este worktree>" --worktree <nome> [--file <anexo>]...
$OC watch                              # stream de eventos (erro, travamento, fim); rearmar se expirar
$OC status                             # lista jobs
$OC wait <job...>                      # bloqueia até terminarem (use em background)
$OC result <job>                       # relatório final + diff --stat
$OC integrate <job>                    # commit na worktree do job + merge --no-ff em feat/fase0-2027
$OC resume <job> "<mensagem>"          # retoma a mesma sessão
$OC cancel <job>                       # nunca matar opencode-cli.exe por nome
```

Regras que valem sempre:
- Nunca rodar vários `opencode-cli.exe run` independentes; sempre via `oc.mjs` (token compartilhado).
- Máximo ~5 jobs simultâneos **na conta inteira** (outras sessões do Felipe também usam). Confira `status` antes de disparar a onda.
- Um prompt por tarefa, com **escopo de arquivos explícito** (incluir arquivos de integração prováveis); o modelo para se precisar sair do escopo.
- Todo prompt: TDD, relatório final, rodar **só os testes do escopo** (suíte inteira e `tsc` ficam com o orquestrador), sem git que altera estado, sem rede, sem `.env`, sem subagentes internos.
- "Waiting for authorization" no log = login expirou → parar tudo e pedir ao Felipe para logar no app desktop do OpenCode. Nunca logar por ele.
- Progresso real = arquivo gravado + teste passando. Depois de cada job: revisar o diff, rodar `npm run test`, `npm run lint`, `npx tsc -p tsconfig.app.json --noEmit` neste worktree, e só então `integrate`.
- Use `--worktree <nome>` em cada job para paralelizar de verdade sem conflito.

## 5. Plano da Fase 0 (prazo duro: 27/11/2026)

O motivo do prazo: `ENAMED_DATE` fixo em 28/11/2026 quebra a Reta Final e o countdown.

### Divisão em tarefas para o OpenCode (escopos disjuntos)

> Antes de disparar, **verifique cada caminho/linha citado** (vieram de leitura do código em 03–04/11). Migrations novas: prefixo de data `202611DD…` e nome descritivo. Todas as migrations precisam de bloco `-- rollback` comentado no fim e de idempotência (`create or replace`, `if not exists`, `drop … if exists`).

**T1 — Datas por edição (C-01, U-14, U-15) — início do modelo da Fase 1**
- Migration: criar `exam_editions` **mínima** já no formato final do relatório (seção C: `code`, `year`, `term`, `label`, `status` enum `exam_edition_status`, `exam_date`, `exam_date_confirmed`, `official_results_at`, `format jsonb`, timestamps; sem `blueprint_id` ainda). RLS: SELECT para `authenticated` e `anon`; escrita só com `has_capability('content.manage')`. Seed: `2026` (`closed`, exam_date `2026-09-13`, confirmada, results `2026-12-04`), `2027.1` e `2027.2` (`planned`, data nula). RPC `get_exam_editions()` (STABLE, security invoker).
- Front: `src/types/edition.ts` (`ExamEdition`, `EditionStatus`), `src/lib/editions.ts` com funções puras `getNextEdition(editions, now)` (primeira com `exam_date >= hoje` em America/Sao_Paulo; sem nenhuma → a próxima `planned/preparing` sem data) e `getDaysUntil(date, now)` (dias de calendário em America/Sao_Paulo; 0 = "É hoje"), hook `src/hooks/useExamEditions.ts` (React Query, staleTime 1h).
- Substituir `ENAMED_DATE` em: `src/components/caderno/PageHero.tsx:13-19` (remover a constante), `src/components/premium/home/EnamedCountdownCard.tsx` (nome da edição; "É hoje"; some sem data), `src/pages/CadernoPage.tsx:48,507`, `src/pages/CadernoRetaFinalPage.tsx:57,228` + estados de cópia em `:100-130` (sem data → "Data oficial do ENAMED {label} ainda não divulgada pelo Inep"; nunca "O ENAMED já aconteceu" quando houver próxima edição), `src/components/caderno/CadernoHero.tsx`, `src/components/caderno/CadernoModeCards.tsx`, `src/lib/retaFinalPlan.ts` (se precisar aceitar data nula). Verifique outros usos com `grep -rn ENAMED_DATE src`.
- Testes: unitários de `editions.ts` (fuso, dia 0, sem datas), `retaFinalPlan.test.ts` com data nula, teste do countdown.
- Aceite: com a data de 2027.1 nula, nenhuma tela mostra "já aconteceu" nem dias negativos; cadastrando uma data no banco, Reta Final e countdown usam essa data sem deploy.

**T2 — Integridade da prova no banco (S-02, S-03, S-04, S-05, R-04, R-15, R-16)** — só SQL + testes SQL
- `DROP POLICY "Users can insert own attempts"` + `REVOKE INSERT ON attempts FROM authenticated, anon`. Antes, confirmar com grep que o front não faz `.from('attempts').insert` (criação é via `create_attempt_guarded`, `create_offline_attempt_guarded`, presencial).
- Trigger `BEFORE INSERT OR UPDATE ON answers`: se a tentativa é `online`, rejeitar quando `status <> 'in_progress'` ou `now() > effective_deadline + interval '30 seconds'`. Offline/presencial gravam via RPC `SECURITY DEFINER` (`submit_offline_answers_guarded`, presencial) — o trigger dispara também para elas: **não bloquear** `attempt_type in ('offline','presencial')`. Verificar se `finalize_attempt_with_results_for_user` ou o reprocessamento escrevem em `answers` (não podem ser bloqueados).
- `prevent_direct_attempts_update`: proteger também `effective_deadline` e `started_at`.
- `get_attempt_question_results` e policy SELECT de `attempt_question_results`: só devolver quando `simulados.results_release_at <= now()` (admin com capacidade continua vendo).
- `get_ranking_for_simulado`: `DISTINCT ON (user_id)` pela melhor tentativa na janela (mesma lógica de `admin_get_ranking_for_simulado`, ver `20260624212300`) + gate `results_release_at <= now()`.
- **Pegar a definição atual de produção** de cada função antes de reescrever (repo pode estar defasado): `select pg_get_functiondef('public.<fn>'::regproc)` via MCP/SQL.
- Aceite: ver seção 7 (testes SQL).

**T3 — Comentário e questões fora da hora (S-06)** — SQL + front
- `REVOKE SELECT (explanation, explanation_image_url) ON questions FROM authenticated, anon` (se o Postgres exigir, revogar o SELECT da tabela e conceder coluna a coluna o resto).
- Policy de `questions`: SELECT só se o simulado for `published`/`test` e `now() >= execution_window_start` (admin com `content.manage` vê tudo).
- RPC `get_question_explanations(p_simulado_id uuid)` SECURITY DEFINER: devolve explicações só se `results_release_at <= now()` e o usuário tem tentativa finalizada no simulado, ou é admin.
- Leitores de `explanation` a ajustar (do grep): `src/services/simuladosApi.ts` (`getQuestions` faz `select('*', …)` ~:356-366 → colunas explícitas; `rowsToQuestion` ~:254-258), `src/pages/CorrecaoPage.tsx`, `src/pages/TriagemPage.tsx`, `src/pages/CadernoRevisaoPage.tsx`, `src/services/cadernoApi.ts`, `src/hooks/useActiveRecallSession.ts`, `src/lib/cadernoExport.ts`, `src/lib/pdf/gabaritoPdf.ts`, `src/lib/pdf/provaRevisadaPdf.ts`, `src/types/index.ts`. Admin (`src/admin/**`) lê como admin: confirmar que continua funcionando com o revoke (se não, RPC admin). Edge functions usam service role e não são afetadas.
- **Conflito de arquivo:** `simuladosApi.ts` também é tocado por T4. Rode T3 e T4 em sequência, ou dê a T3 só `getQuestions/rowsToQuestion` e a T4 só `submitAttempt` e integre com cuidado.
- Aceite: payload de `/prova` sem `explanation`; consulta REST a questões de simulado upcoming → 0 linhas; correção, triagem e caderno continuam mostrando o comentário após a liberação.

**T4 — Finalização que não perde nota (R-01, R-02, R-03 parcial, F-01)** — SQL + front
- Habilitar `pg_cron` (precisa de autorização do Felipe; em Supabase: `create extension if not exists pg_cron;`).
- `finalize_attempt_with_results_for_user`: novo parâmetro `p_auto_submit boolean default false`; aceitar questões em branco (contam como erradas) quando `p_auto_submit` ou `now() >= effective_deadline`. Manter a recusa em envio manual antes do prazo com questões em branco (comportamento atual de produto). Manter assinatura compatível (default) e o wrapper `finalize_attempt_with_results`.
- `process_attempt_reprocessing_queue`: usar `finalize_attempt_with_results_for_user(attempt_id, user_id, true)` em vez de depender de `auth.uid()`; marcar `processed`/`failed` com `last_error`.
- Job pg_cron a cada 5 min: (a) drenar a fila; (b) finalizar tentativas `online` `in_progress` com `effective_deadline + 2 min < now()` **criadas a partir da data do deploy** (filtro explícito por `created_at`), até o Felipe decidir o destino das antigas (decisão 10).
- Front: `src/services/simuladosApi.ts` `submitAttempt` (~:553-590) passa `p_auto_submit`; `src/hooks/exam/useExamLifecycle.ts` (time-up chama com `true`, trava a interação ao zerar o timer); mensagens de erro específicas (sem rede / sessão expirada / faltam questões).
- Testes: hook do lifecycle no time-up; SQL da finalização com 10/100 respondidas + prazo vencido.
- Aceite: tempo zera com questões em branco → nota sai; item novo na fila é processado em até 5 min.

**T5 — Preservação e PDF (D-11, A-09, S-07)** — SQL + admin + edge
- FKs `simulado_id` de `attempts`, `user_performance_history` e `attempt_question_results` (e `answers.question_id`, se for CASCADE) → `ON DELETE RESTRICT`.
- `src/admin/pages/AdminSimulados.tsx` (~:172-186 e botão ~:412-422): desabilitar "Excluir" quando houver tentativas, com tooltip. `src/admin/services/adminApi.ts` `deleteQuestionsForSimulado` (~:216-228): parar de ignorar erros; o banco já bloqueia via FK.
- `supabase/functions/generate-exam-pdf/index.ts` (~:574-602): exigir tentativa `offline` do próprio usuário com a janela aberta, ou capacidade admin (`admin_require`/`has_capability`); `force` só para admin. Não fazer deploy sem ok do Felipe.
- Aceite: excluir simulado com tentativa → erro claro; PDF sem tentativa → 403.

### Tarefas do orquestrador (não vão para o OpenCode)

- **F-02 drift (mínimo da Fase 0):** trazer para o repo as 6 migrations não rastreadas do checkout principal; criar o arquivo de `20260906215529_presencial_sempre_entra_no_ranking` a partir de `select array_to_string(statements, E'\n') from supabase_migrations.schema_migrations where version='20260906215529'`; mover `supabase/migrations/20260420000000_security_hardening.sql` ("NÃO APLICAR") e `_STAGING_20260605140000_security_hardening_rework.sql` para `archive/migrations/`. O baseline completo (`db diff` vazio) fica para o início da Fase 1.
- **I-01 HubSpot:** o trigger `notify_hubspot_new_user` chama `hubspot-contact-sync` sem `x-internal-secret` → 403 (confirmado em `net._http_response`). Descobrir o nome do secret que a função espera (`supabase/functions/hubspot-contact-sync/index.ts` ~:80-122), guardá-lo no Vault e reescrever o trigger para lê-lo de `vault.decrypted_secrets`. Backfill dos cadastros desde ~abril via modo bulk da função: **pedir ok ao Felipe antes** (envia dados ao HubSpot).
- **I-05 alertas de gabarito:** depois do `pg_cron`, aplicar `20260817160000_gabarito_key_alerts.sql` e `…160100_…_cron.sql` (o cron grava o secret em texto: preferir ler do Vault).

### Fora da Fase 0 por depender de decisão do Felipe

- **Decisão 10:** destino das 399 tentativas na fila + 1.655 `in_progress` vencidas. Recomendação: finalizar como treino (`is_within_window=false`) e avisar os 399.
- **S-08 SSO:** `sso-magic-link` devolve link de login de qualquer e-mail (modo unsigned foi decisão consciente, memória `sso-segment-trust-model.md`). Exige combinar HMAC com a SanarFlix.
- **S-09:** funções fora do repo em produção (`gemini-diag`, `s5-oneoff-upload`, `oneoff-s4-images`, `mentoria-export`). `mentoria-export` pertence a trabalho ativo (worktree `enamed-arena-mentoria-export`); `oneoff-s4-images` é slot reutilizável. **Não apagar sem o Felipe.**

## 6. Ordem sugerida

1. Orquestrador: F-02 mínimo (commit neste branch).
2. Onda 1 no OpenCode (paralelo, `--worktree`): T1, T2, T5. Depois T3 e T4 (compartilham `simuladosApi.ts`).
3. Integrar cada job após revisar e rodar lint/tsc/testes neste worktree.
4. Ensaiar as migrations (seção 7).
5. Pedir ok ao Felipe para: habilitar `pg_cron`, aplicar as migrations em produção, deploy do `generate-exam-pdf`, HubSpot.
6. PR `feat/fase0-2027` → `main`. Publicar o front só depois das migrations aplicadas (o front de T3/T4 depende das RPCs novas).

## 7. Como validar o SQL sem Docker

Opções, em ordem de preferência:
1. **Branch do Supabase** (MCP `create_branch`; tem custo — consultar `get_cost` e pedir ok). Aplicar todas as migrations novas na branch e rodar os testes.
2. **Transação com rollback em produção** (`begin; <migration>; <asserts>; rollback;`), só com ok explícito do Felipe, fora de janela de simulado (hoje não há janela aberta).

Testes SQL mínimos (como `authenticated` simulando `request.jwt.claims`):
- INSERT direto em `attempts` → erro 42501.
- upsert em `answers` de tentativa online `submitted` → erro; de tentativa com prazo + 31s vencido → erro; offline via `submit_offline_answers_guarded` → ok.
- UPDATE de `effective_deadline` → P0001.
- `get_attempt_question_results` antes de `results_release_at` → 0 linhas.
- `select explanation from questions` como authenticated → permission denied; `get_question_explanations` após a liberação → linhas.
- Finalize com 10/100 respondidas e prazo vencido → `submitted`, `score_percentage = 10`.
- Ranking S1–S7 antes × depois das migrations: idêntico, exceto os 28 pares duplicados (dedupe esperado).

## 8. Fatos de produção úteis (03/11/2026)

- 7 simulados (S1–S7, 100 questões, 300 min), janelas de 05/04 a 06/09/2026; nenhum aberto agora.
- 10.178 usuários (pro 550); 8.059 tentativas: submitted 3.786 · in_progress 1.655 · offline_pending 2.618 · expired 0.
- Fila `attempt_processing_queue`: 399 `pending` (06/04 → 02/11), todas com a tentativa `in_progress`.
- `questions.area` com 16 grafias (tema da Fase 1, D-17). Todas as 700 questões têm 4 alternativas.
- Notas de corte: `enamed_cutoff_scores`, 1.058 linhas, sem ano.

## 9. Depois da Fase 0

Fase 1 (meta 31/01/2027): `exam_editions` completo + `simulados.edition_id` + backfill 2026, admin de edições e clonagem, matriz/formato por edição, corte com referência, front por edição, edição-alvo do aluno. Detalhes, SQL de referência e estratégia de migração na seção 4 (Entregável C) de `docs/auditoria-enamed-2027.md`.
