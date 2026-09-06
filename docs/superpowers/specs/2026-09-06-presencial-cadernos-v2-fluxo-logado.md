# Presencial S7 — v2, fluxo logado (contrato congelado)

**Data:** 2026-09-06, ~14h30 BRT · **Evento:** hoje · **Corte:** 19h15 BRT

Substitui o fluxo público sem login da v1 (`2026-09-06-presencial-cadernos.md`) pelo fluxo
definido pela liderança:

```
QR code → página do ranking → login → "fiz o simulado presencialmente"
        → subir o gabarito → caderno 1 ou caderno 2
        → mesma experiência de resultado, com as questões na ordem do caderno
```

E: **19h15 BRT encerra a janela e libera o resultado para todos** — já aplicado em
`simulados` (`execution_window_end` e `results_release_at` = `2026-09-06 22:15:00+00`).

## Por que isso é MENOS trabalho que a v1

A plataforma já tem o fluxo logado de subir gabarito de prova feita no papel:
rota `/simulados/:id/gabarito` → `AnswerSheetPage` → `create_offline_attempt_guarded` /
`submit_offline_answers_guarded`. Ele já termina na experiência de resultado normal, já
respeita `results_release_at` e já entra no ranking por `is_within_window`. **O que falta
lá é só o caderno.**

O modelo de dados dos cadernos (`presencial_cadernos`, `presencial_caderno_items`,
`verify_caderno_map`, `activate_caderno`) **já está em produção e já foi verificado** —
os dois cadernos do S7 estão ativos com mapa conferido posição a posição contra o
gabarito impresso. Ele é agnóstico de fluxo: serve a v1 e a v2 sem alteração.

## O que muda em relação à v1

| v1 (público, sem login) | v2 (logado) |
|---|---|
| Identificação por nome + e-mail, com sugestão e mascaramento | Login. Identidade é certa. |
| Token HMAC escopado a um gabarito | Sessão Supabase normal |
| Resultado só agregado (para não vazar gabarito) | **Experiência de resultado normal**, liberada 19h15 junto com todo mundo |
| Estado `unlinked` + fila de vínculo no admin | Não existe: sem conta, sem envio |
| Edge function `presencial` | Nenhuma edge function nova; RPCs `SECURITY DEFINER` |

O fluxo público da v1 **fica no código, porém inalcançável**: a sala `s7-presencial` foi
desativada (`is_active = false`) e `/presencial/:codigo` passa a redirecionar. Isso também
fecha, sem depender de deploy, a janela em que a edge function antiga (que ignora cadernos)
poderia corrigir um aluno do Azul contra a ordem do Vermelho.

A rede de proteção de "ninguém sai sem enviar" deixa de ser o estado `unlinked` e passa a
ser **a janela aberta até 19h15**: quem não conseguir entrar na conta na sala entra depois
e envia — o gabarito está no papel, na mão dele.

## Invariante que não se toca

`AnswerSheetGrid` renderiza `question.number` e resolve cada bolha por
`options.find(o => o.label === label)`. Portanto, alimentando-o com `number = position` e
`{id: option_map[L], label: L}`, a grade mostra a numeração impressa do caderno e envia o
`option_id` REAL. `submit_offline_answers_guarded` continua recebendo
`[{question_id, selected_option_id}]` reais e **não muda**. O caderno é só uma lente.

---

## Banco — migration nova

1. `attempts.caderno_id uuid null references presencial_cadernos(id)`.
   Presencial = attempt `offline` COM caderno; offline de casa = sem caderno. É assim que
   a modalidade fica distinguível nos relatórios sem inventar um `attempt_type` novo.

2. `public.list_active_cadernos(p_simulado_id uuid)`
   → `TABLE(code text, label text, color text)`, `STABLE SECURITY DEFINER`,
   `search_path='public'`, EXECUTE para `authenticated`. Só cadernos `is_active`.
   Ordenado por `code`.

3. `public.get_caderno_skeleton(p_simulado_id uuid, p_caderno_code text)`
   → `TABLE(position int, question_id uuid, option_a uuid, option_b uuid, option_c uuid, option_d uuid)`,
   `STABLE SECURITY DEFINER`, EXECUTE para `authenticated`.
   - resolve o caderno por `(simulado_id, code, is_active)`; se não achar, **0 linhas**
   - as 4 colunas de opção vêm de `option_map->>'A'..'D'`
   - ordenado por `position`
   - **NUNCA** devolve enunciado, texto de alternativa, `explanation` nem `image_url*`
   - se o caderno estiver incompleto (nº de itens ≠ nº de questões do simulado),
     devolve **0 linhas** — nunca um esqueleto parcial, que faria o aluno preencher 15
     minutos para o envio ser recusado no fim

4. `public.set_attempt_caderno_guarded(p_attempt_id uuid, p_caderno_code text)`
   → `void`, `SECURITY DEFINER`, EXECUTE para `authenticated`.
   - o attempt tem que ser **do próprio `auth.uid()`** e estar em `offline_pending`
   - o caderno tem que ser ativo e do mesmo simulado do attempt
   - grava `attempts.caderno_id`; idempotente (pode ser chamada de novo se o aluno trocar)
   - qualquer violação → `RAISE EXCEPTION`, mensagem curta em maiúsculas (padrão do projeto)

---

## Front

### `/presencial/:codigo` — landing do QR (rota PRESERVADA)

O QR impresso aponta para `https://simulados.sanar.com.br/presencial/s7-presencial` e
**não pode mudar** — há material impresso em circulação. A rota continua existindo (há
teste de contrato congelando isso: `src/__tests__/presencialQrUrlContract.test.ts`) e passa
a **redirecionar para `/ranking`**. Como `/ranking` está atrás do `AuthGuard`, o login
acontece naturalmente e o aluno cai no ranking já logado — exatamente
"QR → página do ranking → login".

### `/ranking` — ponto de entrada

Enquanto a janela do S7 está aberta e o aluno **não tem** attempt enviado nele, aparece um
card/CTA: **"Fiz o simulado presencialmente"** → *"Subir o gabarito"*. Ao clicar:
cria/retoma o attempt offline (`create_offline_attempt_guarded`) e navega para
`/simulados/simulado-7/gabarito`.

### `/simulados/:id/gabarito` — escolha do caderno + ordem correta

1. Ao montar, chama `list_active_cadernos`. Se vier **vazio** → comportamento de hoje,
   inalterado (offline sem caderno).
2. Se vier com 2+ → **Tela 0**: "Qual caderno você recebeu?", dois cartões grandes na cor
   sólida, com o aviso *"Confira a capa do seu caderno. Escolher o caderno errado invalida
   sua nota."* Reusar `PresencialCadernoStep` e `presencialCadernoColors`.
3. Escolhido: chama `set_attempt_caderno_guarded` e `get_caderno_skeleton`, e monta a grade
   **a partir do esqueleto do caderno** — não de `useSimuladoDetail().questions`.
4. Faixa `PresencialCadernoBanner` sticky no topo enquanto preenche, com
   **"Não é este caderno?"** (`onChangeCaderno`) — troca apaga as marcações, com
   confirmação quando já houver questão marcada.
5. O modal de confirmação de envio ganha a linha
   `Caderno 1 · Vermelho — confira se é o caderno na sua mesa.`
6. Se `get_caderno_skeleton` devolver 0 linhas → estado de erro claro
   ("Caderno indisponível. Chame o fiscal."), **nunca** cair na ordem natural das questões:
   preencher na ordem errada é pior que não preencher.

## Fora de escopo

Reativar o fluxo público sem login; deploy da edge function `presencial` (não é mais
necessária para o dia); ranking separado por modalidade; leitura óptica.
