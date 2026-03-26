# Home Page — Curadoria de informações e CTAs

## Visão geral

Redesenhar a `HomePagePremium` para ser uma home enxuta mas completa, com blocos de informação de alto valor e CTAs claros. A estrutura será:

```text
┌─────────────────────────────────────────────┐
│  1. Boas-vindas + Último Simulado (já existe│
├─────────────────────────────────────────────┤
│  2. Banner ou card lado a lado Próximo Simulado (já existe)
├──────────────────────┬──────────────────────┤
│  3. Ações Rápidas    │  4. Ranking Express  │
│  (2 cards compactos) │  (mini resumo)       │
├──────────────────────┴──────────────────────┤
│  5. Upgrade Banner (não-PRO, já existe)     │
└─────────────────────────────────────────────┘
```

## Blocos novos a adicionar

### Bloco 3 — Quick Actions (compacto, 2 cards lado a lado)

Dois `QuickActionCard` inline, diretos:

- **Calendário de Simulados** → `/simulados` — "Veja as próximas janelas e planeje sua rotina."
- **Caderno de Erros** → `/caderno-erros` — "Revise seus erros e acelere sua evolução."

Esses dois CTAs já existem no hero, mas tê-los como cards visuais abaixo dá acesso imediato e visual. Remover os botões duplicados do hero e deixar lá apenas a saudação + resumo do último simulado.

### Bloco 4 — Ranking Express (card compacto)

Um `SurfaceCard` pequeno mostrando:

- Posição geral atual (ou "Realize um simulado para entrar no ranking")
- Especialidade + instituição alvo do usuário
- CTA: "Ver ranking completo" → `/ranking`

Isso puxa dados do `useRanking` hook que já existe.

## Alterações em componentes existentes

### `HomeHeroSection.tsx`

- Remover os dois `PremiumLink` (calendário e caderno de erros) do card de boas-vindas — eles migram para os Quick Actions abaixo.
- Manter saudação + contagem de simulados realizados.
- No card "Último simulado", manter nota/ranking/área destaque como está.

### `HomePagePremium.tsx`

- Após o hero, adicionar seção com grid `lg:grid-cols-3`:
  - Col 1: QuickActionCard (Calendário)
  - Col 2: QuickActionCard (Caderno de Erros)
  - Col 3: RankingExpressCard (novo componente)
- Manter UpgradeBanner no final para não-PRO.

## Novo componente

### `src/components/premium/home/RankingExpressCard.tsx`

- Usa `useRanking()` para pegar posição atual
- Usa `useUser()` para mostrar especialidade/instituição
- Empty state: "Realize um simulado para aparecer no ranking"
- Com dados: posição, especialidade, CTA "Ver ranking"

## Arquivos editados


| Arquivo                                              | Mudança                                          |
| ---------------------------------------------------- | ------------------------------------------------ |
| `src/components/premium/home/HomePagePremium.tsx`    | Adicionar grid de Quick Actions + RankingExpress |
| `src/components/premium/home/HomeHeroSection.tsx`    | Remover CTAs duplicados, manter saudação limpa   |
| `src/components/premium/home/RankingExpressCard.tsx` | **Criar** — card compacto de ranking             |


## Resultado

Home com 4-5 blocos no máximo, cada um com propósito claro: informar sobre o próximo simulado, dar boas-vindas com resumo de performance, oferecer 2 ações rápidas principais, mostrar posição no ranking, e (se aplicável) upsell para PRO.