

# Auditoria do Fluxo de Cadastro — Problemas Identificados

## Fluxo Completo Analisado
```text
LoginPage (signup) → create-guest-account Edge Function → Auto sign-in
→ HubSpotFormModal (ou fallback) → Navigate to "/" → ProtectedRoute
→ Redirect to /onboarding → OnboardingPage → save_onboarding_guarded → Home
```

## Problemas Encontrados

### 1. CRÍTICO — HubSpot modal diz "verifique seu e-mail" mas o email já está confirmado
O `create-guest-account` cria o usuário com `email_confirm: true` e faz login automático. Porém, o modal de sucesso do HubSpot (linha 166 de `HubSpotFormModal.tsx`) diz: **"Agora verifique seu e-mail para ativar sua conta e acessar a plataforma."** Isso é **falso** — o usuário já está logado. Vai confundir milhares de usuários.

**Correção:** Alterar o texto de sucesso para algo como "Cadastro completo! Vamos configurar seu perfil."

### 2. MODERADO — flowState fica "sending" após signup com sucesso
Em `handlePasswordSubmit` (linha 126-128), no caso de sucesso do signup, o `hubspotModalOpen` é setado para `true` mas o `flowState` nunca volta para `"idle"`. Se o usuário fechar o modal (via fallback/complete), o botão de submit continua desabilitado com spinner. Na prática, o `Navigate` redireciona antes, mas é um estado inconsistente.

**Correção:** Adicionar `setFlowState("idle")` junto com `setHubspotModalOpen(true)`.

### 3. MODERADO — Erro 409 (email já cadastrado) não é tratado claramente no client
A edge function retorna `{ error: "Este e-mail já está cadastrado..." }` com status 409. No `AuthContext.signUpWithPassword`, `data?.error` captura isso, mas a mensagem passa pelo `translateError()` que pode não matchá-la corretamente (não tem match para "já está cadastrado"). O fallback genérico será exibido.

**Correção:** Adicionar entrada no `translateError` para "já está cadastrado".

### 4. BAIXO — Race condition no redirect após fechar HubSpot modal
Quando `onComplete` é chamado, `setHubspotModalOpen(false)` faz com que a condição `user && !hubspotModalOpen` na linha 93 do LoginPage seja `true`, ativando o `<Navigate to="/" />`. Isso funciona, mas depende do `user` já estar no state (o que é verdade pois o sign-in aconteceu antes do modal). OK na prática, mas frágil.

### 5. BAIXO — Edge function não tem no config.toml
A função `create-guest-account` não está listada no `supabase/config.toml` com `verify_jwt = false`. Isso pode causar erro 401 quando chamada via `supabase.functions.invoke()` se o JWT check estiver ativo por padrão.

**Correção:** Adicionar `[functions.create-guest-account]` com `verify_jwt = false` ao config.toml.

## Plano de Correção (4 mudanças)

### 1. HubSpotFormModal.tsx — Corrigir texto de sucesso
- Trocar "verifique seu e-mail para ativar sua conta" por "Vamos configurar seu perfil agora."
- Trocar botão "Continuar" por "Configurar perfil"

### 2. LoginPage.tsx — Resetar flowState no signup
- Adicionar `setFlowState("idle")` na linha 127, antes de `setHubspotModalOpen(true)`

### 3. LoginPage.tsx — Adicionar tradução para "já está cadastrado"
- Adicionar no array `map` do `translateError`: `["já está cadastrado", "Este e-mail já está cadastrado. Tente fazer login."]`

### 4. supabase/config.toml — Adicionar create-guest-account
- Adicionar seção `[functions.create-guest-account]` com `verify_jwt = false`

## Arquivos Alterados
- `src/components/auth/HubSpotFormModal.tsx`
- `src/pages/LoginPage.tsx`
- `supabase/config.toml`

