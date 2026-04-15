

# Fix: Eliminar páginas em branco entre questões

## Problema

Cada questão é renderizada em seu próprio `<Page>` (linha 344). Quando um comentário longo quebra para a próxima página, o restante dessa página fica vazio — a próxima questão começa em uma **nova** `<Page>`, desperdiçando espaço. Para quem imprime, isso gera folhas quase vazias.

## Solução

Colocar **todas as questões em uma única `<Page>`** e deixar o `@react-pdf/renderer` gerenciar as quebras de página automaticamente. Questões fluirão uma após a outra, preenchendo o espaço disponível.

## Mudança

**Arquivo:** `src/lib/pdf/ProvaRevisadaDocument.tsx`

### Estrutura atual (simplificada):
```tsx
{questions.map(q => (
  <Page key={q.id} size="A4" style={s.page}>
    <QuestionBlock ... />
    <PageFooter />
  </Page>
))}
```

### Estrutura nova:
```tsx
<Page size="A4" style={s.page}>
  {questions.map((q, i) => (
    <View key={q.id} style={{ marginBottom: 20 }}>
      <QuestionBlock ... />
      {/* Separador visual entre questões */}
      {i < questions.length - 1 && (
        <View style={{ borderBottom: 0.5, borderColor: '#e5e7eb', marginTop: 16 }} />
      )}
    </View>
  ))}
  <PageFooter />
</Page>
```

- O `<PageFooter fixed>` aparece em todas as páginas automaticamente (prop `fixed` já existe)
- `wrap={false}` nos headers e options mantém esses elementos atômicos
- O `explBox` continua sem `wrap={false}`, permitindo quebra natural
- Separador visual (linha fina) entre questões para clareza

Resultado: comentários longos quebram normalmente, e a próxima questão começa logo abaixo — sem páginas em branco desperdiçadas.

