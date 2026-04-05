# Admin Central — Fase 2: Central de Usuários + Simulados Analítica

**Data:** 2026-04-05
**Status:** Aprovado — pronto para implementação
**Fase:** P0-B (depende da Fase 1 — shell + dashboard)
**Escopo:** Central de Usuários com gestão completa + Simulados com analytics por questão

---

## Contexto

A Fase 1 entregou o shell de navegação (rail + flyout + topbar) e o Dashboard Executivo. A Fase 2 implementa dois dos três módulos P0 do grupo "Dados":

- **Central de Usuários** — lista paginada com busca/filtro + página de detalhe com gestão completa
- **Simulados Analítica** — lista aprimorada com métricas resumidas + drill-down por simulado com analytics por questão

**Fora do escopo desta fase:**
- Central de Suporte (requer nova infraestrutura de tickets — Fase 3)
- Módulos P1 (tentativas, analytics, marketing, produto, tecnologia, auditoria)

---

## Rotas

```
/admin/usuarios                    → AdminUsuarios.tsx         (substitui stub P0)
/admin/usuarios/:id                → AdminUsuarioDetail.tsx    (nova página)
/admin/simulados                   → AdminSimulados.tsx        (aprimorado, CRUD intacto)
/admin/simulados/:id/analytics     → AdminSimuladoAnalytics.tsx (nova página)
```

---

## Módulo A — Central de Usuários

### A.1 Lista (`/admin/usuarios`)

**Layout:** tabela compacta com paginação (25/página).

**Colunas:**
| Coluna | Fonte |
|--------|-------|
| Avatar + Nome + E-mail | `profiles` + `auth.users` (via RPC) |
| Segmento (badge) | `profiles.segment` |
| Especialidade | `onboarding_profiles.specialty` |
| Cadastro | `profiles.created_at` |
| Média / Provas | `user_performance_summary.avg_score` + `total_attempts` |
| Ação → | navega para `/admin/usuarios/:id` |

**Controles:**
- Campo de busca por nome ou e-mail (debounce 300ms)
- Pills de filtro: Todos · Guest · Standard · PRO
- Botão "Exportar CSV" (todos os usuários filtrados)

### A.2 Detalhe (`/admin/usuarios/:id`)

**Layout de duas colunas:**

**Coluna esquerda (280px fixo):**
- Avatar + nome + e-mail + badge de segmento
- 4 KPIs de performance: média geral, melhor nota, total de provas, última nota
- Data de cadastro, último acesso, User ID (truncado)
- **Painel de Ações** (5 ações):
  1. **Alterar segmento** — `<select>` com `guest / standard / pro` → `admin_set_user_segment`
  2. **Conceder/Revogar papel admin** — botão toggle → `admin_set_user_role`
  3. **Resetar onboarding** — botão + confirmação inline → `admin_reset_user_onboarding`
  4. **Exportar dados** — gera CSV client-side com tentativas + respostas
  5. **Excluir conta** — botão `danger` + modal de confirmação → Edge Function `admin-delete-user`

**Coluna direita (flex-1):**
- Card **Onboarding**: especialidade alvo (tag primária) + instituições alvo (tags)
- Card **Histórico de tentativas** (últimas 10): simulado, data, status (`submitted`/`expired`/`in_progress`), nota, posição no ranking

---

## Módulo B — Simulados Analítica

### B.1 Lista aprimorada (`/admin/simulados`)

O `AdminSimulados.tsx` existente ganha 4 colunas analíticas e um novo botão de ação. O CRUD existente (criar, editar, upload, deletar) **não é alterado**.

**Novas colunas adicionadas:**
| Coluna | Fonte |
|--------|-------|
| Participantes | `admin_simulado_engagement` (já existe) |
| Conclusão (+ mini-barra) | `admin_simulado_engagement.completion_rate` |
| Média (+ mini-barra) | `admin_simulado_engagement.avg_score` |
| Abandono | `admin_simulado_engagement.abandonment_rate` |

**Novo botão de ação:** ícone 📊 por linha → navega para `/admin/simulados/:id/analytics`. Desabilitado (opacity 30%) se o simulado não tem participantes (`status = 'draft'` ou `participants = 0`).

### B.2 Analytics por simulado (`/admin/simulados/:id/analytics`)

**5 KPIs no topo:**
| KPI | Fonte |
|-----|-------|
| Participantes | `admin_simulado_detail_stats` |
| Taxa de conclusão | `admin_simulado_detail_stats` |
| Média geral | `admin_simulado_detail_stats` |
| Taxa de abandono | `admin_simulado_detail_stats` |
| Tempo médio (min) | `admin_simulado_detail_stats` |

**Tabela por questão** (ordenada por taxa de acerto, da menor para maior):
| Coluna | Fonte / Cálculo |
|--------|-----------------|
| Q# | `questions.question_number` |
| Enunciado (truncado 60 chars) | `questions.text` |
| Taxa de acerto (barra visual) | `attempt_question_results` — `is_correct = true / total` |
| Índice de discriminação | Alta (≥0.3) / Média (0.1–0.29) / Baixa (<0.1) — diferença entre top 27% e bottom 27% |
| Alternativa errada mais comum | `answers` — opção não-correta mais frequente, com `question_options.label` + % |

---

## Banco de Dados — Novas RPCs

Todas as funções são `SECURITY DEFINER` com verificação de role admin no início (`user_roles WHERE user_id = auth.uid() AND role = 'admin'`).

### RPCs de Leitura

**`admin_list_users(p_search text, p_segment text, p_limit int, p_offset int)`**
- Faz JOIN entre `profiles`, `auth.users` (email), `onboarding_profiles`, `user_performance_summary`
- Suporta busca por `full_name ILIKE` ou `email ILIKE`
- Filtra por `segment` quando `p_segment != 'all'`
- Retorna também `total_count` para paginação

**`admin_get_user(p_user_id uuid)`**
- Retorna perfil completo: todos os campos de `profiles` + `email` e `last_sign_in_at` de `auth.users` + `onboarding_profiles` + `user_performance_summary` + flag `is_admin` (de `user_roles`)

**`admin_get_user_attempts(p_user_id uuid, p_limit int default 10)`**
- JOIN entre `attempts`, `simulados`, `user_performance_history`
- Retorna: `simulado_title`, `sequence_number`, `created_at`, `status`, `score_percentage`, posição no ranking (subquery em `user_performance_history`)

**`admin_simulado_detail_stats(p_simulado_id uuid)`**
- Estende `admin_simulado_engagement` com: `avg_time_minutes` (de `attempts.submitted_at - attempts.started_at`)

**`admin_simulado_question_stats(p_simulado_id uuid)`**
- Agrega de `attempt_question_results` JOIN `questions` JOIN `question_options`
- Para cada questão: `correct_rate`, `discrimination_index` (top 27% vs bottom 27%), `most_common_wrong_option_label`, `most_common_wrong_option_pct`
- Ordenado por `correct_rate ASC` (questões mais difíceis primeiro)

### RPCs de Ação

**`admin_set_user_segment(p_user_id uuid, p_segment user_segment)`**
- `UPDATE profiles SET segment = p_segment WHERE id = p_user_id`

**`admin_set_user_role(p_user_id uuid, p_role text, p_grant boolean)`**
- `p_grant = true`: INSERT INTO user_roles (com ON CONFLICT DO NOTHING)
- `p_grant = false`: DELETE FROM user_roles WHERE user_id = p_user_id AND role = p_role

**`admin_reset_user_onboarding(p_user_id uuid)`**
- DELETE FROM onboarding_profiles WHERE user_id = p_user_id

### Edge Function — Exclusão de Conta

**`supabase/functions/admin-delete-user/index.ts`**
- Verifica token JWT do chamador via `supabase.auth.getUser()`
- Confirma que o chamador tem role `admin` em `user_roles`
- Chama `supabase.auth.admin.deleteUser(p_user_id)` com service_role
- Retorna `{ success: true }` ou erro estruturado

---

## Arquivos Modificados / Criados

| Arquivo | Ação |
|---------|------|
| `supabase/migrations/20260405230000_admin_phase2_rpcs.sql` | Criar — 5 RPCs leitura + 3 RPCs ação |
| `supabase/functions/admin-delete-user/index.ts` | Criar — Edge Function exclusão |
| `src/admin/types.ts` | Modificar — +4 interfaces: `UserListRow`, `UserDetail`, `UserAttemptRow`, `SimuladoQuestionStat` |
| `src/admin/services/adminApi.ts` | Modificar — +8 métodos analytics/usuários |
| `src/admin/hooks/useAdminUsuarios.ts` | Criar — hooks React Query para usuários |
| `src/admin/hooks/useAdminSimuladosAnalytics.ts` | Criar — hooks React Query para analytics |
| `src/admin/pages/AdminUsuarios.tsx` | Criar — substitui stub, lista com busca/filtro/paginação |
| `src/admin/pages/AdminUsuarioDetail.tsx` | Criar — página de detalhe + ações |
| `src/admin/pages/AdminSimuladoAnalytics.tsx` | Criar — drill-down analítico por simulado |
| `src/admin/pages/AdminSimulados.tsx` | Modificar — +colunas analíticas + botão 📊 |
| `src/admin/__tests__/AdminUsuarios.test.tsx` | Criar — testes lista |
| `src/admin/__tests__/AdminUsuarioDetail.test.tsx` | Criar — testes detalhe + ações |
| `src/App.tsx` | Modificar — +2 rotas lazy |

---

## Testes

**`AdminUsuarios.test.tsx`:**
- Renderiza tabela com dados mockados
- Filtro por segmento filtra corretamente
- Busca por nome/e-mail chama RPC com parâmetro correto

**`AdminUsuarioDetail.test.tsx`:**
- Renderiza todas as seções (perfil, performance, onboarding, histórico)
- Mudança de segmento chama `admin_set_user_segment`
- Botão de excluir abre modal de confirmação antes de chamar Edge Function

---

## Notas de implementação

- **E-mail via auth.users:** só acessível por função SECURITY DEFINER; nunca expor diretamente via query client-side
- **Discriminação por questão:** cálculo no SQL (`percentil 73+ vs 27-` de `score_percentage`); evitar calcular no cliente para datasets grandes
- **Export CSV:** gerado client-side com `Blob` + `URL.createObjectURL`; chamar os hooks existentes para buscar os dados
- **Segmento:** o frontend apenas altera via RPC admin; a lógica de acesso a features permanece em `useHasAccess` / `ProGate` sem alteração
- **`attempt_status`:** ao exibir histórico de tentativas, `submitted` e `expired` são "finalizados"; `in_progress` é em andamento. Nunca usar `completed` (não existe no enum)
