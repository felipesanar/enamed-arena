

# Plano: Imagens no PDF, Interação Online e Remoção da Folha de Respostas

## Problemas Identificados

### 1. PDF sem imagens
A Edge Function `generate-exam-pdf` **intencionalmente omite imagens** (linha 2: "No image embedding — too CPU-heavy"). O campo `image_url` é buscado do banco mas nunca usado na renderação. As imagens precisam ser embarcadas no PDF, mas com cuidado para não estourar o limite de CPU (Error 546).

### 2. Modo online — cliques não funcionam e timer zerado
Duas causas combinadas:
- **`drag="x"` no Framer Motion** (linha 370 de `SimuladoExamPage.tsx`): O wrapper da questão tem `drag="x"` para swipe entre questões. Framer Motion intercepta o `pointerdown` para detectar drag, o que pode engolir cliques em botões filhos (alternativas), especialmente em dispositivos touch ou quando o threshold é baixo.
- **Timer em 00:00:00**: Se `effectiveDeadline` já passou (ex: janela de execução encerrada), o timer inicia em 0. Com timer=0, `handleTimeUp` chama `finalize()` após 2s, mas se a finalização falhar, o usuário fica preso numa tela sem interação porque `updateState` retorna early quando `status !== 'in_progress'`.

### 3. Última página (Folha de Respostas) deve ser removida
O bloco de código nas linhas 253-262 gera uma página "FOLHA DE RESPOSTAS" com bubbles A/B/C/D. O usuário quer removê-la do PDF.

---

## Plano de Implementação

### Etapa 1 — Corrigir interação no modo online

**Arquivo:** `src/pages/SimuladoExamPage.tsx`

- **Remover `drag="x"`** do `motion.div` que envolve `QuestionDisplay` (linhas 370-372). O swipe horizontal é raramente usado e causa conflito com cliques nas alternativas. Os botões "Anterior"/"Próxima" e o navigator mobile já cobrem a navegação.
- Remover também `dragConstraints`, `dragElastic` e `onDragEnd`.

**Arquivo:** `src/hooks/useExamFlow.ts`

- Adicionar guard no `initializeState`: se a `windowDeadline` já passou, não permitir iniciar o attempt (redirecionar para a página do simulado). Isso evita que o timer inicie em 0.

### Etapa 2 — Embarcar imagens no PDF

**Arquivo:** `supabase/functions/generate-exam-pdf/index.ts`

- Após buscar as questões, filtrar as que têm `image_url` não-nulo.
- Fazer `fetch` das imagens em paralelo (com timeout de 5s cada e fallback para omitir se falhar).
- Usar `pdfDoc.embedJpg()` ou `pdfDoc.embedPng()` conforme o tipo da imagem.
- Inserir a imagem entre o enunciado e as alternativas, com largura máxima proporcional à coluna (~240pt) e altura proporcional.
- Atualizar `measureQuestion()` para incluir a altura da imagem no cálculo de layout.
- Atualizar `renderColumn()` para desenhar a imagem na posição correta.
- Atualizar o tipo `Question` para incluir `imageUrl?: Uint8Array` e dimensões.

Otimizações para evitar Error 546:
- Limitar a 20 imagens máximas (ignorar excedentes).
- Timeout de 5s por fetch de imagem.
- Se a imagem for muito grande (>500KB), redimensionar via canvas ou omitir.

### Etapa 3 — Remover Folha de Respostas do PDF

**Arquivo:** `supabase/functions/generate-exam-pdf/index.ts`

- Remover o bloco inteiro de "Answer sheet" (linhas 253-262) e a função `renderAnswerCol` (linhas 293-309).
- O PDF terminará após a última página de questões.

### Etapa 4 — Re-deploy da Edge Function

- Executar deploy da função `generate-exam-pdf`.
- Invalidar cache existente (migration `UPDATE simulados SET updated_at = now()`).

---

## Arquivos Modificados

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/SimuladoExamPage.tsx` | Remove `drag="x"` do wrapper de questão |
| `src/hooks/useExamFlow.ts` | Guard contra deadline já expirada |
| `supabase/functions/generate-exam-pdf/index.ts` | Embarca imagens, remove folha de respostas |
| Migration SQL | `UPDATE simulados SET updated_at = now()` para invalidar cache |

