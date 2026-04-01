### Goal
Executar um redesign visual forte e contido da Home premium, elevando hierarquia, composicao, materialidade e premium feel sem alterar logica de negocio, navegacao e estrutura funcional principal.

### Assumptions
- A Home alvo e `src/components/premium/home/HomePagePremium.tsx` e seus componentes visuais dependentes.
- Nao havera criacao de novos fluxos/rotas nem mudancas de contratos de dados.
- Pode haver pequeno ajuste em tokens/estilos globais se necessario para consistencia visual, sem quebrar outras telas.
- Copy sera mantida quase intacta; mudancas textuais apenas microajustes de hierarquia visual (nao de conteudo de produto).

### Plan
1. Auditoria tecnica final e baseline visual da Home atual
   - Files: `src/components/premium/home/HomePagePremium.tsx`, `src/components/premium/home/HomeHeroSection.tsx`, `src/components/premium/home/NextSimuladoBanner.tsx`, `src/components/premium/home/QuickActionCard.tsx`, `src/components/premium/home/RankingExpressCard.tsx`, `src/components/premium/DashboardLayout.tsx`, `src/components/premium/PremiumSidebar.tsx`, `src/components/premium/NavItem.tsx`, `src/components/premium/TopUtilityBar.tsx`
   - Change:
     - Consolidar pontos de intervencao visual por area (sidebar/topbar/hero/banner/cards/ranking).
     - Definir linguagem visual unica (raios, sombras, contraste, densidade, escala tipografica).
   - Verify:
     - Checklist de escopo: nenhum item inclui nova feature, nova rota, novo fluxo ou alteracao de regra de negocio.

2. Refinar shell (sidebar + topbar) para elevar percepcao premium
   - Files: `src/components/premium/PremiumSidebar.tsx`, `src/components/premium/NavItem.tsx`, `src/components/premium/sidebar/SidebarNavSection.tsx`, `src/components/premium/TopUtilityBar.tsx`, `src/components/premium/DashboardLayout.tsx`
   - Change:
     - Ajustar superficies, divisores, estado ativo, espacamento e alinhamento para hierarquia mais limpa.
     - Melhorar integracao visual sidebar-main e topbar-conteudo sem alterar navegacao.
   - Verify:
     - Rodar app e validar: navegacao intacta, item ativo legivel, foco visivel, sem overflow em mobile.

3. Reestruturar hero principal e bloco resultado disponivel com hierarquia clara
   - Files: `src/components/premium/home/HomeHeroSection.tsx`, `src/components/premium/home/NextSimuladoBanner.tsx`, `src/components/premium/home/HomePagePremium.tsx`
   - Change:
     - Rebalancear composicao hero vs banner (um protagonista claro, sem competicao de peso).
     - Refinar tipografia, contraste e CTA dos estados do banner para clareza e desejabilidade.
   - Verify:
     - Verificar estados principais do banner (sem simulados, janela aberta, aguardando resultado, resultado disponivel) mantendo logica existente.
     - Confirmar legibilidade/contraste e hierarquia visual em desktop e mobile.

4. Redesenhar sistema de cards (quick actions + ranking) com contraste de importancia controlado
   - Files: `src/components/premium/home/QuickActionCard.tsx`, `src/components/premium/home/RankingExpressCard.tsx`, `src/components/premium/home/HomePagePremium.tsx`
   - Change:
     - Unificar linguagem de materialidade (borda/sombra/radius) e calibrar diferenca de peso entre cards.
     - Melhorar proporcao, spacing e leitura de metricas no ranking sem criar novos dados/features.
   - Verify:
     - Conferir alinhamento de alturas e ritmo visual do grid em `md` e `lg`.
     - Conferir estado loading/sem ranking/com ranking sem quebra de layout.

5. Ajuste fino de tipografia e superficies (polimento final)
   - Files: `src/components/premium/home/*.tsx` (arquivos tocados), `src/components/premium/*.tsx` (arquivos tocados), possivelmente `src/index.css` se necessario
   - Change:
     - Consolidar escala tipografica e micro-hierarquia (eyebrow, titulos, corpo, labels, CTA).
     - Ajustar profundidade, contrastes e acabamento para premium feel consistente.
   - Verify:
     - Revisao visual por breakpoint (desktop/laptop/tablet/mobile).
     - Validacao de foco/contraste/tamanho de alvo para interacoes principais.

6. Revisao tecnica e UX final + validacoes automatizadas
   - Files: todos os arquivos alterados
   - Change:
     - Aplicar revisao disciplinada (severidade) e corrigir pontos abaixo do nivel.
     - Checar boas praticas React/TSX apos edicao dos componentes.
   - Verify:
     - Executar: `npm run lint` (ou comando equivalente do projeto).
     - Executar: `npm run build` (ou comando equivalente) para garantir integridade.
     - Se possivel, validacao visual manual da Home em breakpoints principais.

### Risks & mitigations
- Risco: alteracao global de shell impactar outras rotas.
  - Mitigacao: mudancas concentradas em classes visuais; nao alterar estrutura de navegacao/estado.
- Risco: contraste inadequado em superficies premium.
  - Mitigacao: checagem manual de contraste em textos criticos e ajustes em tokens/opacidades.
- Risco: exagero visual sair do escopo.
  - Mitigacao: aplicar regra refinar o existente acima de inventar novo em cada etapa.
- Risco: regressao responsiva.
  - Mitigacao: validar cada etapa em breakpoints antes de avancar.

### Rollback plan
- Reverter somente os arquivos de UI tocados no redesign caso o resultado nao atinja o criterio premium/escopo.
- Se uma mudanca global (shell) degradar outras telas, isolar o estilo no contexto da Home e manter fallback conservador.
- Restaurar incrementalmente por componente (sidebar, topbar, hero, banner, cards) para identificar regressao com precisao.
