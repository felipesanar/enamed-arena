# Brainstorm: Reconstrução da Experiência de Simulado ENAMED

**Data:** 2026-04-04
**Tipo:** Brainstorm de produto + UX + UI + direção visual
**Escopo:** Fluxo completo do clique "Iniciar Simulado" até a tela de conclusão pós-prova

---

## 1. Diagnóstico Estratégico

### 1.1 Estado atual — o que existe

O fluxo atual funciona. A arquitetura de hooks (`useExamFlow`, `useExamTimer`, `useExamStorageReal`) é sólida. O motor de prova é confiável: persistência debounced, sendBeacon como fallback, deadline absoluta, atalhos de teclado, fullscreen automático, controle de foco de aba. A base técnica é boa.

Mas a experiência visual e sensorial é **funcional sem ser memorável**. Ela resolve o problema sem criar percepção de valor. O estudante faz a prova, mas não sente que está usando algo excepcional.

### 1.2 Problemas específicos que fazem a experiência parecer mediana

**Transição inexistente entre mundos.** O estudante está no dashboard premium com sidebar, breadcrumbs, cards — e de repente é jogado para um `h-screen flex flex-col` com fundo `bg-background`. Não há ritual de entrada. Não há mudança de atmosfera. É como sair de um lobby de hotel e entrar em uma sala de aula qualquer.

**Header da prova é utilitário demais.** O `ExamHeader` é uma faixa de 56px com título, barra de progresso compacta, timer e botão "Finalizar" vermelho. É funcional, mas parece toolbar de aplicativo corporativo, não ambiente de prova premium. O botão "Finalizar" em `bg-destructive` vermelho no header transmite tensão permanente, não sofisticação.

**A barra de progresso é duplicada.** Há uma barra no header (baseada em currentQuestion/total) e outra logo abaixo (baseada em answered/total). Informações semelhantes em posições muito próximas geram ruído visual.

**A área de questão não cria foco.** O `QuestionDisplay` renderiza tags de área/tema, número da questão, texto e alternativas em uma coluna `max-w-3xl` sem nenhum tratamento de superfície, profundidade ou separação visual que diga "esta é a área sagrada da prova". É conteúdo flutuando em fundo neutro.

**Alternativas são interativas mas não premium.** Cards com `border-2`, `rounded-xl`, hover em `border-primary/40` — é correto mas genérico. A sensação de selecionar uma alternativa (o "click feel") é fraca: apenas muda a borda e o badge circular. Não há feedback que comunique "sua escolha foi registrada com confiança".

**Sidebar de navegação é um grid de quadrados.** O `QuestionNavigator` usa `grid gap-1.5` com botões de 32px. Funciona para 10 questões, mas fica apertado e monótono para 50+. Não há sensação de "mapa" da prova — é uma grade plana sem hierarquia.

**Mobile é desktop encolhido.** O `MobileQuestionNav` fixo no bottom com scroll horizontal de quadradinhos 28px é funcional mas não elegante. O padding inferior do main (`pb-14`) empurra conteúdo, mas a experiência não é reinterpretada para toque.

**A tela de conclusão é informativa mas não emocional.** Um ícone verde, "Prova entregue!", badges de resumo, card de liberação, toggle de email, CTAs. É uma checklist de informações. O momento mais importante do fluxo — quando o estudante finalmente termina — é tratado com a mesma temperatura visual de uma mensagem de confirmação de cadastro.

**Não há camada atmosférica.** O `bg-background` neutro, os `border-border` genéricos, as sombras `shadow-md` pontuais — tudo funciona em isolamento mas não constrói uma atmosfera coesa que diga "você está em um ambiente de prova de alto nível".

**O loading é um skeleton genérico.** Barras `bg-muted animate-pulse` que não comunicam nada sobre o que está por vir. O momento de "carregar a prova" poderia ser um momento de preparação e antecipação.

### 1.3 Erros comuns que fazem experiências de simulado parecerem medianas

- **Tratar a prova como formulário.** O paradigma mental é "lista de perguntas com radio buttons". Isso leva a interfaces que são funcionalmente corretas mas emocionalmente vazias.
- **Ignorar a transição de contexto.** O estudante está em modo navegação (dashboard) e precisa mudar para modo concentração (prova). Sem uma transição intencional, o cérebro não "muda de marcha".
- **Copiar o timer do Enem.** Um relógio digital no canto é a solução mais óbvia e menos sofisticada. É ansiedade pura sem elegância.
- **Esquecer o arco emocional.** O fluxo de prova tem um arco: antecipação → concentração → pressão crescente → momento decisivo → alívio/conquista. Se a UI não acompanha esse arco, a experiência é flat.
- **Poluir com features.** Eliminação de alternativas, marcação para revisão, alta certeza, navegador, timer, progresso, autosave, alertas — muitas ferramentas competindo por atenção simultaneamente.
- **Negligenciar o pós-prova.** "Prova entregue!" com um check verde é o equivalente emocional de um recibo de compra. O estudante investiu horas de estudo e minutos intensos de prova — o encerramento deveria honrar esse investimento.

### 1.4 Maiores oportunidades

| Oportunidade | Impacto |
|---|---|
| **Ritual de entrada no modo prova** | Transforma um clique em um momento cinematográfico. Muda o frame mental do estudante. |
| **Atmosfera visual coesa e premium** | Eleva percepção de valor instantaneamente. "Isso é diferente de tudo que já vi." |
| **Feedback de seleção de alternativa** | Micro-momento repetido 50+ vezes. Se for satisfatório, permeia toda a experiência. |
| **Timer como aliado, não como ameaça** | Reduz ansiedade. Aumenta sensação de controle. Revoluciona percepção emocional. |
| **Tela de conclusão como celebração** | Última impressão do fluxo. Define se o estudante sai motivado ou exausto. |
| **Navegação repensada como mapa de progresso** | Transforma "grade de quadrados" em visualização inteligente de jornada. |
| **Mobile como experiência nativa** | Se o mobile parecer premium, a percepção de qualidade dobra porque o padrão do mercado é péssimo. |

---

## 2. Princípios de Experiência

### P1 — Foco é sagrado
A interface existe para servir à concentração do estudante, não para impressionar. Cada elemento visual deve justificar sua presença pela contribuição à clareza de leitura e à fluidez de resposta. Remove-se tudo que não serve ao foco.

### P2 — Clareza sem frieza
A interface deve ser limpa e respirada, mas nunca estéril. Há uma diferença entre um hospital e um estúdio de meditação — ambos são limpos, mas um é frio e o outro é acolhedor. Queremos o segundo.

### P3 — Premium é precisão, não decoração
Percepção premium vem de alinhamento perfeito, espaçamento intencional, tipografia impecável, transições fluidas e consistência absoluta. Não vem de gradientes, sombras elaboradas ou efeitos visuais. Menos efeito, mais disciplina.

### P4 — O tempo é aliado
O timer, a barra de progresso, os indicadores — tudo que se refere a tempo deve comunicar "você está no controle" e não "o tempo está acabando". A interface deve reduzir ansiedade temporal, não amplificá-la.

### P5 — Cada interação comunica confiança
Selecionar alternativa, navegar, marcar para revisão, finalizar — cada gesto deve produzir feedback que diga "sua ação foi registrada, tudo está funcionando, você pode seguir em frente".

### P6 — O fluxo tem arco emocional
Preparação → Concentração → Pressão crescente → Decisão final → Conquista. A UI deve acompanhar esse arco com mudanças sutis de intensidade visual, não ficar flat do começo ao fim.

### P7 — Nenhum momento é desperdiçado
Loading, transições, pausas — cada momento que o estudante espera ou transiciona é uma oportunidade de reforçar a atmosfera premium. Nunca um vazio.

### P8 — Adaptação, não compressão
Mobile não é desktop menor. É uma reinterpretação da experiência para um formato íntimo, tátil, com gestos e prioridades diferentes.

---

## 3. Decomposição do Fluxo

### ETAPA 0 — Card do simulado na listagem (`/simulados`)

**Estado atual:** `SimuladoCard` com badge de número, `StatusBadge`, título, datas, score (se completo), CTA.

**Objetivo:** O card deve comunicar, mesmo antes do clique, que esse simulado é algo sério e que vale a pena. Deve criar antecipação, não parecer um item de lista de tarefas.

**Sensação desejada:** "Esse simulado merece minha atenção."

**Problemas:**
- Todos os cards têm a mesma hierarquia visual. O simulado disponível agora compete visualmente com o encerrado há semanas.
- Informações como quantidade de questões e duração não aparecem no card — o estudante não sabe o que espera.
- O badge `#N` no canto é discreto demais para criar identidade do simulado.

**Oportunidades:**
- Diferenciar hierarquia visual por status: o simulado disponível AGORA deve ser o protagonista visual da página.
- Adicionar metadados que gerem confiança: questões, duração, área predominante.
- Criar um "estado hero" para o simulado da vez — não apenas mais um card na grid.
- Indicador sutil de "janela de execução" como senso de urgência elegante (não countdown agressivo, mas contexto temporal).

---

### ETAPA 1 — Página de detalhe do simulado (`/simulados/:id`)

**Estado atual:** `SimuladoDetailPage` com `PremiumCard variant="hero"`, checklist de pré-requisitos, botão "Iniciar Simulado", informações de janela. Fluxo diferente para novatos (checklist obrigatório) e veteranos (resumo + checklist colapsável).

**Objetivo:** Transformar a página de detalhe em uma "sala de briefing" — o momento em que o estudante revisa as condições, se prepara mentalmente e faz a transição de "navegação" para "modo prova".

**Sensação desejada:** "Estou me preparando para algo importante. Sei exatamente o que esperar. Sinto-me pronto."

**Problemas:**
- A checklist parece burocrática, especialmente para veteranos. "Duração da prova", "Sem pausa", "Conexão estável" — são informações óbvias apresentadas com o peso de um formulário.
- O botão "Iniciar Simulado" é primário mas não carrega gravidade proporcional ao que representa (abrir uma prova cronometrada sem pausa).
- O PremiumCard hero é o mesmo componente usado em vários outros contextos — não há linguagem visual exclusiva do "pre-flight".

**Oportunidades:**
- **Tela de briefing cinematográfica.** Em vez de card com checklist, uma tela dedicada que comunica: nome da prova, metadados visuais (ícones, não texto corrido), recomendações de ambiente como dicas contextuais sutis.
- **CTA de peso.** O botão de iniciar deve ter presença visual forte, talvez com um estado de "pronto" que só ativa após o estudante ter visto todas as informações.
- **Micro-ritual.** Uma transição de 1-2s entre o clique em "Iniciar" e o início real da prova, com mudança de atmosfera visual (escurecimento, foco, motion de "entrada").

---

### ETAPA 2 — Transição para o ambiente de prova

**Estado atual:** `navigate('/simulados/${id}/prova')` — é uma navegação de rota normal. A página carrega, entra em fullscreen, mostra skeleton enquanto o attempt é criado/retomado.

**Objetivo:** Criar um "portal" entre o mundo do dashboard e o mundo da prova. Esse momento define a percepção de todo o fluxo.

**Sensação desejada:** "Acabei de entrar em um ambiente completamente diferente. Isso é sério. Estou focado."

**Problemas:**
- A transição é um page load. O estudante vê barras de progresso pulsando, sente um loading comum, e de repente a prova aparece. Nenhum design de transição.
- O fullscreen dispara imediatamente no mount, sem aviso prévio ou contexto. Pode ser brusco.

**Oportunidades:**
- **Tela de preparação dentro da rota `/prova`.** Antes de mostrar a primeira questão, exibir um "modo preparação" com: nome da prova, timer configurado (ex: "3h00"), número de questões, um CTA final "Começar agora" que ativa o timer e a primeira questão.
- **Animação de entrada.** Fade from dark, reveal progressivo dos elementos do ambiente de prova. 600-800ms de motion intencional que comunica "você está entrando em um espaço diferente".
- **Mudança de paleta.** O ambiente de prova pode usar uma variação de temperatura de cor: ligeiramente mais neutro, com menos cromatismo, comunicando concentração e foco. Não precisa ser dark mode — pode ser uma versão mais "quieta" da paleta.

---

### ETAPA 3 — Ambiente principal de resolução de questões

**Estado atual:** Header fixo (título, progresso, timer, botão finalizar) → barra de progresso secundária → main com QuestionDisplay → sidebar desktop com QuestionNavigator → MobileQuestionNav fixo no bottom.

**Objetivo:** O ambiente onde o estudante vai passar a maior parte do tempo. Deve ser absolutamente otimizado para leitura, concentração e fluidez.

**Sensação desejada:** "Consigo ler com clareza. Sei onde estou. Sinto que tenho controle. O tempo não me assusta."

**Problemas detalhados:**

*Header:*
- Título truncado em telas menores (`truncate` + `hidden sm:block`).
- Duas barras de progresso com semânticas diferentes mas aparência similar.
- Timer como `font-mono` com cores que mudam — funcional, mas o `animate-pulse` nos últimos 60s é ansiedade pura.
- "Finalizar" em vermelho destrutivo no header cria tensão visual permanente.

*Área de questão:*
- Tags de área/tema no topo são úteis para contexto mas competem com o número da questão.
- `text-body-lg leading-relaxed whitespace-pre-line` é ok para textos curtos, mas questões de medicina podem ter 3-4 parágrafos densos.
- Imagens com lightbox são boas, mas o tratamento visual `rounded-xl border border-border bg-muted/30` é básico.

*Alternativas:*
- `border-2` cria peso visual excessivo em estado neutro. A alternativa não-selecionada deveria ser mais leve.
- O ícone de eliminar (`Trash2`) aparece em hover desktop e sempre em mobile. Em mobile, o hit area mínimo de 44px é correto, mas o posicionamento `absolute right-3 top-1/2` pode colidir com texto longo da alternativa.
- Estado selecionado: `border-primary bg-primary/5 shadow-md ring-2 ring-primary/20` — funciona mas não é "wow".

*Sidebar:*
- Grid estática sem scroll indication. Com 50+ questões, o grid fica comprimido.
- Legenda no bottom (`Respondida / Para revisão / Alta certeza`) ocupa espaço fixo.

*Mobile:*
- O `pb-14 md:pb-0` no main é um hack para compensar o nav fixo no bottom.
- Scroll horizontal de quadradinhos 28px é funcional mas não elegante.
- Não há gesture support (swipe entre questões).

**Oportunidades:**

*Header reimaginado:*
- Unificar as duas barras de progresso em um único indicador visual coeso.
- Timer integrado como informação contextual, não como elemento principal que gera ansiedade.
- "Finalizar" como ação secundária acessível mas não visualmente dominante.
- Indicador de autosave como elemento de confiança permanente.

*Área de questão como "palco":*
- Sutil tratamento de superfície (não card com borda, mas elevação atmosférica) que separa visualmente a área de leitura do resto.
- Tipografia otimizada para legibilidade em textos longos: line-height mais generoso, inter-parágrafo definido, possível ajuste de `font-feature-settings`.
- Número da questão como elemento de âncora visual forte, não `text-overline` discreto.

*Alternativas com "click feel":*
- Estado neutro mais leve: border sutil ou mesmo sem border, usando background tonal.
- Estado selecionado com feedback forte mas elegante: cor de marca, check visual integrado, micro-animação de 150ms.
- Estado eliminado com tratamento mais sofisticado que opacidade 40%.

*Navegação como visualização:*
- Em vez de grid plana, pensar em faixas ou clusters visuais.
- Indicação clara de "onde estou" vs "onde já passei" vs "onde falta".
- Possível uso de cores mais expressivas para estado de progresso.

---

### ETAPA 4 — Componentes e microinterações durante a prova

**Seleção de alternativa:**
- Atualmente: click → setState → repaint. Sem animação.
- Proposta: micro-transição de 120-180ms com scale sutil (0.98 → 1), background crossfade, e ícone check que aparece no badge da letra. O objetivo não é "animar por animar" — é dar ao clique um "weight" que comunica registro.

**Eliminação de alternativa:**
- Atualmente: strikethrough + opacity 40%.
- Proposta: manter strikethrough mas com transição suave. Alternativa eliminada pode colapsar levemente (não desaparecer, mas reduzir presença visual). Ícone de restaurar como ação de undo clara.

**Navegação entre questões:**
- Atualmente: sem animação. A questão seguinte aparece instantaneamente.
- Proposta: crossfade de 150-200ms. Não slide (que implica direcionalidade e pode causar motion sickness em sessões longas), mas dissolve suave que comunica mudança sem desorientar.

**Marcar para revisão:**
- Atualmente: toggle button que muda cor + toast.
- Proposta: manter toggle visual mas eliminar toast (é interrupção). Feedback pode ser o próprio botão mudando + o indicador no navegador se atualizando em tempo real.

**Timer:**
- Atualmente: `HH:MM:SS` em fonte mono com cores que mudam por faixa.
- Proposta: timer que "respira" — em estado normal é discreto. Nos últimos 15min adquire mais presença sem ser agressivo. Nos últimos 5min, presença forte. Último minuto, urgência clara. Nunca `animate-pulse` — é estressante.

**Autosave:**
- Atualmente: indicador estático "Salvo" com ícone save, sem wiring real ao estado de saving.
- Proposta: Indicador que aparece brevemente quando uma ação é salva, depois retorna ao estado "saved" silencioso. Nunca ausente — a presença do indicador é confiança passiva.

**Progresso:**
- Atualmente: barra horizontal com porcentagem.
- Proposta: informação de progresso que comunica "quanto fiz" e "quanto falta" de forma imediata. Possível integração com o header em vez de barra separada.

---

### ETAPA 5 — Momentos críticos do fluxo

**Sair da prova / confirmar saída:**
- Atualmente: sem interceptação de saída via React Router. O `beforeunload` salva estado mas não previne navegação.
- Proposta: modal de confirmação se tentar navegar fora da prova. Tom calmo, não alarmista: "Sua prova será salva automaticamente. Ao sair, o cronômetro continua."

**Tempo acabando:**
- Atualmente: toast "Tempo esgotado!" + auto-finalize após 2s.
- Proposta: nos últimos 60s, notificação visual integrada (não toast intrusivo) que comunica "últimos segundos" com dignidade. Ao zerar, transição suave para estado finalizado, não "corte seco".

**Última questão:**
- Atualmente: botão "Próxima" vira "Finalizar" com ícone Send.
- Proposta: sinalizar visualmente que é a última questão. Pode ser tão simples quanto "Questão 50 de 50" com destaque sutil, e o CTA "Concluir prova" (não "Finalizar" — linguagem mais positiva).

**Modal de finalização:**
- Atualmente: `SubmitConfirmModal` com grid 2x2 de métricas, alerta de questões em branco com números clicáveis, dois botões. É funcional e bem construído.
- Proposta: manter a estrutura mas elevar o visual. Este é o "momento de decisão" — a interface deve ter gravidade proporcional. Ícone hero mais expressivo, tipografia de destaque, hierarquia visual mais forte entre "continuar" e "finalizar".

**Revisão final:**
- Atualmente: não existe como tela separada. O navegador serve como overview.
- Proposta: antes de finalizar, oferecer uma visualização de "review mode" que mostra um resumo visual de todas as questões (respondida, em branco, marcada). Não é obrigatório, mas é acessível. Reforça sensação de controle.

---

### ETAPA 6 — Tela de conclusão / finalização

**Estado atual:** `ExamCompletedScreen` — ícone check verde spring-animated, "Prova entregue!", badges de resumo, card de data de resultado, toggle de email, CTAs.

**Objetivo:** Fazer o estudante sentir que acabou de realizar algo significativo. Este é o momento de "payoff" emocional de todo o fluxo.

**Sensação desejada:** "Consegui. Isso foi sério. Estou satisfeito. Quero voltar."

**Problemas:**
- A tela é informativa mas emocional como um recibo.
- O ícone check verde é o mesmo padrão de qualquer "success state" da plataforma.
- Badges de "respondidas / alta certeza / revisão" são dados úteis, mas apresentados sem hierarquia emocional.
- O bloco de email notification tem muita proeminência para algo secundário.

**Oportunidades:**
- **Momento de conquista.** Animação de entrada mais elaborada (não apenas fade+spring — talvez particles sutis, ou uma animação tipográfica). O título pode ser mais do que "Prova entregue!" — pode incluir o nome do simulado e um copy mais significativo.
- **Resumo com storytelling.** Em vez de badges soltos, contar uma micro-história: "Você respondeu 48 de 50 questões em 2h37min. 15 com alta certeza. 3 marcadas para revisão."
- **Hierarquia de ações pós-prova.** O CTA principal deveria ser "Ver gabarito" ou "Ver resultado" com presença visual de hero. Ações secundárias (email, voltar) claramente abaixo.
- **Transição do ambiente de prova para o ambiente de conclusão.** Não é só "o conteúdo mudou" — a atmosfera pode mudar: mais respiração, mais leveza, tom mais quente.

---

## 4. Oportunidades de Wow

### Wow 1 — Entrada no Modo Prova (Impacto: Altíssimo)
Quando o estudante confirma "Começar agora", a interface faz uma transição de 800ms: o conteúdo do dashboard dissolve, o fundo escurece levemente, os elementos da prova aparecem em sequência (header → área de questão → alternativas). Comunica "você acabou de entrar em um espaço diferente".

**Por que funciona:** Define expectativa para todo o fluxo. O primeiro momento define o frame mental. Se a entrada for impressionante, o estudante percebe o resto como premium mesmo que os componentes individuais sejam incrementalmente melhores.

### Wow 2 — Feedback Tátil de Seleção (Impacto: Alto, Frequência: Altíssima)
Ao selecionar uma alternativa: micro-scale (0.985 → 1 em 120ms), crossfade de background (80ms), badge da letra faz morphing suave de circle neutro para circle preenchido com check. Elegante, rápido, satisfatório.

**Por que funciona:** Repetido 30-50x por prova. Se cada seleção for microscopicamente satisfatória, a soma é uma experiência fluida e premium.

### Wow 3 — Progresso como Narrativa Visual (Impacto: Alto)
Em vez de barra de progresso genérica, usar uma visualização que mostra o "mapa" da prova no header: sequência de pontos ou marks que se preenchem conforme o estudante avança. Compacto, mas expressivo. Comunica "eu já fiz isso, falta isso" instantaneamente.

**Por que funciona:** Substitui dois indicadores de progresso separados por um elemento visual unificado que conta a história do progresso sem ambiguidade.

### Wow 4 — Timer como Companheiro (Impacto: Alto)
Timer que muda de comportamento ao longo do tempo — não de forma agressiva, mas como mudança de "estado de presença":
- **Início (>30min):** Discreto, background neutro, fonte regular.
- **Metade (<50%):** Mesma posição, talvez uma tipografia com mais peso.
- **Últimos 15min:** Background sutil mais quente.
- **Últimos 5min:** Presença visual clara mas sem pulso.
- **Último minuto:** Urgência, mas com dignidade.

**Por que funciona:** O timer preditivamente indica pressão temporal sem surpreender o estudante. É como um coadjuvante que sussurra, não um alarme que grita.

### Wow 5 — Conclusão Cinematográfica (Impacto: Altíssimo)
Após clicar "Finalizar" e confirmar: breve blackout (300ms), depois fade-in de uma tela de conclusão com tratamento visual de "conquista". Tipografia grande, animação staggered dos elementos de resumo, uma atmosfera que comunica "você fez algo que importa".

**Por que funciona:** Última impressão. O estudante vai lembrar de como se sentiu ao terminar. Se for memorável, a percepção de valor de toda a plataforma sobe.

### Wow 6 — Questão Number como Âncora de Identidade (Impacto: Médio)
O número da questão (`Q.01`, `Q.47`) tratado como elemento tipográfico forte — não `text-overline` discreto, mas com presença visual que dá identidade a cada questão. Talvez em fonte mono ou com peso visual diferenciado.

**Por que funciona:** Dá ao estudante a sensação de "lugar" na prova. "Estou na questão 23" é uma informação de localização que precisa de presença visual proporcional.

### Wow 7 — Transição Suave entre Questões (Impacto: Médio)
CrossFade de 150ms entre questões. O conteúdo antigo dissolve enquanto o novo aparece. Sem slide, sem flip, sem efeito chamativo — apenas continuidade suave que comunica "próxima questão, mesmo ritmo, tudo sob controle".

**Por que funciona:** Remove a sensação de "corte seco" que existe hoje. Cada transição reforça o ritmo da prova.

### Wow 8 — Pre-flight com Dados Ricos (Impacto: Médio-Alto)
A tela de preparação dentro da rota `/prova`, antes de iniciar o timer, pode incluir: nome do simulado em tipografia display, número de questões com ícone, duração com ícone, "dica" contextual (ambiente silencioso, tela cheia, sem pausa), e um CTA "Começar" com gravidade visual. Tudo sem ser burocrático.

**Por que funciona:** Transforma um "loading + navigate" em um momento de preparação intencional. O estudante se sente mais preparado, mais confiante.

---

## 5. Conceitos Visuais

### 5.1 Linguagem de Cores do Ambiente de Prova

O ambiente de prova deve ter sua própria sub-paleta dentro do design system existente. Não é dark mode — é "focus mode".

```
Background:     hsl(210 15% 97%)  // Levemente mais frio que o bg padrão
Surface:        hsl(0 0% 100%)    // Branco puro para área de questão
Muted:          hsl(210 10% 93%)  // Neutro frio para elementos secundários
Border:         hsl(210 10% 88%)  // Bordas sutis
Text primary:   hsl(210 20% 15%)  // Alto contraste sem ser preto puro
Text secondary: hsl(210 10% 45%)  // Texto auxiliar
Primary:        wine (mantém identidade)
```

**Racional:** A leve desaturação e deslocamento para tons frios reduz carga visual e comunica "ambiente de concentração". O wine permanece como cor de marca para elementos interativos (seleção, CTA), criando contraste forte com o fundo neutro.

### 5.2 Materiais e Superfícies

- **Área de questão:** Background branco com sombra interna muito sutil (`inset shadow`), criando a sensação de um "palco" elevado sem precisar de card com borda. Alternativa: sem sombra, apenas o branco puro sobre o background mais frio já cria separação suficiente.
- **Header:** Translúcido com backdrop-blur (`bg-white/90 backdrop-blur-md`). Mais elegante que `bg-card/95 backdrop-blur-sm` atual. A transparência sutil comunica leveza e modernidade.
- **Sidebar de navegação:** Background tonal, não card. Separada por border-left sutil. O conteúdo respira sem estar "encaixotado".
- **Alternativas:** Sem border em estado neutro — apenas background hover sutil. Border aparece apenas no estado selecionado, e com cor de marca. Isso reduz ruído visual drasticamente.
- **Modais:** Overlay com blur forte (não os 4px atuais — 12-16px). Card do modal com sombra generosa. Cria sensação de profundidade real.

### 5.3 Tipografia

Manter Plus Jakarta Sans como base (legível, moderna, profissional).

Para o ambiente de prova, ajustes específicos:
- **Número da questão:** `text-lg font-bold tracking-tight` em wine. Forte, identitário.
- **Texto da questão:** `text-[17px] leading-[1.75] font-normal` — ligeiramente maior que `text-body-lg`, com line-height mais generoso para textos longos.
- **Alternativas:** `text-[15px] leading-[1.6]` — levemente menor que o texto da questão, criando hierarquia.
- **Badge da alternativa (A, B, C, D, E):** `font-mono text-sm font-semibold` — mono reforça o caráter de "opção indexada".
- **Timer:** `font-mono tabular-nums text-base` — mono para estabilidade (números não saltam).
- **Tags (área/tema):** `text-xs font-medium uppercase tracking-wide` — discretas, informativas.

### 5.4 Comportamento de Cards e Containers

**Alternativas sem seleção (estado neutro):**
- Background: `bg-white dark:bg-card` (levemente elevado sobre o bg de prova).
- Border: `border border-transparent` (sem borda visível).
- Hover: `bg-muted/40` (leve highlight).
- Radius: `rounded-xl` (mantém).

**Alternativa selecionada:**
- Background: `bg-primary/[0.04]` (toque sutil de wine).
- Border: `border-2 border-primary` (forte, inequívoco).
- Badge: preenchido com `bg-primary text-primary-foreground`.
- Shadow: `shadow-sm` (micro-elevação).

**Alternativa eliminada:**
- Opacity: `0.35` (mais que 0.4 atual para maior contraste).
- Text: `line-through text-muted-foreground`.
- Badge: `bg-muted/50 text-muted-foreground` (desaturado).

### 5.5 Tratamento do Fundo

- **Ambiente de prova:** Background sólido neutro frio (`hsl(210 15% 97.5%)`). Sem gradientes, sem patterns, sem textura. Limpeza absoluta.
- **Tela de preparação:** Pode ter um gradiente sutil do wine para neutro, comunicando transição de "dashboard" para "foco".
- **Tela de conclusão:** Background que respira mais — talvez voltando ao background padrão da plataforma, comunicando "saída do modo foco" e retorno ao mundo normal.

### 5.6 Uso de Profundidade

Limitado e intencional:
- Header: elevação via `backdrop-blur` (não shadow).
- Área de questão: separação por contraste de background (não elevation).
- Modal de finalizar: profundidade forte (`shadow-2xl` + backdrop blur).
- Alternativa selecionada: micro-elevation (`shadow-sm`).
- Todo o resto: flat. Profundidade é escassa para ser significativa quando aparece.

### 5.7 Linguagem de Ícones

Manter Lucide como biblioteca. Estilo outline consistente, `stroke-width: 1.75` (padrão).

Ícones no ambiente de prova devem ser usados com parcimônia:
- Timer: `Clock` (mantém).
- Navegação: `ChevronLeft`, `ChevronRight` (mantém).
- Revisão: `Flag` (mantém).
- Alta certeza: `Zap` (mantém — reconhecível).
- Eliminar: repensar `Trash2` — conotação de "deletar" é pesada. Proposta: `EyeOff` ou `Minus` para "tirar da vista", `Eye` ou `Plus` para restaurar. Mais leve conceitualmente.
- Concluir: `Check` no botão final (não `Send` — "enviar" é transacional, "concluir" é de conquista).

### 5.8 Visual do Timer e Progresso

**Timer:**
- Integrado ao header, não encaixotado.
- Fonte mono, tamanho moderado (`text-base` ou `text-lg`, não display).
- Cor que evolui por faixas mas sem `animate-pulse`:
  - Normal: `text-foreground/70` (discreto).
  - Atenção (< 15min): `text-foreground` (mais presença).
  - Alerta (< 5min): `text-warning` (quente).
  - Urgência (< 1min): `text-destructive` (vermelho, mas sem pulse).
- Background do timer muda junto: transparente → `bg-warning/5` → `bg-destructive/5`.

**Progresso:**
- Barra única no header (eliminar a segunda barra).
- Ou: substituir barra por sequência de dots/marks que representam as questões (visível em desktop, colapsado em mobile).
- Texto: `{answered}/{total} respondidas` uma única vez, integrado ao header ou à sidebar.

---

## 6. Motion e Microinterações

### 6.1 Princípios de Motion

- **Duração padrão:** 150-200ms para interações (seleção, hover). 400-600ms para transições entre estados (entrar na prova, concluir). 800ms+ apenas para momentos especiais (entrada no modo prova, celebração final).
- **Easing:** `cubic-bezier(0.16, 1, 0.3, 1)` (easeOutExpo) para motion de entrada. `cubic-bezier(0.4, 0, 0.2, 1)` (easeInOut) para transições de estado.
- **Regra de subtração:** Se em dúvida, menos motion é melhor. Durante a prova ativa, qualquer animação acima de 200ms é provavelmente excessiva.
- **`prefers-reduced-motion`:** Respeitar sempre. Em reduced motion: transições instantâneas, sem opacity fade, sem scale — apenas mudanças de estado diretas.

### 6.2 Onde DEVE haver motion

| Momento | Tipo | Duração | Detalhe |
|---|---|---|---|
| Entrada no modo prova | Fade + reveal staggered | 600-800ms | Background crossfade + elementos aparecem em sequência |
| Seleção de alternativa | Scale + color transition | 120-150ms | 0.985 → 1 + background crossfade |
| Transição entre questões | Crossfade | 150-200ms | Opacity 1 → 0 / 0 → 1, sem translate |
| Progresso atualizado | Width transition | 300ms | Barra cresce suavemente |
| Badge no navigator atualizando | Color transition | 200ms | Mudança de estado silenciosa |
| Modal de finalizar abrindo | Scale + overlay | 300ms | 0.95 → 1 + overlay fade |
| Celebração de conclusão | Stagger reveal | 600-800ms | Elementos aparecem em sequência |

### 6.3 Onde NÃO deve haver motion

- **Scroll do conteúdo da questão.** Scroll nativo, sem interceptação.
- **Hover em alternativas.** Apenas `transition-colors` CSS, sem transform.
- **Timer contando.** Números mudam sem animação (tabular nums evita layout shift).
- **Toast/notificações durante a prova.** Idealmente eliminadas. Se necessárias, fade sutil.
- **Navegação lateral/sidebar.** Conteúdo estático, sem animação ao navegar no grid.

### 6.4 Desktop vs Mobile motion

- Desktop: motion mais sutil, distâncias menores (scale 0.985, não 0.95).
- Mobile: motion pode ser mais expressivo para compensar falta de hover. Gestos (swipe) com momentum spring (type: 'spring', damping: 25, stiffness: 300).
- Tablet: herda desktop.

---

## 7. Desktop, Tablet e Mobile

### 7.1 Desktop (>= 1024px)

Layout definitivo:
```
┌─────────────────────────────────────────────────┐
│ [Header: título | progresso visual | timer | ⚙] │
├────────────────────────────────┬────────────────┤
│                                │                │
│     Área de Questão            │  Sidebar       │
│     (max-width ~720px,         │  Navegação     │
│      centrada)                 │  (w-64)        │
│                                │                │
│     [tags] [Q.23]              │  Grid          │
│     Texto da questão...        │  de questões   │
│                                │                │
│     ○ A) ...                   │  Legenda       │
│     ● B) ...  ← selecionada   │                │
│     ○ C) ...                   │                │
│     ○ D) ...                   │                │
│                                │                │
│     [◀ Anterior] [▶ Próxima]   │                │
│                                │                │
└────────────────────────────────┴────────────────┘
```

**Detalhes:**
- Área de questão centrada com `max-w-3xl` mantido (bom para legibilidade).
- Sidebar com width fixo (256px), border-left, background tonal.
- Header com todos os elementos: título, progresso, timer, save indicator, shortcuts tooltip, botão de ação.

### 7.2 Tablet (768px — 1023px)

- **Sidebar some.** Navegação via sheet/drawer acessível por botão.
- **Header simplificado.** Título pode ser abreviado ou omitido; progresso e timer mantidos.
- **Área de questão:** Full width com padding lateral (`px-8`).
- **Botões de ação:** Mantêm tamanho desktop (não reduzir para caber).

### 7.3 Mobile (< 768px)

Layout reimaginado:
```
┌──────────────────────────────┐
│ [Header compacto]            │
│ [timer | Q.23/50 | ⚙]       │
├──────────────────────────────┤
│                              │
│ [tag]  Questão 23            │
│                              │
│ Texto da questão...          │
│                              │
│ ○ A) ...                     │
│ ● B) ...  ← selecionada     │
│ ○ C) ...                     │
│ ○ D) ...                     │
│                              │
│ [☐ Revisar] [⚡ Certeza]     │
│                              │
│ [◀ Anterior] [Próxima ▶]     │
│                              │
├──────────────────────────────┤
│ [1][2][3]...[23]...[50]     │ ← mini-nav scroll
└──────────────────────────────┘
```

**Detalhes:**
- Header compacto com timer + progresso inline.
- Sem title no header mobile (economia de espaço).
- Mini-nav no bottom: manter conceito atual mas elevar visualmente.
  - Pílulas em vez de quadrados (mais táteis).
  - Auto-scroll para current mantido.
  - Tamanho adequado para toque (min 36px).
- **Swipe entre questões** como gesto alternativo (não obrigatório, mas possível via framer-motion `drag`).
- Alternativas com padding adequado para toque (min 48px height).
- Eliminar alternativa via long-press em vez de ícone sobreposto (mais natural em mobile).

### 7.4 O que permanece idêntico em todos os breakpoints

- Hierarquia visual: número da questão → texto → alternativas.
- Estado das alternativas: mesmo sistema de cores.
- Timer: mesma informação, mesma evolução de estados.
- Funcionalidades: marcar revisão, alta certeza, eliminar, navegar.

---

## 8. Estados e Cenários Especiais

### 8.1 Loading / Inicialização

**Atual:** Skeleton genérico.

**Proposta:** Tela de "preparação" com o nome do simulado, um indicador de loading circular sutil (não spinner genérico), e texto "Preparando sua prova..." que comunica progresso sem pressa. Se possível, mostrar informações estáticas (nome, questões, duração) enquanto o attempt é criado.

### 8.2 Erro de carregamento

**Proposta:** Tela com tom empático: "Não conseguimos carregar a prova agora." + botão "Tentar novamente" + "Voltar aos simulados". Sem stack trace, sem código de erro. Se possível, sugerir verificar conexão.

### 8.3 Lentidão / conexão lenta

**Proposta:** Indicador de "Reconectando..." sutil no header (banner fino, não modal). O autosave já usa localStorage como buffer — comunicar isso: "Suas respostas estão salvas localmente."

### 8.4 Queda de conexão

**Proposta:** Banner não-intrusivo: "Sem conexão. Suas respostas continuam sendo salvas localmente e serão sincronizadas quando a conexão voltar." Cor: info, não destructive. Posição: abaixo do header, colapsável.

### 8.5 Autosave

**Proposta:** Indicador no header:
- Estado normal: ícone de check sutil (quase invisível).
- Salvando: ícone pulsa suavemente por 1s.
- Erro de save: ícone + tooltip "Tentando novamente...".
- Nunca bloquear a UI por causa de save.

### 8.6 Retomada do simulado

**Proposta:** Tela intermediária: "Bem-vindo de volta." + resumo do progresso anterior (X respondidas, tempo restante Y) + "Continuar de onde parou". Tom acolhedor, não burocrático. Então abrir na questão onde parou.

### 8.7 Confirmação de saída

**Proposta:** Modal elegante: "Pausar não é possível. O cronômetro continuará. Suas respostas estão salvas." + "Sair mesmo assim" / "Voltar à prova". Tom: informativo, não punitivo.

### 8.8 Tempo acabando

**Proposta (escalonamento):**
- **15 min restantes:** Timer muda para faixa âmbar. Sem notificação.
- **5 min restantes:** Banner sutil no topo: "Restam 5 minutos." Dismiss automático após 5s.
- **1 min restante:** Timer em destaque máximo. Sem banner adicional (o timer já comunica).
- **Tempo zero:** Transição suave para conclusão. Sem toast "Tempo esgotado!" abrupto — o estudante já sabe.

### 8.9 Prova enviada / finalizada

**Proposta:** Transição de 500ms: fade do ambiente de prova → fade-in da tela de conclusão. Sem "Enviando..." prolongado (o modal de confirmação já lidou com isso).

### 8.10 Textos muito extensos

**Proposta:** A área de questão tem `max-w-3xl` que é bom para legibilidade. Para textos que excedem 2 viewports de altura:
- Alternativas ficam "sticky" no bottom da viewport? Não — prejudica leitura do enunciado.
- Manter scroll natural. Quando o estudante scrollar até as alternativas, o header fixo garante acesso ao timer/navegação.
- Possível "scroll to options" como atalho após leitura do enunciado.

### 8.11 Imagens na questão

**Proposta:** Manter lightbox atual mas elevar:
- Imagem com radius elegante, sem border padrão.
- Lightbox com transição de zoom (scale 0.9 → 1, 200ms).
- Pinch-to-zoom no mobile.
- Caption se disponível no banco.

### 8.12 Acessibilidade

**Obrigatórios (já parcialmente implementados):**
- `role="radiogroup"` nas alternativas (existe).
- `aria-checked` nas alternativas (existe).
- `role="timer"` com `aria-live` (existe).
- Focus visible em todos os interativos.
- Keyboard navigation (já implementado via `useKeyboardShortcuts`).

**Melhorias:**
- `aria-label` mais descritivo no navigator de questões.
- Skip link para pular direto às alternativas.
- Anúncio de mudança de questão para screen readers via `aria-live` region.
- Contraste: verificar todos os estados de cor contra WCAG AA.

### 8.13 Navegação por teclado

**Existente:** 1-5 para alternativas, ←→ para navegação, R para revisão, H para certeza, Esc para finalizar.

**Melhorias:**
- Tab entre alternativas (já funciona via button focus).
- Enter para confirmar seleção.
- `?` para abrir help overlay de atalhos.
- Tab para pular para "Próxima questão" sem mouse.

---

## 9. Entrega Priorizada

### Tier 1 — Impacto Imediato, Complexidade Moderada

| Item | Impacto UX | Impacto Premium | Complexidade |
|---|---|---|---|
| **Atmosfera visual da prova** (sub-paleta focus mode, backgrounds, superfícies) | Alto | Altíssimo | Médio |
| **Alternativas redesenhadas** (sem border neutro, feedback de seleção, estados) | Alto | Alto | Baixo-Médio |
| **Header unificado** (uma barra de progresso, timer elegante, save indicator) | Alto | Alto | Médio |
| **Transição entre questões** (crossfade 150ms) | Médio | Alto | Baixo |
| **Timer escalonado** (evolução visual sem animate-pulse) | Alto | Alto | Baixo |
| **Tela de conclusão elevada** (momento de conquista, hierarquia, motion) | Altíssimo | Altíssimo | Médio |

### Tier 2 — Impacto Alto, Complexidade Maior

| Item | Impacto UX | Impacto Premium | Complexidade |
|---|---|---|---|
| **Tela de preparação / pre-flight** (briefing dentro de `/prova`) | Alto | Altíssimo | Médio-Alto |
| **Entrada no modo prova** (transição cinematográfica) | Alto | Altíssimo | Médio-Alto |
| **Navegador de questões reimaginado** (visual, responsive, informativo) | Médio | Alto | Médio |
| **Mobile nav elevada** (pílulas, touch, auto-scroll) | Médio | Alto | Médio |
| **Modal de finalização premium** (gravidade visual, review summary) | Médio | Alto | Médio |

### Tier 3 — Polish e Evolução

| Item | Impacto UX | Impacto Premium | Complexidade |
|---|---|---|---|
| **Swipe entre questões** (mobile gesture) | Médio | Médio | Médio |
| **Estados de conectividade** (offline banner, reconexão) | Médio | Médio | Médio |
| **Retomada com tela intermediária** | Médio | Médio | Baixo |
| **Scroll-to-options** para questões longas | Baixo | Baixo | Baixo |
| **Lightbox melhorado** (zoom, pinch, transition) | Baixo | Médio | Baixo |
| **Acessibilidade extra** (aria-live, skip links) | Médio (ético) | Baixo | Baixo |

### Ordem de execução recomendada

**Fase 1 (Fundação visual):** Atmosfera da prova + alternativas + header unificado + timer escalonado + crossfade entre questões. Resultado: o ambiente já parece "outro produto".

**Fase 2 (Momentos chave):** Tela de conclusão + pre-flight + entrada no modo prova + modal premium. Resultado: o arco emocional está completo.

**Fase 3 (Completude):** Navegador reimaginado + mobile elevado + estados especiais + acessibilidade. Resultado: a experiência é completa em todos os cenários.

---

## 10. Visão Final — A Jornada Ideal

O estudante de medicina abre a plataforma. Na tela de simulados, o simulado disponível hoje tem presença visual forte — não é mais um card em uma grid, é o protagonista da página. Ele vê: nome, área, 50 questões, 3 horas, e sente que esse simulado foi preparado para ele.

Clica no simulado. A página de briefing é limpa, respirada, sofisticada. Vê as condições da prova apresentadas com elegância — não como checklist burocrático, mas como ritual de preparação. "50 questões. 3 horas. Sem pausa. Ambiente silencioso recomendado." Sente-se informado e pronto. Clica em "Começar agora".

A interface muda. O dashboard desaparece. A tela escurece por um instante e depois revela o ambiente de prova — um espaço visual completamente diferente. Mais neutro, mais focado, mais silencioso. O header aparece com o timer, o progresso, o título da prova. A primeira questão surge com elegância. O estudante entende instintivamente: "Estou em modo prova. É sério. É bonito. É feito para eu me concentrar."

Questão 1. Lê o enunciado com conforto — a tipografia é perfeita para textos longos, o contraste é ideal, o espaçamento respeita a carga cognitiva. As alternativas estão abaixo, limpas, sem border visual que polua. Passa o mouse sobre a alternativa B — highlight sutil. Clica. A alternativa se ilumina com a cor de marca, o badge da letra se preenche, um micro-feedback de 120ms confirma: sua escolha foi registrada. Satisfatório.

Questão 5. Não tem certeza. Marca para revisão — o botão muda, o navegador lateral se atualiza silenciosamente. Sem toast interruptivo. Segue em frente.

Questão 23. Metade da prova. O timer está ali, discreto, mostrando 1h37min restantes. Sem ansiedade. No navegador, metade dos pontos estão preenchidos. A sensação é de progresso concreto. O indicador "Salvo" pisca brevemente no header — confiança passiva de que nada será perdido.

Questão 45. Últimos 15 minutos. O timer ganha um tom mais quente, comunicando atenção sem alarme. O estudante percebe, ajusta o ritmo, mas não entra em pânico.

Questão 50. Última. A interface sinaliza sutilmente: "última questão". O botão "Próxima" foi substituído por "Concluir prova". Responde. Clica em concluir.

O modal de finalização aparece com elegância e gravidade. Vê seu resumo: 48 respondidas, 2 em branco (números das questões clicáveis se quiser voltar), 12 com alta certeza, 3 marcadas para revisão. Pode voltar ou finalizar. Está satisfeito. Clica "Finalizar".

A interface faz uma transição suave. O ambiente de prova dissolve. Depois de um breve instante, a tela de conclusão aparece. Uma animação elegante revela o título: seu nome do simulado, "Prova concluída." Não é um ícone de check genérico — é um momento de reconhecimento. O resumo aparece em sequência: "48 de 50 respondidas. 12 com alta certeza." Os próximos passos estão claros: "Ver gabarito" como ação principal, liberação do resultado em tal data, opção de receber email.

O estudante sente: "Isso foi sério. Essa plataforma é séria. Eu fiz algo que importa. Quero voltar."

Essa é a experiência. Não é sobre gradientes elaborados ou glassmorphism. É sobre precisão, atmosfera, ritmo e respeito pelo momento do estudante. Cada pixel serve ao foco. Cada transição comunica intenção. Cada feedback constrói confiança. E o resultado é uma experiência que está, de fato, anos à frente do padrão de mercado.
