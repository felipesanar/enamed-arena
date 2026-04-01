### Goal
Aplicar os ajustes de conte?do e UI na landing page conforme solicitado: destaque do chip de ranking no hero, novas c?pias de proposta de valor/an?lise, remo??o da mensagem de "resultado liberado", inclus?o de mensagem online/offline e substitui??o da timeline por hist?rico/pr?ximos simulados sem exibir resultados.

### Assumptions
- O texto deve ser atualizado exatamente conforme enviado (com ajuste de capitaliza??o/pontua??o para consist?ncia visual).
- A timeline da imagem ? refer?ncia de estrutura visual (status + t?tulo + data), n?o precisa replicar pixel-perfect.
- O pedido "retorne com a linha do tempo igual" permite manter linguagem visual do sistema atual com layout inspirado no exemplo.
- N?o h? necessidade de alterar analytics, rotas, nem comportamento de dados reais; ? conte?do de landing.

### Plan
1. Atualizar hero (chip + c?pias principais)
   - Files: `src/components/landing/LandingHero.tsx`
   - Change:
     - Reposicionar chip `# ranking` mais ? direita e aumentar destaque visual (tamanho/sombra/borda/contraste).
     - Alterar item de valor para "Op??o online e offline" + nova descri??o solicitada.
     - Trocar textos do card de an?lise para "Vaga desejada" / "Cl?nica M?dica na USP-SP" / "Voc? seria aprovada nesta institui??o com o desempenho atual".
   - Verify:
     - Inspe??o est?tica do JSX/Tailwind no diff.
     - `npm run lint`

2. Ajustar se??o de diferenciais
   - Files: `src/components/landing/LandingValueProps.tsx`, `src/lib/landingMockData.ts`
   - Change:
     - Remover "Resultado liberado para x alunos" da UI.
     - Inserir mensagem de experi?ncia online e offline no bloco informativo da se??o.
     - Limpar dado mock n?o utilizado para evitar conte?do inconsistente.
   - Verify:
     - `npm run lint`
     - Busca textual para confirmar aus?ncia de "Resultado liberado para" na landing.

3. Atualizar textos da jornada (cards da coluna esquerda)
   - Files: `src/components/landing/LandingHowItWorks.tsx`
   - Change:
     - Passo 2: t?tulo e descri??o para "Fique atento ?s janelas de execu??o" + nova descri??o.
     - Passo 3: descri??o para escolha entre modo online e offline em ambiente realista.
   - Verify:
     - Revis?o do array `STEPS` no diff.
     - `npm run lint`

4. Substituir painel de timeline (coluna direita) por hist?rico/pr?ximos
   - Files: `src/components/landing/LandingHowItWorks.tsx`
   - Change:
     - Reimplementar `LandingJourneyTimelineIllustration` para layout inspirado no print: lista temporal com status (Conclu?do/Em breve), nome do simulado e data.
     - N?o exibir m?tricas de resultado/percentual, apenas metadados de execu??o.
   - Verify:
     - Inspe??o visual estrutural no JSX.
     - `npm run lint`

5. Valida??o final de qualidade
   - Files: (sem novos arquivos)
   - Change:
     - Rodar lint e checar diagn?sticos nos arquivos alterados.
     - Revis?o de riscos (responsividade, legibilidade, consist?ncia de copy).
   - Verify:
     - `npm run lint`
     - `ReadLints` em `LandingHero.tsx`, `LandingValueProps.tsx`, `LandingHowItWorks.tsx`, `landingMockData.ts`

### Risks & mitigations
- Regress?o de responsividade no hero: usar ajustes progressivos com classes responsivas (`lg/xl/2xl`) sem hardcode r?gido.
- Texto longo quebrar layout dos cards: controlar largura/leading e manter classes `line-clamp` quando necess?rio.
- Inconsist?ncia visual da nova timeline: manter tokens de borda/cor/sombra do design system para preservar coes?o.

### Rollback plan
- Reverter apenas os quatro arquivos alterados para o estado anterior via git restore seletivo caso haja regress?o visual.
- Se necess?rio, manter somente as mudan?as de copy e retirar ajustes visuais mais agressivos do chip/timeline.
