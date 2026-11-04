# Operações Administrativas: Handoff

## Estado

Fase A, protótipo autocontido para revisão do Codex **antes de React**. Não é o app real, não testa autenticação, não executa SQL, não importa arquivos pessoais e não altera resultados. Não há aprovação editorial nem autorização de produção. A fase B não foi iniciada.

Abrir `docs/design/admin-operations-prototype.html` diretamente no Edge, via arquivo local. Não depende de servidor, Vite, CDN, fonte remota ou arquivo auxiliar. Não foi criado preview HTTP; portas 54738–54743 e scripts existentes permaneceram intactos.

`Controles de revisão · somente DEMO` permite alternar tema, capabilities, flag, estado do catálogo, estado da prova, falha do próximo envio e nomes longos. Tudo vive em memória, sem storage, cookies ou conta pessoal. Recarregar restaura a demonstração. Os identificadores `demo-edition` / `demo-reference` existem apenas nos valores internos de controles, não são UUIDs nem chaves para produção.

## Fluxos

### Importação

1. Selecionar explicitamente edição de destino e referência/processo; preencher fonte declarada. Nada vem selecionado ou atribuído a um processo real.
2. Selecionar formato CSV ou XLSX e carregar um lote DEMO válido, ambíguo ou vazio. Ambos são **upload simulado pré-carregado**, sem input de arquivo. XLSX representa a aba fictícia Cortes; não há parser binário, planilha externa ou upload. O editor é uma representação simplificada com seis colunas separadas por ponto e vírgula, não um parser de produção.
3. Conferir lote. Prévia mostra nomes canônicos, cenário, ampla/cotas, vagas, validação por linha e contexto completo de origem/fonte/destino. Instituição ambígua/desconhecida e especialidade sem correspondência impedem o lote. Corrigir o nome no editor e conferir novamente. Não escolher automaticamente uma entidade parecida.
4. Confirmar o lote inteiro, somente se o preflight local passou. Uma linha inválida implica **0 linhas importadas**. Duplicatas normalizam espaços externos e caixa do cenário para antecipar a chave de programas do SQL. Cenário vazio é permitido; corte geral deve ser finito, cotas são opcionais, vagas opcionais devem ser inteiras não negativas. O SQL não impõe faixa 0–100 para esses cortes, portanto o protótipo não inventa essa restrição.
5. Envio emulado por 450 ms. Controles do lote e contexto de autorização ficam bloqueados enquanto ocupa o envio. Falha preserva todos os campos e linhas, com retry explícito e sem duplo envio simultâneo. Sucesso é apenas DEMO; impede repetir aquela confirmação enquanto o preflight não mudar. Editar fonte, destino ou linhas invalida a prévia. Alterar formato exige recarregar o lote e mantém as linhas antigas para consulta.

O catálogo tem loading, vazio, erro e recuperação. Recuperar nunca salva automaticamente e mantém fonte/seleções anteriores. No vazio, o texto orienta configurar o catálogo real; o botão demonstra somente a recuperação para exemplos fictícios. Erro de lote vazio abre o editor recolhido antes de focar o campo inválido.

Não há origem D6 inventada. `Processo DEMO · referência fictícia` não corresponde a uma referência real de 2027 nem migra o legado 2026. As notas 720/680/690 e vagas 8/4 são exemplos inteiramente fictícios de linhas importadas, não resultados operacionais ou TRI. Cortes são estimativas de referência; provas/escalas distintas não são diretamente comparáveis.

### Reprocessamento

1. `Resultados do simulado` representa o contexto da página de uma prova, não um novo dashboard. Na integração, a ação pertence à página real do simulado.
2. `Reprocessar resultados` abre diálogo nativo com prova/edição e explicação concreta. A correção do gabarito é anterior e não acontece neste fluxo.
3. Motivo obrigatório, sem checkbox genérico ou pré-marcado. Falha de validação foca o motivo e associa o erro. Texto recomenda não inserir dados pessoais de alunos.
4. Requer simultaneamente `content.manage` e `attempts.manage`; ausência de qualquer uma, flag desligada, janela aberta e estrutura inválida bloqueiam a ação com explicação. O role é apenas uma cena; autorização de verdade é do servidor.
5. Durante 450 ms de simulação, bloqueia envio duplicado e fechamento. Em erro mantém diálogo e motivo, permitindo tentar novamente. Escape fora do envio e Cancelar devolvem foco ao disparador; Tab e Shift+Tab ficam contidos no diálogo. Após sucesso, fecha e foca o relatório agregado.
6. Relatório explicitamente DEMO: 1 operação simulada, 12 tentativas processadas, 3 notas alteradas, 4 entradas reconciliadas. Valores fixos para estudar o retorno, não medidos no banco. Sem nomes, notas individuais, hashes ou IDs técnicos. Não há KPIs adicionais.

Preservar respostas e histórico acadêmico não significa congelar valores antigos incorretos do resultado: totais e histórico de desempenho são reconciliados pelo contrato, sem destruir trajetória, notas/revisões do caderno e exclusões voluntárias. Não reabrir/finalizar tentativa, trocar modalidade/elegibilidade ou recalcular TRI no cliente.

## Contratos Lidos

Fontes locais consultadas: `PRODUCT.md`, `DESIGN.md`, brief de operações, handoff de edições, `docs/contracts/cutoff-reference-2027.md`, `docs/contracts/reprocessing-notebook-2027.md`, `src/types/edition.ts`, `src/types/edition-admin.ts`, capabilities existentes, tokens admin, sidebar e `AdminConfirmDialog`.

| Operação | Contrato para a fase B |
| --- | --- |
| Importar cortes | SQL presente em `supabase/migrations/20261104090759_fase1_cutoff_reference.sql`, função `admin_import_cutoffs(p_reference_edition_id uuid, p_source text, p_rows jsonb)`. Exige `content.manage` e identidade autenticada. Retorna `{ok, imported, errors:[{row, field, message}]}`. Lote atômico, rejeição de conflitos sem upsert, auditoria e lock por referência. Presença no repositório não comprova deploy. |
| Linhas | Resolver nomes por catálogo canônico, enviando apenas internamente `institution_id`, `specialty_id`, `practice_scenario`, `cutoff_score_general`, `cutoff_score_quota` nullable, `vagas` opcional. IDs nunca devem ser exigidos ou exibidos ao operador. Ausência de vagas vira 0 no SQL atual, explicitada na prévia. Não escolher o maior corte entre processos. |
| Referência/destino | O SQL recebe **um único** `p_reference_edition_id`, não um segundo ID de processo ou destino. Na DEMO, os dois controles apresentam a edição e seu processo fictício. Na fase B, derivar opções compatíveis do catálogo real da referência/edição; não criar um novo relacionamento ou atribuir source sem decisão D6. Conferir a associação antes do envio. |
| Erros | `row:0` é erro global (fonte/referência/lote); `row:1..n` é índice da linha no array, sem cabeçalho. Na planilha real, manter mapa até linha/aba original. Traduzir campos/mensagens técnicas para rótulos úteis, sem vazar SQL. Exibir erros de conflito retornados pelo servidor mesmo quando a conferência local passou. |
| Reprocessar | Contrato esperado `admin_reprocess_simulado(p_simulado_id uuid,p_reason text)` com `{operation_id,simulado_id,answer_key_hash,attempts_processed,scores_changed,entries_reconciled,idempotent}`. Capabilities em conjunto e prova encerrada/consistente; o frontend não substitui preflight/locks do servidor. **RPC em job paralelo, sem relatório confirmado nesta execução: não declarar backend pronto.** |
| Retry real | O bloqueio local evita envio concorrente, não resolve timeout de resposta incerta nem cria chave de idempotência no RPC de cortes. Antes de retry real, reconciliar resultado/auditoria e conflitos. Não prometer exatamente-uma-vez. Reprocessamento do mesmo gabarito é idempotente nos dados conforme contrato, não uma garantia implementada pelo HTML. |

Serviços/adapters/tipos de importação e reprocessamento reais ainda precisam ser verificados/criados no escopo da fase B. Tipos gerados do Supabase não foram editados nem tomados como prova de disponibilidade do RPC paralelo. Nenhuma chamada ao backend foi feita.

## Composição

Extensão do admin existente, não redesign. Padrões Dendê de formulário, grid, foco de 2 px, alvo de 44 px e reduced motion consultados como referência; o HTML não importa a biblioteca nem instala Dendê/HeroUI. A sidebar documentada pelo MCP é genérica; prevaleceu a sidebar real sempre escura do projeto.

| Elemento | Medida / comportamento |
| --- | --- |
| Shell | namespace `admin-root`, sidebar 240 px, conteúdo até 1080 px, padding desktop 40 px, superfícies planas |
| 768 px | navegação ilustrativa horizontal, padding 24 px, formulário em duas colunas |
| 375 px | padding 16 px, formulário em uma coluna, linhas da tabela empilhadas com rótulos, caption filho direto da tabela e largura integral |
| Cards | borda 1 px, raio 12 px, padding 28 px; 20/16 px no mobile; sem sombras ou gradientes |
| Controles | altura mínima 44 px, raio 6 px, foco 2 px com offset 3 px; borda local reforçada para distinguir os controles |
| Diálogo | até 560 px, margem mínima 16 px, padding 28 px (24/20 px mobile), altura máxima viewport menos 32 px, rolagem vertical |
| Tipografia | 14 px / 1.55, título 24 px / 800, seções 20 px, auxiliares 13 px; Plus Jakarta Sans via `local()`, Arial/sans-serif offline quando ausente |
| Tema | tokens locais extraídos do admin: bg/surface/raised/text/muted/accent e semânticos, sidebar fixa escura em ambos |
| Motion | sem transições decorativas; regra reduced motion impede animações e smooth scroll |

Textos variáveis quebram com `overflow-wrap:anywhere` e grids `minmax(0,1fr)`. Selects/inputs nativos podem recortar visualmente seu valor no campo estreito; o contexto completo selecionado aparece sem truncamento na prévia antes da confirmação. Na fase B preservar a Plus Jakarta Sans já carregada pelo app, não reproduzir diferença de fallback como novo token.

Reusar `AdminPageHeader`, shell e navegação reais, gates existentes, controles instalados e toast existente. `AdminConfirmDialog` tem loading e prevenção de fechamento automático, mas não possui um slot de campo/motivo e sua confirmação por digitação não equivale ao motivo obrigatório. Antes de escolher a composição React, conferir a API de Dialog/Radix instalada e garantir motivo, erro persistente, foco e estado assíncrono; não adaptar um checkbox como substituto. Não reimplementar autorização ou layout global.

## Validação

TDD executado sobre o JS real do HTML, não uma cópia da lógica. Primeira execução: 16 falhas esperadas por ausência do HTML. Foram observadas/corrigidas falhas de correção de linha, sucesso após retry, foco no editor recolhido e troca de formato sem recarregar. A implementação final tem 19 testes isolados.

| Comando | Resultado |
| --- | --- |
| `node --test docs/design/admin-operations-prototype.test.mjs` | Exit 0; 19 passando, 0 falhando. Runner Node + jsdom instalado, sem instalar pacotes. |
| `node .superpowers/admin-opsQA/check.mjs` | Exit 0; Edge 156.0.4314.58 headless; 48 capturas, 0 requests externos, 0 page errors, foco e overflow aprovados nos cenários abaixo. Helper/capturas ignorados pelo Git. |
| `git diff --check` | Exit 0, sem alteração do estado Git. Arquivos novos são conferidos também pelos testes e inspeção. |

Viewport exato de captura: **375×1000, 768×1000 e 1440×1000**, temas `light`/`dark`, reduced motion ativo e nomes longos ligados. Capturas full-page, portanto altura do PNG pode exceder 1000. Oito cenas por combinação: `empty`, `invalid`, `preflight`, `import-error`, `import-success`, `dialog`, `report`, `blocked`. Caminho: `.superpowers/admin-opsQA/{largura}-{tema}-{cena}.png`. Nenhuma captura é do app real. Inspeção visual direta incluiu 375 claro preflight, 375 escuro diálogo, 768 escuro inválido e 1440 claro preflight; demais cenas passaram checagens automatizadas de dimensões, sem afirmar inspeção manual de todas.

`documentElement.scrollWidth` igual à largura do viewport nas 48 cenas: 375, 768 ou 1440. Diálogo: scrollWidth/clientWidth 339/339 em 375 e 558/558 em 768/1440. Teclado real no Edge validou foco inicial no motivo, ciclo Tab/Shift+Tab, Escape com retorno e sucesso com foco no relatório em todas as seis combinações. jsdom usa shim apenas para abrir/fechar dialog, por isso não é a única evidência do modal.

Contraste calculado por luminância sRGB/WCAG, não estimado visualmente:

| Par | Claro | Escuro |
| --- | --- | --- |
| Texto / surface | 17,84:1 | 15,46:1 |
| Muted / raised (menor contraste de auxiliares) | 6,93:1 | 6,35:1 |
| Erro / surface | 5,44:1 | 5,55:1 |
| Sucesso / bg | 5,11:1 | 10,18:1 |
| Accent / surface | 6,80:1 | 4,80:1 |
| Texto do botão / accent | 6,80:1 | 5,18:1 |

Todos os pares de texto usados e medidos passaram 4,5:1. A primeira checagem encontrou `accent/raised` escuro em **4,38:1**: esse par foi evitado no hover da operação ativa, que permanece em surface (4,80:1), sem trocar o token de marca. Erros/status têm texto e não apenas cor. Não equivale a auditoria WCAG completa: leitura com leitor de tela, zoom/forced-colors e QA integrado do produto ainda exigem revisão humana.

## Limites E Próximos Passos

- Revisão Codex obrigatória antes da fase B; sem React, SQL, Edge, serviços, rotas, tipos ou produção nesta entrega.
- D6 continua pendente: confirmar origem/referência e compatibilidade editorial antes de qualquer import real. Legado 2026 permanece sem atribuição automática.
- Confirmar relatório e disponibilidade do RPC paralelo de reprocessamento; conferir esquema/retorno final, erros e idempotência antes de integrar.
- Implementar leitura real CSV/XLSX usando apenas dependências aprovadas/instaladas, validação de schema, cabeçalhos/abas/limites, correspondência canônica inequívoca e tradução de erros por linha. O editor DEMO não cobre escapes/aspas/fórmulas de planilha.
- Planejar resposta incerta de rede e reconciliação de importações, em vez de reenviar automaticamente. O HTML demonstra falha certa local, não ambiguidade de rede.
- Aplicar `editions_ui` e capabilities reais no frontend e servidor; não levar controles DEMO, fixtures, contagens, `.dataset.sends` de teste ou valores fictícios para o produto.
- Fases executadas: contexto, extensão da direção existente, protótipo, referência de padrões/tokens, revisão visual/teclado/contraste/responsividade e handoff. Sem nova direção, perguntas, motion decorativo, publicação, instalação ou implementação React.
