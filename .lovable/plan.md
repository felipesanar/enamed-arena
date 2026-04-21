

## Auditoria da página de Configurações + nova navegação por abas

### Objetivo
1. Trocar o layout "scroll com tudo aberto" por uma navegação **por abas** — só a seção selecionada na lateral é renderizada.
2. Corrigir/limpar o que está quebrado, fake ou incompleto na página.

---

### Achados da auditoria

**O que está OK e funciona**
- Hero com nome, e-mail, segmento, especialidade e contagem de instituições — lê de `UserContext`.
- Edição inline de nome (`InlineNameEdit`) — grava em `profiles.full_name` e atualiza via `refreshProfile()`. ✅
- Editor de Perfil acadêmico — usa `saveOnboarding` (RPC `save_onboarding_guarded`) e respeita `onboardingEditLocked` + `onboardingNextEditableAt`. ✅
- Card de Plano (`PlanBillboard`) com upsell para guest/standard e celebração para PRO. ✅
- Logout com confirmação (`LogoutConfirm`). ✅
- Toggle de tema (claro/escuro/sistema) — aplica classe `dark` no `<html>` e persiste em `localStorage`. ✅

**O que está quebrado, fake ou incompleto**

| # | Item | Problema | Ação |
|---|---|---|---|
| 1 | Tudo num scroll só | Conta, Plano, Perfil acadêmico, Preferências, Suporte e Sessão renderizam empilhados; a sidebar só faz scroll-spy. Pedido do usuário: alternar por interação. | Trocar por abas: estado `activeSection`, render condicional, `SettingsNav` controlado. |
| 2 | "Resumos e novidades por email" (Switch) | Salva só em `localStorage`; **nenhum job/edge function lê isso**. É um placebo. | Remover o toggle (ou marcar como "em breve" desabilitado). Recomendado: remover. |
| 3 | "Lembretes de simulado" (Switch) | Mesma coisa — só localStorage, sem integração com Novu/edge. Placebo. | Remover. |
| 4 | "Efeitos sonoros" (Switch) | Não existe nenhum `playSound` no projeto que leia essa pref. Placebo. | Remover. |
| 5 | "Membro desde" | Lê `authUser.created_at` via cast `any`; em sessões SSO o campo pode vir undefined e a linha some silenciosamente. | Manter, mas tipar com fallback explícito e exibir "—" em vez de ocultar a linha quando faltar. |
| 6 | E-mail "Verificado" badge | Hard-coded; não consulta `authUser.email_confirmed_at`. | Mostrar Verificado só se `authUser.email_confirmed_at` existir. |
| 7 | `SettingsNav` mobile (chips horizontais) | Continua válido, mas precisa virar controlado pelo mesmo estado de aba. | Ajustar para receber `activeId`/`onChange` em vez de scroll-spy. |
| 8 | `useMemo` filtra "perfil-academico" se onboarding incompleto | Continua válido — manter. | Manter na nova estrutura. |
| 9 | Hero exibe "1 instituição alvo" mesmo quando lista está vazia | `institutionsCount` recebe `length` que pode ser 0; condição `> 0` já cobre. | Sem ação. |
| 10 | Falta um título de página/breadcrumb | `PageTransition` não renderiza header próprio. | Sem ação (Hero já cumpre o papel). |

---

### Mudanças (técnicas)

**1. `src/components/settings/SettingsNav.tsx`** — virar componente controlado
- Props novas: `activeId: string`, `onSelect: (id: string) => void`.
- Remover toda a lógica de scroll-spy (`useEffect` com `onScroll`) e `handleJump` (smooth scroll).
- Clique chama `onSelect(id)` em vez de rolar a página.
- Mobile: mesmo padrão (chips controlados).
- Manter o indicador animado `layoutId="settings-nav-indicator"` / `"settings-nav-pill"`.

**2. `src/pages/ConfiguracoesPage.tsx`** — render condicional por aba
- Adicionar `const [activeSection, setActiveSection] = useState<string>("conta")`.
- Garantir que se `perfil-academico` não estiver em `navSections` e for o ativo, cair para `"conta"` (efeito de saneamento).
- Substituir o stack `space-y-10` por **um único bloco que renderiza apenas a seção ativa** com `AnimatePresence` + `motion.div key={activeSection}` (fade/slide curto, 180ms).
- Remover `scrollMarginTop` do `SettingsSection` (não precisa mais — opcional).
- Passar `activeId={activeSection}` e `onSelect={setActiveSection}` para `SettingsNav`.

**3. `src/components/settings/PreferencesSection.tsx`** — limpar placebos
- Remover os 3 Switches (`emailNotifications`, `examReminders`, `soundEffects`) e suas chaves do `PreferencesState`.
- Manter apenas o `ThemeToggle` (Claro/Escuro/Sistema) — esse funciona de verdade.
- Atualizar `STORAGE_KEY` continua igual; manter migração tolerante (já faz `{...DEFAULT, ...parsed}`).
- Atualizar `description` da seção em `ConfiguracoesPage` para "Tema da interface" (o item "notificações" some).
- Atualizar a entrada do `NAV_SECTIONS` para `description: "Aparência"` em vez de "Tema e notificações".

**4. `src/pages/ConfiguracoesPage.tsx`** — pequenos consertos
- E-mail "Verificado": condicionar ao `authUser?.email_confirmed_at`.
- "Membro desde": se não houver data, exibir "—" (não esconder a linha).

---

### Estrutura visual final

```text
[ HERO — nome, segmento, especialidade, instituições ]

┌──────────────┬───────────────────────────────────────┐
│ ● Conta      │                                       │
│   Plano      │     [ apenas a seção ativa ]          │
│   Perfil…    │     fade-in 180ms ao trocar           │
│   Preferên…  │                                       │
│   Suporte    │                                       │
│   Sessão     │                                       │
└──────────────┴───────────────────────────────────────┘
```

Mobile: chips horizontais sticky no topo, mesma lógica de aba ativa.

---

### Risco / rollback
- Mudanças isoladas em 3 arquivos (`ConfiguracoesPage.tsx`, `SettingsNav.tsx`, `PreferencesSection.tsx`).
- Sem mudança de schema, RPC ou rota.
- Rollback = reverter os 3 arquivos.

