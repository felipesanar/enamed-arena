# F1-6: labels, listas e historico por edicao

## Flag e contrato de leitura

- A interface usa `useAppConfig('editions_ui')`; configuracao ausente ou falha permanece desativada.
- `simuladosApi.listSimulados(includeEdition = false)` e `getSimulado(idOrSlug, includeEdition = false)` preservam a leitura antiga por padrao, sem join de edicoes.
- Com opt-in, a consulta usa `exam_editions!simulados_edition_id_fkey(code, label)` e mapeia `editionId`, `editionCode`, `editionLabel` e `sourceSimuladoId`. Relacao ausente ou malformada nao inventa metadados.
- A lista com opt-in inclui `published`, `test` e `archived`, para nao ocultar o historico arquivado. Sem opt-in, continua incluindo apenas `published` e `test`.
- UUID e slug continuam aceitos na busca individual e no lookup da lista.
- O cache de `useSimulados` inclui usuario e flag. Nao ha carregamento de simulados antes de concluir a autenticacao nem exposicao da lista quando deslogado.
- `useSimuladoDetail` consulta diretamente o UUID ou slug com o opt-in da flag e usa cache `['simulado', routeRef, userId, includeCorrectAnswers, editionsUi]`. Nao depende da lista para obter a edicao ou os campos da tentativa; tambem aguarda autenticacao e oculta dados quando deslogado.

## Labels e agrupamentos

- Os consumidores usam `formatSimuladoLabel` e o badge usa `editionLabel`, depois `editionCode`, ou `ENAMED` neutro. Ano atual e numero da prova nunca determinam a edicao.
- O formatter puro esta em `src/lib/simulado-label.ts`, com apenas importacao de tipo. `editions.ts` preserva sua API publica com um wrapper; `simulado-helpers.ts` importa o formatter puro diretamente. Isso remove o ciclo entre helpers de status e resolvers de edicao sem alterar a saida do label ou regras de selecao/data/status.
- `groupSimuladosByEdition` identifica grupos por ID, com fallback para codigo. Sem esses metadados, o grupo e explicitamente `Legado sem edicao`.
- A lista principal considera a edicao resolvida por `useUserEdition`; esse hook so e montado com a flag ativa. Historico de outras edicoes fica recolhido em `details`/`summary`.
- Ranking e desempenho identificam a prova selecionada. O seletor de ranking agrupa opcoes com a flag ativa e preserva os botoes legados com a flag desativada.
- Ranking e comparativo enriquecem metadados pela lista sem alterar suas fontes de calculo. As series do radar usam `simuladoId`, evitando colisao quando edicoes repetem o numero da prova.
- A landing nao consulta simulados anonimamente. Para usuario autenticado e flag ativa, mostra apenas a edicao ativa ou proxima do catalogo; ausencia ou falha resulta em calendario neutro, sem datas ficticias. O estado e isolado por usuario e flag.

## Retomada de treino

- Depois da janela oficial, uma tentativa iniciada e nao finalizada continua `in_progress` apenas quando `isWithinWindow === false` e `effectiveDeadline` e valido e estritamente futuro.
- No limite exato do deadline, a tentativa deixa de ser retomavel. Deadline invalido, ausente ou expirado e tentativa oficial nao estendem a janela.
- Cards, timeline e detalhe identificam o treino e oferecem continuidade de acordo com o status derivado. O hook da lista reavalia o tempo a cada 30 segundos.
- A validacao do servidor continua sendo a autoridade. Nenhuma alteracao foi feita nas RPCs de criacao, progresso, finalizacao ou calculo de score.
- O lifecycle usa `resultsReleaseAt` nas mensagens de realizacao presencial e pos-finalizacao, com horario de Brasilia. Sem data valida, usa texto neutro; com resultados ja liberados, orienta consultar desempenho.
- O detalhe direto transporta `effective_deadline` e `is_within_window` como `effectiveDeadline` e `isWithinWindow`. `SimuladoDetailPage` usa esse detalhe como fonte, sem sobrescreve-lo pelo catalogo potencialmente desatualizado.
- O timer existente continua lendo `state.effectiveDeadline` recuperado pelo storage, com o mesmo relogio compartilhado do servidor. Nao foi criado outro clock nem alterado o fluxo de persistencia, inicializacao ou finalizacao. Um teste conecta o carregamento direto por slug ao lifecycle e confirma que o timer usa o deadline persistido, nao o fim da janela oficial nem o horario local.

## PDFs

- `drawPremiumHeader` aceita badge opcional, com default `ENAMED`.
- Os geradores de gabarito e prova revisada aceitam `simulado?: Pick<SimuladoConfig, 'editionCode' | 'editionLabel'>`. Com metadados, usam a edicao real; sem metadados, permanecem neutros.
- O caller real e `src/pages/CorrecaoPage.tsx`: ele repassa o simulado selecionado a `usePdfDownload`, que envia os metadados aos dois geradores, inclusive depois de trocar a prova. O titulo da prova nao determina a edicao.
- O rodape compartilhado usa `Simulados SanarFlix`. O caderno cumulativo permanece neutro, sem atribuir uma edicao unica ao conjunto.

## Integracoes concluidas e fronteiras preservadas

- As duas pendencias anteriores, repasse PDF e carregamento direto de metadados/deadlines, foram resolvidas com a ampliacao de escopo.
- `SimuladoResultPage.tsx` nao existe neste checkout. O repasse foi conectado ao caller encontrado, `CorrecaoPage.tsx`; nenhuma pagina nova foi criada.
- Nao foi necessario alterar `SimuladoExamPage.tsx` nem `useExamFlow.ts`: o fluxo existente ja compartilha o relogio do servidor e o deadline persistido com o lifecycle/timer.
- A flag de edicao nao habilita gabaritos. O modo padrao continua chamando `getQuestions(canonicalId, false)`. O modo de correcao explicito continua separado no cache e delegado a API F0, que consulta somente colunas publicas por REST e obtem correcoes pela RPC protegida `get_question_explanations`, sem fallback direto quando a liberacao e negada.

Sem pendencias dessas duas integracoes no escopo local. A cobertura e de testes unitarios e integracoes em jsdom com dependencias simuladas; nao representa execucao de navegador E2E ou validacao em producao.

## Validacao restrita

Comando executado, com timeout de 120 segundos:

```text
npx vitest run src/services/simuladosApi.test.ts src/hooks/useSimulados.test.tsx src/lib/simulado-helpers.test.ts src/lib/edition-groups.test.ts src/pages/SimuladosPage.test.tsx src/pages/SimuladoDetailPage.test.tsx src/pages/RankingPage.test.tsx src/pages/DesempenhoPage.test.tsx src/components/SimuladoCard.test.tsx src/components/simulados/SimuladosTimelineSection.test.tsx src/components/ranking/RankingHero.test.tsx src/components/ranking/RankingSimuladoSelector.test.tsx src/components/ranking/CutoffScoreModal.test.tsx src/components/desempenho/panel/SimuladoTabs.test.tsx src/components/comparativo/ComparativoSpecialtyRadar.test.tsx src/components/landing/LandingHowItWorks.test.tsx src/lib/pdf/pdfHelpers.test.ts src/lib/pdf/gabaritoPdf.test.ts src/lib/pdf/provaRevisadaPdf.test.ts src/lib/cadernoExport.test.ts src/hooks/exam/useExamLifecycle.test.tsx src/hooks/useSimuladoDetail.test.tsx src/hooks/usePdfDownload.test.tsx src/pages/CorrecaoPage.test.tsx src/hooks/useExamFlow.test.tsx src/services/simuladosApi.questions.test.ts src/services/simuladosApi.finalize.test.ts
```

Resultado da rodada de integracoes: 27 arquivos passando, 164 testes passando e nenhum falhando (23,68 segundos). Inclui os 118 testes da rodada anterior, novos testes de integracao e regressoes direcionadas da API F0 e do clock/finalizacao existentes. A primeira rodada dos novos testes, antes da implementacao, falhou em 12 assercoes por ausencia do repasse PDF, opt-in/cache/campos no detalhe e dependencia de dados antigos da lista.

Lint executado somente nos arquivos TypeScript alterados e seus testes: nenhum erro e 39 avisos em `RankingView.tsx`, `gabaritoPdf.ts`, `provaRevisadaPdf.ts`, `CorrecaoPage.tsx` e `simuladosApi.ts`. O aviso adicional vem da inclusao de `CorrecaoPage.tsx` na verificacao (`notebookRefresh` ja existente). Os avisos remanescentes nao foram corrigidos para evitar limpeza alheia ao escopo.

Nao foram executados build, typecheck global, suite global, Deno, testes E2E ou validacao em producao. Nenhum pacote foi instalado e nenhum commit foi criado.

## Revisao independente de tipos e ciclo

- O log `.superpowers/labels-types-review.log`, produzido pelo Codex, apontou erros desta entrega. A reproducao local restrita confirmou 14 erros, antes das correcoes, usando as opcoes de `tsconfig.app.json` e incluindo `src/test/setup.ts` para as declaracoes dos matchers.
- Foram tipadas as props dos mocks de radar, motion, PageTransition e RankingView, sem novos `any` ou ignores. A fixture de `SimuladosPage` agora cumpre `SimuladoWithStatus`, incluindo `description`, sem cast. A fixture do grupo legado usa um `Pick<SimuladoConfig, ...>` valido.
- O carregamento assincrono da landing recebe um `accountId: string` apenas depois do narrowing de autenticacao, tanto no sucesso quanto no fallback vazio. Nao foi inventado um ID substituto nem alterada a selecao de edicao.
- `CorrecaoPage` envia `simulado ?? undefined` ao hook PDF. O novo teste verifica a ausencia de metadados; o teste existente continua verificando o repasse da edicao real quando presente.
- TDD desta revisao: o teste do novo formatter falhou inicialmente por modulo inexistente, e a nova regressao do caller PDF falhou por receber `null` em vez de `undefined`. Depois da implementacao, ambos passaram. Os testes do formatter tambem impedem a carga dos modulos de resolvers/status por meio de mocks que lancam erro se acessados.

A checagem de tipos usou a API do TypeScript em um script temporario local, sem alterar configuracoes do projeto. Foram resolvidas dependencias dos 17 arquivos selecionados, mas os diagnosticos sintaticos/semanticos foram solicitados somente para esses arquivos, sem passe global de diagnosticos. Resultado final: **17 arquivos explicitos, 0 erros, exit 0**. Nao equivale a um typecheck global; a repeticao global permanece com o Codex.

Comando da checagem restrita:

```text
node "C:\Users\FELIPE~1.SOU\AppData\Local\Temp\opencode-sanar\labels-types-check.cjs" src/test/setup.ts src/components/comparativo/ComparativoSpecialtyRadar.test.tsx src/components/landing/LandingHowItWorks.test.tsx src/components/landing/LandingHowItWorks.tsx src/pages/RankingPage.test.tsx src/pages/SimuladosPage.test.tsx src/lib/edition-groups.test.ts src/pages/CorrecaoPage.tsx src/pages/CorrecaoPage.test.tsx src/hooks/usePdfDownload.ts src/hooks/usePdfDownload.test.tsx src/lib/editions.ts src/lib/editions.test.ts src/lib/simulado-helpers.ts src/lib/simulado-helpers.test.ts src/lib/simulado-label.ts src/lib/simulado-label.test.ts
```

Regressoes direcionadas desta revisao, com timeout de 120 segundos:

```text
npx vitest run src/lib/simulado-label.test.ts src/lib/editions.test.ts src/lib/simulado-helpers.test.ts src/lib/edition-groups.test.ts src/components/comparativo/ComparativoSpecialtyRadar.test.tsx src/components/landing/LandingHowItWorks.test.tsx src/pages/RankingPage.test.tsx src/pages/SimuladosPage.test.tsx src/pages/CorrecaoPage.test.tsx src/hooks/usePdfDownload.test.tsx src/lib/pdf/pdfHelpers.test.ts src/lib/pdf/gabaritoPdf.test.ts src/lib/pdf/provaRevisadaPdf.test.ts src/lib/cadernoExport.test.ts
```

Resultado: **14 arquivos passando, 92 testes passando, 0 falhando**, em 20,23 segundos. Esta rodada e um subconjunto direcionado com testes novos, nao uma repeticao da rodada de 164 testes anterior.

Lint desta revisao:

```text
npx eslint src/components/comparativo/ComparativoSpecialtyRadar.test.tsx src/components/landing/LandingHowItWorks.test.tsx src/components/landing/LandingHowItWorks.tsx src/pages/RankingPage.test.tsx src/pages/SimuladosPage.test.tsx src/lib/edition-groups.test.ts src/pages/CorrecaoPage.tsx src/pages/CorrecaoPage.test.tsx src/hooks/usePdfDownload.ts src/hooks/usePdfDownload.test.tsx src/lib/editions.ts src/lib/editions.test.ts src/lib/simulado-helpers.ts src/lib/simulado-helpers.test.ts src/lib/simulado-label.ts src/lib/simulado-label.test.ts
```

Resultado: **0 erros, 1 aviso preexistente** (`notebookRefresh`, em `CorrecaoPage.tsx`). `git diff --check` tambem passou. Nenhum build, typecheck global ou teste fora dos caminhos explicitos foi executado nesta revisao.
