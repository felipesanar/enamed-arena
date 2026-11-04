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
- Na UI nova, areas vem de `get_area_score_history(p_user_id, p_edition_id)`, restritas ao attempt escolhido pelo backend e associado ao mesmo ID pela RPC comportamental scoped. Filtrar apenas simulado nao remove treino de outra modalidade do mesmo simulado. A flag desligada conserva `get_user_area_scores_by_simulado(p_user_id)` sem argumentos novos.
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

## Revisao final: areas e acesso direto

Esta revisao parte da implementacao anterior integrada pelo parent em `a6c3206` e altera apenas os dois bugs abaixo. Nao reexecuta a suite global nem o typecheck global das rodadas anteriores.

### Areas sem treino

- `getAreaScoreHistory(userId, editionId?)` ganha somente o argumento opcional de edicao. Sem esse argumento, os parametros legados e o JSON original permanecem intactos para Caderno/ROI.
- A nova UI consulta esse getter e a RPC comportamental com edicao em `Promise.all`. Alvo nulo, vazio ou somente espacos desabilita as consultas, sem fallback global.
- O wire continua `{ by_area, global }`. No comparativo, pontos de `by_area` sao associados por `attempt_id` ao `simulado_id` retornado no comportamento. Somente IDs da edicao, elegiveis e com correspondencia univoca sao usados. Nao ha escolha de modalidade/desempate ou mistura de attempts no cliente.
- Normalizacao usa os valores reais `questions_total`, `questions_correct` e `score * 100`. Score deve ser numerico finito entre zero e um; contagens inteiras validas, total positivo, corretas entre zero e total; data de conclusao valida. Pontos malformados, IDs desconhecidos/fora do escopo e mapeamentos ambiguos sao descartados. Areas ausentes nao viram zero; score zero valido e preservado.
- A fixture com treino 100%, outra modalidade e attempt elegivel 20% devolve apenas CM=20 e contagens 6/30, nunca agregado 60/100. Testes tambem cobrem legado, alvo pendente, erro/refetch e preservacao do JSON do servico. O teste do servico esta em `useComparativeData.test.tsx`, usando o modulo real; `simuladosApi.test.ts` nao foi alterado.

### Arquivado no detalhe

A pendencia anterior de landing foi resolvida no caminho real autorizado nesta revisao: `src/pages/SimuladoDetailPage.tsx`. Depois de todos os hooks e dos estados loading/erro, o guard `simulado.dbStatus === 'archived' && !simulado.userState?.finished` retorna "Prova arquivada" com acesso ao historico.

O retorno ocorre antes de qualquer CTA ou montagem de `OfflineModeSimpleDialog`, bloqueando inicio e retomada online/offline/`offline_pending`, inclusive tentativa expirada. Tentativa finalizada nao entra no guard: bloco de resultado, navegacao de correcao e leituras existentes permanecem intactos. Prova publicada continua com inicio/retomada normais. Nenhuma API ou arquitetura offline foi alterada; nenhum hook foi movido para depois do retorno.

### Validacao desta revisao

TDD reproduziu **11 falhas antes da implementacao**. Resultado final: **50 testes aprovados em tres arquivos**, 13,67 s:

```text
node node_modules/vitest/vitest.mjs run src/hooks/useComparativeData.test.tsx src/services/simuladosApi.test.ts src/pages/SimuladoDetailPage.test.tsx --maxWorkers=2
```

Checagem TypeScript restrita via compiler API: cinco roots da tarefa (hook, teste, detalhe, teste, servico), mais `src/test/setup.ts` e `src/vite-env.d.ts` existentes para as declaracoes de ambiente; mesmas opcoes do projeto, sem alterar configuracao ou gerar arquivos. **Zero diagnosticos**. A primeira tentativa de subset omitiu essas declaracoes e apontou apenas tipos ambientais de Vite/jest-dom; a segunda incluiu os arquivos existentes e passou, sem supressoes ou relaxamento de tipos.

Lint dos cinco arquivos de codigo/testes: **zero erros e 31 avisos**, todos no servico existente fora do metodo modificado. `git diff --check` sem erros de whitespace, apenas avisos LF/CRLF.

Sem SQL novo, alteracoes de tipos gerados, pacotes, rede, `.env`, subagentes, producao ou Git mutante. Nenhuma alteracao de engine, clock, lifecycle, persistencia, hooks/dialogos offline ou outros arquivos fora do escopo. Parent permanece responsavel por validacoes globais, build e medicao de bundle.
