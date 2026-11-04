# Filtros de inteligencia: fase B React

## Status

Fase B integrada; a regressao de setters batched e a dependencia de lint do mock
Catalog identificadas no CI 41841235698 (7cddb70) foram corrigidas nesta retomada.
Apos o ultimo diff de codigo e testes: 99 testes aprovados em 10 arquivos de
periodo e contagens; lint dos tres arquivos de codigo tocados com exit 0,
sem erros e com um warning preexistente de Fast Refresh no Context.
Typecheck final permanece com o Codex.

A aprovacao visual anterior das capturas React 375px escuro/1440px claro e do
`results.json` permanece historica. Nao houve nova UI, QA visual ou polimento.
Os checkpoints anteriores nao comprovavam o estado posterior a inclusao do
teste batch; a cronologia corrigida esta registrada abaixo.

## Entrega

- `AdminReportFilters` integra uma faixa propria a `AdminTopbar`, preservando
  breadcrumb, tema e alertas. Os controles montam na rota de inteligencia com
  `editions_ui` e capacidade `intel.view`.
- Catalogo via `adminEditionsApi.list()`, com loading, erro, retry, vazio e
  selecao desconhecida explicitos. Uma edicao desconhecida nao vira uma consulta
  global silenciosamente; consultas ficam bloqueadas ate uma escolha valida.
- `AdminPeriodContext` separa filtros novos do periodo legado `7|30|90`.
  Persistencia defensiva em sessionStorage usa `admin-report:${userId}:v1`;
  identidade e catalogo nao sao reaproveitados entre contas.
- Intervalos custom usam datas pt-BR inclusivas em Brasilia, convertidas para
  `[inicio, fim)` com fim na meia-noite do dia seguinte, offset -03:00. Datas
  inexistentes e ordem invertida sao rejeitadas antes da aplicacao.
- Presets usam dias de calendario BRT com referencia estavel durante a selecao;
  restauracao reancora o preset ao dia atual. Custom permanece fixo.
- Os sete metodos e hooks contratados recebem scope opcional. `undefined`
  preserva os argumentos legados, inclusive chamadas sem segundo argumento;
  scope explicito com valores nulos envia os tres nulos.
- Query keys incluem usuario e scope normalizado, alem dos filtros locais.
  Cache de cinco minutos preservado; insights mantem dois minutos para conservar
  a atualizacao preexistente desse painel.
- Evolucao agrupa paineis por edicao, sem linhas entre edicoes nem media,
  melhor/pior ou queda global entre escalas distintas. Metadata ausente nao
  implica 2026. Percentuais de distribuicao nao representam uma escala comum
  de proficiencia.
- Engajamento permanece uma visao legada independente de 7/30/90 dias, sem
  promessa de suporte a edicao ou intervalo custom. Dashboard e detalhe de
  resultado nao receberam expansao de RPC.
- Flag desligada preserva controles e argumentos legados e nao busca catalogo.

## RPCs

Somente `admin_cohort_retention`, `admin_performance_by_area`,
`admin_performance_by_theme`, `admin_score_distribution`,
`admin_score_evolution`, `admin_segment_breakdown` e `admin_intel_insights`
recebem `p_edition_id`, `p_start_at` e `p_end_at`. Nenhuma alteracao SQL,
recomputacao de nota no cliente ou mudanca de tipos gerados foi realizada.
Os contratos continuam em `docs/contracts/admin-period-2027.md` e
`docs/admin-period-2027.md`.

## Verificacao Registrada

Checkpoint historico do implementador, executado as 10:12 antes da inclusao
do teste batch:

```powershell
node node_modules/vitest/vitest.mjs run src/admin/lib/adminPeriod.test.ts src/admin/contexts/AdminPeriodContext.test.tsx src/admin/services/adminApi.period.test.ts src/admin/hooks/useAdminInteligencia.test.tsx src/admin/components/AdminReportFilters.test.tsx src/admin/components/AdminTopbar.test.tsx src/admin/__tests__/AdminInteligencia.test.tsx src/admin/__tests__/AdminDashboard.test.tsx --maxWorkers=2
```

Resultado daquele checkpoint: 8 arquivos, 73 testes aprovados. O teste batch
foi adicionado as 10:17:02 e nao foi executado nessa bateria. Portanto 73/8 nao
era evidencia do estado final posterior a essa adicao.

```powershell
node node_modules/eslint/bin/eslint.js src/admin/lib/adminPeriod.ts src/types/admin-period.ts src/admin/contexts/AdminPeriodContext.tsx src/admin/components/AdminReportFilters.tsx src/admin/components/AdminTopbar.tsx src/admin/hooks/useAdminInteligencia.ts src/admin/pages/AdminInteligencia.tsx
git diff --check
node ".superpowers/admin-periodQA/react-qa.mjs"
```

Resultados registrados: lint sem erros, com um aviso
`react-refresh/only-export-components` no Context; diff sem erros de whitespace;
QA React exit 0. A revisao independente informou lint exit 0 e TypeScript
`tsconfig.app.json` exit 0 nos checkpoints descritos abaixo, sem comprovar o
teste batch posterior. O comando historico de lint acima nao incluiu os testes;
nao comprova a ausencia do erro de dependencia no mock Catalog.

QA React usa componentes reais, bundle local e Edge offline, com Auth e fontes
de dados mockados. Evidencias locais:

- `.superpowers/admin-periodQA/react/375-dark-selectors.png`.
- `.superpowers/admin-periodQA/react/1440-light-selectors.png`.
- `results.json` do QA, inspecionado pelo orquestrador.

O diretorio de QA continua ignorado pelo Git, sem alterar ignore nem forcar
inclusao. As 38 capturas da fase A foram preservadas e nao repetidas.

## Limites

Mocks nao comprovam Auth real, autorizacao de catalogo, visibilidade de drafts,
RLS, Supabase, PostgREST, execucao real das sete RPCs ou persistencia entre
usuarios reais. Esses pontos exigem integracao em ambiente autorizado.
Nao foi realizada auditoria WCAG completa, validacao com leitor de tela ou
matriz Safari/Firefox. Nao houve rede, instalacao de pacotes, acesso a `.env`,
alteracao em producao, commit ou publicacao nesta entrega.

Nesta correcao foram repetidos os testes direcionados completos de periodo e
contagens e o lint dos arquivos de codigo tocados, incluindo ambos os testes.
Nao houve suite global, typecheck global nem nova rodada de design.

## Checkpoints históricos do Codex

Executado neste worktree em04/11/2026:

- `node node_modules/vitest/vitest.mjs run src/admin/lib/adminPeriod.test.ts src/admin/contexts/AdminPeriodContext.test.tsx src/admin/services/adminApi.period.test.ts src/admin/hooks/useAdminInteligencia.test.tsx src/admin/components/AdminReportFilters.test.tsx src/admin/__tests__/AdminInteligencia.test.tsx src/admin/__tests__/AdminDashboard.test.tsx --maxWorkers=2`: exit0,72testes/7arquivos às10:09, antes do novo teste batch.
- `node node_modules/vitest/vitest.mjs run src/admin/components/AdminTopbar.test.tsx --maxWorkers=2`: exit0,1teste, executado isoladamente depois. A soma histórica73/8 não é uma rodada completa posterior à inclusão do teste batch; Context não foi repetido nesse checkpoint.
- `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.app.json`: exit0, incluindo o teste Topbar já gravado antes da execução.
- ESLint dos nove arquivos de implementação tocados: exit0,45warnings (principalmente no adminApi existente), nenhum erro.
- `git diff --check`: exit0.

O Codex inspecionou as duas capturas React reais com mocks em375/escuro e1440/claro e o results.json; aprovados para integração. Não há evidência de Supabase Auth/RLS/RPC E2E ou ação em produção. Integração e checks consolidados da branch permanecem com o orquestrador principal.

## Correção de evidência e regressão de batch

O CI41841235698 reproduziu um defeito real: dois setters de filtros no mesmo batch perdem a edição pelo uso de closure antiga. O teste foi adicionado ao arquivo em10:17:02, depois dos checkpoints72/7 e73/8 que foram citados acima; o teste Topbar isolado posterior não cobriu essa nova asserção. Portanto os checks anteriores não comprovam o estado final após essa adição. O Codex reproduziu1falha/3pass em Context sem alterar a asserção.

Ordem de retomada autorizada: `.superpowers/admin-periodQA/batched-filter-fix.md`.
Ambos os setters agora usam atualização funcional sobre o estado mais recente.
A persistência serializa o mesmo estado combinado retornado pela atualização,
sem segundo estado de filtros, setState recursivo ou efeito de escrita.
Falha de storage mantém os filtros em memória com aviso. Permanecem a validação
`rangeScope`, isolamento por identidade, período legado, catálogo e timer BRT.

O teste batch original foi preservado, incluindo sua asserção de edição e um
único `act`. Acrescentados JSON persistido, ordem inversa dos setters e estado
combinado com storage indisponível. No mock Catalog, `setReportCatalog` está
desestruturado e é a dependency do effect; handlers usam setter desestruturado.
Não houve `eslint-disable`, remoção de effect ou alteração de expectativas da tela.

RED executado nesta retomada após ampliar os testes, antes da implementação:

```powershell
node node_modules/vitest/vitest.mjs run src/admin/contexts/AdminPeriodContext.test.tsx --maxWorkers=2
```

Resultado: 3 falhas/2 aprovados em 5 testes. Confirmadas perdas em ambas as ordens
dos setters e com storage indisponível. Esse RED ampliado não substitui o registro
anterior do Codex de 1 falha/3 aprovados no arquivo antes da ampliação.

GREEN após o último diff de código e testes:

```powershell
node node_modules/vitest/vitest.mjs run src/admin/lib/adminPeriod.test.ts src/admin/contexts/AdminPeriodContext.test.tsx src/admin/services/adminApi.period.test.ts src/admin/hooks/useAdminInteligencia.test.tsx src/admin/components/AdminReportFilters.test.tsx src/admin/components/AdminTopbar.test.tsx src/admin/__tests__/AdminInteligencia.test.tsx src/admin/__tests__/AdminDashboard.test.tsx src/admin/services/adminApi.countsCompat.test.ts src/admin/services/adminApi.editions.test.ts --maxWorkers=2
node node_modules/eslint/bin/eslint.js src/admin/contexts/AdminPeriodContext.tsx src/admin/contexts/AdminPeriodContext.test.tsx src/admin/__tests__/AdminInteligencia.test.tsx
```

Resultados: 99 testes/10 arquivos aprovados, exit 0; ESLint exit 0, zero erros e
um warning `react-refresh/only-export-components` no Context. Não houve nova
alteração de código ou asserções após essas execuções. Este registro substitui
os checkpoints históricos como evidência dos testes do estado corrigido.

Escopo desta correção: Context, os dois testes e este documento. `adminApi` e o
patch de contagens preservado em206fc37 não foram alterados. Sem UI, SQL, rede,
pacotes, `.env`, produção, subagentes ou Git mutante. O typecheck final após esta
correção e a integração continuam sob responsabilidade do Codex.

## Verificação independente do snapshot corrigido — final

Após o OpenCode encerrar e após o último diff de código/testes, o Codex executou o conjunto completo de período+contagens acima: **99 testes em10 arquivos, exit0**. Também executou `tsc --noEmit -p tsconfig.app.json`: **exit0**, e ESLint dos9 arquivos de implementação e10 arquivos de teste do escopo: **exit0,45warnings, zero erros**, incluindo o mock Catalog anteriormente apontado pelo CI.

Os hashes SHA256 do Context e dos dois testes alterados foram capturados antes e comparados após as verificações: nenhum mudou durante os checks. O teste batch original e a ordem inversa estão verdes com o JSON persistido combinado; a asserção original não foi removida nem dividida. Este é o checkpoint liberado para integração; os números históricos anteriores permanecem apenas como histórico corrigido. Não houve nova alteração de código após este GREEN.
