# Recuperação de gabarito offline

## Limites e fontes de verdade

Esta mudança é recuperação local e instrumentação futura, não migração de dados.
Não executa ações sobre as 2618 tentativas históricas, não finaliza backlog,
não envia e-mail/Novu e não acessa Supabase de produção. Nenhum resultado ou
melhoria de taxa foi medido. Testes usam identidades e tentativas sintéticas.

O servidor continua criando tentativas por RPC guarded, confirmando o status
antes do envio e calculando resultado/elegibilidade. Prazo local vencido não
transforma uma tentativa pendente em enviada ou expirada: o servidor pode
aceitar um envio antigo como treino. Uma cópia local nunca autoriza RPCs.

## Persistência e identidade

- Tentativa: `enamed_offline_attempt:v2:<userId>:<simuladoId>:<attemptId>`.
- Rascunho: `enamed_offline_draft:v1:<userId>:<simuladoId>:<attemptId>:<cadernoIdentity>`.
- Os segmentos são codificados com `encodeURIComponent`. A identidade do caderno inclui código e grade real, com ordem, números, question IDs e option IDs. Não inclui enunciados.
- A chave global legada `enamed_offline_attempt`, sem owner, não é adotada nem apagada.
- Cache exige status `offline_pending`, IDs não vazios, datas válidas e deadline posterior ou igual ao início. Não faz inferência de elegibilidade pelo relógio local.
- Login/logout altera o escopo lido imediatamente. Callbacks verificam o escopo atual e desmontagem antes de persistir, limpar estado/cache ou navegar. Queries usam chave por usuário/simulado; não há polling de storage.
- Erro de consulta mantém apenas a cópia própria validada, com confirmação necessária antes de editar/enviar. Ausência confirmada no backend remove somente o cache de tentativas daquele usuário/escopo. Não apaga os rascunhos nem a chave legada.
- Storage bloqueado não interrompe criação/download/envio. A interface avisa que a cópia local não foi salva e não a chama de sincronizada.

O rascunho é dado local de conveniência, não criptografado, acessível a scripts
da mesma origem e ao dono do navegador. Não usar computador compartilhado para
conservar marcações confidenciais. Alterar de conta não apresenta dados da
conta anterior, mas não elimina seus dados locais.

## Fluxo de recuperação

1. Criar ou retomar tentativa guarded, persistir a resposta do servidor antes de pedir o PDF.
2. Pedir PDF com `force=false`. O parâmetro legado permanece na API para os consumidores administrativos; a liberação continua sujeita aos gates do backend.
3. Se PDF falhar, manter a tentativa pendente e oferecer tentar baixar novamente ou retomar gabarito. Retry no mesmo diálogo reutiliza o attempt já criado. Após reload, o hook busca a tentativa no backend; a RPC de criação permanece idempotente se houver corrida com essa consulta.
4. Download exige HTTP OK e blob não vazio com MIME compatível; `AbortController` cancela fetch/polling ao fechar, desmontar ou mudar identidade. Object URL e elemento temporário são limpos em `finally`.
5. Ao abrir gabarito, confirmar tentativa pendente do mesmo simulado. Escolher novamente o caderno presencial e obter o esqueleto antes de restaurar. Sem esqueleto, nunca usar a ordem natural como fallback.
6. Restaurar somente o rascunho da identidade exata e filtrar question/option IDs contra a grade carregada. Cada edição é salva imediatamente, sem debounce. Troca de caderno mantém a confirmação existente e remove o rascunho abandonado, sem mapear letras.
7. Antes de cada envio, inclusive após erro/timeout/reload, consultar status real com user/attempt/simulado. `submitted` confirma o envio anterior sem reenviar. Status diferente de `offline_pending` bloqueia edição/envio e preserva o rascunho para diagnóstico. Falha na consulta não envia.
8. Só depois de sucesso confirmado remover o rascunho corrente e a tentativa própria. Falhas preservam as marcações e permitem retry. Telemetria não participa da transação.

## Funil para medição futura

Eventos existentes: `offline_attempt_created`, `offline_pdf_generated`,
`offline_answers_submitted`, `offline_answers_submit_failed`.
Envio de sucesso/falha recebe `simulado_id` real. Falhas não carregam mensagem
bruta do servidor; usam `status=error`. Falhas de transporte também são contadas.

Novos eventos: `offline_answer_sheet_opened`, `offline_draft_restored`,
`offline_recovery_clicked`. Contrato mínimo: `attempt_id`, `simulado_id`,
`route` (`answer_sheet` ou `pdf_dialog`), `answers_count` opcional de 0 a 1000.
O schema rejeita campos extras no payload do chamador. Nenhuma alternativa,
texto de questão, e-mail ou erro bruto é emitido por estes call-sites.
View é deduplicada por usuário/tentativa/montagem do componente. Nova montagem
gera outra view; agregação de funil deve usar tentativas distintas, não views.

Consulta descritiva a implementar no destino de analytics, após conferir seu
schema real, sem SQL de produção executado por esta tarefa:

```text
coorte = tentativas distintas com offline_attempt_created no período e edição
para cada (simulado_id, attempt_id) da coorte:
  created_at = primeiro offline_attempt_created
  opened_at = primeiro offline_answer_sheet_opened posterior a created_at
  restored_at = primeiro offline_draft_restored posterior a created_at
  recovered_at = primeiro offline_recovery_clicked posterior a created_at
  submitted_at = primeiro offline_answers_submitted posterior a created_at
  failed_count = contagem offline_answers_submit_failed posterior a created_at
agrupar por simulado/edição/data de criação e janela de observação fixa
taxa de envio = tentativas com submitted_at / tentativas da coorte
taxa após retomada = tentativas recovered com submitted posterior / recovered
reportar numeradores, denominadores, janela, latência e cobertura de eventos
```

`offline_pdf_generated` não tem attempt ID no contrato legado: é evidência de
disponibilidade do arquivo por simulado, não prova de download ou etapa
individual do funil. Não usar para atribuir conversão por tentativa. Falha de
telemetria, ad blockers e tentativas criadas antes do rollout causam cobertura
parcial. A coorte histórica precisa de análise autorizada separada e não pode
ser tratada como uma coorte nova. Retomada e envio correlacionados não provam
efeito causal: definir comparação e controlar janela/edição antes de afirmar ganho.

## Interface e validação

Combo 0 → 3 → 5: PRODUCT/DESIGN lidos, componentes locais preservados
(Dialog/Button/EmptyState), Plus Jakarta Sans e tokens sem nova paleta ou motion.
MCP Dendê não consultado: rede proibida neste job; DESIGN.md registra a adaptação
local existente. Sem protótipo novo, porque os estados são extensão pequena
do diálogo/grade existentes. Estados textuais de pending/erro/restauração,
retry com foco no diálogo, controles novos de pelo menos 44px e bolhas da grade
ampliadas pelo wrapper, sem depender apenas de cor.

Os testes unitários cobrem mocks de Auth, API, React Query, storage e download;
não provam integração com Auth real, geração/assinatura/PDF real ou RLS/RPCs
em execução. Revisão humana ainda deve verificar 375/768/1440px, dark mode,
teclado/retorno de foco/contraste no navegador, storage privado/bloqueado,
troca real de conta e envio com resposta perdida. Build/typecheck/suíte global
ficam com o orquestrador. Nenhuma dependência foi instalada.

## Evidência local do orquestrador — 04/11/2026

- 67 testes em8 arquivos passaram independentemente; `tsc --noEmit -p tsconfig.app.json` terminou com exit0 e `git diff --check` sem erro.
- Harness temporário importou os componentes reais com CSS do projeto, Auth/API sintéticos e todas as requisições externas bloqueadas. Foram18 capturas em375/768/1440px, claro/escuro, para PDF com erro, rascunho restaurado e confirmação de servidor indisponível. O retry criou/persistiu1 tentativa e pediu PDF2 vezes; foco ficou no retry. A grade restaurou apenas o escopo sintético correto e o erro não expôs um botão de envio.
- A revisão encontrou o diálogo maior que a viewport móvel. O `DialogContent` local recebeu limite de altura dinâmica e rolagem. Quatro verificações adicionais em375x667/800px, claro/escuro, confirmaram painel dentro da viewport, header/Fechar acessíveis por rolagem, CTA/foco visíveis e Shift+Tab para Retomar. Os6 testes do diálogo passaram novamente após esse ajuste.
- Logs e capturas estão no diretório ignorado `.superpowers/offline-codex/` do worktree do job. Esta evidência cobre UI e mocks locais; não comprova Auth/RLS, download de PDF real ou envio em produção.
