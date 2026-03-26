### Goal
Implementar a limpeza da tela de simulados conforme prompt: remover informa??es redundantes, excluir "?reas abordadas" e padronizar bot?es de navega??o com estado ativo din?mico.

### Assumptions
- O foco da solicita??o ? a tela de detalhe do simulado (`SimuladoDetailPage`).
- A padroniza??o dos 4 bot?es refere-se ao conjunto exibido quando `hasResults` ? verdadeiro.
- "Janela de execu??o" deve permanecer e pode continuar exibindo abertura/encerramento/libera??o de resultado no card dedicado.

### Plan
1. Mapear e definir os trechos-alvo no detalhe do simulado
   - Files: `src/pages/SimuladoDetailPage.tsx`
   - Change: identificar blocos de metadados redundantes, se??o de ?reas e classes atuais dos 4 bot?es.
   - Verify: inspe??o est?tica do arquivo para garantir que todo escopo pedido est? coberto.

2. Remover conte?do redundante e se??o de ?reas
   - Files: `src/pages/SimuladoDetailPage.tsx`
   - Change:
     - remover grid de apoio com Quest?es/Dura??o/etc.;
     - remover bloco `?reas abordadas`.
   - Verify: build/typecheck sem erros e aus?ncia desses blocos no TSX.

3. Padronizar bot?es e ativa??o por rota
   - Files: `src/pages/SimuladoDetailPage.tsx`
   - Change:
     - criar classe base ?nica para os 4 bot?es;
     - aplicar variante ativa apenas ao bot?o da p?gina atual com base em `useLocation()`.
   - Verify: checagem visual/manual (rotas de corre??o, resultado, desempenho, ranking) confirmando 1 ativo por vez.

4. Valida??o t?cnica local
   - Files: `src/pages/SimuladoDetailPage.tsx`
   - Change: ajustes finos para lint/types, se necess?rio.
   - Verify: rodar `npm run lint` (ou equivalente do projeto) e corrigir qualquer erro introduzido.

### Risks & mitigations
- Risco: estado ativo incorreto em rotas com par?metros.
  - Mitiga??o: compara??o expl?cita via `location.pathname` e rota exata esperada para cada bot?o.
- Risco: perda de contexto ?til para usu?rio.
  - Mitiga??o: manter card de "Janela de Execu??o" com informa??es temporais.
- Risco: regress?o visual.
  - Mitiga??o: manter tokens/classes do design system existente e validar manualmente.

### Rollback plan
- Reverter apenas `src/pages/SimuladoDetailPage.tsx` para estado anterior caso haja regress?o de navega??o/UX.
- Reexecutar lint/build para confirmar restabelecimento.
