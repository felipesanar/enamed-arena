# Landing Page — Plataforma de Simulados

## Entrega

Landing page premium implementada para a Plataforma de Simulados (SanarFlix), com referência visual e interativa ao HTML em `docs/impressionante-landing-page.html`, adaptada ao contexto EdTech/medicina/performance.

## Arquivos criados/alterados

### Novos
- `src/pages/LandingPage.tsx` — Página principal que compõe todas as seções e fundo cinematográfico.
- `src/components/landing/LandingProgressBar.tsx` — Barra de progresso de scroll no topo.
- `src/components/landing/LandingNavbar.tsx` — Navbar fixa com logo, links de âncora e CTAs.
- `src/components/landing/LandingHero.tsx` — Hero com headline, subheadline, CTAs, stats e visual (orb + cards flutuantes).
- `src/components/landing/LandingValueProps.tsx` — Bloco de diferenciais em grid de cards premium.
- `src/components/landing/LandingHowItWorks.tsx` — Jornada do aluno em 6 passos + painel visual.
- `src/components/landing/LandingExperience.tsx` — Experiência do produto (mockup de prova + cards).
- `src/components/landing/LandingComparison.tsx` — Performance, ranking e visão estratégica.
- `src/components/landing/LandingPremium.tsx` — Valor SanarFlix PRO (caderno de erros, etc.).
- `src/components/landing/LandingSocialProof.tsx` — Prova social (depoimento + estatísticas).
- `src/components/landing/LandingCta.tsx` — CTA final “Participe do próximo simulado”.
- `src/components/landing/LandingFooter.tsx` — Rodapé com links e marca.

### Alterados
- `src/App.tsx` — Rota pública `/landing` → `LandingPage` e import de `LandingPage`.
- `src/components/ProtectedRoute.tsx` — Quando `!user` e `pathname === '/'`, redireciona para `/landing` em vez de `/login`.
- `src/pages/LoginPage.tsx` — Link “Conhecer a plataforma de simulados” para `/landing`.

## Estrutura da landing

1. **Navbar fixa** — Logo SanarFlix Simulados, links de scroll (Diferenciais, Como funciona, Experiência, Performance, PRO), “Entrar” e “Participar do simulado” → `/login`.
2. **Hero** — Headline (“O simulado deixou de ser só prova. Agora é performance.”), subheadline, dois CTAs, três stat-chips (correção detalhada, ranking, evolução) e visual com “orb” em gradiente + HUD + cards de score/posição/acertos.
3. **Diferenciais** — 7 cards (experiência de prova, métricas, ranking, análise pós-prova, evolução, integração Sanar, caderno de erros).
4. **Como funciona** — 6 passos (cadastro → escolha → prova → desempenho → comparar → revisar) + painel lateral “Fluxo guiado”.
5. **Experiência** — Mockup de tela de simulado ao vivo + 4 cards (desempenho por área, ranking, correção comentada, comparativo).
6. **Performance** — 3 cards (ranking/percentil, desempenho por tema, visão estratégica) + frase de fechamento.
7. **Premium/PRO** — 4 benefícios PRO + CTA “Conhecer SanarFlix PRO”.
8. **Prova social** — Depoimento + 3 estatísticas placeholder + selos ecossistema Sanar.
9. **CTA final** — Card em destaque “Participe do próximo simulado” + dois botões (Quero participar / Já tenho conta).
10. **Footer** — Logo, links de âncora, Entrar, copy.

## Decisões visuais e interativas

- **Fundo** — Escuro cinematográfico (`#05050d` → `#070915`) com gradientes radiais (violeta, rosa, ciano, dourado) e grid sutil com mask radial, inspirado na referência.
- **Paleta** — Azul/violeta premium (`#6b7fff`, `#8b5cf6`, `#a855f7`), ciano (`#22d3ee`), branco quente e off-white; contraste alto.
- **Glassmorphism** — Navbar e cards com `backdrop-blur`, bordas `white/10`, fundos semi-transparentes.
- **Tipografia** — Headlines grandes e tracking tight; gradiente em texto no hero; kickers em uppercase com linha em gradiente.
- **Motion** — Framer Motion: `initial`/`animate` no hero; `whileInView` com `viewport={{ once: true }}` nas seções; stagger nos grids; barra de progresso ligada ao scroll.
- **Navbar** — Link ativo por seção via `IntersectionObserver`; menu mobile com lista de âncoras; CTAs destacados.
- **Elemento “wow”** — Hero visual com “orb” (gradiente radial + borda + sombra) e cards flutuantes (HUD, pills “Ao vivo”/“Ranking”, blocos Score/Posição/Acertos) sem Three.js para manter o bundle enxuto.
- **Scroll** — `scrollIntoView({ behavior: 'smooth' })` nos links da navbar; barra de progresso no topo com gradiente.

## O que foi herdado da referência e o que foi adaptado

- **Herdado (conceito)** — Hero impactante com gradiente no texto; navbar fixa arredondada com blur e borda; barra de progresso de scroll; seções com kicker + título + cópia; cards translúcidos com borda e glow; orb/cena central no hero; ritmo de seções e hierarquia forte; motion de entrada (reveal on scroll); paleta escura com acentos violeta/azul/ciano.
- **Adaptado** — Conteúdo 100% focado em Plataforma de Simulados (performance, ranking, correção, caderno de erros, SanarFlix PRO); copy em português e tom premium EdTech; sem Three.js (orb em CSS); sem Lenis/GSAP (scroll nativo + Framer Motion); identidade “SanarFlix Simulados” e CTAs para `/login` e participação; estrutura de seções conforme escopo (diferenciais, como funciona, experiência, performance, PRO, prova social, CTA final).

## Como verificar

- Acessar `/landing` para ver a landing completa.
- Acessar `/` sem estar logado: deve redirecionar para `/landing`.
- Na landing: clicar nos links da navbar e ver o scroll suave até as seções; verificar responsividade (mobile/desktop).
- Na tela de login: link “Conhecer a plataforma de simulados” deve levar a `/landing`.
- Comandos: `npm run build` e `npm run dev` (abrir `http://localhost:5173/landing`).
