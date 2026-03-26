# Review pass ? Refatora??o tela de simulados

## Blocker
- Nenhum.

## Major
- Nenhum.

## Minor
- Nenhum.

## Nit
- O comando `npm run lint -- src/pages/SimuladoDetailPage.tsx` no projeto atual executa lint global (`eslint .`) e retorna erros preexistentes fora do escopo desta mudan?a; para validar este ajuste isoladamente, usar `npx eslint src/pages/SimuladoDetailPage.tsx`.

## Escopo revisado
- `src/pages/SimuladoDetailPage.tsx`

## Resultado
- Mudan?as atendem ao prompt: remo??o de metadados redundantes, remo??o de "?reas abordadas" e padroniza??o de bot?es com estado ativo din?mico por rota.
