# Finish ? Landing ajustes (2026-04-01)

## Escopo entregue
- Ajustes de copy e UI na landing page conforme pedido do usu?rio.
- Refor?o visual do chip `# ranking` no hero.
- Troca do bloco de an?lise para "Vaga desejada" com institui??o alvo.
- Atualiza??o de proposta de valor para op??o online/offline.
- Substitui??o do painel de timeline por hist?rico/pr?ximos sem exibir resultados.

## Arquivos alterados
- `src/components/landing/LandingHero.tsx`
- `src/components/landing/LandingHowItWorks.tsx`
- `src/components/landing/LandingValueProps.tsx`
- `src/lib/landingMockData.ts`

## Verifica??o executada
- Comando: `npm run lint`
- Resultado: falhou por erros preexistentes em m?ltiplos arquivos fora do escopo da tarefa (UI/shared/hooks/pages/services).
- Comando complementar: `ReadLints` focado nos arquivos alterados.
- Resultado: sem erros de lint nos arquivos modificados nesta tarefa.

## Observa??es
- N?o houve mudan?as de backend, dados ou regras de neg?cio.
- N?o foi feito commit.
