

# Plano: Extração de Imagens Embutidas da Planilha → Supabase Storage

## Contexto

As imagens das questões estão inseridas diretamente nas células da planilha XLSX (não são URLs). O SheetJS (`xlsx`) **não suporta extração de imagens embutidas** — ele só lê dados textuais. Para extrair imagens de dentro do arquivo `.xlsx`, precisamos tratar o arquivo como um ZIP e ler os binários de imagem diretamente do diretório `xl/media/` interno, mapeando cada imagem à célula correspondente via `xl/drawings/` e `xl/worksheets/_rels/`.

## Problema Técnico

Um arquivo `.xlsx` é um ZIP contendo:
```text
xl/media/image1.png
xl/media/image2.png
xl/drawings/drawing1.xml       ← mapeia imagem → âncora (célula)
xl/worksheets/_rels/sheet1.xml.rels  ← liga drawing ao sheet
```

A biblioteca `xlsx` ignora completamente esses arquivos de mídia. Precisamos usar `JSZip` no cliente para:
1. Abrir o `.xlsx` como ZIP
2. Extrair os binários de `xl/media/`
3. Parsear os XMLs de drawing para mapear imagem → linha/coluna
4. Enviar as imagens como base64 junto com as questões para a Edge Function

## Arquitetura

```text
Cliente (AdminUploadQuestions)
  ├─ Lê XLSX com SheetJS (texto)
  ├─ Lê XLSX com JSZip (imagens)
  ├─ Mapeia imagens → questões via drawing XML
  └─ Envia { questions[], images[] } para Edge Function

Edge Function (admin-upload-questions)
  ├─ Recebe questões + imagens base64
  ├─ Faz upload de cada imagem para Storage (question-images bucket)
  ├─ Gera URL pública
  └─ Salva image_url na tabela questions
```

## Plano de Implementação

### Step 1 — Criar bucket `question-images` (Storage)
- Migration SQL para criar bucket público `question-images`
- RLS: leitura pública (para exibição), escrita apenas via service role

### Step 2 — Instalar `jszip` e extrair imagens no cliente
- `npm install jszip`
- No `AdminUploadQuestions.tsx`, após ler o XLSX:
  - Abrir o mesmo ArrayBuffer com JSZip
  - Listar arquivos em `xl/media/`
  - Parsear `xl/drawings/drawing1.xml` para obter o mapeamento `<xdr:twoCellAnchor>` → row/col → nome da imagem
  - Parsear `xl/worksheets/_rels/sheet1.xml.rels` para resolver `rId` → nome do arquivo em `xl/media/`
  - Resultado: `Map<numero_questao, { base64: string, mimeType: string }>`
- Também extrair imagens da coluna "Imagem do Comentário" (mesma lógica, coluna diferente)

### Step 3 — Enviar imagens base64 para a Edge Function
- Alterar o payload do `handleUpload` para incluir `images: { [numero]: { data: string, mime: string } }` para enunciado e comentário
- Considerar limite de payload: se muitas imagens grandes, enviar em batches ou usar upload direto ao Storage via signed upload URL

### Step 4 — Edge Function: receber e salvar imagens no Storage
- No `admin-upload-questions/index.ts`:
  - Para cada questão com imagem, fazer upload para `question-images/{simulado_id}/{question_number}.png`
  - Obter a URL pública do Storage
  - Salvar `image_url` e `explanation_image_url` (novo campo) na tabela `questions`

### Step 5 — Adicionar coluna `explanation_image_url` na tabela `questions`
- Migration: `ALTER TABLE questions ADD COLUMN explanation_image_url text;`
- Para armazenar a "Imagem do Comentário"

### Step 6 — Exibir imagens no modo online
- `QuestionDisplay.tsx` já renderiza `question.imageUrl` com lightbox — funciona automaticamente se a URL estiver correta no Storage
- Adicionar exibição de `explanationImageUrl` na tela de correção/resultado

### Step 7 — Exibir imagens no PDF offline
- No `generate-exam-pdf/index.ts`:
  - Para cada questão com `image_url`, fazer fetch da imagem e embuti-la no PDF com `pdfDoc.embedPng()` / `embedJpg()`
  - Posicionar abaixo do texto do enunciado, ajustando o layout

### Step 8 — Preview de imagens no admin
- Na tabela de preview do `AdminUploadQuestions`, mostrar thumbnail das imagens extraídas para confirmar mapeamento correto

## Arquivos Modificados/Criados

| Arquivo | Mudança |
|---------|---------|
| `src/admin/pages/AdminUploadQuestions.tsx` | Extração de imagens via JSZip + envio base64 |
| `supabase/functions/admin-upload-questions/index.ts` | Upload de imagens ao Storage + salvar URLs |
| `supabase/functions/generate-exam-pdf/index.ts` | Embutir imagens no PDF |
| `src/types/index.ts` | Adicionar `explanationImageUrl` ao tipo Question |
| `src/services/simuladosApi.ts` | Mapear `explanation_image_url` |
| Migration | Bucket `question-images` + coluna `explanation_image_url` |

## Riscos e Mitigações

- **Payload grande**: imagens base64 podem exceder limites. Mitigação: comprimir no cliente ou usar upload direto ao Storage com signed URLs (preferível para produção)
- **Mapeamento de imagens incorreto**: os XMLs de drawing do Excel variam entre versões. Mitigação: fallback — se o mapeamento falhar, logar e continuar sem imagem
- **Tempo de processamento do PDF**: embutir muitas imagens aumenta o tempo. Mitigação: redimensionar imagens antes de embutir

