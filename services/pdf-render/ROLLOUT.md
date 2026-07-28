# Runbook de Rollout: Migração PDF (pdf-lib → LaTeX/Tectonic)

## Resumo

Este documento descreve o plano de produção para o rollout progressivo do novo motor de geração de PDFs (`LaTeX/Tectonic`) em `services/pdf-render/`, substituindo o motor legado (`pdf-lib`) atualmente em uso.

**Cronograma**: As fases A-E devem ser executadas em sequência, respeitando os gates de decisão de cada fase. Nenhuma fase é retroativa — uma vez aprovada e em produção, uma fase não volta atrás.

**Responsáveis**: Engenharia (implementação do serviço, provisioning da infra), Produto (aprovação visual da capa em Task 5, decisão de cache em Fase C), DevOps (provisionamento/secrets em Cloud Run e Supabase).

---

## Fase A: Merge com default seguro (risco zero)

**Objetivo**: Integrar o novo serviço e o branch `PDF_ENGINE` no código fonte sem mudar comportamento de produção.

**Pré-requisitos**:
- Tasks 1-17 do plano concluídas e revisadas.
- Testes locais passando: `npm run test`, `npm run check:edge-pins`, `npm run typecheck`, `npm run lint`.
- Aprovação visual manual do usuário para a capa (Task 5) já registrada.

**Ações**:
1. Fazer merge da branch de desenvolvimento (contendo Tasks 1-17) para `main`.
2. **Env var default em produção**: `PDF_ENGINE` **não configurado** (ausente dos secrets de Supabase Edge Function) → Edge Function usa `"pdf-lib"` (default em `index.ts:58`; a lógica é "opt-in explícito para `latex`, qualquer outro valor cai no legado" — ver comentário no próprio código), comportamento idêntico ao de antes.
3. Código do novo serviço (`services/pdf-render/`) está presente no repo, **mas não deployado em Cloud Run** — é apenas código-fonte, sem risco operacional.
4. Verificar logs de produção por 24h: nenhuma regressão no fluxo de geração de PDF (mesmo tempo de resposta, mesmos erros já esperados).

**Gate de aprovação**: Sem mudança de comportamento observável em produção. Prosseguir para Fase B só após confirmar estabilidade.

---

## Fase B: Staging com ambos os motores (teste paralelo)

**Objetivo**: Validar o novo motor em ambiente de staging sem afetar produção.

**Pré-requisitos**:
- Fase A concluída e estável por 24h+.
- Cloud Run staging provisionado (fora de escopo desta task — assume infra já existe).
- Secrets de staging criados em Supabase (ver checklist abaixo).

**Ações**:
1. **Provisionar secrets em Supabase Staging**:
   - `PDF_RENDER_SERVICE_URL` = URL do Cloud Run staging (ex. `https://pdf-render-staging-xyz.run.app`)
   - `PDF_RENDER_SERVICE_SECRET` = valor aleatório de ~32 caracteres, gerado especificamente para staging, idêntico nos dois LADOS deste ambiente (Supabase Edge Function de staging e variável de ambiente do Cloud Run de staging) — **não** o mesmo valor que será usado em produção (ver Fase C: cada ambiente tem seu próprio secret, por segurança).
   - `PDF_ENGINE` = `"latex"` (ativa o motor novo em staging)
   - `PDF_RENDER_TIMEOUT_MS` = `45000` (padrão, pode aumentar se debugging necessário)

2. **Deploy do serviço em Cloud Run staging**:
   ```bash
   # NUNCA `docker build --platform ...` puro — em hosts Apple Silicon
   # (Colima/Docker Desktop com QEMU) isso foi encontrado produzindo
   # silenciosamente uma imagem da arquitetura ERRADA (bug real da Task 1,
   # documentado em Dockerfile/README.md). Usar sempre `docker buildx` com
   # um builder que suporte emulação cross-platform de verdade:
   docker buildx create --name multiarch --driver docker-container --use  # one-time, se o builder ainda não existir
   docker buildx build --builder multiarch --platform linux/amd64 --load -t pdf-render-staging:latest services/pdf-render/
   gcloud run deploy pdf-render-staging \
     --image pdf-render-staging:latest \
     --set-env-vars PDF_RENDER_SERVICE_SECRET=<valor-aleatorio> \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated
   ```
   (Valores exatos de GCP/projeto ficam a cargo do DevOps — este runbook presume familiaridade com `gcloud` CLI.)

3. **Teste de geração paralela**:
   - Selecionar ~5-10 simulados reais de staging com características variadas (diferentes tamanhos, conteúdo com caracteres especiais incluindo gregos, imagens, etc.).
   - Para cada simulado, forçar regeneração **duas vezes**: uma com `PDF_ENGINE=pdf-lib`, outra com `PDF_ENGINE=latex` (usar `force:true` no corpo da requisição à Edge Function — veja `supabase/functions/generate-exam-pdf/index.ts:120` para o parâmetro `force` recebido e `index.ts:137-138` para `forceRegenerate`).
   - Gerar PDFs lado a lado: `generated-pdf-lib.pdf`, `generated-latex.pdf`.

4. **Comparação visual**:
   - Renderizar ambos para PNG em resolução compatível (ex. 150 dpi): `pdftoppm -png -r 150 <pdf> <prefix>`.
   - Comparação manual página a página:
     - Capa: cores, fontes, espaçamento, círculos numerados em "COMO FUNCIONA", caixa de "REGRAS IMPORTANTES".
     - Questões: hifenização de palavras médicas, caracteres especiais (µ, °, ±, →, α, β, ç), imagens centralizadas e dimensionadas corretamente.
     - Cabeçalho/rodapé: números de página, labels "sanarflix PRO SIMULADOS".
   - **Divergências aceitáveis** (regressão?): Pequenas diferenças em micro-tipografia (tracking, kerning) são esperadas — fontes diferentes, motor LaTeX vs. pdf-lib. Alertar apenas se:
     - Caracteres desaparecerem ou ficarem "garbled" (ex. aparecer como glifos `.notdef` em vez de caracteres esperados).
     - Layout quebrado (questões fora da página, imagens sobrepostas).
     - Cores significativamente diferentes dos valores HEX definidos.

5. **Teste de integração Tier A**:
   - Rodar `npm run test:pdf-integration` contra staging (ver Task 17 para variáveis de env necessárias).
   - Suite deve incluir: `smoke.integration.test.ts`, `unicode.integration.test.ts`, `large-exam.integration.test.ts`, `service-down.integration.test.ts`, `broken-image.integration.test.ts`.
   - **Critério de aprovação**: Todos os 5 testes verdes.

**Gate de aprovação**: Comparação visual aprovada pelo Produto + suite Tier A verde. Prosseguir para Fase C.

---

## Fase C: Flip de produção (com decisão de cache)

**Objetivo**: Ativar o novo motor em produção de forma controlada.

**Pré-requisitos**:
- Fase B concluída e aprovada.
- Suite de testes Tier A passou em staging.

**Decisão crítica a registrar no dia**:

A cache de PDFs em produção usa a chave `${simulado_id}_${updated_at}` (vide `supabase/functions/generate-exam-pdf/index.ts:132-134`). Quando flipamos o motor, PDFs já gerados e armazenados com `PDF_ENGINE=pdf-lib` **não são automaticamente regenerados** — continuam sendo servidos como estão.

**Opção 1: Acumular ambos os motores (sem regeneração)**
- Deixar PDFs antigos (pdf-lib) sendo servidos para tentativas anteriores ao flip.
- Novos acessos (com `force:false`) geram com LaTeX.
- Comportamento observado pelo usuário: PDFs velhos podem ser ligeiramente diferentes dos novos (não causa problema funcional, mas é visualmente inconsistente).
- **Vantagem**: Mais rápido, sem varredura de banco.
- **Desvantagem**: Transição visual não-uniforme.

**Opção 2: Forçar regeneração de simulados ativos (touch updated_at)**
- Varrer simulados marcados como "ativos" (usar critério: `updated_at` > data do flip - 30 dias) e `touch` seu `updated_at` para valor atual.
- Isso invalida a cache, forçando regeneração LaTeX na próxima tentativa.
- Toma ~1-2h de operação em background (sem bloquear o frontend).
- **Vantagem**: Transição visual uniforme, todos os PDFs em produção usam novo motor após "burn-in".
- **Desvantagem**: Uma operação SQL admin necessária; risco de invalidar cache de propósito (se houver bugs no LaTeX ainda não descobertos, os usuários encontram todos de uma vez em produção).

**Recomendação**: Opção 2 (regeneração) é mais conservadora para longo prazo, mas requer coordenação extra. Documentar a decisão tomada aqui no commit da Fase C.

**Ações**:
1. **Provisionar secrets em Supabase Produção**:
   - `PDF_RENDER_SERVICE_URL` = URL do Cloud Run produção (ex. `https://pdf-render-prod-xyz.run.app`)
   - `PDF_RENDER_SERVICE_SECRET` = **um novo valor aleatório, gerado especificamente para produção — DIFERENTE do valor usado em staging**. O requisito de segurança é que o secret combine entre os dois LADOS de um mesmo ambiente (Edge Function de produção ↔ Cloud Run de produção), não que ele seja compartilhado ENTRE ambientes. Um vazamento do secret de staging (ambiente de teste, mais exposto/instável) não deve nunca comprometer produção — por isso staging e produção usam valores independentes.
   - `PDF_ENGINE` = `"latex"` (ativa o motor novo em produção)
   - `PDF_RENDER_TIMEOUT_MS` = `45000` (padrão, pode ajustar baseado em observações de Fase B)

2. **Deploy do serviço em Cloud Run produção**:
   ```bash
   # Mesma ressalva da Fase B: NUNCA `docker build --platform ...` puro —
   # usar sempre `docker buildx` com um builder cross-platform real (ver
   # README.md e o comentário no topo do Dockerfile).
   docker buildx build --builder multiarch --platform linux/amd64 --load -t pdf-render-prod:latest services/pdf-render/
   gcloud run deploy pdf-render-prod \
     --image pdf-render-prod:latest \
     --set-env-vars PDF_RENDER_SERVICE_SECRET=<valor-aleatorio> \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated
   ```

3. **Flip do motor em produção**:
   - Atualizar secrets de Supabase Edge Function (produção) apontando para Cloud Run produção.
   - `PDF_ENGINE` passa de ausente (default pdf-lib) para `"latex"`.

4. **Decisão de cache (uma das opções acima)**:
   - Se Opção 1: Documentar que haverá transição gradual; tomar screenshot das primeiras tentativas de cada simulado para validação.
   - Se Opção 2: Executar varredura SQL de `touch updated_at` para simulados ativos, documentar a query exata rodada e quem executou.

5. **Monitoramento imediato** (primeiros 30 min pós-flip):
   - Observar logs do Cloud Run (`gcloud run logs read pdf-render-prod --limit 100`): erros de compilação, timeouts, falhas de fetch de imagem.
   - Observar latência agregada de geração (compare com baseline de Fase B).
   - **Sugestão de operação** (a confirmar com o time de DevOps na execução): considerar setup de alerta automático e/ou rollback rápido se a taxa de erro ultrapassar um limiar definido (ex. sugestão inicial: >5% em janela de 10 minutos) — o valor exato do threshold não foi decidido neste plano, apenas a necessidade de monitorar ativamente e ter um caminho de rollback ágil. Se disparado: voltar `PDF_ENGINE` para ausente/pdf-lib.

**Gate de aprovação**: Serviço em Cloud Run respondendo, sem erros em logs, latência aceitável (< 60s p99).

Prosseguir para Fase D após 30 min de logs limpos.

---

## Fase D: Observar janela de execução real (carga concorrente)

**Objetivo**: Validar o novo motor sob carga real de produção por tempo mínimo determinado.

**Pré-requisitos**:
- Fase C concluída, serviço respondendo normalmente.
- Pelo menos 1 "janela de pico" de uso (ex. horário de aula ao vivo ou período de testes) foi observado.

**Ações**:
1. **Executar pelo menos uma janela de 2-4h de uso real**:
   - Hora padrão de maior concorrência (ex. 18h-22h se plataforma é educacional), ou agendado especificamente.
   - Deixar sistema funcionando sem intervenção; observar métricas de:
     - Taxa de requisições para `/render` no Cloud Run (deve estar ~100% de utilização em picos).
     - Latência p50/p95/p99 de resposta (não deve subir mais que 20% vs. baseline de Fase B).
     - Taxa de erro (deve permanecer < 1%).
     - Uso de memória/CPU do container (não deve atingir limites alocados).

2. **Alertas a verificar**:
   - Falhas de busca de imagem (timeout 15s, limite 5MB).
   - Falhas de compilação LaTeX (overflow de hbox, missing fonts, etc.) — logs destacam com "WARNING: Missing character" automaticamente (Task 10).
   - Falhas de autenticação (secret mismatch) — deve ser raro/zero após Fase C.

3. **Atualizações em tempo real**:
   - Se latência se degrada, considerar ajustar `PDF_RENDER_TIMEOUT_MS` (aumentar em produção se consistentemente rodam perto do timeout).
   - Se taxa de erro sobe, investigar logs; se bug encontrado, rollback local para debug + novo deploy de fix.

**Gate de aprovação**: Janela de 2-4h sem erro crítico (taxa erro <1%, sem timeouts sistemáticos). Prosseguir para Fase E.

---

## Fase E: Remover código legado (cleanup, ticket separado)

**Objetivo**: Remover código de pdf-lib antigo, branch `PDF_ENGINE` e secrets órfãos.

**Pré-requisitos**:
- Fase D concluído com sucesso.
- **Ticket Jira agendado durante Fase C**, não "algum dia" — é compromisso já feito.
- Nenhum relatório de fallback necessário para pdf-lib (i.e., todos os usuários estão usando LaTeX com sucesso).

**Ações**:
1. **Remover arquivo legado** (o import de `pdf-lib` vive inteiramente dentro deste arquivo desde a Task 14 — `index.ts` não importa `pdf-lib` diretamente, então apagar `legacyPdfLib.ts` já remove esse import por completo, nenhum passo separado é necessário):
   ```bash
   rm supabase/functions/generate-exam-pdf/legacyPdfLib.ts
   ```

2. **Remover branch `PDF_ENGINE` de `index.ts`**:
   - Remover o `import { generateLegacyPdf } from "./legacyPdfLib.ts"` (agora órfão, já que o arquivo foi apagado no passo 1).
   - Remover condicional `if (engine === "latex") { ... } else { ... }` (a ramificação `else`, que chama `generateLegacyPdf`, é o código legado a remover — ver `index.ts:60-84`).
   - Deixar apenas o caminho `callRenderService` (LaTeX) direto, sem branch.
   - Remover env vars obsoletos: `PDF_ENGINE` não mais necessário em `.env.example` (ou deixar documentado como "deprecated").

3. **Confirmar que nenhum import de pdf-lib restou**:
   - `grep -r "pdf-lib" supabase/functions/` deve retornar vazio (o import já foi embora junto com `legacyPdfLib.ts` no passo 1 — este é só um double-check).

4. **Remover secrets órfãos de produção**:
   - Se existe secret `PDF_ENGINE` em Supabase produção, deletar (já não é lido).
   - Confirmar que todos os 4 secrets necessários continuam presentes e com valores corretos:
     - `PDF_RENDER_SERVICE_URL`
     - `PDF_RENDER_SERVICE_SECRET`
     - `PDF_RENDER_TIMEOUT_MS`
     - Não existe `PDF_ENGINE` mais (foi deletado).

5. **Testar**:
   ```bash
   npm run check:edge-pins
   npm run test
   deno check supabase/functions/generate-exam-pdf/index.ts
   ```

6. **Deploy em produção**:
   - Pequeno hotfix/patch (sem mudança de lógica de usuário, só removal de código).
   - Verificar logs por 1h: nenhuma regressão.

**Gate de aprovação**: Testes passam, código limpo, logs sem erros. Migração considerada concluída.

---

## Checklist de Secrets

**Modelo de secrets (importante, leia antes de gerar valores)**: existem **DOIS** valores independentes de `PDF_RENDER_SERVICE_SECRET` neste rollout — um para staging, um para produção. Cada valor deve ser idêntico apenas entre os dois LADOS de um mesmo ambiente (a Edge Function daquele ambiente e o Cloud Run daquele mesmo ambiente). Os dois valores (staging vs. produção) devem ser **DIFERENTES** entre si — nunca reutilizar o secret de staging em produção. Um vazamento do secret de staging (ambiente de teste, com mais gente com acesso e mais superfície de debug) não deve comprometer produção; secrets independentes por ambiente é o que garante isso.

### Supabase Staging (Edge Function secrets)

- [ ] `PDF_RENDER_SERVICE_URL` = `https://pdf-render-staging-<project>.run.app` (ou equivalente)
- [ ] `PDF_RENDER_SERVICE_SECRET` = `<valor-aleatorio-32-chars-A>` (gerado só para staging)
- [ ] `PDF_ENGINE` = `"latex"` (apenas staging, não em produção até Fase C)
- [ ] `PDF_RENDER_TIMEOUT_MS` = `45000`

### Supabase Produção (Edge Function secrets)

- [ ] `PDF_RENDER_SERVICE_URL` = `https://pdf-render-prod-<project>.run.app` (ou equivalente)
- [ ] `PDF_RENDER_SERVICE_SECRET` = `<valor-aleatorio-32-chars-B>` (gerado só para produção — **diferente** do valor A usado em staging)
- [ ] `PDF_ENGINE` = `"latex"` (ativa após Fase C)
- [ ] `PDF_RENDER_TIMEOUT_MS` = `45000` (ajustável baseado em Fase B)

### Cloud Run Staging (variáveis de ambiente do serviço)

- [ ] `PDF_RENDER_SERVICE_SECRET` = `<valor-aleatorio-32-chars-A>` (idêntico ao secret de staging acima — mesmo lado do ambiente)
- [ ] `PORT` = `8080` (padrão implícito se não setado)

### Cloud Run Produção (variáveis de ambiente do serviço)

- [ ] `PDF_RENDER_SERVICE_SECRET` = `<valor-aleatorio-32-chars-B>` (idêntico ao secret de produção acima — mesmo lado do ambiente; **diferente** do valor A de staging)
- [ ] `PORT` = `8080` (padrão implícito se não setado)

**Nota de segurança**: cada `PDF_RENDER_SERVICE_SECRET` (staging e produção) deve ser gerado uma única vez e compartilhado identicamente apenas entre os dois lados DO MESMO AMBIENTE (Supabase Edge Function daquele ambiente + Cloud Run daquele mesmo ambiente) — nunca entre staging e produção. Usar um gerenciador de secrets (ex. `gcloud secrets create`, 1Password) para guardar cada valor entre fases — não versionar nem deixar em commit.

---

## Recomendações de recursos/concorrência no Cloud Run (documentação apenas — infra não provisionada nesta task)

Nem este runbook nem `README.md` documentavam, até agora, configurações de memória/CPU/concorrência do Cloud Run — os defaults do Cloud Run (512Mi de memória, concorrência 80) são inadequados para este serviço e provavelmente causariam OOM e comportamento patológico em produção: cada requisição `/render` roda um processo `tectonic` completo (motor TeX inteiro) mais `sharp` para normalização de imagem, e concorrência 80 significaria até 80 processos `tectonic` simultâneos disputando memória/CPU em uma única instância de container.

**Recomendações para quem for provisionar/fazer o deploy (a confirmar/ajustar com DevOps na hora, mas usar como ponto de partida)**:

- **Memória**: ≥ 2Gi por instância. Tectonic + fontes vendorizadas + `sharp` decodificando imagens grandes podem facilmente passar de 512Mi-1Gi em documentos com muitas questões/imagens.
- **CPU**: pelo menos 1 vCPU completa alocada por instância durante a execução da requisição (não usar CPU throttling "apenas durante requests" de forma agressiva — a compilação LaTeX é CPU-bound do início ao fim).
- **Concorrência (`--concurrency`)**: 1 a 4 requisições simultâneas por instância — **não** o default de 80. Cada requisição roda um processo `tectonic` isolado (motor TeX completo), então concorrência alta por instância é o oposto do que se quer aqui; preferir escalar HORIZONTALMENTE (mais instâncias) a colocar muitas requisições na mesma instância.
- **Timeout de requisição (`--timeout`)**: ≥ ao timeout por tentativa da Edge Function (`PDF_RENDER_TIMEOUT_MS`, default 45s — ver também a Nota de Finding 6 sobre o timeout de compile no serviço, default agora 40s). Um timeout de Cloud Run menor que o timeout da Edge Function mataria a requisição no meio antes mesmo do timeout "esperado" do lado do chamador.
- **Max instances**: definir um teto explícito (não deixar ilimitado) para evitar custo/carga de banco de dados descontrolados em caso de pico ou bug de retry; valor exato fica a critério do DevOps baseado no tráfego esperado.

**Por que isso importa para a Fase D**: o gate de aprovação da Fase D exige que "uso de memória/CPU não deve atingir limites alocados" — esse gate só é verificável se os limites alocados (memória/CPU/concorrência acima) estiverem de fato configurados e documentados; sem eles, não há contra o que comparar as métricas observadas.

---

## Milestone 7: Erro rápido ao cliente (PR separado, pós-rollout)

**Importante**: A implementação de erro rápido ao cliente (reduzir tempo de espera quando o serviço `pdf-render` falha, tocando `src/services/offlineApi.ts:85-86` para ajustar `MAX_ATTEMPTS` ou `POLL_INTERVAL_MS`) é uma task **separada**, **fora de escopo deste rollout**.

- **Quando**: Depois que Fase D estiver 100% estável (mínimo 1 semana, recomendado 2 semanas).
- **Quem**: PR próprio, revisado independentemente desta migração.
- **Mudança**: Apenas `src/services/offlineApi.ts`, nada no backend.
- **Não comece antes de Fase E estar concluída** — prioridade de estabilidade.

Este runbook não inclui guia para Milestone 7. Consulte o task backlog quando chegar a hora.

---

## Referências

- Plano: `/Users/icaroisd/.claude/plans/claude-precisamos-fazer-uma-drifting-hare.md`
- Tasks associadas: 1-17 (implementação), Task 18 (este runbook)
- Código de produção:
  - Edge Function: `supabase/functions/generate-exam-pdf/index.ts`
  - Novo serviço: `services/pdf-render/`
  - Cliente: `src/services/offlineApi.ts` (não muda neste rollout)
- "Decisões já fechadas" no plano (não reabrir):
  - Host: Cloud Run (fora de escopo provisioning).
  - Linguagem: Node.js + TypeScript.
  - Diagramação: 1 coluna.
  - Secret compartilhado: Header `x-internal-secret`, constant-time comparison.
  - Resposta: PDF bytes diretos (`Content-Type: application/pdf`).
  - Fidelidade visual: Recriação com tcolorbox/tikz, aprovação manual obrigatória.

---

**Data de criação deste runbook**: 2026-07-27
**Versão**: 1.0 (pré-rollout)
**Status**: Pronto para Fase A
