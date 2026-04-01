### Goal
Redesenhar o card de desempenho do `Ultimo simulado` em `HomeHeroSection` com inspiracao direta na referencia visual enviada, incluindo mini barras comparativas com destaque para a ultima tentativa e estados completos para 0, 1 e 2+ simulados.

### Assumptions
- Usaremos dados ja disponiveis em `useUserPerformance().history` para montar as barras (ultimas tentativas).
- Nao mudaremos logica de negocio; apenas apresentacao visual e composicao do card.
- O link de acao principal continua levando para `/desempenho`.

### Plan
1. Preparar dados de barras no container da Home
   - Files: `src/components/premium/home/HomePagePremium.tsx`
   - Change:
     - Derivar `recentScores` a partir de `history` (ultimas 6 tentativas, ordem cronologica para leitura visual).
     - Passar para `HomeHeroSection` as props necessarias para renderizar estados (score atual, barras, volume de historico).
   - Verify:
     - `npx eslint "src/components/premium/home/HomePagePremium.tsx"`

2. Expandir contrato do componente para suportar estados visuais
   - Files: `src/components/premium/home/HomeHeroSection.tsx`
   - Change:
     - Atualizar interface de props para receber serie de scores e metadados minimos do estado.
     - Definir regras claras no componente para `noHistory`, `singleHistory` e `multiHistory`.
   - Verify:
     - `npx eslint "src/components/premium/home/HomeHeroSection.tsx"`

3. Implementar redesign premium do card inspirado na imagem
   - Files: `src/components/premium/home/HomeHeroSection.tsx`
   - Change:
     - Aplicar nova superficie escura premium com gradiente e profundidade controlada.
     - Tornar score principal protagonista (tipografia forte) e bloco de status superior.
     - Criar mini chart de barras onde a ultima tentativa fica em foco e barras adjacentes representam outros simulados.
     - Criar bloco inferior de contexto/meta (ranking/nivel) com acabamento premium, mantendo copy enxuta.
   - Verify:
     - `npx eslint "src/components/premium/home/HomeHeroSection.tsx"`
     - Validacao manual visual do card na Home.

4. Tratar estados 0 e 1 tentativa com elegancia
   - Files: `src/components/premium/home/HomeHeroSection.tsx`
   - Change:
     - Estado 0: layout premium vazio orientando inicio (sem parecer erro), mantendo CTA coerente.
     - Estado 1: barra principal em foco com barras secundarias neutras/contextuais para manter composicao.
   - Verify:
     - Validacao manual simulando cenarios (conta sem historico, com uma tentativa e com varias tentativas).

5. Polimento final de hierarquia e responsividade
   - Files: `src/components/premium/home/HomeHeroSection.tsx`, `src/components/premium/home/HomePagePremium.tsx`
   - Change:
     - Ajustar spacing, proporcao, contraste e alinhamento para desktop/tablet/mobile.
     - Garantir que o card nao compita de forma excessiva com o hero principal.
   - Verify:
     - `npx eslint "src/components/premium/home/HomeHeroSection.tsx" "src/components/premium/home/HomePagePremium.tsx"`
     - `npm run build`

### Risks & mitigations
- Risco: visual forte demais e perda de legibilidade.
  - Mitigacao: limitar opacidades/efeitos e priorizar contraste alto em textos.
- Risco: barras sem significado com poucos dados.
  - Mitigacao: fallback explicito para 0/1 tentativa com narrativa visual honesta.
- Risco: card dominar toda a dobra inicial.
  - Mitigacao: controlar escala e peso para manter equilibrio com bloco hero.

### Rollback plan
- Reverter apenas `src/components/premium/home/HomeHeroSection.tsx` e `src/components/premium/home/HomePagePremium.tsx` para o estado anterior do redesign caso a composicao final fique exagerada.
- Se necessario, manter apenas tipografia/superficie nova e remover mini chart ate calibracao final.
