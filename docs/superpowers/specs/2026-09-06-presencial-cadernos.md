# Cadernos do presencial (Vermelho / Azul) — contrato congelado

**Data:** 2026-09-06 · **Simulado:** S7 `6be18ec8-db68-482d-9417-281d66d13ff1` · **Evento:** hoje

Este documento é o **contrato**. Quatro frentes implementam em paralelo contra ele; nada aqui muda sem
combinar. Onde diz "não muda", é literal: a peça continua byte a byte como está hoje.

---

## O problema

A prova presencial é aplicada em **dois cadernos impressos** com os mesmos 100 itens em
apresentação diferente:

- **Caderno 1 — Vermelho**
- **Caderno 2 — Azul**

A diferença entre eles pode ser (a) a ordem das questões, (b) a ordem das alternativas dentro de
cada questão, ou (c) as duas. Por isso o gabarito impresso de um não serve para o outro.

O aluno transcreve **as letras que ele marcou, na numeração do caderno dele**. A plataforma precisa
traduzir isso para `(question_id, selected_option_id)` reais antes de qualquer coisa — porque é
disso que dependem o score, a quebra por área, o `attempt_question_results` e o caderno de erros.

## A ideia central

**O caderno é uma lente na montagem do esqueleto de questões — e só isso.**

Hoje `buildSkeleton(simulado_id)` devolve as questões na ordem natural com as alternativas nos
rótulos reais. Passa a devolver, para um caderno, as questões **na ordem impressa daquele caderno**
e as alternativas **com o rótulo impresso**, apontando para os `option_id` reais.

Consequência (é o ponto do desenho): `submit` continua recebendo `[{question_id,
selected_option_id}]`, a validação das 5 condições continua idêntica, `score_presencial_answers`
continua pontuando por `question_options.is_correct`, `submit_presencial_answers` e o `finalize`
não mudam **nada**. O raio de explosão é a montagem do esqueleto e a escolha do caderno.

---

## Banco

### `public.presencial_cadernos`

| Coluna | Tipo | Nota |
|---|---|---|
| `id` | uuid pk default gen_random_uuid() | |
| `simulado_id` | uuid not null fk simulados(id) | |
| `code` | text not null | curto, minúsculo, entra em QR/URL: `v`, `a` |
| `label` | text not null | `Caderno 1` |
| `color` | text not null check in ('vermelho','azul') | dirige o token de cor no front |
| `is_active` | boolean not null default false | **só vira true depois de verificado** (ver Verificação) |
| `created_at` | timestamptz not null default now() | |

`unique (simulado_id, code)`.

### `public.presencial_caderno_items`

| Coluna | Tipo | Nota |
|---|---|---|
| `caderno_id` | uuid not null fk presencial_cadernos(id) on delete cascade | |
| `position` | int not null check (position >= 1) | número **impresso** no caderno |
| `question_id` | uuid not null fk questions(id) | questão real |
| `option_map` | jsonb not null | `{"A":"<option_id>","B":...,"C":...,"D":...}` — letra **impressa** → id da alternativa real |

`primary key (caderno_id, position)` · `unique (caderno_id, question_id)`.

### `public.presencial_sessions` — coluna nova

`caderno_id uuid null fk presencial_cadernos(id)`.

- **não nulo** → a sala está travada num caderno (modelo "um QR por cor"); o front não pergunta nada.
- **nulo** → o front pergunta ao aluno qual caderno ele recebeu (modelo "um QR só").

### `public.presencial_submissions` — coluna nova

`caderno_id uuid null fk presencial_cadernos(id)` — auditoria: com qual caderno aquele gabarito foi enviado.

### RLS

Ligada nas duas tabelas novas, **sem policy para `anon` nem `authenticated`** (idem às outras
tabelas do presencial). Acesso só por service role na edge function e por RPC de admin.

---

## Integridade — as invariantes

Um caderno só é utilizável se **todas** valerem. Elas existem porque um mapa errado corrompe a nota
de 100 alunos em silêncio, que é exatamente a classe de erro que já mordeu o S5 e o S6.

1. `count(items) = count(questions do simulado)`.
2. `position` cobre `1..N` sem buraco e sem repetição.
3. O conjunto de `question_id` dos itens é **exatamente** o conjunto de questões do simulado.
4. Para cada item, `option_map` tem exatamente as chaves `A`,`B`,`C`,`D`; os 4 valores são distintos
   e **todos pertencem à `question_id` daquele item**.

### `public.verify_caderno_map(p_caderno_id uuid, p_key text default null) returns jsonb`

`SECURITY DEFINER`, restrita a `service_role`. Roda as 4 invariantes e devolve
`{ ok: boolean, problems: [...], derived_key: "1:B,2:C,..." }`.

`derived_key` é o gabarito **impresso** deduzido do mapa: para cada `position`, a letra `L` tal que
`option_map[L]` é a alternativa correta. Quando `p_key` vem preenchido (o gabarito que o time
imprimiu, no mesmo formato `"1:B,2:C,..."`), a função compara posição a posição e lista as
divergências em `problems`.

**Gate:** `is_active` só pode ir para `true` via `public.activate_caderno(p_caderno_id, p_key)`, que
chama `verify_caderno_map` com a chave impressa e recusa (`RAISE EXCEPTION 'CADERNO_MAP_INVALID'`)
se `ok = false`. Não existe caminho de ativação que pule a verificação.

---

## Edge function `presencial`

### `buildSkeleton(supabaseAdmin, simuladoId, cadernoId)`

- `cadernoId = null` → **comportamento atual, sem alteração** (ordem natural, rótulos reais).
- `cadernoId` preenchido → lê `presencial_caderno_items` daquele caderno e devolve:

```ts
[{
  question_id,                   // questão REAL
  number: position,              // número IMPRESSO no caderno
  options: [                     // sempre 4, ordenadas A,B,C,D
    { id: option_map["A"], label: "A" },
    { id: option_map["B"], label: "B" },
    { id: option_map["C"], label: "C" },
    { id: option_map["D"], label: "D" },
  ],
}]
```

Ordenado por `position` crescente. Continua **proibido** vazar enunciado, texto de alternativa,
`explanation` ou `image_url*` — a regra não afrouxa.

Se o caderno não existir, não for do `simulado_id` da sessão, estiver `is_active = false`, ou falhar
qualquer invariante de completude (nº de itens ≠ nº de questões), a montagem **falha** — nunca serve
um esqueleto parcial. Erro de negócio, 400, mensagem pt-BR: `"Caderno indisponível. Chame o fiscal."`

### Resolução do caderno (a ordem importa)

Nas actions `checkin`, `claim` e `start-unlinked`:

1. Se `session.caderno_id` **não é nulo** → é esse, ponto. Um `caderno` vindo do cliente é
   **ignorado** (a sala manda; o cliente não escolhe numa sala travada).
2. Senão, se o corpo trouxe `caderno` (o `code`) → resolve por `(simulado_id, code, is_active)`.
3. Senão → 400 `"Escolha o caderno que você recebeu."`

Ou seja: **nunca** se cai no `cadernoId = null` num simulado que tem cadernos ativos. O fallback
`null` existe só para simulado sem caderno nenhum cadastrado (retrocompatibilidade com o fluxo de
hoje).

### Token

O payload assinado ganha `caderno_id: string | null`. Continua sem `user_id`. TTL e escopo
inalterados. O `submit` usa `payload.caderno_id` apenas para gravar em `presencial_submissions`;
a correção **não depende** do caderno, porque as respostas já chegam com os ids reais.

### Action nova: `session-info`

`POST { action: "session-info", code }` → **não** consome rate limit de check-in (bucket próprio,
teto folgado), **não** cria nada, e responde:

```ts
{
  open: boolean,                 // sala ativa e dentro de opens_at/closes_at
  label: string | null,
  caderno: { code, label, color } | null,          // sala travada num caderno
  cadernos: { code, label, color }[],              // ativos do simulado; [] se a sala é travada
}
```

Serve para dois fins: a Tela 0 saber se pergunta o caderno e com quais cores pintar, e a página
avisar **antes** de o aluno digitar nome e e-mail que a sala não está aberta — hoje ele só descobre
depois de preencher o formulário.

### `presencial_submissions`

`createSession` e `claim_presencial_unlinked_submission` passam a gravar `caderno_id`.

---

## Front do aluno

### Tela 0 — Escolha do caderno (nova)

Só aparece quando `session-info` devolve `caderno: null` e `cadernos.length >= 2`. Vem **antes** da
identificação: o caderno está fisicamente na mão do aluno, é a pergunta mais fácil da sessão, e
errar aqui invalida tudo — então é a primeira coisa e é grande.

Dois cartões, lado a lado no desktop e empilhados no celular, **altura mínima 96px**, cada um com:
a cor sólida como fundo (vermelho / azul), o `label` em destaque (`Caderno 1`) e a cor por extenso
(`Vermelho`). Sem ícone, sem ilustração — a cor é a informação.

Copy acima: **"Qual caderno você recebeu?"** e, abaixo, `"Confira a capa do seu caderno. Escolher o
caderno errado invalida sua nota."` — a consequência tem que estar escrita, não subentendida.

Quando a sala é travada (`caderno` não nulo), a tela não aparece; o caderno da sala é usado direto.

### Faixa persistente

Da Tela 1 em diante (identificação, gabarito e resultado), uma **faixa fixa no topo** com a cor do
caderno e o texto `Caderno 1 · Vermelho`. É a rede de segurança de quem escolheu errado: ele
convive com a cor errada na tela por 15 minutos enquanto preenche.

Na tela do gabarito a faixa é `sticky` e não sai da viewport ao rolar. Contraste: texto branco sobre
as duas cores, ambas com contraste ≥ 4.5:1.

### Modal de confirmação do envio

Ganha uma linha antes do "Enviar": `Caderno 1 · Vermelho — confira se é o caderno na sua mesa.`

### Tela 3 — Resultado

Mostra o caderno usado junto da nota. O resto (nota, percentual, quebra por área, CTA de 07/09)
não muda.

### Contrato do serviço (`src/services/presencialApi.ts`)

```ts
sessionInfo({ code }): Promise<PresencialSessionInfo>
checkin({ code, name, email, caderno? })
claim({ code, name, email, candidateRef, caderno? })
startUnlinked({ code, name, email, caderno? })
submit({ token, answers })            // NÃO MUDA
```

`AnswerSheetGrid` **não muda**: continua recebendo o esqueleto e devolvendo
`[{question_id, selected_option_id}]`. O `number` que ele imprime já é a posição do caderno.

---

## Admin

- Fila de identidade: coluna **Caderno** (`Caderno 1 · Vermelho`), com a cor como pastilha.
- Formulário de sessão: seletor de caderno, com a opção `— o aluno escolhe —` (grava `null`).
- Painel read-only por caderno: nº de itens, resultado da última verificação, `derived_key` e um
  botão para reverificar contra a chave impressa colada num textarea.
- Nada de CRUD de itens na UI: o mapa entra por importação (abaixo), que é auditável e verificada.

## Importação do mapa

Script Node em `scripts/import-caderno-map.ts`, rodado com service role, que lê um CSV:

```csv
caderno,posicao,questao_original,A,B,C,D
v,1,1,A,B,C,D
a,1,37,C,A,D,B
```

`questao_original` é o `questions.question_number` do S7. As colunas `A..D` dizem, para cada letra
**impressa**, qual é a letra **original** daquela alternativa na plataforma — `A,B,C,D` significa
alternativas não embaralhadas.

O script: valida o CSV, resolve os ids, escreve `presencial_caderno_items` numa transação, roda
`verify_caderno_map` contra a chave impressa e só então chama `activate_caderno`. Falhou qualquer
etapa → rollback e nada fica ativo.

---

## Fora de escopo hoje

Gerar os PDFs dos dois cadernos pela plataforma (eles já estão impressos); mais de dois cadernos
(o modelo aguenta N, a UI assume 2); embaralhamento automático; caderno para o fluxo online.
