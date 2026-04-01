### Verification
- Commands run:
  - `npx eslint "src/components/premium/home/HomePagePremium.tsx"`
  - `npx eslint "src/components/premium/home/HomeHeroSection.tsx"`
  - `npx eslint "src/components/premium/home/HomeHeroSection.tsx" "src/components/premium/home/HomePagePremium.tsx"`
  - `npm run build`
- Results:
  - ESLint dos arquivos alterados: **pass**.
  - Build de producao: **pass**.
  - Warnings de bundle/Tailwind vistos no build sao gerais e preexistentes (fora do escopo deste card).

### Summary of changes
- `src/components/premium/home/HomePagePremium.tsx`
  - Derivacao de `recentScores` (ultimas 6 tentativas) com normalizacao e ordem cronologica para visualizacao no card.
  - Envio de `recentScores` para `HomeHeroSection`.
  - Ajuste de classe no bloco de onboarding para evitar referencia indefinida.
- `src/components/premium/home/HomeHeroSection.tsx`
  - Card de `Ultimo simulado` foi totalmente redesenhado para visual premium inspirado na referencia anexada.
  - Score principal em destaque, badge de variacao e mini chart de barras com foco na ultima tentativa.
  - Bloco inferior de contexto (ranking/meta) com progress bar e informacoes de progresso.
  - Implementacao de estados completos:
    - **0 simulados**: composicao premium orientativa com CTA de inicio.
    - **1 simulado**: barra principal em foco + barras contextuais neutras.
    - **2+ simulados**: barras reais baseadas no historico com destaque da ultima prova.

### Review pass (Blocker/Major/Minor/Nit)
- **Blocker**
  - Nenhum.
- **Major**
  - Nenhum identificado no escopo alterado.
- **Minor**
  - A calibracao fina de opacidade/cor das barras pode ser ajustada apos validacao visual lado a lado com a referencia em diferentes monitores.
- **Nit**
  - Possivel microajuste de copy do painel inferior para ficar ainda mais aspiracional, mantendo o mesmo conteudo funcional.

### Follow-ups
- Fazer validacao visual manual em conta com 0, 1 e 2+ simulados para confirmar a narrativa de cada estado em ambiente real.
- Se desejar, posso fazer uma segunda passada de micro-polimento com base em screenshot comparativo direto.

### How to validate manually
1. Rodar `npm run dev`.
2. Acessar Home autenticado e verificar o card `Ultimo simulado`.
3. Confirmar comportamento por estado:
   - sem historico: card premium orientativo;
   - uma tentativa: barra final em foco com contexto;
   - varias tentativas: barras comparativas com ultima em destaque.
4. Validar responsividade (desktop/tablet/mobile) e legibilidade de contraste.
