

## Plan: Modal HubSpot pós-cadastro + Correção de build errors

### Visão geral

Ao criar conta, após o signup bem-sucedido, um modal (Dialog) abre com o formulário HubSpot embutido. Os campos de Email e Nome são pré-preenchidos. O usuário completa Telefone e Etapa da carreira, e envia. O email de confirmação é disparado normalmente em paralelo.

Adicionalmente, corrigir todos os build errors existentes.

---

### Etapa 1 — Criar componente `HubSpotFormModal`

**Arquivo:** `src/components/auth/HubSpotFormModal.tsx`

- Usar `Dialog` do shadcn/ui
- Props: `open`, `onOpenChange`, `prefillEmail`, `prefillName`
- No `useEffect` (quando `open=true`), carregar o script HubSpot (`//js.hsforms.net/forms/embed/v2.js`) dinamicamente e chamar `hbspt.forms.create()` com:
  - `portalId: "9321751"`, `formId: "3cef6ec2-5f6f-4bab-ae9c-d3c2e2f2d3a3"`, `region: "na1"`
  - `target: "#hubspot-form-container"` (div dentro do modal)
  - `onFormReady: ($form) => { ... }` — preencher campos `email` e `firstname` com os valores passados via props
- Instruir o usuário: "Complete os campos abaixo para finalizar seu cadastro"
- Botão "Pular" para fechar sem preencher (o cadastro já foi feito)

### Etapa 2 — Integrar no fluxo de signup (`LoginPage.tsx`)

- Adicionar estado `hubspotModalOpen`
- No `handlePasswordSubmit`, quando `mode === "signup"` e sem erro:
  - Setar `hubspotModalOpen = true` (abre o modal)
  - Setar `flowState = "sent"` somente quando o modal for fechado (ou em paralelo — o email de confirmação já foi disparado)
- Renderizar `<HubSpotFormModal>` passando `email` e `fullName`

### Etapa 3 — Adicionar função `translateError` ausente

- Criar uma função `translateError(msg: string): string` no `LoginPage.tsx` que traduz mensagens comuns do Supabase Auth para português (ex: "Invalid login credentials" → "Email ou senha incorretos")

### Etapa 4 — Corrigir demais build errors

| Arquivo | Problema | Correção |
|---|---|---|
| `RankingClimbWidget.tsx:146` | `transitionEnd` não existe em motion.div (Framer Motion 12) | Mover para dentro de `animate` ou remover |
| `SimuladosTimelineSection.tsx:153` | `type: string` no transition | Usar `as const` no tipo |
| `MobileBottomNav.tsx` | Tipo do icon incompatível com LucideIcon | Mudar tipo para `React.ComponentType<any>` ou usar `LucideIcon` |
| `MobileDashboardHeader.tsx` | Mesmo problema de tipo icon | Mesma correção |
| `LandingHero.test.tsx` | Parâmetros `any` implícitos | Adicionar tipos `any` explícitos |
| `DesempenhoPage.test.tsx` | Tipos `any` implícitos | Adicionar tipos explícitos |

---

### Detalhes técnicos

**Carregamento do script HubSpot:**
```typescript
useEffect(() => {
  if (!open) return;
  const script = document.createElement("script");
  script.src = "//js.hsforms.net/forms/embed/v2.js";
  script.onload = () => {
    window.hbspt.forms.create({
      portalId: "9321751",
      formId: "3cef6ec2-5f6f-4bab-ae9c-d3c2e2f2d3a3",
      region: "na1",
      target: "#hubspot-form-container",
      onFormReady: ($form) => {
        // Pré-preencher email e nome
        $form.find('input[name="email"]').val(prefillEmail).change();
        $form.find('input[name="firstname"]').val(prefillName).change();
      },
    });
  };
  document.body.appendChild(script);
}, [open]);
```

**Fluxo do usuário:**
```text
[Preenche nome, email, senha]
        ↓
[Clica "Criar minha conta"]
        ↓
  ┌─ Supabase signup (email de confirmação disparado)
  └─ Modal HubSpot abre
        ↓
[Preenche telefone + etapa da carreira]
        ↓
[Envia formulário OU clica "Pular"]
        ↓
[Tela de "Verifique seu e-mail"]
```

