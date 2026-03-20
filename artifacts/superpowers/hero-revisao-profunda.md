# Revisão profunda da Hero — Plataforma de Simulados

## Diagnóstico

### Problemas identificados
1. **Falta de vida/camada humana** — Hero abstrata, pouca identificação com o aluno de medicina.
2. **Lado direito fraco** — Painel existe mas está solto, pouco integrado à narrativa, não comunica produto real com força.
3. **Composição** — Pouca profundidade, tensão visual e camadas; sem "momento uau".
4. **Conexão com contexto** — Poderia comunicar mais: prova, desempenho, ranking, evolução, análise, preparação, ecossistema SanarFlix Pro.

### Decisões de implementação
- **Camada humana:** Estrutura pronta para mídia (img/vídeo); fallback elegante com gradiente/silueta editorial (sem asset externo frágil).
- **Lado direito:** Composição de produto em camadas: fundo atmosférico + opcional humano → painel principal (resultado, score, posição, acertos, desempenho por área) → cards orbitais (evolução, próximo simulado).
- **Copy:** Headline mais forte e memorável; subheadline mais estratégica; CTAs e quick proof cards com benefício real.
- **Motion:** Stagger de entrada, parallax sutil entre layers, hover premium, sem exagero.
- **Design system:** Tokens existentes (primary, wine, card, border, tipografia), Button asChild, radius e spacing do projeto.

## Arquivos alterados
- `src/components/landing/LandingHero.tsx` — Reescrita da hero (copy, layout, visual direito, motion, responsividade).

## Implementado
- **Copy:** Headline em duas linhas ("Sua performance" / "vira estratégia.") com gradient na segunda; subheadline focada em correção, ranking e análise; CTAs e quick proof cards com ícones (BarChart3, Trophy, TrendingUp) e hover.
- **Lado direito:** (1) Camada de fundo com placeholder humano: `HERO_HUMAN_IMAGE_SRC` em `LandingHero.tsx` — se definido, exibe imagem + gradientes de máscara; senão, fallback com gradiente editorial. (2) Painel principal com resultado do simulado, score/posição/acertos, desempenho por área e próximo simulado. (3) Dois cards orbitais: "Evolução +12%" e "Ranking #42" com motion de entrada.
- **Motion:** Stagger de entrada (eyebrow → headline → subhead → CTAs → cards → visual); parallax suave (useScroll/useTransform) no bloco direito; glow de fundo com animação sutil de opacidade; hover nos cards e botões.
- **Background:** Mais camadas de blur e gradientes com tokens primary/wine-glow; núcleo de luz no fallback humano.
- **Responsividade:** Painel direito só em lg+; mobile com card compacto de resultado + linha de copy sobre desempenho/evolução.

## Verificação
- Build: `npm run build`
- Visual: `/landing` em desktop, tablet e mobile; rolar e conferir parallax e estados.
