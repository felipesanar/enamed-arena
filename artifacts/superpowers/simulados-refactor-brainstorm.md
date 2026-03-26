### Goal
- Refatorar a tela de simulados para reduzir ru?do visual em simulados j? realizados e padronizar a navega??o entre corre??o, resultado, desempenho e ranking.
- Garantir que apenas informa??es ?teis p?s-prova permane?am vis?veis, com comportamento de estado ativo coerente com a rota atual.

### Constraints
- Manter arquitetura React/TypeScript/Tailwind existente, sem regress?o de navega??o por rota.
- N?o alterar regras de acesso/neg?cio (apenas apresenta??o e UX).
- Preservar acessibilidade b?sica (foco vis?vel e contraste dos bot?es).
- Escopo principal em componentes da experi?ncia de detalhe do simulado.

### Known context
- `src/pages/SimuladoDetailPage.tsx` cont?m:
  - bloco de metadados com Quest?es/Dura??o/Janela/Resultado;
  - se??o `?reas abordadas` baseada em `simulado.themeTags`;
  - 4 bot?es (`Ver Corre??o`, `Ver Resultado`, `Ver Desempenho`, `Ver Ranking`) com estilos inconsistentes (Corre??o como prim?rio fixo).
- `src/components/SimuladoCard.tsx` tamb?m exibe metadados (quest?es e dura??o) no card de listagem.
- Rotas j? existentes para p?ginas alvo: `/simulados/:id/correcao`, `/simulados/:id/resultado`, `/desempenho`, `/ranking`.

### Risks
- Regress?o visual em estados sem resultado (`hasResults` false).
- Estilo ativo incorreto se detec??o de rota n?o considerar caminhos din?micos.
- Remo??o excessiva de informa??o em cards/lista al?m do desejado.

### Options (2?4)
- **Op??o 1 ? Ajuste pontual s? no `SimuladoDetailPage`**
  - Pros: menor risco e entrega r?pida; atende diretamente os 4 bot?es e se??o de ?reas.
  - Cons: poss?vel inconsist?ncia residual em outras telas/cards.
  - Complexidade/Risco: baixa.

- **Op??o 2 ? Ajuste no detalhe + normaliza??o de bot?es reutiliz?vel**
  - Pros: cria padr?o claro de estilo ativo/neutro para navega??o relacionada.
  - Cons: mais mudan?as estruturais e maior superf?cie de teste.
  - Complexidade/Risco: m?dia.

- **Op??o 3 ? Ajuste amplo em detalhe + cards de listagem**
  - Pros: experi?ncia mais consistente em toda jornada de simulados.
  - Cons: risco de fugir do pedido imediato e aumentar tempo.
  - Complexidade/Risco: m?dia/alta.

### Recommendation
- Seguir **Op??o 1** agora: foco em `SimuladoDetailPage.tsx`, removendo metadados/?reas e padronizando os 4 bot?es com estado ativo din?mico por rota.
- Se voc? quiser, expandimos depois para os cards da listagem como segunda etapa controlada.

### Acceptance criteria
- Metadados de configura??o (quest?es/dura??o etc.) removidos da tela de detalhe p?s-realiza??o.
- Mantida apenas a informa??o de janela de execu??o no bloco principal correspondente.
- Se??o `?reas abordadas` removida do detalhe.
- Bot?es `Ver Corre??o`, `Ver Resultado`, `Ver Desempenho`, `Ver Ranking` com base neutra id?ntica.
- Apenas o bot?o da rota atual fica com estilo ativo; os demais ficam neutros.
- Navega??o continua funcionando para as quatro rotas.
