# Mobile dashboard shell — conclusão (2026-03-31)

## Implementado

- `src/lib/simuladoBannerScenario.ts`: `deriveScenario`, `getNotificationHref`, `notificationBellDotVisible`.
- `NextSimuladoBanner`: importa a lib; CTA de resultado corrigido para `/simulados/:id/resultado`
- `MobileDashboardHeader.tsx`: menu (sidebar), marca, sino com badge contextual, conta; `env(safe-area-inset-top))`
- `MobileBottomNav.tsx`: cinco itens (Início, Simulados, Desempenho, Ranking, Erros); Ranking abre sheet com links para Ranking e Comparativo; safe-area inferior
- `DashboardLayout.tsx`: header + barra inferior apenas em mobile; padding do `main`; remoção do botão hambúrguer flutuante
- `HomeHeroSection`: grid KPI 2x2 visível abaixo do breakpoint `md` sem histórico (`block md:hidden`)
- `HomePagePremium`: `space-y` e `gap` do mini-gráfico em telas estreitas

## Verificação

- `npm run build` — OK
- `npm run lint` — o projeto já possui erros em outros arquivos; nenhum reportado nos arquivos novos desta entrega

## Review (severidade)

- **Minor:** `MobileBottomNav` usa `md:hidden` na barra — o breakpoint `useIsMobile` é 768px; alinhado.
- **Nit:** Conteúdo longo do header (marca + “Completar perfil”) pode truncar em telas muito estreitas; já há `truncate` onde aplicável.
