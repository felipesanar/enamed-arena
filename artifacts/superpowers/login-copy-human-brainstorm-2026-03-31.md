### Goal
- Tornar a copy da tela de login mais humana, clara e confiavel, reduzindo tom promocional excessivo sem perder posicionamento premium.
- Aumentar sensacao de acolhimento e direcao (o usuario entende rapido onde esta e o que fazer em seguida).

### Constraints
- Nao alterar fluxo funcional de autenticacao (login, cadastro, magic link, estado de envio).
- Manter consistencia com marca/proposta SanarFlix PRO ENAMED.
- Preservar microcopy curta para mobile e boa escaneabilidade.
- Evitar promessas exageradas; linguagem deve soar real e util.

### Known context
- Copy atual esta concentrada em `src/pages/LoginPage.tsx` e `src/components/auth/BrandHero.tsx`.
- Hero usa headlines fortes e linguagem mais "institucional/promo".
- Bloco do formulario possui rotulos tecnicos e links de apoio que podem soar frios.
- Usuario pediu explicitamente um texto "mais humano e real".

### Risks
- Humanizar demais e perder percepcao premium.
- Simplificar em excesso e reduzir diferenciacao da proposta.
- Inconsistencia entre desktop (hero mais emocional) e mobile (mensagens curtas).

### Options (2-4)
- **Opcao 1 - Humano confiante (recomendada)**
  - Summary: tom acolhedor + objetivo, com foco em continuidade de estudo e clareza de proximo passo.
  - Pros / cons: mais proximo da realidade do aluno, melhora confianca / exige ajuste fino para manter "premium".
  - Complexity / risk: media complexidade, baixo risco.

- **Opcao 2 - Premium aspiracional (suave)**
  - Summary: mant?m tom aspiracional, mas com menos adjetivos e mais beneficio pratico.
  - Pros / cons: preserva branding atual / ainda pode soar distante para parte dos usuarios.
  - Complexity / risk: baixa complexidade, medio risco de pouca mudanca percebida.

- **Opcao 3 - Direto e utilitario**
  - Summary: linguagem extremamente objetiva, quase sem narrativa.
  - Pros / cons: muito claro e rapido / perde calor humano e valor emocional da marca.
  - Complexity / risk: baixa complexidade, medio risco de ficar "frio".

### Recommendation
- Adotar a **Opcao 1 - Humano confiante**.
- Motivo: entrega o que foi pedido (mais humano e real), melhora compreensao imediata da tela e mantem credibilidade premium com linguagem menos inflada.

### Acceptance criteria
- Headline e subtitulo explicam valor real sem exagero promocional.
- Labels e acoes soam naturais (linguagem de pessoa para pessoa).
- Texto legal e mensagens de apoio ficam claros e menos "roboticos".
- Desktop e mobile mantem o mesmo tom de voz.
- Leitura em 3 segundos: usuario entende "onde estou" e "o que faco agora".

## Proposta de copy (Opcao 1)
- Hero title: **Sua prepara??o para o ENAMED, com mais clareza e const?ncia.**
- Hero subtitle: **Entre na plataforma e continue exatamente de onde parou, com foco no que mais impacta sua aprova??o.**
- Hero support: **Menos ru?do, mais dire??o: simulados, an?lise e evolu??o em um fluxo simples.**

- Mobile hero title: **Evolua com dire??o no ENAMED.**
- Mobile hero subtitle: **Retome seu plano em minutos, com foco no que importa agora.**

- Login helper (mobile): **Entre para continuar sua prepara??o sem perder o ritmo.**
- Signup helper (mobile): **Crie sua conta e comece seu primeiro simulado hoje.**

- Email label: **Seu e-mail**
- Password label: **Sua senha**
- Signup name label: **Como voc? gosta de ser chamado(a)**
- Signup password label: **Crie uma senha**

- CTA login: **Entrar na plataforma**
- CTA signup: **Criar minha conta**
- CTA magic link: **Receber link de acesso**
- Secondary action: **Entrar com senha**

- Magic link hint: **Enviamos um link seguro para seu e-mail.**
- Legal text: **Ao continuar, voc? concorda com nossos termos e pol?tica de privacidade.**
