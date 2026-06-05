# Auditoria de Drift de Migrations & Hardening de Infra (Fase 1)

**Data:** 2026-06-05
**Escopo:** Itens da Fase 1 do plano de implementação — drift de migrations Supabase, processo de schema e pinning de Edge Functions. Continuação do `docs/INCIDENTE_2026_05_17.md`.
**Método:** Auditoria read-only (3 agentes em paralelo). **Nenhuma migration foi aplicada e nenhum dado foi alterado.**

---

## 🔴 ACHADO #1 (CRÍTICO/SEGURANÇA) — `security_hardening` nunca surtiu efeito em produção

> Histórico: a auditoria inicial estava bloqueada porque o MCP apontava para o
> projeto errado (`gvqvrmkizemwsasmupmo`, da plataforma SanarFlix/Cetrus). Após
> reconfigurar o MCP para `lljnbysgcwvkhlnaqxtt` (produção do enamed-arena),
> a auditoria read-only foi concluída. Tudo verificado pelos **objetos reais do
> banco** (não pela tabela `migrations`, que é não-confiável — Lovable aplica
> schema fora de banda).

A migration **`20260420000000_security_hardening`** existe no git mas seus
objetos **NÃO estão presentes em produção**. Verificado em prod:

| Verificação (em prod) | Resultado | Implicação |
|---|---|---|
| Trigger `trg_prevent_direct_attempts_update` em `attempts` | ❌ **ausente** (a tabela não tem nenhum trigger) | — |
| Policy de escrita em `attempts` | `Users can update own attempts [UPDATE]` existe | **Sem o trigger, um usuário autenticado pode dar UPDATE direto em `score_percentage`, `status`, `finished_at`, `is_within_window` da própria tentativa → adulteração de nota/ranking.** |
| `get_ranking_for_simulado` filtra por `results_release_at` | ❌ **não** | Gate de embargo de resultados via ranking ausente (pode haver outra checagem, mas o hardening não está lá). |
| Função `current_user_has_role` | ❌ **ausente** | Helper de RLS do hardening não criado. |
| `has_role` executável por `authenticated` | ⚠️ **sim** (deveria ter sido revogado) | Info-leak de baixo risco (probe de roles). |

**As outras 3 migrations "críticas" do incidente ESTÃO em produção:**

| Migration | Verificação em prod | Status |
|---|---|---|
| `20260420000100_guest_signup_rate_limit` | tabela `guest_signup_rate_limit` ✅ + RPC `bump_guest_signup_bucket` ✅ | ✅ aplicada |
| `20260420001000_expand_error_reason_enum` | enum `error_reason` inclui `reading_error`, `confused_alternatives` ✅ | ✅ aplicada |
| `20260516000000_finalize_returns_is_within_window` | `finalize_attempt_with_results` retorna `...is_within_window boolean` ✅ | ✅ aplicada |

Todas as **7 RPCs-chave** e todos os RPCs `admin_*` existem em prod — ou seja, as
migrations de abril (admin/analytics) **foram aplicadas** apesar das *version
strings* não baterem com o git. Isso confirma que o drift NÃO é "tudo de abril
faltando" — é **cirúrgico**: só os objetos da `security_hardening` faltam.

**Ação recomendada (requer aprovação explícita — é mudança em PRODUÇÃO):**
aplicar `supabase/migrations/20260420000000_security_hardening.sql` em prod
(idealmente após revisar idempotência e testar em staging). Como a migration faz
`DROP/CREATE` em `get_ranking_for_simulado` e adiciona trigger, revisar o corpo
antes de aplicar via `apply_migration`/`db push`. **Nada foi aplicado nesta auditoria.**

---

## Advisors de produção (resumo)

**Security:** 0 ERROR · 98 WARN · 1 INFO. Destaques:
- `anon_security_definer_function_executable` + `authenticated_...` (48 funções cada,
  incl. todas as `admin_*`): EXECUTE concedido a `anon`/`authenticated`. As `admin_*`
  têm guarda interna `has_role('admin')`, mas falta defense-in-depth (revogar EXECUTE).
- `function_search_path_mutable`: `public._norm_match` (sem `SET search_path`).
- `auth_leaked_password_protection`: **desativado** (já rastreado em `docs/security/LEAKED_PASSWORD_PROTECTION.md` — item de auth, fora deste escopo).
- `rls_enabled_no_policy` (INFO): `_questions_area_backup_20260522` (backup, deny-all — ok).

**Performance:** 0 ERROR · 46 WARN · 14 INFO. Destaques:
- `auth_rls_initplan` (45×): policies re-avaliam `auth.uid()` por linha em quase todas
  as tabelas (`attempts`, `answers`, `profiles`, `error_notebook`, admin policies…).
  Fix barato e de alto impacto: trocar `auth.uid()` por `(select auth.uid())`.
- `multiple_permissive_policies`: `simulados` SELECT/authenticated tem 3 policies permissivas.
- `unindexed_foreign_keys` (14×): FKs sem índice (`answers`, `attempt_question_results`,
  `error_notebook`, `user_performance_*`…).

---

## ✅ Item RESOLVIDO — Pinning de Edge Functions (com trava de CI nova)

O risco estrutural #2 do incidente (SDK Supabase sem pin re-resolvendo no
redeploy) **já está corrigido**: as **14** Edge Functions foram auditadas e
**todas as 9** que usam `@supabase/supabase-js` estão em **`@2.49.4`** (pin
completo). Demais deps externas também pinadas (`deno.land/std@0.168.0`,
`esm.sh/pdf-lib@1.17.1`).

**O que foi adicionado nesta fase (anti-regressão):**
- `scripts/check-edge-function-pins.mjs` — falha se qualquer função importar dep
  externa (`npm:`/`jsr:`/`http(s)://`) sem `major.minor.patch`.
- `npm run check:edge-pins` no `package.json`.
- Job `edge-pins` no `.github/workflows/ci.yml` (roda em todo PR/push para `main`).

---

## 📋 Inventário das migrations LOCAIS (git)

**85 migrations**, de **2026-03-14** a **2026-05-26**. Distribuição:
**34 CRITICAL · 23 HIGH · 28 LOW**.

### As 4 migrations que o incidente apontou como "nunca aplicadas em prod" — todas existem no git:

| Migration | O que faz | Risco se ausente em prod |
|---|---|---|
| `20260420000000_security_hardening` | Trigger `trg_prevent_direct_attempts_update` (bloqueia update direto de score/status), gate de `results_release_at` no ranking, `current_user_has_role`, revoga `has_role` de clientes, rate-limit em `log_analytics_event` | Alunos poderiam adulterar score; resultados vazam antes do release |
| `20260420000100_guest_signup_rate_limit` | Tabela `guest_signup_rate_limit` + RPC `bump_guest_signup_bucket` | **Signup quebra** (foi exatamente a causa do incidente de 17/05) |
| `20260420001000_expand_error_reason_enum` | Adiciona `reading_error`, `confused_alternatives` ao enum `error_reason` | Crash/erro ao adicionar ao Caderno de Erros com esses motivos |
| `20260516000000_finalize_returns_is_within_window` | `finalize_attempt_with_results` passa a retornar `is_within_window` | Cliente que espera o campo recebe erro de schema ao finalizar prova |

### Duplicatas/redundâncias detectadas (seguras, mas indicam falta de processo):
- `20260526032545`, `20260526120000`, `20260526130000`, `20260526150000` — adicionam os mesmos campos do Caderno de Erros (`ai_practice`, `ai_option_rationales`, `next_review_at`, `chat_count`) com `IF NOT EXISTS`. Geradas em paralelo (provável Lovable + dev manual).
- `20260517110621` é praticamente idêntica a `20260516000000` (re-deploy de `finalize_attempt_with_results`).

> O inventário completo (tabela das 85 + mapa de todas as ~70 RPCs → migrations
> que as definem/alteram) está nos resultados da auditoria; pode ser exportado
> para cá sob demanda.

---

## 🔭 Nota: mismatch de projeto do MCP (resolvido)

A 1ª rodada da auditoria pegou o MCP apontado para `gvqvrmkizemwsasmupmo`
(plataforma SanarFlix/Cetrus — outro produto, 47 tabelas tipo `ies`/`users`/
`conteudos`, sem as RPCs do enamed). Foi reconfigurado para
`lljnbysgcwvkhlnaqxtt` (produção real) e a auditoria refeita. **Lição:** confirmar
sempre `get_project_url` antes de qualquer operação no Supabase via MCP.

---

## 🛠️ Remediação recomendada (priorizada)

1. **[P0 segurança] Aplicar `security_hardening` em prod** — fecha a adulteração
   de nota (trigger em `attempts`) + gate de release no ranking. Revisar o SQL
   (faz DROP/CREATE em `get_ranking_for_simulado`), testar em staging, aplicar via
   `apply_migration`/`db push`. **Requer aprovação explícita.**
2. **[P1 perf] `auth_rls_initplan`** — migration que troca `auth.uid()` por
   `(select auth.uid())` nas ~45 policies. Ganho grande, risco baixo, idempotente.
3. **[P2 segurança] Defense-in-depth nas `admin_*`** — `REVOKE EXECUTE` de
   `anon`/`authenticated` (a guarda interna `has_role` permanece). + `SET search_path`
   em `_norm_match`. + revogar `has_role` de `authenticated`.
4. **[P2 perf] Índices nas 14 FKs** + consolidar policies permissivas de `simulados`.

## 🔒 Processo anti-drift (git = fonte da verdade)

1. **Diff periódico:** `supabase db diff --linked` (ou comparar objetos reais,
   como nesta auditoria) — a tabela `migrations` é não-confiável aqui.
2. **CI gate:** job que roda `supabase migration list --linked` / `db diff` e
   **falha** em divergência (exige secret `SUPABASE_ACCESS_TOKEN`).
3. **Disciplina Lovable:** todo schema aplicado direto no remoto precisa ser
   commitado como migration no git — senão o drift volta.

---

## Resumo / Status da Fase 1

| Item | Status |
|---|---|
| Pinning de Edge Functions | ✅ Já pinado + trava de CI adicionada nesta fase |
| Inventário de migrations locais | ✅ Completo (85, com criticidade e mapa de RPCs) |
| Drift local-vs-produção | ✅ Auditado (via objetos reais). Drift cirúrgico: só `security_hardening` faltando |
| Aplicar `security_hardening` em prod | ⏸️ Pendente de **aprovação** (mudança em produção) |
| Advisors de produção | ✅ Coletados (0 ERROR; WARNs de RLS initplan, EXECUTE de admin_*, leaked-pw) |
| Processo anti-drift no CI | 📝 Especificado (depende de secret `SUPABASE_ACCESS_TOKEN` no GitHub) |
