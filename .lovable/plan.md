

# Auditoria Completa do Admin — ENAMED Arena

## Causa raiz dos erros 400

O erro **não é de sessão ou autenticação**. A causa é um **bug de SQL nas RPCs** — ambiguidade de referência à coluna `user_id`.

### O que acontece

Todas as RPCs admin que retornam `user_id` no `RETURNS TABLE` têm o seguinte padrão de verificação:

```sql
if not exists (
  select 1 from user_roles where user_id = auth.uid() and role = 'admin'
) then raise exception 'unauthorized';
```

O PL/pgSQL interpreta `user_id` como a **variável de saída da função** (do `RETURNS TABLE`), não como a coluna `user_roles.user_id`. Resultado: erro `42702: column reference "user_id" is ambiguous`.

### RPCs quebradas (confirmado via teste direto)

| RPC | Erro |
|-----|------|
| `admin_list_users` | ambiguous `user_id` |
| `admin_list_attempts` | ambiguous `user_id` |
| `admin_get_user` | ambiguous `user_id` |

### RPCs funcionais (sem `user_id` no retorno — erro apenas "unauthorized" sem auth context, como esperado)

`admin_attempts_kpis`, `admin_dashboard_kpis`, `admin_events_timeseries`, `admin_funnel_stats`, `admin_simulado_engagement`, `admin_live_signals`, `admin_get_user_attempts`, `admin_set_user_segment`, `admin_set_user_role`, `admin_reset_user_onboarding`, `admin_simulado_detail_stats`, `admin_simulado_question_stats`, `admin_cancel_attempt`, `admin_delete_attempt`, e todas as RPCs de analytics/marketing/produto.

---

## Correção necessária (Migration SQL)

Qualificar a referência com o nome da tabela em cada RPC afetada:

```sql
-- Trocar:
select 1 from user_roles where user_id = auth.uid()
-- Por:
select 1 from user_roles ur where ur.user_id = auth.uid()
```

As 3 funções afetadas (`admin_list_users`, `admin_list_attempts`, `admin_get_user`) precisam ser recriadas com `CREATE OR REPLACE` usando alias `ur` na subquery de admin check.

---

## Outros problemas encontrados na auditoria

### Bug no frontend — `useDebounce` em `AdminUsuarios.tsx`

**Arquivo**: `src/admin/pages/AdminUsuarios.tsx`, linhas 29-36

```typescript
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useState(() => {  // ← BUG: deveria ser useEffect
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  })
  return debounced
}
```

Usa `useState` em vez de `useEffect`. O debounce nunca atualiza — a busca fica travada no valor inicial. O `useDebounce` de `AdminTentativas.tsx` está correto (usa `useEffect`).

### Código morto — Stubs não utilizados

Os arquivos em `src/admin/pages/stubs/` para páginas que já foram implementadas são código morto:
- `stubs/AdminUsuarios.tsx` (real: `pages/AdminUsuarios.tsx`)
- `stubs/AdminTentativas.tsx` (real: `pages/AdminTentativas.tsx`)
- `stubs/AdminAnalytics.tsx` (real: `pages/AdminAnalytics.tsx`)
- `stubs/AdminMarketing.tsx` (real: `pages/AdminMarketing.tsx`)
- `stubs/AdminProduto.tsx` (real: `pages/AdminProduto.tsx`)

Os imports em `App.tsx` apontam corretamente para as páginas reais, mas os stubs poluem o projeto.

### Coluna legada `profiles.is_admin`

A tabela `profiles` tem uma coluna `is_admin boolean DEFAULT false`. O sistema de autenticação admin usa corretamente `user_roles` + `has_role()`, mas essa coluna vestigial pode causar confusão e representa um risco se alguém a usar no futuro para verificar acesso.

### Flyout marca páginas implementadas como "em breve"

No `AdminFlyout.tsx`, as páginas com `phase: 'p0'` (Usuários, Suporte) são renderizadas como `NavLink` clicável, mas o Flyout não distingue visualmente entre "live" e "p0" — ambas são links normais. Apenas `phase: 'p1'` é desabilitado. Isso está OK funcionalmente, mas "Suporte" é um stub real.

---

## Plano de implementação

### Passo 1 — Migration SQL (crítico)
Criar migration para corrigir as 3 RPCs com `user_id` ambíguo, adicionando alias `ur` à tabela `user_roles`:

```sql
CREATE OR REPLACE FUNCTION public.admin_list_users(...)
-- Alterar: select 1 from user_roles where user_id = auth.uid()
-- Para:    select 1 from user_roles ur where ur.user_id = auth.uid()

CREATE OR REPLACE FUNCTION public.admin_list_attempts(...)
-- Mesma correção

CREATE OR REPLACE FUNCTION public.admin_get_user(...)
-- Mesma correção
```

### Passo 2 — Corrigir `useDebounce` em `AdminUsuarios.tsx`
Trocar `useState` por `useEffect` no hook de debounce, com array de dependências `[value, delay]`.

### Passo 3 — Limpar stubs mortos
Deletar os 5 stubs que já foram substituídos por páginas reais.

### Passo 4 (opcional) — Remover `profiles.is_admin`
Migration para dropar a coluna legada `is_admin` da tabela `profiles`.

