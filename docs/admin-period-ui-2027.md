# Filtros de inteligencia: fase B React

## Status

Implementacao funcional e QA direcionado concluidos. Revisao independente do
Codex incorporada: 72 testes em 7 arquivos, mais a verificacao de Topbar,
aprovados; TypeScript com `tsconfig.app.json` e lint com exit 0. O orquestrador
inspecionou as capturas React de 375px escuro e 1440px claro e o `results.json`,
aprovando controles, foco, contraste e series, sem bloqueador funcional.

Por orientacao final do orquestrador, o encerramento altera somente esta
documentacao e o handoff. Nao foram repetidos checks, ampliada a investigacao
ou feita nova rodada de polimento.

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

Ultima bateria direcionada executada pelo implementador antes do encerramento:

```powershell
node node_modules/vitest/vitest.mjs run src/admin/lib/adminPeriod.test.ts src/admin/contexts/AdminPeriodContext.test.tsx src/admin/services/adminApi.period.test.ts src/admin/hooks/useAdminInteligencia.test.tsx src/admin/components/AdminReportFilters.test.tsx src/admin/components/AdminTopbar.test.tsx src/admin/__tests__/AdminInteligencia.test.tsx src/admin/__tests__/AdminDashboard.test.tsx --maxWorkers=2
```

Resultado registrado: 8 arquivos, 73 testes aprovados. Esse resultado corresponde
aquela execucao, nao a uma nova bateria no encerramento documental.

```powershell
node node_modules/eslint/bin/eslint.js src/admin/lib/adminPeriod.ts src/types/admin-period.ts src/admin/contexts/AdminPeriodContext.tsx src/admin/components/AdminReportFilters.tsx src/admin/components/AdminTopbar.tsx src/admin/hooks/useAdminInteligencia.ts src/admin/pages/AdminInteligencia.tsx
git diff --check
node ".superpowers/admin-periodQA/react-qa.mjs"
```

Resultados registrados: lint sem erros, com um aviso
`react-refresh/only-export-components` no Context; diff sem erros de whitespace;
QA React exit 0. A revisao independente posterior informou lint exit 0 e
TypeScript `tsconfig.app.json` exit 0. A linha exata dos comandos independentes
nao foi fornecida; nao se atribui sua execucao ao implementador.

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

O encerramento segue a aprovacao funcional do Codex, sem repetir testes ou
typecheck, sem suite global e sem nova rodada de design.

## Verificação independente final do Codex

Executado neste worktree em04/11/2026:

- `node node_modules/vitest/vitest.mjs run src/admin/lib/adminPeriod.test.ts src/admin/contexts/AdminPeriodContext.test.tsx src/admin/services/adminApi.period.test.ts src/admin/hooks/useAdminInteligencia.test.tsx src/admin/components/AdminReportFilters.test.tsx src/admin/__tests__/AdminInteligencia.test.tsx src/admin/__tests__/AdminDashboard.test.tsx --maxWorkers=2`: exit0,72testes/7arquivos.
- `node node_modules/vitest/vitest.mjs run src/admin/components/AdminTopbar.test.tsx --maxWorkers=2`: exit0,1teste. Total independente73/8.
- `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.app.json`: exit0, incluindo o teste Topbar já gravado antes da execução.
- ESLint dos nove arquivos de implementação tocados: exit0,45warnings (principalmente no adminApi existente), nenhum erro.
- `git diff --check`: exit0.

O Codex inspecionou as duas capturas React reais com mocks em375/escuro e1440/claro e o results.json; aprovados para integração. Não há evidência de Supabase Auth/RLS/RPC E2E ou ação em produção. Integração e checks consolidados da branch permanecem com o orquestrador principal.
