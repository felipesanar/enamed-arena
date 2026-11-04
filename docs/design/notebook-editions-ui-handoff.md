# Handoff: Caderno Por Edicao

## Entrega

F2-7 adiciona seletor de edicao, lista paginada no servidor e continuidade de escopo entre Caderno, revisao, insights, Treino e exportacao. O layout e os tokens existentes foram preservados. O prototipo de referencia esta em `notebook-editions-prototype.html`; o contrato tecnico esta em `../notebook-editions-2027.md`.

## Comportamentos Para Revisao

- Flag desligada: caminho legado, inclusive quando a URL contem `edition`.
- Todas as edicoes: total SQL cumulativo, incluindo manuais; exportacao e filas completas, nao apenas a pagina visivel.
- Edicao selecionada: lista, contagens, insights e links usam o mesmo escopo; troca reinicia pagina/selecao/area de Treino.
- Edicao invalida ou erro de catalogo: estado neutro de erro, sem apresentar dados globais como se fossem da edicao.
- Busca: debounce 300 ms sem roubar foco; paginacao conserva navegacao acessivel.
- Rotulos extensos, inclusive sem espacos: quebra de linha integral no selo e nos totais, sem truncamento nem overflow horizontal.
- Cards: Link Router com `entry` e `edition`; preservacao dos campos SRS e do estado Travada existente.
- Insights cumulativos: explicacao para selecionar edicao no lugar de grafico/ROI bruto; causas e confianca permanecem.
- Treino: launcher mantem quantidade, modo cronometrado e design; callback de analytics nao causa segunda navegacao.
- Exportacao: conjunto filtrado completo, bloqueio de disparo duplicado e descarte de resposta antiga.

## Evidencias Reproduziveis

```powershell
node node_modules/vitest/vitest.mjs run src/services/notebookApi.test.ts src/pages/CadernoPage.editions.test.tsx src/pages/CadernoInsightsPage.editions.test.tsx src/hooks/useNotebookDueCount.test.tsx src/hooks/useActiveRecallSession.editions.test.tsx src/lib/notebookEditionLinks.test.ts src/components/caderno/CadernoExportMenu.test.tsx src/pages/CadernoTreinoPage.editions.test.tsx src/components/caderno/treino/TreinoLauncher.test.tsx src/lib/cadernoExport.test.ts
node .superpowers/notebookQA/check-types.mjs
node --test docs/design/notebook-editions-prototype.test.mjs
node .superpowers/notebookQA/verify-react-final.mjs
```

A reexecucao final em 2026-11-04 passou 60 testes em 10 arquivos (28,80 s). O fechamento adicionou um teste de invalidacao apos desbloqueio de aula, garantindo os seis prefixos de cache. A dependencia do callback foi explicitada sem alterar a regra de desbloqueio.

O QA React anterior passou em 375, 768 e 1440 px, nos temas claro e escuro, sem pageerrors ou requisicoes externas. Verificou rotulo/selo completos, ausencia de overflow, foco na busca apos debounce e link com entry/edition. Capturas locais: `.superpowers/notebookQA/react-final-captures/`. Foram inspecionadas visualmente as capturas 375 claro, 768 escuro e 1440 claro. O harness usa mocks e nao comprova autorizacao real do backend.

O checker final retornou zero diagnosticos nos 27 arquivos selecionados. O prototipo passou quatro testes na reexecucao final. `git diff --check` terminou sem erros de whitespace, somente avisos de conversao LF/CRLF do Windows. As evidencias locais em `.superpowers` sao auxiliares e podem nao ser versionadas; os comandos e limites ficam registrados aqui.

## Integracao Pendente

- Integrar o endpoint de padroes do job `pattern-server-6e7c` e conferir request/response de edicao com autenticacao real.
- Rodar build, typecheck e regressao global pelo orquestrador, fora do escopo deste job.
- Validar o fluxo HTTP/Supabase integrado, inclusive troca de conta e gates PRO/release; os testes frontend usam mocks e a fixture SQL usa clone local.

Nao houve mudanca em Home, ranking, admin, sidebars, App, RetaFinal, caderno presencial, simuladosApi, endpoints de IA ou tipos gerados. Nao houve instalacao, leitura de `.env`, deploy, commit ou push neste fechamento.
