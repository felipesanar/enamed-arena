# Sidebar + Home performance — finish

## Implementado

- **DashboardLayout**: coluna fixa com `PremiumSidebar` só quando `!isMobile` (em viewports mobile não monta a sidebar oculta — evita duas instâncias); Sheet só quando `isMobile`; fechamento do drawer na troca de rota; conteúdo principal via `DashboardOutlet`.
- **DashboardOutlet** (novo): `useOutlet` + `AnimatePresence` + `motion.div` com `key={pathname}`, respeita `useReducedMotion`.
- **PremiumSidebar**: `memo` + `contain` e `translateZ(0)` para isolar repaint.
- **NavItem**: removido `backdrop-blur-sm` no estado ativo; fundo/borda ligeiramente mais sólidos.
- **use-mobile**: `useSyncExternalStore` com `matchMedia` (snapshot SSR `false`).
- **HomePagePremium**: chave `ea_home_stagger_done` em `sessionStorage` definida no cleanup do efeito ao sair da home; `initial={false}` no stagger quando já visto na sessão.
- **HomeHeroSection**: subtítulos dos KPI removidos; títulos numa linha com contexto fundido; `aria-label` enriquecido.

## Verificação

- `npx eslint` nos arquivos alterados: OK
- `npm run build`: OK

## Review (severidade)

- **Minor**: Transição do Outlet + animações internas da página podem somar em máquinas lentas — ajustar duração se necessário.
- **Nit**: `memo` na sidebar não bloqueia re-renders por contexto; aceitável.

## Follow-ups opcionais

- Testes E2E de navegação entre rotas autenticadas.
