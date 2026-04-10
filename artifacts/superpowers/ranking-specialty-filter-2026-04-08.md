# Ranking: filtro por especialidade (2026-04-08)

## Problema relatado
Ao filtrar o ranking pela mesma especialidade, a percepção era que a lista também restringia pela instituição (ex.: UFBA), ocultando outros candidatos da mesma especialidade em outras instituições.

## Causas identificadas
1. **UI enganosa:** O botão de especialidade ficava visualmente ativo mesmo no modo `same_institution` (`comparisonFilter === 'same_institution'`), sugerindo filtro combinado.
2. **Rótulo "Restringir à:"** — implicava restrição adicional (AND) ao nome da instituição, quando na verdade o botão **alterna** o modo de comparação (especialidade **ou** instituição).
3. **Comparação estrita** `===` entre strings de especialidade/instituição podia excluir candidatos com diferenças triviais (espaços, maiúsculas).

## Correções
- `rankingApi.applyRankingFilters`: normalização `trim` + `toLowerCase` para especialidade e instituição; modo `same_specialty` continua **sem** critério de instituição.
- `RankingView`: removido highlight duplo do botão de especialidade; texto "Trocar modo de comparação"; tooltips explicando alternância; rodapé "(todas as instituições)" no modo especialidade.
- Testes em `rankingApi.test.ts` para normalização e ausência de filtro cruzado por instituição no modo especialidade.

## Atualização — filtro combinado especialidade + instituição (mesmo dia)

- Estado persistido: `ranking:comparisonFlags` `{ bySpecialty, byInstitution }` (migração a partir de `ranking:comparison` legado).
- Dois toggles independentes: especialidade e “também 1ª instituição-alvo”; quando ambos ativos, cópia **“Filtrando por {especialidade} na {instituição}.”** e ambos os botões com estilo ativo.
- `applyRankingFilters` aplica especialidade e instituição em sequência (AND).

## Verificação
`npm run test -- --run src/services/rankingApi.test.ts`  
`npm run build`
