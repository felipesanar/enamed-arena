# HomeHeroSection Adaptativa - Review e Finalizacao

## Review pass (severidade)
- Blocker: nenhum.
- Major: nenhum.
- Minor: nenhum.
- Nit: `HomeHeroSection` quebra headline por virgula e pode inserir espaco extra na acessibilidade (apenas cosmetico/testes ja cobrem com regex tolerante).

## Verificacao executada
- `npm run test -- home-hero-state HomeHeroSection` -> PASS (2 arquivos, 7 testes).
- `npm run lint` -> FAIL por problemas preexistentes e fora do escopo desta entrega (42 erros / 19 warnings em varios modulos nao alterados).
- `ReadLints` nos arquivos alterados -> sem erros.

## Escopo implementado
- Mapper de estado adaptativo da hero com prioridade de cenarios e CTA contextual.
- Integracao do mapper na home premium.
- Atualizacao visual/textual da hero para tom quiet premium com variacao discreta por estado.
- Testes unitarios do mapper e teste de render da hero.

## Risco residual
- Cenario de onboarding na hero permanece como fallback robusto no mapper, embora o fluxo atual de `ProtectedRoute` normalmente redirecione para `/onboarding` antes da home.
