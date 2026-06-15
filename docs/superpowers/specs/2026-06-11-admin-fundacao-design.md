# Admin — Fundação (Fase 1 do programa "Central de Gestão")

**Data:** 2026-06-11
**Status:** aprovado em brainstorming (decisões validadas com Felipe)

## Contexto

O `/admin` será transformado na central completa de gestão da plataforma, usada por todo o time. O programa tem fases:

1. **Fundação** (esta spec): shell novo, tema control-room dual, paleta de comandos, roles granulares, saneamento de débitos.
2. **Inteligência de dados** (futura): cohorts, cruzamentos, alertas reais, insights automáticos.
3. **Capacidades de gestão** (futura): edição inline de questões, gestão de janelas, comunicação com usuários, audit log.

A Fase 1 usa **evolução in-place**: o admin atual (~4k linhas, arquitetura RPC → React Query → componentes, 6 suítes de teste) é evoluído, não reescrito. Cada commit deixa o admin utilizável.

## Decisões validadas

- **Navegação:** sidebar fixa com grupos sempre visíveis, colapsável para rail (estilo Stripe/Linear). Substitui o rail+flyout atual.
- **Estética:** control room **dark-first** com wine como assinatura, mesclado com a finura editorial do estilo claro (hairlines, papel quente, tipografia calma). Modo claro é cidadão de primeira classe — cada token definido em par.
- **Alcance:** shell novo + as 13 páginas existentes adaptadas (herdam tema e componentes novos). Redesigns internos profundos ficam para as fases 2/3.
- **Roles granulares já na fundação**, com enforcement no banco (RLS + RPCs), migrations aplicadas direto no projeto principal de forma aditiva e retrocompatível.
- **Perfis do time:** Conteúdo/Médico, Produto/Analítico, Suporte/Operação, Marketing/Growth.

## 1. Arquitetura de informação e shell

### Sidebar (`AdminSidebar`, novo)

Substitui `AdminRail` + `AdminFlyout` (ambos removidos, junto com a lógica de fases `live/p0/p1`).

Grupos e itens (rotas atuais mantidas — renomeações são só de label):

| Grupo | Item | Rota | Capability |
|---|---|---|---|
| Visão | Dashboard | `/admin` | `dashboard.view` |
| Gestão | Simulados | `/admin/simulados` | `content.manage` |
| Gestão | Usuários | `/admin/usuarios` | `users.view` |
| Gestão | Tentativas | `/admin/tentativas` | `attempts.view` |
| Inteligência | Jornada | `/admin/analytics` | `intel.view` |
| Inteligência | Aquisição | `/admin/marketing` | `intel.view` |
| Inteligência | Produto | `/admin/produto` | `intel.view` |
| Ferramentas | Previews | `/admin/previews` (nova) | `previews.view` |

Comportamento:

- Largura 232px expandida; colapsa para rail de 56px (só ícones + tooltip) via chevron no rodapé ou `Ctrl+B`. Preferência persiste em `localStorage` (`admin.sidebar.collapsed`).
- Item ativo: trilho wine de 2px à esquerda + fundo tingido (`bg-admin-accent/10`).
- Grupos cujos itens o role não permite **não aparecem** (filtro por capability).
- Topo: logo + campo "Buscar… ⌘K" que abre a paleta de comandos.
- Rodapé: avatar/nome/role do usuário + botão sair + chevron de colapso.

### Página Previews (`AdminPreviews`, nova)

Reúne os previews soltos em uma página com 3 abas:

- **Ranking** — conteúdo do atual `AdminRankingPreviewPage`.
- **Desempenho** — seletor de simulado + conteúdo do atual `AdminDesempenhoPreviewPage`.
- **Correção** — seletor de simulado que navega para a rota existente `/admin/preview/simulados/:id/correcao` (sem embed).

Rotas antigas (`/admin/ranking-preview`, `/admin/preview/simulados/:id/*`) continuam funcionando (a primeira redireciona para `/admin/previews`; as per-simulado permanecem, acessadas também a partir do contexto do simulado).

### Topbar (`AdminTopbar`, reformulada)

Enxuta (~44px): breadcrumb (grupo › página), toggle de tema, sino de notificações **placeholder** (desabilitado com tooltip "em breve" — alertas reais são Fase 2). Avatar sai da topbar (vive no rodapé da sidebar).

### Mobile

Mantém o comportamento atual: aviso de desktop-only. Sem investimento responsivo na Fase 1.

## 2. Sistema de tema (tokens `--admin-*`)

### Princípios

- Namespace próprio `--admin-*`, definido globalmente em `:root`/`.dark` (Dialog/Popover/Select do Radix portalam para `document.body`, fora de qualquer wrapper do admin — tokens escopados quebrariam nos portais). O namespace garante que nada vaza para a plataforma do aluno; a classe `.admin-root` (aplicada pelo `AdminApp`) carrega só a base de bg/texto/`tabular-nums`.
- Tokens em **canais HSL** (`--admin-surface: 210 9% 10%`) mapeados no Tailwind com `<alpha-value>` — `bg-admin-accent/20` funciona (evita o gotcha do Tailwind v3 com opacity sobre `var()`).
- Dual de primeira classe: cada token tem par light/dark definido explicitamente na mesma tabela. O toggle continua sendo o `next-themes` global (`.dark` no `<html>`).

### Tabela de tokens (valores iniciais; ajuste fino na implementação)

| Token | Light (papel quente) | Dark (control room) |
|---|---|---|
| `bg` | `40 20% 97%` | `210 10% 7%` |
| `surface` | `0 0% 100%` | `210 9% 10%` |
| `surface-raised` | `40 15% 99%` | `210 8% 13%` |
| `line` (hairline) | `40 10% 88%` | `210 8% 16%` |
| `line-strong` | `40 8% 78%` | `210 8% 24%` |
| `text` | `220 15% 12%` | `210 14% 95%` |
| `text-muted` | `220 8% 42%` | `210 8% 64%` |
| `text-faint` | `220 6% 60%` | `210 6% 46%` |
| `accent` (wine) | `345 65% 42%` | `345 72% 58%` |
| `accent-soft` | `345 45% 94%` | `345 40% 16%` |
| `success` | `160 60% 32%` | `160 50% 56%` |
| `warning` | `35 85% 40%` | `38 90% 60%` |
| `info` | `210 70% 45%` | `210 75% 65%` |
| `destructive` | `0 70% 45%` | `0 70% 62%` |

Tailwind: cores expostas como `admin.bg`, `admin.surface`, `admin.raised`, `admin.line`, `admin.line-strong`, `admin.text`, `admin.muted`, `admin.faint`, `admin.accent`, `admin.accent-soft` + semânticos, todas com `<alpha-value>`.

### Gráficos e tipografia

- `adminChartTheme.ts` passa a ler exclusivamente tokens `--admin-*`; paleta de séries por tema (wine, teal, âmbar, azul, roxo — saturações distintas em light/dark).
- Números em `tabular-nums` (KPIs, tabelas, deltas).
- Fonte continua Plus Jakarta Sans; escala densa existente (`text-kpi`, `text-caption`, etc.) é mantida.

### Componentes que consomem o tema

`AdminPanel`, `AdminStatCard`, `AdminDataTable`, `AdminSectionHeader`, `AdminTrendChart`, `AdminFunnelChart`, `AdminLivePanel` migram para tokens `--admin-*`. É por isso que as 13 páginas mudam de cara sem redesign interno.

## 3. Paleta de comandos (`AdminCommandPalette`)

Construída sobre `cmdk` + shadcn `Command` (já no projeto), em Dialog estilizado com tokens admin.

### Camadas de resultado (nesta ordem)

1. **Navegação** — todas as páginas com fuzzy match; filtradas por capability.
2. **Entidades** — com 2+ caracteres, busca assíncrona (debounce 250ms) via RPC nova `admin_quick_search(p_query)` → top 5 usuários (nome/e-mail) + top 5 simulados (título), uma viagem só, autorização no servidor. Enter navega ao detalhe.
3. **Ações** — "Criar simulado", "Enviar questões (upload)", "Alternar tema", "Colapsar sidebar". Cada ação declara capability.

### Arquitetura

- Registry declarativo em `src/admin/lib/commandRegistry.ts`: `{ id, label, icon, group, capability, keywords, route | action }`. Fases futuras só registram entradas.
- Hook `useAdminCommands()` filtra por capability e injeta resultados de entidade.
- Query vazia → 5 últimos itens visitados (`localStorage`, `admin.recents`) + ações principais.
- Abre por `Ctrl/⌘+K` ou clique no campo da sidebar; estados de loading/vazio/erro desenhados.

## 4. Roles e permissões

### Modelo

Roles → capabilities. Capabilities são a unidade de checagem (banco e UI); roles são o que se atribui a pessoas.

Capabilities: `dashboard.view`, `content.manage`, `users.view`, `users.manage`, `attempts.view`, `attempts.manage`, `intel.view`, `previews.view`, `roles.manage`.

| Role | Capabilities |
|---|---|
| `admin` | todas |
| `content_editor` | `dashboard.view`, `content.manage`, `previews.view`, `attempts.view` |
| `support` | `dashboard.view`, `users.view`, `users.manage`, `attempts.view`, `attempts.manage` |
| `analyst` | `dashboard.view`, `intel.view`, `previews.view` |

### Migrations (aditivas, nesta ordem)

1. **Enum:** `ALTER TYPE app_role ADD VALUE` × 3 (`content_editor`, `support`, `analyst`) — migration isolada (valores de enum precisam de commit antes do uso).
2. **Infra de capabilities:** tabela `role_capabilities(role app_role, capability text, primary key(role, capability))` + seed conforme tabela acima; funções `has_capability(p_capability text) returns boolean` (STABLE, SECURITY DEFINER, baseada em `auth.uid()`), `admin_require(p_capability text)` (raise `unauthorized` / errcode `P0003` — mesmo contrato de erro atual); RPCs novas `admin_get_access()` (roles + capabilities do usuário atual) e `admin_quick_search(p_query text)` (requer qualquer acesso admin; respeita capabilities nos tipos retornados: usuários exigem `users.view`, simulados `content.manage`).
3. **Enforcement:** atualizar as ~31 policies RLS que usam `has_role(uid,'admin')` para `has_capability('<cap>')` (conteúdo/storage de questões → `content.manage`; `analytics_events` SELECT → `intel.view`; `user_roles` SELECT → `roles.manage`) e `CREATE OR REPLACE` das ~25 RPCs `admin_*` trocando o check inline por `perform admin_require('<cap>')`. Mapeamento: dashboards/KPIs → `dashboard.view`; listas/detalhe de usuários → `users.view`; mutações de usuário → `users.manage` (`admin_set_user_role` → `roles.manage`); tentativas leitura → `attempts.view`, cancel/delete → `attempts.manage`; analytics/marketing/produto → `intel.view`; stats de simulado → `content.manage`.

Retrocompatibilidade: `has_role` permanece intacta; `admin` é seedado com todas as capabilities, então quem é admin hoje não percebe transição. A edge function `admin-delete-user` passa a exigir `users.manage` (ajuste na função, mesma chamada).

### Frontend

- `useAdminAuth` passa a chamar `admin_get_access()`; entrada no `/admin` é permitida para **qualquer** role presente em `user_roles`.
- `AdminAccessContext` (novo) expõe `roles`, `capabilities: Set<string>` e `useAdminCan(cap)`. Roles múltiplos = união de capabilities.
- Sidebar, paleta e botões de ação usam `useAdminCan`. Páginas também validam (rota acessada direto sem capability → tela "sem acesso" com link para o Dashboard).
- Atribuição de roles na UI: seção em `AdminUsuarioDetail`, visível só com `roles.manage`, usando `admin_set_user_role` (que já aceita grant/revoke; passa a aceitar os novos roles).

## 5. Saneamento e componentes base

### Consolidações

- `src/admin/lib/constants.ts`: `PERIOD_OPTIONS`, labels/cores de segmento e status (substitui `SEGMENT_CLASSES` duplicado em 3 páginas).
- `src/hooks/useDebounce.ts`: hook genérico (remove os locais de `AdminUsuarios` e `AdminTentativas`).
- `src/admin/lib/format.ts`: `getInitials` (remove as 3 cópias) + helpers de número/data usados nas páginas.
- Remover logs `[upload-debug]` de `AdminUploadQuestions.tsx` (linhas ~194/229/290).

### Componentes novos

- `AdminPageHeader` — título + subtítulo/contagem + slot de ações (padrão para as 13 páginas).
- `AdminBadge` — variantes de segmento/status/role a partir de `constants.ts`.
- `AdminEmptyState` — vazio elegante (ícone, mensagem, ação opcional).
- `AdminConfirmDialog` — confirmação destrutiva padrão (substitui confirmações ad-hoc de delete/cancel).

### Adaptação das 13 páginas

Cada página: troca de classes para tokens admin, adoção de `AdminPageHeader`/`AdminBadge`/`AdminEmptyState`/`AdminConfirmDialog` e das constantes consolidadas. Sem mudar estrutura interna, queries ou fluxos.

## Tratamento de erros e bordas

- Usuário autenticado sem nenhum role → `AdminGuard` nega (comportamento atual preservado).
- Rota acessada sem capability → tela "sem acesso" (não um crash nem redirect silencioso).
- Paleta: erro na busca de entidades → mensagem inline; sem resultados → empty state; RPC respeita capabilities (não vaza entidades que o role não pode ver).
- RPCs mantêm o contrato de erro `unauthorized`/`P0003` — o tratamento existente no front continua válido.

## Testes e verificação

- Suítes existentes (6) atualizadas para o shell/tema novos; `npm run test`, `npm run lint` e `npm run build` verdes.
- Testes novos: filtro de sidebar por capability; filtro do command registry; `AdminAccessContext` (união de roles); `constants.ts`.
- Verificação manual via preview: os dois temas, sidebar colapsada/expandida, paleta (navegação, busca de entidade, ações), fluxo de cada role (admin, content_editor, support, analyst).
- Banco: smoke de cada RPC migrada com um usuário de cada role (e a garantia de que `admin` mantém acesso total).

## Fora de escopo (registrado para as próximas fases)

- Sino/alertas reais, insights automáticos, cohorts e cruzamentos (Fase 2).
- Edição inline de questões, gestão de janelas de execução, comunicação com usuários, audit log de ações admin (Fase 3).
- Responsividade mobile do admin.
