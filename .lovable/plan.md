

## Diagnóstico: Login/Auth não funciona

### Problemas encontrados

**Problema 1 (CRÍTICO) — LoginPage não redireciona após login bem-sucedido**

O componente `LoginPage` extrai `user` do `useAuth()` na linha 61 mas **nunca o utiliza para redirecionar**. Após `signInWithPassword` retornar sucesso:
- `result.error` é `null` → não entra no bloco de erro
- O código só faz algo especial para `mode === "signup"` (abre o modal HubSpot)
- Para login, `flowState` fica preso em `"sending"` → o spinner roda para sempre
- O `onAuthStateChange` no `AuthContext` atualiza `user`, mas o `LoginPage` nunca verifica `if (user) return <Navigate to="/" />`

Isso explica exatamente o que está na screenshot: o botão fica com spinner infinito.

**Problema 2 (EMAILS) — Novu retornando 402 Payment Required**

Os logs da Edge Function `auth-email-hook` mostram:
```
Novu error [402]: "You have exceeded the number of allowed requests..."
```
Os emails de confirmação de signup **não estão sendo enviados**. Isso é um problema de billing do Novu, não de código. Mas o fluxo de signup também não trata esse cenário — o usuário vê "verifique seu email" mas o email nunca chega.

### Correções planejadas

#### 1. Adicionar redirect ao LoginPage quando `user` existe

**Arquivo:** `src/pages/LoginPage.tsx`

Após o check de `loading` (linha ~106), adicionar:
```typescript
if (user) {
  return <Navigate to="/" replace />;
}
```

Isso garante que:
- Após login com senha → `onAuthStateChange` seta `user` → componente re-renderiza → redireciona
- Se o usuário já está logado e acessa `/login` → redireciona direto

#### 2. Resetar `flowState` após login com senha bem-sucedido

No `handlePasswordSubmit`, após o check de signup (linha ~160), adicionar um branch para login que reseta o `flowState` para `"idle"`. Na prática o redirect via `user` vai ocorrer antes, mas é boa prática não deixar o estado pendurado.

#### 3. Informar sobre o problema do Novu

O erro 402 do Novu é externo — precisa ser resolvido no dashboard do Novu (upgrade do plano ou reset do limite). Não é correção de código, mas vou documentar.

### Detalhes técnicos

- A correção principal é 1 linha: `if (user) return <Navigate to="/" replace />;`
- Sem alterações no backend, edge functions, ou banco de dados
- Arquivo editado: apenas `src/pages/LoginPage.tsx`

