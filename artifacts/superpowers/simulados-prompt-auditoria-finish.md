# Finish ? Auditoria e conformidade do prompt

## Escopo consolidado
- `src/pages/SimuladoDetailPage.tsx`
- `src/components/SimuladoCard.tsx`
- `src/components/simulado/SimuladoResultNav.tsx` (novo)
- `src/pages/CorrecaoPage.tsx`
- `src/pages/ResultadoPage.tsx`
- `src/pages/DesempenhoPage.tsx`
- `src/pages/RankingPage.tsx`

## Verifica??o executada
- `npx eslint src/components/simulado/SimuladoResultNav.tsx src/pages/SimuladoDetailPage.tsx src/pages/CorrecaoPage.tsx src/pages/ResultadoPage.tsx src/pages/DesempenhoPage.tsx src/pages/RankingPage.tsx` ?
- `npx eslint src/components/SimuladoCard.tsx` ?
- `npm run build` ?

## Resultado
- Implementa??o alinhada ao prompt com remo??es de ru?do e padroniza??o de navega??o/estado ativo entre p?ginas.
