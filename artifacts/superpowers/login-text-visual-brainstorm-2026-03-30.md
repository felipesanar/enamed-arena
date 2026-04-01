### Goal
- Melhorar todo o visual dos textos da p?gina de login para um padr?o premium: hierarquia mais clara, gradientes de destaque bem controlados e contraste consistente em todos os estados (desktop/mobile).

### Constraints
- Stack atual React + Tailwind + tokens CSS existentes em `src/index.css`.
- N?o alterar l?gica de autentica??o/fluxo; foco em tipografia, contraste e acabamento visual.
- Preservar legibilidade e acessibilidade em fundo escuro (evitar gradiente que reduza leitura de textos longos).
- Manter consist?ncia com identidade visual atual (wine/burgundy + tons frios escuros).

### Known context
- A p?gina principal est? em `src/pages/LoginPage.tsx`.
- A coluna de marca/hero est? em `src/components/auth/BrandHero.tsx`.
- Tokens de cor e utilit?rios auth est?o em `src/index.css`.
- J? existem alguns trechos com `bg-clip-text text-transparent`, por?m sem um sistema unificado para headline, subt?tulo e microcopy.

### Risks
- Excesso de gradiente em texto secund?rio pode piorar contraste e leitura.
- Ajustes em classes utilit?rias globais podem impactar outras telas que reutilizam os mesmos tokens.
- Diferen?as desktop/mobile podem criar inconsist?ncias de hierarquia visual.

### Options (2?4)
- **Op??o 1: Ajuste local s? no `LoginPage.tsx`**
  - Summary: aplicar classes utilit?rias diretamente no JSX atual.
  - Pros / cons: r?pido e baixo impacto global / gera duplica??o e dif?cil manuten??o.
  - Complexity / risk: baixa complexidade, risco m?dio de inconsist?ncia futura.

- **Op??o 2: Sistema de utilit?rios tipogr?ficos auth + ado??o em `BrandHero` e `LoginPage`**
  - Summary: criar utilit?rios sem?nticos para gradiente/contraste (`text-auth-headline`, `text-auth-highlight`, etc.) e aplicar nos pontos cr?ticos.
  - Pros / cons: consist?ncia, escalabilidade e manuten??o / exige ajuste coordenado em CSS + componentes.
  - Complexity / risk: m?dia complexidade, risco baixo-m?dio com boa valida??o visual.

- **Op??o 3: Reestrutura??o completa de copy + layout tipogr?fico**
  - Summary: al?m de estilos, mudar reda??o e estrutura dos blocos de texto.
  - Pros / cons: potencial de ganho alto de percep??o premium / maior escopo e risco de retrabalho de produto.
  - Complexity / risk: alta complexidade, risco alto para escopo atual.

### Recommendation
- Seguir a **Op??o 2**: padroniza o visual textual de ponta a ponta (hero + card + estados) com contraste previs?vel e reaproveitamento. Entrega ganho percept?vel sem expandir escopo para mudan?a de conte?do/fluxo.

### Acceptance criteria
- Headline principal da hero com gradiente premium leg?vel em fundo escuro.
- Subt?tulos e textos longos com contraste elevado (sem perda de leitura por transpar?ncia excessiva).
- Microcopy e labels com escala/hierarquia consistente entre desktop e mobile.
- CTA textual e links secund?rios com destaque coerente e estados hover/focus vis?veis.
- Nenhuma regress?o de funcionalidade de login/cadastro/magic link.
