### Goal
Refatorar a home premium para uma experi?ncia compacta e orientada ? a??o, removendo se??es redundantes e deixando o essencial acima da dobra.

### Assumptions
- A home alvo ? `HomePagePremium`.
- Podemos manter copy/data est?ticos para ?pr?ximo simulado? nesta itera??o, caso n?o exista fonte din?mica de data no hook atual.
- ?CTA prim?rio? refere-se ao estilo `variant="primary"` de `PremiumLink`.

### Plan
1. Reestruturar composi??o da home
   - Files: `src/components/premium/home/HomePagePremium.tsx`
   - Change:
     - Remover renderiza??o de `QuickActionsSection` e `ResumeSection`.
     - Remover se??o `InsightsSection` standalone.
     - Ajustar ordem final para: hero compacto -> pr?ximo simulado -> desempenho (com intelig?ncia integrada).
     - Reduzir espa?amentos verticais globais (`SECTION_SPACING`, `space-y-*`).
   - Verify: `rg "QuickActionsSection|ResumeSection|InsightsSection" src/components/premium/home/HomePagePremium.tsx`

2. Compactar hero e limpar ru?do visual
   - Files: `src/components/premium/home/HomeHeroSection.tsx`
   - Change:
     - Remover `MetricPill` badges e bloco textual excessivo.
     - Resumir status do aluno em 1 linha (n?vel + simulados feitos).
     - Reduzir paddings/fonte/gaps do hero para vers?o compacta.
     - Limitar CTAs do hero a at? 1 prim?rio + 1 secund?rio (se necess?rio).
   - Verify: inspe??o do JSX e contagem de `variant="primary"` na home.

3. Transformar card de pr?ximo simulado
   - Files: `src/components/premium/home/UpcomingSimulationCard.tsx`
   - Change:
     - Substituir mensagem negativa por t?tulo ?Pr?ximo simulado dispon?vel?.
     - Exibir data orientativa e texto positivo com progresso do aluno.
     - Manter 1 CTA principal claro (ex.: ?Ver cronograma?).
     - Compactar dimens?es do card.
   - Verify: `rg "Pr?ximo simulado dispon?vel|Ver cronograma" src/components/premium/home/UpcomingSimulationCard.tsx`

4. Integrar intelig?ncia ao desempenho
   - Files: `src/components/premium/home/KpiGrid.tsx`
   - Change:
     - Incorporar um mini-bloco de insights abaixo/ao lado das m?tricas no pr?prio `KpiGrid`.
     - Ajustar t?tulo/eyebrow para ?Desempenho? com hierarquia mais limpa.
     - Reduzir altura e densidade dos cards para caber acima da dobra.
   - Verify: `rg "Intelig?ncia|insight|Leituras" src/components/premium/home/KpiGrid.tsx`

5. Verifica??o final e revis?o de qualidade
   - Files: arquivos alterados no passo 1?4
   - Change:
     - Revisar acessibilidade b?sica e consist?ncia visual.
     - Rodar lint/check no escopo alterado e corrigir erros introduzidos.
   - Verify:
     - `npm run lint`
     - (Opcional) `npm run build`

### Risks & mitigations
- Regress?o de responsividade: validar classes em `sm/md/lg` e reduzir grids agressivos.
- Perda de clareza por compacta??o extrema: preservar t?tulos objetivos e 1 a??o clara por bloco.
- CTAs excessivos: validar contagem total de variantes prim?rias ap?s refactor.

### Rollback plan
- Reverter apenas os arquivos da home alterados para o commit anterior em caso de regress?o visual/funcional.
- Se necess?rio, reintroduzir temporariamente `InsightsSection` como fallback sem `QuickActions`/`Resume` at? consolidar integra??o completa.
