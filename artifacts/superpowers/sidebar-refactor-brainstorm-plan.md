### Goal
- Refatorar a sidebar premium para eliminar scroll vertical em alturas comuns de laptop, remover completamente a secao "Seu momento" e tornar a navegacao mais compacta, hierarquica e responsiva por altura de viewport.

### Constraints
- Stack React + Tailwind com componentes ja existentes em `src/components/premium/sidebar/` e `src/components/premium/`.
- Nao quebrar comportamento de navegacao ativa, foco de teclado e acoes do rodape (configuracoes/sair).
- Manter estetica premium, porem com compactacao agressiva para caber sem overflow.
- Evitar mudancas amplas fora da sidebar para reduzir risco de regressao.

### Known context
- `PremiumSidebar.tsx` hoje aplica `overflow-y-auto` no container interno e inclui `SidebarContextCard` ("Seu momento").
- `NavItem.tsx` e `SidebarProSection.tsx` usam paddings/tipografia relativamente grandes (`py-2.5`, `text-[15px]`).
- `SidebarFooterAccount.tsx` ja usa `mt-auto`, mas o conjunto ainda compete por altura com blocos superiores.
- Header da marca (`SidebarBrandBlock.tsx`) pode ser compactado para reduzir consumo vertical.

### Risks
- Remover card de contexto pode impactar percepcao de orientacao do usuario se o layout ficar seco demais.
- Compactacao excessiva pode reduzir legibilidade e targets de clique.
- Ajustes de altura por media query podem criar inconsistencias se nao forem aplicados de modo uniforme nos itens.
- Mudancas no container podem afetar comportamento em telas muito pequenas (<700px), exigindo fallback visual controlado.

### Options (2-4)
- **Option 1: Compactacao incremental mantendo estrutura atual**
  - Summary: remover `SidebarContextCard`, reduzir espacamentos/tipografia/icones e remover overflow scroll.
  - Pros / cons: rapido e baixo risco, porem menos controle fino da distribuicao vertical.
  - Complexity / risk: baixa complexidade, risco medio de ainda sobrar overflow em casos limite.

- **Option 2: Layout por regioes fixas (header/nav/footer) + densidade adaptativa por altura**
  - Summary: reorganizar `PremiumSidebar` com `flex` em tres blocos claros, `overflow-hidden`, separadores leves e classes responsivas por `max-height`.
  - Pros / cons: melhor previsibilidade e robustez; exige tocar mais de um componente para alinhar densidade.
  - Complexity / risk: media complexidade, risco baixo-medio com boa validacao.

- **Option 3: Escala automatica via `clamp()` centralizada em CSS utilitario**
  - Summary: criar classes customizadas para padding/font-size com `clamp()` e aplicar em nav/pro/footer.
  - Pros / cons: elegante e escalavel; aumenta acoplamento com estilos customizados e testes visuais.
  - Complexity / risk: media-alta complexidade, risco medio de tuning fino.

### Recommendation
- Escolher **Option 2**: equilibrio entre robustez e esforco, com controle explicito do espaco vertical e aderencia direta ao prompt (sem scroll, rodape fixo, hierarquia clara, compactacao responsiva).

### Acceptance criteria
- `SidebarContextCard` ("Seu momento") removido da sidebar renderizada.
- Sidebar sem `overflow-y-auto/scroll` no container principal e sem scroll interno na faixa 768px-1366px de altura.
- Itens de navegacao e secao PRO com padding/tipografia/icones menores, mantendo acessibilidade e estado ativo visivel.
- Header ocupa area visual compacta (aprox. <= 10-12% da altura util).
- Rodape de conta permanece no fundo com `mt-auto`, sem empurrar navegacao para fora da viewport.
- Em alturas menores (ex.: `max-height: 700px`), densidade reduz automaticamente via classes responsivas/media query.

---

### Goal
Refatorar a sidebar premium para remover a secao "Seu momento", eliminar scroll e garantir legibilidade/uso em alturas comuns de laptop com hierarquia visual clara.

### Assumptions
- O componente alvo em producao e `PremiumSidebar` e seus subcomponentes em `src/components/premium/sidebar/`.
- O projeto usa Tailwind padrao com suporte a variantes responsivas; ajustes por `max-height` podem ser feitos com CSS utilitario dedicado se necessario.
- Verificacao local pode ser feita via lint + build e inspecao visual manual no app em execucao.

### Plan
1. Mapear e ajustar estrutura base da sidebar
   - Files: `src/components/premium/PremiumSidebar.tsx`
   - Change:
     - Remover renderizacao de `SidebarContextCard` e dados associados.
     - Reorganizar wrapper para `flex h-full flex-col overflow-hidden`, com distribuicao clara entre header/nav/pro/footer e separadores leves.
   - Verify: inspecao de diff + checagem de ausencia de imports/variaveis orfas.

2. Compactar bloco de marca e navegacao principal
   - Files: `src/components/premium/sidebar/SidebarBrandBlock.tsx`, `src/components/premium/NavItem.tsx`, `src/components/premium/sidebar/SidebarNavSection.tsx`
   - Change:
     - Reduzir alturas, paddings, tipografia e icones.
     - Refinar hierarquia visual com destaque sutil dos itens principais e espacamento mais enxuto.
   - Verify: executar `npm run lint` e validar visualmente estados default/hover/active/focus.

3. Compactar secao PRO e rodape mantendo usabilidade
   - Files: `src/components/premium/sidebar/SidebarProSection.tsx`, `src/components/premium/sidebar/SidebarFooterAccount.tsx`
   - Change:
     - Reduzir densidade vertical e manter CTA/acoes legiveis.
     - Garantir rodape ancorado no fundo (`mt-auto`) sem colisao com navegacao.
   - Verify: inspecao visual em desktop e altura reduzida; confirmar que botoes continuam acessiveis.

4. Adicionar responsividade por altura de viewport
   - Files: `src/components/premium/PremiumSidebar.tsx` (e, se necessario, arquivo de estilos global/utilitario ja existente no projeto)
   - Change:
     - Aplicar classes/estilos para `max-height` reduzindo padding/font-size em breakpoints de altura (ex.: <=700px).
     - Assegurar que a sidebar nao introduz overflow interno.
   - Verify: rodar app local, testar viewport heights (700, 768, 900, 1080) e confirmar ausencia de scroll.

5. Validacao final e revisao de qualidade
   - Files: arquivos alterados
   - Change:
     - Revisar acessibilidade (foco visivel, contraste, area clicavel) e consistencia visual premium.
     - Ajustes finos de spacing/hierarquia conforme necessario.
   - Verify: `npm run lint` e `npm run build` (ou comando equivalente do projeto) + checklist manual de UX.

### Risks & mitigations
- Risco: targets de clique ficarem pequenos demais.
  - Mitigacao: manter altura minima confortavel nos itens e validar hover/focus/keyboard.
- Risco: alturas muito baixas ainda causarem clipping.
  - Mitigacao: aplicar reducao adicional sob `max-height` e testar multiplos cenarios.
- Risco: regressao visual em rotas com estado ativo.
  - Mitigacao: validar rotas principais (`/`, `/simulados`, `/desempenho`, etc.) apos ajuste.

### Rollback plan
- Reverter apenas os arquivos da sidebar alterados para o estado anterior (`PremiumSidebar`, blocos de nav/pro/footer/brand) se qualquer regressao critica de navegacao ou acessibilidade surgir.
