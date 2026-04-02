### Goal
Implementar o refinamento de UX/UI do onboarding com foco em compacta??o vertical, scroll interno de conte?do selecion?vel e melhoria da etapa de confirma??o.

### Assumptions
- A "logo branca" ser? aplicada via `BrandIcon` em vers?o limpa sem textos auxiliares no topo.
- "Bot?o sempre vis?vel" significa manter o footer de navega??o fixo na ?rea do painel, com conte?do rol?vel acima.
- Os ajustes visuais devem preservar comportamento de valida??o atual.

### Plan
1. Simplificar cabe?alho superior e substituir por logo branca
   - Files: `src/pages/OnboardingPage.tsx`
   - Change:
     - Remover bloco com ?cone gradiente + textos SANARFLIX/PRO: ENAMED.
     - Inserir bloco compacto com logo branca centralizada.
   - Verify:
     - Revis?o de JSX e classes do topo.
     - `ReadLints` no arquivo.

2. Compactar layout vertical do painel para manter navega??o sempre vis?vel
   - Files: `src/pages/OnboardingPage.tsx`
   - Change:
     - Ajustar espa?amentos e alturas dos wrappers principais (`min-h`, `pt`, `pb`, `flex-1/min-h-0`).
     - Garantir que ?rea de conte?do role internamente sem empurrar footer de navega??o.
   - Verify:
     - Conferir classes de overflow/min-height no diff.
     - `ReadLints`.

3. Adicionar/fortalecer scroll interno na etapa de especialidade
   - Files: `src/components/onboarding/SpecialtyStep.tsx`
   - Change:
     - Definir container da lista com `overflow-y-auto` e altura el?stica dentro do step.
     - Preservar campo de busca como ?rea fixa (shrink-0) com lista rol?vel abaixo.
   - Verify:
     - Conferir estrutura de containers `flex-1 min-h-0`.
     - `ReadLints`.

4. Repetir padr?o de scroll interno na etapa de institui??es
   - Files: `src/components/onboarding/InstitutionStep.tsx`
   - Change:
     - Manter controles principais fixos e deixar grupos/listas de institui??es com rolagem interna dedicada.
   - Verify:
     - Conferir overflows por se??o e aus?ncia de scroll duplo problem?tico.
     - `ReadLints`.

5. Redesenhar etapa de confirma??o para melhor uso de espa?o
   - Files: `src/components/onboarding/ConfirmationStep.tsx`
   - Change:
     - Melhorar hierarquia visual dos cards (t?tulo, valor, destaque, distribui??o).
     - Usar grid/layout mais equilibrado no desktop e empilhamento limpo no mobile.
   - Verify:
     - Revis?o estrutural de classes e contraste.
     - `ReadLints`.

6. Remover ?cone do bot?o "Come?ar"
   - Files: `src/pages/OnboardingPage.tsx`
   - Change:
     - Remover `Sparkles` do bot?o final mantendo texto e estado de loading.
   - Verify:
     - Busca local no arquivo.
     - `ReadLints`.

### Risks & mitigations
- Scroll em cadeia: mitigar com `min-h-0` expl?cito em todos os n?s flex relevantes.
- Densidade excessiva: reduzir paddings com parcim?nia e manter leitura em mobile.
- Regress?o de intera??o: manter `focus-visible` e ?reas clic?veis.

### Rollback plan
- Reverter seletivamente os 4 arquivos alterados se houver regress?o.
- Em caso de problema, manter apenas remo??o do ?cone/badge e desfazer compacta??o estrutural.
