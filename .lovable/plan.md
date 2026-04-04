

# Plano: Layout de Imagens, Espaçamento de Alternativas e Feedback de Progresso

## Problemas Identificados

1. **Imagem do enunciado sem padding/centering consistente** — A imagem usa `inline-block` sem largura máxima responsiva e sem centralização, podendo ficar desalinhada em telas pequenas.

2. **Imagem do comentário (`explanationImageUrl`) nunca exibida** — O campo existe no tipo e no banco mas nenhum componente o renderiza. Nem no `QuestionDisplay` (prova), nem no `CorrecaoPage` (correção).

3. **Espaçamento entre alternativas inconsistente** — O `space-y-3` (12px) no `QuestionDisplay` e `CorrecaoPage` é fixo, mas a variação visual vem de: (a) `border-2` na selecionada vs `border` nas demais cria 1px de diferença, (b) `p-4` é o mesmo em todas mas o conteúdo de texto varia muito, dando impressão de espaço irregular.

4. **Sem feedback de progresso no upload de questões (admin)** — O botão muda para "Enviando..." mas não há barra de progresso nem indicação de etapas (parsing, upload de imagens, inserção).

5. **Sem feedback de progresso na geração do PDF (usuário)** — O botão muda para "Gerando PDF…" mas em payloads grandes isso leva vários segundos sem nenhuma indicação visual.

6. **Imagem do enunciado não exibida na CorrecaoPage** — A correção mostra texto e alternativas mas ignora `question.imageUrl`.

## Plano de Implementação

### Step 1 — Melhorar layout de imagem no QuestionDisplay
- **Arquivo:** `src/components/exam/QuestionDisplay.tsx`
- Centralizar a imagem com `mx-auto` e `max-w-full w-fit`
- Adicionar `p-2` interno e `shadow-sm` para destaque visual
- Garantir `max-h-[320px]` com aspect-ratio preservado
- Padronizar `border` com tokens do design system

### Step 2 — Padronizar espaçamento das alternativas
- **Arquivo:** `src/components/exam/QuestionDisplay.tsx`
- Mudar de `border-2` (selecionada) + `border` (demais) para `border-2` em todas, usando `border-transparent` como default — elimina o shift de 1px
- Usar `space-y-2.5` (10px) para gaps consistentes
- **Arquivo:** `src/pages/CorrecaoPage.tsx`
- Mesmo ajuste: `space-y-2.5` e `border-2` uniforme em todas as opções

### Step 3 — Exibir imagem do enunciado na CorrecaoPage
- **Arquivo:** `src/pages/CorrecaoPage.tsx`
- Após o texto do enunciado (linha 186), renderizar `question.imageUrl` com lightbox (reutilizar padrão do QuestionDisplay ou extrair componente `QuestionImage`)

### Step 4 — Exibir imagem do comentário na CorrecaoPage
- **Arquivo:** `src/pages/CorrecaoPage.tsx`
- Dentro do bloco de explicação (linha 212-219), após o texto, renderizar `question.explanationImageUrl` com lightbox

### Step 5 — Feedback de progresso no upload de questões (admin)
- **Arquivo:** `src/admin/pages/AdminUploadQuestions.tsx`
- Adicionar state `uploadProgress: { step: string; percent: number }`
- Exibir `Progress` bar (de `@/components/ui/progress`) durante upload com etapas:
  - "Preparando imagens..." (0-20%)
  - "Enviando questões..." (20-80%)
  - "Finalizando..." (80-100%)
- Usar componente `Progress` existente com label de etapa acima

### Step 6 — Feedback de progresso na geração do PDF (usuário)
- **Arquivo:** `src/pages/SimuladosPage.tsx` (no `HeroCardActive`)
- Substituir o texto "Gerando PDF…" por uma UI de progresso com:
  - Spinner animado + texto de etapa ("Criando prova offline...", "Gerando PDF...", "Preparando download...")
  - Usar `Progress` bar indeterminada (animação de loading) já que não temos progresso real do Edge Function
  - Desabilitar o botão e mostrar o progresso inline no card do modal

### Step 7 — Extrair componente reutilizável `QuestionImage`
- **Arquivo:** `src/components/exam/QuestionImage.tsx` (novo)
- Componente que recebe `src`, `alt`, e renderiza imagem com lightbox, zoom, e estilos consistentes
- Usado em `QuestionDisplay`, `CorrecaoPage` (enunciado e comentário)

## Arquivos Modificados/Criados

| Arquivo | Mudança |
|---------|---------|
| `src/components/exam/QuestionImage.tsx` | Novo — componente reutilizável de imagem com lightbox |
| `src/components/exam/QuestionDisplay.tsx` | Usa `QuestionImage`, padroniza border das alternativas |
| `src/pages/CorrecaoPage.tsx` | Exibe imagem do enunciado e comentário, padroniza espaçamento |
| `src/admin/pages/AdminUploadQuestions.tsx` | Barra de progresso com etapas no upload |
| `src/pages/SimuladosPage.tsx` | Feedback visual de progresso na geração do PDF |

