### Goal
- Ajustar a landing page para refletir nova mensagem comercial e melhorar destaque visual do hero (chip de ranking), mantendo consist?ncia com design system e sem regress?es de layout responsivo.

### Constraints
- Stack React + Tailwind + Framer Motion; manter padr?es existentes da LP.
- Evitar mudan?as estruturais desnecess?rias: foco em copy, microajustes visuais e timeline demonstrativa.
- Preservar acessibilidade b?sica (labels, contraste e legibilidade).
- N?o alterar integra??es/back-end; somente front-end da landing.

### Known context
- `src/components/landing/LandingHero.tsx` cont?m: chip `# ranking`, bloco "An?lise SanarFlix", e grid de value props com item "Offline e gabarito".
- `src/components/landing/LandingValueProps.tsx` cont?m t?tulo "Muito al?m..." e faixa "Resultado liberado para...".
- `src/components/landing/LandingHowItWorks.tsx` cont?m cards de passos e painel de timeline da jornada.
- `src/lib/landingMockData.ts` exp?e a linha "Resultado liberado para..." usada em diferenciais.

### Risks
- Regress?o visual em breakpoints grandes no reposicionamento do chip lateral.
- Quebra de alinhamento/overflow por mudan?a de copy mais longa nos cards.
- Inconsist?ncia de tom entre textos antigos e novos na mesma se??o.
- Timeline ficar densa demais sem dados de resultado se n?o houver hierarquia visual clara.

### Options (2?4)
- Op??o 1: Ajustes m?nimos de texto + pequeno tweak de posi??o do chip.
  - Pros: baixo risco, execu??o r?pida.
  - Cons: ganho visual limitado no destaque solicitado.
  - Complexidade / risco: baixa.
- Op??o 2: Ajustes de texto + refor?o visual moderado do chip (posi??o, escala, glow, badge) + timeline mock de pr?ximos/hist?rico simulados.
  - Pros: atende pedido de destaque e storytelling da jornada de forma equilibrada.
  - Cons: exige calibragem fina para n?o poluir o hero.
  - Complexidade / risco: m?dia.
- Op??o 3: Refatorar layout completo das se??es hero/como-funciona.
  - Pros: liberdade total de redesign.
  - Cons: alto risco, escopo acima do pedido.
  - Complexidade / risco: alta.

### Recommendation
- Seguir a Op??o 2: mant?m arquitetura atual, resolve os pontos de copy, aumenta destaque do chip de ranking e substitui a timeline por vers?o estilo hist?rico/pr?ximos da imagem, sem mostrar resultados num?ricos.

### Acceptance criteria
- Chip `# ranking` aparece mais ? direita e visualmente mais destacado sem clipping no desktop.
- Value prop "Offline e gabarito" vira "Op??o online e offline" com nova descri??o solicitada.
- Bloco de an?lise muda para: "Vaga desejada", "Cl?nica M?dica na USP-SP" e descri??o "Voc? seria aprovada nesta institui??o com o desempenho atual".
- Se??o diferenciais remove men??o "Resultado liberado para..." e inclui mensagem de experi?ncia online/offline.
- Em "Como funciona", passo 2 e passo 3 recebem os novos textos solicitados.
- Painel de timeline ? direita vira hist?rico/pr?ximos como na imagem de refer?ncia, exibindo apenas status, nome do simulado e data (sem notas/resultados).
