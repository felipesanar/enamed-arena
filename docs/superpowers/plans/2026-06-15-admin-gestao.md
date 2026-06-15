# Admin Gestão Avançada (Fase 3) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Edição inline de questões + audit log de ações admin + validação de janelas. Comunicação com usuários FORA de escopo.

**Architecture:** Banco primeiro (audit infra → RPCs de questão + retrofit logging, via MCP, registradas em `supabase/migrations-log.md`), depois TS/serviço/hooks, UI do editor e da auditoria, validação de janelas. Cada task verde + commit.

**Tech:** React 18 + Vite + TS, Tailwind (tokens `--admin-*`), shadcn/Radix, TanStack Query 5, Supabase, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-15-admin-gestao-design.md` (fonte da verdade).

**Branch:** `feat/admin-gestao` (worktree `.claude/worktrees/admin-gestao`, base main com Fases 1+2).

**Regras (executor):** trabalhe SOMENTE no worktree (Set-Location, PowerShell); DDL via MCP `apply_migration`; toda RPC `SECURITY DEFINER SET search_path TO 'public'` + guard `admin_require(<cap>)` + `revoke from anon,public; grant to authenticated,service_role`; após migrations de função regenerar `src/integrations/supabase/types.ts` (MCP, substituir arquivo) e `npm run build`; logger `@/lib/logger`; toasts `@/hooks/use-toast`; alias `@/`; apêndice em `migrations-log.md`; trailer commits `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. Flakiness pré-existente de testes do aluno: confirmar isolado.

---

## Task G1: Migration — infra de auditoria

- [ ] **Step 1:** `apply_migration` name `admin_audit_infra`:
  - Tabela `admin_audit_log` (ver spec §3.1: id, actor_id uuid fk auth.users on delete set null, actor_email text, action text not null, entity_type text not null, entity_id uuid, summary text, metadata jsonb not null default '{}', created_at timestamptz default now()). Indexes (created_at desc), (entity_type, entity_id), (actor_id).
  - `alter table ... enable row level security`. Policy SELECT `"Auditores podem ler audit log" using (public.has_capability('audit.view'))`. Sem policy de escrita.
  - Seed: `insert into role_capabilities (role, capability) values ('admin','audit.view') on conflict do nothing;`
  - `admin_log_action(p_action text, p_entity_type text, p_entity_id uuid, p_summary text default null, p_metadata jsonb default '{}') returns void` — `SECURITY DEFINER set search_path 'public'`, VOLATILE. Se `auth.uid()` is null → return (no-op). Senão insert com actor_id=auth.uid(), actor_email=(select email from auth.users where id=auth.uid()). `revoke from anon,public; grant to authenticated,service_role`.
  - `admin_list_audit(p_days int default 30, p_action text default 'all', p_entity_type text default 'all', p_search text default '', p_limit int default 50, p_offset int default 0)` → TABLE(id uuid, actor_email text, action text, entity_type text, entity_id uuid, summary text, metadata jsonb, created_at timestamptz, total_count bigint). plpgsql STABLE SECURITY DEFINER, guard `admin_require('audit.view')`. Filtros: created_at>=now()-p_days days; (p_action='all' or action=p_action); (p_entity_type='all' or entity_type=p_entity_type); (p_search='' or summary ilike '%'||p_search||'%' or actor_email ilike '%'||p_search||'%'). total_count=count(*) over (). order created_at desc. limit/offset. grants.
  - Trigger fn `tg_admin_audit() returns trigger` SECURITY DEFINER: se `auth.uid()` is null → return coalesce(NEW,OLD); senão `perform admin_log_action(TG_OP, TG_TABLE_NAME, coalesce(NEW.id, OLD.id), <summary por tabela>, jsonb_build_object('op',TG_OP))`. summary: simulados→'Simulado '||coalesce(NEW.title,OLD.title); questions→'Questão '||coalesce(NEW.question_number,OLD.question_number)::text; question_options→'Alternativa '||coalesce(NEW.label,OLD.label). return coalesce(NEW,OLD).
  - Attach: `create trigger trg_audit_simulados after insert or update or delete on simulados for each row execute function tg_admin_audit();` idem `questions`, `question_options`.

- [ ] **Step 2:** Smoke: confirmar tabela/policy/grants/triggers existem; `admin_list_audit` existe e anon não executa; `admin_log_action` e trigger fn presentes. (Chamadas diretas dão P0003 sob MCP — esperado.) Verificar trigger: inspecionar `pg_trigger` nas 3 tabelas.

- [ ] **Step 3:** Apêndice migrations-log + commit `feat(admin-db): infra de auditoria (admin_audit_log, admin_log_action, triggers, admin_list_audit, capability audit.view)`.

## Task G2: Migration — RPCs de edição de questão + retrofit logging + regen types

- [ ] **Step 1:** `apply_migration` name `admin_question_editing` — 5 funções `content.manage` (guard, search_path, security definer, grants):
  - `admin_get_simulado_questions(p_simulado_id uuid)` → TABLE(id uuid, question_number int, text text, area text, theme text, difficulty text, explanation text, image_url text, explanation_image_url text, image_url_2 text, options jsonb). options = `(select jsonb_agg(jsonb_build_object('id',o.id,'label',o.label,'text',o.text,'is_correct',o.is_correct) order by o.label) from question_options o where o.question_id=q.id)`. order question_number. guard `content.manage`.
  - `admin_update_question(p_question_id uuid, p_text text, p_area text, p_theme text, p_difficulty text, p_explanation text, p_image_url text, p_explanation_image_url text, p_image_url_2 text) returns void` — if not exists question → raise 'not_found' errcode 'P0007'. update campos. guard `content.manage`.
  - `admin_update_option(p_option_id uuid, p_text text) returns void` — update question_options set text=p_text where id=p_option_id; if not found raise 'not_found' P0007. guard.
  - `admin_set_correct_option(p_question_id uuid, p_correct_option_id uuid) returns void` — if not exists (option where id=p_correct_option_id and question_id=p_question_id) raise 'invalid_option' P0008. update question_options set is_correct=(id=p_correct_option_id) where question_id=p_question_id. guard.
  - `admin_delete_question(p_question_id uuid) returns void` — if exists (attempt_question_results where question_id=p_question_id) raise 'question_has_answers' P0009. capture simulado_id; delete from questions where id=p_question_id (options cascade); update simulados set questions_count = greatest(questions_count-1,0) where id=simulado_id. guard.

- [ ] **Step 2:** Retrofit logging (CREATE OR REPLACE, preservar guard/comportamento) nas 5 RPCs — buscar def atual via pg_get_functiondef, adicionar UMA chamada `perform admin_log_action(...)` ao final do corpo (após a mutação bem-sucedida), envolvida em bloco tolerante `begin ... exception when others then null; end;` para nunca abortar a ação:
  - `admin_set_user_role(p_user_id,p_role,p_grant)`: action = case p_grant when true then 'grant_role' else 'revoke_role' end, entity 'user', entity_id=p_user_id, summary 'Papel '||p_role||(case when p_grant then ' concedido' else ' revogado' end), metadata jsonb_build_object('role',p_role,'grant',p_grant). (Manter guards P0004/P0005/P0006 existentes.)
  - `admin_set_user_segment(p_user_id,p_segment)`: 'set_segment','user', summary 'Segmento alterado para '||p_segment, metadata {segment}.
  - `admin_reset_user_onboarding(p_user_id)`: 'reset_onboarding','user', summary 'Onboarding reiniciado'.
  - `admin_cancel_attempt(p_attempt_id)`: 'cancel_attempt','attempt', summary 'Tentativa cancelada'.
  - `admin_delete_attempt(p_attempt_id)`: 'delete_attempt','attempt', summary 'Tentativa excluída'.

- [ ] **Step 3:** Smoke (via execute_sql, lógica sem guard onde possível): as funções existem com prosecdef=true, anon não executa, guards presentes. Verificar via clone-sem-guard ou inspeção que admin_get_simulado_questions monta options jsonb corretamente para uma questão real; admin_delete_question bloquearia (P0009) numa questão com respostas (escolher uma com attempt_question_results e confirmar a condição). NÃO execute deletes reais em produção.

- [ ] **Step 4:** Regenerar types.ts (MCP, extrair `.types`, escrever arquivo, confirmar começa com `export type Json =` e contém `admin_get_simulado_questions`, `admin_list_audit`, `admin_audit_log`). `npm run build` verde.

- [ ] **Step 5:** migrations-log + commit `feat(admin-db): RPCs de edicao de questao + logging de auditoria nas RPCs mutadoras + regen types`.

## Task G3: Tipos, serviço e hooks (frontend)

**Files:** `src/admin/types.ts`, `src/admin/services/adminApi.ts`, `src/admin/hooks/useAdminQuestionEditor.ts` (novo), `src/admin/hooks/useAdminAudit.ts` (novo).

- [ ] **Step 1:** types.ts append:
  ```ts
  export interface AdminQuestionOption { id: string; label: string; text: string; is_correct: boolean }
  export interface AdminQuestionFull { id: string; question_number: number; text: string; area: string; theme: string; difficulty: string; explanation: string | null; image_url: string | null; explanation_image_url: string | null; image_url_2: string | null; options: AdminQuestionOption[] }
  export interface AuditLogRow { id: string; actor_email: string | null; action: string; entity_type: string; entity_id: string | null; summary: string | null; metadata: Record<string, unknown>; created_at: string; total_count: number }
  ```
- [ ] **Step 2:** adminApi append (padrão dos vizinhos):
  - `getSimuladoQuestions(simuladoId): Promise<AdminQuestionFull[]>` → rpc admin_get_simulado_questions.
  - `updateQuestion(id, payload: {text,area,theme,difficulty,explanation,image_url,explanation_image_url,image_url_2})` → rpc admin_update_question (mapear p_*).
  - `updateOption(optionId, text)` → rpc admin_update_option.
  - `setCorrectOption(questionId, optionId)` → rpc admin_set_correct_option.
  - `deleteQuestion(id)` → rpc admin_delete_question.
  - `listAudit(params: {days,action,entityType,search,limit,offset})` → rpc admin_list_audit (mapear p_*); retorna AuditLogRow[].
- [ ] **Step 3:** `useAdminQuestionEditor.ts`: `useAdminSimuladoQuestions(simuladoId)` (query, enabled !!id, staleTime 60_000) + mutations `useUpdateQuestion`/`useUpdateOption`/`useSetCorrectOption`/`useDeleteQuestion` (cada uma invalida `['admin','questions',simuladoId]`, onSuccess toast sucesso, onError toast mapeando P0007/P0008/P0009 → pt-BR via checagem de error.message: 'question_has_answers'→"Esta questão já foi respondida e não pode ser excluída.", 'invalid_option'→"Alternativa inválida.", 'not_found'→"Registro não encontrado."). `useAdminAudit.ts`: `useAdminAudit(filtros)` query keyed nos filtros, staleTime 30_000.
- [ ] **Step 4:** `tsc` limpo, build verde. Commit `feat(admin): tipos, servico e hooks de edicao de questoes e auditoria`.

## Task G4: UI — editor de questões

**Files:** `src/admin/pages/AdminQuestionManager.tsx` (novo), `src/App.tsx` (rota), `src/admin/pages/AdminSimulados.tsx` (link "Editar questões"), teste.

- [ ] **Step 1:** `AdminQuestionManager.tsx` (default export gated `content.manage`, wrapper `*Content`). Usa `useParams` (id do simulado), `useAdminSimuladoQuestions(id)`. `AdminPageHeader` (title "Editar questões", subtitle com simulado, action = voltar para `/admin/simulados`). Lista (`AdminDataTable` ou cards): nº, trecho do enunciado (truncado), área/tema (`AdminBadge`-like ou texto), badge da alternativa correta. Botão "Editar" por linha abre `<QuestionEditDialog>`.
- [ ] **Step 2:** `QuestionEditDialog` (componente no mesmo arquivo ou `src/admin/components/QuestionEditDialog.tsx`): Dialog shadcn com tokens admin. Form local (useState) inicializado da questão. Campos: enunciado `Textarea`, área/tema `Input`, dificuldade `Select` (easy/medium/hard), explicação `Textarea`, image_url/explanation_image_url/image_url_2 `Input`. Opções: lista A–D, cada uma `Input` de texto + `RadioGroup` (uma correta). Aviso discreto: "Alterações não recalculam tentativas já finalizadas." Botões: Salvar (chama useUpdateQuestion com os campos; para cada opção com texto alterado chama useUpdateOption; se a correta mudou chama useSetCorrectOption — aguarde as mutations e feche no sucesso), Cancelar, Excluir (AdminConfirmDialog destrutivo → useDeleteQuestion; erro P0009 mostra toast e mantém aberto). Diff: só chamar updateOption para opções cujo texto mudou; só setCorrectOption se mudou.
- [ ] **Step 3:** rota em `src/App.tsx`: lazy `AdminQuestionManager`, `<Route path="simulados/:id/questoes/editar" element={<Suspense...><AdminQuestionManager/></Suspense>} />` no bloco admin.
- [ ] **Step 4:** `AdminSimulados.tsx`: adicionar link/botão "Editar questões" na linha do simulado (ao lado de "Enviar questões"/analytics) → `/admin/simulados/${id}/questoes/editar`.
- [ ] **Step 5:** teste `src/admin/__tests__/AdminQuestionManager.test.tsx` (renderWithAccess content.manage; mock useAdminQuestionEditor): lista renderiza questões mock; abrir editor mostra campos; selecionar outra correta + salvar chama setCorrectOption/updateQuestion. tsc/build/`vitest run src/admin` verdes.
- [ ] **Step 6:** commit `feat(admin): editor inline de questoes (enunciado, alternativas, gabarito, area/tema)`.

## Task G5: UI — página de auditoria + validação de janelas

**Files:** `src/admin/pages/AdminAuditoria.tsx` (novo), `src/admin/lib/navigation.ts` (grupo Governança + item), `src/App.tsx` (rota), `src/admin/pages/AdminSimuladoForm.tsx` (validação), `src/admin/lib/validateWindows.ts` (novo, testável), testes.

- [ ] **Step 1:** `navigation.ts`: novo grupo `{ title: 'Governança', items: [{ to:'/admin/auditoria', label:'Auditoria', icon: ScrollText, capability:'audit.view' }] }` ao final do ADMIN_NAV (import ScrollText de lucide-react).
- [ ] **Step 2:** `AdminAuditoria.tsx` (gated `audit.view`, wrapper `*Content`). Estado: days(30), action('all'), entityType('all'), search(''), page(1). `useAdminAudit({days,action,entityType,search,limit:50,offset:(page-1)*50})`. `AdminPageHeader` (title "Auditoria", subtitle, actions = filtros: selects de período/ação/entidade + busca com `useDebounce`). `AdminDataTable`: colunas data/hora (toLocaleString pt-BR), autor (actor_email ?? 'sistema'), ação (label amigável), entidade, resumo. Linha expansível (estado de linha aberta) → bloco com `<pre>` do metadata formatado (JSON.stringify, 2). Paginação (total_count). Estados loading/erro/vazio (`AdminEmptyState`). Labels amigáveis de ação via um pequeno mapa local (grant_role→"Papel concedido", INSERT→"Criação", etc.).
- [ ] **Step 3:** rota `auditoria` em App.tsx (lazy + Suspense, bloco admin).
- [ ] **Step 4:** `src/admin/lib/validateWindows.ts`: `export function validateWindows(start, end, release): string | null` — retorna mensagem de erro pt-BR ou null. Regras: start<end ("A janela deve terminar depois de começar."); release>=end ("A liberação de resultados deve ser após o fim da janela."). Tratar campos vazios (não validar se algum vazio → null). Teste `validateWindows.test.ts` cobrindo os casos.
- [ ] **Step 5:** `AdminSimuladoForm.tsx`: no submit, chamar `validateWindows`; se mensagem, toast destrutivo e abortar submit. Import do helper.
- [ ] **Step 6:** teste de `AdminAuditoria` (render com mock + empty) e de navigation (grupo Governança aparece com audit.view, some sem). tsc/build/`vitest run src/admin` verdes.
- [ ] **Step 7:** commit `feat(admin): pagina de auditoria + validacao de janelas no form de simulado`.

## Task G6: Verificação final + review + merge

- [ ] **Step 1:** `npm run test` + `npm run lint` (0 erros) + `npm run build` + `tsc` verdes (flaky aluno: isolar).
- [ ] **Step 2:** Smoke no banco vivo: chamar (com contexto admin se possível, ou validar via componentes) — gerar um log real via admin_set_user_segment num usuário de teste e confirmar linha em admin_audit_log + admin_list_audit retornando; editar uma questão de teste e confirmar log via trigger; confirmar delete bloqueado (P0009) numa questão respondida; guards audit.view/content.manage negam sem capability; anon não executa as novas RPCs.
- [ ] **Step 3:** review final da branch (code-reviewer no range main..HEAD): integração (capabilities content.manage/audit.view consistentes em nav/rotas/páginas/RPCs), FK-safety (delete bloqueado, options editadas in place), audit não bloqueia ação principal, resiliência a vazio, sem regressão no app do aluno/Fases 1-2, a11y.
- [ ] **Step 4:** fixes do review; atualizar memória (status Fase 3).
- [ ] **Step 5:** merge `--no-ff` na main (resolver conflito de types.ts via regeneração se ocorrer), verificar tsc/build/test no merge, remover worktree, deletar branch (finishing-a-development-branch, opção merge local). Não pushar.

---

## Riscos e contingências
- **FK NO ACTION em attempt_question_results:** nunca delete+recreate options; edição in place por id. delete_question bloqueado se houver respostas (P0009). Coberto.
- **Trigger de auditoria em massa:** upload via service role tem auth.uid() null → no-op (não polui). Edições via RPC admin preservam auth.uid() do caller → logadas.
- **Audit não pode quebrar a ação:** chamadas explícitas em bloco tolerante; trigger AFTER.
- **types.ts conflito no merge:** arquivo gerado; tomar a versão regenerada do banco vivo (superset), como nas fases anteriores.
- **Editar gabarito não recalcula histórico:** documentado no UI; é decisão de produto (correção de conteúdo ≠ reprocessamento).
