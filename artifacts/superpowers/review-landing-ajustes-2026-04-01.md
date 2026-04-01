# Review Pass ? Landing ajustes (2026-04-01)

## Blocker
- Nenhum identificado nas altera??es desta tarefa.

## Major
- Nenhum identificado nas altera??es desta tarefa.

## Minor
- `src/components/landing/LandingHero.tsx`: o chip de ranking foi deslocado para a direita com offsets negativos; em telas desktop muito estreitas (pr?ximo ao breakpoint `lg`) pode ficar no limite visual da coluna. Mitiga??o aplicada: offsets responsivos graduais (`-right-2`, `xl:-right-5`, `2xl:-right-7`) e sem overflow expl?cito no container do hero.

## Nit
- `src/lib/landingMockData.ts`: `LIVE_FEEDBACK_LINES` permanece exportado mesmo n?o sendo mais consumido na se??o de diferenciais ap?s ajuste da copy. N?o impacta comportamento, mas pode ser limpo em refactor futuro.

## Conclus?o
- As mudan?as solicitadas foram implementadas com baixo risco funcional; o principal ponto de aten??o ? apenas calibragem visual fina do chip em viewport desktop espec?fico.
