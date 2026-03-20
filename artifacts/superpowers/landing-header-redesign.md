# Redesenho do header / above the fold — Landing Plataforma de Simulados

## Problemas encontrados no header anterior

### 1. Navbar mal posicionada
- A navbar usava `left-1/2 -translate-x-1/2` com largura `min(100%-28px, 1280px)`, resultando em uma cápsula flutuante centrada sem vínculo claro com o conteúdo.
- O conteúdo interno (logo, links, CTAs) não seguia o mesmo grid do hero: o hero usava `max-w-[1280px] mx-auto px-4 md:px-6`, e a nav tinha apenas a barra centrada, o que em alguns viewports gerava sensação de deslocamento (ex.: “totalmente pra direita” quando o conteúdo interno não alinhava com o bloco abaixo).
- Não havia integração arquitetural: a barra parecia “por cima” do layout, e não parte da estrutura da página.

### 2. Baixo impacto visual
- O topo não gerava um “momento uau”: glows genéricos, headline boa mas sem gesto compositivo forte, e painel visual (orb + cards) um pouco abstrato demais.
- Faltava hierarquia clara e presença de marca (selo/eyebrow pouco destacado, CTAs sem peso suficiente).

### 3. Motion / transições fracas
- Entrada da navbar (y: -16, opacity) e do hero com delays simples; sem coreografia entre navbar e hero.
- Sem distinção clara entre estado inicial e estado após scroll na navbar.
- Hovers nos botões e cards básicos; sem refinamento de duração/easing.

### 4. Copys
- Headline “O simulado deixou de ser só prova. Agora é performance.” — boa direção, mas podia ser mais afiada e memorável.
- Subheadline longa e um pouco genérica; CTAs “Participar do próximo simulado” e “Ver diferenciais” poderiam ter mais intenção e peso.

### 5. Composição do hero
- Proporção texto vs visual ok, mas o elemento direito (orb + HUD) parecia mais decorativo do que “produto”: pouco ligado à ideia de performance, ranking e resultado.
- Cards de apoio sem hover ou microinteração; pouco respiro e profundidade.

---

## Decisões do redesenho

### Navbar

- **Arquitetura:** Navbar em faixa **full-width** (edge to edge), com **conteúdo interno** em container fixo `max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8` — **o mesmo do hero**. Assim, logo, links e CTAs ficam sempre alinhados ao grid do conteúdo e o problema de “deslocamento” some.
- **Altura:** `minHeight: 80px` para presença e respiro; alinhamento vertical com `py-4` no link do logo.
- **Estados ao scroll:**
  - **Inicial:** fundo quase transparente (`bg-card/0.06`), sem borda inferior, sem sombra.
  - **Após scroll:** fundo sólido (`bg-card/0.92`), `backdrop-blur(20px)`, borda inferior e sombra forte. Transição com `duration: 0.4` e easing `[0.32, 0.72, 0.2, 1]`.
- **Link ativo:** Indicador com `layoutId="nav-active"` (Framer Motion) para transição suave entre seções; fundo `bg-primary/10` e texto `text-primary`.
- **Botões:** CTA principal com sombra em primary e hover com leve `-translate-y`; secundário ghost com hover em `bg-primary/10`. Transições de 300ms.
- **Mobile:** Overlay escuro + painel que desce do topo (`top: 80px`), com `AnimatePresence` para entrada/saída suave.

### Hero

- **Container:** Mesmo `max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8` da navbar; `paddingTop: NAV_HEIGHT + 48` para o conteúdo começar logo abaixo da barra, sem colisão.
- **Grid:** `lg:grid-cols-[1.08fr_0.92fr]`, `gap-12 lg:gap-16` — mais espaço para o texto e relação mais clara com o painel.
- **Background:** Camadas de profundidade com gradiente superior (`from-primary/8`) e glows em primary/wine-glow em posições definidas; blur maior (80px/70px) para sensação mais cinematográfica.

### Copy

- **Eyebrow:** “Ecossistema SanarFlix · Simulados de alto nível” + ponto com leve animação (ping) para destaque.
- **Headline:** “Onde sua performance vira estratégia.” — mais direta, aspiracional e memorável; segunda parte em `text-gradient-wine`.
- **Subheadline:** Foco em correção detalhada, ranking por especialidade e “análise que mostra exatamente onde você está — e o que revisar antes da próxima prova” para valor concreto e tom premium.
- **CTAs:** “Quero participar do próximo simulado” (principal) e “Ver como funciona” (secundário, âncora para #como-funciona).
- **Cards de apoio:** Títulos “Correção por área”, “Ranking em tempo real”, “Evolução entre provas” com subtítulos mais precisos; ícones (TrendingUp, Trophy, Target) para leitura rápida.

### Painel visual

- **Conceito:** De “orb abstrato” para **painel de resultado de simulado**: “Resultado do simulado · Clínica Médica · 120 questões”, status “Concluído”, blocos Score / Posição / Acertos com subtítulos (“acima da média”, “entre 2.4k”, “por área”), e dois cards “Desempenho por área” e “Próximo simulado”.
- **Estilo:** Bordas, fundos e tipografia com tokens do sistema (card, border, primary, muted-foreground); luz interna com gradientes primary/wine-glow para profundidade; sombra forte para destacar o painel.
- **Mobile:** Versão compacta do mesmo painel (só score, posição, acertos) abaixo do bloco de copy, sem orb.

### Motion

- **Navbar:** Entrada com `y: -24`, `opacity: 0` → `0, 1` em 0.6s com easing `[0.32, 0.72, 0.2, 1]`.
- **Hero:** Stagger definido (eyebrow 0.12s, headline 0.22s, subhead 0.38s, CTAs 0.52s, cards 0.64s, visual 0.28s); durações entre 0.5s e 0.75s; mesmo easing.
- **Painel:** Entrada com `opacity`, `scale: 0.96` e `y: 24` para sensação de profundidade.
- **Cards de apoio:** `whileHover={{ y: -2 }}` com transição 0.2s para microinteração sem exagero.
- **Botões:** Hover com `-translate-y-0.5` e reforço de sombra; `active:translate-y-0` para feedback tátil.

---

## Arquivos alterados

| Arquivo | Alterações |
|--------|------------|
| `src/components/landing/LandingNavbar.tsx` | Navbar full-width com container alinhado ao hero; estados inicial/scrolled com motion; link ativo com layoutId; overlay + painel mobile com AnimatePresence; CTAs e logo com hovers refinados. |
| `src/components/landing/LandingHero.tsx` | Mesmo container da navbar; nova copy (headline, subheadline, eyebrow, CTAs); grid 1.08/0.92 e gaps maiores; painel de “Resultado do simulado” no lugar do orb; stagger e durações de motion padronizados; cards com ícones e hover; versão mobile do painel. |

---

## Melhorias em resumo

- **Posicionamento:** Navbar integrada ao layout com container único (max-width + padding) para logo, links e hero, eliminando deslocamento e sensação de “cápsula solta”.
- **Impacto:** Headline mais forte, painel de resultado ligado ao produto, glows e profundidade mais definidos, CTAs com mais peso visual.
- **Copy:** Headline e subheadline mais aspiracionais e precisas; CTAs e labels dos cards com intenção clara e tom premium.
- **Composição:** Proporção e espaçamento revisados; painel visual lê como “performance/resultado” e reforça a proposta da plataforma.
- **Motion:** Entrada da navbar e do hero coreografadas (stagger, easing único); estado scrolled da navbar com transição de fundo/blur/sombra; hovers e link ativo com transições curtas e consistentes.
- **Branding:** Uso de primary/wine, tipografia e tokens do sistema; painel e cards alinhados à identidade SanarFlix Pro e à ideia de alto nível/performance.

---

## Responsividade

- **Desktop:** Navbar full-width com conteúdo centralizado; hero em duas colunas; painel completo à direita.
- **Tablet:** Mesmo container; em breakpoint lg o painel some e o bloco de copy ocupa toda a largura; versão mobile do painel aparece abaixo.
- **Mobile:** Navbar com menu hamburger e painel dropdown; hero em coluna única; painel compacto (score/posição/acertos) abaixo dos CTAs; headline com tamanhos responsivos (`text-[2.75rem]` até `xl:text-[4.75rem]`) para não quebrar feio.
