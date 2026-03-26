### Goal
- Refatorar a dashboard premium para reduzir drasticamente o scroll e deixar o conte?do essencial acima da dobra, com foco em clareza de pr?xima a??o para o aluno.
- Aplicar uma hierarquia compacta com menos ru?do visual, mantendo consist?ncia do design system existente.

### Constraints
- Preservar arquitetura React/TSX atual e reaproveitar componentes existentes sempre que poss?vel.
- Remover se??es redundantes sem quebrar navega??o/rotas j? usadas em outras p?ginas.
- Limitar CTAs prim?rios vis?veis a no m?ximo 2 na home.
- Garantir responsividade (mobile/desktop) e acessibilidade b?sica (sem?ntica, foco, contraste).

### Known context
- A home premium atual est? em `src/components/premium/home/HomePagePremium.tsx`.
- Estrutura atual inclui: hero, pr?ximo simulado, KPIs, a??es r?pidas, intelig?ncia, continuidade.
- O hero (`HomeHeroSection`) hoje exibe badges de m?tricas e m?ltiplos CTAs.
- O card `UpcomingSimulationCard` hoje mostra mensagem negativa: "Nenhum simulado dispon?vel neste momento".
- `InsightsSection` (Intelig?ncia) ? bloco separado e `KpiGrid` (Desempenho) ? separado.

### Risks
- Regress?o de layout em breakpoints menores ao compactar excessivamente.
- Excesso de remo??o reduzir discoverability de links secund?rios ?teis.
- Inconsist?ncia sem?ntica de CTA prim?rio/secund?rio ao reduzir a??es.
- Altera??es em componentes compartilhados podem impactar outras telas (se houver reuso futuro).

### Options (2?4)
- **Op??o 1 ? Refactor incremental com m?nima cria??o de componentes**
  - Summary: ajustar composi??o em `HomePagePremium` e compactar componentes existentes; integrar intelig?ncia dentro de desempenho via `KpiGrid`.
  - Pros: r?pido, menor risco, menos diffs.
  - Cons: pode limitar refinamentos mais profundos de UX.
  - Complexity / risk: m?dia / baixa.

- **Op??o 2 ? Criar nova se??o ?nica ?Desempenho + Intelig?ncia?**
  - Summary: substituir `KpiGrid` + `InsightsSection` por um novo bloco coeso.
  - Pros: melhor controle de hierarquia e densidade.
  - Cons: maior volume de c?digo novo e risco de inconsist?ncia visual.
  - Complexity / risk: m?dia-alta / m?dia.

- **Op??o 3 ? Reescrever home inteira**
  - Summary: reconstruir estrutura e estilos do zero.
  - Pros: liberdade total de design.
  - Cons: risco alto de regress?o, mais tempo, maior chance de diverg?ncia de design system.
  - Complexity / risk: alta / alta.

### Recommendation
- Escolher **Op??o 1**: refactor incremental orientado por UX, removendo se??es e compactando layout com altera??es cir?rgicas nos componentes da home.
- Motivo: atende o objetivo de densidade/clareza com menor risco t?cnico e tempo, preservando consist?ncia visual j? estabelecida.

### Acceptance criteria
- `QuickActionsSection` e `ResumeSection` n?o aparecem mais na home.
- Hero fica compacto e sem badges de status/m?tricas; status resumido em 1 linha.
- `UpcomingSimulationCard` passa a exibir mensagem positiva de ?Pr?ximo simulado dispon?vel? com data e 1 CTA principal.
- `InsightsSection` deixa de ser se??o independente; intelig?ncia aparece integrada ao bloco de desempenho.
- Home exibe no m?ximo 2 CTAs prim?rios vis?veis.
- Espa?amentos/typography/cards ficam perceptivelmente mais compactos, com redu??o de scroll.
- Build/lint do escopo alterado sem erro novo.
