

## Diagnóstico

O problema é causado pelo `<Suspense fallback={<PageShell />}>` que envolve **todas as rotas** no `App.tsx` (linha 80). Quando você navega entre páginas lazy dentro do dashboard, o React suspende a árvore inteira — incluindo o `DashboardLayout` com a sidebar — e mostra o fallback (uma div vazia). Isso causa o flash branco e o sumiço da sidebar.

O `manualChunks` já foi removido em etapa anterior, então o único problema restante é o posicionamento do Suspense.

## Plano

### 1. Mover Suspense para dentro do DashboardOutlet
Em vez de um Suspense global, colocar o boundary de suspense **dentro** do `DashboardOutlet`, para que quando uma página lazy carrega, apenas o conteúdo principal suspende — a sidebar e o layout permanecem visíveis.

O fallback será um skeleton animado (shimmer) que ocupa o espaço do conteúdo, evitando o flash branco.

### 2. Criar Suspense boundaries por grupo de rotas no App.tsx
- Rotas públicas: envolver com Suspense próprio com fallback adequado
- Rotas admin: envolver com Suspense próprio
- Rotas protegidas (dashboard): o Suspense fica dentro do DashboardOutlet (passo 1)
- Remover o Suspense global que envolve tudo

### 3. Criar componente PageLoadingSkeleton
Um skeleton bonito com shimmer para servir de fallback enquanto o chunk da página carrega. Será usado dentro do DashboardOutlet.

### 4. Adicionar animações de entrada nas páginas
Cada página do dashboard já passa pelo `DashboardOutlet` com fade via Framer Motion. Vou melhorar essa animação para incluir um leve translateY + fade, e garantir que funcione corretamente com o Suspense.

Adicionalmente, criar um wrapper `PageTransition` reutilizável que as páginas podem usar internamente para animar seus elementos com stagger (cards, seções aparecendo sequencialmente).

### Arquivos envolvidos
- `src/App.tsx` — reestruturar Suspense boundaries
- `src/components/premium/DashboardOutlet.tsx` — adicionar Suspense interno com skeleton
- `src/components/premium/PageLoadingSkeleton.tsx` — novo componente de loading
- `src/components/premium/PageTransition.tsx` — novo wrapper de animação reutilizável

### Resultado esperado
- Sidebar permanece visível durante navegação entre páginas
- Conteúdo mostra skeleton animado enquanto o chunk carrega (apenas na primeira visita)
- Páginas entram com animação suave (fade + slide up)
- Zero flash branco

