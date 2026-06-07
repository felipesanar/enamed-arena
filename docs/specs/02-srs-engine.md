> Contratos de nomes/enums/eventos/limiares seguem [00-contratos-canonicos.md](00-contratos-canonicos.md) (fonte da verdade).

# Spec 02 — Motor de Repetição Espaçada (SRS Engine)

**Produto:** SanarFlix PRO Simulados · Caderno de Erros  
**Pacote:** Fase 1 · MVP SRS  
**Status:** Especificação técnica — pronto para engenharia  
**Data:** Junho/2026  
**Depende de:** Spec 01 (modelo de dados `error_notebook` + tabela `review_attempts`)  

---

## 1. Escolha do algoritmo: SM-2-lite

### 1.1 Por que SM-2

O **SM-2** (SuperMemo 2, Wozniak 1987) é o algoritmo de repetição espaçada mais documentado, amplamente implementado (Anki, RemNote, Mochi) e com comportamento comprovado para material de múltipla escolha com autoavaliação. Sua mecânica central — fator de facilidade (`ease`) que escala o intervalo a cada revisão bem-sucedida — casa perfeitamente com o fluxo proposto: o aluno re-resolve a questão às cegas, avalia o esforço subjetivo (Errei/Difícil/Bom/Fácil) e o sistema determina o próximo agendamento.

Razões adicionais para a escolha em v1:

| Critério | SM-2-lite | Alternativas |
|---|---|---|
| Implementação em SQL/PL/pgSQL | Trivial (aritmética simples) | FSRS: requer séries de vetores, cálculo de estabilidade/dificuldade |
| Sem cold-start de parâmetros | Não precisa de histórico mínimo | FSRS: requer calibração com dados acumulados |
| Auditabilidade | Qualquer desenvolvedor entende | FSRS: modelo probabilístico opaco para debugging |
| Custo de migração para FSRS | Baixo: mesmos campos base + colunas extras | Alto se implantado invertido |
| Comportamento validável manualmente | Sim (ver seção 8) | FSRS: exige simulação numérica |

### 1.2 Matemática exata do SM-2-lite

O algoritmo opera sobre quatro campos por entrada:

| Campo | Tipo | Valor inicial | Significado |
|---|---|---|---|
| `srs_ease` | `float` | `2.5` | Fator de facilidade; escala o intervalo a cada revisão bem-sucedida |
| `srs_interval` | `int` | `0` | Intervalo atual em **dias** |
| `srs_reps` | `int` | `0` | Contagem de revisões bem-sucedidas consecutivas (sem lapso) |
| `srs_lapses` | `int` | `0` | Contagem acumulada de lapsos (erros na revisão) |

#### Cálculo do intervalo por número de reps bem-sucedidas

```
-- Após revisão bem-sucedida (quality q >= 2):
IF reps = 0 THEN
  new_interval := 1          -- primeiro acerto: volta amanhã
ELSIF reps = 1 THEN
  new_interval := 4          -- segundo acerto consecutivo: volta em 4 dias
ELSE
  new_interval := ROUND(srs_interval * srs_ease)   -- acertos subsequentes
END IF

new_ease := srs_ease + (0.1 - (4 - q) * (0.08 + (4 - q) * 0.02))
-- Clamp: ease nunca cai abaixo de 1.3
new_ease := GREATEST(new_ease, 1.3)

new_reps := srs_reps + 1
```

#### Cálculo em caso de lapso (quality q < 2, i.e., "Errei")

```
-- Lapso: o aluno errou na re-resolução
new_interval := MAX(1, ROUND(srs_interval * 0.20))   -- volta a ~20% do intervalo
new_ease     := GREATEST(srs_ease - 0.20, 1.3)        -- ease penalizada
new_reps     := 0                                       -- reinicia contador consecutivo
new_lapses   := srs_lapses + 1
```

**Nota sobre reps = 0 após lapso:** o intervalo pós-lapso `ROUND(srs_interval * 0.20)` preserva memória de onde o aluno estava (diferente do Anki que reseta para 1 dia fixo). Isso evita punição excessiva em entradas muito avançadas. O mínimo é 1 dia.

#### Cálculo da data de próxima revisão

```
new_srs_due_at := NOW() + new_interval * INTERVAL '1 day'
```

"Devida hoje" = `srs_due_at <= (CURRENT_DATE + INTERVAL '1 day' - INTERVAL '1 second')` (fim do dia local). Ver seção 9.

### 1.3 FSRS como upgrade futuro (v2)

O **FSRS 4.5+** (Free Spaced Repetition Scheduler) modela explicitamente *estabilidade de memória* e *dificuldade intrínseca* usando uma função psicológica baseada em curvas de esquecimento de Ebbinghaus calibradas por ML. É superior ao SM-2 em precisão de agendamento, especialmente para material heterogêneo (a questão de IAM tem curva diferente de uma de anatomia topográfica). **Por que não agora:** o FSRS requer estimativa de parâmetros por histórico individual (mínimo ~50 revisões por aluno para calibração estável) e seu cálculo de estabilidade (`S`) envolve aritmética de ponto flutuante com múltiplas exponenciais que não se expressam naturalmente em uma RPC SQL simples. Em v1, com poucos dados acumulados por usuário e prioridade de velocidade de entrega, SM-2-lite entrega 80% do benefício com 20% da complexidade. A migração é planejada para v2: os campos `srs_ease`, `srs_interval`, `srs_reps`, `srs_lapses` são compatíveis com a extensão FSRS (adicionar `srs_stability`, `srs_difficulty`, `srs_retrievability`).

---

## 2. Mapeamento de autoavaliação → quality (q)

Após re-resolver a questão e ver o gabarito, o aluno escolhe uma de quatro opções de autoavaliação. Estas mapeiam diretamente para o `quality` do SM-2:

| Autoavaliação (UI) | Enum `last_review_outcome` | quality q | Interpretação |
|---|---|---|---|
| **Errei** | `errei` | `0` | Lapso: errou na re-resolução |
| **Difícil** | `dificil` | `2` | Acertou, mas com esforço alto; ease cai levemente |
| **Bom** | `bom` | `3` | Acertou com esforço normal; ease neutro |
| **Fácil** | `facil` | `4` | Acertou sem esforço; ease sobe |

> A escala original do SM-2 vai de 0 a 5. Usamos 0/2/3/4 para eliminar as categorias ambíguas (1 = "errei mas lembrei logo depois" e 5 = "perfeito sem hesitação") que confundem usuários não familiarizados com SRS. A matemática do ease é a mesma — só os valores intermediários 1 e 5 são suprimidos.

### 2.1 Efeito exato em ease por nível de q

```
Δease = 0.1 - (4 - q) * (0.08 + (4 - q) * 0.02)

q=4 (Fácil):    Δease = 0.1 - 0*(...)          = +0.10
q=3 (Bom):      Δease = 0.1 - 1*(0.08+0.02)    = 0.00
q=2 (Difícil):  Δease = 0.1 - 2*(0.08+0.04)    = -0.14
q=0 (Errei):    Δease = não aplicado → ease -= 0.20 (regra de lapso)
```

### 2.2 Efeito em interval e reps por nível de q

| q | reps | interval (quando reps era 0→1) | interval (quando reps era 1→2) | interval (quando reps > 1) | ease |
|---|---|---|---|---|---|
| 0 (Errei) | reset 0 | MAX(1, prev×0.20) | MAX(1, prev×0.20) | MAX(1, prev×0.20) | -0.20 |
| 2 (Difícil) | +1 | 1 | 4 | ROUND(prev×ease) | -0.14 |
| 3 (Bom) | +1 | 1 | 4 | ROUND(prev×ease) | 0.00 |
| 4 (Fácil) | +1 | 1 | 4 | ROUND(prev×ease) | +0.10 |

**Nota:** para q >= 2, os intervalos de reps=0→1 (1 dia) e reps=1→2 (4 dias) são fixos, independente da avaliação. O ease só começa a diferenciar o intervalo a partir de reps >= 2. Isso é intencional: nas duas primeiras revisões bem-sucedidas, o comportamento é idêntico para todos os níveis de acerto. Apenas na terceira revisão em diante o ease personaliza o ritmo.

---

## 3. Modulação por causa do erro

A `reason` da entrada modifica parâmetros iniciais e, em alguns casos, introduz pré-condições antes do primeiro re-teste. A curva base (seção 2) permanece válida após as regras especiais abaixo.

### 3.1 Tabela de modulação

| Reason (DB) | Badge UI | Intervalo inicial (reps=0→1) | Multiplicador de ease | Regras especiais |
|---|---|---|---|---|
| `did_not_know` | Lacuna | **1 dia** (bloqueado até pré-condição) | ease inicia em **2.1** (mais baixo) | Ver 3.2 |
| `did_not_remember` | Memória | 1 dia | ease inicia em **2.5** (padrão) | Curva clássica, sem exceção |
| `reading_error` | Atenção | **0 dias** (devida hoje / amanhã cedo) | ease inicia em **2.8** (acima do padrão) | Ver 3.3 |
| `confused_alternatives` | Diferencial | 1 dia | ease inicia em **2.3** | Ver 3.4 |
| `guessed_correctly` | Chute | 1 dia | ease inicia em **2.1** (igual a Lacuna) | Ver 3.5 |
| `did_not_understand` | Entend. (legado) | 1 dia | ease inicia em **2.5** | Sem modulação especial |

#### 3.2 Lacuna (`did_not_know`) — bloqueia até aula consumida

**Premissa pedagógica:** se o aluno nunca viu o conteúdo, re-testar cedo sem estudo produz memorização fraca. A SRS deve criar urgência de estudo, não simular aprendizado.

**Regra de pré-condição:**
- Ao adicionar a entrada, `srs_due_at` é definido como `NOW() + 1 day`, mas a entrada entra no estado `blocked_lesson` (sinalizado por `last_review_outcome = 'awaiting_lesson'`) em vez de `active`.
- A RPC `schedule_next_review_guarded` rejeita chamadas enquanto `last_review_outcome = 'awaiting_lesson'` e a pré-condição não foi cumprida.
- **Pré-condição de desbloqueio:** o aluno toca o deep-link da aula correspondente (evento `caderno_lesson_accessed` registrado) OU declara explicitamente "já estudei este tema" no card. Qualquer dos dois desbloqueia.
- Após desbloqueio: intervalo inicial = 1 dia, ease = 2.1, reps = 0. A curva SM-2 começa a partir daí.

**Multiplicador de curva:** ease inicial 2.1 produz intervalos menores a cada reps bem-sucedido em comparação com Memória (2.5). Isso garante revisões mais frequentes no início para consolidar conceitos que eram lacunas.

#### 3.3 Atenção (`reading_error`) — re-teste ultrarrápido

**Premissa pedagógica:** erros de atenção não são lacunas de conteúdo; o aluno *sabe* o material. O re-teste serve para treinar o processo de leitura, não o conteúdo. Intervalos muito longos são desnecessários — mas o aluno não deve ficar preso.

**Regras:**
- Intervalo inicial após criação da entrada: **0 dias** (devida no mesmo dia ou no dia seguinte cedo, dependendo do horário — usar `srs_due_at = CURRENT_DATE + INTERVAL '1 day'` à meia-noite local, não `NOW() + 0`).
- Após primeiro acerto (reps 0→1): intervalo = 2 dias (em vez de 1), pois o aluno já provou que sabe. Ease = 2.8.
- Após segundo acerto (reps 1→2): intervalo = 6 dias (em vez de 4).
- A partir de reps >= 2: multiplicador de ease 2.8 produz escala mais rápida que Memória.
- **Mensagem UX especial** no card: "Este erro foi de atenção — releia o enunciado com calma antes de responder."

#### 3.4 Diferencial (`confused_alternatives`) — re-teste pareado

**Premissa pedagógica:** confusão entre condições similares requer exposição comparativa, não apenas re-teste isolado.

**Regras:**
- Intervalo inicial: 1 dia (padrão), ease = 2.3.
- **Sinalização no modo revisão:** quando a entrada é Diferencial, o motor instrui a UI (via campo `review_hint` no output da RPC) a exibir, junto ao enunciado, um "card comparativo" com a condição confundida (quando disponível — baseado na questão errada e na opção escolhida). Isso é uma **instrução de UI**, não cálculo SRS. O SRS em si usa curva padrão com ease 2.3.
- Se o aluno continua errando (srs_lapses >= 2 em entradas Diferencial): a mensagem de sugestão muda para indicar "estudo comparativo lado a lado" com mais ênfase.

#### 3.5 Chute (`guessed_correctly`) — tratada como Lacuna até confiança subir

**Premissa pedagógica:** acerto sem certeza indica conhecimento frágil; a SRS não deve recompensar com intervalos longos até o aluno demonstrar entendimento real.

**Regras:**
- Ease inicial: 2.1 (igual a Lacuna).
- Intervalo inicial: 1 dia.
- **Promoção automática:** quando `srs_reps >= 2 AND confidence >= 'media'` nas duas últimas revisões (`review_attempts`), o motor trata o multiplicador de ease como se fosse Memória (2.5) dali em diante. Isso é implementado como: ao calcular `schedule_next_review_guarded`, se `reason = 'guessed_correctly'` e a condição acima é satisfeita, `new_ease` é recalculado a partir de 2.5 em vez de manter a penalidade.
- Antes da promoção: a mensagem de UI exibe "Você acertou — mas teria certeza sem a dica da alternativa? Marque sua confiança com honestidade."

---

## 4. Influência da confiança

A confiança é capturada no momento da re-resolução (3 níveis: `baixa` / `media` / `alta`), armazenada em `review_attempts.confidence`.

### 4.1 Regras de influência

| Situação | Efeito |
|---|---|
| Acerto com confiança `alta` | Conta normalmente para reps e domínio |
| Acerto com confiança `media` | Conta para reps, mas **não conta para progressão de domínio** (ver seção 5) |
| Acerto com confiança `baixa` | **Não conta para reps**: o sistema trata como se fosse "Difícil" (q=2) independente da autoavaliação declarada. Intervalo avança, mas ease sofre a penalidade de Difícil. |
| Erro com qualquer confiança | Lapso normal (seção 2). Confiança não altera o cálculo de lapso. |

**Justificativa da regra de confiança baixa:** um aluno que diz "Fácil" mas marcou "baixa confiança" está se autoavaliando inconsistentemente. O sistema prioriza a confiança — que é menos sujeita ao viés de narrativa pós-hoc — sobre a avaliação de esforço. Isso é parametrizável (ver seção 5.3).

### 4.2 Dashboard de calibração (Fase 2)

Os dados de confiança em `review_attempts.confidence` acumulam e alimentam o painel de calibração (Inovação I4 do doc de visão). A SRS engine em si não precisa desse cálculo — ele é uma query agregada separada no frontend.

---

## 5. Regra de domínio (`mastered_at`)

### 5.1 Condição exata

Uma entrada é automaticamente marcada como dominada (`mastered_at = NOW()`) quando **todas** as condições abaixo são verdadeiras:

```
(A) srs_reps >= MASTERY_MIN_REPS          -- mínimo de acertos consecutivos
(B) srs_lapses_recentes = 0               -- sem lapso desde a última marcação como não-dominada
(C) último acerto com confiança >= 'media'
(D) penúltimo acerto com confiança >= 'media'
(E) srs_interval >= MASTERY_MIN_INTERVAL  -- acertos suficientemente espaçados
(F) last_review_outcome IN ('bom', 'facil') -- última autoavaliação positiva
(G) razão NOT IN ('did_not_know', 'guessed_correctly') 
    OU promoção de Chute foi atingida (ver 3.5)
```

**Parâmetros padrão (parametrizáveis):**

| Parâmetro | Valor padrão | Justificativa |
|---|---|---|
| `MASTERY_MIN_REPS` | `3` | Três acertos consecutivos garantem que o aluno passou pela curva de espaçamento pelo menos 3 vezes, com intervals de 1d, 4d e ~10d (ease 2.5) |
| `MASTERY_MIN_INTERVAL` | `21` | O terceiro acerto precisa estar a pelo menos 21 dias do segundo. Impede domínio acelerado por acertos em dias consecutivos (edge case se ease cresce rápido) |
| `MASTERY_CONFIDENCE_MIN` | `'media'` | Confiança mínima nos últimos 2 acertos. "Alta" seria ideal, mas "média" já elimina os chutes |

### 5.2 Como verificar as condições (B), (C), (D)

A verificação usa os últimos registros de `review_attempts` para a `entry_id`:

```sql
-- Verificar condições B, C, D
WITH last_two AS (
  SELECT was_correct, confidence, reviewed_at
  FROM review_attempts
  WHERE entry_id = $entry_id
  ORDER BY reviewed_at DESC
  LIMIT 2
)
SELECT
  -- (B): sem lapso desde última marcação como não-dominada
  COUNT(*) FILTER (WHERE NOT was_correct) = 0  AS no_recent_lapse,
  -- (C): último acerto confiança >= media
  (SELECT confidence FROM last_two ORDER BY reviewed_at DESC LIMIT 1)
    IN ('media', 'alta')  AS last_confidence_ok,
  -- (D): penúltimo acerto confiança >= media
  (SELECT confidence FROM last_two ORDER BY reviewed_at DESC LIMIT 1 OFFSET 1)
    IN ('media', 'alta')  AS prev_confidence_ok
FROM last_two;
```

### 5.3 Recaída de domínio

Se o aluno tem `mastered_at IS NOT NULL` e **erra em um check periódico** (lapso com `srs_lapses` incrementado), `mastered_at` é zerado (`= NULL`) e a entrada volta ao ciclo SRS como entrada ativa. O `srs_reps` é resetado para 0, mas o histórico em `review_attempts` é preservado.

O check periódico para entradas dominadas ocorre automaticamente: a RPC `schedule_next_review_guarded` continua agendando revisões mesmo para entradas dominadas, com intervalo longo (ex: `srs_interval` mantido na última valor, recalculado normalmente). O "domínio" é um estado que pode ser perdido.

### 5.4 Por que não autodeclarado

O documento de visão é explícito: "Dominar ≠ ler de novo." Um botão "Já dominei" recompensa leitura passiva. A condição automática exige re-resolução ativa espaçada no tempo — alinhada com a literatura de *active recall* (Roediger & Karpicke, 2006) e *desirable difficulties* (Bjork, 1994).

---

## 6. Tratamento de lapso e leech

### 6.1 Lapso simples

Toda vez que o aluno erra na re-resolução (q=0, autoavaliação "Errei"):

```
srs_lapses   += 1
srs_reps      = 0
srs_interval  = MAX(1, ROUND(srs_interval * 0.20))
srs_ease      = GREATEST(srs_ease - 0.20, 1.3)
mastered_at   = NULL  (se estava dominada)
last_review_outcome = 'errei'
```

O aluno precisa reconstruir os `srs_reps` consecutivos a partir do zero.

### 6.2 Leech — definição

Uma entrada vira **leech** quando `srs_lapses >= LEECH_THRESHOLD`.

| Parâmetro | Valor padrão | Justificativa |
|---|---|---|
| `LEECH_THRESHOLD` | `4` | Quatro lapsos acumulados indicam que re-testar sem intervenção é ineficaz. Valor igual ao Anki padrão, validado empiricamente |

### 6.3 Intervenção em leech

Quando `srs_lapses` atinge o threshold após um lapso:

1. **Campo `is_leech`** na entrada é setado como `true` (ou derivado como `srs_lapses >= 4` — sem coluna nova se possível, derivado na query/view).
2. **A entrada é bloqueada** para re-teste: `last_review_outcome = 'leech_blocked'`. Novas chamadas a `schedule_next_review_guarded` são rejeitadas com erro `LEECH_INTERVENTION_REQUIRED`.
3. **A UI exibe intervenção** no card:
   - Badge vermelho "Resistente" (leech).
   - Mensagem: "Você já errou esta questão 4 vezes nas revisões. É hora de estudar o tema com profundidade antes de tentar de novo."
   - CTA primário: deep-link para aula do tema (se disponível via I5).
   - CTA secundário: "Mudei minha abordagem — reativar revisão" → chama RPC `reset_leech_guarded(entry_id)`.
4. **`reset_leech_guarded`** (RPC separada ou parâmetro de `schedule_next_review_guarded`):
   - Reseta `last_review_outcome` para `null`.
   - Mantém `srs_lapses` acumulado (não zera — é histórico).
   - Define `srs_interval = 1`, `srs_ease = 1.3` (mínimo), `srs_reps = 0`.
   - A entrada volta ao ciclo com os parâmetros mais conservadores possíveis.
5. **Prof. San muda abordagem** (I8 do doc de visão): quando a entrada é leech, a edge function de análise recebe a flag `is_leech: true` e adapta o prompt para usar uma analogia diferente ou enquadramento clínico alternativo.

### 6.4 Leech suspenso vs. leech reativado

O produto não suspende leeches permanentemente (diferente do Anki). A intervenção é obrigatória, mas a reativação é sempre possível. Isso preserva o princípio de que "todo erro é matéria-prima", não lixo.

---

## 7. Contrato da RPC `schedule_next_review_guarded`

### 7.1 Assinatura

```sql
CREATE OR REPLACE FUNCTION schedule_next_review_guarded(
  p_entry_id   uuid,
  p_outcome    text,     -- 'errei' | 'dificil' | 'bom' | 'facil'
  p_confidence text      -- 'baixa' | 'media' | 'alta'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER;
```

### 7.2 Pseudocódigo completo

```
FUNCTION schedule_next_review_guarded(p_entry_id, p_outcome, p_confidence):

  -- 1. Carregar estado atual
  entry := SELECT * FROM error_notebook WHERE id = p_entry_id AND user_id = auth.uid()
  IF NOT FOUND THEN RAISE EXCEPTION 'ENTRY_NOT_FOUND'

  -- 2. Validar pré-condições
  IF entry.last_review_outcome IN ('awaiting_lesson', 'leech_blocked') THEN
    IF p_outcome != 'reset' THEN  -- 'reset' é chamado pela UI de desbloqueio
      RAISE EXCEPTION 'REVIEW_BLOCKED: ' || entry.last_review_outcome
    END IF
  END IF

  -- 3. Registrar tentativa em review_attempts
  INSERT INTO review_attempts (entry_id, user_id, confidence, self_grade, was_correct, reviewed_at)
  VALUES (p_entry_id, auth.uid(), p_confidence,
          p_outcome,
          (p_outcome != 'errei'),   -- was_correct
          NOW())

  -- 4. Mapear outcome → quality q
  q := CASE p_outcome
    WHEN 'errei'   THEN 0
    WHEN 'dificil' THEN 2
    WHEN 'bom'     THEN 3
    WHEN 'facil'   THEN 4
  END

  -- 5. Resolver ease inicial por reason (apenas quando reps = 0)
  ease_base := CASE
    WHEN entry.srs_reps = 0 THEN
      CASE entry.reason
        WHEN 'did_not_know'        THEN 2.1
        WHEN 'guessed_correctly'   THEN 2.1
        WHEN 'confused_alternatives' THEN 2.3
        WHEN 'reading_error'       THEN 2.8
        ELSE 2.5  -- did_not_remember, did_not_understand
      END
    ELSE entry.srs_ease
  END

  -- 6. Aplicar override de confiança baixa
  IF p_confidence = 'baixa' AND q > 2 THEN
    q := 2   -- trata como Difícil independente da autoavaliação
  END IF

  -- 7. Calcular novo estado
  IF q = 0 THEN  -- Lapso
    new_reps     := 0
    new_lapses   := entry.srs_lapses + 1
    new_ease     := GREATEST(ease_base - 0.20, 1.3)
    new_interval := GREATEST(1, ROUND(entry.srs_interval * 0.20))
    new_outcome  := 'errei'
  ELSE  -- Acerto
    new_reps   := entry.srs_reps + 1
    new_lapses := entry.srs_lapses  -- lapses não muda em acerto
    delta_ease := 0.1 - (4 - q) * (0.08 + (4 - q) * 0.02)
    new_ease   := GREATEST(ease_base + delta_ease, 1.3)

    -- Intervalo base por reps (modulado por reason=reading_error)
    IF entry.reason = 'reading_error' THEN
      new_interval := CASE new_reps
        WHEN 1 THEN 2    -- 2d (em vez de 1d)
        WHEN 2 THEN 6    -- 6d (em vez de 4d)
        ELSE ROUND(entry.srs_interval * new_ease)
      END
    ELSE
      new_interval := CASE new_reps
        WHEN 1 THEN 1
        WHEN 2 THEN 4
        ELSE ROUND(entry.srs_interval * new_ease)
      END
    END IF
    new_outcome := p_outcome
  END IF

  -- 8. Checar promoção de Chute (ver 3.5)
  IF entry.reason = 'guessed_correctly' AND new_reps >= 2 THEN
    last_two_confidences := SELECT confidence FROM review_attempts
                            WHERE entry_id = p_entry_id ORDER BY reviewed_at DESC LIMIT 2
    IF all(last_two_confidences IN ('media', 'alta')) THEN
      -- A partir daqui trata como Memória: ease base 2.5 nas próximas chamadas
      -- Isso é feito via: se ease atual < 2.5 E condição cumprida, seta ease = 2.5
      IF new_ease < 2.5 THEN new_ease := 2.5 END IF
    END IF
  END IF

  -- 9. Checar leech
  new_blocked := FALSE
  IF new_lapses >= LEECH_THRESHOLD THEN
    new_outcome  := 'leech_blocked'
    new_blocked  := TRUE
  END IF

  -- 10. Calcular srs_due_at
  new_due_at := NOW() + new_interval * INTERVAL '1 day'

  -- 11. Checar domínio (apenas se acerto, não bloqueado)
  new_mastered_at := entry.mastered_at
  IF q > 0 AND NOT new_blocked THEN
    mastery_check := check_mastery_conditions(p_entry_id, new_reps, entry.srs_lapses, new_interval)
    IF mastery_check.is_mastered THEN
      new_mastered_at := NOW()
    END IF
  ELSIF q = 0 THEN
    new_mastered_at := NULL   -- recaída
  END IF

  -- 12. Persistir
  UPDATE error_notebook SET
    srs_ease            = new_ease,
    srs_interval        = new_interval,
    srs_reps            = new_reps,
    srs_lapses          = new_lapses,
    srs_due_at          = new_due_at,
    last_review_outcome = new_outcome,
    mastered_at         = new_mastered_at
  WHERE id = p_entry_id

  -- 13. Retornar estado
  RETURN jsonb_build_object(
    'entry_id',            p_entry_id,
    'srs_due_at',          new_due_at,
    'srs_interval',        new_interval,
    'srs_ease',            new_ease,
    'srs_reps',            new_reps,
    'srs_lapses',          new_lapses,
    'last_review_outcome', new_outcome,
    'mastered_at',         new_mastered_at,
    'is_leech',            new_blocked,
    'review_hint',         build_review_hint(entry.reason, new_lapses)
  )
```

### 7.3 Campos lidos e escritos

| Campo | Lido | Escrito |
|---|---|---|
| `srs_ease` | Sim | Sim |
| `srs_interval` | Sim | Sim |
| `srs_reps` | Sim | Sim |
| `srs_lapses` | Sim | Sim |
| `srs_due_at` | Não (só calculado) | Sim |
| `last_review_outcome` | Sim (verificação de bloqueio) | Sim |
| `mastered_at` | Sim | Sim |
| `reason` | Sim (modulação) | Não |

### 7.4 Coexistência com "adiar" manual (override)

O snooze manual da UI ("Adiar revisão") **não chama `schedule_next_review_guarded`**. Ele chama uma RPC separada `snooze_error_notebook_entry(entry_id, days)` que:

- Atualiza apenas `srs_due_at = NOW() + days * INTERVAL '1 day'`.
- **Não altera** `srs_ease`, `srs_interval`, `srs_reps`, `srs_lapses`.
- **Não registra** em `review_attempts`.
- Setа `last_review_outcome = 'snoozed'` para rastreabilidade.

O snooze é um override de data, não uma revisão. Quando a entrada voltar a ser apresentada, os parâmetros SRS estão intactos e o próximo `schedule_next_review_guarded` continua de onde estava.

**Conflito de snooze + SRS due_at:** se o aluno adia para uma data posterior ao `srs_due_at` calculado pelo SRS, o override prevalece. Se adiar para uma data anterior ao SRS (antecipação), o override também prevalece — o aluno pode revisar antes do prazo, o que é válido. O SRS recalcula a partir do momento da revisão, não da data prevista.

---

## 8. Exemplos trabalhados

### 8.1 Entrada `did_not_remember` (Memória) — curva clássica

**Setup:** aluno erra `Qual o tratamento de 1ª linha da HAS em gestante?` por `did_not_remember`. ease inicial = 2.5.

| Rev # | Situação | Autoavaliação | Confiança | q efetivo | ease | interval | srs_due | Estado |
|---|---|---|---|---|---|---|---|---|
| 0 | Criação | — | — | — | 2.50 | 0 | +1d | Ativa |
| 1 | Errou | Errei | baixa | 0 | 2.30 | 1 | +1d | Ativa (lapso 1) |
| 2 | Acertou | Bom | média | 3 | 2.30 | 1 | +1d | Em aprendizado |
| 3 | Acertou | Bom | alta | 3 | 2.30 | 4 | +4d | Em aprendizado |
| 4 | Acertou | Fácil | alta | 4 | 2.40 | 9 | +9d | Em aprendizado |
| 5 | Acertou | Bom | alta | 3 | 2.40 | 22 | +22d | **Dominada** |

**Verificação de domínio na rev 5:** reps=3 (>=3) ✓, lapso recente=0 ✓, confiança última=alta ✓, confiança penúltima=alta ✓, interval=22 (>=21) ✓. `mastered_at` setado.

### 8.2 Entrada `did_not_know` (Lacuna) — com bloqueio inicial

**Setup:** aluno não sabia sobre "diagnóstico de SAOS". ease inicial = 2.1.

| Rev # | Situação | Autoavaliação | Confiança | q efetivo | ease | interval | srs_due | Estado |
|---|---|---|---|---|---|---|---|---|
| 0 | Criação | — | — | — | 2.10 | 0 | +1d | `awaiting_lesson` |
| — | Acessa aula | — | — | — | 2.10 | 0 | +1d | Ativa (desbloqueada) |
| 1 | Acertou | Difícil | média | 2 | 1.96 | 1 | +1d | Em aprendizado |
| 2 | Acertou | Bom | média | 3 | 1.96 | 4 | +4d | Em aprendizado |
| 3 | Errou | Errei | baixa | 0 | 1.76 | 1 | +1d | Ativa (lapso 1) |
| 4 | Acertou | Bom | média | 3 | 1.76 | 1 | +1d | Em aprendizado |
| 5 | Acertou | Bom | alta | 3 | 1.76 | 4 | +4d | Em aprendizado |
| 6 | Acertou | Bom | alta | 3 | 1.76 | 7 | +7d | Em aprendizado |
| 7 | Acertou | Bom | alta | 3 | 1.76 | 12 | +12d | Em aprendizado |
| 8 | Acertou | Bom | alta | 3 | 1.76 | 21 | +21d | **Dominada** |

**Obs:** com ease 1.76 (baixa), o interval cresce lentamente: ROUND(4×1.76)=7, ROUND(7×1.76)=12, ROUND(12×1.76)=21. Condição de domínio atingida na rev 8: reps=3 ✓ (contador consecutivo reiniciou no lapso da rev 3, contando rev 6/7/8), sem lapso recente ✓, confiança OK (últimas 2 = alta) ✓, interval=21 (>=21) ✓, last_review_outcome='bom' ✓. Domínio marcado na rev 8 — mais revisões que Memória, refletindo a maior dificuldade do conceito.

### 8.3 Entrada `reading_error` (Atenção) — re-teste rápido

**Setup:** aluno marcou alternativa errada por não ler "EXCETO". ease inicial = 2.8.

| Rev # | Situação | Autoavaliação | Confiança | q efetivo | ease | interval | srs_due | Estado |
|---|---|---|---|---|---|---|---|---|
| 0 | Criação | — | — | — | 2.80 | 0 | hoje (amanhã cedo) | Ativa |
| 1 | Acertou | Bom | alta | 3 | 2.80 | 2 | +2d | Em aprendizado |
| 2 | Acertou | Fácil | alta | 4 | 2.90 | 6 | +6d | Em aprendizado |
| 3 | Acertou | Bom | alta | 3 | 2.90 | 17 | +17d | Em aprendizado |
| 4 | Acertou | Bom | alta | 3 | 2.90 | 49 | +49d | **Dominada** |

**Obs:** Atenção tem curva mais rápida (ease 2.8+), mas o limiar de intervalo mínimo de 21 dias exige mais de 3 revisões: ROUND(6×2.90)=17 (rev 3, ainda < 21), ROUND(17×2.90)=49 (rev 4, >= 21) ✓. Condição de domínio na rev 4: reps=4 (>=3) ✓, sem lapso ✓, confiança últimas 2 = alta ✓, interval=49 (>=21) ✓, last_review_outcome='bom' ✓. Alinhado com a premissa de que o conteúdo já é conhecido — o aluno "paga" pouco tempo total nessa entrada.

### 8.4 Entrada `guessed_correctly` (Chute) → promoção

**Setup:** aluno acertou por chute. ease inicial = 2.1.

| Rev # | Situação | Autoavaliação | Confiança | q efetivo | ease | interval | srs_due | Estado |
|---|---|---|---|---|---|---|---|---|
| 0 | Criação | — | — | — | 2.10 | 0 | +1d | Ativa |
| 1 | Acertou | Difícil | baixa | 2 (override) | 1.96 | 1 | +1d | Em aprendizado |
| 2 | Acertou | Bom | média | 3 | 1.96 | 4 | +4d | Em aprendizado → **promovida** (2 reps, conf >= média) |
| 3 | Acertou | Bom | média | 3 | 2.50 (boost) | 10 | +10d | Em aprendizado (agora como Memória) |
| 4 | Acertou | Bom | alta | 3 | 2.50 | 25 | +25d | **Dominada** |

**Obs:** na rev 2, a promoção é detectada (reps=2, últimas 2 conf >= média). Na rev 3, ease é elevado para 2.5 antes do delta ser aplicado. O interval salta de 4 para ROUND(4 * 2.5) = 10 — visível melhora de ritmo.

---

## 9. Casos de borda

### 9.1 Primeira revisão (srs_reps = 0, nunca revisado)

- `srs_interval` começa em 0. O cálculo de `new_interval` para q > 0 retorna 1 (caso `reps=0→1`). Para q=0 (lapso na primeira revisão): `MAX(1, ROUND(0 * 0.20)) = MAX(1, 0) = 1`. Resultado: entry continua com interval=1, penalidade de lapso aplicada normalmente.

### 9.2 Entrada criada mas nunca revisada

- `srs_due_at` é calculado na criação (`NOW() + 1 day` para a maioria; `CURRENT_DATE + 1 day 00:00 local` para `reading_error`).
- Se o aluno nunca abre o caderno, a entry acumula "atraso" — `srs_due_at` fica no passado.
- A query de "devidas hoje" usa `srs_due_at <= fim_do_dia_local`. Entradas atrasadas entram nessa query normalmente e serão apresentadas na próxima sessão.
- Não há penalidade automática por atraso (o SM-2 puro também não penaliza). O aluno simplesmente recomeça do estado em que estava.

### 9.3 Snooze manual vs. SRS due_at

- O snooze sobrescreve `srs_due_at` sem tocar parâmetros SRS.
- Se o aluno adia para uma data posterior ao `srs_due_at` SRS calculado: a entry simplesmente fica fora da fila até a nova data.
- O "custo" do snooze excessivo é pedagógico (mais esquecimento), não sistêmico.
- A UI pode exibir um aviso se `snooze_date > srs_due_at + 7` ("Adiar muito pode prejudicar a memorização").

### 9.4 Definição de "devida hoje" e fuso horário

```sql
-- "Devida hoje" para o usuário
srs_due_at <= (CURRENT_DATE + INTERVAL '1 day')::timestamptz AT TIME ZONE 'America/Sao_Paulo'
```

- Fuso padrão: `America/Sao_Paulo` (UTC-3).
- A definição é: `srs_due_at <= fim do dia atual no fuso do usuário` = `CURRENT_DATE + 1 day` à meia-noite local.
- Isso garante que uma entry agendada para "hoje às 23:59" apareça hoje, não só amanhã.
- O fuso do usuário pode ser armazenado em `profiles.timezone` (campo a adicionar se não existir) com fallback para `America/Sao_Paulo`.

### 9.5 Múltiplas revisões no mesmo dia

O sistema permite múltiplas chamadas a `schedule_next_review_guarded` para a mesma entry no mesmo dia (ex: usuário revisa, avança o intervalo, e o mesmo card reaparece por erro de UI). Cada chamada cria um registro em `review_attempts` e atualiza `srs_due_at`. Não há travas de idempotência no nível da RPC — a UI deve evitar chamar duas vezes apresentando a entry já avaliada (usando `last_review_outcome IS NOT NULL AND reviewed_at::date = CURRENT_DATE` para filtrar).

### 9.6 Entry com `reason = 'did_not_understand'` (legado)

- Tratada como `did_not_remember` em todos os cálculos (ease inicial 2.5, sem pré-condição).
- Backward compat: entradas existentes no banco com esse reason continuam funcionando sem migração de dado.

---

## Apêndice — Parâmetros configuráveis

Todos os parâmetros numéricos abaixo devem ser extraídos para uma tabela de configuração `srs_config` ou constantes PL/pgSQL nomeadas, para facilitar ajuste sem re-deploy:

| Parâmetro | Valor padrão | Descrição |
|---|---|---|
| `EASE_DEFAULT` | `2.5` | Ease inicial para Memória e legado |
| `EASE_LACUNA` | `2.1` | Ease inicial para Lacuna e Chute |
| `EASE_DIFERENCIAL` | `2.3` | Ease inicial para Diferencial |
| `EASE_ATENCAO` | `2.8` | Ease inicial para Atenção |
| `EASE_MIN` | `1.3` | Floor do ease (nunca desce abaixo) |
| `LAPSE_INTERVAL_FACTOR` | `0.20` | Fração do intervalo mantida após lapso |
| `LAPSE_EASE_PENALTY` | `0.20` | Penalidade de ease por lapso |
| `INTERVAL_REPS_1` | `1` | Intervalo fixo para reps=1 (padrão) |
| `INTERVAL_REPS_2` | `4` | Intervalo fixo para reps=2 (padrão) |
| `INTERVAL_ATENCAO_REPS_1` | `2` | Intervalo reps=1 para Atenção |
| `INTERVAL_ATENCAO_REPS_2` | `6` | Intervalo reps=2 para Atenção |
| `LEECH_THRESHOLD` | `4` | Nº de lapsos para virar leech |
| `MASTERY_MIN_REPS` | `3` | Mínimo de reps consecutivos para domínio |
| `MASTERY_MIN_INTERVAL` | `21` | Intervalo mínimo (dias) no momento do domínio |
| `MASTERY_CONFIDENCE_MIN` | `'media'` | Confiança mínima nos 2 últimos acertos |
| `CHUTE_PROMOTION_REPS` | `2` | Reps para promover Chute a Memória |

---

## Premissas que outras specs devem honrar

1. **Nomes de campos em `error_notebook`:** `srs_ease` (float), `srs_interval` (int, dias), `srs_reps` (int), `srs_lapses` (int), `srs_due_at` (timestamptz), `mastered_at` (timestamptz nullable), `last_review_outcome` (text: `errei|dificil|bom|facil|snoozed|awaiting_lesson|leech_blocked`), `reason` (DbReason).

2. **Nomes de campos em `review_attempts`:** `entry_id` (uuid fk), `user_id` (uuid), `selected_option_id` (uuid nullable), `was_correct` (bool), `confidence` (text: `baixa|media|alta`), `self_grade` (text: `errei|dificil|bom|facil`), `reviewed_at` (timestamptz).

3. **RPCs usadas por este spec:** `schedule_next_review_guarded(entry_id, outcome, confidence)` → jsonb; `snooze_error_notebook_entry(entry_id, days)` → timestamptz; `reset_leech_guarded(entry_id)` → void.

4. **Eventos de analytics esperados:** `caderno_recall_self_graded` (params: entry_id, reason, outcome, confidence, new_interval, is_leech), `caderno_entry_mastered` (params: entry_id, reason, total_reps, days_since_creation, `{ via_srs: true }`), `caderno_entry_leech_triggered` (params: entry_id, reason, total_lapses), `caderno_lesson_accessed` (params: entry_id, lesson_url) — o último é upstream em `useExamFlow` / catálogo de aulas.

5. **Spec 01** deve declarar todas as colunas acima em `error_notebook` e criar a tabela `review_attempts` com os campos listados.

6. **UI (Spec 03 em diante)** deve garantir que o modo revisão capture `confidence` e `self_grade` antes de chamar `schedule_next_review_guarded`. Não é válido chamar a RPC sem os dois parâmetros.

7. **"Devida hoje"** = `srs_due_at <= fim do dia local (America/Sao_Paulo)`. Specs de UI e query devem usar esta definição, não `srs_due_at <= NOW()`.

8. **Campo `is_leech`** é derivado (`srs_lapses >= LEECH_THRESHOLD`), não uma coluna física — a menos que performance exija índice, nesse caso adicionar como coluna gerada.
