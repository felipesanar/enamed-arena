# Contratos de edição — expansão 2027

Fonte: HANDOFF-2027.md e auditoria, seção C. Revisão operacional de 04/11/2026. A Fase 1 está empilhada na Fase 0 enquanto o rollout do banco aguarda autorização. Nenhuma migration foi aplicada em produção.

## Compatibilidade e escolhas reversíveis

- O DTO `ExamEdition` mantém os nomes SQL snake_case da Fase 0. `ExamFormat` documenta o JSON existente (`duration_minutes`, `proficient_min`). A fronteira de leitura valida o JSON; não inventa uma nota TRI a partir de acertos.
- Campos novos de `SimuladoConfig` e `OnboardingProfile` são opcionais durante expand. Campos ausentes não são silenciosamente atribuídos à edição corrente; dados legados sem associação ficam fora de seletores com filtro explícito.
- `resolveUserEdition(editions, profile, now)`: alvo explícito válido, inclusive histórico; depois termo de graduação igual a `code`; depois edição futura mais próxima; sem datas, primeira `preparing`/`active` por ano/termo. `planned` sem data é último fallback para preservar a Fase 0. Não usa ano do relógio como data oficial.
- `selectCurrentSimulado(simulados, edition, now)` só considera a edição pedida. Prioridade: tentativa em andamento (mais recente), janela aberta (fecha primeiro), próximo agendado (abre primeiro), aguardando resultado, último resultado liberado, treino. Desempates por data, sequência e id. Nenhuma opção retorna `null`; edição ausente retorna `null`.
- `formatSimuladoLabel(sim)`: `{editionCode} · Simulado {sequenceNumber}`; legado sem código usa `Simulado {sequenceNumber}`. O rótulo da edição não é inferido da sequência.
- A flag `editions_ui` vem de `public.app_config`; padrão/falha/ausência = false. UI nova e queries que exigem campos novos ficam condicionadas à flag. Nenhuma chamada inexistente bloqueia as telas antigas.
- Numeração reinicia por edição; histórico 2026 permanece acessível como treino. KPIs da edição excluem treino quando o filtro novo está ativo. Cortes sem fonte confirmada continuam legados, sem backfill de referência inventada.
- Não mapear `Preventiva` ou área composta ambígua sem decisão de Conteúdo. Relatório de pendências impede declarar o backfill finalizado. Pesos uniformes são explicitamente provisórios.

## Assinaturas SQL previstas

Não são migrations executáveis nem stubs. Implementar em migrations idempotentes com ACL explícita, validação, auditoria e rollback comentado. Consultar definição real antes de substituir funções existentes; parâmetros novos têm DEFAULT NULL.

```sql
-- app_config: key text primary key, value jsonb not null, updated_at timestamptz.
-- editions_ui = false; leitura autenticada, escrita somente admin.
-- exam_blueprints: id uuid, code unique, label, weights_provisional boolean.
-- exam_areas: id uuid, blueprint_id FK, code, label, aliases text[], weight numeric,
--             sort_order integer; unique(blueprint_id, code).
-- exam_editions: +blueprint_id uuid nullable, +cutoff_reference_label text nullable.
-- simulados: +edition_id uuid, +source_simulado_id uuid nullable; unique por edição/seq.
-- attempts: +edition_id uuid, +specialty_id_at_finish uuid nullable,
--           +target_institution_ids_at_finish uuid[], +snapshot_backfilled boolean.
-- questions: +area_id uuid nullable enquanto houver pendências reportadas.
admin_upsert_edition(p_edition jsonb) returns uuid;
admin_clone_simulado(p_source uuid, p_edition_id uuid,
 p_window_start timestamptz, p_window_end timestamptz,
 p_results_release_at timestamptz, p_copy_questions boolean default false) returns uuid;
admin_import_questions(p_simulado_id uuid, p_rows jsonb) returns jsonb;
set_target_edition_guarded(p_edition_id uuid default null,
 p_expected_graduation_term text default null) returns void;
```

Os controles já existentes de tentativa, autorização, liberação de gabarito e preservação de histórico permanecem obrigatórios. `admin_require('content.manage')` e auditoria devem proteger operações administrativas. Datas inconsistentes existentes são reportadas; não corrigir S7 em produção sem autorização específica. Uma constraint NOT VALID pode proteger novos registros sem adulterar o histórico.

## Validação e limites

PostgreSQL portátil 17.11 restrito a localhost, sem Docker e sem serviço global, disponível para fixtures descartáveis. Serviços gerenciados Supabase (Auth, Vault, pg_net, cron) precisam de doubles locais explícitos; estes não comprovam a integração real. O baseline completo por pg_dump está bloqueado pela ACL de leitura da credencial temporária da CLI. Não arquivar migrations antigas nem alegar diff vazio antes de um baseline comprovado.

SSO/PRO dependem do contrato SanarFlix; observabilidade depende de DSN/conta; TRI depende de calibração estatística. Preparar interfaces configuráveis quando útil, mantendo recursos indisponíveis até existirem entradas reais. Sem envio de mensagens/dados externos ou ações de produção implícitas.
