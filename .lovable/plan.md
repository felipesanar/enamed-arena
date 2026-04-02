

## Plan: Tela de escolha "Sou / Nao sou aluno SanarFlix" antes do login

### Fluxo

```text
/login
  ┌─────────────────────────┐
  │  Logo                    │
  │                          │
  │  ┌─────────┐ ┌─────────┐│
  │  │ Nao sou │ │  Sou    ││
  │  │ aluno   │ │ aluno   ││
  │  │SanarFlix│ │SanarFlix││
  │  └─────────┘ └─────────┘│
  └─────────────────────────┘
         │              │
         ▼              ▼
   Fluxo atual     Tela com instrucoes
   (Entrar/Criar)  "Acesse seu SanarFlix
                    e clique em Simulados"
```

### What changes

**File: `src/pages/LoginPage.tsx`**

1. Add a new state: `userType: "undecided" | "guest" | "sanarflix"` (starts as `"undecided"`)
2. When `userType === "undecided"`, render a **choice screen** inside the same `AuthShell` with two styled cards side by side:
   - **"Nao sou aluno SanarFlix"** -- subtitle: "Nao possui assinatura ativa do SanarFlix? Clique aqui para criar sua conta ou entrar." -- clicking sets `userType = "guest"` which reveals the existing login/signup tabs
   - **"Sou aluno SanarFlix"** -- subtitle: "Possui assinatura SanarFlix ou SanarFlix Pro ativa? Clique aqui." -- clicking sets `userType = "sanarflix"` which shows instruction screen
3. When `userType === "sanarflix"`, render an **instruction panel** inside the same card:
   - Friendly message explaining: "Acesse sua conta no SanarFlix ou SanarFlix Pro. La voce vai encontrar o botao Simulados -- e so clicar que voce sera redirecionado automaticamente com seu login."
   - A link/button to `SANARFLIX_PRO_ENAMED_URL` (from `src/lib/sanarflix.ts`) opening in new tab
   - A "Voltar" button to go back to `undecided`
4. When `userType === "guest"`, render the **existing flow** exactly as it is today (tabs, forms, etc), plus a small "Voltar" link to go back to `undecided`
5. Both cards use the existing auth design tokens (`auth-surface-soft`, `auth-border-subtle`, `primary`, etc.) with Framer Motion `AnimatePresence` transitions consistent with the current page
6. The `?mode=signup` query param still works -- if present, auto-set `userType = "guest"` and `mode = "signup"`

### Design details

- Two cards displayed as a responsive grid (side by side on desktop, stacked on mobile)
- Each card: rounded border, icon at top (e.g. `UserPlus` for guest, `Stethoscope` or `BrandIcon` for SanarFlix), title, short description, hover lift effect
- SanarFlix instruction screen: clean layout with numbered steps, external link button styled as primary CTA
- "Voltar" link on both sub-screens to return to the choice

### No other files change

All modifications are contained in `LoginPage.tsx`. The `AuthShell`, `SANARFLIX_PRO_ENAMED_URL`, and all existing form logic remain untouched.

