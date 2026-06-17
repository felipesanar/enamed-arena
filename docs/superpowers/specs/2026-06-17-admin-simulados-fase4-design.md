# Fase 4 do Admin — Inserção & Dados de Simulados

**Data:** 2026-06-17
**Branch:** `feat/admin-simulados-fase4` (worktree `.claude/worktrees/admin-simulados-fase4`, base `origin/main`)
**Programa:** continuação de [admin-central-programa] (Fases 1 Fundação, 2 Inteligência, 3 Gestão — todas merged na main).

## Objetivo

Mitigar erros e dúvidas em toda a experiência do admin para **inserir simulados** e **ler os dados de simulados**. Cinco frentes:

1. **Imagens** — corrigir o "imagem 2 nunca entra" e tornar o upload de imagens confiável.
2. **Verificador de IA** — detectar questões que deveriam ter imagem mas estão sem.
3. **Datas & horários** — acabar com a insegurança de fuso/validação no cadastro de janelas.
4. **Cadastro** — reorganizar a UX do formulário de simulado (sem inventar campos de domínio).
5. **Dados & ranking** — roster completo de concluintes (ordenável, filtrável, exportável) + visão individual + macro.

Tudo isolado no worktree do admin. RPCs `SECURITY DEFINER` + `admin_require()` por capability + retrofit de logging no `admin_audit_log`. Migrations aditivas direto no banco de produção (fonte da verdade = `supabase/migrations-log.md`; **não** julgar o backend pelos `.sql` do repo).

## Contexto do código atual (achados da exploração)

- **Tabela `questions`** já tem `image_url`, `image_url_2`, `explanation_image_url`. O importador (`src/admin/pages/AdminUploadQuestions.tsx` + `src/admin/utils/xlsxImageExtractor.ts`) **só extrai enunciado e comentário** — `image_url_2` nunca é preenchida pela planilha. Esta é a causa-raiz do bug da imagem 2.
- O extrator atual mapeia imagem → **linha** e infere o tipo (enunciado/comentário) por heurística de coluna/ordem, o que é frágil.
- **`AdminSimuladoForm.tsx`** usa inputs `datetime-local` convertidos com `new Date(...).toISOString()` — assume o fuso da máquina do admin, sem rótulo de fuso nem resumo de confirmação. `validateWindows` (`src/admin/lib/validateWindows.ts`) só cobre fim>início e resultado≥fim.
- **Tabela `simulados`** é enxuta: `title, slug, sequence_number, description, duration_minutes, questions_count, theme_tags, status, execution_window_start/end, results_release_at`. `questions_count` é digitado à mão.
- **Dados de simulado** hoje: `admin_simulado_detail_stats` + `admin_simulado_question_stats` (agregados) e `AdminSimuladoAnalytics.tsx`. **Não existe** roster por concluinte (nome, e-mail, nota, ordenável).
- **Componentes reutilizáveis:** `AdminDataTable` (sem ordenação por cabeçalho hoje), `AdminTrendChart`, `AdminBarList`, `AdminStatCard`, `AdminPageHeader`, `QuestionPreviewModal`.
- **PostGREST corta em 1000 linhas** (gotcha registrado); há ~2.800 attempts → roster precisa de ordenação/paginação no servidor.

## Decisões de design (tomadas no brainstorming)

| Tema | Decisão |
|------|---------|
| Estrutura | Uma fase só, cobrindo as 5 frentes, num worktree dedicado. |
| Modelo de imagem | **Modelo A**: imagens continuam **coladas na célula** do XLSX. O time NÃO muda o fluxo. Adicionar coluna da imagem 2 + extrator robusto por coluna + prévia com miniaturas. |
| Verificador IA | **1 check** ("imagem faltando"), infra extensível por `check_type`. Roda **no upload (antes de gravar)** e por **botão sob demanda** (pós-upload). Sem cron. |
| Datas | Fuso **America/Sao_Paulo** explícito; validação forte; resumo legível pós-save. |
| Cadastro | **Só reorganizar UX** + validação + clareza. Sem novos campos de domínio (capa/instruções/corte/segmentação ficam fora). `questions_count` automático é a única exceção (correção de erro, não campo cosmético). |
| Roster | Colunas: #, Nome, **E-mail**, Segmento, Instituição, Especialidade, Nota, Acertos, Tempo, Concluído, Tipo (válido/treino). Ordenável no servidor. Detalhe por área no drill-down. |
| Macro | Distribuição de notas + acerto por área + por segmento + top instituições + **análise por questão** (consolida `AdminSimuladoAnalytics`). |

## Frente 1 — Imagens (modelo A)

**Planilha:** nova coluna **"Imagem 2 do Enunciado"** entre "Imagem do Enunciado" e "Imagem do Comentário". Aliases reconhecidos (case/acento-insensitive): `imagem 2`, `imagem 2 do enunciado`, `imagem 2 enunciado`, `img 2`, `imagem secundaria`.

**Extrator reescrito (`xlsxImageExtractor.ts`):**
- Hoje retorna `{ enunciadoImages: Map<row,img>, comentarioImages: Map<row,img> }` por linha + heurística.
- Novo: ler as âncoras dos desenhos (`xl/drawings/drawingN.xml` → `<xdr:from><xdr:col>`) e o relacionamento drawing↔sheet (`xl/worksheets/_rels`), para obter a **coluna real** de cada imagem. Mapear coluna → header canônico → slot (`image_url` | `image_url_2` | `explanation_image_url`).
- Retorno novo: `Map<rowIndex, { enunciado?, enunciado2?, comentario? }>` (uma entrada por questão, com os slots presentes).
- Fallback defensivo: se a âncora não resolver a coluna, cair na heurística antiga e marcar o slot como "incerto" para a prévia destacar.

**Upload (`AdminUploadQuestions.tsx`):**
- Subir o 3º arquivo para o bucket `question-images` no padrão `{simuladoId}/{qNum}_enunciado2.{ext}`.
- Passar `image_url_2` no payload de `image_urls` para a Edge Function `admin-upload-questions` (a função e a coluna já existem; garantir o caminho).

**Prévia (`QuestionPreviewModal`):** mostrar os **3 slots por questão** com miniatura; slots vazios e "incertos" ficam visualmente sinalizados antes de confirmar a gravação.

**Isolamento/testes:** o mapeamento âncora→coluna→slot vive numa função pura testável com fixtures de `.xlsx` (questão com imagem 1 só; com imagem 1+2; com comentário; com âncora ambígua).

## Frente 2 — Verificador de IA

**Edge Function nova `admin-verify-questions`:**
- Input: lista de `{ question_number, enunciado_text, comentario_text, has_image, has_image_2, has_explanation_image }`.
- Chama o **Claude** (modelo atual recomendado; ver skill claude-api na implementação) com **tool use / saída estruturada** (JSON forçado), sem texto livre.
- Output: `findings: [{ question_number, check_type: "missing_image", slot: "enunciado"|"enunciado2"|"comentario", severity: "error"|"warning", evidence: string }]`.
- O check detecta referência textual a figura ("observe a radiografia", "figuras A e B", "o ECG/ECО mostra", "imagem a seguir", etc.) **sem** o slot correspondente preenchido.
- Contrato genérico por `check_type` para plugar checagens futuras sem refatorar o consumidor.
- Auth: exige capability `content.manage` (`admin_require`); rate/erro tolerante (degrada com mensagem clara se a chave não estiver configurada).

**Gatilhos (UI):**
1. **No upload:** após o parse e antes de gravar, rodar sobre a prévia. Mostrar achados; admin decide "subir mesmo assim" ou voltar e corrigir.
2. **Sob demanda:** botão "Verificar com IA" em `AdminSimulados` (linha do simulado) e/ou no editor de questões (`AdminQuestionManager`), rodando sobre as questões já gravadas.

**Pré-requisito:** segredo `ANTHROPIC_API_KEY` configurado na Edge Function (ação do Felipe; a função degrada com aviso claro se ausente). Custo: 1 chamada por lote de questões; sem execução recorrente.

**Isolamento/testes:** cliente do verificador e a normalização do input em módulo puro; a detecção de "texto implica figura" é responsabilidade do LLM (não testar o modelo em unit test — testar o parsing do contrato de achados e a degradação sem chave).

## Frente 3 — Datas & horários

- **Fuso explícito:** substituir `new Date(localString).toISOString()` por conversão que interpreta o valor do `datetime-local` como **America/Sao_Paulo** e produz o `timestamptz` correto. Exibir todos os horários com rótulo "(horário de Brasília)".
- **Validação forte (estende `validateWindows`):** fim > início; resultado ≥ fim; aviso (não erro) se a janela está no passado; duração coerente (fim−início ≥ `duration_minutes`, com aviso se destoar muito).
- **Resumo legível pós-edição:** bloco de confirmação — "Abre sex 20/06 14:00 · Fecha 16:00 · Resultado dom 22/06 09:00 — horário de Brasília" — renderizado a partir dos valores que serão de fato gravados.
- **Isolamento/testes:** parser/formatador de fuso e a validação em módulo puro (`src/admin/lib/`). Testes Vitest: round-trip Brasília↔UTC; cobertura defensiva de DST (o BR não usa horário de verão hoje, mas o teste documenta a premissa); casos de janela inválida.

## Frente 4 — Cadastro (UX)

Reorganizar `AdminSimuladoForm` em **seções**:
- **Identificação:** título; slug **auto-gerado do título** (editável, com aviso de colisão); `sequence_number`.
- **Conteúdo:** descrição; `duration_minutes`; `theme_tags`; `questions_count` **automático** (derivado do nº real de questões da tabela `questions`; campo read-only mostrando o valor real e sinalizando divergência se o registro estiver defasado).
- **Agenda:** as 3 datas com a UX da Frente 3 (fuso + resumo).
- **Publicação:** `status` com microcopy explicando cada estado (draft/published/test).

Sem novos campos de domínio. `questions_count` automático é a única mudança de comportamento (recomendada; vetável). A derivação pode ser exibida no form via contagem real e, opcionalmente, persistida ao subir/editar questões.

## Frente 5 — Dados & ranking

**RPC nova `admin_simulado_results_roster(p_simulado_id, p_sort, p_dir, p_scope, p_search, p_segment, p_institution, p_limit, p_offset)`:**
- `p_scope`: `valid` | `training` | `all` (válido = `is_within_window`).
- Retorna linhas `{ rank, user_id, attempt_id, name, email, segment, institution, specialty, score, correct_count, total_count, duration_seconds, submitted_at, is_within_window }` + total de linhas para paginação.
- Ordenação/paginação/filtro **no servidor** (contorna o teto de 1000 do PostGREST).
- `SECURITY DEFINER` + `admin_require('results.view')`.

**Capability:** criar capability nova **`results.view`** (roster expõe nome+e-mail de concluintes — PII mais sensível que edição de conteúdo). Grant default: `admin`, `content_editor`, `analyst`. Adicionar à `role_capabilities` + item de nav. *(Alternativa rejeitada: reusar `content.manage` — mistura "editar conteúdo" com "ver PII de alunos".)*

**Página/tela `AdminSimuladoResultados`** (rota `/admin/simulados/:id/resultados`, consolidando a antiga `analytics`):
- **Macro (topo):** KPIs (participantes, conclusão, média, abandono, tempo médio) + distribuição de notas (histograma via `AdminTrendChart`) + acerto por grande área (`AdminBarList`) + por segmento + top instituições + **análise por questão** (taxa de acerto, índice de discriminação, erro mais comum — migrado de `AdminSimuladoAnalytics`).
- **Roster (abaixo):** `AdminDataTable` **estendido com ordenação por cabeçalho** (toda coluna clicável; dispara re-fetch server-side). Busca por nome/e-mail; filtros (scope, segmento, instituição); **export XLSX** (reusa o util de export existente).
- **Drill-down individual:** clique na linha abre o desempenho daquele aluno (por área, acerto por questão, tempo, comparação com a média da coorte). Reaproveita/estende `DesempenhoSimuladoPanel`.

**Extensão de `AdminDataTable`:** suporte opcional a ordenação por cabeçalho (callback `onSort(column, dir)` + indicadores visuais ⇅/▾/▴); mantém retrocompatibilidade com os usos atuais (ordenação desligada por padrão).

## Arquitetura, dados e testes

- **Migrations (aditivas, no banco de produção):** RPC `admin_simulado_results_roster`; capability `results.view` + grants; (se persistido) coluna/trigger para `questions_count` derivado. Registrar cada uma em `supabase/migrations-log.md`.
- **Edge Functions:** `admin-verify-questions` (nova); ajuste em `admin-upload-questions` para o 3º slot.
- **Frontend:** `xlsxImageExtractor.ts` (reescrito), `AdminUploadQuestions.tsx`, `QuestionPreviewModal.tsx`, `AdminSimuladoForm.tsx`, `validateWindows.ts` (+ novo módulo de fuso), `AdminDataTable.tsx` (ordenação), nova página `AdminSimuladoResultados`, ajustes de nav e rotas em `App.tsx`/`navigation.ts`, `adminApi.ts` (novas chamadas).
- **Testes (Vitest):** mapeamento imagem→coluna→slot (fixtures XLSX); fuso Brasília↔UTC + validação de janelas; parsing do contrato de achados do verificador + degradação sem chave; ordenação do `AdminDataTable`. RPCs verificadas com smoke no banco vivo (grants/guards, 0 exec por anon).
- **Auditoria:** retrofit de `admin_log_action` nas novas RPCs mutadoras, no padrão best-effort exception-tolerant da Fase 3.

## Fora de escopo (YAGNI / fronteiras herdadas)

- Comunicação com usuários (e-mail/Novu) — mantém a fronteira da Fase 3 (ação externa irreversível, exige opt-in explícito).
- Recálculo de notas após editar gabarito.
- Execução periódica/cron do verificador de IA.
- Novos campos de domínio do simulado (capa, instruções, nota de corte por simulado, segmentação/visibilidade).
- Checks adicionais do verificador além de "imagem faltando" (infra fica pronta, checks não).

## Pré-requisitos do Felipe

1. Configurar `ANTHROPIC_API_KEY` como segredo da Edge Function (sem isso o verificador degrada com aviso).
2. Confirmar/vetar: `questions_count` automático.
3. Confirmar/vetar: capability nova `results.view` (vs. reusar `content.manage`).
