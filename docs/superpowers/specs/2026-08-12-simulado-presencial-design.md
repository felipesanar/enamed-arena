# Aplicação presencial do Simulado 7 — Design Spec

**Data:** 2026-08-12
**Simulado alvo:** Simulado 7 — `6be18ec8-db68-482d-9417-281d66d13ff1`, slug `simulado-7`
**Janela de execução:** 2026-08-30 12:01Z → 2026-09-06 02:59Z (30/08 09:01 → 05/09 23:59 BRT)
**Liberação de resultado:** 2026-09-07 12:01Z (07/09 09:01 BRT)

---

## Objetivo

Permitir que alunos que fazem o Simulado 7 **presencialmente, no papel** leiam um QR code na sala, informem quem são, transcrevam o gabarito na plataforma e vejam o resultado na hora — e que essa tentativa fique marcada como presencial, distinta de quem fez online.

A aplicação presencial acontece **dentro da janela de execução** do simulado. Isso é premissa do desenho: elimina o problema de a prova vazar para a turma online e faz o attempt presencial entrar no ranking pelas mesmas regras, sem exceção.

---

## Decisões tomadas

| Decisão | Escolha | Por quê |
|---|---|---|
| Autenticação via QR | **Sem login.** QR único por sala; o aluno só informa nome + e-mail | Login/senha no meio de uma sala com 100 pessoas vira fila de suporte |
| Sessão de autenticação | **Nenhuma.** O aluno recebe um token curto preso ao attempt, não uma sessão Supabase | Sem sessão, ninguém abre caderno de erros / desempenho / dados de outra conta |
| Conteúdo da prova | O fluxo **nunca** serve enunciado nem texto de alternativa | A prova está no papel; a plataforma não precisa expor a prova para receber o gabarito |
| Resultado na hora | Nota (acertos/100 + percentual) **e** quebra por área. Sem correção questão-a-questão | Impacto de evento sem entregar o gabarito comentado à turma online, que ainda está fazendo até 05/09 |
| Em branco no gabarito | **Exige as 100 marcadas**, igual ao online | Paridade: o online também não aceita em branco (o `finalize` bloqueia). Permitir em branco só prejudicaria o presencial, porque em branco conta como erro |
| Tentativa única | **Uma só por aluno; presencial ganha** | Regra vigente da plataforma é tentativa única por simulado |
| Diferenciação presencial × online | Banco + admin + exports, e **selo visível pro aluno** | Ranking separado e comparativo por modalidade foram descartados |
| Lista de inscritos | **Não haverá.** O marcador de presencial vem da sessão da sala, não de validação de identidade | Não há relação de inscritos antes do evento |

### Risco aceito, explicitamente

Como não há prova de posse do e-mail, **um participante consegue enviar um gabarito no nome de um colega cujo e-mail ou nome ele conheça.** Isso foi avaliado e aceito, com estas condições:

- ele **não** ganha acesso à conta (não há sessão) — o dano máximo é uma nota indevida, não vazamento de dados;
- 1 envio por conta, irreversível;
- a sessão presencial só aceita envio dentro da janela do evento;
- rastro completo no admin (hora, hash de IP, código da sala, **caminho de identificação usado**);
- o dono da conta vê a tentativa no próprio histórico;
- o admin consegue reatribuir/anular a tentativa pela fila de identidade (ver **Admin**).

---

## Fluxo do aluno

```
Tela 1: nome + e-mail
├─ e-mail existe ................. entra direto                    ← maioria, 2 toques
└─ e-mail não existe
   ├─ nome bate em 1–3 contas .... escolhe (com desempate se ≥2) → entra
   ├─ nome bate em 0 ou 4+ ....... cria conta em 30s → entra
   └─ (sempre disponível) ........ "seguir sem vincular" → admin vincula depois

→ Tela 2: gabarito (100 bolhas A/B/C/D, sem timer)
→ Tela 3: resultado na hora (acertos/100, percentual, quebra por área)
```

### Tela 1 — Identificação

Rota pública `/presencial/:codigo`, fora do `AuthGuard` e fora do shell premium (sem sidebar/topbar). Layout de evento, uma coluna, legível em celular na mão.

Copy deixando explícito onde ele está: *"Você está na Plataforma de Simulados SanarFlix PRO. Informe o e-mail que você usa aqui — se você já tem conta."*

Campos: **nome completo** e **e-mail**.

1. Busca por e-mail normalizado (`lower(btrim(...))`) em `profiles.email`. Achou → segue. O nome não valida nada neste ramo; serve para a sugestão e para o cadastro.
2. Não achou → busca por **nome normalizado**: `lower(regexp_replace(unaccent(btrim(full_name)), '\s+', ' ', 'g'))`, match exato. Se o match exato não devolver nada, um segundo passe compara **primeiro token + último token** do nome normalizado (ou seja, "Ana Paula Souza Lima" também casa com "Ana Lima"), aplicando o mesmo corte de candidatos.
   - **1 a 3 candidatos** → mostra cada um com e-mail **mascarado** e, quando há 2+, um sinal de desempate (§B). Botões: **[É minha conta]** por candidato e **[Nenhuma é minha]**.
   - **0 ou 4+ candidatos** → não sugere nada, vai para o cadastro. 4+ significa nome comum; mostrar a lista só aumenta a chance de o aluno clicar na conta de um homônimo.
3. Cadastro (ramo sem conta): nome + e-mail + senha, reusando a edge function `create-guest-account` que já existe. Ao concluir, refaz o check-in automaticamente.
4. **"Seguir sem vincular agora"** — botão secundário, disponível em todos os ramos (§C).

Antes de avançar, uma confirmação mostra o e-mail escolhido **em destaque, sem máscara quando foi ele quem digitou**, para pegar erro de digitação enquanto ainda é barato.

#### Mascaramento de e-mail

Preserva 2 primeiros e 2 últimos caracteres do local-part, primeira letra do domínio e o TLD:
`joao.silva@gmail.com` → `jo••••••va@g••••.com`. Local-part com ≤4 caracteres mostra só o primeiro caractere.
Suficiente para o dono reconhecer, insuficiente para colher endereço de terceiro.

#### B. Desempate por histórico

Quando há **2 ou 3** candidatos, cada opção mostra, além do e-mail mascarado, um resumo que só o dono reconhece de imediato:
*"criada em jun/2026 · fez os Simulados 5 e 6 · Aluno PRO"*.

Fonte: `profiles.created_at`, `profiles.segment` e os `simulados.title` dos attempts com `status='submitted'` daquela conta.

Limitado de propósito, porque expõe resumo de atividade de outra pessoa: só com **2+ candidatos**, só dentro de sessão presencial aberta, e só depois de o e-mail digitado ter falhado. Com 1 candidato o e-mail mascarado basta.

### Tela 2 — Gabarito

Reusa `AnswerSheetGrid` ([src/components/exam/AnswerSheetGrid.tsx](../../../src/components/exam/AnswerSheetGrid.tsx)): bolhas A/B/C/D, auto-avanço para a próxima em branco, barra de progresso, botão sticky. **Sem cronômetro** — o tempo foi controlado pelo fiscal no papel.

Exige as 100 questões marcadas. Modal de confirmação antes do envio.

O grid é montado a partir do **esqueleto** devolvido no check-in: `[{ question_id, number, options: [{ id, label }] }]`. Nenhum enunciado, nenhum texto de alternativa.

### Tela 3 — Resultado

Acertos/100, percentual e quebra por área (Clínica, Cirurgia, GO, Pediatria, Preventiva), com barra por área. Sem questão-a-questão, sem qual era a correta.

CTA: *"Gabarito comentado, ranking e caderno de erros liberam em 07/09 — entre na sua conta em simulados.sanar.com.br."*

Estado `unlinked` (§C) mostra o mesmo resultado, mais um aviso: *"sua nota entra no ranking quando confirmarmos sua conta."*

---

## C. Estado `unlinked` — o gabarito nunca se perde

Em qualquer ponto em que o vínculo não fecha — não é a conta dele, não quis criar conta, e-mail corporativo, desistiu no meio — o aluno usa **"seguir sem vincular agora"**: preenche o gabarito, envia e **vê nota e áreas na hora**, porque a correção não depende de conta nenhuma.

A submissão fica salva como presencial não vinculada, com nome e e-mail auto-declarados. No admin, a fila **"presenciais pendentes de vínculo"** mostra cada submissão com a conta candidata já sugerida; um clique vincula, cria/converte o attempt e a nota entra no histórico e no ranking do aluno.

Efeito na sala: ninguém deixa de fazer, ninguém perde o gabarito preenchido, e o fiscal não depura login no meio da prova. O erro deixa de custar a prova do aluno e passa a custar um clique depois.

Para não virar o caminho preguiçoso de todo mundo: é botão secundário, e a copy é honesta sobre a consequência.

---

## D. Fila de dedupe — o subproduto

Toda vez que a busca por nome devolve 2+ contas, gravamos o par como possível duplicata, junto com a resposta do aluno sobre qual é a dele.

Hoje a base tem **8.388 contas, 7.807 nomes únicos, 98 nomes com 2 contas, 35 com 3 e 40 com 4+** (maior colisão: 19). Os 133 nomes com 2–3 contas são, muito provavelmente, 133 pessoas com conta duplicada — bagunça que nunca teve como ser resolvida porque faltava exatamente isto: o aluno dizendo qual é a conta certa.

Fila de vínculo pendente (C), par de duplicatas (D) e "reatribuir tentativa entre contas" são **a mesma ferramenta de admin**: resolver identidade de aluno e reatribuir tentativa.

---

## Conflito com a tentativa online — "presencial ganha"

- Conta **sem** attempt do S7 → cria attempt novo, `attempt_type='presencial'`.
- Conta **com** attempt online (`in_progress` ou `submitted`) → **converte o mesmo attempt em presencial no lugar**, regravando as respostas e refinalizando.
  - Por que in-place e não "cria novo + arquiva o antigo": arquivar exigiria ensinar ~30 RPCs de ranking/admin/performance a ignorar attempts arquivados. Converter mantém *uma linha por aluno por simulado*, invariante que todo o resto do sistema já assume.
  - As respostas online originais vão para `backup.presencial_superseded_answers` (convenção do schema `backup` já usada no projeto), com `attempt_id`, respostas e timestamp.
  - `finalize_attempt_with_results` tem early-return quando o attempt já está `submitted` com `score_percentage` não nulo — a conversão precisa zerar `score_percentage`/`total_correct`/`total_answered` antes de refinalizar.
- Depois do presencial, o online fica travado. `create_attempt_guarded` hoje só considera attempts `attempt_type='online'` nos checks de "já enviado" — precisa passar a barrar quando existe attempt presencial, com mensagem própria (*"você já fez este simulado presencialmente"*).

---

## Banco de dados

### Alterações em tabelas existentes

- `attempts.attempt_type` — CHECK passa de `('online','offline')` para `('online','offline','presencial')`.
- `attempts.status` — ganha o valor `'presencial_pending'` (não há CHECK constraint em `status`, mas o valor precisa ser reconhecido nos derivadores e RPCs de admin).

### Tabelas novas

**`public.presencial_sessions`** — a sala. É o que o QR aponta e o que abre/fecha o recebimento.

| Coluna | Tipo | Nota |
|---|---|---|
| `id` | uuid pk | |
| `simulado_id` | uuid fk | |
| `code` | text unique | curto, entra na URL do QR (ex.: `s7-rec`) |
| `label` | text | cidade/sala, para analytics |
| `opens_at` / `closes_at` | timestamptz | fora disso o link não recebe nada |
| `is_active` | boolean | kill switch |
| `created_at` | timestamptz | |

**`public.presencial_submissions`** — o registro do que aconteceu no evento. Escrito **sempre**, nos dois ramos.

| Coluna | Tipo | Nota |
|---|---|---|
| `id` | uuid pk | |
| `session_id` | uuid fk | |
| `simulado_id` | uuid fk | |
| `declared_name` / `declared_email` | text | auto-declarados |
| `identification_path` | text | `email_direct` \| `name_suggestion` \| `new_account` \| `unlinked` — auditoria |
| `answers` | jsonb | snapshot do que ele marcou |
| `total_correct` / `score_percentage` | int / numeric | para a fila poder exibir sem recalcular |
| `linked_user_id` | uuid null | |
| `linked_attempt_id` | uuid null | |
| `status` | text | `linked` \| `unlinked` |
| `ip_hash` | text | sha256, para rate limit e auditoria |
| `created_at` / `linked_at` | timestamptz | |

**`public.presencial_duplicate_candidates`** — pares de possível duplicata (§D): `id, session_id, submission_id, candidate_user_id, chosen boolean, created_at`.

RLS ligada nas três, **sem policy para `anon` nem `authenticated`**: todo acesso passa por edge function com service role, e a leitura de admin passa por RPC de admin. (Consistente com o hardening de grants de 04/08.)

### RPCs novas (todas `SECURITY DEFINER`, restritas a `service_role`)

**`finalize_attempt_with_results_for_user(p_attempt_id uuid, p_user_id uuid)`**
Extração da função atual, que hoje resolve o usuário por `auth.uid()` e por isso não serve a um fluxo sem sessão. A `finalize_attempt_with_results(p_attempt_id)` existente passa a ser um wrapper que chama esta com `auth.uid()`. **Nenhuma lógica de score duplicada.**
Atenção na migration: mudar assinatura/retorno de função existente dá `42P13` — precisa `DROP` antes, e reconceder os grants (`authenticated` na wrapper, `service_role` na variante).

**`score_presencial_answers(p_simulado_id uuid, p_answers jsonb)`**
Calcula, sem attempt: `total_correct`, `score_percentage` e a quebra por área, direto de `question_options.is_correct` + `questions.area`. Fonte **única** do que a Tela 3 mostra, nos dois ramos — hoje a quebra por área é calculada no cliente em [src/lib/resultHelpers.ts](../../../src/lib/resultHelpers.ts), e o fluxo presencial não pode depender de dados de questão no cliente.

**`submit_presencial_answers(p_attempt_id uuid, p_user_id uuid, p_answers jsonb)`**
Grava respostas em `answers` (`ON CONFLICT (attempt_id, question_id)`), calcula `is_within_window` pela regra vigente (envio dentro de `[execution_window_start, execution_window_end]`), zera os campos de nota se for conversão, e chama `finalize_attempt_with_results_for_user`.

**`create_or_convert_presencial_attempt(p_simulado_id uuid, p_user_id uuid)`**
Resolve o conflito descrito acima e devolve o `attempt_id`.

**`link_presencial_submission(p_submission_id uuid, p_user_id uuid)`**
Usada pela fila de admin: cria/converte o attempt, grava as respostas guardadas, finaliza e marca a submissão como `linked`.

### O que **não** muda

- `prevent_direct_attempts_update` já libera `service_role` e RPC `SECURITY DEFINER` — nada a mexer.
- `error_notebook` não é populado na finalização (é ação explícita do aluno via `add_to_notebook_bulk_guarded`) — nada a limpar na conversão.
- `user_performance_history` tem `ON CONFLICT (attempt_id) DO UPDATE` — a conversão in-place atualiza a linha, não duplica.
- `results_release_at` e o gate de resultado continuam intactos para todas as superfícies logadas. O fluxo presencial é a única superfície que mostra agregados antes da liberação, e mostra **só** agregados.

---

## Edge functions

Todas com service role, CORS restrito ao mesmo allowlist de origens de `create-guest-account`, e rate limit reusando o padrão de bucket que já existe (`bump_guest_signup_bucket`, generalizado para aceitar novos tipos de bucket).

**`presencial-checkin`** — `POST { code, name, email }`
Valida código + `opens_at/closes_at` + `is_active`. Rate limit por IP e por e-mail. Resolve identidade:
- e-mail encontrado → `{ status: 'ready', token, questions_skeleton }`
- e-mail não encontrado, 1–3 candidatos por nome → `{ status: 'suggestions', candidates: [{ ref, masked_email, hint }] }` (`ref` é opaco; o `user_id` nunca sai)
- e-mail não encontrado, 0 ou 4+ → `{ status: 'no_account' }`

Rate limit próprio, mais duro, para o ramo de busca por nome.

**`presencial-claim`** — `POST { code, candidate_ref }` → confirma um candidato sugerido e devolve `{ token, questions_skeleton }`, com `identification_path='name_suggestion'`.

**`presencial-start-unlinked`** — `POST { code, name, email }` → devolve `{ token, questions_skeleton }` com `identification_path='unlinked'`, sem tocar em conta nenhuma.

**`presencial-submit`** — `POST { token, answers }` → grava a `presencial_submission` (sempre) e, no ramo vinculado, chama `submit_presencial_answers` para persistir o attempt.

O payload de resposta vem **sempre** de `score_presencial_answers`, nos dois ramos: `finalize_attempt_with_results_for_user` devolve os totais mas não a quebra por área, e a Tela 3 precisa ter uma fonte só. Devolve `{ total_correct, score_percentage, by_area[] }`.

### Token

HMAC assinado pela edge function (segredo em variável de função), TTL de 2h, payload mínimo: `submission_id`, `simulado_id`, `attempt_id` (null quando `unlinked`), `session_id`, `exp`.

**Não é sessão Supabase.** Não abre caderno de erros, desempenho, ranking, nada. Só serve para enviar aquele gabarito.

---

## Frontend

| Arquivo | Tipo | Responsabilidade |
|---|---|---|
| `src/pages/PresencialPage.tsx` | Página | Rota pública `/presencial/:codigo`; orquestra as 3 telas |
| `src/components/presencial/PresencialIdentifyStep.tsx` | Componente | Nome + e-mail, sugestões, cadastro, "seguir sem vincular" |
| `src/components/presencial/PresencialCandidateCard.tsx` | Componente | Candidato com e-mail mascarado + desempate |
| `src/components/presencial/PresencialResultStep.tsx` | Componente | Nota + quebra por área + CTA |
| `src/services/presencialApi.ts` | Serviço | Chamadas às 4 edge functions |
| `src/lib/maskEmail.ts` | Helper | Mascaramento (com teste unitário) |

Reusa sem alteração: `AnswerSheetGrid`.

Modificados:
- `src/App.tsx` — rota pública `/presencial/:codigo` fora do `AuthGuard` e do shell premium.
- Selo **"Aplicação presencial"** onde o aluno vê a tentativa (card do simulado, tela de resultado, histórico), derivado de `attempt_type`.

---

## Admin

- **Sessões presenciais**: criar/editar sala (código, label, janela), e exibir o QR pronto para impressão. Não há lib de QR no projeto hoje — entra uma dependência pequena, carregada só nessa rota lazy do admin.
- **Fila de identidade** (a ferramenta única de §C/§D): submissões `unlinked` com conta candidata sugerida, pares de duplicata, e reatribuição de tentativa entre contas. Mostra `identification_path`, hora, hash de IP e sala — as tentativas reivindicadas por nome ficam visíveis aqui para conferência rápida.
- **Modalidade** como coluna e filtro nas telas de tentativas e no export de roster de resultados ([src/admin/utils/exportResultsRoster.ts](../../../src/admin/utils/exportResultsRoster.ts)).

---

## Telemetria

Eventos na camada de analytics existente, para medir o funil do evento: `presencial_checkin_started`, `presencial_identified` (com `identification_path`), `presencial_no_account`, `presencial_account_created`, `presencial_unlinked_started`, `presencial_submitted`, `presencial_linked_by_admin`.

---

## Segurança — resumo

| Risco | Mitigação |
|---|---|
| Enviar gabarito no nome de um colega | Risco aceito. Sem sessão (dano limitado a nota indevida), 1 envio por conta, janela da sala, rastro de `identification_path` + IP + hora, reatribuição no admin |
| Homônimo escolher a conta errada | Corte em 3 candidatos, e-mail mascarado, desempate por histórico, "nenhuma é minha", e reatribuição no admin |
| Link do QR circulando fora da sala | `opens_at`/`closes_at` + `is_active` |
| Vazar a prova pela plataforma | O fluxo só devolve número de questão e letras; enunciado e alternativas nunca saem |
| Vazar o gabarito pela nota | Só agregados; envio único impede descobrir resposta por tentativa e erro |
| Enumeração de e-mail e de nome | Rate limit por IP e por e-mail; bucket próprio, mais duro, para busca por nome; e-mail sempre mascarado; busca por nome só quando o e-mail falhou e só com sessão aberta |
| Adulterar nota / entrar no ranking indevidamente | Score e `is_within_window` só em RPC server-side; `prevent_direct_attempts_update` barra escrita direta |
| Token roubado | TTL 2h, escopo de um único gabarito, sem poder de leitura de dados da conta |

---

## Fora de escopo

Ranking separado de presencial; comparativo/desempenho por modalidade; QR individual por aluno e lista de inscritos; verificação por código de e-mail; correção questão-a-questão na hora; leitura óptica da folha de papel; presencial para simulados anteriores ao 7.

---

## Critérios de sucesso

- Do QR ao gabarito em **≤ 2 telas** para quem sabe o próprio e-mail.
- **Nenhum** aluno da sala termina sem gabarito enviado: todo caminho de falha desemboca em `unlinked` com resultado na tela.
- O fluxo nunca transmite enunciado ou texto de alternativa ao cliente.
- `is_within_window` e nota continuam determinados apenas server-side.
- Depois do evento: nota média presencial × online comparável no admin, e a fila de identidade zerada.

---

## Riscos operacionais

1. **Wi-fi do local.** Cada aluno faz ~4 requests; o backend não sente 100 pessoas. O gargalo é a rede do local — vale plano B (4G, ou envio em duas ondas).
2. **Alguém com acesso ao admin na sala**, para resolver caso extremo na hora em vez de depois.
3. **`results_release_at` é 07/09.** O presencial passa a ser a única superfície que mostra nota antes disso. Se a turma online souber, vai haver reclamação de assimetria — é decisão de comunicação, não técnica.
