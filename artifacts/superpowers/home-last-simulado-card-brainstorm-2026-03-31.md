### Goal
- Redesenhar o card `Ultimo simulado` dentro de `HomeHeroSection` para refletir a referencia visual anexada (atmosfera premium, gradiente escuro, barras de desempenho e destaque forte da ultima prova), mantendo a Home reconhecivel e sem alterar logica de negocio.
- Definir comportamento visual completo para tres estados: sem simulado feito, apenas um simulado e dois ou mais simulados.

### Constraints
- Escopo visual/UI no card de desempenho da Home; sem backend, sem novas rotas, sem mudanca de regras de produto.
- Nao inflar copy; manter textos curtos e consistentes com a linguagem atual.
- Reusar dados ja disponiveis (`lastScore`, `simuladosRealizados`, `history`, `summary`) sem criar feature nova.
- Manter acessibilidade minima (contraste, foco do link, leitura mobile).

### Known context
- Componente alvo: `src/components/premium/home/HomeHeroSection.tsx`.
- Hoje o card mostra nota do ultimo simulado e dados opcionais de ranking/area, mas sem grafico de historico.
- A tela pai (`HomePagePremium`) ja consome `useUserPerformance()` e possui `history` com `score_percentage` de tentativas anteriores.
- Referencia anexada sugere: superficie escura premium, valor principal grande, mini-barras comparativas e bloco inferior de ranking/meta.

### Risks
- Risco de ficar "conceito Dribbble" e perder legibilidade/praticidade.
- Risco de estado inconsistente quando houver poucos dados (0 ou 1 tentativa).
- Risco de contraste ruim em fundo escuro com textos secundarios.
- Risco de aumentar demais complexidade visual e competir com hero principal.

### Options (2-4)
- Option 1: Upgrade leve no card atual
  - Summary: apenas melhorar cores/sombra/tipografia sem grafico de barras.
  - Pros / cons: baixo risco e rapido, mas nao entrega o salto visual solicitado nem aproxima da referencia.
  - Complexity / risk: baixa / baixa.

- Option 2: Card premium com mini chart e estados de dados (recomendado)
  - Summary: aplicar visual inspirado na referencia (gradiente escuro, score protagonista, barras comparativas), com regras claras para 0/1/2+ simulados.
  - Pros / cons: entrega forte de design mantendo escopo contido; exige boa engenharia de estados para nao parecer artificial.
  - Complexity / risk: media / media-controlada.

- Option 3: Novo componente grande separado na Home
  - Summary: criar modulo adicional para performance historica fora do card atual.
  - Pros / cons: poderia ficar rico, mas expande escopo e altera composicao da Home alem do pedido.
  - Complexity / risk: alta / alta (nao recomendado).

### Recommendation
- Seguir Option 2: transformar o card atual em um bloco premium inspirado na referencia, mas integrado ao design system existente.
- Implementar barras com base no historico real de `history` (ultimas 6 tentativas), destacando a barra da ultima tentativa.
- Definir fallback elegante para 0 e 1 tentativa sem parecer vazio ou fake.

### Acceptance criteria
- Card de `Ultimo simulado` tem salto visual claro (premium/destaque) e se aproxima da linguagem da imagem anexada sem copiar literalmente.
- Score principal fica protagonista e a barra da ultima tentativa fica visualmente em foco.
- Barras laterais representam outras tentativas quando existirem (2+ simulados).
- Estado 0 tentativas: card elegante, orientacao clara e CTA para iniciar jornada (sem quebrar fluxo atual).
- Estado 1 tentativa: card mostra destaque do ultimo score + barras de apoio neutras/contextuais.
- Estado 2+ tentativas: card mostra mini historico real com comparacao visual.
- Card permanece responsivo e legivel em desktop/tablet/mobile.
- Nao ha mudanca de logica de negocio, rotas ou contratos de dados.
