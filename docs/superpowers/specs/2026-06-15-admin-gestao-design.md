# Admin — Gestão Avançada (Fase 3 do programa "Central de Gestão")

**Data:** 2026-06-15
**Status:** design autônomo (autonomia concedida; "comunicação com usuários" deliberadamente fora de escopo — ver §0)
**Branch:** `feat/admin-gestao` (worktree `.claude/worktrees/admin-gestao`, base = main com Fases 1+2)

## 0. Escopo e decisão de fronteira

A Fase 3 entrega **capacidades de gestão** que o time pode executar direto na plataforma. Dos quatro pilares previstos no programa:

- ✅ **Edição inline de questões** — maior lacuna funcional: hoje questões só podem ser criadas via upload XLSX; não há como corrigir um enunciado, alternativa, gabarito, área/tema ou explicação sem re-upload.
- ✅ **Audit log de ações admin** — governança: hoje **nenhuma** ação admin é registrada. Com 4 papéis e ações destrutivas (deletar conta/tentativa, mudar papel, editar conteúdo), rastreabilidade é essencial.
- ✅ **Validação de janelas de execução** — pequeno reforço no form de simulado (start < end ≤ results_release_at).
- ⛔ **Comunicação com usuários (e-mail/Novu)** — **FORA DE ESCOPO** nesta fase: dispara e-mails reais a ~6,6k usuários (ação externa irreversível). Requer opt-in explícito do usuário e desenho próprio (segmentação, templates, opt-out, rate-limit). Registrado para fase futura.

Tudo ancorado nos padrões das Fases 1-2: RPCs `SECURITY DEFINER` com `admin_require(<cap>)`, tokens `--admin-*`, gating por capability, componentes admin existentes.

## 1. Realidade do banco (verificada no banco vivo)

- `has_capability(p_capability text)` — 1 arg, usa `auth.uid()` internamente.
- `questions(id, simulado_id, question_number, text, area, theme, difficulty, image_url, explanation, explanation_image_url, image_url_2, created_at)`; policies admin INSERT/UPDATE/DELETE já por `content.manage`.
- `question_options(id, question_id, label, text, is_correct, created_at)`; **a opção correta é `is_correct=true`** numa linha. policies admin por `content.manage`.
- `attempt_question_results` referencia `selected_option_id` e `correct_option_id` (FK **NO ACTION**) e `question_id`. **Implicação crítica:** não se pode `delete`+`recreate` de options nem deletar questão já respondida sem corromper histórico/notas. Edição de options é **in place por id**; delete de questão é **bloqueado** se houver respostas.
- Capabilities atuais (9): dashboard.view, content.manage, users.view, users.manage, attempts.view, attempts.manage, intel.view, previews.view, roles.manage. **Nova:** `audit.view`.
- Sem tabela de auditoria.

## 2. Pilar A — Edição inline de questões

### 2.1 RPCs (migrations, `content.manage`, audit via trigger — ver §3)
Todas `SECURITY DEFINER SET search_path TO 'public'`, guard `perform public.admin_require('content.manage')`, `revoke execute from anon, public; grant to authenticated, service_role`. Escrevem em `questions`/`question_options` (o trigger de auditoria captura automaticamente).

- `admin_update_question(p_question_id uuid, p_text text, p_area text, p_theme text, p_difficulty text, p_explanation text, p_image_url text, p_explanation_image_url text, p_image_url_2 text) returns void` — atualiza os campos escalares da questão. `updated_at` não existe na tabela; não adicionar (manter schema). Valida que a questão existe (senão raise `not_found`/P0007).
- `admin_update_option(p_option_id uuid, p_text text) returns void` — edita o texto de UMA opção in place (preserva id e FKs).
- `admin_set_correct_option(p_question_id uuid, p_correct_option_id uuid) returns void` — marca `is_correct=true` na opção alvo e `false` nas demais da questão, numa transação. Valida que a opção pertence à questão (senão raise `invalid_option`/P0008).
- `admin_delete_question(p_question_id uuid) returns void` — **bloqueia** se `exists (select 1 from attempt_question_results where question_id = p_question_id)` → raise `question_has_answers`/P0009. Senão deleta (options caem por cascade). Reajusta `simulados.questions_count` (decrementa).

**Fora de escopo (re-upload cobre):** adicionar/remover opções de uma questão; criar questão nova inline; reordenar. Editor opera sobre a estrutura existente (corrigir conteúdo), não recriar.

### 2.2 Serviço/hooks/tipos
- `types.ts`: `AdminQuestionFull` (questão + array de options {id,label,text,is_correct}) — reaproveita o que `admin_simulado_question_stats` não traz; precisamos de uma leitura crua. Adicionar RPC de leitura `admin_get_simulado_questions(p_simulado_id uuid)` → `TABLE(id uuid, question_number int, text text, area text, theme text, difficulty text, explanation text, image_url text, explanation_image_url text, image_url_2 text, options jsonb)` (options = array de {id,label,text,is_correct} ordenado por label), guard `content.manage`. (Admin precisa ver `is_correct`, que a policy pública esconde — por isso RPC SECURITY DEFINER.)
- `adminApi`: `getSimuladoQuestions(simuladoId)`, `updateQuestion(id, payload)`, `updateOption(id, text)`, `setCorrectOption(questionId, optionId)`, `deleteQuestion(id)`.
- `useAdminQuestionEditor.ts`: `useAdminSimuladoQuestions(simuladoId)` (query) + mutations (`useUpdateQuestion`, `useUpdateOption`, `useSetCorrectOption`, `useDeleteQuestion`) com invalidação da query da lista e toasts (`@/hooks/use-toast`).

### 2.3 UI — `AdminQuestionManager` (`/admin/simulados/:id/questoes/editar`)
Página gated `content.manage` (wrapper `*Content` + `AdminCapabilityGate`). `AdminPageHeader` (title "Editar questões", subtitle = `#seq — título`, breadcrumb de volta ao simulado). Lista de questões (número, trecho do enunciado, área/tema, badge da alternativa correta) — `AdminDataTable` ou lista. Clique abre **editor em Dialog**:
- Campos: enunciado (`Textarea`), área/tema (`Input`), dificuldade (`Select`: easy/medium/hard), explicação (`Textarea`), URLs de imagem (`Input`).
- Opções A–D: cada uma `Input` de texto + `RadioGroup`/seleção de "correta" (uma única). Salvar texto via `updateOption`; correta via `setCorrectOption`.
- Botões: Salvar (chama `updateQuestion` + options alteradas), Cancelar, Excluir questão (`AdminConfirmDialog` destrutivo; desabilitado/explicado se a questão já tem respostas — a RPC bloqueia e o front mostra o erro amigável).
- Preview ao vivo opcional reutilizando o layout do `QuestionPreviewModal`.
Entrada: link "Editar questões" na linha do simulado em `AdminSimulados` (além do "Enviar questões" existente) e/ou na própria página de upload.

## 3. Pilar B — Audit log

### 3.1 Tabela + infra (migration)
```
admin_audit_log(
  id uuid pk default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  actor_email text,
  action text not null,            -- 'INSERT'|'UPDATE'|'DELETE'|'grant_role'|'revoke_role'|'set_segment'|'reset_onboarding'|'cancel_attempt'|'delete_attempt'
  entity_type text not null,       -- 'simulado'|'question'|'question_option'|'user'|'attempt'
  entity_id uuid,
  summary text,                    -- legível: "Gabarito da questão 12 alterado"
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
)
```
- Index: `(created_at desc)`, `(entity_type, entity_id)`, `(actor_id)`.
- RLS on; policy SELECT `using (public.has_capability('audit.view'))`; **sem policy de escrita** (só funções SECURITY DEFINER inserem).
- Seed: `insert into role_capabilities (role, capability) values ('admin','audit.view') on conflict do nothing;` (apenas admin nesta fase).

### 3.2 Logging
- Helper `admin_log_action(p_action text, p_entity_type text, p_entity_id uuid, p_summary text, p_metadata jsonb default '{}') returns void` — `SECURITY DEFINER`, insere linha com `actor_id = auth.uid()` e `actor_email = (select email from auth.users where id = auth.uid())`. No-op se `auth.uid()` é null (ações de sistema/service-role, ex.: upload em massa, não poluem o log).
- **Triggers** `tg_admin_audit()` AFTER INSERT/UPDATE/DELETE em `simulados`, `questions`, `question_options`: chama `admin_log_action(TG_OP, TG_TABLE_NAME, <id>, <summary>, jsonb)` **somente quando `auth.uid()` is not null** (captura edições feitas pela UI admin; ignora upload em massa via service role). summary genérico por tabela; entity_id = NEW.id/OLD.id.
- **Logging explícito** (retrofit, `CREATE OR REPLACE`, preservando comportamento e guards atuais) nas 5 RPCs mutadoras de usuário/tentativa, cada uma com summary semântico:
  - `admin_set_user_role` → action 'grant_role'/'revoke_role', entity 'user', metadata {role, grant}.
  - `admin_set_user_segment` → 'set_segment', metadata {segment}.
  - `admin_reset_user_onboarding` → 'reset_onboarding'.
  - `admin_cancel_attempt` → 'cancel_attempt', entity 'attempt'.
  - `admin_delete_attempt` → 'delete_attempt', entity 'attempt'.
  (Tabelas `user_roles`/`profiles`/`attempts` NÃO recebem trigger — são escritas também por alunos; logging fica nas RPCs admin específicas.)

### 3.3 Leitura + UI
- `admin_list_audit(p_days int default 30, p_action text default 'all', p_entity_type text default 'all', p_search text default '', p_limit int default 50, p_offset int default 0)` → `TABLE(id uuid, actor_email text, action text, entity_type text, entity_id uuid, summary text, metadata jsonb, created_at timestamptz, total_count bigint)`. guard `audit.view`. Filtra por janela, ação, entidade e busca textual no summary/actor_email. Ordena `created_at desc`. `total_count` via `count(*) over ()`.
- Página **"Auditoria"** (`/admin/auditoria`, capability `audit.view`) — novo grupo **"Governança"** na navegação (ou em "Ferramentas"). `AdminPageHeader` + filtros (período, ação, entidade, busca) + `AdminDataTable` paginado (data/hora, autor, ação, entidade, resumo) + linha expansível mostrando `metadata` (JSON formatado). `AdminBadge`-like para ação/entidade. Estados loading/erro/vazio.
- Hooks/serviço: `adminApi.listAudit(...)`, `useAdminAudit(filtros)`.

## 4. Pilar C — Validação de janelas (AdminSimuladoForm)
Validação client-side antes do submit: `execution_window_start < execution_window_end`; `results_release_at >= execution_window_end`. Mensagens inline (toast destrutivo ou erro no campo). Sem mudança de schema. Pequeno, isolado.

## 5. Navegação, rotas, paleta
- `navigation.ts`: novo grupo **"Governança"** com item **Auditoria** (`/admin/auditoria`, icon `ScrollText`/`History`, capability `audit.view`). (Grupo só aparece para quem tem a capability — hoje só admin.)
- `App.tsx`: rotas lazy `auditoria` e `simulados/:id/questoes/editar` (esta sob `content.manage`, dentro do bloco admin).
- Command registry: itens novos entram via ADMIN_NAV (auditoria) automaticamente; ação opcional "Editar questões" não é global (precisa de simulado em contexto) — omitir do registry.

## 6. Tratamento de erros e bordas
- Novos códigos de erro: P0007 not_found, P0008 invalid_option, P0009 question_has_answers — o front mapeia para toasts pt-BR ("Esta questão já foi respondida e não pode ser excluída.", etc.). Demais mantêm contrato unauthorized/P0003.
- Editar opção/gabarito de questão **já respondida** é permitido (correção de conteúdo) mas NÃO recalcula notas históricas — documentar no UI um aviso discreto ("Alterações não recalculam tentativas já finalizadas."). Apenas o DELETE é bloqueado.
- Audit log nunca bloqueia a ação principal: se `admin_log_action` falhasse, não deve abortar a mutação — envolver a chamada explícita em bloco tolerante (`begin ... exception when others then null; end;`); o trigger é AFTER e tolerante.
- `admin_list_audit` degrada para vazio.

## 7. Testes e verificação
- Unit (Vitest): `navigation`/registry incluem Auditoria (grupo Governança, gated); validação de janelas (função pura de validação em AdminSimuladoForm — extrair `validateWindows(start,end,release)` testável); editor de questão (render, seleção de correta, submit chama mutations corretas — com hooks mockados); página de auditoria (render com dados mock + empty/erro); mapeamento de erros P0007-P0009 → mensagens.
- `npm run test`, `npm run lint` (0 erros), `npm run build`, `tsc` verdes.
- Smoke no banco vivo: criar audit via uma chamada controlada (ex.: chamar admin_set_user_segment num usuário de teste e ver a linha no log); admin_list_audit retorna; RPCs de questão editam corretamente um registro de teste e o trigger gera log; delete bloqueado em questão com respostas; guards `content.manage`/`audit.view` negam sem a capability; anon não executa.
- Verificação visual autenticada (editor + auditoria) fica para o usuário (credenciais).

## 8. Fora de escopo (registrado)
- Comunicação com usuários (e-mail/push/Novu) — requer opt-in explícito.
- Adicionar/remover opções e criar questões inline (re-upload cobre).
- Recálculo de notas históricas após edição de gabarito.
- Reversão/undo de ações via audit log (somente leitura nesta fase).
- UI de gestão de janelas além da validação (reabrir/estender janela com efeitos em tentativas).
