# Admin period: handoff da fase A

## Entrega e limite

Protótipo Operate, offline e autocontido: `docs/design/admin-period-prototype.html`.
Abrir diretamente no Edge pelo arquivo local. Não requer servidor, porta, rede,
pacotes novos ou serviço externo. O laboratório recolhível permite alternar os
estados. Parâmetros iniciais: `?theme=dark`, `?catalog=loading|error|empty|long`
e `?flag=off`; podem ser combinados.

Somente fase A. Nenhum React, SQL, tipo de produção, integração, pacote ou rota
foi alterado. IDs `demo-a` e `demo-b` são sintéticos, não UUIDs de edições reais.
Datas do formulário são exemplos DEMO, não calendário oficial. Não há datas
confirmadas de 2027, cortes, notas ou métricas inventadas nesta entrega.

**O protótipo não prova Auth, permissões, RLS, Supabase, PostgREST, catálogo real,
persistência por usuário real nem aplicação dos argumentos nas RPCs.** A flag e o
retry são simulações locais, não consultas. Aguarda revisão do Codex antes da B.

## Direção e fontes

- Extensão do admin existente, sem nova identidade, dashboard ou gráfico.
- Referências lidas: `PRODUCT.md`, `DESIGN.md`, `docs/contracts/admin-period-2027.md`,
  `docs/admin-period-2027.md`, `AdminPeriodContext`, `AdminTopbar`,
  `AdminInteligencia`, `useAdminInteligencia` e tokens de `src/index.css`.
- Combo executado: contexto local, direção existente Operate, HTML funcional,
  adaptação aos tokens admin, revisão responsiva/teclado/contraste e handoff.
- Sem nova direção criativa ou checkpoint adicional: `DESIGN.md` autoriza seguir
  a direção existente. Sem dataviz novo: apenas identificação das séries.
- Sem motion novo: interface estática e imediata, inclusive com reduced motion.
- Skill `interfaces-com-dende` carregada. Consulta MCP Dendê não realizada devido
  à proibição expressa de rede desta tarefa. Não se afirma conformidade certificada
  Dendê; a alternativa explícita é a identidade local exigida por `DESIGN.md`.
- Revisão com regras locais de `web-interface-guidelines`, sem consulta externa.
  Impeccable não foi necessário para esta extensão pequena e não substituiu o DS.
- Sem delegação ou subagente. A revisão visual desta fase não é aprovação humana.

## Composição e medidas

```text
Topbar 54px: breadcrumb                              alertas | tema
Faixa própria: Edição [Todas as edições / catálogo]   Período [7/30/90/livre]
               Nome completo + estado/retry + descrição do alcance
               [De] [Até] [erro] [Aplicar intervalo] [Cancelar], se em edição
Conteúdo DEMO: seleção aplicada / segmento local / marcadores por edição / alcance
```

- Topbar não recebe seletores comprimidos. Breadcrumb, alertas e tema continuam
  no topo; botões de ícone têm nome acessível e 44 × 44px.
- Faixa com padding desktop 20 × 28px e colunas até 840px, gap 16px.
- Até 1000px: sidebar cenográfica de 156px e padding lateral de 20px.
- Até 640px: faixa em uma coluna, padding 18 × 16px, formulário de datas
  empilhado, sem sidebar cenográfica. Não é uma alteração na sidebar do produto.
- Controles com altura mínima de 44px, radius 6px, labels visíveis de 12px.
- Foco de 2px em `admin-accent`, offset 3px. Erro tem texto, `role=alert`,
  `aria-invalid`, associação ao campo e foco no primeiro campo inválido.
- Título 26px/800 no desktop e 23px no mobile. Corpo 14px; texto de apoio 12–13px.
  Datas tabulares. Plus Jakarta Sans é a primeira família, seguida de system-ui.
  Não há fonte remota nem binário de fonte no repo: fallback offline é permitido
  e a família realmente renderizada é registrada pelo Edge em `actualFonts` no QA.
- Nome completo da edição também aparece fora do select, com quebra segura.
  O select nativo pode truncar visualmente, mas não é a única fonte do rótulo.
- Marcadores em duas colunas; uma única edição ocupa toda a largura. Mobile em
  uma coluna. Sem conexões entre marcadores, e distinção textual além de cor/forma.

## Tokens

Valores copiados dos tokens existentes, não uma paleta nova:

| Token admin | Claro | Escuro |
| --- | --- | --- |
| bg | 60 9% 98% | 216 12% 5% |
| surface | 0 0% 100% | 216 11% 9% |
| raised | 60 6% 96% | 214 11% 12% |
| line | 30 6% 90% | 216 11% 18% |
| line-strong | 30 5% 84% | 216 10% 26% |
| text | 28 11% 9% | 210 8% 93% |
| muted | 30 6% 32% | 214 8% 64% |
| accent | 342 67% 41% | 342 71% 60% |
| accent-soft | 342 60% 95% | 342 35% 18% |
| accent-contrast | 0 0% 100% | 216 12% 5% |
| destructive | 356 61% 48% | 356 70% 64% |

Todos consumidos via `hsl(var(--admin-…))`. No escuro, o par herdado accent sobre
accent-soft falhou no teste de contraste para texto pequeno; badges e estados
selecionados usam `admin-text` nesse fundo, sem mudar os tokens. Cor de borda e
marcadores mantém o accent. Não há sombras ou gradientes novos.

## Estado e interação

| Estado | Comportamento observável |
| --- | --- |
| Padrão | Todas as edições (`null`), 7 dias, edição não inferida por ano |
| Catálogo pronto | Todas as edições mais cada edição sintética individual |
| Carregando | Select desabilitado, mensagem de carregamento e aria-busy; sem séries/args novos |
| Erro | Texto de falha, escolha anterior preservada, Tentar novamente recupera catálogo DEMO |
| Vazio | Mensagem explícita; atualizar via retry, sem simular sucesso cumulativo |
| Nome longo | Rótulo completo quebra fora do select e nos marcadores |
| Preset 7/30/90 | Aplica imediatamente, mantendo edição e segmento |
| Intervalo livre | Abre rascunho de duas datas; escolha anterior continua aplicada |
| Inválido | Não aplica/persiste rascunho; preserva entradas, erro inline e foco |
| Válido | Aplica datas, fecha formulário, retorna foco ao período |
| Editar intervalo | Reabre datas aplicadas sem precisar passar por outro preset |
| Cancelar | Descarta rascunho e retorna ao período aplicado, sem alterar edição |
| Trocar edição com rascunho | Mantém datas digitadas, modo de edição e período já aplicado |
| Flag desligada | Oculta novos controles; oferece somente período legado 7/30/90; args novos ausentes |
| Sessão válida | Recarrega edição/período aplicados; rascunho não é persistido |
| Sessão inválida | Fallback explícito para Todas/7 com aviso, nunca usa edição removida |
| Storage bloqueado | Continua na memória com aviso de que não persistirá |

Chave exclusiva do protótipo: `admin-period:demo-operator:v1`. Não lê a chave real
`admin_period`; não simula isolamento de autenticação. A futura chave precisa
incluir usuário autenticado e versão, aguardar catálogo autorizado para validar
IDs, limpar/isolar na troca de usuário e não substituir indisponibilidade de
catálogo por seleção cumulativa. Não confiar em sessionStorage para autorização.

## Datas e semântica

UI: “De … até …”, ambos os dias inclusivos, BRT explicitado. Intervalo livre
exige duas datas válidas, com `De <= Até`; um único dia é válido. Limite técnico
da demo é 1900–9998, não regra do negócio ou calendário editorial.

Exemplo DEMO: de 01/10/2026 até 31/10/2026 vira
`p_start_at=2026-10-01T03:00:00.000Z` e
`p_end_at=2026-11-01T03:00:00.000Z`. O servidor usa `[start,end)`: fim é o início
do dia seguinte, não `23:59:59.999`. Conversão usa calendário UTC e offset BRT
explícito, sem depender do fuso do navegador. Exibição usa Intl em pt-BR.

Escolha desta proposta para presets: dias de calendário BRT, incluindo hoje;
7 dias começam à meia-noite de hoje menos 6 dias, e terminam à meia-noite de
amanhã. Isso não altera a definição dos dias nas queries legadas; B deve manter
o parâmetro legado separado e revisar esta semântica antes de integrar.
Ao restaurar um preset, recalcular suas fronteiras para o dia atual; custom é
fixo. Em B, também atualizar a referência de presets na virada do dia BRT.

## Alcance exato da fase B

Somente as sete RPCs contratadas recebem os três argumentos novos, depois dos
atuais, sem trocar defaults/semântica de outros argumentos:

| RPC | Argumentos anteriores preservados |
| --- | --- |
| admin_score_evolution | nenhum |
| admin_segment_breakdown | nenhum |
| admin_cohort_retention | p_months (6) |
| admin_intel_insights | nenhum |
| admin_score_distribution | p_simulado_id (null) |
| admin_performance_by_area | p_simulado_id (null), p_segment (all) |
| admin_performance_by_theme | p_simulado_id (null), p_area (null), p_limit (12) |

Novos: `p_edition_id uuid default null`, `p_start_at timestamptz default null`,
`p_end_at timestamptz default null`. Edição nula é visão cumulativa permitida;
com datas, o período ainda filtra. SQL filtra antes de latest/agregação/limite.
Coorte continua mês de cadastro em America/Sao_Paulo; não rotular como coorte de
atividade. Não recalcular resultados, notas ou comparações no cliente.

Plano de implementação para nova autorização, não executado:

1. `src/types/admin-period.ts`: contrato de seleção/rascunho/intervalo e testes
   puros da conversão BRT; reutilizar contrato de metadados de edição.
2. `AdminPeriodContext`: manter `period: 7|30|90` e setters existentes para as três
   RPCs de dashboard não expandidas; adicionar seleção de edição/intervalo sem
   convertê-los em suporte inexistente. Isolar sessão por usuário; definir
   migração segura do `admin_period` legado, sem vazar seleção entre contas.
3. `AdminTopbar`: manter topbar, alertas e tema, compondo faixa de filtros abaixo.
   Montar controles novos só com editions_ui habilitada; falso preserva args,
   reads e compatibilidade anteriores, inclusive período legado.
4. `adminApi` sete métodos e `useAdminInteligencia`: só opt-in habilitado acrescenta
   args. Query keys incluem usuário, edição e range normalizado, além de months,
   simulado, segmento, área e limite já existentes. Catálogo usa fonte autorizada
   de edições, não derivação de outra tabela para aparentar suporte.
5. `AdminInteligencia` e componentes de evolução: remover duplicação de período
   para as sete consultas, sem substituir o período legado de engajamento.
   Agrupar séries por edition_id com code/label retornados por
   admin_score_evolution. Ordenar sequência só dentro da edição. Não conectar
   percentuais nem calcular melhor/pior ou queda comparando edições distintas.
6. Manter filtros locais independentes. Se o simulado local da Visão geral não
   pertencer à edição escolhida, preservar a seleção e explicar o resultado
   vazio/zeros previsto no contrato; não trocar silenciosamente para outro ID.
   Rotas de detalhe de simulado usam o próprio ID e ficam fora do opt-in global;
   conferir os callers em B, sem editar AdminSimuladoResultados nesta tarefa.
7. Testar defaults/flag falsa, isolamento por usuário, stale catálogo/storage,
   7 métodos/keys, erro de período, limite inclusivo/exclusivo e duas edições
   reiniciando sequence_number em 1. Integração real exige validação separada.

Fora do escopo: App, sidebar do produto, AdminSimuladoResultados, novo cutoff,
reprocessamento, SQL e qualquer arquivo de outro job.

## QA reproduzível

```powershell
node --test "docs/design/admin-period-prototype.test.mjs"
node ".superpowers/admin-periodQA/capture.mjs"
git diff --check
```

Testes executam o JavaScript real embutido no HTML usando Node + jsdom instalado.
TDD: primeira execução falhou por HTML ausente; regressões adicionais falharam
antes da correção de rascunho ao trocar edição, persistência do legado e reedição
do intervalo custom. Validação de contraste do Edge também falhou antes do ajuste
local dos badges escuros. Não foi executada suíte global/build de React.

Capturas e métricas ficam em `.superpowers/admin-periodQA/`, diretório de QA local
ignorado pelo Git do projeto, sem forçar inclusão ou mudar o índice. Há um log
`independent-tests.log` preexistente à retomada, não alterado por esta execução.

- Matriz: 1440×1000, 768×1024 e 375×1000; claro e escuro; full-page.
- Cinco estados em cada tamanho/tema: default, edition-period-switched,
  invalid-focus, custom-applied e long-overflow: 30 capturas.
- A 375px, loading, error, empty e flag-off nos dois temas: mais 8 capturas.
- Harness Edge instalado: sem servidor/porta, rede de página bloqueada, contagem
  de requests externos, erros JS, largura de documento e elementos, alvos 44px,
  foco no erro, teclado Tab/Enter e preservação de seleção verificados.
- Contraste medido nos pares de texto normal, secundário, erro, ação principal
  e badge, mínimo 4.5:1. Isso não equivale a auditoria WCAG completa.
- Resultados completos e fonte realmente usada: `results.json`; imagens em
  `captures/<largura>-<tema>-<estado>.png`.
- Inspeção visual das capturas complementa as assertions. Não há teste humano,
  leitor de tela, zoom de navegador ou compatibilidade Safari/Firefox nesta fase.

Critério de avanço: Codex revisar HTML, medidas e capturas; validar alcance e
semântica de presets, fallback de fonte e plano de sessão/callers. Somente após
essa revisão abrir fase B. Nenhum commit ou publicação foi realizado.
