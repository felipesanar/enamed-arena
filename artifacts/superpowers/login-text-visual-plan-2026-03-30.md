### Goal
Elevar o visual de todos os textos da p?gina de login com tipografia premium, gradientes bem aplicados e contraste consistente em fundo escuro, sem alterar o comportamento funcional dos fluxos de autentica??o.

### Assumptions
- O escopo ? estritamente visual (texto, hierarquia e contraste) na experi?ncia de login.
- N?o haver? altera??o de regras de autentica??o nem copy funcional cr?tica.
- Podemos introduzir novos utilit?rios CSS em `src/index.css` para reutiliza??o imediata e futura.

### Plan
1. Definir sistema de estilos textuais auth (tokens utilit?rios)
   - Files: `src/index.css`
   - Change: criar utilit?rios sem?nticos para headline gradiente, destaque de palavra-chave, subt?tulo de alta legibilidade, microcopy e links em fundo escuro.
   - Change: ajustar contraste de classes existentes para reduzir ?reas com `text-transparent` em textos longos.
   - Verify: `npm run lint`

2. Aplicar padr?o no hero desktop/mobile
   - Files: `src/components/auth/BrandHero.tsx`, `src/pages/LoginPage.tsx`
   - Change: aplicar classes novas no t?tulo/subt?tulo e blocos de apoio do hero para hierarquia clara (headline > supporting > microcopy).
   - Change: manter gradiente apenas em pontos de ?nfase (palavra-chave e headline), preservando legibilidade em par?grafos.
   - Verify: `npm run lint`

3. Refinar textos do card de autentica??o (abas, labels, links, notas)
   - Files: `src/pages/LoginPage.tsx`
   - Change: uniformizar escala de texto, peso e opacidade entre labels, helper text, links de a??o e disclaimer.
   - Change: melhorar contraste de textos secund?rios e estados hover/focus para links e CTAs textuais.
   - Verify: `npm run lint`

4. Verifica??o funcional e visual final
   - Files: `src/pages/LoginPage.tsx`, `src/components/auth/BrandHero.tsx`, `src/index.css`
   - Change: revis?o de consist?ncia desktop/mobile e fluxos login/signup/magic-link/sent.
   - Verify: `npm run build`
   - Verify: `npm run dev` e validar visualmente `/login` (desktop e mobile): headline leg?vel, subt?tulo com bom contraste, links leg?veis, sem regress?o de intera??o.

### Risks & mitigations
- Risco: gradiente reduzir contraste em textos longos.
  - Mitiga??o: usar gradiente apenas em t?tulos/destaques; textos corridos ficam em cor s?lida de alto contraste.
- Risco: regress?o visual em componentes auth compartilhados.
  - Mitiga??o: utilit?rios sem?nticos isolados para login + revis?o manual de estados principais.
- Risco: inconsist?ncia entre desktop e mobile.
  - Mitiga??o: checklist visual em ambos breakpoints antes de concluir.

### Rollback plan
- Reverter altera??es dos tr?s arquivos tocados (`src/index.css`, `src/components/auth/BrandHero.tsx`, `src/pages/LoginPage.tsx`) para o estado anterior caso a legibilidade/consist?ncia n?o atinja o padr?o esperado.
- Se necess?rio, manter apenas ajustes de contraste sem gradiente at? nova itera??o controlada.
