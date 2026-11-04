# Operações administrativas por edição

Fase B implementada no worktree, com as quatro correções funcionais da revisão Codex e testes locais passando. Ainda não commitada ou integrada pelo orquestrador. O protótipo aprovado está em docs/design/admin-operations-ui-handoff.md. Não houve ação em produção nem execução real das RPCs.

## Contratos de comportamento

A importação exige editions_ui e content.manage, referência e fonte explícitas, catálogo canônico completo, lote atômico e rejeição de ambiguidades/conflitos. Headers equivalentes após normalização também são ambíguos e devem bloquear o arquivo: não selecionar silenciosamente o último valor. Uma resposta incerta exige nova conferência contra as chaves existentes antes de permitir confirmação; uma importação que terminou no servidor não pode ser repetida apenas porque a resposta se perdeu.

O reprocessamento exige editions_ui, content.manage e attempts.manage. A RPC usa o gabarito atual, motivo obrigatório e preserva respostas, modalidades, elegibilidade e snapshots; a interface mostra somente contagens agregadas. Ao concluir, a página aberta precisa atualizar as notas e o roster do simulado atual. Invalidar todas as queries com refetchType:none deixa essa tela mostrando valores antigos e não satisfaz o contrato.

Queries administrativas ativas do simulado atual devem refazer leitura; demais caches relevantes ficam stale, sem refetch global nem consultas de aluno com credencial de administrador. Os prefixes de aluno são user-performance, ranking-simulados, ranking, comparative, exam-result, exam-result-access, simulados e simulado. Prefixes do caderno: notebook-page, notebook-counts, notebook-due-count, caderno-pattern-insights, caderno-area-score-history e caderno-confidence-calibration. Os filtros de identidade depois do prefix continuam válidos para consultas; a invalidação após reprocessamento pode alcançar qualquer usuário afetado presente no cache local.

## Implementação

- Rota `/admin/cortes`, lazy import e navegação atrás de `editions_ui` e `content.manage`, com `EditionsUiGate` real. Ação contextual em `AdminSimuladoResultados` exige também `attempts.manage`; leitores sem essas permissões não carregam o novo contexto.
- `adminCutoffApi`: catálogos e conflitos paginados em blocos de 1000, incluindo cortes e programas; uma chamada ao RPC atômico, sem escrita direta nas tabelas ou retry automático.
- `cutoffImport`: reutiliza `parseImportCsv` e `parseXlsxFirstWorksheetRows`; mantém aba e linha física para localizar erros, inclusive CSV com campos multilinha e XLSX com linhas esparsas. Rejeita cabeçalhos normalizados duplicados e cabeçalhos de usuário reservados `__source_*`; esses metadados não participam da validação das colunas de domínio nem do payload RPC.
- Correspondência única por nome normalizado, sem fuzzy match; valida números finitos e vagas inteiras não negativas, sem faixa inventada de notas. Valores em branco de vagas viram 0, informado na UI. Alterar contexto invalida a prévia. Falhas mantêm arquivo/fonte; uma resposta incerta remove a confirmação e exige conferência atualizada no banco. Chaves que já foram gravadas impedem nova confirmação.
- `adminReprocessApi`: contexto real da prova/edição e RPC com motivo trim de 1 a 2000 caracteres. Casts das novas assinaturas ficam nas fronteiras dos serviços; tipos gerados não foram alterados. `55P03` permite retry explícito; resultado incerto bloqueia reenvio na sessão até investigação e recarga consciente.
- Diálogo Radix instalado, foco explícito inicial no motivo, retorno no Escape, foco no motivo após erro assíncrono e no relatório após sucesso. Exibe apenas contagens agregadas; não expõe IDs, hash, nomes ou notas individuais de alunos.
- Sucesso marca caches pertinentes stale sem refetch de aluno. Somente as seis famílias administrativas ativas do simulado atual são refetched: detail-stats, question-stats, score-distribution, performance-by-area, aggregate e roster por `params.simuladoId`. Teste com observadores ativos verifica refresh do alvo, ausência de refetch de outra prova e stale de todos os prefixes de aluno/caderno listados acima, inclusive outro usuário.

## Verificação Final

Comando executado após as correções, com exit 0: **47 testes passando em 8 arquivos**.

```powershell
npx vitest run src/admin/lib/cutoffImport.test.ts src/admin/services/adminCutoffApi.test.ts src/admin/services/adminReprocessApi.test.ts src/admin/pages/AdminCutoffImport.test.tsx src/admin/components/ReprocessSimuladoDialog.test.tsx src/admin/pages/AdminSimuladoResultados.test.tsx src/admin/__tests__/editionsNavigation.test.ts src/admin/__tests__/AdminSidebar.test.tsx --maxWorkers=2
```

TDD: as duas colisões de cabeçalho e o refresh ativo falharam antes da correção e passaram depois. Os testes cobrem também lote previamente gravado após timeout, erro por linha do servidor preservando arquivo/fonte e zero importados, bloqueio de duplicidade, capabilities/flag, integração contextual e foco Radix/Escape/sucesso. Todos os serviços/RPCs desses testes são mocks explícitos.

As duas incompatibilidades apontadas no typecheck do Codex foram tratadas sem `any`/ignore: cada localização XLSX é estreitada para string com rejeição de ausência, e o corte geral obrigatório é sempre number, mantendo a validação de erro. Não foi executado TypeScript global aqui; cabe ao orquestrador repetir essa verificação antes de integrar.

QA React concluído independentemente pelo Codex em 04/11/2026: `node .superpowers/admin-opsQA/react-check.mjs` → exit0, Edge156, duas capturas de componentes reais com mocks (1440/preflight claro e375/diálogo escuro), sem overflow mobile, foco inicial no motivo, Escape retornando ao disparador, foco no relatório após sucesso, zero page errors e zero requests externos. As duas imagens foram inspecionadas visualmente. O Codex isolou o cache Vite e aguardou domcontentloaded para tolerar a compilação inicial; o harness fica ignorado pelo Git. Isso comprova composição e interação com mocks, sem autenticação/RLS/RPC real.

Checks independentes finais: 47 testes/8 arquivos passando; `tsc --noEmit -p tsconfig.app.json` exit0; ESLint dos arquivos tocados exit0, com duas warnings antigas de any em AdminSimuladoResultados. A primeira execução Vitest no sandbox falhou antes de carregar a configuração por acesso negado ao esbuild; a execução local autorizada concluiu47/47, sem alteração de dependências.

## Escopo E Limites

Alterações somente em páginas, componente, serviços, parser, tipos de operações, integração de rota/navegação, testes correspondentes e estes dois documentos, conforme `.superpowers/admin-ops/phase-b.md`. Não foram alterados SQL, generated types, package/lock, AdminPeriodContext, Topbar ou APIs globais; sem instalação, rede externa intencional, `.env`, subagentes ou git mutante.

Preservados shell/tokens e componentes shadcn locais; padrões de layout/formulário Dendê consultados como referência, sem instalar/migrar biblioteca. D6 permanece sem atribuição oficial, e o legado não recebe um processo presumido. Nenhuma data editorial ou calibragem TRI foi criada.

Pendências de integração: disponibilidade/deploy autorizado das RPCs, teste integrado de autenticação/RLS e revisão editorial da fonte real. Testes com mocks não comprovam Supabase Auth E2E ou execução de importação/reprocessamento no banco.
