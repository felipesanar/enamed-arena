### Goal
- Melhorar a experi?ncia visual e de usabilidade do onboarding: remover o cabe?alho textual antigo, usar logo branca, manter CTA sempre vis?vel com ?reas de conte?do rol?veis internas e refinar a etapa de confirma??o com melhor hierarquia e ocupa??o de espa?o.

### Constraints
- Preservar fluxo em 3 etapas e regras de valida??o existentes.
- Manter identidade visual dark/wine do produto.
- Garantir responsividade desktop/mobile.
- Evitar mudan?as de l?gica de neg?cio (saveOnboarding, bloqueio de edi??o, valida??es).

### Known context
- `src/pages/OnboardingPage.tsx` cont?m topo com ?cone + textos SANARFLIX/PRO: ENAMED, layout principal e bot?es de navega??o (inclui ?cone Sparkles no bot?o Come?ar).
- `src/components/onboarding/SpecialtyStep.tsx` possui lista de especialidades sem scrollbar interno dedicado e pode empurrar o layout vertical.
- `src/components/onboarding/InstitutionStep.tsx` segue padr?o semelhante na sele??o de institui??es.
- `src/components/onboarding/ConfirmationStep.tsx` usa cards compactos e com pouco aproveitamento visual.

### Risks
- Scroll duplo/confuso se o overflow for aplicado em cont?iner errado.
- Bot?o de navega??o sumir em alturas pequenas se a ?rea central n?o for corretamente limitada.
- Regress?o de acessibilidade (foco vis?vel e intera??o por teclado).
- Quebra visual mobile ao compactar demais header/painel.

### Options (2?4)
- Op??o 1: ajustes m?nimos de copy e remo??o de ?cones, sem mexer no layout estrutural.
  - Pros: baixo risco.
  - Cons: n?o resolve problema de altura/scroll e cards feios.
  - Complexidade / risco: baixa.
- Op??o 2: refino estrutural moderado do layout (header, altura ?til, scroll interno por etapa, confirma??o redesenhada).
  - Pros: atende todos os pontos com mudan?a controlada.
  - Cons: exige calibrar v?rios containers de overflow.
  - Complexidade / risco: m?dia.
- Op??o 3: reescrever onboarding completo com novos componentes.
  - Pros: liberdade total.
  - Cons: alto risco e escopo acima do pedido.
  - Complexidade / risco: alta.

### Recommendation
- Seguir Op??o 2, mantendo arquitetura existente e aplicando melhorias pontuais de UX/UI com foco em legibilidade, fluxo e responsividade.

### Acceptance criteria
- Remover os 3 elementos do topo (?cone gradiente + SANARFLIX + PRO: ENAMED) e substituir por logo branca.
- ?rea principal compactada para caber na tela, com bot?o de continuar/come?ar sempre vis?vel.
- `SpecialtyStep` com scroll interno funcional para lista de especialidades.
- `InstitutionStep` com scroll interno funcional para lista/grupos de institui??es.
- `ConfirmationStep` com cards redesenhados e melhor uso do espa?o.
- Bot?o `Come?ar` sem ?cone Sparkles.
