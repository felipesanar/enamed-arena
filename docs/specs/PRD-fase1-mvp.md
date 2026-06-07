# PRD — Caderno de Erros v2 · Fase 1 (MVP)

**Produto:** SanarFlix PRO Simulados (ENAMED)
**Pacote:** Caderno de Erros v2 — Fase 1 (MVP da versão definitiva)
**Status:** Pronto para circular com Produto, Design e Engenharia
**Data:** Junho/2026
**Fonte da verdade de nomes/enums/eventos/limiares:** [`00-contratos-canonicos.md`](00-contratos-canonicos.md)
**Specs de origem:** 01 (modelo de dados) · 02 (SRS) · 03 (recall ativo) · 04 (triagem + confiança) · 05 (casca/fork) · 06 (telemetria)

> Este PRD consolida as decisões de produto da Fase 1. Em qualquer divergência de nome, enum, limiar ou evento contra os contratos canônicos (spec 00), **vale a spec 00**. As specs 01–06 são a autoridade de detalhe de implementação de cada área.

---

## 1. Resumo executivo

### Problema

O Caderno de Erros de hoje tem o melhor "cérebro" pedagógico do mercado (taxonomia de causa do erro + Prof. San + revisão por sessão), mas está embrulhado numa casca inconsistente e parado em três limitações que minam a eficácia: (1) "Já dominei" é **autodeclarado** — o aluno lê, não re-resolve; (2) o agendamento é um **snooze manual** de 1/3/7 dias, não repetição espaçada de verdade; (3) a adição de erros é **manual, uma a uma**, na correção — atrito que mata o hábito. Some-se a isso um débito de produto: há duas implementações divergentes (produção com motor, sandbox com a melhor casca).

### Solução

A Fase 1 funde a **casca do sandbox** (hero-first, escaneável, estados celebratórios) com o **motor da produção** (Prof. San + sessão), e adiciona as três mudanças de motor que nenhum concorrente tem:

- **Recall ativo** na revisão: o aluno re-resolve às cegas, declara confiança, vê o gabarito e se autoavalia. "Dominada" passa a **emergir** de acertos espaçados com confiança alta — não de um botão.
- **SRS adaptativo** (SM-2-lite) modulado pela causa do erro, substituindo o snooze.
- **Triagem automática pós-prova**: a IA pré-classifica os erros e acertos de baixa confiança, e o aluno adiciona tudo em lote com 1 toque por questão.

Tudo isso é destravado pela **Fase 0** (migração de schema + captura de confiança na origem, dentro da prova).

### Por que agora

A captura de confiança na prova (`answers.confidence`) é a **única dependência upstream** que toca o motor de prova (`useExamFlow`). Implementá-la agora, junto com a migração de schema, destrava simultaneamente a triagem inteligente, a calibração metacognitiva (Fase 2) e a robustez do SRS. Adiar isso significaria retrabalhar o fluxo de prova duas vezes. Além disso, resolver o fork agora paga o débito de produto antes que as Fases 2–3 (Flashcards, Insights, War Room) o multipliquem.

---

## 2. Contexto e problema

### Estado atual

O Caderno de Erros é uma feature exclusiva PRO (`/caderno-erros`, gate `useHasAccess('cadernoErros')`). O modelo `error_notebook` é rico (causa do erro, nota pessoal, ciclo de vida, camada de IA Prof. San cacheada). A taxonomia de **causa do erro** (`errorNotebookReasons.ts`) com estratégia acionável por tipo é o ativo mais valioso do produto e raro no mercado. A revisão é uma sessão sequencial com atalhos, fila e resumo.

### As 3 lacunas que o MVP ataca

| # | Lacuna | Como o MVP resolve |
|---|---|---|
| **G1 — Sem recall ativo** | "Dominei" é autodeclarado; o aluno só lê a resposta. Fere a eficácia comprovada de *active recall*. | Sessão de recall ativo (spec 03): re-resolução às cegas → confiança → revelação → autoavaliação. Domínio automático via SRS. |
| **G2 — Sem SRS real** | Snooze manual 1/3/7 escolhido à mão; sem espaçamento adaptativo, o esquecimento volta. | Motor SM-2-lite (spec 02) com `ease/interval/reps/lapses/due_at`, modulado pela causa do erro. Snooze vira override manual ("adiar"). |
| **G3 — Atrito de adição** | Adição manual, uma a uma, na correção. | Triagem automática pós-prova (spec 04): IA pré-classifica, aluno confirma em lote via `add_to_notebook_bulk_guarded`. |

Lacunas secundárias atacadas na Fase 1: G4 (sem busca), G7 (sem ações em lote), G8 (revisão mobile fraca), G12 (fork não resolvido).

### Decisão do fork (resumo)

Existem hoje duas implementações: a **produção** (`src/pages/Caderno*` + `AddToNotebookModal`, com Prof. San, snooze e sessão sobre Supabase) e o **sandbox** (`src/sandbox/caderno`, casca hero-first muito melhor, porém UI-only, com mock e sem motor). **Decisão final, não reversível (spec 05):** a casca visual do sandbox vira a camada de UI de produção, re-acoplada ao motor existente. A migração usa **rota nova em paralelo** (`/caderno` ao lado de `/caderno-erros`), sem quebrar produção, com a fonte da verdade de causa do erro consolidada em `src/lib/errorNotebookReasons.ts` (o `errorTypes.ts` do sandbox é deletado).

---

## 3. Objetivos e métricas de sucesso

As metas abaixo seguem a spec 06 §B.3. Não temos baseline confiável ainda; portanto, tratamos os números como **diretrizes iniciais** a calibrar após o beta, e priorizamos a **direção** sobre o valor absoluto.

| ID | Objetivo | Métrica (derivada da telemetria) | Diretriz inicial |
|---|---|---|---|
| **M1** | Ativação na 1ª semana | % de PRO que disparam `caderno_erros_viewed` nos 1ºs 7 dias; proxy: `error_added_to_notebook` | Subir consistentemente; meta de partida ~50% |
| **M2** | Retenção da revisão | % com `caderno_revisao_started` na semana N que repetem na N+1 | ≥ ~40% semana-sobre-semana; ≥ 2 sessões/usuário ativo |
| **M3** | Completude do recall | % de `caderno_recall_answer_selected` que chegam a `caderno_recall_self_graded` na mesma sessão | ≥ ~70%; abaixo de 50% → revisar fricção da autoavaliação |
| **M4** | Taxa de domínio | % de entradas com `caderno_entry_mastered (via_srs=true)` ÷ entradas com ≥ 30 dias no caderno | ≥ ~30% após 30 dias; segmentar por causa do erro |
| **M7** | Conversão da triagem | % de `caderno_triage_viewed` que chegam a `caderno_triage_batch_added` | ≥ ~65%; rejeição de itens > 50% → IA classificando mal |

> M5 (engajamento com Insights) e M6 (ROI medido) dependem de features de Fases 2–3 e ficam fora do escopo de mensuração da Fase 1, mas a telemetria de funil que as alimenta começa a ser coletada agora.

**Princípio de leitura:** o MVP é bem-sucedido se, isoladamente, o caderno já for superior ao SanarFlix-hoje e à Medway em profundidade pedagógica — provado por M3 (recall completo) e M4 (domínio real, não autodeclarado).

---

## 4. Não-objetivos da Fase 1

Explicitamente **fora do escopo** (Fases 2–3, conforme spec 00 §10):

- **Aba Insights / Motor de Padrões** (Prof. San macro, edge function `caderno-pattern-insights`) — Fase 2.
- **Painel de ROI** (correlação domínio × desempenho posterior) — Fase 3.
- **Flashcards** (decks, geração por IA, imagem frente/verso). *Nota: o schema de `decks`/`flashcards` é criado na migração da Fase 0 por economia, mas nenhuma UI/funcionalidade de flashcard entra na Fase 1.*
- **Aba Favoritos** e **Aba Anotações** rich-text com título/autosave — Fase 2.
- **Deep-link cirúrgico para aula/timestamp** por Lacuna (I5) — Fase 2. *Exceção pedagógica: o desbloqueio de entradas Lacuna (`awaiting_lesson`) na Fase 1 usa "já estudei este tema" como gatilho, já que o deep-link de aula ainda não existe.*
- **Dashboard de calibração de confiança** (I4) — Fase 2.
- **War Room ENAMED**, **detector de leech avançado com troca de prompt do Prof. San**, **"simulado do meu caderno"**, **micro-revisão por voz**, **decks colaborativos**, **export Anki/PDF** — Fase 3.
- **FSRS** — o algoritmo da Fase 1 é SM-2-lite (spec 02 §1.3); FSRS é upgrade v2.
- **Tabela de leech (bloqueio)**: o limiar de leech (`srs_lapses >= 4`) e o estado `leech_blocked` são reconhecidos pelo motor, mas a intervenção pedagógica completa (Prof. San muda abordagem, aula obrigatória) é Fase 3. Na Fase 1, o aluno pode reativar via `reset_leech_guarded`.

---

## 5. Usuários

- **Segmento alvo:** `pro` (Aluno PRO). O Caderno de Erros é exclusivo PRO em todas as rotas (`/caderno`, `/caderno/revisao`, `/simulados/:id/triagem`).
- **O segmento é definido no banco** (`profiles.segment`); o frontend apenas lê via `useSegment()` / `useHasAccess('cadernoErros')`. Gate obrigatório via `<ProGate feature="cadernoErros">` em `CadernoPage` — nenhuma sub-rota bypassa (spec 05 §"Gate PRO").
- **Relação com `guest`/`standard`:** sem acesso ao caderno. A tela de triagem pós-prova (`/simulados/:id/triagem`) redireciona não-PRO direto para `/simulados/:id/resultado`, preservando o comportamento atual (spec 04 §2.1).
- **Contexto de uso:** o aluno PRO estuda muito no celular — paridade mobile é requisito de Fase 1, não polimento.

---

## 6. Requisitos funcionais

> Cada RF aponta para a spec de origem. RFs são testáveis. Nomes/enums seguem spec 00.

### 6.1 Captura de confiança na prova (Fase 0 — upstream)

- **RF-01.** Após o aluno marcar uma alternativa na prova, exibir um seletor inline de 3 níveis de confiança — chips "Chute" (baixa) / "Parcial" (media) / "Tenho certeza" (alta). O seletor **não aparece** em questões em branco. (ver 04 §1.1, §1.3)
- **RF-02.** A confiança é **opcional**: o aluno pode avançar sem selecionar; `answers.confidence` aceita `NULL`. Não bloqueia navegação nem finalização. (ver 04 §1.2)
- **RF-03.** Trocar de alternativa **não** reseta a confiança já selecionada (reduz fricção de edição). (ver 04 §1.1)
- **RF-04.** Atalhos `1/2/3` mapeiam baixa/media/alta, ativos **somente após** uma alternativa estar marcada (sem colisão com `1-5` de marcação de alternativa). (ver 04 §1.3)
- **RF-05.** A confiança persiste pelo caminho de save existente: campo `confidence` adicionado a `ExamAnswer` (`'baixa'|'media'|'alta'|null`), incluído em `upsertAnswer`, `bulkUpsertAnswers` e no payload `keepalive`/`sendBeacon` do `beforeunload` em `useExamFlow`. Enum canônico `baixa|media|alta` (sem acento). (ver 04 §1.4; 01 §5; 00 §2)
- **RF-06.** Simulados antigos têm `confidence = NULL`; a ausência de confiança **não** implica baixa confiança (acertos sem confiança não entram automaticamente como `guessed_correctly`). (ver 04 §1.6)

### 6.2 Triagem pós-prova + adição em lote (spec 04)

- **RF-07.** Ao finalizar o simulado com sucesso, usuário PRO é redirecionado para `/simulados/:id/triagem` (em vez de ir direto ao resultado). Não-PRO vai direto para `/resultado`. (ver 04 §2.1)
- **RF-08.** A triagem lista os **candidatos**: questões erradas respondidas, acertos com `confidence='baixa'`, e questões marcadas com baixa confiança (independente do resultado). Questões em branco **não** são candidatas. Ordenação por `question_number` ascendente. (ver 04 §2.2)
- **RF-09.** Cada candidato chega pré-classificado com um `suggestedReason` (enum `DbReason`, nunca `did_not_understand`) + racional curto da IA. O aluno pode trocar o motivo com 1 toque (seletor inline, não modal). Por padrão todos os itens vêm selecionados; "Pular" remove da seleção. (ver 04 §2.3, §3.1, §3.3)
- **RF-10.** A classificação é feita pela edge function `classify-exam-errors` (batch de **15** questões por chamada; chamadas sequenciais se houver mais). A tela é **não bloqueante**: cards aparecem imediatamente com a heurística de fallback e a IA substitui os motivos quando responde. (ver 04 §4, §7.1; 00 §4, §8)
- **RF-11.** Heurística de fallback determinística (sem IA) quando a edge function estiver indisponível/timeout/`partial`: regras em ordem de prioridade (acerto+baixa→chute; erro+alta→diferencial; alternativas adjacentes→diferencial; em branco/residual→não sabia). (ver 04 §5)
- **RF-12.** Cache de classificação em `attempt_question_results.ai_suggested_reason`: se preenchido para todas as candidatas, a edge function **não** é chamada (cliente usa o valor do banco). (ver 04 §7.2; 00 §3)
- **RF-13.** Detecção de duplicata: questões já no caderno (mesmo `simulado_id`) exibem badge "Já no caderno" no lugar do seletor de motivo. (ver 04 §3.2)
- **RF-14.** "Adicionar todas as selecionadas" chama `add_to_notebook_bulk_guarded(p_entries jsonb)`, idempotente por `(user_id, question_id)`, com ressurreição de soft-delete e limite de **100** entradas por chamada. Retorna `{ added, skipped }`; toast comunica o resultado ("3 adicionadas, 1 já existia") e navega para `/resultado`. "Agora não" navega sem chamada ao banco. (ver 04 §6; 00 §1, §4)
- **RF-15.** O add individual (`AddToNotebookModal` + `addToErrorNotebook`) **coexiste** e não é alterado — os dois caminhos não são unificados na Fase 1. (ver 04 §6.4)

### 6.3 Casca unificada / aba Revisar (spec 05)

- **RF-16.** Nova página `CadernoPage` em `/caderno` (default = aba Revisar), com `TabBar` exibindo as 5 abas canônicas — **Revisar · Favoritos · Anotações · Flashcards · Insights** —; na Fase 1, apenas Revisar é funcional, as demais aparecem com badge "Em breve" e `disabled`. Navegação por `<NavLink>` com URL própria. (ver 05 §1.3, §2; 00 §6, §7)
- **RF-17.** Rotas `/caderno-erros` e `/caderno-erros/revisao` permanecem como aliases `<Navigate replace>` durante a transição; sidebar e bottom nav apontam para `/caderno`. Migração em paralelo, sem quebrar produção. (ver 05 §1.2, §5.8)
- **RF-18.** Hero (`PageHero`) dark com: progresso, stats (pendentes/resolvidas/especialidades), streak e **countdown ENAMED** ("Faltam N dias", via `ENAMED_DATE`; ocultado quando N≤0). (ver 05 §2.2, §5.3)
- **RF-19.** Card `HeroNextCard` "Para revisar agora" quando há entradas devidas (`srs_due_at <= fim do dia local`), com CTA "Iniciar sessão (N)" e nota do aluno. Variações de copy por quantidade (1 / 2–5 / >5). (ver 03 §4; 05 §2)
- **RF-20.** Fila segmentada em 4 seções com contagem no cabeçalho: **Devidas hoje** (`srs_due_at <= now` e não dominada), **Em aprendizado** (`srs_reps >= 1`, due futuro, intervalo ≤ 14d), **Agendadas** (due futuro, intervalo > 14d), **Dominadas** (`mastered_at IS NOT NULL`, colapsável). (ver 05 §2.1)
- **RF-21.** Componente único `NotebookEntryCard` substitui `QueueRow` e `EntryCard`: barra de cor por causa, badge de causa **com label**, preview do enunciado expansível inline, "Sua resposta → Correta" + nota, status SRS ("volta em 3d"/"devida hoje"/"dominada") e ações de rodapé ([Revisar], [⋯] editar/remover). (ver 05 §3)
- **RF-22.** Remoção sempre com confirmação + **undo**: optimistic update + `toast` com ação "Desfazer" (5s) antes de persistir. Toda mutação emite toast. (ver 05 §6.3, §6.4; 00 §9)
- **RF-23.** "Já dominei" é **removido** da UI; o estado "Dominada" passa a ser determinado por `mastered_at` (automático). `resolved_at` legado é ignorado pela nova UI. (ver 01 §2.3; 03 §1.5)
- **RF-24.** Estados de página: Loading (`CadernoSkeleton`), Erro de carregamento, Vazio (nunca adicionou), Dashboard ativo, Zero pendentes (`ZeroPendingState` "Caderno zerado 🎯" + próxima data devida), Filtro sem resultado (+ "Limpar filtros"). Sem flash de "Vazio" durante o primeiro load. (ver 05 §4; 03 §6)

### 6.4 Sessão de recall ativo (spec 03)

- **RF-25.** A sessão (`/caderno/revisao`) é uma máquina de estados linear por questão com **5 fases**: (1) enunciado sem gabarito → (2) seleção + confiança → (3) revelação + Prof. San → (4) autoavaliação → (5) SRS agenda + transição. (ver 03 §1)
- **RF-26.** **Fase 1:** alternativas A–E neutras, sem cor, sem gabarito, sem Prof. San. O gabarito (`correctOptionId`) não é exposto na UI antes da Fase 3 (`RecallQuestionCard` recebe `revealCorrect: boolean`). (ver 03 §0, §1)
- **RF-27.** **Fase 2:** após marcar, captura obrigatória de confiança (`baixa/media/alta`) antes de revelar. Microcopy "Seja honesto — isso ajusta sua agenda de revisão." (ver 03 §1, §2.2)
- **RF-28.** **Fase 3:** revelação imediata (cores correta/errada, badges, racionais por alternativa) + bloco Prof. San (`ai_review_md` cacheado ou gerado on-demand, com skeleton "pensando"). Chat Prof. San disponível (limite 10/entrada). O registro via `record_review_attempt_guarded` é **fire-and-forget** e não bloqueia a revelação. (ver 03 §1, §8; Apêndice A)
- **RF-29.** **Fase 4:** autoavaliação em 4 níveis (`errei/dificil/bom/facil`). "Fácil" desabilitado se o aluno errou na Fase 1. (ver 03 §1, §2.3)
- **RF-30.** **Fase 5:** ao autoavaliar, chama `schedule_next_review_guarded(p_entry_id, p_outcome, p_confidence)` — esta chamada **bloqueia** a transição (spinner; timeout de 3s avança com aviso). Se `mastered` retornar true, incrementa "Dominadas" + toast "Dominada! Q{n} sai da fila por um bom tempo." Caso contrário, sem toast. (ver 03 §1, §2.4; Apêndice A; 00 §1)
- **RF-31.** Atalhos de teclado sem colisão, verificando a fase ativa: `A–E` (fase 1), `1–3` (confiança, fase 2), `1–4` (autoavaliação, fase 4), `←→` navegar/pular, `R` remover, `Esc`/`Enter` no chat. "Já dominei" (`D`) e snooze (`J`) deixam de existir como atalhos; `D` passa a marcar alternativa D. (ver 03 §3)
- **RF-32.** Dois modos de sessão pela mesma URL: `?mode=due` (padrão, só devidas hoje) e `?mode=all` (todas as pendentes). (ver 03 §4.3)
- **RF-33.** `SessionSummary` revisado: renomear `snoozed`→`scheduled`; adicionar `nextDueDate`; exibir apenas estatísticas locais (dominadas / agendadas / restantes / tempo / top-áreas); CTA "Continuar revisão (N restantes)". O bloco de insight macro do Prof. San via edge function é **(Fase 2)**. (ver 03 §2.5, §5, §8.4; 00 §11)
- **RF-34.** `useExamFlow` **não** é reusado na sessão de revisão; criar `useActiveRecallSession` (fila, fase, seleção, confiança, autoavaliação, coordenação das RPCs) e `useRecallKeyboard`. (ver 03 §9.2)

### 6.5 Motor SRS (spec 02)

- **RF-35.** Algoritmo **SM-2-lite** server-side. O cliente **nunca** calcula SRS — tudo via `schedule_next_review_guarded`. Campos: `srs_ease` (default 2.5), `srs_interval`, `srs_reps`, `srs_lapses`, `srs_due_at` (fonte da verdade de agendamento). (ver 02 §1; 01 §2; 00 §1, §3)
- **RF-36.** Mapeamento autoavaliação → quality: `errei`=0 (lapso), `dificil`=2, `bom`=3, `facil`=4. Lapso reseta reps, reduz ease (−0.20, piso 1.3), intervalo a ~20% do anterior (mín 1d). (ver 02 §2, §6.1)
- **RF-37.** Modulação por causa do erro: ease inicial por `reason` (Lacuna/Chute 2.1, Diferencial 2.3, Memória 2.5, Atenção 2.8); Atenção tem intervalos iniciais maiores (2d/6d); Lacuna entra em `awaiting_lesson` (bloqueada até "já estudei este tema"); Chute é tratada como Lacuna até promoção (`srs_reps>=2` e confiança ≥ media nas 2 últimas). (ver 02 §3)
- **RF-38.** Influência da confiança: confiança `baixa` **não conta para reps** e força tratamento como "Difícil" (q=2); `media` conta para reps mas não para progressão de domínio; `alta` conta integralmente. (ver 02 §4)
- **RF-39.** Domínio **automático** (`mastered_at`): `srs_reps >= 3` E `srs_interval >= 21` E confiança das 2 últimas revisões ≥ `media` E `last_review_outcome IN ('bom','facil')` E sem lapso na sequência. Recaída zera `mastered_at` em qualquer lapso. (ver 02 §5; 01 §2.1; 00 §4)
- **RF-40.** `record_review_attempt_guarded` insere em `review_attempts` (log imutável; RLS bloqueia INSERT direto e UPDATE/DELETE) e dispara o cálculo SRS atomicamente. (ver 01 §3, §7.2; 02 §7)
- **RF-41.** Leech: `srs_lapses >= 4` reconhecido pelo motor (estado `leech_blocked`); reativável via `reset_leech_guarded`. Intervenção pedagógica completa é Fase 3 (não-objetivo). (ver 02 §6; 00 §4)
- **RF-42.** Snooze manual ("adiar") via `snooze_error_notebook_entry` (nome existente mantido): atualiza `srs_due_at` **e** `next_review_at`, **sem** tocar `srs_reps`/`srs_ease`; seta `last_review_outcome='snoozed'`. É override, não revisão. (ver 02 §7.4; 01 §7.4; 00 §1)
- **RF-43.** "Devida hoje" = `srs_due_at <= fim do dia local (America/Sao_Paulo)`, não `<= NOW()`. (ver 02 §9.4; 00 §4)

### 6.6 Busca, ações em lote e mobile (spec 05)

- **RF-44.** Busca textual no caderno (`FilterBar`): input "Buscar" com placeholder "Questão, área ou simulado…". Filtros de **Causa** e **Área** com nomenclatura fixa em todas as abas e estado ativo sempre visível (`aria-checked` + cor + check). (ver 05 §6.5, §6.6; 00 §7)
- **RF-45.** Ações em lote e quick actions na lista, com confirmação/undo e toasts em toda ação (anti-padrões Medway m4/m5). (ver 05 §6.3, §6.4)
- **RF-46.** Paridade mobile da sessão: painel de fila vira **bottom sheet** (`Sheet` shadcn) acionado por botão no header; action bar reorganizada por fase; gestos de swipe (←→) com threshold de 60px horizontal/30px vertical; enunciado longo com `max-h-[50vh]` scrollável. (ver 03 §7)

### 6.7 Telemetria (spec 06)

- **RF-47.** Instrumentar o funil da Fase 1, todos prefixados `caderno_` e adicionados ao union `AnalyticsEventName` em `src/lib/analytics.ts`: triagem (`caderno_triage_viewed`, `caderno_triage_item_toggled`, `caderno_triage_batch_added`), recall (`caderno_recall_answer_selected`, `caderno_recall_confidence_set`, `caderno_recall_revealed`, `caderno_recall_self_graded`), domínio/leech/snooze (`caderno_entry_mastered` com `{via_srs:true}`, `caderno_entry_leech_triggered`, `caderno_entry_snoozed`), fim de sessão (`caderno_revisao_session_ended`). (ver 06 §B.1, §B.2; 00 §5)
- **RF-48.** Mapear os eventos `srs_*` propostos na spec 02 para os nomes canônicos `caderno_*` (nunca usar `srs_*` no código). Manter compat reversa de `caderno_revisao_snoozed` → `caderno_entry_snoozed`. (ver 00 §5; 06 §B.2)
- **RF-49.** Super-properties em todo evento de caderno: `user_segment` e `caderno_total_entries`. (ver 06 §B.2)

---

## 7. Requisitos não-funcionais

### Performance
- **RNF-01.** Sessão de revisão usa dados em cache (React Query, staleTime 5min); skeleton até `loading=false`, tempo de carregamento alvo < 800ms. (ver 03 §6.1)
- **RNF-02.** Índices SRS criados na migração (`idx_error_notebook_srs_due`, `idx_error_notebook_mastered`, `idx_error_notebook_leech`, índices de `review_attempts`) para suportar as queries de fila e domínio. (ver 01 §2, §3.2, §8)
- **RNF-03.** A triagem nunca bloqueia: render otimista com heurística, IA substitui assíncrona. (ver 04 §7.1)

### Acessibilidade (WCAG AA)
- **RNF-04.** Fluxo de recall completável 100% por teclado; foco movido para o `h2` da questão na transição; `radiogroup` com navegação por setas para alternativas/confiança/autoavaliação; `FocusTrap` no bottom sheet mobile. (ver 03 §10.1, §10.4)
- **RNF-05.** Contraste mínimo AA (texto normal ≥ 4.5:1; badges de causa verificados); ícones de ação sempre com `aria-label`/tooltip; `aria-live="polite"` nos blocos "pensando" e chat. (ver 03 §10.2, §10.3; 05 §6.9)
- **RNF-06.** Respeitar `prefers-reduced-motion`: remover animações de posição, manter só opacity; `motion-safe:animate-pulse` nos skeletons. (ver 03 §10.5)

### Latência e custo de IA
- **RNF-07.** `classify-exam-errors`: Gemini 2.5 Flash, `temperature 0.3`, `thinkingBudget 0`, timeout de fetch 25s; batch de 15; só envia questões candidatas (não o simulado inteiro), enunciado truncado em 600 chars e explicação em 400. Custo estimado ~$4/mês no volume previsto — sem rate limiting agressivo. (ver 04 §4.4, §4.5, §7.3, §7.5)
- **RNF-08.** Privacidade: o prompt de classificação **não** envia nome, e-mail, ID nem histórico do aluno. Apenas conteúdo de banca (enunciado, alternativas, resultado, confiança, área, tema, explicação). (ver 04 §7.4)

### Segurança / RLS
- **RNF-09.** Todas as tabelas com RLS impondo `auth.uid() = user_id`. Mutações sensíveis via RPCs `SECURITY DEFINER` no padrão `*_guarded`; `review_attempts` é log imutável (INSERT só via RPC, sem UPDATE/DELETE). `add_to_notebook_bulk_guarded` ignora qualquer `user_id` do payload (sempre `auth.uid()`). (ver 01 §3.3, §6, §7; 00 §1)

### Offline / sendBeacon do exame
- **RNF-10.** A captura de confiança não altera a lógica de resiliência do exame: persistência debounced (2s) + `fetch keepalive`/sendBeacon no `beforeunload` continuam funcionando; `confidence` é apenas mais um campo no payload já serializado. (ver 04 §1.4, §1.5)

### i18n PT-BR
- **RNF-11.** Toda a UI e microcopy em PT-BR (catálogo consolidado na spec 03 Apêndice B e spec 04 §1.3/§3.3). Enums de banco sem acento (`media`, `dificil`, `facil`) por contrato. (ver 00 §2)

### Compatibilidade retroativa
- **RNF-12.** A migração é aditiva e idempotente; o app atual (`main`) continua funcionando durante e após a migração sem alteração de frontend. Backfill conservador de `answers.confidence` (`high_confidence=true → 'alta'`; resto → `NULL`) e de `srs_due_at`/`mastered_at` para entradas existentes. (ver 01 §8, §9)

---

## 8. Dependências e sequência

### Fase 0 destrava tudo
A **Fase 0** é pré-requisito de toda a Fase 1 e tem duas frentes:
1. **Migração de schema (spec 01)** — script SQL idempotente: colunas SRS + `confidence_at_answer` + `mastered_at` + `last_review_outcome` em `error_notebook`; coluna `confidence` em `answers`; coluna `ai_suggested_reason` em `attempt_question_results`; tabela `review_attempts`; tabelas `decks`/`flashcards` (schema antecipado, sem uso na Fase 1); índices; RLS; RPCs `schedule_next_review_guarded`, `record_review_attempt_guarded`, `add_to_notebook_bulk_guarded`, `reset_leech_guarded`; ajuste interno de `snooze_error_notebook_entry`.
2. **Confiança upstream em `useExamFlow`** — única dependência que toca o motor de prova: campo em `ExamAnswer`, captura/atalhos, inclusão no upsert e no fallback `beforeunload`. (visão §6.2; 00 §5; 04 §1.4)

### Nova edge function
- `classify-exam-errors` (nova) — triagem pós-prova. (ver 04 §4; 00 §8)
- Reutilizam: `gemini-error-notebook-review` e `gemini-error-notebook-chat` (existentes).
- `gemini-caderno-session-insight` — **Fase 2** (insight macro do Prof. San no SessionSummary; fora do escopo da Fase 1).

### Ordem recomendada de entrega

1. **Fase 0 — Fundação:** migração de schema + RPCs; captura de confiança no `useExamFlow`. (destrava o resto)
2. **Casca em paralelo (spec 05, passo 1–2):** criar `src/components/caderno/*` e `CadernoPage`, rota `/caderno` ao lado de `/caderno-erros`, sidebar apontando para a nova rota; QA em staging.
3. **Triagem pós-prova (spec 04):** `classify-exam-errors` + `TriagemPage` + `add_to_notebook_bulk_guarded` (já existe da Fase 0).
4. **SRS + recall ativo (specs 02–03):** `useActiveRecallSession`, FSM de 5 fases, `RecallQuestionCard`/`ConfidenceSelector`/`SelfGradeSelector`, integração com `record_review_attempt_guarded` e `schedule_next_review_guarded`; `SessionSummary` revisado.
5. **Busca/lote/mobile + telemetria:** `FilterBar` com busca, bottom sheet mobile, eventos `caderno_*`.
6. **Consolidação (spec 05, passo 3 + N+1):** converter `/caderno-erros` em redirect, atualizar links internos, deletar arquivos sandbox marcados, remover aliases após confirmar ausência de deep-links externos.

---

## 9. Riscos e mitigações

| # | Risco | Mitigação |
|---|---|---|
| R1 | **Atrito da confiança na prova** desacelera o aluno em prova cronometrada. | Confiança é opcional e não bloqueante; seletor leve de 3 chips; trocar alternativa não reseta; atalhos `1/2/3`. (RF-01..04) |
| R2 | **Custo/latência de IA** na triagem (simulados grandes). | Só candidatas são enviadas (não o simulado todo); batch 15; cache em `ai_suggested_reason`; tela não bloqueante com heurística; timeout 25s → fallback silencioso. Custo estimado irrelevante (~$4/mês). |
| R3 | **Migração do fork quebrar produção.** | Rota nova em paralelo; aliases `Navigate`; migração de schema aditiva/idempotente com rollback documentado; feature flag opcional (`VITE_CADERNO_NEW_SHELL`/`caderno_v2_enabled`). |
| R4 | **Aceitação do recall ativo** vs. hábito de "só ler" a resposta. | Microcopy honesta; "Pular sem avaliar" sempre disponível como escape; ganho pedagógico comunicado; M3 (completude do recall) monitorada — abaixo de 50% revisa-se o UX da autoavaliação. |
| R5 | **SRS percebido como punitivo** (intervalos longos, leech). | Lapso preserva ~20% do intervalo (não reseta a 1d fixo); leech é reativável (não suspende permanentemente); snooze manual segue disponível como override. |
| R6 | **Classificação ruim da IA** gera motivos errados em massa. | Aluno ajusta com 1 toque; telemetria de `reason_changed` e taxa de rejeição (>50% = sinal de IA ruim); heurística conservadora como piso. |
| R7 | **Confiança inconsistente** ("Fácil" + baixa confiança) distorce o SRS. | Regra de override: confiança baixa força q=2 e não conta para reps/domínio; "Fácil" desabilitado quando errou. |

---

## 10. Plano de rollout

- **Feature flag:** `caderno_v2_enabled` por usuário/segmento (em `profiles` ou env) — o modelo de dados suporta as duas versões simultaneamente (campos SRS opcionais até serem usados). Alternativa centralizada: `VITE_CADERNO_NEW_SHELL`. (ver 01 §9.3; 05 §5.8)
- **Rota nova em paralelo:** `/caderno` convive com `/caderno-erros` (alias) até validação completa; rollback = desligar a flag / reverter a rota num único ponto. (ver 05 §5.8)
- **Beta com subconjunto PRO:** ativar a flag para uma coorte PRO, monitorar M1–M4 e M7 + saúde de IA (taxa de fallback, latência) por 1–2 semanas.
- **Critérios de GA:**
  - M3 (completude do recall) ≥ ~70% e estável; sem regressão de finalização de prova.
  - Migração validada em staging (todos os estados, filtros, sessão, mobile) e `/caderno-erros` redirecionando corretamente.
  - Taxa de fallback da triagem dentro do esperado e custo/latência de IA sob controle.
  - Zero erros críticos de RLS/segurança (RPCs `*_guarded` validadas).
  - Após GA + confirmação de ausência de deep-links externos: remover aliases e deletar arquivos sandbox marcados.

---

## 11. Critérios de aceite de release (Definition of Done do MVP)

**Fase 0 / Dados**
- [ ] Migração SQL idempotente aplicada; rollback testado; backfill de `srs_due_at`, `mastered_at` e `answers.confidence` correto.
- [ ] RPCs `schedule_next_review_guarded`, `record_review_attempt_guarded`, `add_to_notebook_bulk_guarded`, `reset_leech_guarded` criadas, com ownership e validação de enums; `snooze_error_notebook_entry` atualiza ambos os campos.
- [ ] RLS ativa em todas as tabelas novas; `review_attempts` imutável (INSERT só via RPC).

**Captura de confiança**
- [ ] Seletor de confiança na prova (opcional, não bloqueante, 3 chips, atalhos `1/2/3`); persistido via upsert + keepalive; enum `baixa/media/alta`.

**Triagem**
- [ ] `/simulados/:id/triagem` PRO-only (não-PRO → `/resultado`); candidatos corretos e ordenados; pré-classificação via `classify-exam-errors` (batch 15) com heurística de fallback; cache em `ai_suggested_reason`; duplicatas marcadas; lote via RPC com toast de resultado.

**Casca / aba Revisar**
- [ ] `CadernoPage` em `/caderno` com `TabBar` (Revisar funcional; demais "Em breve"); aliases de `/caderno-erros`; gate PRO em todas as sub-rotas.
- [ ] `PageHero` (stats + streak + countdown ENAMED), `HeroNextCard`, fila segmentada (4 seções com contagem), `NotebookEntryCard` único, todos os estados de página, undo + toasts; "Já dominei" removido.

**Recall + SRS**
- [ ] FSM de 5 fases; gabarito oculto até a fase 3; confiança e autoavaliação obrigatórias antes do agendamento; "Fácil" desabilitado em erro; atalhos sem colisão; domínio automático correto (SM-2-lite + modulação por causa); leech reconhecido e reativável.
- [ ] `SessionSummary` com `scheduled`, `nextDueDate` e insight (falha silenciosa).

**Busca / lote / mobile**
- [ ] Busca + filtros Causa/Área com estado ativo visível; ações em lote; paridade mobile (bottom sheet, swipe, action bar por fase).

**Acessibilidade / NFR**
- [ ] Fluxo navegável 100% por teclado; contraste AA; `prefers-reduced-motion` respeitado; resiliência offline do exame intacta; UI em PT-BR.

**Telemetria**
- [ ] Todos os eventos `caderno_*` da Fase 1 emitidos com as propriedades especificadas; super-properties presentes; mapeamento `srs_*`→`caderno_*` aplicado.

---

## 12. Questões em aberto

| # | Questão | Status |
|---|---|---|
| **Q1** | **`ENAMED_DATE` e fuso do usuário.** Quem define/atualiza a data do ENAMED 2026 (e como) e onde fica `profiles.timezone` (campo a criar?) para a regra de "devida hoje"? O countdown do hero e a definição de "devida hoje" dependem disso; hoje hardcoded em `constants.ts` com fallback `America/Sao_Paulo`. (05 §2.2; 02 §9.4) | **EM ABERTO — Dono: Conteúdo/Ops** |
| **Q2** | **Estratégia de feature flag definitiva.** | **RESOLVIDO (ver 00-contratos §11)** — Flag primária por usuário em `profiles.caderno_v2_enabled` (rollout gradual server-side) + kill-switch de ambiente (`VITE_CADERNO_NEW_SHELL`). Rota nova `/caderno` roda em paralelo à `/caderno-erros` durante a transição, sem downtime. |
| **Q3** | **Desbloqueio de Lacuna sem deep-link de aula (I5 é Fase 2).** | **RESOLVIDO (ver 00-contratos §11)** — Na Fase 1, o estado `awaiting_lesson` é satisfeito por confirmação manual "Já estudei isso" no card/sessão. O deep-link para a aula (I5) e o disparo automático de `caderno_lesson_accessed` entram na Fase 2. |
| **Q4** | **`reset_leech_guarded`: RPC separada ou parâmetro de `schedule_next_review_guarded`?** | **RESOLVIDO (ver 00-contratos §11)** — RPC separada `reset_leech_guarded(p_entry_id uuid)` conforme canônico §1. |
| **Q5** | **Contrato e limite do `add_to_notebook_bulk_guarded`.** | **RESOLVIDO (ver 00-contratos §11)** — Assinatura única `add_to_notebook_bulk_guarded(p_entries jsonb) → jsonb {added int, skipped int}`, limite **100** entradas/chamada (cobre um ENAMED completo). |
| **Q6** | **Chave de deduplicação da triagem.** | **RESOLVIDO (ver 00-contratos §11)** — Chave **`(user_id, question_id)`**. A mesma questão errada em simulados diferentes não duplica (conta como `skipped`). Soft-deletes são ressuscitados (reabre a entrada existente, não cria nova). |
| **Q7** | **Meta numérica de baseline.** As diretrizes de M1–M7 são chutes informados; quando calibrar com dados reais do beta? | **EM ABERTO — Dono: Produto/Dados** |
| **Q8** | **`gemini-caderno-session-insight` / Prof. San macro no resumo de sessão é Fase 1 ou Fase 2?** | **RESOLVIDO (ver 00-contratos §11)** — `SessionSummary` da Fase 1 usa apenas estatísticas locais (dominadas / agendadas / restantes / tempo / top-áreas), sem chamada de IA. O insight macro do Prof. San e a edge function `caderno-pattern-insights` são Fase 2. A única edge function nova da Fase 1 é `classify-exam-errors`. |
