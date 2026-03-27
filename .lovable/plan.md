

# Gap Analysis: Sanarflix Academy vs. ENAMED Arena

## What IS Implemented and Working

| Feature | Status |
|---------|--------|
| Listagem de simulados com status (disponivel, em andamento, concluido, encerrado) | Done |
| Modo Prova fullscreen com cronometro, eliminacao de alternativas, revisao, atalhos de teclado | Done |
| Persistencia localStorage + Supabase (write-through cache, debounced sync) | Done |
| Deadline duplo (individual vs. global) | Done |
| Focus control (tab exit, fullscreen exit detection) | Done |
| Finalizacao manual + por tempo | Done |
| Correcao questao-a-questao com gabarito visual e comentario do professor | Done |
| Caderno de Erros (PRO only) com razao e nota de aprendizado | Done |
| Ranking com filtros (especialidade, instituicao, segmento) | Done |
| Desempenho por area e tema (drill-down hierarquico) | Done |
| Comparativo entre simulados com grafico de evolucao | Done |
| Segmentacao de acesso (guest/standard/pro) | Done |
| Modal de escolha online/offline (offline desabilitado) | Done |
| beforeunload com flushPendingState | Done |

---

## What is NOT Implemented or Partially Missing

### 1. sendBeacon para anti-perda ao fechar aba (PARCIAL)
**Sanarflix**: Usa `navigator.sendBeacon()` no `beforeunload` para enviar respostas diretamente a Edge Function, garantindo envio mesmo com aba fechando.
**ENAMED Arena**: Apenas faz `flushPendingState()` (salva no localStorage) e mostra dialog de confirmacao. Nao envia dados ao servidor via beacon.
**Impacto**: Se o usuario fechar a aba sem confirmar, as respostas ficam apenas no localStorage local.

### 2. Tutorial "Como usar o Modo Simulado" (NAO EXISTE)
**Sanarflix**: Modal com 5 passos animados (HowToUseSimuladoModal) explicando fullscreen, navegacao, eliminacao, marcacao, finalizacao.
**ENAMED Arena**: Nao tem tutorial. Apenas um card compacto "Como funciona" com texto simples na pagina de simulados.
**Impacto**: Usuarios novos nao aprendem as funcionalidades avancadas (eliminacao, atalhos, revisao).

### 3. Liberacao de desempenho configuravel (NAO EXISTE)
**Sanarflix**: 3 modos — `imediato`, `agendado`, `ao_encerrar` — por simulado.
**ENAMED Arena**: Sempre usa `results_release_at` como data fixa. Nao suporta liberacao imediata nem condicional ao encerramento.
**Impacto**: Sem flexibilidade para liberar resultado imediatamente apos finalizacao.

### 4. Questoes anuladas (NAO EXISTE)
**Sanarflix**: Admin pode anular questao; todas as respostas sao atualizadas retroativamente para `correct = true`. UI mostra badge "ANULADA".
**ENAMED Arena**: Nenhuma logica de anulacao no schema, nas RPCs, ou no frontend.
**Impacto**: Se uma questao tiver erro, nao ha como anula-la sem intervencao manual no banco.

### 5. Tentativas multiplas com historico (NAO EXISTE)
**Sanarflix**: Admin pode liberar nova tentativa; respostas antigas sao arquivadas em `answer_progress_historico`.
**ENAMED Arena**: Uma unica tentativa por simulado. Sem tabela de historico de tentativas.
**Impacto**: Nao e possivel re-liberar simulado para aluno que teve problema tecnico.

### 6. Download de PDF — Gabarito e Prova Revisada (NAO EXISTE)
**Sanarflix**: Gera PDF de 30-50 paginas com capa, resumo, questoes coloridas (acerto/erro), comentarios. Tambem gera gabarito simplificado.
**ENAMED Arena**: Nenhum export PDF implementado.
**Impacto**: Aluno nao pode baixar material de estudo offline.

### 7. Performance por dificuldade (NAO EXISTE)
**Sanarflix**: Breakdown fácil/médio/difícil no desempenho.
**ENAMED Arena**: Tem o campo `difficulty` nas questoes, mas nao e usado no `computePerformanceBreakdown` nem exibido.
**Impacto**: Aluno nao sabe se erra mais questoes faceis ou dificeis.

### 8. Performance por subespecialidade/especialidade (PARCIAL)
**Sanarflix**: Arvore hierarquica area -> especialidade -> tema com modal de revisao.
**ENAMED Arena**: Tem area -> tema, mas nao tem nivel intermediario de especialidade. O drill-down por questao existe, mas nao tem modal de revisao dentro do desempenho.

### 9. Rankings por simulado no desempenho (NAO INTEGRADO)
**Sanarflix**: Posicao na IES e no semestre diretamente na tela de desempenho.
**ENAMED Arena**: Ranking so existe em pagina separada (/ranking). Nao aparece integrado no resultado ou desempenho.

### 10. Filtros na listagem de simulados (NAO EXISTE)
**Sanarflix**: Busca por texto, filtro por tema e por professor.
**ENAMED Arena**: Nenhum filtro na SimuladosPage. Apenas separacao por secoes (disponiveis, proximos, anteriores).

### 11. Cache em sessionStorage para performance (NAO EXISTE)
**Sanarflix**: Usa `sessionStorage` para cachear dados de desempenho e preload em background.
**ENAMED Arena**: Usa React Query com staleTime de 5 min, mas nao faz preload de dados de simulados em background.

### 12. Notificacao por email de resultado liberado (NAO FUNCIONAL)
**Sanarflix**: Edge Function `notify-performance-released` com pg_cron + Resend.
**ENAMED Arena**: Tem UI para toggle de notificacao (`notifyResultByEmail`), mas nao ha Edge Function nem integracao com servico de email para efetivamente enviar.

### 13. Imagem com lightbox nas questoes (NAO EXISTE)
**Sanarflix**: Questoes com imagem exibem lightbox (ImageLightbox) para zoom.
**ENAMED Arena**: O campo `image_url` existe na tabela `questions`, mas nao e renderizado na UI do modo prova (`QuestionDisplay`) nem na correcao.

### 14. Experiencia offline / PDF da prova (PLACEHOLDER)
**Sanarflix**: Permite gerar PDF offline da prova e subir respostas depois.
**ENAMED Arena**: Botao existe no modal de escolha, mas esta desabilitado ("Em breve").

### 15. Painel Admin completo (NAO EXISTE)
**Sanarflix**: CRUD de simulados, upload XLSX, anulacao, liberacao de tentativas, exportacao, analytics.
**ENAMED Arena**: Zero interface administrativa. Toda gestao e feita direto no Supabase.

### 16. Analytics enterprise / Desempenho institucional (NAO EXISTE)
**Sanarflix**: Dashboard com KPIs executivos, segmentacao por IES, questoes problematicas, simulador de impacto.
**ENAMED Arena**: Nao existe nenhuma pagina de analytics ou desempenho institucional.

---

## Prioridades Sugeridas para Implementacao

### Alta prioridade (impacto direto no usuario)
1. **sendBeacon no beforeunload** — previne perda de dados
2. **Renderizar imagens das questoes** — dados existem, UI nao exibe
3. **Anulacao de questoes** — critico para integridade dos resultados
4. **Notificacao real de resultado** — UI existe, backend nao

### Media prioridade (melhoria significativa de UX)
5. **Tutorial do Modo Prova** — modal com passos animados
6. **Download PDF do gabarito/prova revisada**
7. **Performance por dificuldade** — campo ja existe
8. **Filtros na listagem de simulados**
9. **Ranking integrado na tela de resultado**

### Baixa prioridade (features avancadas/admin)
10. **Tentativas multiplas com historico**
11. **Liberacao de desempenho configuravel**
12. **Painel Admin**
13. **Analytics enterprise**
14. **Experiencia offline (PDF + upload)**
15. **Preload/cache avancado em background**

