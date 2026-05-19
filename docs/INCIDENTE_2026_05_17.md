# Incidente de Auth — 17/05/2026

## Resumo executivo

No domingo 17/05, **três fluxos de autenticação quebraram simultaneamente** para alunos sem sessão ativa. Causas independentes, mas todas amplificadas por dois problemas estruturais que continuam abertos.

| Fluxo | Sintoma | Causa raiz | Status |
|---|---|---|---|
| SSO via SanarFlix | "Erro de conexão. Verifique sua internet" | URL montada com `https://undefined.supabase.co/...` — `VITE_SUPABASE_PROJECT_ID` é opcional e não existe no build de produção | ✅ commit `9504baa` — uso `supabase.functions.invoke()` que herda fallback do client |
| Reset de senha | "Edge Function returned a non-2xx status code" | `npm:@supabase/supabase-js@2` re-resolveu para versão nova quando todas as Edge Functions foram redeployadas em 17/05 11:11 UTC. Novo gotrue retorna usuário inexistente via `status=404` / `code='user_not_found'` em vez da string `'user not found'` na message | ✅ commit `babc755` — `isSilentAuthError` aceita status/code |
| Signup ("Criar conta") | "Ocorreu um erro inesperado" | Migration `20260420000100_guest_signup_rate_limit.sql` **nunca foi aplicada em produção**. A RPC `bump_guest_signup_bucket` não existia no banco. `create-guest-account` retornava 503 em toda chamada | ✅ migration aplicada manualmente via `supabase db query -f` |

## Problemas estruturais que **continuam abertos**

### 1. Drift gigante de migrations

Saída do `supabase migration list --linked` mostra dezenas de migrations locais que nunca foram aplicadas no remoto, **incluindo várias críticas**:

- `20260420000000_security_hardening`
- `20260420001000_expand_error_reason_enum`
- `20260516000000_finalize_returns_is_within_window`
- Várias outras de março e abril/2026

Ao mesmo tempo, várias migrations existem só no remoto (Lovable está aplicando schema changes direto, sem versionar no git). Isso significa que:

- **O git não é a fonte da verdade do schema**.
- Bugs novos podem aparecer porque alguma RPC esperada não existe (foi o que aconteceu no signup).
- Migrations escritas pela equipe podem nunca rodar em produção.

**Ação recomendada**: auditar uma a uma as migrations local-only, decidir quais aplicar, e estabelecer um processo (CI ou manual disciplinado) onde toda migration vai pro git **e** pro remoto via `supabase db push`.

### 2. Edge Functions com supabase-js não pinado

Hoje pinei `request-password-reset`, `create-guest-account` e `generate-exam-pdf` em `@2.49.4`, alinhando com as outras Edge Functions. **Mas o risco original era estrutural**: qualquer `npm:@supabase/supabase-js@2` ou `esm.sh/...@2` sem patch number puxa a versão mais nova a cada redeploy.

**Ação recomendada**: 
- Adicionar lint/check no CI que falha se algum arquivo `supabase/functions/**/*.ts` importar Supabase SDK sem pin completo (major.minor.patch).
- Ao subir versão, ler changelog do gotrue/supabase-js, testar em staging.

### 3. PAT exposto no chat de debug

Durante a investigação, um PAT do Supabase foi colado em chat de debug. **Tratar como comprometido sempre**: revogar imediatamente em https://supabase.com/dashboard/account/tokens e gerar outro. Nunca colar PAT em mensagens, prints ou docs.

## Pipeline de deploy: o que disparou o redeploy de 17/05?

Todas as Edge Functions foram redeployadas em `2026-05-17 11:11:46 UTC` simultaneamente — comportamento típico de redeploy em massa. Investigar:

- Foi Lovable? Push automático? CLI manual de alguém?
- Esse redeploy é regular ou foi um evento único?
- Se for regular, **toda janela de redeploy é uma janela de risco** enquanto SDKs não estiverem pinados.

## Lições

1. **Tudo que é `@N` sem patch é uma bomba-relógio**. Não importa o ecossistema — npm, esm.sh, deno.land. Pin completo ou nada.
2. **Mensagens de erro genéricas roubam dias de debug**. As Edge Functions retornavam mensagens amigáveis no body, mas `supabase.functions.invoke()` jogava fora e substituía por "Edge Function returned a non-2xx status code". Adotamos `extractInvokeErrorMessage` em `AuthContext` (commit `2a41802`) para nunca mais sofrer isso.
3. **Drift de migrations precisa de alarme**. Hoje o sintoma foi um signup quebrado; amanhã pode ser uma RPC de scoring que deixa de existir no meio de um simulado em produção.
