

## Plan: Adaptar upload de questões para novo formato de planilha

### Mapeamento de colunas

| Coluna da planilha | Campo no banco | Notas |
|---|---|---|
| numero | question_number | |
| Grande Área | area | |
| Especialidade | theme | Mapeado para `theme` (sub-área) |
| Tema | (concatenado) | `theme` = "Especialidade > Tema" |
| Enunciado | text | |
| Imagem do Enunciado | image_url | URL da imagem |
| Alternativa A | option A | |
| Alternativa B | option B | |
| Alternativa C | option C | |
| Alternativa D | option D | |
| Gabarito | is_correct | A, B, C ou D |
| Comentário | explanation | |
| Imagem do Comentário | — | Sem coluna no banco; ignorado por ora |

Diferenças-chave vs formato anterior:
- **4 alternativas** (A-D) em vez de 5 (A-E)
- Nomes de colunas com espaços e acentos
- `theme` será composto: "Especialidade > Tema" (preserva ambas informações)
- Sem coluna `dificuldade` → default "medium"

### Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `src/admin/pages/AdminUploadQuestions.tsx` | Nova interface `ParsedQuestion` com nomes de coluna reais da planilha; atualizar preview table; mapear para payload do backend |
| `supabase/functions/admin-upload-questions/index.ts` | Adaptar labelMap para 4 alternativas; mapear novos nomes de campo; compor theme = "Especialidade > Tema" |

### Detalhes técnicos

**Frontend (`AdminUploadQuestions.tsx`)**:
- `ParsedQuestion` terá campos: `numero`, `"Grande Área"`, `Especialidade`, `Tema`, `Enunciado`, `"Imagem do Enunciado"`, `"Alternativa A"` a `D`, `Gabarito`, `Comentário`, `"Imagem do Comentário"`
- XLSX com headers contendo espaços/acentos produz chaves com esses nomes — acessar via `q["Grande Área"]`
- Preview mostrará: #, Enunciado, Grande Área, Especialidade, Gabarito
- Payload enviado ao backend já normalizado (snake_case)

**Edge Function (`admin-upload-questions`)**:
- `labelMap` reduzido para A-D
- Campo `area` = Grande Área, `theme` = "Especialidade > Tema", `text` = Enunciado, `explanation` = Comentário, `image_url` = Imagem do Enunciado
- `difficulty` = "medium" (fixo)

