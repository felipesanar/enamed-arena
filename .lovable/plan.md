## Objetivo

No `AdminUploadQuestions`, tornar cada linha do preview clicável e abrir um modal que reproduz o visual do modo prova, mostrando todos os campos da questão (incluindo imagem) + metadados administrativos.

## Mudanças

### 1. Novo componente `src/admin/components/QuestionPreviewModal.tsx`
- Recebe: `row: ParsedRow`, `enunciadoImage?: ExtractedImage`, `comentarioImage?: ExtractedImage`, `open`, `onOpenChange`.
- Usa `Dialog` (shadcn) com `max-w-4xl`, scroll interno.
- Layout em duas seções:
  - **Cabeçalho admin** (compacto, com badges): Nº, Grande Área, Especialidade, Tema, Gabarito.
  - **Preview "modo prova"**: reusa a estética do `QuestionDisplay` (mesmas classes/tokens — `text-[hsl(var(--exam-text))]`, alternativas com borda arredondada, label A/B/C/D). Renderizado em modo somente-leitura: alternativa correta destacada em verde (`success`), demais neutras, sem botões eliminar/selecionar.
  - **Imagem do enunciado** (se houver): renderiza via `URL.createObjectURL(image.blob)`.
  - **Comentário/Explicação** (collapsable ou sempre visível) com imagem do comentário se houver.
- Object URLs criados em `useEffect` e revogados no cleanup.

### 2. `src/admin/pages/AdminUploadQuestions.tsx`
- Estado `previewIndex: number | null`.
- `<TableRow>` recebe `onClick={() => setPreviewIndex(i)}` + `className="cursor-pointer hover:bg-muted/40"`.
- Renderiza `<QuestionPreviewModal>` controlado por `previewIndex`.

## Notas técnicas
- Não alterar a lógica de parsing/upload nem `QuestionDisplay` original.
- Componente é admin-only, pode duplicar a marcação de alternativas (mais simples que generalizar `QuestionDisplay` com modo readonly).
- Tipos das imagens: já existem em `xlsxImageExtractor.ts` (`ExtractedImage` com `blob`).
