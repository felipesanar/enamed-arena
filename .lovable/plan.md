

## Diagnóstico

Analisando o screenshot e o código atual, identifico dois problemas:

### 1. Sidebar desaparecendo durante navegação (problema principal)
O `AnimatePresence mode="wait"` no `DashboardOutlet` faz o componente antigo **sair completamente** antes do novo entrar. Se o novo componente é lazy e ainda não carregou, ocorre um flash onde o conteúdo some, mostra o skeleton, e depois aparece. Isso causa a sensação de "recarregamento do zero".

### 2. Layout visual da SimuladoDetailPage parece estar sem sidebar
No screenshot, o conteúdo "Simulado Teste" começa na borda esquerda sem padding da sidebar, sugerindo que o DashboardLayout pode não estar mantendo a sidebar durante transições.

## Plano

### 1. Corrigir AnimatePresence no DashboardOutlet
Trocar `mode="wait"` por `mode="popLayout"` ou remover o mode completamente. Com `wait`, o React desmonta o outlet antigo antes de montar o novo — se o novo é lazy, Suspense mostra skeleton e causa flash. Sem `wait`, a transição é mais suave.

Alternativa mais robusta: remover AnimatePresence do outlet e usar apenas o Suspense com skeleton. A animação de entrada fica dentro de cada página via o componente `PageTransition` que já criamos.

### 2. Mover animação de entrada para dentro das páginas
Em vez de animar o outlet inteiro (que inclui Suspense), aplicar o `PageTransition` wrapper diretamente nas páginas principais:
- `SimuladoDetailPage`
- `SimuladosPage`
- `HomePagePremium`
- `DesempenhoPage`, `RankingPage`, `ComparativoPage`, `CadernoErrosPage`, `ConfiguracoesPage`

Isso garante que a animação só dispara DEPOIS do chunk carregar, eliminando flash.

### 3. Simplificar DashboardOutlet
```text
Antes:
  AnimatePresence (wait) → motion.div (key=path) → Suspense → outlet
  → Flash branco entre rotas

Depois:
  Suspense (fallback=skeleton) → outlet
  → Sidebar sempre visível
  → Cada página anima seus próprios elementos na entrada
```

### Arquivos envolvidos
- `src/components/premium/DashboardOutlet.tsx` — simplificar para Suspense puro
- ~8 páginas — adicionar `PageTransition` wrapper no return principal
- `src/components/premium/PageLoadingSkeleton.tsx` — já existe, sem mudanças

### Resultado esperado
- Sidebar permanece 100% visível durante qualquer navegação
- Zero flash branco entre páginas
- Cada página entra com animação suave (fade + slide up) após seu chunk carregar
- Skeleton shimmer aparece apenas na área de conteúdo se o chunk demorar

