# Auditoria de Drift de Migrations & Hardening de Infra (Fase 1)

**Data:** 2026-06-05
**Escopo:** Itens da Fase 1 do plano de implementação — drift de migrations Supabase, processo de schema e pinning de Edge Functions. Continuação do `docs/INCIDENTE_2026_05_17.md`.
**Método:** Auditoria read-only (3 agentes em paralelo). **Nenhuma migration foi aplicada e nenhum dado foi alterado.**

---

## 🔴 Bloqueador #1 — O MCP do Supabase aponta para o projeto ERRADO

Durante a auditoria, descobrimos que o servidor MCP do Supabase conectado a esta
sessão **não é o projeto do enamed-arena**:

| | Project ref | Identidade |
|---|---|---|
| **App (produção)** | `lljnbysgcwvkhlnaqxtt` | Hardcoded em `src/integrations/supabase/client.ts:9` e `supabase/config.toml` |
| **MCP conectado** | `gvqvrmkizemwsasmupmo` | Outro produto — plataforma SanarFlix/Cetrus |

O projeto do MCP (`gvqvrmkizemwsasmupmo`) contém 47 tabelas de **outro sistema**
(`ies`, `users` com 7.421 linhas, `conteudos` com 13.277, `Simulados` com "S"
maiúsculo, `b2c-signup`, `enamed-proxy`…) e **6 das 7 RPCs-chave do enamed-arena
nem existem lá** (`finalize_attempt_with_results`, `create_attempt_guarded`,
`update_attempt_progress_guarded`, `save_onboarding_guarded`,
`get_ranking_for_simulado`, `bump_guest_signup_bucket` — todas ausentes; só
`has_role` existe, por coincidência de nome).

**Consequência:** não foi possível medir o drift real contra a produção do
enamed-arena. Não há Supabase CLI nem `SUPABASE_ACCESS_TOKEN` neste ambiente,
então também não dá para rodar `supabase migration list --linked`.

**Decisão necessária (ação do usuário) — escolha um caminho para destravar:**
1. Reconfigurar o MCP do Supabase para o projeto `lljnbysgcwvkhlnaqxtt`; ou
2. Fornecer um Personal Access Token (`SUPABASE_ACCESS_TOKEN`) + instalar a CLI
   para rodar `supabase migration list --linked`; ou
3. Colar a saída de `supabase migration list --linked` (executada por alguém com
   acesso) para fazermos o diff local-vs-remoto.

> ⚠️ **Nunca** cole um PAT em chat/print/doc (o `INCIDENTE_2026_05_17.md` registra
> um PAT vazado em debug). Configure via variável de ambiente e revogue se exposto.

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

## 🔭 Snapshot do projeto do MCP (`gvqvrmkizemwsasmupmo` — NÃO é prod do enamed)

Registrado apenas para diagnóstico do mismatch — **não usar para decisões de
schema do enamed-arena**:
- 146 migrations aplicadas (naming/datas desde 2025-08, totalmente diferentes).
- 47 tabelas, 35 Edge Functions, extensões: `pg_cron`, `pg_net`, `pgcrypto`, `unaccent` não consta, `supabase_vault`.
- Advisors: **115 security** / **251 performance** issues (deste outro produto).

---

## 🛠️ Processo recomendado para acabar com o drift (git = fonte da verdade)

Depende de destravar o Bloqueador #1. Plano:

1. **Diff inicial** — com acesso a `lljnbysgcwvkhlnaqxtt`, rodar
   `supabase migration list --linked` e cruzar com as 85 locais. Classificar:
   - *local-only* (no git, não aplicada) → revisar e aplicar via `supabase db push`.
   - *remote-only* (aplicada, sem arquivo no git) → "puxar" para o git
     (`supabase db pull`/`db diff`) e versionar.
2. **Aplicar as 4 críticas primeiro** (se ausentes), em staging antes de prod.
3. **Travar o processo no CI:** job que roda `supabase migration list --linked`
   e **falha** se houver divergência (exige secret `SUPABASE_ACCESS_TOKEN` no
   GitHub). Toda mudança de schema vai ao git **e** ao remoto via `db push`.
4. **Disciplina Lovable:** se o Lovable continua aplicando schema direto no
   remoto, ele precisa commitar a migration correspondente no git — senão o
   drift volta.

---

## Resumo / Status da Fase 1

| Item | Status |
|---|---|
| Pinning de Edge Functions | ✅ Já pinado + trava de CI adicionada nesta fase |
| Inventário de migrations locais | ✅ Completo (85, com criticidade e mapa de RPCs) |
| Drift local-vs-produção | ⛔ **Bloqueado** — MCP no projeto errado, sem CLI/token |
| Aplicar migrations faltantes | ⛔ Bloqueado (depende do diff) + decisão de produto/ambiente |
| Processo anti-drift no CI | 📝 Especificado; implementação depende de destravar acesso |
