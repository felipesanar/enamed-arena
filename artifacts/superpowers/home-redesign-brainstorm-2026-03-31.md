### Goal
- Repaginar fortemente a Home premium da plataforma, elevando composicao, hierarquia, materialidade e percepcao de produto high-end, sem alterar logica de negocio, fluxo de navegacao, estrutura funcional principal ou copy de forma significativa.

### Constraints
- Escopo estritamente visual/UI: layout, spacing, tipografia, superficies, estados visuais e refinamento de componentes existentes.
- Nao adicionar features novas, widgets extras ou novos fluxos de produto.
- Evitar novos componentes sem necessidade real; priorizar refino dos componentes atuais.
- Manter estrutura atual da Home: sidebar, topbar, hero, bloco de resultado disponivel, cards de rotina e card de ranking/performance.
- Preservar responsividade desktop/laptop/tablet/mobile.

### Known context
- Layout shell: `src/components/premium/DashboardLayout.tsx`.
- Sidebar: `src/components/premium/PremiumSidebar.tsx`, `src/components/premium/sidebar/SidebarNavSection.tsx`, `src/components/premium/NavItem.tsx`.
- Topbar: `src/components/premium/TopUtilityBar.tsx`.
- Home container: `src/components/premium/home/HomePagePremium.tsx`.
- Hero: `src/components/premium/home/HomeHeroSection.tsx`.
- Bloco de resultado: `src/components/premium/home/NextSimuladoBanner.tsx`.
- Sistema de cards: `src/components/premium/home/QuickActionCard.tsx`, `src/components/premium/home/RankingExpressCard.tsx`.
- Diagnostico atual: inconsistencia de sistema visual (tokens/cores/radius/sombras), competicao de destaque entre hero e banner, cards com peso desigual, topbar pouco premium e tipografia com escala irregular.

### Risks
- Regressao visual global ao mexer em shell/sidebar (impacta paginas premium).
- Quebra de contraste/acessibilidade ao intensificar superficies, gradientes e camadas.
- Scope creep com tentacao de criar modulos novos em vez de refinar os existentes.
- Inconsistencia de comportamento responsivo se ajustes de proporcao nao forem calibrados por breakpoint.
- Perda de identidade da plataforma se o redesign divergir demais da linguagem atual.

### Options (2-4)
- Option 1: Polish incremental leve
  - Summary: Ajustes pontuais de cores, bordas e espacamento com mudancas minimas de composicao.
  - Pros / cons: Baixo risco e rapido, porem impacto visual limitado para o salto desejado.
  - Complexity / risk: Baixa complexidade / baixo risco.

- Option 2: Redesign visual forte e contido (recomendado)
  - Summary: Reestruturar hierarquia visual e composicao dos blocos existentes (sidebar, topbar, hero, banner e cards) sem mudar funcionalidades.
  - Pros / cons: Alto ganho de percepcao premium mantendo escopo; exige coordenacao cuidadosa entre componentes para manter consistencia.
  - Complexity / risk: Media complexidade / risco controlavel com validacao por breakpoint e contraste.

- Option 3: Redesign estrutural amplo
  - Summary: Introduzir novos modulos e novas secoes para encher a Home.
  - Pros / cons: Pode parecer impactante no curto prazo, mas viola restricoes de escopo e eleva risco de regressao de UX.
  - Complexity / risk: Alta complexidade / alto risco (nao recomendado).

### Recommendation
- Seguir Option 2: redesign visual forte e contido, priorizando hierarquia, composicao e qualidade percebida sobre expansao funcional.
- Direcao visual inspirada em dashboards premium (hero com presenca, modularidade e leitura rapida), sem copiar literalmente referencias externas e sem descaracterizar a identidade atual.

### Acceptance criteria
- Sidebar com hierarquia mais clara, item ativo mais sofisticado, melhor respiro e acabamento premium sem alterar navegacao.
- Topbar com alinhamento e distribuicao refinados, reduzindo aparencia generica.
- Hero principal com presenca visual superior e tipografia mais forte, mantendo o conteudo essencial.
- Bloco de resultado disponivel com prioridade visual e CTA mais clara por estado.
- Sistema de cards com contraste de importancia (nao parecer tudo igual), com ritmo visual consistente.
- Ranking/performance mais aspiracional e relevante visualmente, sem virar feature nova.
- Escala tipografica mais coesa (titulos, subtitulos, labels, metricas, CTAs).
- Superficies/sombras/bordas mais refinadas, com profundidade premium e consistencia de design system.
- Responsividade integra em desktop/laptop/tablet/mobile, sem overflow e sem quebra de layout.
- Home final claramente superior visualmente, ainda reconhecivel como a mesma tela/produto.
