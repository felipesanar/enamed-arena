

# Remover trava de rate limit no signup

## Diagnóstico

Existem **duas camadas** de rate limiting afetando o cadastro:

1. **Supabase Auth (servidor)** — limite nativo de envio de emails de confirmação. É isso que retorna o 429. O padrão do Supabase é muito baixo (~4 emails/hora por usuário). Isso precisa ser ajustado no **dashboard do Supabase**.

2. **Client-side (app)** — ao receber um 429, o código em `LoginPage.tsx` trava o botão por 3 minutos via localStorage (`signup-rate-limit-until`). Isso amplifica o problema.

## Solução

### 1. Remover a trava client-side (código)

Em `src/pages/LoginPage.tsx`:
- Remover a constante `SIGNUP_RATE_LIMIT_LOCK_KEY` e `SIGNUP_RATE_LIMIT_MS`
- Remover o `useEffect` que lê/decrementa o countdown do localStorage (linhas 105-123)
- Remover o estado `signupRetryIn`
- Remover o bloqueio no `handlePasswordSubmit` que impede submissão quando `signupRetryIn > 0` (linhas 148-151)
- Remover o `localStorage.setItem` que ativa a trava ao receber 429 (linhas 166-168)
- Remover o `localStorage.removeItem` no sucesso (linhas 176-177)
- Manter a mensagem de erro traduzida para 429, mas sem travar — o usuário pode tentar novamente imediatamente

### 2. Aumentar o rate limit no Supabase (manual, dashboard)

Você precisa ir em **Supabase Dashboard → Authentication → Rate Limits** e aumentar o limite de "Rate limit for sending emails" (padrão: 4/hora). Recomendo colocar pelo menos **30/hora** ou mais.

Link direto: `https://supabase.com/dashboard/project/lljnbysgcwvkhlnaqxtt/auth/rate-limits`

## Arquivos alterados

- `src/pages/LoginPage.tsx` — remoção da lógica de cooldown/lock

## Resultado

- Usuários nunca ficam travados no client
- Se o Supabase retornar 429, aparece apenas uma mensagem informativa sem bloquear novas tentativas
- Com o rate limit aumentado no dashboard, os 429 deixam de ocorrer na prática

