# Remover header mobile e consolidar na navbar

## Objetivo
Eliminar o `MobileDashboardHeader` (que está visualmente ruim) e reposicionar tudo que ele continha na bottom nav, ganhando altura útil de tela. Manter a conversão PRO para visitantes.

## 1. Remover o header mobile
- Em `DashboardLayout.tsx`: remover o render de `<MobileDashboardHeader />` e seu import.
- Deletar o arquivo `src/components/premium/MobileDashboardHeader.tsx`.
- Recalcular o padding do `<main>` mobile:
  - **Topo:** passa a ser só `env(safe-area-inset-top)` + um respiro pequeno (sem mais a altura do header).
  - **Base:** altura da nav + barra de upsell (quando visitante).
- Limpar/ajustar as constantes `MOBILE_HEADER_H` / `MOBILE_UPSELL_H`.

## 2. Novo botão "Conta" na bottom nav (6º item)
Em `MobileBottomNav.tsx`, adicionar um item "Conta":
- Avatar circular com a inicial do usuário (mesmo estilo do antigo header), com **ponto de notificação** quando houver alerta (`notificationBellDotVisible`).
- Ao tocar, abre um **sheet inferior "Conta"** contendo, nesta ordem:
  1. (Visitante) Card de upsell PRO mais descritivo no topo — reforço de conversão, já que quem abre o menu é o público-alvo.
  2. Central de notificações (a mesma lógica `deriveScenario` + `getNotificationHubContent`, com atalho contextual + links Simulados/Ranking).
  3. Alternância de tema (`ThemeToggle`).
  4. Link "Conta e configurações" (`/configuracoes`).
  5. (Se perfil incompleto) Link "Completar perfil".

## 3. Upsell PRO (visitante) — abordagem dupla para manter conversão
- **Barra fina fixa acima da nav** (~40px, fundo wine/`bg-primary`, ícone + "Desbloquear PRO ENAMED" + seta), só para visitantes, abrindo `SANARFLIX_PRO_ENAMED_URL` em nova aba. Mantém o CTA sempre visível sem o header pesado.
- **Reforço dentro do sheet "Conta"** (card maior e descritivo), conforme item 2.

## Layout final (mobile)
```text
┌─────────────────────────────┐
│      conteúdo da página       │  ← começa logo abaixo da status bar
├─────────────────────────────┤
│ ✦ Desbloquear PRO ENAMED  →  │  ← barra fina (somente visitante)
├─────────────────────────────┤
│ Início Simul. Desemp. Rank.  │
│ Erros               [A]•      │  ← "Conta" com ponto de alerta
└─────────────────────────────┘
```
Desktop permanece inalterado. A marca "PRO: ENAMED" deixa de aparecer no topo mobile (comportamento esperado de app shell).

## Detalhes técnicos
- `MobileBottomNav.tsx`: importar `useUser`, `useHasAccess` (já existe), `useSimulados`, `ThemeToggle`, `deriveScenario`/`notificationBellDotVisible`/`getNotificationHubContent` (mover esse helper do header para cá ou para `simuladoBannerScenario.ts`), `SANARFLIX_PRO_ENAMED_URL`, `trackEvent`. Adicionar o item "Conta", o sheet de conta e a barra de upsell renderizada acima do `<nav>`.
- `getNotificationHubContent` e `formatDateShort` vivem hoje dentro do header; serão movidos para o `MobileBottomNav` (ou extraídos para `simuladoBannerScenario.ts`) antes de deletar o header.
- `DashboardLayout.tsx`: remover bloco do header, recalcular `pt`/`pb` do `<main>`, ajustar constantes. A barra de upsell vira parte do `MobileBottomNav`, então o `pb` quando `isGuestMobile` deve somar a altura dessa barra.
- Eventos de analytics (`upsell_clicked`, `ranking_viewed`) preservados nas novas posições.
- Validação: `browser--view_preview` em viewport mobile (375px) como visitante e como aluno, conferindo padding, ponto de alerta, sheet e barra de upsell.
