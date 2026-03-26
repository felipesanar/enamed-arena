### Mini brainstorm
- Objetivo: alinhar o card da listagem ao detalhe, reduzindo ru?do visual para foco na janela de execu??o.
- Restri??o: mudan?a pequena, 1 arquivo, sem alterar regras de CTA/status.
- Crit?rio de aceite: card n?o mostra mais quest?es/dura??o; mostra apenas janela de execu??o.

### Mini plano
1) Editar `src/components/SimuladoCard.tsx` para remover badges de quest?es e dura??o.
2) Exibir somente data de execu??o (faixa in?cio-fim) com ?cone de calend?rio.
3) Rodar `npx eslint src/components/SimuladoCard.tsx`.
