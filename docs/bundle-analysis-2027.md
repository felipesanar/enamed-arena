# Bundle: F3-7

## Status

**Medicao pendente do orquestrador.** Este job executou somente testes e lint do escopo, sem build global ou visualizer. Nao ha tamanhos, percentuais de reducao ou comparacao antes/depois medidos a reportar.

## Mudancas observaveis no codigo

- Os quatro hooks reutilizam React Query, dependencia ja usada pelo projeto; nenhuma dependencia foi instalada/adicionada.
- A Home deixa de carregar `useSimuladoDetail`, `useExamResult` e `computePerformanceBreakdown` diretamente para descobrir a pior area; usa `useComparativeData`.
- Essa troca altera o grafo de imports, mas nao prova reducao de bundle. Modulos compartilhados podem permanecer em outros caminhos/chunks.
- O cache reduz consultas repetidas dentro do staleTime, o que e um efeito de rede/runtime distinto de tamanho de bundle.

## Proxima verificacao

1. Usar o procedimento de build/visualizer existente do projeto no ambiente integrado, sem instalar dependencias apenas para este job.
2. Medir base e implementacao com as mesmas dependencias/configuracao e registrar tamanhos raw/gzip por chunk, imports principais e eventual impacto nas rotas Home/Ranking/Resultado/Comparativo.
3. Verificar se a entrada da Home ainda inclui modulos exclusivos do motor de prova e separar efeito de code splitting de efeito de cache.
4. Executar build e typecheck globais no orquestrador; anexar o resultado real antes de considerar a parte de medicao de F3-7 encerrada.

Validacao funcional local registrada em `docs/home-queries-2027.md`: 93 testes aprovados em 14 arquivos; lint de implementacao sem erros, com 36 avisos. Isso nao substitui a medicao de bundle nem uma verificacao visual em desktop/mobile.

Revisao Codex posterior: regressao ampliada para **131 testes em 16 arquivos**, todos aprovados; um typecheck global `tsc --noEmit -p tsconfig.app.json` passou sem diagnosticos. Medicao de bundle, build e verificacao visual continuam pendentes. O guard da pagina real de detalhe tambem permanece como integracao explicitada no documento funcional, pois o caminho de landing autorizado nao existe neste checkout.
