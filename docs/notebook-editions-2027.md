# Caderno Por Edicao (F2-7)

## Ativacao E Compatibilidade

O frontend usa `useAppConfig('editions_ui')`. Com a flag desligada, conserva as leituras legadas e ignora `edition` na URL, sem consultar o catalogo ou as novas RPCs. Com a flag ligada, ausencia de `edition` significa cumulativo; um UUID explicito precisa existir no catalogo antes da leitura. Catalogo indisponivel ou edicao invalida bloqueiam a leitura, sem fallback global.

O gate PRO existente permanece. O frontend nao define segmento, calcula score de prova ou altera regras de SRS. Este documento complementa `notebook-pages-2027.md` e `contracts/reprocessing-notebook-2027.md`.

## Lista E Contagens

- `list_error_notebook_filtered_page`: argumentos `p_edition_id`, `p_reason`, `p_area`, `p_search`, `p_state`, `p_limit`, `p_offset`; retorna pagina e total SQL.
- `get_error_notebook_filtered_counts`: mesmos filtros, sem limite/offset. As contagens agregam campos minimos, sem copiar textos de questoes ou caches de IA para JSON intermediario.
- Filtros sao aplicados antes de contar e paginar. A lista apresenta 50 entradas por pagina; o total nao e inferido pelo tamanho da pagina.
- Busca literal inclui area e numero da questao. A digitacao usa debounce de 300 ms e nao perde foco ao atualizar a consulta.
- Trocar edicao/filtros reinicia pagina e selecao. Nao ha placeholder de dados da edicao anterior.
- Cumulativo inclui entradas manuais. Edicao explicita exclui manuais sem vinculo e entradas de outras edicoes. Manual exige `question_id` e `simulado_id` nulos; entrada vinculada sem metadados de edicao recebe o rotulo `Edicao nao informada`.

A migration `20261104120002_fase2_notebook_filters.sql` preserva os gates de ownership, perfil, liberacao, tentativa e soft-delete do contrato base. Nao faz backfill, recalculo ou mutacao de aprendizado. A fixture `supabase/tests/fase2_notebook_filters.sql` usa 1500 entradas e termina com rollback.

## Leituras Completas E Identidade

Exportacao, recall e Treino percorrem `notebookApi.getAllRows`/walker em lotes de 100, sem teto artificial de 1000. Exportacao conserva os filtros ativos e identifica a edicao por questao no PDF. O adapter rejeita total alterado, pagina repetida, resultado parcial e owner inesperado; confirma a identidade apos awaits, contagens e enriquecimento. Isso detecta inconsistencias, mas nao transforma paginacao offset em snapshot transacional.

O menu de exportacao impede disparos simultaneos e descarta resultados atrasados apos troca de escopo/conta ou desmontagem. Recall descarta filas antigas, preserva campos SRS e nao altera sua maquina de estados, IA ou thresholds. Treino carrega o conjunto completo do escopo, limpa a area selecionada ao trocar escopo e preserva edicao nos links de revisao e retorno. `TreinoLauncher.onLaunch` continua apenas analytics; a navegacao pertence ao link existente.

## Cache E Invalidacao

As chaves incluem usuario e escopo relevante (edicao, flag, filtros e pagina). Prefixos publicos para invalidacao:

- `notebook-page`
- `notebook-counts`
- `notebook-due-count`
- `caderno-pattern-insights`
- `caderno-area-score-history`
- `caderno-confidence-calibration`

As mutacoes integradas de revisao, remocao, adiamento e desbloqueio de aula invalidam esses prefixos quando a flag esta ativa. Reprocessamento administrativo deve manter o contrato de prefixos, sem consultar dados de aluno como administrador.

## Insights

O cliente envia `{ editionId: UUID | null }` ao endpoint de padroes e valida o escopo retornado; a resposta inclui `editionId` e `editionLabel`. History e calibration usam `p_user_id` e `p_edition_id` via `notebookApi`, com verificacao de identidade apos resposta.

Com a flag ativa e escopo cumulativo, nao se consulta history nem se renderiza RoiPanel/grafico de percentual bruto: o contrato legado mistura modalidades/edicoes. A interface orienta selecionar uma edicao. Causas e confianca cumulativas continuam validas. Nao se inventam percentis, TRI ou notas de corte.

O endpoint `supabase/functions/caderno-pattern-insights/**` pertence ao job paralelo `pattern-server-6e7c` e nao foi alterado neste trabalho. Sua integracao real permanece uma verificacao separada.

## Validacao E Limites

- Suite frontend do escopo: API, lista, insights, due count, recall, links, exportacao, Treino, launcher e PDF; reexecucao final com 60 testes passando em 10 arquivos. Comando completo no handoff de UI.
- TypeScript local: `.superpowers/notebookQA/check-types.mjs`, 27 arquivos explicitamente selecionados, zero diagnosticos na reexecucao final; resolve dependencias, mas nao e typecheck global.
- QA React: `.superpowers/notebookQA/verify-react-final.mjs`, componentes reais com dados mockados, servidor local `127.0.0.1:54821`, seis combinacoes de viewport/tema. Nao e E2E contra Supabase.
- SQL: validacao local anterior em `127.0.0.1:54737`, clone `enamed_test_notebook_front_a_8a19`, migration/fixture de filtros com 1500 entradas; sem ambiente remoto ou deploy.
- Sem build, suite global, deploy, commit ou push neste escopo. Integracao do endpoint paralelo, checagens globais e validacao HTTP autenticada ficam com o orquestrador.

## Revisao Independente Do Orquestrador (04/11/2026)

O checkpoint frontend foi conferido no worktree isolado, sem alterar producao:

- TypeScript global (`node node_modules/typescript/bin/tsc -p tsconfig.app.json --noEmit`): exit 0, inclusive apos o ajuste de estabilidade do fallback do Treino.
- Lint dos 28 arquivos JS/TS alterados: exit 0, sem erros; 51 warnings, em grande parte preexistentes nos componentes legados.
- 60 testes em 10 arquivos passaram independentemente; apos o ajuste minimo de `useMemo`, os 9 testes de Treino/launcher passaram novamente. Os 4 testes do prototipo tambem passaram.
- A migration/fixture final passou no clone independente `enamed_test_notebook_front_codex_20261104`, com 1500 entradas, gates de acesso/liberacao, filtros, reaplicacao e rollback preservando o hash dos dados.
- QA com componentes React reais e mocks: 375/768/1440, claro/escuro, edicao selecionada com rotulo longo. As seis combinacoes mantiveram a largura da pagina dentro do viewport e a digitacao de `Cardio` com foco apos debounce, sem erro de pagina ou requisicao externa. As capturas ficam no artefato privado de QA do worktree.

Esses resultados nao substituem build/regressao finais do repositorio integrado nem E2E HTTP com Supabase Auth/Storage reais. O endpoint de diagnostico por edicao segue como dependencia separada deste checkpoint; nenhum deploy, migration remota ou envio foi executado.