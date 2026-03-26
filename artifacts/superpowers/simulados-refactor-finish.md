# Finish ? Refatora??o da Tela de Simulados

## Implementado
- Arquivo alterado: `src/pages/SimuladoDetailPage.tsx`.
- Removido o grid de metadados de configura??o (quest?es, dura??o e m?tricas redundantes).
- Mantido o card "Janela de Execu??o" como bloco principal temporal.
- Removida a se??o "?reas abordadas".
- Padronizados os bot?es "Ver Corre??o", "Ver Resultado", "Ver Desempenho" e "Ver Ranking" com mesma base visual neutra.
- Adicionado estado ativo din?mico por rota via `useLocation()`.

## Verifica??o executada
- `npx eslint src/pages/SimuladoDetailPage.tsx` ?
- `ReadLints` no arquivo alterado ? sem erros.

## Observa??o
- `npm run lint -- src/pages/SimuladoDetailPage.tsx` executa lint global no projeto e falha por erros preexistentes fora do escopo.

## Pr?ximos passos sugeridos
- Validar rapidamente no navegador as 4 rotas para confirmar o estado ativo esperado.
