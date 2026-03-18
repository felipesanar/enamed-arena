# Plano Mestre — Transformação UX/UI da Plataforma de Simulados SanarFlix PRO: ENAMED

**Objetivo:** Reimaginar a experiência de ponta a ponta para elevar drasticamente a percepção de valor, o impacto visual e a sensação de produto premium — gerando reação do tipo *"isso aqui é inacreditavelmente bom, preciso usar/assinar"*.

**Escopo da auditoria:** Projeto inteiro — layout, design system, navegação, UX, arquitetura de informação, estados, componentes, fluxos, todas as telas e jornadas principais.

**Referências de ecossistema:** PRO: ENAMED (identidade), SanarFlix Academy (fluxo), Ranking ENAMED (arquitetura) — como baseline, não cópia. A ambição é superar em refinamento, impacto e acabamento.

**Data:** 2025-03-17.

---

# Bloco 1 — Diagnóstico brutal do estado atual

## O que está bom

- **Base técnica sólida:** React 18, TypeScript, Vite, Supabase, React Query, Radix/shadcn, Framer Motion. Estrutura de pastas clara, separação UI/lógica/dados, hooks e services bem delimitados.
- **Design system com identidade:** Paleta wine/burgundy (PRO ENAMED), neutros quentes, tokens de superfície, sombras, sidebar escura. Tipografia Plus Jakarta Sans com escala (display, heading-1 a 3, body, caption, overline). DNA médico-acadêmico e premium declarado no comentário do `index.css`.
- **Fluxos completos e funcionais:** Login (senha + magic link), onboarding em 3 passos com persistência, dashboard com próximo simulado e stats, calendário de simulados, detalhe por status, prova com timer e persistência, resultado com breakdown por área, correção questão a questão, desempenho, ranking com filtros, comparativo (Recharts), Caderno de Erros (PRO), configurações. Nada quebrado do ponto de vista de jornada.
- **Componentes reutilizáveis:** PremiumCard, PageHeader, SectionHeader, StatCard, SimuladoCard, EmptyState (com variante error e retry), StatusBadge, ProGate, UpgradeBanner. Padrão de loading com SkeletonCard em várias telas. Uso consistente de motion (entrada, stagger) com `useReducedMotion`.
- **Acessibilidade em evolução:** `:focus-visible` global, alvos de toque ≥44px na sidebar e em CTAs principais, modal de envio da prova com Radix Dialog (focus trap, Escape), EmptyState com retry e back, botões com estados active/focus.
- **Segmentação e gates:** Lógica guest/standard/pro clara (SEGMENT_ACCESS), ProGate para Caderno de Erros e UpgradeBanner onde faz sentido. Integração com Supabase para perfil e segmento.

## O que está fraco

- **Primeira impressão genérica:** A home (Index) é um dashboard de cards: hero do próximo simulado, bloco de stats, “Últimos Simulados” e “Acesso Rápido”. Funciona, mas não comunica *evolução*, *competitividade* ou *preparação de elite*. Falta uma narrativa visual forte — “você está aqui, isso é o que importa agora, assim você evolui”.
- **Hierarquia ainda de “painel”:** PageHeader + seções com SectionHeader + grids de PremiumCard/StatCard se repetem em quase toda tela. A informação está organizada, mas a *prioridade emocional* (o que deveria bater primeiro no olho e no coração) não está desenhada. Ex.: resultado da prova merece um momento de celebração/clareza antes de virar mais uma página com cards.
- **Pouco “wow” em momentos críticos:** Login é correto e limpo, mas não transmite “entrei num produto de alto nível”. Tela de prova concluída (ExamCompletedScreen) é funcional; falta um momento de reconhecimento (micro-celebration, copy de confiança). Tela de resultado (ResultadoPage) tem hero score e breakdown, mas a transição “acabei de terminar a prova → aqui está meu desempenho” pode ser mais impactante e editorial.
- **Calendário e listas pouco memoráveis:** SimuladosPage é informativa (banner “Como funciona”, seções Disponíveis/Anteriores/Próximos, cronograma em tabela/cards no mobile). Falta personalização (“seu próximo simulado”, “sua evolução neste ciclo”) e uma sensação de *timeline de preparação*, não só lista de eventos.
- **Analytics e dados “dashboard padrão”:** Desempenho (por área/tema), Ranking (tabela + filtros), Comparativo (gráficos Recharts + insight cards) estão bem implementados, mas o visual é o de relatório: cards, tabelas, gráficos. Falta uma linguagem mais *editorial* e *narrativa* (ex.: “Sua evolução”, “Onde você brilha”, “Próximo foco”) e visualização de progresso que gere desejo de continuar.
- **Caderno de Erros e Configurações:** Caderno é uma lista de PremiumCards com expandir enunciado e remover; Configurações é conta + plano + perfil acadêmico em blocos. Úteis, porém sem personalidade forte e sem sensação de “centro de controle” do candidato.
- **Navegação funcional, não icônica:** Sidebar escura, colapsável, com grupos Navegação e PRO Exclusivo. Faz o trabalho. Não comunica “ecossistema premium” nem oferece atalhos de poder (ex.: command palette) que elevem a percepção de produto.

## O que está limitando a percepção premium

- **Excesso de “card” como solução universal:** Quase toda informação vive dentro de PremiumCard ou blocos com borda/sombra. Isso uniformiza e tranquiliza, mas também achata a hierarquia e a surpresa. Telas que deveriam ter um *hero* (resultado, conclusão da prova, home) competem com o mesmo padrão de card das demais.
- **Tipografia e cor usadas de forma segura:** A escala existe (display, heading-1–3, body…), mas o uso é conservador. Poucos momentos de tipo grande, impacto ou contraste dramático. Wine é usado em CTAs e acentos; poderia ser mais protagonista em momentos de destaque (ex.: nota no resultado, “Simulado concluído”).
- **Ritmo e respiração homogêneos:** `gap-3`, `gap-4`, `mb-8` se repetem. Falta variação consciente: áreas de fôlego (hero, conclusão) vs áreas densas (tabelas, listas). A página tende a um único “tom” de densidade.
- **Microinterações discretas demais:** Hover em cards (translateY -1px), transições de entrada com Framer Motion. Nada errado; falta *feedback* mais perceptível em ações críticas (ex.: selecionar alternativa na prova, finalizar simulado, ver nota) para aumentar a sensação de resposta e qualidade.
- **Charts e dados sem “assinatura”:** Recharts em Comparativo e possivelmente Desempenho entregam informação, mas o estilo é o default (cores, grid, tooltip). Não há uma linguagem visual própria (ex.: wine como cor de progresso, tipografia alinhada ao design system) que faça os gráficos parecerem *do produto*.

## O que impede o produto de impressionar de verdade

- **Falta de uma “assinatura” de experiência:** O produto não tem um gesto visual ou emocional recorrente que o usuário associe só a essa plataforma (ex.: forma como o resultado é revelado, como o progresso é mostrado, como o ranking é apresentado). Tudo parece competente e consistente, mas não *único*.
- **Entrada e saída de fluxos pouco marcadas:** Login não “recebe” o aluno num mundo visual distinto. Sair da prova e cair no resultado é uma troca de página; não há uma transição que marque “você concluiu — aqui está o que importa”.
- **Home não como “hub de evolução”:** O dashboard mostra próximo simulado e números; não mostra *trajetória* (ex.: “Você fez X simulados, está no top Y%”, “Seu próximo marco”). A sensação é de menu de ações, não de painel de preparação de elite.
- **Gates premium corretos mas pouco desejáveis:** ProGate e UpgradeBanner explicam o valor; visualmente são blocos de CTA. Falta fazer o usuário *sentir* o que está perdendo (ex.: preview do Caderno de Erros, destaque do comparativo) para aumentar desejo em vez de só informar.

---

# Bloco 2 — Nova visão de produto e experiência

## Como a plataforma deve fazer o aluno se sentir

- **Confiante:** “Estou no lugar certo para me preparar. Cada tela me diz onde estou e o que fazer em seguida.”
- **Em evolução:** “Vejo meu progresso, meus acertos e erros, e entendo o que melhorar. Não é só uma prova atrás da outra.”
- **Competitivo e motivado:** “O ranking e o comparativo me colocam no jogo. Quero subir e me comparar com quem está no mesmo caminho.”
- **Cuidado:** “O produto me guia, não me abandona. Empty states, erros e loading têm rosto e solução.”
- **Premium:** “Isso parece um produto de educação de alto nível. Não é um site qualquer; é uma plataforma que leva minha preparação a sério.”

## Atmosfera desejada

- **Sofisticação silenciosa:** Visual limpo, sem ruído. Hierarquia clara. Cor e tipo com propósito. Nada de efeitos gratuitos.
- **Editorial e narrativo:** Blocos que contam uma história (ex.: “Seu desempenho neste simulado”, “Sua evolução no ano”, “Próximo passo”). Texto e layout trabalhando juntos.
- **Energia de performance:** Sensação de métrica, objetivo, evolução. Números e progresso visíveis; CTAs que levam à ação seguinte.
- **Autoridade médico-acadêmica:** Seriedade e clareza. Linguagem precisa. Visual que remeta a instituição e excelência, não a entretenimento.

## Assinatura visual e emocional

- **Identidade PRO: ENAMED como base, não limite:** Wine/burgundy e neutros quentes permanecem. A evolução é em *uso*: mais impacto em momentos-chave (hero de resultado, conclusão de prova, home), mais variação de densidade e ritmo, mais “gestos” visuais (ex.: revelação de nota, progresso animado).
- **Um gesto recorrente:** Por exemplo: “revelação progressiva” — em resultado, desempenho e ranking, a informação importante (nota, posição, insight) pode aparecer com leve motion e hierarquia forte, criando um padrão que o usuário reconhece como “aqui a plataforma me mostra o que importa”.
- **Diferenciação clara da versão atual:** Menos “grid de cards igual em todo lugar”; mais “telas com um protagonista por vez” (hero + apoio). Menos “dashboard genérico”; mais “narrativa de preparação”. Menos “tudo no mesmo peso”; mais “hierarquia óbvia e emocional”.

---

# Bloco 3 — Direção de UI reimaginada

## Layout

- **Hierarquia por telas:** Definir para cada tipo de tela um “protagonista”: home = próximo simulado + resumo de evolução; resultado = nota + acertos/erros; desempenho = visão por área/tema com destaque para melhor/pior; ranking = posição do usuário + tabela. O restante é apoio (links, filtros, detalhes).
- **Ritmo variado:** Zonas de respiro (hero, conclusão, empty state bem desenhado) com mais espaço e tipo maior; zonas densas (tabelas, listas, filtros) com grid e tipografia menor. Evitar página inteira no mesmo ritmo.
- **Containers e grids:** Manter sistema de grid (ex.: max-w-7xl no main), mas permitir full-bleed para heroes (ex.: card do próximo simulado ou do resultado) e largura contida para texto longo (correção, enunciados).

## Navegação

- **Sidebar como “base” do produto:** Manter colapsável e grupos; elevar com ícones e estados mais polidos; considerar item ativo com indicador mais forte (ex.: barra lateral wine). Opcional: command palette (Cmd+K) para “Iniciar simulado”, “Ver ranking”, “Desempenho”, “Configurações” como diferencial de produto.
- **Breadcrumb ou contexto onde fizer sentido:** Em detalhe do simulado, resultado e correção, o usuário deve saber “estou no simulado X → resultado”. Pode ser um breadcrumb sutil ou um header de contexto (ex.: “Simulado #3 · Resultado”).

## Homepage (dashboard)

- **Hero único:** Um único bloco dominante: “Próximo simulado” ou “Complete seu perfil” (onboarding). Título claro, data, duração, um CTA principal. Evitar competir com outro bloco do mesmo tamanho.
- **Resumo de evolução:** Em vez de 4 stats iguais, um “resumo” que conte uma mini-história: simulados realizados (destaque), média, e atalho para ranking (ex.: “Sua posição” ou “Ver ranking”). Opcional: mini sparkline ou indicador de tendência.
- **Últimos simulados + Acesso rápido:** Manter, mas com menos peso visual que o hero. Cards compactos e escaneáveis.

## Superfícies e componentes de tela

- **Cards:** Diferenciar “card de destaque” (hero de resultado, próximo simulado) com mais padding, tipo maior, opcional gradiente sutil ou borda wine) de “card de lista” (mais compacto, hover discreto). Não tudo no mesmo PremiumCard.
- **Tabelas e listas:** Tabelas com cabeçalho claro, zebra ou hover suave; em mobile, manter padrão de cards (já feito no cronograma). Listas com avatar/ícone + título + metadado + ação quando fizer sentido (ex.: ranking, últimos simulados).
- **Charts:** Adotar paleta do produto (wine, success, destructive, muted) e tipografia da escala (caption, body-sm). Tooltips e eixos alinhados ao design system. Objetivo: gráficos que pareçam “do produto”, não genéricos.

## Progresso e estados

- **Progresso de prova:** Barra de “respondidas / total” já existe; pode ganhar microcopy (“Suas respostas são salvas automaticamente”) e, opcional, etapa visual (ex.: “Questão 12 de 40”). Tela de conclusão com um CTA principal (“Ver resultado”) e copy de confiança.
- **Resultado:** Hero com nota em destaque (tipo display ou maior), resumo (acertos, erros, em branco) e depois cards de área. Opcional: breve animação de “revelação” da nota (respeitando reduced-motion).
- **Empty e error:** Manter EmptyState unificado (variante error, onRetry, backHref). Garantir ilustração ou ícone forte e uma única ação clara (ex.: “Tentar novamente”, “Voltar ao calendário”).

## Modo prova

- **Foco total:** Layout já é dedicado (sem sidebar). Header com título, progresso e tempo; área de questão com alternativas claras e botão eliminar visível em touch. Manter e polir: estados de seleção, focus, loading de envio.
- **Finalização:** Modal (Dialog) com resumo e confirmação já está acessível. Opcional: copy que reduza ansiedade (“Nada será perdido”).

## Pós-prova (resultado, correção, desempenho, ranking, comparativo)

- **Resultado:** Um hero (nota + resumo) + blocos de apoio (por área, CTAs). Hierarquia clara: nota primeiro, depois “o que fazer” (Ver correção, Desempenho, Ranking).
- **Correção:** Navegação questão a questão já existe; manter clareza do enunciado, alternativas e feedback (certo/errado). Caderno de Erros (PRO) integrado como CTA secundário onde fizer sentido.
- **Desempenho / Ranking / Comparativo:** Tratar como “telas de analytics” com linguagem editorial: títulos que contem história (“Sua evolução”, “Onde você está”, “Comparativo entre simulados”) e visualização (gráficos, tabelas) com identidade visual do produto.

## Gates premium

- **ProGate:** Manter bloqueio e CTA para configurações/upgrade. Melhorar desejo: mostrar preview ou benefícios de forma mais visual (ex.: “Veja como seria seu Caderno de Erros”) em vez de só texto.
- **UpgradeBanner:** Manter como CTA de conversão; alinhar visual ao restante (wine, tipografia) e garantir um único CTA principal.

## Login e entrada

- **Login:** Manter fluxo (entrar/criar conta, magic link, estados de envio e erro). Elevar com: marca PRO: ENAMED mais presente (logo, tagline), card de login com mais respiro e hierarquia clara (título → campos → CTA). Objetivo: “Entrei num produto sério”.
- **Onboarding:** Manter 3 passos e progresso. Opcional: microcopy de valor em cada passo (“Isso personaliza seu ranking”) e momento de sucesso ao final (“Perfil salvo” ou toast) antes de redirecionar.

---

# Bloco 4 — Telas e fluxos com maior potencial de transformação

Prioridade por impacto na percepção de valor e memorabilidade:

1. **Dashboard (Index)** — Primeira impressão pós-login. Hoje: cards e stats. Potencial: hero do próximo simulado + resumo de evolução narrativo + atalhos. Redesign aqui eleva a sensação de “hub de preparação”.
2. **Resultado do simulado (ResultadoPage)** — Momento pós-prova. Hoje: hero score + breakdown + CTAs. Potencial: revelação da nota mais impactante, copy de reconhecimento (“Simulado concluído”), hierarquia óbvia e próximo passo único (Ver correção).
3. **Modo prova (SimuladoExamPage) + conclusão (ExamCompletedScreen)** — Experiência imersiva. Hoje: funcional e limpa. Potencial: conclusão com micro-celebration e CTA único; prova com feedback tátil ainda mais claro (seleção, eliminação).
4. **Calendário de simulados (SimuladosPage)** — Onde o aluno planeja. Hoje: seções + tabela/cards. Potencial: sensação de “sua linha do tempo” (próximo, passados, datas de resultado) e destaque para “seu próximo simulado”.
5. **Detalhe do simulado (SimuladoDetailPage)** — Pré-prova. Hoje: blocos por status. Potencial: CTA “Iniciar simulado” como protagonista quando disponível; informações de janela e duração em apoio, não competindo.
6. **Desempenho (DesempenhoPage)** — Analytics. Hoje: seleção de simulado + área/tema + dados. Potencial: linguagem editorial (“Sua evolução”, “Melhor e pior área”) e gráficos com identidade visual.
7. **Ranking (RankingPage)** — Competitividade. Hoje: filtros + tabela + posição. Potencial: “Sua posição” em destaque (hero) e tabela como apoio; medalhas e posição com mais peso visual.
8. **Comparativo (ComparativoPage)** — Evolução entre simulados. Hoje: Recharts + insight cards. Potencial: narrativa (“Sua evolução entre simulados”) e gráficos alinhados ao design system.
9. **Caderno de Erros (CadernoErrosPage)** — Diferencial PRO. Hoje: lista de cards. Potencial: sensação de “seu material de revisão” (agrupamento, progresso de revisão, tom de valor).
10. **Login (LoginPage)** — Porta de entrada. Hoje: card central com abas. Potencial: marca mais forte, card mais respirável, sensação de “entrada em produto premium”.
11. **Configurações (ConfiguracoesPage)** — Conta e plano. Hoje: blocos Conta, Plano, Perfil. Potencial: organização em seções claras e tom de “seu perfil” em vez de formulário administrativo.

---

# Bloco 5 — Novo sistema de componentes e experiência visual

## O que precisa evoluir (não necessariamente substituir)

- **Cards:** Diferenciar variantes: (1) *hero card* — maior, mais padding, opcional gradiente/borda wine, um CTA; (2) *content card* — atual PremiumCard para listas e blocos; (3) *stat card* — compacto para métricas. Evitar usar o mesmo card para tudo.
- **Page headers:** Manter título e subtítulo; opcional: badge/contexto (ex.: “Simulado #3”) e ação (ex.: StatusBadge). Garantir hierarquia (título > subtítulo > badge).
- **Section headers:** Manter; garantir consistência de espaçamento (mb-4 ou mb-6) e opcional linha ou ícone para seções importantes.
- **Stat cards / data cards:** Hero stat (um número grande + label) vs stat em grid (valor + label + ícone). Ranking “Ver” como link já resolve; evitar valor “—” sem ação.
- **Tabelas:** Cabeçalho com overline/caption, linhas com hover, alinhamento numérico à direita quando for número. Em mobile, substituir por cards (já feito no cronograma).
- **Charts:** Cores do tema (primary/wine, success, destructive, muted); fonte da escala (caption para eixos); tooltip e legend alinhados ao card. Recharts com customização, não default puro.
- **Badges e status:** StatusBadge já cobre status de simulado; manter. Para ranking (posição 1–3), medalhas ou destaque já existem; garantir contraste e acessibilidade.
- **Gates (ProGate, UpgradeBanner):** ProGate com CTA que navega (já feito). UpgradeBanner com foco em benefício e um CTA. Opcional: preview ou “amostra” do que é PRO.
- **Empty states:** EmptyState com variante error, onRetry, backHref (já feito). Ilustração ou ícone forte; uma ação principal. Garantir uso em todas as telas que precisem (lista vazia, erro, sem resultado).
- **Skeletons:** Manter SkeletonCard e skeletons específicos (ex.: prova). Padronizar estrutura (hero skeleton vs grid de cards) por tipo de tela.
- **Alertas e toasts:** Sonner/toast para feedback efêmero; alertas inline para erro/aviso em formulários. Manter linguagem clara e ação quando houver.
- **Onboarding blocks:** Passos com progresso visual; campos com label e hint; botões Voltar/Continuar/Começar com hierarquia clara (já existe). Opcional: microcopy de valor por passo.
- **CTAs:** Primário (wine, sólido), secundário (borda, muted). Um primário por seção quando possível. Estados hover, focus, active consistentes (já trabalhados).
- **Modais:** Dialog Radix para confirmação (ex.: envio da prova). Focus trap e Escape; título e descrição para acessibilidade. Evitar modais para conteúdo longo; preferir página ou drawer.
- **Navegação (sidebar):** Itens com altura mínima 44px (já feito). Ativo com background e peso de fonte. Grupos (Navegação, PRO Exclusivo) mantidos. Opcional: command palette como camada adicional.

---

# Bloco 6 — Plano faseado de implementação

**Status da implementação:** Fase A concluída (2025-03-17). Fase B concluída (2025-03-17).

## Fase A — Visão, design system e fundações

- **Objetivo:** Fixar a direção visual e expandir o design system sem quebrar o que existe.
- **Entregas:** (1) Documento de direção de UI (hero vs content vs stat cards; quando usar cada um). (2) Extensão de tokens se necessário (ex.: hero gradient, spacing de “respiro”). (3) Variantes de card (hero/content/stat) no código ou em documentação para uso consistente. (4) Paleta de charts (wine, success, destructive, muted) documentada e aplicada em um gráfico piloto.
- **Prioridade:** Alta. Depende de nada; é base para as fases seguintes.
- **Impacto:** Consistência e clareza para todas as telas que forem evoluídas depois.
- **Concluído (2025-03-17):** Documento `docs/DIRECAO_UI_CARDS.md`; tokens `--hero-gradient`, `--section-breathe`, classes `.premium-card-hero` e `.section-breathe` em `index.css`; `PremiumCard` com `variant="hero" | "content"`; `src/lib/chartTheme.ts` e gráfico piloto em ComparativoPage.

## Fase B — Dashboard e navegação

- **Objetivo:** Home como hub de evolução e navegação mais reconhecível.
- **Entregas:** (1) Redesign do Index: hero único (próximo simulado ou onboarding), resumo de evolução (métrica principal + apoio), últimos simulados e acesso rápido com menos peso. (2) Sidebar com estado ativo mais claro e opcional command palette (Cmd+K). (3) Breadcrumb ou contexto em detalhe/resultado/correção.
- **Prioridade:** Alta. Depende da Fase A para uso de variantes de card e hierarquia.
- **Impacto:** Primeira impressão e sensação de “onde estou e o que fazer”.

## Fase C — Simulados e prova

- **Objetivo:** Calendário e detalhe mais narrativos; prova e conclusão mais impactantes.
- **Entregas:** (1) SimuladosPage com foco em “seu próximo” e timeline clara (já tem cards no mobile). (2) SimuladoDetailPage com CTA “Iniciar simulado” como protagonista quando disponível. (3) ExamCompletedScreen com copy de confiança e um CTA principal; opcional micro-celebration. (4) Polir QuestionDisplay e SubmitConfirmModal (já acessíveis); garantir feedback tátil em seleção/eliminação.
- **Prioridade:** Alta. Depende da Fase A para padrões visuais.
- **Impacto:** Jornada “escolher → iniciar → concluir” mais clara e memorável.

## Fase D — Pós-prova e analytics

- **Objetivo:** Resultado, correção, desempenho, ranking e comparativo como “narrativa de evolução”.
- **Entregas:** (1) ResultadoPage com hero de nota mais impactante e CTAs com hierarquia (já parcialmente feito). (2) Desempenho com títulos editoriais e charts com identidade. (3) Ranking com “sua posição” em destaque. (4) Comparativo com mesma linguagem e gráficos customizados. (5) Correção mantendo usabilidade e alinhando cabeçalho/contexto.
- **Prioridade:** Alta. Depende de Fase A (charts, cards) e Fase C (fluxo até resultado).
- **Impacto:** Sensação de evolução e competitividade; analytics que parecem “do produto”.

## Fase E — Superfícies de conversão premium

- **Objetivo:** ProGate e UpgradeBanner mais desejáveis; Caderno de Erros e Configurações com identidade forte.
- **Entregas:** (1) ProGate com optional preview ou benefício visual (não só texto). (2) UpgradeBanner alinhado ao novo ritmo e hierarquia. (3) CadernoErrosPage com tom “seu material de revisão” e agrupamento/estados claros. (4) ConfiguracoesPage como “seu perfil” com seções bem definidas.
- **Prioridade:** Média. Depende das fases anteriores para não ficar deslocado.
- **Impacto:** Conversão e retenção; percepção de valor PRO.

## Fase F — Polish final

- **Objetivo:** Revisão de consistência, acessibilidade e performance.
- **Entregas:** (1) Pass de todas as telas com checklist (hierarquia, CTA único por seção, empty/error com ação, loading consistente). (2) prefers-reduced-motion em todas as animações relevantes. (3) Revisão de contraste e foco. (4) Ajustes de copy e microcopy onde faltar clareza.
- **Prioridade:** Alta no fim do roadmap. Depende de todas as fases.
- **Impacto:** Produto fechado em qualidade e acessibilidade.

---

# Bloco 7 — Quick wins vs transformações radicais

## Quick wins (grande impacto, pouco esforço)

- **Hierarquia de CTAs em resultado e detalhe:** Um CTA primário (ex.: Ver correção); demais secundários (já implementado).
- **Hero stat no dashboard:** Uma métrica em destaque (ex.: simulados realizados) e demais em grid (já implementado).
- **Empty/error com retry e back:** EmptyState com variant, onRetry, backHref em listas e detalhes (já implementado).
- **ProGate e UpgradeBanner:** CTA que navega; focus/active nos botões (já implementado).
- **Sidebar e prova:** Alvos 44px, focus-visible, modal com Dialog (já implementado).
- **Cronograma no mobile:** Cards em vez de tabela (já implementado).
- **Copy de confiança na conclusão da prova:** Texto de apoio + CTA único (já implementado parcialmente).

## Melhorias médias (alto retorno, esforço moderado)

- **Charts com identidade:** Customizar Recharts (cores, fonte, tooltip) em Comparativo e Desempenho.
- **Login e onboarding:** Ajuste de respiro, marca e microcopy de valor; sucesso ao concluir onboarding.
- **Resultado:** Revelação da nota com motion sutil (respeitando reduced-motion) e copy de reconhecimento.
- **Command palette (Cmd+K):** Atalhos para simulados, ranking, desempenho, configurações.
- **Breadcrumb/contexto:** Em detalhe do simulado, resultado e correção.

## Transformações radicais (redesign estrutural)

- **Dashboard como “hub de evolução”:** Layout com hero único + resumo narrativo (não só stats) + atalhos; possível inclusão de “sua trajetória” ou “próximo marco”.
- **Resultado como “momento”:** Tela pensada como sequência (nota → resumo → áreas → próximo passo) com ritmo e hierarquia editorial.
- **Analytics com narrativa:** Desempenho, Ranking e Comparativo com títulos e blocos que contem história (“Sua evolução”, “Onde você está”) e visualização com identidade forte.
- **Sistema de cards em variantes:** Hero card vs content card vs stat card implementados e usados de forma consistente em todo o produto.
- **Caderno de Erros como “centro de revisão”:** Agrupamento, progresso e tom que reforcem valor PRO.

---

# Bloco 8 — Critérios de excelência

## Visualmente

- Hierarquia óbvia em até 3 segundos em qualquer tela.
- Um protagonista por tela (hero, nota, posição, próximo simulado) quando fizer sentido.
- Ritmo variado: zonas de respiro e zonas densas; não tudo no mesmo peso.
- Identidade PRO: ENAMED presente (wine, tipografia, tom) sem parecer template.
- Charts e tabelas com a mesma linguagem visual do resto do produto.
- Empty, loading e error com rosto e ação clara.

## Funcionalmente

- Todas as jornadas (login → onboarding → dashboard → prova → resultado → correção → desempenho/ranking/comparativo) completas e sem dead ends.
- Um CTA principal por contexto; retry e “voltar” onde houver erro ou empty.
- Navegação previsível (sidebar + opcional command palette); contexto (breadcrumb ou header) onde ajudar.
- Acessibilidade: foco, contraste, reduced-motion, semântica e modais com focus trap.

## Emocionalmente

- Aluno sente que está em um produto sério e de alto nível (entrada, home, resultado).
- Sensação de evolução e competitividade (desempenho, ranking, comparativo).
- Confiança em momentos críticos (conclusão da prova, resultado, erro com retry).
- Desejo de continuar e de assinar PRO (gates e benefícios claros e desejáveis).

## Comercialmente

- Primeira impressão e home que comuniquem valor e próximo passo.
- Resultado e pós-prova que reforcem “valeu a pena” e “quero ver correção/evolução”.
- ProGate e UpgradeBanner que informem e gerem desejo (preview, benefício visual).
- Produto que possa ser mostrado como referência de qualidade no ecossistema SanarFlix/PRO: ENAMED.

---

# Resumo executivo

- **Estado atual:** Base técnica e de design system sólidas; fluxos completos; percepção “dashboard competente”, ainda pouco memorável e pouco narrativa.
- **Direção:** Reimaginar a experiência como *narrativa de preparação de elite*: hero por tela, ritmo variado, identidade visual forte, momentos de impacto (resultado, conclusão da prova, home) e analytics com linguagem editorial.
- **Plano:** Fases A (fundações e design system) → B (dashboard e navegação) → C (simulados e prova) → D (pós-prova e analytics) → E (conversão premium) → F (polish). Quick wins já aplicados onde possível; melhorias médias e transformações radicais distribuídas nas fases.
- **Critérios de sucesso:** Produto que impressione visualmente, funcione sem fricção, gere confiança e desejo e sustente a ambição comercial do PRO: ENAMED, preservando o DNA da marca e a implementabilidade em fases.
