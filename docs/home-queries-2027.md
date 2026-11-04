# Home e queries por edicao

Implementacao de F1-7/F3-7, job `f1-home-queries-6328`.

## Escopo e selecao

- `editions_ui=false` conserva os argumentos das consultas legadas, inclusive o select de ranking sem relacionamento com edicoes.
- Com a flag ligada e sem edicao resolvida, desempenho, ranking e comparativo ficam neutros. Nao ha fallback para agregados globais.
- Home, banner e destaque da lista compartilham `selectHomeSimulado`, que aplica o seletor canonico e remove resultados concluidos fora da janela de destaque de 14 dias de calendario em `America/Sao_Paulo`.
- Hero/banner recebem contexto opcional: `undefined` mantem o fluxo legado; `null` significa alvo nao resolvido.
- Calendario vazio oferece acesso aos treinos sem inventar uma data oficial nem remover o historico.
- A Home pede `useRanking({ selection: 'latest-in-edition', editionId })`: ultimo resultado liberado do alvo por liberacao, sequencia e ID. Nao grava nem altera a selecao da pagina de ranking.
- Escolha explicita de ranking e validada contra a lista e persistida por conta/alvo; historico de outra edicao continua selecionavel nessa pagina.

## Dados e permissoes

- Desempenho usa `p_edition_id` e `p_include_training=false` no fluxo novo. Historia scoped passa limite nulo, sem teto silencioso de 12/20 resultados.
- Zero e uma media valida. Falhas de desempenho/ranking aparecem com acao de nova tentativa, sem recuperar KPIs de outra edicao.
- A Home usa areas do comparativo, nao recalcula acertos a partir das questoes no cliente.
- A RPC de areas nao recebe edicao: suas linhas sao filtradas pelos simulados permitidos antes dos insights. Slots e entradas do comparativo ficam na edicao resolvida; treino nao entra nas entradas do fluxo novo.
- Top usa apenas `computePercentile(position, total)` com participante e total validos. Nao ha inferencia `100 - nota` nem variacao de colocacao derivada da nota.
- Resultado resolve slug para UUID antes de consultar tentativas. Nota e AQR ficam ocultos antes da liberacao, exceto com capability `results.view` retornada por `admin_get_access`. Papel administrativo isolado nao concede esse preview no hook de resultado.
- Erro ao consultar a capability e exposto; refetch tenta novamente a permissao. A permissao e cacheada por usuario, sem reaproveitar preview entre contas.

## Cache e finalizacao

Os quatro hooks usam React Query com `staleTime` de cinco minutos, sem `keepPreviousData` entre escopos. Chaves principais:

| Recurso | Chave |
| --- | --- |
| Desempenho | `['user-performance', userId, editionId ou 'legacy']` |
| Lista de ranking | `['ranking-simulados', userId, editionId ou 'legacy']` |
| Ranking | `['ranking', userId, scope, simuladoId]` |
| Comparativo | `['comparative', userId, scope, isAdmin, eligibleIds]` |
| Permissao de resultado | `['exam-result-access', userId]` |
| Resultado | `['exam-result', userId, routeRef, preview]` |

Token refresh com o mesmo ID nao muda o escopo. Logout/consultas desabilitadas nao devolvem dados armazenados de outra conta. A liberacao do resultado invalida o cache mesmo dentro de cinco minutos; ao remontar apos a liberacao, o hook tambem detecta a mudanca temporal.

`invalidateExamQueries` marca os recursos pertinentes do usuario como stale com `refetchType: 'none'`. O detalhe e restrito ao UUID/slug afetado. Finalizacao nao espera consultas remotas, nao invalida outro usuario/admin e nao altera RPC, clock, copy ou politica de retentativa do finalizador.

## Validacao local

Rodada final em 2026-11-04: **14 arquivos, 93 testes aprovados**, 56,51 s, com `--maxWorkers=2`.

```text
node node_modules/vitest/vitest.mjs run src/hooks/useRanking.test.tsx src/hooks/useUserPerformance.test.tsx src/hooks/useComparativeData.test.tsx src/hooks/useExamResult.test.tsx src/hooks/useExamEditions.test.tsx src/hooks/useUserEdition.test.tsx src/hooks/exam/useExamLifecycle.test.tsx src/services/rankingApi.test.ts src/services/simuladosApi.test.ts src/lib/exam-query-cache.test.ts src/lib/home-hero-state.test.ts src/lib/simuladoBannerScenario.test.ts src/components/premium/home/HomePagePremium.test.tsx src/pages/SimuladosPage.test.tsx --maxWorkers=2
```

Cobertura inclui selecao/historico, flag desligada, alvo pendente, zero, cache fresco e envelhecido de desempenho, troca de conta/alvo, logout, token refresh, gates de liberacao/preview, erros/refetch, filtro antes dos insights, expiracao BRT e invalidacao sem refetch apos submit. Nao representa uma matriz exaustiva de todos esses cenarios para cada hook.

Lint restrito aos 15 arquivos de implementacao: **0 erros, 36 avisos** (`no-explicit-any` e uma diretiva disable sem uso). `git diff --check` sem erros de whitespace; Git emite avisos de conversao LF/CRLF.

O ultimo caso adicionado seguiu red/green: falha de permissao inicialmente nao aparecia no retorno; apos o ajuste, os seis testes de resultado passaram. Uma execucao isolada imprimiu sucesso mas atingiu o timeout ao encerrar; a rodada final completa encerrou normalmente.

Sem instalacoes, rede, subagentes, alteracoes de `.env`, SQL, tipos gerados, commits ou comandos Git mutantes. Build, typecheck/suite globais e verificacao visual nao foram executados neste job. Analise de bundle: `docs/bundle-analysis-2027.md`.

## Revisao Codex: tipos e retomada

Rodada posterior a revisao independente dos 93 testes:

- Corrigidos os cinco diagnosticos reportados: narrowing explicito de `currentUser` na Home, argumento tipado no mock `select` de ranking e bridge local da chamada `get_user_performance_history`.
- O bridge aceita apenas essa RPC, com argumentos e resposta tipados (`PostgrestSingleResponse<UserPerformanceHistoryRow[]>`). Preserva `p_limit: null` real para historia sem limite; nao amplia tipos do cliente Supabase nem altera generated/config/strictness.
- `selectCurrentSimulado` prioriza apenas `deriveSimuladoStatus(...) === 'in_progress'`. Deadline vencido/invalido nao ganha prioridade; treino publicado com deadline futuro ganha. A regra legada de tentativa dentro da janela sem deadline permanece no helper canonico, sem alteracao.
- Arquivado entra no seletor somente com tentativa finalizada. Nao retoma tentativa inacabada, independentemente de modalidade ou status de tentativa. Draft/test continuam excluidos do seletor.
- `selectHomeSimulado` devolve o status recalculado ao consumidor scoped: sem proxima prova, um status `in_progress` antigo nao produz CTA de retomada. O caminho legado, sem contexto de edicao, nao e recalculado por essa mudanca.
- `SimuladoCard` mostra botao desabilitado "Simulado arquivado" para arquivado inacabado. Arquivado finalizado com resultado liberado continua com link de resultado. Demais estados do card preservados.

TDD: sete falhas reproduzidas antes da implementacao (seletor, card e hero); depois, os testes focados passaram. A regressao final executou os mesmos 14 arquivos anteriores mais `src/lib/editions.test.ts` e `src/components/SimuladoCard.test.tsx`: **131 testes aprovados em 16 arquivos**, 79,35 s. Os 93 anteriores permanecem na rodada.

Typecheck executado uma unica vez nesta revisao, com limite de dez minutos:

```text
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.app.json
```

Resultado: **sucesso, zero diagnosticos**. Lint dos arquivos de implementacao e testes tocados nesta revisao: zero erros, 36 avisos. `git diff --check` sem erros de whitespace (avisos LF/CRLF). Nenhuma nova alteracao de lifecycle, codegen ou campos de usuario nesta revisao.

### Integracao de landing pendente

`src/pages/SimuladoLandingPage.tsx` nao existe neste checkout. Conforme a autorizacao condicional, nenhum arquivo substituto foi alterado. A rota real esta em `src/App.tsx:185-186`, usando `SimuladoDetailPage` para `/simulados/:id/start` e `/simulados/:id`.

Pontos exatos para o responsavel pela integracao do guard `simulado.dbStatus === 'archived' && !simulado.userState?.finished`:

- `src/pages/SimuladoDetailPage.tsx:195`: `isAccessible` ainda depende somente do status temporal.
- `src/pages/SimuladoDetailPage.tsx:605-634`: bloco de retomada e navegacao para prova/gabarito, inclusive `offline_pending`.
- `src/pages/SimuladoDetailPage.tsx:686`: fallback de tentativa iniciada.
- `src/pages/SimuladoDetailPage.tsx:700-705`: montagem do dialogo offline.

Esse guard deve impedir iniciar/retomar em arquivado inacabado e apresentar estado neutro, preservando o bloco de resultados finalizados em `:655-681`. **O acesso direto a essa pagina ainda precisa dessa integracao**; o guard do card nao substitui o guard de rota. Nenhuma RPC de criacao foi chamada nesta validacao.
