# Análises por edição e banco de questões

Extensão das páginas existentes, no modo Operate. Direção de PRODUCT.md e DESIGN.md preservada. Protótipo offline: `edition-analysis-prototype.html`; todos os valores estão marcados como demonstração. Não são referências oficiais nem datas confirmadas. A indisponibilidade pontual do OpenCode após três tentativas sem sessão autorizou a implementação de fallback pelo Codex nesta frente.

## Direção revisada

Plus Jakarta Sans e escala existente, alinhamento à esquerda, superfícies planas, vinho para a ação principal e foco visível. Paleta derivada do projeto: fundo #FBFBFC, superfície #FFFFFF, texto #1A1D24, texto secundário #626773, linha #DDE0E6, vinho #7E1B34. Na aplicação React, usar os tokens semânticos existentes. Não introduzir fontes remotas ou dependências.

```
Comparativo / histórico     Ranking / edição
título + abas              título + abas + edição
grupos por edição          política explícita ou vazio
percentil + tabela         tabela + população + paginação

Referências / modal        Admin / banco
processo + fonte + período lista de identidades | versões
linhas sem tendência       diff + reuso em rascunho
legado separado            análise agregada por versão/edição
```

O elemento de continuidade é o agrupamento explícito por edição e origem. A proposta evita novos cards de KPI e uma linha única que sugeriria equivalência entre notas de anos diferentes. O percentil indica posição relativa, menor Top X% é melhor; a população e a posição permanecem visíveis. Grupos de edições não são conectados. Pequenas amostras têm aviso, sem afirmação de validade psicométrica.

## Contratos de experiência

- `editions_ui` desligada: páginas e leituras legadas. Novas consultas ficam em componentes filhos montados somente sob flag, com identidade e escopo nas chaves de cache.
- Ranking da edição: nenhuma política default; ausência ou desativação produz estado não configurado. Regra e quantidade realmente considerada vêm da RPC. Nomes públicos mascarados; linha do aluno é “Você”. Média bruta pertence somente à edição atual.
- Cortes: cada fonte, processo, ano e período permanece separado. `trend_comparable` é falso. Não mostrar setas, média de processos nem conversão para nota do simulado. Legado sem referência fica separado.
- Banco: escolher identidade, consultar versões, comparar payload textual e reusar explicitamente uma versão completa em rascunho autorizado. Sem editar histórico, deduplicar por texto ou recalcular resultado. Proveniência do legado é uma foto observada, não autoria histórica.
- Reuso: formulário com versão, rascunho e número da questão. Confirmação mostra IDs novos retornados pelo servidor. Em 55P03, atualizar os rascunhos e repetir manualmente; nunca retentar automaticamente uma mutação de resultado incerto.
- `content.manage` permite consulta e reuso. `intel.view` habilita agregados por versão/edição/treino/proveniência. Falta de intel.view não quebra a consulta de conteúdo. Configuração do ranking exige ambas as capabilities.

## Responsividade e estados

375px: navegação do protótipo pelo picker, linhas empilhadas com rótulos, formulário de reuso em uma coluna, modal com máximo 90dvh e scroll interno. 768px: conteúdo em coluna e comparações compactas. 1440px: lista/detalhe lado a lado. A aplicação preserva sua navegação atual.

Todas as cenas têm dados, carregando, erro com retry e vazio. Ranking acrescenta não configurado e oferta insuficiente; banco acrescenta versão incompleta, falta de intel.view e conflito de edição. Controles têm alvo de 44px e foco aparente. Dialog fecha por Escape, retorna foco e usa o primitivo existente na aplicação. Movimento apenas por ação, com reduced motion. HTML sem recurso externo.

## Revisão e implementação

Design-combo: contexto e direção pelo brief existente; protótipo com dados demo; adaptação aos tokens; movimento limitado ao feedback dos controles; crítica de hierarquia, acessibilidade e textos extremos; handoff com contratos reais. Impeccable utilizado no modo fallback, sem binário. Novas animações não se justificam neste fluxo de consulta. Nenhum serviço de design externo foi utilizado.

React somente após a revisão interna do protótipo pelo orquestrador. APIs manuais em `editionAnalysisApi` e `questionBankApi`, componentes percentil/ranking/histórico de cortes e página admin do banco; integrações mínimas em ComparativoPage, RankingPage, CutoffScoreModal, App e navigation. SQL, motor e APIs legadas ficam fora do escopo. Validação final exige componentes reais e mocks de RPC, além da inspeção visual; protótipo não prova a integração React.
