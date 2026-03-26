# Hero — card “Resultado do simulado” (redesign cinematográfico)

## Arquivo alterado
- `src/components/landing/LandingHero.tsx`

## O que mudou (estrutura)
- **Shell 3D:** wrapper com `[perspective:1400px]` (desligado em `max-lg` para evitar artefatos em telas pequenas).
- **`motion.div`** com `transformStyle: preserve-3d`, `whileHover` leve (`rotateX` / `rotateY` ~1.2°), **desativado** se `prefers-reduced-motion`.
- **Camadas absolutas (de trás para frente):** plano base em gradiente HSL profundo; halos radiais (primary no topo, wine no rodapé); sweep lateral sutil; highlight de 1px no topo; sombras internas + vinheta inferior.
- **Conteúdo** permanece em `relative` acima das camadas (legibilidade).
- **Métricas:** painéis com gradiente escuro, borda clara baixa, sombra externa + inset highlight + “poço” inferior.
- **Análise SanarFlix:** prop `cinematic` em `HeroAiInsight` — gradiente dedicado, halos radiais, sem glass genérico.
- **Blocos inferiores:** primário com gradiente primary + sombra elevada; secundário mais **recuado** (inset shadow dominante).

## Desktop vs mobile
- **Desktop:** perspectiva + hover 3D suave; sombras mais longas perceptíveis.
- **Mobile:** `max-lg:[perspective:none]`; hover pouco relevante (toque); mesmo tratamento de luz/camadas, sem animação extra; reduced motion respeitado globalmente no hover.

## Recursos que criam profundidade
- Sombras em **camadas** (lift + contato + borda luminosa).
- **Inset** shadows para superfície “côncava” e vinheta.
- **Gradientes radiais** localizados (bloom controlado).
- **Hierarquia:** base → métricas elevadas → análise (camada de destaque) → rodapé em dois planos (elevado vs recuado).
