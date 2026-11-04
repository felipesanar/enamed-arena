# Auditoria e plano de evolução: Plataforma de Simulados → ENAMED 2027.1 / 2027.2

**Data:** 03/11/2026 · **Base analisada:** `origin/main` @ `18dead5` (06/09/2026) + banco de produção (consultas só de leitura) · **Escopo:** investigação, diagnóstico e plano. Nada foi alterado no código, no banco ou nas edge functions.

> **Aviso sobre a base de código.** O `main` local está **80 commits atrás** de `origin/main` (e 2 à frente, só docs). A auditoria usou um snapshot de `origin/main`. Os caminhos citados (`arquivo:linha`) se referem a esse snapshot. Migrations são citadas pelo nome do arquivo no repo. Quando o fato veio de produção, está marcado **[PROD]**.

> **Status em 04/11/2026:** S-01 resolvido (função removida de produção e do repo, PR #29). CI do `main` voltou a ficar verde (PR #30: install do CI, lint, pins das Edge Functions e gate de audit com exceções por advisory). Todos os demais itens seguem abertos.

**Legenda:** **[F]** fato verificado no código · **[PROD]** fato verificado no banco/infra de produção · **[I]** inferência · **[D]** decisão de produto pendente · **[R]** recomendação.

---

## 0. Sumário executivo

### 0.1 O que precisa de ação antes de qualquer trabalho de 2027 (risco ativo hoje)

| # | Achado | Evidência | Por que agora |
|---|---|---|---|
| 1 | **A edge function `temp-change-email` está ATIVA em produção com `verify_jwt=false`.** Ela troca o e-mail de **qualquer** usuário a partir de `{from: userId, to: email}`, sem checar quem chama. Combinada com "esqueci a senha", permite tomar qualquer conta, inclusive de admin. | [PROD] `list_edge_functions`; [F] `supabase/functions/temp-change-email/index.ts:1-23` | **Resolvido:** removida de produção em 03/11/2026 (endpoint responde 404) e do repo no PR #29. |
| 2 | **Qualquer usuário logado pode inserir tentativas direto na tabela `attempts`** com `score_percentage` arbitrário e `is_within_window=true`. Isso entra no ranking. | [PROD] policy `Users can insert own attempts` (with_check só `auth.uid() = user_id`), `GRANT INSERT` para `authenticated`, nenhum trigger de INSERT | Integridade do ranking de qualquer edição. |
| 3 | **O gabarito vaza durante a janela aberta.** Quem envia a prova cedo lê `correct_option_id` via `get_attempt_question_results` / RLS de `attempt_question_results`, sem gate de `results_release_at`. O **comentário** (`questions.explanation`), que costuma trazer "Resposta: Alternativa X", é legível por qualquer logado a qualquer momento, inclusive para simulados futuros. | [PROD] RPC sem `results_release_at`; policy `Anyone can read questions USING (true)`; privilégio de coluna `explanation` = true. [F] `simuladosApi.ts:360-366` traz `*` para o cliente durante a prova | Compromete a validade do ranking de qualquer simulado. |
| 4 | **Respostas podem ser alteradas depois do envio e depois do prazo.** O servidor não impõe o tempo da prova. | [PROD] `answers` sem trigger de status/prazo; `finalize`/`update_progress` sem checar `effective_deadline`; trigger `prevent_direct_attempts_update` não protege `effective_deadline` | Junto com o item 3: ver o gabarito → reescrever as respostas → um reprocessamento lê as respostas adulteradas. |
| 5 | **399 alunos clicaram em finalizar (ou o tempo acabou) e ficaram sem nota.** A finalização exige 100% das questões respondidas, falha, a tentativa entra numa fila de reprocessamento **que nada consome**, e fica em `in_progress` para sempre. | [PROD] `attempt_processing_queue`: 399 `pending` (06/04 → 02/11), as 399 tentativas ainda `in_progress`; `finalize_attempt_with_results_for_user` levanta "Cannot submit: % question(s) unanswered"; **extensão `pg_cron` não instalada** | Perda de resultado de aluno hoje, e o mesmo bug em 2027. |
| 6 | **A data do ENAMED está fixa no código: `ENAMED_DATE = 2026-11-28`.** A prova oficial de 2026 foi em **13/09/2026** (Edital Inep 71/2026 republicado). Contagem regressiva, Reta Final e o modo do Caderno usaram a data errada no ciclo inteiro e **param de funcionar em 28/11/2026 (daqui a 25 dias)**. | [F] `src/components/caderno/PageHero.tsx:13` (desde `eb3fb19`, 06/06/2026) | Feature PRO (Reta Final) fica morta a partir de 28/11 até um deploy. |
| 7 | **Novos cadastros não chegam ao HubSpot.** O trigger `notify_hubspot_new_user` chama a função sem o secret interno, e a função responde **403**. | [PROD] `net._http_response`: as 4 últimas chamadas (hoje, 03/11) = 403 `Forbidden`; trigger sem `x-internal-secret` | Funil de CRM/marketing para 2027 sem leads novos (1.006 cadastros desde 07/09). |
| 8 | **Produção e repositório divergem.** Versões de migration diferentes; hotfix só em produção (`presencial_sempre_entra_no_ranking`); migrations só no repo e nunca aplicadas (`gabarito_key_alerts` + cron); DDL documentada só em `supabase/migrations-log.md`; 6 migrations locais nunca commitadas; 4 edge functions em produção que não estão no repo (`gemini-diag`, `s5-oneoff-upload`, `oneoff-s4-images`, `mentoria-export`). | [PROD] `supabase_migrations.schema_migrations` (175 entradas) × 168 arquivos; `list_edge_functions` | **Pré-requisito** de qualquer programa de mudança de schema: hoje não dá para ensaiar uma migração com segurança. |

### 0.2 O diagnóstico de 2027 em uma frase

**A plataforma não tem o conceito de edição.** Não existe coluna, tabela ou config de ano/edição/ciclo em lugar nenhum ([F] grep em código + 168 migrations; [PROD] schema). A premissa de ciclo único é **implícita**: agregações vitalícias (média, evolução, comparativo, KPIs, admin), ordenação global por `sequence_number` (sem UNIQUE), uma data de prova fixa, uma matriz de áreas fixa, notas de corte sem ano, perfil acadêmico único lido "ao vivo" pelo ranking, e o rótulo "ENAMED 2026" escrito em 15+ lugares. Trocar "2026" por "2027" **não resolve nada**: a correção estrutural é introduzir uma entidade `exam_editions` e fazer simulados, notas de corte, matriz, datas e o alvo do aluno apontarem para ela.

### 0.3 As 5 decisões de arquitetura que evitam retrabalho em 2028+

1. **Uma tabela `exam_editions`** como fonte única de verdade de: código (`2027.1`), status (planejada → em preparação → ativa → encerrada → arquivada), data da prova (com flag "confirmada"), formato (questões/duração/alternativas), matriz de áreas e edição de referência da nota de corte. Abrir 2028.1 = inserir uma linha pelo admin.
2. **`simulados.edition_id NOT NULL`** com `UNIQUE (edition_id, sequence_number)`. Todo resultado já está amarrado a `simulado_id`, então a dimensão chega a tentativas, histórico, caderno e alertas por join, sem mexer em chaves primárias.
3. **Foto (snapshot) na tentativa no momento da finalização:** `edition_id`, `specialty_id`, `target_institution_ids`. O histórico fica congelado: trocar o perfil em 2027 não reescreve o ranking filtrado de 2026.
4. **Edição ≠ status de publicação.** Nunca "arquivar 2026" mudando `simulados.status` para `archived`: as RLS e RPCs atuais esconderiam alternativas, histórico e correção ([F] seção A.5). O ciclo de vida da edição mora em `exam_editions.status`.
5. **Análises com escopo explícito:** por padrão, na edição; visão histórica só por opção e com ressalva estatística. Treino (`is_within_window=false`) fica fora dos KPIs de edição.

### 0.4 Datas que dirigem o cronograma

| Data | Evento | Fonte |
|---|---|---|
| **06/11/2026** | Prazo de sanção do PLV 14/2026 (conversão da MP 1.370) | CNN, 02/11/2026 |
| **28/11/2026** | `ENAMED_DATE` fixo no código "expira": countdown some e Reta Final entra em "a prova já passou" | [F] |
| **04/12/2026** | Resultado individual oficial do ENAMED 2026 | Edital Inep 71/2026 (republicado) |
| **08/01/2027** | Resultado final do Enare 2026/2027 (via HU Brasil) | Medway, citando o edital (não lido diretamente) |
| ~abr/2027 (**não oficial**) | Provável prova do 2027.1 | Projeção independente; **sem edital** |
| [I] ~jan–fev/2027 | Início provável da série de simulados Sanar para o 2027.1 (em 2026 o S1 abriu ~5 meses antes da prova) | Inferência a partir do calendário de 2026 |

**Recomendação:** concluir a Fase 0 até **27/11/2026** e a Fase 1 até a **abertura do primeiro simulado mirando o 2027.1** (meta interna sugerida: 31/01/2027; ajustar quando o Inep publicar o edital).

---

## 1. Validação das premissas do ENAMED 2027 (seção 10 do pedido)

Pesquisa feita em 03/11/2026 em fontes oficiais (Inep/gov.br, DOU, Câmara, Senado) e imprensa. As fontes estão no Apêndice B.

| Tema | Situação | Detalhe |
|---|---|---|
| **Periodicidade semestral** | **Confirmada** (norma) | MP nº 1.370, de 19/06/2026, incluiu o art. 9º-B, § 2º, na Lei 12.871/2013: "O Enamed será realizado semestralmente". Inep (nota de 12/08, atualizada em 27/10/2026): "a partir de 2027". Convertida no PLV 14/2026 (aprovado em 15/10). **Sanção pendente** (prazo 06/11). |
| **Calendário 2027.1 / 2027.2** | **Não confirmado** | Não há edital, inscrição, data de prova nem de resultado. Datas que circulam em cursinhos são **rumor**. |
| **Calendário 2026** (contexto) | Confirmado | Prova em **13/09/2026**; reaplicação em 18/10; gabarito preliminar em 15/09; resultado individual em **04/12/2026**. |
| **Público** | Confirmado (regras atuais) | 1ª etapa: 8º semestre (fim do 4º ano), obrigatória. 2ª etapa: 12º semestre (concluintes), obrigatória. "Demais participantes": voluntários (médicos formados que querem nota para o Enare). Alunos do 11º semestre em 2026 → **obrigados no 2027.1**. |
| **Mudança de público aprovada (pendente de sanção)** | Premissa | Três etapas (2º, 4º e 6º ano) com média ponderada, e proficiência exigida para o CRM, **só para quem ingressou a partir de 19/06/2026**. Na prática, efeito a partir de ~2028+. |
| **Formato** | Confirmado (2026) / premissa (2027) | 100 questões, **4 alternativas**, **5 horas**, um dia. Sete áreas (Portaria Inep 478/2025): Clínica Médica, Cirurgia Geral, GO, Pediatria, **MFC**, **Saúde Mental**, **Saúde Coletiva**. Não há pesos oficiais por área. |
| **Avaliação** | Confirmado | TRI, escala de proficiência; **Proficiente ≥ 60,0**. Parâmetros por edição saem em nota técnica posterior. |
| **Uso na residência (Enare)** | Confirmado | Validade de 3 anos; o Enare usa **a maior nota válida** entre as edições (itens 5.5/5.6 do edital). Com o PLV, só nota proficiente valeria para acesso direto (pendente). Enare 2027/2028: sem edital. |

**Implicações para o produto (fato → decisão):**
- **[I]** Um mesmo aluno pode fazer **2027.1 e 2027.2** (a melhor nota vale). Logo, a "edição-alvo" do aluno **não é exclusiva** e pode mudar. O modelo precisa de "próxima edição-alvo" + histórico, não de um campo imutável.
- **[I]** O público natural se amplia: concluintes (12º semestre) **e** 4º ano (8º semestre), mais voluntários formados. Perguntar "**quando você conclui o curso**" (ano/semestre) permite **derivar** a edição em vez de pedir ao aluno que adivinhe "2027.1 ou 2027.2".
- **[F]** A plataforma assume formato e matriz que **já divergem** do oficial: os prompts de IA e as heurísticas dizem "100q em 4h" (`gemini-comparative-summary/index.ts:203,443`; `comparativeInsights.ts:83`), mas o oficial é 5h (e os simulados têm 300 min). A matriz interna tem **6 áreas** (MFC + Saúde Coletiva fundidas, pesos que somam 1,05 e um `TODO: validar pesos`) contra **7 oficiais** (`src/lib/enamedBlueprint.ts:29-60`).
- **[I]** Como a prova oficial é TRI (escala de proficiência) e a plataforma mostra % de acertos, qualquer comparação "sua nota × corte/proficiência" é **estimativa**. Isso precisa aparecer na interface.
- **[R]** Nenhuma regra do exame deve ficar no código: formato, matriz, data, critério de proficiência e edição de referência de corte vão para `exam_editions` / `exam_blueprints`, editáveis pelo admin.

---

## 2. Entregável A — Diagnóstico da plataforma atual

### A.1 Arquitetura

| Camada | Tecnologia | Observações |
|---|---|---|
| Front | Vite 5 + React 18 + TS + shadcn/Tailwind + Framer Motion + React Query 5 | SPA; todas as páginas com lazy loading; `manualChunks` configurado. Duas configs de deploy (`netlify.toml` e `vercel.json`): qual está ativa não foi verificado. |
| Backend | Supabase (Auth + Postgres com RLS + RPCs `SECURITY DEFINER` "_guarded") | 33 tabelas em `public`, 1 view (`ranking_simulado`, legada). Sem materialized views. |
| Edge functions | 29 ativas em produção (Deno) | IA (Gemini 2.5 Flash, fixo em 9 lugares), e-mail (Novu), SSO SanarFlix, HubSpot, PDF offline, presencial, MCP, admin. **Todas com `verify_jwt=false`**, exceto as duas one-off. |
| Jobs | **Nenhum.** `pg_cron` não está instalado [PROD] | Migrations de cron (`caderno_reminders_cron`, `gabarito_key_alerts_cron`) nunca rodaram em produção. |
| Observabilidade | `logger` (só `error` em produção), `trackEvent` → `analytics_events` | Sem Sentry/APM; sem `unhandledrejection`; edge functions só com `console.*`. |
| Testes | Vitest: 102–109 arquivos (admin 47, lib 16…); Playwright: 1 spec de smoke (rotas públicas) | **E2E fora do CI.** Nenhum teste do motor de prova (`useExamLifecycle`, `useExamStorageReal`, timer) nem das RPCs SQL. CI: lint, typecheck, test, build, audit. |

**Volume de produção em 03/11/2026 [PROD]**

| Métrica | Valor |
|---|---|
| Simulados | 7 (S1–S7), 100 questões e 300 min cada; janelas de 05/04 a 06/09/2026; título com erro de digitação: "SImulado 5" |
| Usuários (`auth.users`) | 10.178; segmentos: standard 6.959, guest 2.669, **pro 550** |
| Onboarding concluído | 5.822 |
| Tentativas | 8.059: `submitted` 3.786 · `in_progress` 1.655 (**todas com prazo vencido**) · `offline_pending` 2.618 · `expired` **0** |
| Tipos de tentativa | online 4.893 · offline 3.166 |
| Alunos com ≥1 prova enviada | 1.461 (124 fizeram os 7; 682 fizeram só 1); PRO com prova enviada: 237 |
| Cadastros desde 07/09 (sem simulado aberto) | 1.006 |
| Maiores tabelas | `analytics_events` 193 mil linhas (163 MB), `answers` 394 mil, `attempt_question_results` 379 mil |
| Pico observado | 90 usuários distintos/hora em eventos; ≤9 provas iniciadas a cada 10 min |

**[I]** Volume e concorrência **não** são o gargalo (as janelas de 7 dias diluem a carga). Os riscos são de **confiabilidade, integridade e modelo**.

### A.2 Módulos e funcionalidades (status real)

| Módulo | Status | Observação crítica |
|---|---|---|
| Listagem de simulados (`/simulados`) | Implementado | Lista plana, sem agrupamento; status derivado no cliente. |
| Detalhe e pré-prova | Implementado | Rótulo "ENAMED 2026" fixo (`SimuladoDetailPage.tsx:268`). |
| Motor de prova (`useExamFlow` → `hooks/exam/*`) | Implementado com **falhas graves** | Prazo não imposto pelo servidor; envio automático falha com questão em branco; flush perdido ao navegar; duas abas = last-write-wins. |
| Prova offline (PDF + gabarito digital) | Implementado | 2.618 gabaritos nunca enviados; o PDF é baixável por qualquer logado (ver S-07). |
| Presencial (QR → gabarito → resultado, cadernos A/B) | Implementado | Entrada no ranking depende da janela online; hotfix só em produção. |
| Resultado, correção, gabarito, desempenho por simulado | Implementado | Escopo por simulado: OK. Só o rótulo é problema. |
| Ranking por simulado + filtros (especialidade/instituição) + nota de corte | Implementado | Padrão = **simulado mais antigo** (bug); sem deduplicação; filtro usa o perfil atual; corte sem ano. |
| Comparativo (evolução entre simulados) | Implementado | Mistura tudo; deltas e σ entre provas diferentes. |
| Home premium (hero, KPIs, ranking, countdown) | Implementado | Hero preso em "resultado liberado"; "Top X%" = `100 − nota` (não é percentil); KPIs vitalícios. |
| Caderno de Erros v2 / flashcards / SRS / Reta Final / Triagem | Implementado | Reta Final presa a data fixa; sem paginação (teto de 1.000; máximo atual 215/usuário). |
| Prof. Sanor (IA) | Implementado | "Corte" fixo de 50%; formato "4h" errado; sem edição. |
| Lembretes do Caderno (Novu) | **Scaffold** | No-op sem `CADERNO_REMINDER_WORKFLOW_ID`; sem cron; o toggle "Reta final" nas preferências **não faz nada**. |
| Alertas de gabarito suspeito | **Parcial** | Função publicada; tabela, RPC e cron **não aplicados** em produção. |
| Onboarding (especialidade + instituições) | Implementado | Sem edição-alvo nem etapa/ano de conclusão. |
| SSO SanarFlix (segmento) | Implementado (modo unsigned) | Devolve link de login para qualquer e-mail; segmento nunca é rebaixado (PRO perpétuo). |
| Admin (18 páginas, RBAC por capacidades, auditoria) | Implementado | Sem edição/ciclo; sem clonar simulado; excluir simulado apaga tentativas em cascata; dashboards vitalícios ou com janela de no máximo 90 dias. |
| Analytics (`analytics_events` + RPCs admin) | Implementado | Eventos não carregam edição. |
| Command Palette, `Index.tsx`, `KpiGrid` e +10 componentes | **Código morto** | Não estão em nenhuma rota. `KpiGrid` contém "Seu ciclo de {ano}": armadilha para quem mexer em ciclo. |

### A.3 Como os simulados são criados, organizados, disponibilizados e realizados

1. **Criação (admin)** [F]: `AdminSimuladoForm.tsx` grava `title`, `slug` (UNIQUE global), `sequence_number` (**sem UNIQUE**), `duration_minutes`, `execution_window_start/end`, `results_release_at` (NOT NULL: não existe "data a definir") e `status` (`draft|published|test`; `archived` existe no enum, mas não aparece na UI). Fusos: o admin digita em America/Sao_Paulo e o sistema converte para UTC (`src/admin/lib/timezone.ts`).
2. **Questões** [F]: upload XLSX → `admin-upload-questions` em lotes de 100, **não atômico**: erros por linha são ignorados com `continue`, e a resposta só diz `{inserted}`. Não há `UNIQUE(simulado_id, question_number)` [PROD]. A questão **pertence** ao simulado (FK com CASCADE): não há banco de questões nem versionamento.
3. **Publicação** [F]: o gate de gabarito roda só no cliente e libera mesmo se falhar; o `status` é gravado com UPDATE direto.
4. **Disponibilização** [F]: o status do aluno é **derivado no cliente** (`deriveSimuladoStatus`, `src/lib/simulado-helpers.ts:8-51`) pelo relógio do navegador: `upcoming → available → in_progress → closed_waiting → completed`, e `available_late` (treino) depois da janela.
5. **Realização** [F]: `create_attempt_guarded` (online) | `create_offline_attempt_guarded` + `submit_offline_answers_guarded` | presencial. Uma tentativa por `(simulado, usuário, tipo)`: não é possível refazer. `is_within_window` é calculado no servidor no início (online) ou no envio do gabarito (offline/presencial).
6. **Finalização** [F/PROD]: `finalize_attempt_with_results` → `_for_user` corrige e grava `attempt_question_results` (cópia do gabarito), `user_performance_history` (**inclusive treino**) e recalcula `user_performance_summary` (vitalício).

### A.4 Como os usuários se associam aos simulados

Não há matrícula nem inscrição: **todo usuário vê todos os simulados `published`** ([F] RLS `simulados`: SELECT se `status='published'`). A associação é a própria tentativa. Segmentos (`guest`/`standard`/`pro`) controlam só funcionalidades (comparativo, caderno), não quais simulados aparecem. **[I]** Isso é bom para edições múltiplas: não é preciso matricular ninguém em 2027.1. O que falta é **ordenar, agrupar e filtrar** por edição.

### A.5 Persistência de tentativas, respostas, resultados, estatísticas e histórico

| Dado | Onde | Cópia ou ao vivo? |
|---|---|---|
| Respostas | `answers` (upsert por `attempt_id, question_id`) | Ao vivo; editáveis sem trava de status/prazo [PROD] |
| Correção | `attempt_question_results` | **Cópia** (`correct_option_id`, `is_correct`) |
| Nota | `attempts.score_percentage`, `total_correct` | Cópia |
| Histórico | `user_performance_history` (1 por tentativa, inclui treino) | Cópia |
| Resumo | `user_performance_summary` (PK `user_id`, **vitalício**) | Derivado |
| Por área | `get_user_area_scores_by_simulado`, `get_area_score_history` | **Ao vivo** via JOIN em `questions.area`: editar a área reescreve o histórico de 2026 |
| Ranking | `get_ranking_for_simulado` (por simulado, só na janela) | **Ao vivo** via JOIN em `onboarding_profiles`: trocar o perfil reescreve os filtros antigos |
| Caderno | `error_notebook` (cópia de `simulado_title`, `question_text`) | Cópia; `simulado_id ON DELETE SET NULL` |

**Armadilha de preservação [F/PROD]:** `attempts.simulado_id → simulados ON DELETE CASCADE`, e o botão "Excluir simulado" do admin fica sempre habilitado (`AdminSimulados.tsx` ~412-422). Excluir um simulado de 2026 apaga em silêncio tentativas, histórico e correções.

**Qualidade de dado [PROD]:** `questions.area` tem **16 grafias** para cerca de 7 áreas reais: "Cirurgia" (52) e "Cirurgia Geral" (72); "Preventiva" (51), "Saúde Coletiva / Preventiva" (34) e "Preventiva " (com espaço); MFC em 4 variantes; "Obstetrícia" e "Ginecologia" separadas de "Ginecologia e Obstetrícia". Todo desempenho por área entre simulados (e, em 2027, entre edições) está fragmentado. O blueprint "casa" por substring no front, mas as RPCs SQL agrupam pelo texto cru.

### A.6 Gestão administrativa

RBAC por capacidades (`role_capabilities`, `has_capability`); policies migradas para capacidades, mas as edge functions de admin ainda checam `has_role('admin')`: um `content_editor` vê o upload e recebe 403. Dashboards (`admin_*`) recebem `p_days` (máx. 90 na UI) ou nada (vitalício). Os únicos recortes por simulado são roster, estatísticas de questão, distribuição e por área. Não há relatório por edição, clonagem, arquivamento nem tela de nota de corte.

### A.7 Respostas diretas às 10 perguntas da seção 2

1. **Arquitetura:** SPA React + Supabase (RLS + RPCs guarded) + 29 edge functions; sem jobs; sem APM (A.1).
2. **Módulos:** tabela A.2.
3. **Ciclo de vida do simulado:** A.3 (status derivado no cliente; janela gravada no simulado).
4. **Associação aluno ↔ simulado:** implícita pela tentativa; todos veem todos os publicados (A.4).
5. **Persistência:** A.5 (mistura de cópias e leituras ao vivo, que afetam a preservação).
6. **Admin:** A.6.
7. **Regras amarradas a 2026:** explícitas → `ENAMED_DATE` (28/11/2026), 15+ literais "ENAMED 2026" (UI + PDF), "Seu resultado sai em 07/09" (`useExamLifecycle.ts:179`), blueprint fixo, formato "4h", `GOAL=50`. Implícitas → tudo o que agrega vitaliciamente ou ordena por `sequence_number`.
8. **Funcionalidades que pressupõem ciclo único:** home (hero, KPIs, ranking, countdown), comparativo, evolução/sparkline, "média atual", Reta Final, Prof. Sanor, notas de corte, trava do onboarding (`is_any_simulado_window_open` global), dashboards admin, `admin_intel_insights` (compara "as duas últimas linhas"), landing (timeline), listagem, seletor do ranking.
9. **Dependências técnicas que dificultam várias edições:** ausência de entidade de edição; `sequence_number` sem unicidade como chave de ordenação/rótulo/`dataKey` de gráfico; leitura ao vivo do perfil e das áreas; drift de migrations (não dá para ensaiar com segurança); ausência de jobs (`pg_cron`); `types.ts` defasado e `as any` (~160).
10. **Limitações que comprometem a experiência em 2027:** contagem e Reta Final mortas a partir de 28/11; hero e ranking da home apontando para 2026; listas misturadas; comparações estatisticamente inválidas entre edições; perda de resultado na finalização; vazamento de gabarito.

### A.8 Pontos que pedem investigação adicional

- Corpo real em produção das RPCs que só existem em `migrations-log.md` (`admin_intel_insights`, `admin_performance_by_*`, `admin_set_correct_option`).
- Origem, ano e escala dos 1.058 registros de `enamed_cutoff_scores` (parecem cortes do Enare por instituição/especialidade, de 0 a 100; o ano não está registrado).
- Se `getClaims` aceita a anon key no `generate-exam-pdf`. Se aceitar, a prova vaza **sem login**.
- Qual host de deploy está ativo (Netlify ou Vercel) e os headers de segurança.
- Contrato do SSO com a SanarFlix para sinalizar PRO **por período** (rebaixamento).
- Por que 2.618 tentativas offline nunca tiveram gabarito enviado (produto ou UX?).
- Se o domínio `sanaflix.com` na allowlist é erro de digitação ou domínio legítimo.

---

## 3. Entregável B — Matriz completa de impactos

**Prioridade:** P0 = bloqueia 2027 ou risco ativo de dado/segurança · P1 = errado/confuso, mas não bloqueia · P2 = melhoria relevante · P3 = cosmético/higiene.
**Complexidade:** B = baixa · M = média · A = alta.

### B.1 Segurança e integridade (independente de 2027, mas pré-requisito)

| ID | Área | Localização | Situação atual | Problema | Mudança necessária | Prio | Compl. | Dependências | Critério de aceite |
|---|---|---|---|---|---|---|---|---|---|
| S-01 | Auth | edge `temp-change-email` | Ativa, `verify_jwt=false`, troca o e-mail de qualquer usuário sem checar quem chama [PROD] | Tomada de qualquer conta | Remover a função em produção e no repo | P0 | B | Autorização | `POST /functions/v1/temp-change-email` → 404 |
| S-02 | Prova/Ranking | policy `Users can insert own attempts` em `attempts` | INSERT direto permitido com qualquer nota [PROD] | Fraude de ranking em qualquer edição | `DROP POLICY` + `REVOKE INSERT`; criar só via RPCs guarded | P0 | B | Conferir que o front não insere direto | INSERT como `authenticated` → erro 42501; os 3 fluxos (online/offline/presencial) seguem funcionando |
| S-03 | Prova | `answers` (RLS insert/update) | Sem checagem de status nem de prazo [PROD] | Alterar respostas depois do envio/prazo | Trigger BEFORE INSERT/UPDATE: rejeita se `attempts.status <> 'in_progress'` ou `now() > effective_deadline + 30s` (exceto offline/presencial via RPC) | P0 | M | S-04 | Teste SQL: upsert após submit → erro; após deadline+30s → erro |
| S-04 | Prova | trigger `prevent_direct_attempts_update` | Não protege `effective_deadline` nem `started_at` [PROD] | Aluno estende o próprio prazo | Incluir as colunas na lista protegida (ou remover a policy de UPDATE e usar só RPC) | P0 | B | — | UPDATE direto de `effective_deadline` → P0001 |
| S-05 | Resultado | `get_attempt_question_results` + RLS `attempt_question_results` | Gabarito liberado logo após o envio [PROD] | Vazamento durante a janela | Gate `results_release_at <= now()` na RPC e na policy | P0 | B | Front já trata "aguardando resultado" | Envio com janela aberta → 0 linhas; após a liberação → N linhas |
| S-06 | Prova | `questions` (`USING true`) + `getQuestions` (`select *`) | Comentário e questões de simulados futuros legíveis por qualquer logado [PROD/F] | Vazamento de gabarito e de prova futura | `REVOKE SELECT (explanation, explanation_image_url)` de `authenticated`; comentário via RPC com gate de liberação; policy de `questions` só para simulado publicado com `now() >= execution_window_start`; select explícito de colunas | P0 | M | Correção/Caderno precisam ler o comentário via RPC | Payload de `/prova` sem `explanation`; consulta a questões de simulado `upcoming` → 0 linhas |
| S-07 | Offline | edge `generate-exam-pdf` | Qualquer token válido baixa o PDF de qualquer simulado (inclusive futuro/rascunho); `force` aberto [F] | A prova de 2027.1 vaza antes da janela | Exigir tentativa offline do próprio usuário dentro da janela, ou capacidade admin; `force` só admin | P0 | B | — | Usuário sem tentativa → 403 |
| S-08 | SSO | edge `sso-magic-link` | Devolve no corpo a URL de login de qualquer e-mail; modo unsigned; controle só por `Origin` (forjável) [F] | Tomada de conta e autopromoção a PRO | Modo hardened (HMAC da SanarFlix) **ou** enviar o link por e-mail em vez de devolvê-lo; nunca devolver `actionLink` | P0 | A | **[D]** contrato com a SanarFlix (ver memória: o modo unsigned foi uma decisão consciente, v60) | POST sem assinatura válida não recebe URL |
| S-09 | Infra | edge functions fora do repo | `gemini-diag`, `s5-oneoff-upload`, `oneoff-s4-images`, `mentoria-export` ativas [PROD] | Superfície de ataque desconhecida | Revisar uma a uma; remover ou versionar | P1 | B | Autorização | Lista de funções em produção = pasta `supabase/functions` |
| S-10 | Admin | `admin_log_action` | Executável por qualquer `authenticated` [F] | Entradas falsas na auditoria | Exigir capacidade | P2 | B | — | Não admin → erro |
| S-11 | IA | `gemini-*`, `classify-exam-errors` | Sem checagem de usuário no código (`verify_jwt=false`) [F/PROD] | Custo de IA exposto | Validar JWT e aplicar rate limit por usuário | P2 | B | — | Chamada sem JWT → 401 |

### B.2 Confiabilidade do motor de prova

| ID | Área | Localização | Situação atual | Problema | Mudança necessária | Prio | Compl. | Dependências | Critério de aceite |
|---|---|---|---|---|---|---|---|---|---|
| R-01 | Finalização | `finalize_attempt_with_results_for_user` (`20260812100100:68-78`) | Recusa se houver questão em branco [PROD] | Envio automático por tempo falha; 399 alunos sem nota | Aceitar em branco (conta como erro) quando `p_auto_submit` ou `now() >= effective_deadline`; o cliente bloqueia a interação ao zerar | P0 | M | — | 10/100 respondidas + prazo vencido → `submitted`, 10% |
| R-02 | Finalização | `attempt_processing_queue` + `process_attempt_reprocessing_queue` | 399 `pending` desde 06/04; o processador usa `auth.uid()` (nulo no cron); sem cron [PROD] | Fila morta | Reescrever com `_for_user(attempt_id, user_id)` e agendar | P0 | M | F-01 (pg_cron), R-01 | Nenhum `pending` com mais de 10 min |
| R-03 | Ciclo de vida | `attempts.status` | 1.655 `in_progress` vencidas; `expired` nunca é atribuído [PROD] | Lixo de estado; "em andamento" eterno | Job que finaliza (ou marca `expired`) tentativas com `effective_deadline + 2 min < now()` | P1 | M | F-01, R-01, **[D]** o que fazer com as 1.655 históricas | Zero `in_progress` vencidas após o job |
| R-04 | Timer | `update_attempt_progress_guarded`, finalize | Sem checagem de prazo no servidor [PROD] | Tempo burlável (DevTools/relógio) | Prazo imposto no servidor (S-03 + `finished_at` limitado a `effective_deadline`) | P0 | M | S-03 | Upsert após deadline+30s rejeitado |
| R-05 | Persistência | `useExamStorageReal.ts:51-55, 108-143` | Debounce cancelado ao desmontar sem flush; ao retomar, o banco sobrescreve o local | Perda dos últimos ~2s ao navegar, deslogar ou expirar a sessão | Flush no unmount e em `visibilitychange`; merge pelo `lastSavedAt` mais novo; flush no evento `online` | P1 | M | — | Responder → desmontar em <2s → remontar: resposta presente no banco |
| R-06 | Concorrência | `answers` upsert; flush final envia tudo | Duas abas: a mais velha sobrescreve [F] | Respostas regredindo | `answers.client_updated_at` + upsert condicional; lock de aba (`BroadcastChannel`); chave local com `userId` | P1 | M | — | E2E com 2 abas: prevalece a resposta mais recente |
| R-07 | Retomada | `useExamStorageReal.ts:152-165` | Cache sem `attemptId` quando o banco falha no load | Prova "fantasma" que não envia | Guardar `attemptId` no cache e tentar `loadState` de novo em background | P1 | B | — | Banco cai no load e volta → envio funciona |
| R-08 | Criação | `create_attempt_guarded` (`20260812100400`) | Não bloqueia antes do início da janela [F] | Tentativa de "treino" antes da janela; o aluno é barrado quando ela abre | Restaurar o bloqueio `now < window_start` | P2 | B | — | RPC em simulado upcoming → erro |
| R-09 | Criação | mesma RPC | SELECT→INSERT com corrida (23505) | Toast de erro em clique duplo | `INSERT … ON CONFLICT DO NOTHING` + SELECT | P2 | B | — | 2 chamadas paralelas → mesmo id |
| R-10 | Integridade | `useExamIntegrity.ts:42-55` | `tab_exit_count` não atualiza o estado React | Contagem regride | `setState` + `GREATEST` na RPC | P2 | B | — | 3 saídas → 3 no banco |
| R-11 | Status | `deriveSimuladoStatus` (`:35` antes de `:40`) | `available_late` vence `in_progress` | Treino em andamento aparece como "já realizado", sem botão de continuar | Estado "treino em andamento" com CTA | P1 | B | — | Novo caso em `simulado-helpers.test.ts` |
| R-12 | Status/Fuso | `simulado-helpers.ts:71-81` | Relógio e fuso do cliente; datas sem indicar fuso | Status errado com relógio desviado; horário ambíguo fora de Brasília | `server_now` via RPC + formatação em `America/Sao_Paulo` com o sufixo "(horário de Brasília)" | P2 | B | — | Relógio +1h não mostra `available` antes da hora |
| R-13 | Copy | `useExamLifecycle.ts:179` | "Seu resultado sai em 07/09." fixo | Data errada em qualquer outro simulado | `formatDate(simulado.resultsReleaseAt)` | P1 | B | — | Texto igual à data configurada |
| R-14 | Deploy | `App.tsx` lazy + sem `vite:preloadError` | Chunk velho após deploy | Erro ao navegar depois do envio | Handler `vite:preloadError` → reload | P3 | B | — | Simular deploy → página recarrega |
| R-15 | Ranking | `get_ranking_for_simulado` | Sem deduplicação por usuário; 28 pares usuário/simulado com 2 tentativas na janela [PROD] | Aluno aparece 2×; posições e total errados | `DISTINCT ON (user_id)` pela melhor tentativa (igual ao admin) | P1 | B | — | Total de candidatos = usuários distintos |
| R-16 | Ranking | mesma RPC | Sem gate de `results_release_at` no servidor [PROD] | Ranking legível antes da liberação | Gate no servidor | P2 | B | — | Antes da liberação → 0 linhas |

### B.3 Modelo de dados e edição

| ID | Área | Localização | Situação atual | Problema | Mudança necessária | Prio | Compl. | Dependências | Critério de aceite |
|---|---|---|---|---|---|---|---|---|---|
| D-01 | Modelo | `simulados` (schema) | Sem edição/ano/ciclo [PROD] | Não dá para representar 2026/2027.1/2027.2 | Tabela `exam_editions` + `simulados.edition_id NOT NULL` (backfill 2026) | P0 | A | F-02 | Todo simulado com edição; abrir 2027.2 sem deploy |
| D-02 | Modelo | `simulados.sequence_number` | NOT NULL sem UNIQUE; usado como ordem global, rótulo "#N" e `dataKey` de gráfico (52+ usos) [F/PROD] | Colisão e intercalação entre edições | `UNIQUE (edition_id, sequence_number)`; ordenar por `(edition.exam_date, sequence_number)`; chaves de gráfico por `id` | P0 | M | D-01 | Inserir duplicata na mesma edição → erro; nenhuma chave de gráfico repetida |
| D-03 | Modelo | `simulados.slug` UNIQUE global | `simulado-1…7` | "simulado-1" colide em 2027 | Convenção `enamed-2027-1-simulado-1`; antigos intocados | P2 | B | D-01 | Links de 2026 continuam abrindo |
| D-04 | Nota de corte | `enamed_cutoff_scores` (1.058 linhas) + `get_cutoff_scores` | Sem ano/fonte; `DISTINCT ON … ORDER BY cutoff DESC` [PROD/F] | Ao carregar cortes novos, a função devolve o **maior corte entre os anos** | Colunas `reference_edition_id`/`source`/`reference_label`; chave única; RPC com `p_reference_edition` | P0 | M | D-01 | Com 2 anos carregados: 1 linha por chave, da edição pedida; 2026 inalterado |
| D-05 | Catálogo | `enamed_programs.vagas` | Sem ano | Vagas mudam a cada processo | `reference_edition_id` | P1 | B | D-01 | Onboarding mostra as vagas do processo vigente |
| D-06 | Desempenho | `user_performance_summary` + `recalculate_user_performance` + tool MCP `get-my-performance.ts:13` | Vitalício; inclui treino; sem gate de liberação | Média que mistura edições e vaza antes da liberação | Aposentar a tabela (o front já não a usa) ou fazer PK `(user_id, edition_id)`; o MCP usa RPC gated | P1 | M | D-01 | Tool MCP devolve só a edição pedida, só com resultados liberados |
| D-07 | Desempenho | `get_user_performance_summary/history` (`20260405000000`) | Sem edição; inclui treino; `p_limit` 20 | Série corta em ~1 ano; mistura | `p_edition_id`, `p_include_training`, sem limite fixo | P1 | M | D-01 | Home/Ranking 2027.1 só com pontos de 2027.1 |
| D-08 | Desempenho | `get_area_score_history`, `get_user_attempt_behavior_stats`, `get_caderno_pattern_data`, `get_confidence_calibration` | Vitalícios, incluem treino | Insights dominados por 2026 | `p_edition_id` opcional | P2 | M | D-01 | Insights mudam ao filtrar por edição |
| D-09 | Ranking | `get_ranking_for_simulado` (JOIN em `onboarding_profiles` ao vivo) | Filtro por especialidade/instituição usa o perfil de hoje | Trocar o perfil em 2027 reescreve o ranking de 2026 | Foto `specialty_id`, `target_institution_ids` em `attempts` na finalização (backfill com o perfil atual + flag `snapshot_backfilled`) | P2 | M | — | Trocar a especialidade não muda o ranking filtrado antigo |
| D-10 | Conteúdo | `questions` (FK do simulado, sem versão) | Editar área/tema reescreve estatísticas antigas; editar gabarito não reprocessa | Histórico mutável; reprocessamento manual (S5/S6) | Fase 1: RPC `admin_reprocess_simulado` (receita já validada nos incidentes). Fase 4: banco de questões versionado | P1 (RPC) / P3 (banco) | M / A | — | Corrigir gabarito → 1 RPC recalcula notas/ranking/histórico com relatório |
| D-11 | Preservação | FK `attempts.simulado_id ON DELETE CASCADE` + botão Excluir sempre ativo | Excluir simulado apaga o histórico [PROD/F] | Perda irreversível de 2026 | FK `RESTRICT` (attempts, history, aqr); botão bloqueado com tentativas; ação "Arquivar" | P0 | B | — | Excluir simulado com ≥1 tentativa → erro |
| D-12 | Conteúdo | `questions` + importador | Sem `UNIQUE(simulado_id, question_number)`; lotes não atômicos que engolem erros [PROD/F] | Questões duplicadas ou sem alternativas | Unique + RPC transacional `admin_import_questions` com relatório de falhas | P1 | M | — | Linha inválida → nada gravado (ou falhas linha a linha); reenvio duplicado → rejeitado |
| D-13 | Preservação | RLS de `simulados`/`question_options` + RPCs INVOKER | `archived` esconde alternativas e histórico | "Arquivar 2026" quebraria correção e desempenho | Regra explícita: edição encerrada ≠ simulado arquivado; RLS considera `archived` legível para quem tem tentativa | P1 | B | D-01 | Simulado `archived` com tentativa: correção abre |
| D-14 | Onboarding | `onboarding_profiles` | Sem edição-alvo nem ano/semestre de conclusão | Não personaliza por edição | `target_edition_id` (nulo = indeciso) + `expected_graduation_term` + histórico `user_edition_targets` | P1 | M | D-01, **[D]** | Edição derivada/escolhida; histórico preservado |
| D-15 | Onboarding | `save_onboarding_guarded` + `is_any_simulado_window_open` | Trava global: qualquer janela aberta bloqueia a edição do perfil | Com edições alternando, o perfil fica travado quase o ano todo | Trava só pela janela da edição do aluno; RPC própria para `target_edition` sem trava | P1 | B | D-14 | Janela 2027.2 aberta → aluno 2027.1 edita |
| D-16 | Higiene | `src/integrations/supabase/types.ts` | Defasado (sem tabelas presenciais, alerts…); 18 `rpc as any` | Tipos não protegem a migração | Regenerar após F-02 | P2 | B | F-02 | `typecheck` limpo sem `rpc as any` |
| D-17 | Qualidade de dado | `questions.area` (16 grafias) | Áreas fragmentadas [PROD] | Desempenho por área e longitudinal incorreto | Tabela `exam_areas` canônica (por blueprint) + `questions.area_id`; normalizar 2026 por mapeamento | P1 | M | C-02 | Distinct `area_id` por blueprint = 7 |

### B.4 Configuração, datas e regras do exame

| ID | Área | Localização | Situação atual | Problema | Mudança necessária | Prio | Compl. | Dependências | Critério de aceite |
|---|---|---|---|---|---|---|---|---|---|
| C-01 | Datas | `PageHero.tsx:13` `ENAMED_DATE` → `EnamedCountdownCard`, `CadernoPage:507`, `CadernoRetaFinalPage:228` | Fixo em 28/11/2026 (oficial: 13/09/2026) [F] | Datas erradas; quebra em 28/11 | **Hotfix Fase 0:** ler a data de config (tabela) com estado neutro sem data. **Fase 1:** `exam_editions.exam_date` + `getNextEditionDate(userEdition, now)` | P0 | B | — (hotfix) / D-01 | Em 29/11, com a data do 2027.1 cadastrada, a Reta Final planeja até ela sem deploy; sem data → estado "datas a confirmar", nunca "a prova já passou" |
| C-02 | Matriz | `src/lib/enamedBlueprint.ts` | 6 áreas, pesos que somam 1,05, TODO; usado pela Reta Final, upload e badge [F] | Diverge da matriz oficial (7 áreas) | `exam_blueprints` versionado por edição (Portaria 478/2025) | P1 | M | D-01 | Upload valida contra o blueprint da edição do simulado |
| C-03 | Formato | `gemini-comparative-summary:190,203,443`; `comparativeInsights.ts:83` | "100q em 4h" | Errado (oficial: 5h) | Formato vindo da edição | P1 | B | D-01 | Nenhum literal de duração em prompts |
| C-04 | IA | `gemini-performance-summary:50-56`, `gemini-comparative-summary:125` | `GOAL=50` como "nota de corte" | Meta inventada | Corte real da edição de referência, ou nenhuma | P2 | B | D-04 | Sem literal 50 como corte |
| C-05 | Admin | `src/admin/lib/constants.ts:2-7` | Período máximo de 90 dias | Um semestre não cabe | Filtro por edição + período livre | P2 | B | A-03 | Relatório de 180 dias possível |
| C-06 | IA | 9 lugares com `gemini-2.5-flash` | Modelo fixo | Descontinuação | Variável `GEMINI_MODEL` | P3 | B | — | Trocar o modelo sem deploy de código |

### B.5 Interface e comunicação

| ID | Área | Localização | Situação atual | Problema | Mudança necessária | Prio | Compl. | Dependências | Critério de aceite |
|---|---|---|---|---|---|---|---|---|---|
| U-01 | Listagem | `SimuladosPage.tsx:115,124,143` | `badge="ENAMED 2026"` | Rótulo errado em 2027 | Badge da edição atual do aluno | P1 | B | D-01 | — |
| U-02 | Pré-prova | `SimuladoDetailPage.tsx:268` | "Simulado #N · ENAMED 2026" | Simulado de 2027 rotulado 2026 | Edição do simulado | P1 | B | D-01 | — |
| U-03 | Ranking | `RankingPage.tsx:77,97,115`; `RankingHero.tsx:46` | "ENAMED 2026" fixo | Idem | Edição do simulado selecionado | P1 | B | D-01 | — |
| U-04 | Desempenho | `DesempenhoPage.tsx:91,113,132,151` | Idem | Idem | Idem | P1 | B | D-01 | — |
| U-05 | Nota de corte | `CutoffScoreModal.tsx:159` vs `:457` | Eyebrow "ENAMED 2026" contradiz o rodapé | Sem edição de referência | "Corte de referência: <processo/ano> · fonte" | P1 | B | D-04 | — |
| U-06 | PDF | `src/lib/pdf/pdfHelpers.ts:80,150` | Badge "ENAMED 2026" em todo PDF; rodapé "ENAMED Arena" (nome interno) | PDF de 2027 sai como 2026 | Edição como parâmetro; marca "Simulados SanarFlix" | P1 | B | D-01 | — |
| U-07 | Landing | `LandingFooter.tsx:46` | "· 2026" | Ano velho | Remover o ano ou usar o ano corrente | P3 | B | — | — |
| U-08 | Listagem | `SimuladosPage.tsx:84-110`; `SimuladosTimelineSection` | Lista plana; 2026 vira "treino" misturado | Confusão entre atual e histórico | Seções por edição: a do aluno primeiro; anteriores recolhidas ("ENAMED 2026 · Treino") | P1 | M | D-01, D-14 | Aluno 2027.1 vê 2027.1 no topo; 2026 acessível |
| U-09 | Rótulos | `#${sequenceNumber}` em `SimuladoCard`, timeline, comparativo, radar, drawer, agenda (`simulado-helpers.ts:195`), alerts | "#1" ambíguo | Identidade perdida | "2027.1 · Simulado 1" | P1 | B | D-02 | Nenhum "#N" sem edição |
| U-10 | Home | `home-hero-state.ts:179-202` | `results_ready` avaliado antes de tudo, sem expiração | Hero preso no último resultado (2026) | Expira N dias após a liberação; filtra pela edição | P1 | B | — | Teste: concluído de 2026 + upcoming de 2027 → `upcoming` |
| U-11 | Home/Ranking | `useRanking.ts:134-135` + `rankingApi.ts:113` | Padrão = `sims[0]` = **mais antigo** (bug atual) | Home mostra a posição no S1 | Padrão = último liberado da edição do aluno; validar a chave de sessionStorage | P1 | B | — (bug) / D-01 | Sem seleção salva → último simulado liberado |
| U-12 | Home/Banner | `simuladoBannerScenario.ts:13,42`, `SimuladosPage:86`, `home-hero-state:136` | 3 regras diferentes para "simulado atual" | Com 2 edições abertas, cada tela aponta para um simulado | `selectCurrentSimulado(simulados, userEdition, now)` puro e testado, usado pelos 3 | P1 | M | D-01, D-14 | Teste com 2 janelas abertas: os 3 consumidores concordam |
| U-13 | Home | `HomePagePremium.tsx:129-131, 429-437` | KPIs vitalícios; "Top X%" = `100 − nota` | Mistura edições; percentil **falso** já hoje | KPIs da edição; percentil real do ranking | P1 | B | D-07 | Mesma nota em rankings diferentes → percentis diferentes |
| U-14 | Home | `EnamedCountdownCard.tsx` | "Faltam 0 dias para o ENAMED"; sem nome da edição; `Math.ceil` (≠ `startOfDay` da Reta Final) | Inconsistência de ±1 dia | `getDaysUntil(editionDate, 'America/Sao_Paulo')` único; "É hoje"; nome da edição | P2 | B | C-01 | Home e Reta Final mostram o mesmo número |
| U-15 | Reta Final | `CadernoRetaFinalPage.tsx:100-101,130,315-416` | "O ENAMED já aconteceu! … volta no próximo ciclo" | Feature PRO morta após 28/11 | Estado de transição: "ENAMED 2026 encerrado → plano do 2027.1 abre em DD/MM" | P0 | B | C-01 | Em 29/11 não aparece "já aconteceu" sem próxima edição |
| U-16 | Comparativo | `useComparativeData.ts:114-164`; `resultHelpers.ts:240-298`; `comparativeInsights.ts:36-49` | Tudo misturado; deltas e σ entre provas diferentes | Conclusões estatisticamente inválidas | Padrão = edição; visão histórica com separadores e **percentil** (não % bruto) | P1 | M | D-01, D-07 | Nenhum insight cita simulados de edições diferentes |
| U-17 | Desempenho | `DesempenhoPage.tsx:52-63`; `SimuladoTabs.tsx` | Padrão por `sequence_number` desc; abas planas | Padrão errado com numeração reiniciada | Padrão = mais recente da edição; seletor de edição | P1 | B | D-01 | — |
| U-18 | Ranking | `RankingSimuladoSelector.tsx` | Pílulas planas com o título | Cresce sem limite; títulos iguais | Agrupado por edição; anteriores em "Arquivo" | P1 | B | D-01 | — |
| U-19 | Nota de corte | `ranking-approval.ts:51-58`; `RankingView.tsx:157-170` | Veredito `% bruto >= corte` | Compara escalas/provas diferentes (oficial é TRI) | Ressalva fixa + edição de referência; Fase 4: estimativa calibrada | P2 | B | D-04 | Veredito sempre com ressalva visível |
| U-20 | Landing | `LandingHowItWorks.tsx:96-108,143` | Timeline pública com **todos** os simulados | 2026 inteiro misturado com 2027.1 | Só a edição ativa ou a próxima | P1 | B | D-01 | — |
| U-21 | Estados vazios | `simuladoBannerScenario.ts:76`; `NextSimuladoBanner.tsx:22-34` | "Nenhum simulado disponível" mesmo com treinos | 1.006 cadastros desde 07/09 viram tela vazia | "Calendário 2027.1 em breve" (da edição) + atalho para treinos de 2026 | P1 | B | D-01 | Usuário sem simulado da edição vê o calendário + treino |
| U-22 | Home | `HomePagePremium.tsx:80` | Ignora o erro de `useSimulados` | Falha vira "nenhum simulado" | Banner de erro com retry | P2 | B | — | — |
| U-23 | Preferências | `NotificationsSection.tsx:40-43` | Toggle "Reta final" sem implementação | Promessa não cumprida | Esconder até implementar | P1 | B | — | — |
| U-24 | Caderno | `NotebookEntryCard.tsx:237`; `cadernoExport.ts:225`; `FilterBar.tsx` | "Simulado 1" sem edição; sem filtro | Ambíguo | Selo e filtro de edição | P2 | B | D-01 | — |
| U-25 | Caderno | `simuladosApi.ts:690-699` (11 consumidores) | Sem paginação (teto de 1.000; máximo atual 215) | Risco em 2027 | Contagens via RPC; listas paginadas | P2 | M | — | 1.500 entradas: contador = `COUNT` |
| U-26 | Prova | `useExamFlow.ts:185-196`; `ExamHeader.tsx:85` | Teclas 1/2/3 viram confiança após marcar; Esc sai da tela cheia (penalidade) | Atrito/penalidade injusta | Revisar o mapa de atalhos | P3 | B | — | — |
| U-27 | Comunicação | `ComoFuncionaTutorial.tsx:49`; `PlanBillboard.tsx:12` | "próximo ciclo"; "simulados **oficiais** ENAMED" | Termo enganoso ("oficiais") | Revisar a copy | P2 | B | — | — |
| U-28 | Código morto | `KpiGrid.tsx` ("ciclo de {ano}"), `Index.tsx` + 10 componentes, `SimuladoCard` | Não roteados | Armadilhas de manutenção | Remover | P3 | B | — | typecheck/testes verdes |

### B.6 Administração e operação

| ID | Área | Localização | Situação atual | Problema | Mudança necessária | Prio | Compl. | Dependências | Critério de aceite |
|---|---|---|---|---|---|---|---|---|---|
| A-01 | Admin | `AdminSimuladoForm.tsx`, `AdminSimulados.tsx`, `adminApi.ts:162-168` | Sem campo nem filtro de edição | Não dá para abrir 2027.1 sem código | Tela "Edições" (CRUD + status) + seletor de edição no form e na lista | P0 | M | D-01 | Criar 2027.1 e seus simulados só pela UI |
| A-02 | Admin | — | Não há clonar simulado | Abrir uma série nova é manual | `admin_clone_simulado(id, edition_id, janela, copiar_questões?)` com linhagem `source_simulado_id` | P1 | M | D-01 | 7 simulados de 2027.1 criados a partir de modelos em minutos |
| A-03 | Dashboards | `admin_score_evolution`, `admin_segment_breakdown`, `admin_cohort_retention`, `admin_intel_insights` (`score_decline`/`participation_drop` comparam "as 2 últimas linhas") | Vitalícios, ordenados por `sequence_number`; incluem `test`/`draft` | Comparam S1 de 2027.1 com S7 de 2026 | `p_edition_id` em todas + seletor global de edição no `AdminPeriodContext` | P1 | M | D-01 | Relatório "2026 × 2027.1" sem SQL |
| A-04 | Publicação | `AdminSimuladoForm.tsx:197-226`; `adminApi.ts:195-199` | Gate de gabarito só no cliente, que libera em caso de falha | Publica sem checagem | RPC `admin_publish_simulado` com checagem no servidor + override auditado | P2 | M | — | Publicar só via RPC |
| A-05 | Janelas | `validateWindows.ts` | Editar a janela após tentativas não recalcula `is_within_window` | Ranking incoerente | Confirmação + recálculo explícito | P2 | M | — | — |
| A-06 | Presencial | `create_presencial_attempt_guarded`; hotfix só em produção | Ranking depende da janela online; caso S7 resolvido por hotfix fora do repo | Repetirá em todo presencial de 2027 | Regra versionada: sessão presencial válida → entra no ranking; trazer o hotfix para o repo | P1 | M | F-02 | Submissão dentro da sessão conta |
| A-07 | RBAC | `admin-upload-questions:57`, `admin-verify-*`, `admin-delete-user:69`, `hubspot-contact-sync:111` | `has_role('admin')` × capacidades | `content_editor` recebe 403 | `admin_require(capability)` nas edge functions | P2 | B | — | Editor importa ponta a ponta |
| A-08 | Auditoria | `tg_admin_audit` | No-op com `auth.uid()` nulo; sem diff | Escritas via service role não auditadas | Diff old/new; ator vindo do JWT da função | P2 | M | — | Log mostra o diff de janela/gabarito |
| A-09 | Conteúdo | `deleteQuestionsForSimulado` (`adminApi.ts:216-228`) | Apaga questões com tentativas; ignora erros | Notas incoerentes | Bloquear com tentativas | P1 | B | D-11 | Remover questões com tentativa → erro |
| A-10 | Nota de corte | — | Sem tela de gestão de cortes | Carga por seed/SQL | Importador de cortes por edição de referência | P1 | M | D-04 | Admin carrega os cortes do novo processo pela UI |

### B.7 Integrações e infraestrutura

| ID | Área | Localização | Situação atual | Problema | Mudança necessária | Prio | Compl. | Dependências | Critério de aceite |
|---|---|---|---|---|---|---|---|---|---|
| I-01 | CRM | trigger `notify_hubspot_new_user` → `hubspot-contact-sync` | Chamadas respondem **403** (sem secret) [PROD] | Cadastros novos fora do HubSpot | Trigger lendo o secret do Vault; reprocessar via bulk os cadastros perdidos | P1 (**P0 se o funil de 2027 depender do HubSpot**) | B | Autorização | Cadastro aparece no HubSpot em menos de 5 min; backfill feito |
| I-02 | CRM | `hubspot-contact-sync:176-185` | Só no INSERT; sem edição nem atualização de segmento | Segmentação de campanhas 2027 impossível | Sincronizar no UPDATE de `segment`/`target_edition`; propriedade `enamed_edicao_alvo` | P2 | B | D-14 | Upgrade/edição refletidos |
| I-03 | Comunicação | `novu-email` (só transacional) | Sem e-mail de "janela abriu" / "resultado liberado" | Engajamento manual em 2027 | Disparos derivados de `simulados` + edição (job) | P2 | M | F-01 | E-mails sem código por simulado |
| I-04 | Lembretes | `caderno-reminders` | Scaffold no-op; sem cron; varredura sem paginação | Nunca disparou | Implementar (workflow Novu) ou remover a promessa | P2 | M | F-01 | Execução 2xx diária visível |
| I-05 | Alertas | `gabarito-key-alerts` | Função publicada; tabela/RPC/cron **não aplicados** [PROD] | Rede de proteção de gabarito inexistente | Aplicar as migrations após F-01/F-02 | P1 | B | F-01, F-02 | Alerta diário 2xx |
| I-06 | E-mail | `novu-email:86`, `auth-email-hook:96,268` | Logo/redirect em `enamed-arena.lovable.app` | Dependência do domínio Lovable | Domínio próprio | P2 | B | — | — |
| I-07 | SSO | `sso-magic-link:262-277`; `AuthSSOPage.tsx:44-49` | Segmento nunca rebaixado; sessão aberta não atualiza o segmento | PRO perpétuo; acesso por período impossível | Sync de segmento com validade (`segment_valid_until`) e refresh com sessão aberta | P1 | M | **[D]** SanarFlix | PRO expira sem renovação |
| I-08 | Allowlist | `novu-email:32`; `sso-magic-link:4-5` | `sanaflix\.com` | Provável erro de digitação | Confirmar/corrigir | P3 | B | — | — |
| F-01 | Infra | Postgres | **`pg_cron` não instalado** [PROD] | Nenhum job roda (fila, auto-finalização, alertas, lembretes) | Habilitar `pg_cron` (+ secrets no Vault, não em texto no comando) | P0 | B | Autorização | `cron.job_run_details` com execuções 2xx |
| F-02 | Infra | migrations repo × produção | Drift (ver 0.1 item 8) [PROD] | Impossível ensaiar mudanças de schema | Baseline: dump do schema de produção → migration de baseline; trazer hotfixes; arquivar `migrations-log.md`; commitar as 6 locais | P0 | M | — | `supabase db diff` contra produção vazio |
| F-03 | Infra | `20260420000000_security_hardening.sql` ("NÃO APLICAR"), `_STAGING_…` | Arquivos perigosos na pasta de migrations | Um `db push` quebraria a produção | Mover para `docs/`/`archive/` | P1 | B | — | Pasta só com migrations aplicáveis |
| F-04 | Observabilidade | front + edge | Sem APM; sem `unhandledrejection` | Falhas da prova invisíveis (a fila de 399 passou 7 meses despercebida) | Sentry (ou similar) + alerta de fila/jobs | P1 | M | — | Erro de finalização gera alerta em 5 min |
| F-05 | Testes | `e2e/`, `.github/workflows/ci.yml` | E2E fora do CI; motor de prova e RPCs sem teste | Regressões no caminho crítico | Suíte SQL (branch Supabase) + E2E da prova no CI | P1 | M | F-02 | CI roda E2E de prova completa |
| F-06 | Performance | hooks com `useEffect` (`useRanking`, `useUserPerformance`, `useExamResult`, `useComparativeData`) | Sem cache do React Query | Refaz chamadas a cada navegação | Migrar para `useQuery` | P3 | M | — | Voltar à home não refaz chamadas em 5 min |
| F-07 | Docs | `CLAUDE.md` | Diz `strictNullChecks: false` (o `tsconfig.app.json` tem `true`) | Orienta errado | Corrigir | P3 | B | — | — |
| F-08 | Deploy | `netlify.toml` + `vercel.json` | Dois alvos | Ambíguo | Confirmar e remover o morto | P3 | B | — | — |

---

## 4. Entregável C — Proposta arquitetural

### C.1 Separando conceitos que hoje se confundem

| Conceito | O que é | Hoje | Proposta |
|---|---|---|---|
| **Edição oficial do exame** | Fato externo: "ENAMED 2027.1", data do Inep, formato, matriz | Inexistente (só `ENAMED_DATE` no código) | Entidade `exam_editions` |
| **Ciclo de preparação (série de simulados)** | A série Sanar que mira uma edição (S1…Sn), com calendário próprio | Implícito: "todos os simulados" | **Não criar tabela agora.** O ciclo de preparação = simulados com `edition_id = X`. Uma tabela `prep_cycles` só se surgir uma série que sirva duas edições (YAGNI documentado) |
| **Turma / coorte do aluno** | Para qual edição o aluno se prepara (pode mudar; pode fazer as duas) | Inexistente | `onboarding_profiles.target_edition_id` (atual) + `user_edition_targets` (histórico) + `expected_graduation_term` (para derivar) |
| **Janela de disponibilização** | Quando o simulado pode ser feito e quando sai o resultado | `execution_window_*`, `results_release_at` | Mantém, mais um CHECK `start < end <= release` |
| **Status de publicação** | Controle editorial do simulado | `simulados.status` (draft/published/test/archived) | Mantém, **separado** do status da edição |

### C.2 Modelo de dados (expand-only, compatível com o atual)

```sql
-- 1) Matriz de áreas versionada (Portaria Inep 478/2025 → 7 áreas)
create table public.exam_blueprints (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,                 -- 'inep-478-2025'
  label text not null,
  source text,                               -- 'Portaria Inep nº 478/2025'
  areas jsonb not null,                      -- [{"key":"clinica_medica","label":"Clínica Médica","weight":0.20}, ...]
  created_at timestamptz not null default now()
);

create table public.exam_areas (             -- catálogo canônico (corrige as 16 grafias)
  id uuid primary key default gen_random_uuid(),
  blueprint_id uuid not null references public.exam_blueprints,
  key text not null, label text not null,
  aliases text[] not null default '{}',      -- 'Cirurgia', 'Preventiva', 'MFC'...
  unique (blueprint_id, key)
);

-- 2) Edição oficial do exame
create type public.exam_edition_status as enum
  ('planned','preparing','active','closed','archived');

create table public.exam_editions (
  id uuid primary key default gen_random_uuid(),
  code text unique not null check (code ~ '^\d{4}(\.[12])?$'),   -- '2026', '2027.1'
  year smallint not null,
  term smallint check (term in (1,2)),                            -- null = edição anual (2026)
  label text not null,                                            -- 'ENAMED 2027.1'
  status public.exam_edition_status not null default 'planned',
  exam_date date,                                                 -- null = a confirmar
  exam_date_confirmed boolean not null default false,
  official_results_at date,
  format jsonb not null default
    '{"questions":100,"options":4,"duration_minutes":300,"scoring":"tri","proficient_min":60}',
  blueprint_id uuid references public.exam_blueprints,
  cutoff_reference_label text,                                    -- 'Enare 2026/2027'
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3) Simulados → edição
alter table public.simulados
  add column edition_id uuid references public.exam_editions,     -- NOT NULL após o backfill
  add column source_simulado_id uuid references public.simulados; -- linhagem de clonagem
-- após o backfill:
-- alter table simulados alter column edition_id set not null;
-- create unique index on simulados (edition_id, sequence_number);
-- alter table simulados add constraint simulados_windows_chk
--   check (execution_window_start < execution_window_end
--          and execution_window_end <= results_release_at);

-- 4) Foto na tentativa (congela o histórico)
alter table public.attempts
  add column edition_id uuid references public.exam_editions,     -- preenchido por trigger a partir do simulado
  add column specialty_id_at_finish uuid,
  add column target_institution_ids_at_finish uuid[],
  add column snapshot_backfilled boolean not null default false;

-- 5) Alvo do aluno
alter table public.onboarding_profiles
  add column target_edition_id uuid references public.exam_editions,  -- null = indeciso
  add column expected_graduation_term text;                          -- '2027.1' (conclusão)
create table public.user_edition_targets (                            -- histórico
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  edition_id uuid references public.exam_editions,
  source text not null check (source in ('onboarding','settings','derived','admin')),
  created_at timestamptz not null default now()
);

-- 6) Nota de corte com referência
alter table public.enamed_cutoff_scores
  add column reference_edition_id uuid references public.exam_editions,
  add column source text;
alter table public.enamed_programs
  add column reference_edition_id uuid references public.exam_editions;

-- 7) Preservação
-- attempts / user_performance_history / attempt_question_results:
--   FK simulado_id → ON DELETE RESTRICT (no lugar de CASCADE)
```

**Relacionamentos:** `exam_editions 1─N simulados 1─N attempts`; `exam_editions N─1 exam_blueprints 1─N exam_areas`; `questions.area_id → exam_areas` (o texto livre `area` fica como legado); `onboarding_profiles.target_edition_id → exam_editions`; `enamed_cutoff_scores.reference_edition_id → exam_editions`.

**RLS:** `exam_editions`, `exam_blueprints`, `exam_areas`: SELECT para `authenticated` (e `anon` só para editions `planned`+ da landing); escrita só com `has_capability('content.manage')`. Colunas de foto em `attempts` protegidas pelo trigger anti-adulteração.

### C.3 Regras de negócio

| Regra | Definição |
|---|---|
| Edição "corrente" de um aluno | `target_edition_id` → senão, derivada de `expected_graduation_term` → senão, a próxima edição com `exam_date >= hoje` (ou, sem datas, a de status `preparing`/`active` mais antiga) |
| Edições simultâneas | Várias podem estar `preparing`/`active` (ex.: 2027.1 `active` + 2027.2 `preparing`). Todo aluno pode fazer qualquer simulado publicado |
| Ranking | **Por simulado** (como hoje), rotulado pela edição; só tentativas na janela; deduplicado. "Ranking da edição" (agregado) é a Fase 4 e depende de [D] |
| Desempenho/KPIs/comparativo/IA | Escopo padrão = edição corrente; treino fora dos KPIs; visão "histórico completo" opcional, com separadores e ressalva |
| Encerramento de edição | `active → closed` só por ação admin; tentativas `in_progress` são finalizadas pelo job (R-03) antes ou depois; nada é apagado |
| 2026 em 2027 | Simulados de 2026 continuam `published`, edição 2026 `closed`; aparecem como "ENAMED 2026 · Treino"; resultados, correção e ranking históricos legíveis; novas tentativas = treino (`is_within_window=false`), fora dos KPIs da edição nova |
| Reuso de conteúdo | Clonar o simulado (com `source_simulado_id`) → questões copiadas, com novo `question_id`; a edição de uma cópia nunca altera a original |
| Nota de corte | Cada edição declara a edição/processo de referência do corte; a UI sempre mostra "Corte de referência: X" + ressalva |
| Datas a confirmar | `exam_date` nula → countdown e Reta Final mostram "Data oficial ainda não divulgada pelo Inep" (nunca "a prova já passou") |

### C.4 Interfaces de front (exemplos)

```ts
// src/types/edition.ts
export type EditionStatus = 'planned' | 'preparing' | 'active' | 'closed' | 'archived';
export interface ExamFormat { questions: number; options: number; durationMinutes: number; scoring: 'tri' | 'raw'; proficientMin?: number; }
export interface ExamEdition {
  id: string; code: string; label: string; status: EditionStatus;
  examDate: string | null; examDateConfirmed: boolean; officialResultsAt: string | null;
  format: ExamFormat; blueprintId: string | null; cutoffReferenceLabel: string | null;
}
// SimuladoConfig ganha: editionId, editionCode, editionLabel

// src/lib/editions.ts (puro, testável)
export function resolveUserEdition(editions: ExamEdition[], profile: { targetEditionId?: string; expectedGraduationTerm?: string }, now: Date): ExamEdition | null;
export function getNextEditionDate(edition: ExamEdition | null): Date | null;
export function getDaysUntil(date: Date, now: Date, tz = 'America/Sao_Paulo'): number;
export function selectCurrentSimulado(simulados: SimuladoWithStatus[], edition: ExamEdition | null, now: Date): SimuladoWithStatus | null;

// hooks
useEditions();      // React Query, staleTime 1h
useUserEdition();   // combina o perfil + resolveUserEdition
```

**RPCs (assinatura compatível: parâmetro novo com `DEFAULT NULL` = comportamento antigo):**
`get_user_performance_summary(p_edition_id uuid default null, p_include_training bool default true)`, `get_user_performance_history(…, p_edition_id …)`, `get_cutoff_scores(…, p_reference_edition_id …)`, `admin_*(…, p_edition_id …)`, e as novas `admin_upsert_edition`, `admin_clone_simulado`, `admin_publish_simulado`, `admin_reprocess_simulado`, `set_target_edition_guarded`.

### C.5 Fluxos

**Abrir uma nova edição (sem código):**
`Admin › Edições › Nova` (code 2027.2, status `planned`, data a confirmar, blueprint) → `Clonar simulados` de uma edição modelo (janelas novas) → importar questões → `Publicar` (gate no servidor) → status `preparing` → quando abrir a 1ª janela, `active`.

**Aluno de 2026 entrando em 2027:**
Login → home detecta `target_edition_id IS NULL` → aviso não bloqueante: "Para qual prova você se prepara? (2027.1 · 2027.2 · Ainda não sei)", com sugestão derivada do semestre de conclusão → a home passa a mostrar a edição escolhida; histórico de 2026 em "Histórico › ENAMED 2026".

**Fim de uma edição:**
Admin marca `closed` → o job finaliza ou expira as tentativas pendentes → listas movem os simulados para "Histórico" → o countdown passa para a próxima edição do aluno.

### C.6 Estratégia de migração (expand → backfill → switch → contract)

| Passo | O que | Reversível? | Verificação |
|---|---|---|---|
| 0 | **Baseline do drift** (F-02): dump do schema de produção vira migration de baseline; trazer o hotfix presencial; commitar as 6 locais; mover os arquivos perigosos | Sim (só repo) | `db diff` vazio |
| 1 | Foto de segurança: `backup.simulados_2026`, `backup.attempts_2026`, `backup.ranking_2026` (resultado de `get_ranking_for_simulado` para S1–S7) e `backup.user_perf_2026` (convenção já usada no schema `backup`) | — | Contagens batem |
| 2 | **Expand:** criar tabelas e colunas anuláveis; inserir as edições `2026` (`closed`, exam_date 2026-09-13), `2027.1` e `2027.2` (`planned`, data nula); blueprint `inep-478-2025` | Sim (`drop` das colunas/tabelas novas) | Nada no front muda |
| 3 | **Backfill:** `simulados.edition_id = 2026` (7 linhas); `attempts.edition_id` via join; fotos de perfil com `snapshot_backfilled = true`; `questions.area_id` por mapa de aliases (relatório do que não casou) | Sim (`update … = null`) | 0 nulos; `count(attempts)` inalterado; 16 grafias → 7 áreas |
| 4 | **Constraints:** `NOT NULL`, `UNIQUE (edition_id, sequence_number)`, CHECK das janelas, FKs `RESTRICT`; trigger que preenche `attempts.edition_id` | Sim (`drop constraint`) | Testes SQL |
| 5 | **RPCs v2** com parâmetros opcionais (compatíveis) | Sim (`create or replace` da versão anterior, guardada em arquivo) | Diff do ranking 2026 = vazio |
| 6 | **Switch do front** atrás da flag `editions_ui` (tabela `app_config`, não localStorage) | Sim (desligar a flag) | E2E |
| 7 | **Contract:** remover `ENAMED_DATE`, os literais "ENAMED 2026", `enamedBlueprint.ts` (vira a tabela) e o código morto; aposentar `user_performance_summary` | Commit revertível | grep "ENAMED 2026" = 0 |

**Mecanismos de segurança:** ensaio completo numa **branch do Supabase** antes de produção; toda migration com bloco `-- rollback` testado; verificações de invariantes em SQL após cada passo (contagens, somas de `score_percentage` por simulado, checksum do ranking de 2026); deploy do front só depois do passo 5 verde; flag para desligar a UI nova sem rollback de banco.

### C.7 Compatibilidade com as funcionalidades atuais

- Rotas `/simulados/:id` (UUID ou slug) não mudam, e links antigos continuam funcionando ([F] `getSimulado` aceita os dois).
- RPCs com parâmetros novos opcionais: um front antigo em cache continua funcionando durante o deploy.
- Presencial e offline: só ganham `edition_id` via trigger.
- Caderno: cumulativo, com selo e filtro de edição; o SRS não muda.

---

## 5. Entregável D — Oportunidades de evolução

### D.1 Melhorias essenciais (fazem parte da transição)

| Oportunidade | Problema | Solução | Benefício | Impacto | Compl. | Dependências | Riscos | Prio |
|---|---|---|---|---|---|---|---|---|
| Edições configuráveis no admin | Abrir ciclo exige código | Tela Edições + clonar simulado | Abrir 2027.2/2028.1 em minutos | Custo operacional ↓ | M | D-01 | Clonagem copiar gabarito errado | P0 |
| Finalização robusta | 399 alunos sem nota | R-01..R-04 + job | Ninguém perde resultado | Confiança ↑ | M | F-01 | Reprocessar histórico mexe no ranking ([D]) | P0 |
| Integridade da prova | Gabarito vaza; respostas editáveis | S-02..S-07 | Ranking crível | Valor do produto | M | — | Quebrar fluxos offline/presencial | P0 |
| Datas por edição | Countdown/Reta Final mortos | C-01 + U-15 | Reta Final viva em 2027 | Retenção PRO | B | — | — | P0 |
| Escopo por edição nas análises | Comparações inválidas | D-07, U-13, U-16 | Métricas honestas | Confiança | M | D-01 | Usuário sentir que "perdeu" o histórico (mitigar com a aba Histórico) | P1 |

### D.2 Melhorias de alto impacto

| Oportunidade | Problema | Solução | Benefício | Impacto | Compl. | Dependências | Riscos | Prio |
|---|---|---|---|---|---|---|---|---|
| Onboarding por etapa/conclusão | Aluno não sabe "2027.1 ou .2" | Perguntar o semestre de conclusão → derivar a edição; 4º ano como público novo | Personalização e novo público | Aquisição ↑ | M | D-14 | Regras do Inep mudarem (PLV) | P1 |
| Calendário de simulados da edição | Aluno não vê o plano até a prova | Página/aba "Calendário 2027.1" + .ics/Google Agenda por edição | Planejamento | Participação ↑ | B | D-01 | — | P1 |
| E-mails de janela/resultado | Engajamento manual | Job: "abriu", "faltam 24h", "resultado saiu" | Recorrência | Participação ↑ (hoje só ~14% dos cadastros enviaram prova) | M | F-01, I-03 | Fadiga de e-mail | P1 |
| Recuperação de offline pendente | 2.618 gabaritos nunca enviados | Lembrete + entender o motivo (UX) | Mais resultados | Dados ↑ | B | F-01 | — | P1 |
| Percentil real na home | "Top X%" falso | Percentil do ranking | Honestidade | Confiança | B | — | — | P1 |
| Normalização de áreas | 16 grafias | `exam_areas` + mapeamento | Desempenho por área correto | Diagnóstico ↑ | M | C-02 | Mapeamento errado (revisar com Conteúdo) | P1 |
| Observabilidade e alertas | Falhas invisíveis por meses | Sentry + alertas de fila/jobs | Detectar em minutos | Estabilidade | M | — | Custo | P1 |
| Reta Final por edição com transição | Feature morre entre edições | Plano até a edição do aluno; "intervalo entre edições" | PRO usável o ano todo | Retenção PRO | B | C-01 | — | P1 |

### D.3 Evoluções futuras (Fases 3–4)

| Oportunidade | Problema | Solução | Benefício | Impacto | Compl. | Dependências | Riscos | Prio |
|---|---|---|---|---|---|---|---|---|
| Estimativa de proficiência (TRI) | % bruto ≠ escala oficial | Calibração TRI com base de respostas (394 mil) | "Você estaria proficiente?" | Diferencial competitivo | A | Volume por item; estatístico | Prometer precisão que não existe (sempre com intervalo) | P3 |
| Banco de questões versionado | Questões presas ao simulado | `question_bank` + versões + uso por simulado | Reuso seguro; análise por item | Conteúdo ↑ | A | D-10 | Migração de 700 questões | P3 |
| Ranking da edição | Só por simulado | Agregado (média dos melhores N) | Gamificação | Engajamento | M | D-01 | Comparabilidade entre provas | P3 |
| Histórico longitudinal entre edições | Sem visão de carreira | Percentil por simulado ao longo das edições | Evolução real | Retenção multi-ano | M | D-07 | — | P2 |
| Plano de estudo por tempo restante | — | Plano dinâmico (Reta Final generalizada) | Personalização | PRO ↑ | M | C-01, D-17 | — | P2 |
| Acesso PRO por período | PRO perpétuo | Segmento com validade (SSO) | Receita correta | Negócio | M | I-07 | Contrato com a SanarFlix | P2 |
| Multi-aba seguro + modo offline real | Perda e sobrescrita | Versionamento de resposta + fila local | Robustez | Confiança | M | R-05/R-06 | — | P2 |
| Notas de corte geridas pelo admin | Seed manual | Importador + histórico de processos | Atualização fácil | Operação | M | D-04 | — | P2 |

---

## 6. Entregável E — Roadmap priorizado

### Fase 0 — Bloqueadores e riscos críticos (agora → **27/11/2026**)

| Entrega | Itens | Esforço |
|---|---|---|
| Fechar as brechas de segurança | S-01 (remover `temp-change-email`), S-02, S-03, S-04, S-05, S-06, S-07; revisar S-09 | M |
| Decidir e encaminhar o SSO | S-08: [D] com a SanarFlix; no mínimo, parar de devolver o `actionLink` para requisições sem assinatura | M |
| Hotfix de datas | C-01 (data lida de config, estado neutro), U-15 | B |
| Habilitar jobs | F-01 (`pg_cron`) | B |
| Salvar quem ficou sem nota | R-01, R-02 + [D] o que fazer com as 399 + 1.655 (ver E.1) | M |
| Reconciliar o drift | F-02, F-03 | M |
| CRM | I-01 + backfill dos cadastros sem sync | B |
| Preservação | D-11 (FK RESTRICT + bloqueio do Excluir) | B |

- **Dependências:** autorização para ações em produção; decisões E.1 e S-08.
- **Riscos:** RLS nova quebrar offline/presencial → mitigar com teste em branch e E2E manual dos 3 fluxos.
- **Critério de conclusão:** os 8 itens de 0.1 resolvidos e verificados em produção; `db diff` vazio; fila zerada; 29/11 sem "a prova já passou".

### Fase 1 — Preparação obrigatória para o 2027.1 (dez/2026 → **31/01/2027**, ajustar ao edital)

| Entrega | Itens | Esforço |
|---|---|---|
| Modelo de edição + backfill 2026 | D-01, D-02, D-03, D-13, passos C.6 de 1 a 5 | A |
| Admin de edições + clonagem | A-01, A-02, A-09, D-12 | M |
| Datas, formato e matriz por edição | C-01 (definitivo), C-02, C-03, D-17 | M |
| Nota de corte com referência | D-04, D-05, U-05, A-10 | M |
| Rótulos e listas por edição | U-01..U-04, U-06, U-08, U-09, U-17, U-18, U-20, U-21, R-13 | M |
| "Simulado atual" único + home | U-10, U-11, U-12, U-13, U-14 | M |
| Onboarding / edição-alvo | D-14, D-15 | M |
| Confiabilidade da prova | R-03, R-04, R-05, R-07, R-11, R-15 | M |
| Observabilidade mínima + testes do caminho crítico | F-04, F-05 | M |

- **Dependências:** a Fase 0 completa (drift e cron).
- **Riscos:** prazo (edital do Inep pode antecipar) → priorizar dentro da fase: modelo → admin → rótulos/listas → home.
- **Critério de conclusão:** o admin cria o 2027.1 com 1 simulado de teste sem código; o aluno de 2026 vê o histórico separado; o grep "ENAMED 2026" no código = 0; a bateria F verde.

### Fase 2 — Consolidação do modelo semestral (fev → mai/2027)

| Entrega | Itens | Esforço |
|---|---|---|
| Análises por edição | D-06, D-07, D-08, U-16, C-04, IA com edição | M |
| Foto de perfil no ranking | D-09 | M |
| Admin por edição | A-03, A-04, A-05, A-06, A-07, C-05 | M |
| Reprocessamento em 1 clique | D-10 (RPC) | M |
| Comunicação | I-02, I-03, I-05, U-23 | M |
| SSO com validade | I-07 | M |
| Caderno por edição | U-24, U-25 | B |

- **Critério de conclusão:** 2027.1 `active` + 2027.2 `preparing` funcionando juntos; relatório admin por edição; e-mails de janela automáticos.

### Fase 3 — Evolução da experiência (mai → set/2027)

Itens: calendário da edição, onboarding por etapa (4º ano), percentil longitudinal, plano por tempo restante, React Query (F-06), multi-aba seguro (R-06), acessibilidade (skip link, timer anunciado), atalhos (U-26), mobile, R-08..R-10, R-12, R-14, R-16, U-22, U-27, U-28, I-04, I-06. Esforço: M–A.
**Critério de conclusão:** metas de produto definidas na fase (ex.: % de cadastros que enviam a 1ª prova; hoje ~14%).

### Fase 4 — Evoluções estratégicas (2º semestre/2027+)

Itens: estimativa de proficiência TRI, banco de questões versionado, ranking da edição, acesso PRO por período ponta a ponta, notas de corte com histórico de processos e análise por item. Esforço: A.

---

## 7. Entregável F — Plano de validação e testes

| Objetivo | Tipo | Testes (exemplos verificáveis) |
|---|---|---|
| **2026 preservado** | Migração (branch Supabase) | Antes/depois: `count(*)` de `attempts`, `answers`, `attempt_question_results`, `user_performance_history` iguais; `sum(score_percentage)` por simulado igual; resultado de `get_ranking_for_simulado(S1..S7)` idêntico (diff de JSON); toda correção de 2026 abre (amostra de 50 tentativas) |
| | Regressão (E2E) | Usuário com tentativas de 2026: correção, gabarito, desempenho, ranking e caderno abrem com os mesmos números (golden snapshot) |
| **2027.1 independente** | SQL | Simulado de 2027.1 com `sequence_number=1` convive com o S1 de 2026; `UNIQUE` barra duplicata na mesma edição; RPCs com `p_edition_id` só devolvem a edição pedida |
| | Unit | `resolveUserEdition`, `selectCurrentSimulado` (2 janelas abertas, edições diferentes, sem simulado, edição sem data), `getDaysUntil` (fuso, dia 0, horário de verão), `deriveSimuladoStatus` (novos casos) |
| **2027.2 sem código** | E2E admin | Criar edição 2027.2 → clonar simulado → importar questões → publicar → aluno vê → fazer prova → ranking → resultado, tudo sem deploy |
| **Conteúdo certo para cada aluno** | Integração (hooks) | Aluno 2027.1 vê 2027.1 primeiro; indeciso vê a próxima edição; aluno 2026 vê o aviso de escolha e o histórico separado |
| **Resultados na edição certa** | SQL | Trigger preenche `attempts.edition_id`; `admin_score_evolution(p_edition_id)` não mistura; corte por `reference_edition` |
| **Segurança** | SQL (RLS) | INSERT direto em `attempts` → erro; upsert em `answers` após submit/prazo → erro; `get_attempt_question_results` antes da liberação → 0; `explanation` não legível via REST; `generate-exam-pdf` sem tentativa → 403; `temp-change-email` → 404 |
| **Cenários adversos** | E2E + SQL | Tempo zera com 80/100 → nota sai; aba fechada → job finaliza; 2 abas → resposta mais nova prevalece; offline 60s → sincroniza ao voltar; JWT expira no meio → nada se perde; deploy no meio → reload sem perder a prova |
| **Jobs** | Integração | Fila: item processado em ≤5 min; tentativa vencida finalizada; `cron.job_run_details` 2xx |
| **Estabilidade/carga** | Carga (k6 contra branch) | Abertura de janela: 500 `create_attempt_guarded` em 5 min + saves a cada 2s de 500 sessões por 30 min; p95 < 500 ms; 0 erros 5xx. (Pico real observado: ≤9 inícios/10 min; a carga testa uma margem de 50×) |
| **Responsividade/UX** | Manual + Playwright (viewport mobile) | Listas por edição, countdown e Reta Final em 375px; leitor de tela no timer |
| **Migração parcial** | Caos | Interromper o backfill no meio → rerodar é idempotente; rollback de cada passo testado |

**Onde rodar:** SQL/RLS em **branch do Supabase** com dados anonimizados (ou só schema + fixtures); E2E no CI (hoje não roda); carga só em branch, nunca em produção.

---

## 8. Cenários adversos (seção 9 do pedido)

| # | Cenário | Esperado | Atual (verificado?) | Alteração |
|---|---|---|---|---|
| 1 | Usuário de 2026 entra pela 1ª vez em 2027 | Vê o histórico separado, escolhe/deriva a edição, home da edição nova | Hero preso no resultado de 2026; ranking da home no S1; KPIs vitalícios; "ENAMED 2026" nos rótulos ([F]) | U-10..U-13, D-14, U-01..U-04 |
| 2 | Simulado antigo não concluído | Treino em andamento, com botão de continuar; se o prazo pessoal venceu, finalizado pelo job | `in_progress` eterno (1.655 [PROD]); detalhe diz "já realizado" sem CTA ([F]) | R-03, R-11 |
| 3 | Aluno em simulados de edições diferentes | Cada resultado na sua edição; KPIs por edição | Tudo misturado ([F]) | D-07, U-16 |
| 4 | Troca da edição-alvo | Permitida a qualquer momento; histórico preservado | Não existe; trava global do perfil ([F]) | D-14, D-15 |
| 5 | Abertura antecipada de edição futura | Edição `preparing` visível como "em breve"; simulados só quando publicados | Não representável | D-01, A-01 |
| 6 | Encerrar edição com tentativas em andamento | Job finaliza; nada é perdido | Sem job; o finalize recusa respostas em branco ([PROD]) | R-01..R-03 |
| 7 | Simulado associado à edição errada | Admin corrige `edition_id`; `attempts.edition_id` recalculado; auditado | N/A | A-01 + trigger + auditoria |
| 8 | Questão reutilizada e alterada depois | A cópia é independente; a original não muda | Não há reuso; editar área/tema reescreve o histórico ([F]) | A-02 (clonar), D-17, D-10 |
| 9 | Mudança no cronograma oficial | Admin muda `exam_date`; countdown e Reta Final se ajustam | Exige deploy ([F]) | C-01 |
| 10 | Mudança nas regras de avaliação | `format`/`blueprint` novos na edição; edições antigas intactas | Fixo no código ([F]) | C-02, C-03 |
| 11 | Resultado de uma edição no ranking de outra | Impossível (ranking por simulado) | Ranking já é por simulado ([PROD]); a home escolhe o simulado errado ([F]) | U-11 |
| 12 | Link antigo de simulado | Abre (UUID ou slug); resultados históricos legíveis | Abre ([F]); quebraria se marcado `archived` ([F]) | D-13 |
| 13 | Dados históricos sem ciclo | Backfill 2026 com verificação | Todos sem ciclo ([PROD]) | C.6 passo 3 |
| 14 | Queda de conexão durante a prova | Fila local; reenvio automático ao voltar | Banner promete sincronizar, mas só sincroniza se o aluno interagir; local sobrescrito ao retomar ([F]) | R-05 |
| 15 | Mesma prova em 2 abas/dispositivos | Lock ou resposta mais nova prevalece | Last-write-wins; a aba velha sobrescreve ([F]) | R-06 |
| 16 | Deploy durante a tentativa | Prova continua; navegação recarrega sozinha | Sem `vite:preloadError` ([F]) | R-14 |
| 17 | Nenhum simulado no ciclo novo | "Calendário da edição em breve" + treinos | "Nenhum simulado disponível" ([F]) | U-21 |
| 18 | Ciclo futuro sem data oficial | "Data a confirmar"; sem countdown | Data fixa 28/11 ([F]) | C-01 |
| 19 | Fuso / virada de data | Sempre America/Sao_Paulo, com rótulo | Relógio e fuso do navegador; `Math.ceil` × `startOfDay` ([F]) | R-12, U-14 |
| 20 | Migração parcial/falha | Passos idempotentes e reversíveis | N/A | C.6 |
| 21 | **Tempo acaba com questões em branco** | Envio com branco = erro | Falha; aluno sem nota (399 [PROD]) | R-01 |
| 22 | **Aluno envia cedo e lê o gabarito com a janela aberta** | Gabarito só após a liberação | Liberado ([PROD]) | S-05, S-06 |
| 23 | **Editar respostas após ver o gabarito** | Bloqueado | Permitido ([PROD]) | S-03 |
| 24 | **Admin exclui um simulado de 2026** | Bloqueado | Apaga o histórico em cascata ([PROD]) | D-11 |
| 25 | **Carregar cortes do novo processo** | Coexistem por referência | A função passa a devolver o maior corte entre os anos ([F]) | D-04 |
| 26 | **Edição do perfil durante uma janela de outra edição** | Permitida | Bloqueada (trava global) ([F]) | D-15 |
| 27 | **Gabarito errado descoberto depois da janela** | Reprocessamento em 1 RPC | Receita manual (S5/S6) ([memória]) | D-10 |
| 28 | **Aluno PRO que não renovou** | Perde o PRO | PRO perpétuo ([F]) | I-07 |

---

## 9. Decisões de produto pendentes

| # | Decisão | Opções | Recomendação |
|---|---|---|---|
| 1 | Numeração dos simulados | Reinicia por edição × contínua | **Reinicia por edição**, exibida como "2027.1 · Simulado 1" (unique por edição) |
| 2 | Edição-alvo obrigatória? | Obrigatória × opcional | **Opcional e derivável** (indeciso = próxima edição); obrigatória só para cadastros novos, com "Ainda não sei" |
| 3 | Simulados de 2026 em 2027 | Somem × treino × histórico | **Treino + histórico**, com selo "ENAMED 2026", fora dos KPIs da edição |
| 4 | Ranking | Só por simulado × + ranking da edição | **Por simulado agora**; ranking da edição na Fase 4 |
| 5 | Perfil no ranking antigo | Da época × atual | **Da época** (foto na tentativa) |
| 6 | Nota de corte de referência | Qual processo vale para 2027.1 e 2027.2 | Conteúdo/Produto define por edição; a UI sempre mostra a referência |
| 7 | Visão longitudinal | % bruto × percentil | **Percentil** entre edições; % bruto só dentro da edição |
| 8 | "Média atual" da home | Edição × vitalícia; treino entra? | **Edição, sem treino** |
| 9 | Caderno | Cumulativo × arquivar 2026 | **Cumulativo** + filtro por edição |
| 10 | As 399 tentativas da fila e as 1.655 vencidas | Finalizar com branco = erro (entram no ranking se estavam na janela) × finalizar como treino × deixar como estão | **Finalizar com `is_within_window=false`** (nota visível, ranking fechado intacto) e comunicar os 399 afetados. Exige a sua aprovação |
| 11 | Refazer o mesmo simulado | Proibido × permitido como treino | Manter proibido na Fase 1; reavaliar com o banco de questões |
| 12 | Público do 4º ano (1ª etapa) | Fora × dentro | Avaliar: amplia o funil e dá motivo para criar `expected_graduation_term` |
| 13 | SSO hardened | Unsigned (atual) × HMAC × link por e-mail | Hardened com a SanarFlix; até lá, no mínimo, não devolver o link |

---

## 10. Limitações desta auditoria

- **Só leitura:** nenhum teste foi executado (o snapshot não tem `node_modules`); nenhuma exploração ativa das falhas de segurança foi feita. As conclusões vêm da leitura do código e de consultas de metadados/contagens em produção.
- Corpos de RPCs presentes só em `migrations-log.md` não foram lidos em produção.
- A origem/ano dos cortes, o host de deploy ativo, as configurações do Novu fora do repo e o contrato do SSO não foram verificados.
- O calendário de 2027 não existe oficialmente; o cronograma das Fases 1–2 usa **premissa** e deve ser recalibrado quando o Inep publicar o edital, e após a sanção do PLV (06/11).

---

## Apêndice A — Evidências de produção (consultas só de leitura em 03/11/2026)

- `simulados`: 7 linhas; colunas sem edição; `sequence_number` sem unique; `slug` unique.
- `attempts`: 8.059 (submitted 3.786 · in_progress 1.655 · offline_pending 2.618 · expired 0). Respondidas por tentativa `in_progress`: 0 → 647; 1–24 → 801; 25–49 → 135; 50–74 → 63; 75–99 → 8; 100 → 1.
- `attempt_processing_queue`: 399 `pending` (06/04 → 02/11), todas com a tentativa ainda `in_progress`; erro "Finalizacao falhou no client".
- Extensões: `plpgsql, pg_stat_statements, pgcrypto, supabase_vault, unaccent, uuid-ossp, pg_net`, **sem `pg_cron`**.
- Policies de `attempts`: INSERT/SELECT/UPDATE do dono; trigger só BEFORE UPDATE (`prevent_direct_attempts_update`, sem `effective_deadline`).
- `answers`: único trigger `update_answers_updated_at`.
- `questions`: SELECT `USING (true)`; `explanation` legível por `authenticated`; sem unique por número; áreas em 16 grafias; 700 questões, todas com 4 alternativas.
- `get_ranking_for_simulado`: sem dedupe, sem gate de liberação; 28 pares usuário/simulado com 2 tentativas na janela.
- `get_onboarding_edit_guard_state` em produção: versão real (não o stub do repo).
- `enamed_cutoff_scores`: 1.058 linhas, sem coluna de ano/edição.
- `schema_migrations`: 175 entradas; `20260906215529_presencial_sempre_entra_no_ranking` só em produção; `gabarito_key_alerts` (+cron) ausentes em produção.
- Edge functions: 29 ativas; `temp-change-email` ativa (`verify_jwt=false`); `gemini-diag`, `s5-oneoff-upload`, `oneoff-s4-images` e `mentoria-export` fora do repo.
- `net._http_response`: últimas 4 chamadas (03/11) para o HubSpot → 403.
- Segmentos: pro 550 · standard 6.959 · guest 2.669; 10.178 usuários; 1.006 cadastros desde 07/09.

## Apêndice B — Fontes oficiais sobre o ENAMED 2027

- Inep: "Inep atualiza regras do Enade de Medicina e adequa o Enamed ao regime semestral" (12/08/2026, atualizada em 27/10/2026): https://www.gov.br/inep/pt-br/centrais-de-conteudo/noticias/enamed/inep-atualiza-regras-do-enade-de-medicina-e-adequa-o-enamed-ao-regime-semestral
- Página do Enamed (Inep): https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enamed
- Edital Inep nº 71/2026 (republicado no DOU em 21/08/2026): https://abmes.org.br/arquivos/legislacoes/Edital-inep-071-2026-05-28-Republicado.pdf
- MP 1.370/2026: https://www.crub.org.br/medida-provisoria-no-1-370-de-19-06-2026/ · Exposição de motivos: https://www2.camara.leg.br/legin/fed/medpro/2026/medidaprovisoria-1370-19-junho-2026-799375-exposicaodemotivos-180049-pe.html
- Portaria Inep 478/2025 (Matriz de Referência): https://abmes.org.br/legislacoes/detalhe/5219/portaria-inep-n-478
- Agência Senado (15/10/2026): https://www12.senado.leg.br/noticias/materias/2026/10/15/enamed-sera-obrigatorio-para-exercicio-da-medicina-aprova-senado
- CNN, prazo de sanção (02/11/2026): https://www.cnnbrasil.com.br/politica/lula-sanciona-esta-semana-lei-que-institui-a-oab-da-medicina/
- AMIES (29/05/2026): https://amies.org.br/em-reuniao-com-a-amies-mec-anuncia-aplicacao-semestral-do-enamed-a-partir-de-2027/
- Projeção de calendário (**não oficial**): https://formacaomedicaemdados.substack.com/p/o-enamed-vira-semestral-e-a-proxima
