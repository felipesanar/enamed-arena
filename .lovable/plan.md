

## Plano: Integração Novu para Emails + Fluxo de Redefinição de Senha

### Contexto
Integrar o Novu self-hosted da Sanar como provedor de email para todos os disparos da plataforma, usando o template genérico `workflow-email`. Criar o fluxo completo de "esqueci a senha" usando `supabase.auth.resetPasswordForEmail()` com interceptação via edge function para enviar pelo Novu. Também interceptar o email de confirmação de cadastro.

### Arquitetura

```text
┌─────────────────────────────────────────────────────────┐
│  Supabase Auth Events (signup confirm, password reset)  │
│                         │                               │
│              Auth Email Hook (edge fn)                  │
│                         │                               │
│              POST → Novu self-hosted API                │
│              (workflow-email trigger)                    │
│                         │                               │
│              Novu renders + sends email                  │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  Frontend Flows                                         │
│  • LoginPage: botão "Esqueci minha senha"               │
│  • ForgotPasswordPage: form p/ pedir reset              │
│  • ResetPasswordPage: form p/ definir nova senha        │
└─────────────────────────────────────────────────────────┘
```

### O que será feito

**1. Fix dos build errors existentes (pré-requisito)**
- `HomeHeroSection.tsx` e `HomePagePremium.tsx`: cast `ease: number[]` para `ease: [number, number, number, number] as const` para satisfazer o tipo `Easing` do framer-motion.

**2. Secret do Novu**
- Solicitar ao usuário a **NOVU_API_KEY** (API key do Novu self-hosted) e a **NOVU_API_URL** (URL base da instância self-hosted) via ferramenta de secrets.

**3. Edge Function: `novu-email`**
- Nova edge function `supabase/functions/novu-email/index.ts`
- Recebe `{ type, email, fullName, confirmationUrl, token }` 
- Monta o HTML bonito de acordo com o `type` (welcome, recovery)
- Dispara `POST {NOVU_API_URL}/v1/events/trigger` com o payload no formato `workflow-email` do Novu
- Mapeia dados do projeto: `subscriberId` = user_id, `firstName`/`lastName` extraídos do `fullName`, `email`, `subject` e `html` conforme o tipo

**4. Edge Function: `auth-email-hook`**
- Intercepta eventos de email do Supabase Auth (signup confirmation, recovery)
- Extrai dados do payload e chama a edge function `novu-email`
- Retorna ao Supabase para NÃO enviar o email padrão
- Configuração em `supabase/config.toml`:
  ```toml
  [auth.hook.send_email]
  enabled = true
  uri = "pg-functions://supabase_functions_admin/supabase_functions.http_request"
  ```
  Na verdade, usará o hook nativo do Supabase Auth que roteia para a edge function.

**5. Templates HTML (inline na edge function)**
- **Welcome/Confirmação de email**: HTML responsivo com branding SanarFlix PRO: ENAMED, cor wine (#8E1F3D), botão de confirmação, texto em português
- **Redefinição de senha**: HTML responsivo com mesmo branding, botão "Redefinir minha senha", instruções claras, expiração

**6. Páginas frontend**
- **Botão "Esqueci minha senha"** no `LoginPage.tsx` (abaixo do campo de senha no modo login)
- **`ForgotPasswordPage.tsx`**: formulário com campo de email, chama `supabase.auth.resetPasswordForEmail(email, { redirectTo: origin + '/reset-password' })`, mostra confirmação
- **`ResetPasswordPage.tsx`**: detecta `type=recovery` na URL, formulário para nova senha, chama `supabase.auth.updateUser({ password })`
- **Rotas** em `App.tsx`: `/forgot-password` e `/reset-password` como rotas públicas

**7. AuthContext**
- Adicionar método `resetPassword(email)` ao contexto

### Detalhes técnicos

**Payload para Novu (exemplo recovery):**
```json
{
  "name": "workflow-email",
  "to": [{
    "subscriberId": "<user_id>",
    "firstName": "Leonardo",
    "lastName": "Peixoto",
    "email": "leonardo.peixoto@sanar.com"
  }],
  "overrides": {
    "email": {
      "from": "atendimento@sanar.com.br",
      "replyTo": "atendimento@sanar.com.br",
      "subject": "Redefinição de senha — PRO: ENAMED",
      "html": "<html>...template bonito...</html>"
    }
  }
}
```

**HTML dos emails:**
- Largura máxima 600px, responsivo
- Header com ícone/logo SanarFlix + "PRO: ENAMED"
- Paleta: wine (#8E1F3D), backgrounds claros, tipografia Plus Jakarta Sans com fallback
- Botão CTA arredondado com cor primária
- Footer com "Equipe SanarFlix" + disclaimer

