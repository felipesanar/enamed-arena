# Performance Audit — SanarFlix PRO: ENAMED

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduzir o bundle inicial de 2MB para <500KB gzip, eliminar animações GPU custosas de blur, otimizar carregamento de assets críticos e elevar a fluidez e sensação premium da interface sem empobrecer o visual.

**Architecture:** Vite + React 18 + framer-motion + Tailwind + shadcn/ui + Supabase. Toda a app está num chunk único de 2MB sem code splitting. As animações de orbs (blur 80–120px) correm em framer-motion infinite loop e são o maior gargalo de GPU. Sem resource hints para fontes ou assets críticos.

**Tech Stack:** Vite 5, React 18.3, framer-motion 12, Tailwind 3, shadcn/ui (Radix), Supabase JS, react-router-dom 6, recharts 2, TanStack Query 5

---

## DIAGNÓSTICO — Gargalos por Impacto

| # | Gargalo | Impacto | Arquivo(s) |
|---|---------|---------|------------|
| 1 | **Zero code splitting** — 28 páginas + admin todas eager-imported → 1 chunk de 2MB / 591KB gzip | 🔴 CRÍTICO | `src/App.tsx` |
| 2 | **hero-student.png = 4.1MB** — PNG 1696×2376 completamente não-usado no código | 🔴 CRÍTICO | `public/hero-student.png` |
| 3 | **Animated blur orbs com framer-motion** — 6+ `motion.div` com `blur-[80px..120px]` em loop infinito força compositing GPU constante | 🔴 CRÍTICO | `src/pages/LandingPage.tsx`, `src/components/auth/BackgroundGlowLayer.tsx` |
| 4 | **Font loading render-blocking** — `@import url(fonts.googleapis.com)` no topo do CSS bloqueia renderização | 🟠 ALTO | `src/index.css`, `index.html` |
| 5 | **`authPageReveal` anima `filter: blur(10px)` → `blur(0px)`** — blur filter no caminho crítico do login | 🟠 ALTO | `src/components/auth/motion.ts` |
| 6 | **Sem resource hints** — Sem `preconnect` para Google Fonts ou Supabase, sem `preload` para logo | 🟠 ALTO | `index.html` |
| 7 | **recharts no bundle principal** — Usado só em `ComparativoPage` mas está no chunk único | 🟠 ALTO | `src/App.tsx`, `src/pages/ComparativoPage.tsx` |
| 8 | **xlsx + jszip no bundle principal** — Admin-only, nunca usados por usuários normais | 🟠 ALTO | `src/App.tsx`, admin pages |
| 9 | **Vite sem manualChunks** — Nenhum vendor splitting, framework/UI libraries misturadas com app code | 🟡 MÉDIO | `vite.config.ts` |
| 10 | **sanarflix-icon.png (40KB)** — PNG usado em locais de alta frequência (hero, login, sidebar) | 🟡 MÉDIO | `src/components/brand/BrandMark.tsx` |
| 11 | **LandingNavbar anima `backdropFilter` via framer-motion** no scroll — propriedade JS-driven | 🟡 MÉDIO | `src/components/landing/LandingNavbar.tsx` |
| 12 | **HomeHeroSection `blur-[80px] animate-glow-pulse`** — CSS animation em elemento com blur | 🟡 MÉDIO | `src/components/premium/home/HomeHeroSection.tsx` |
| 13 | **Timing stagger do dashboard** — `DURATION = 0.5s` com `staggerChildren: 0.07` feels slow (7 cards = 0.5s delay total) | 🟡 MÉDIO | `src/components/premium/home/HomePagePremium.tsx` |
| 14 | **BrandHero usa `backdrop-blur-2xl`** — panel estático com backdrop-filter custoso | 🟢 BAIXO | `src/components/auth/BrandHero.tsx` |

---

## Task 1: Route-Based Code Splitting (App.tsx)

**Impacto esperado:** Bundle inicial de 2MB → ~400-600KB. Maior ganho único possível.

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Ler o arquivo atual**

```bash
cat src/App.tsx
```

Expected: 38 import statements no topo, todos estáticos.

- [ ] **Step 2: Substituir todos os static imports de páginas por React.lazy()**

Reescrever `src/App.tsx` com o conteúdo abaixo (manter as importações de providers, contexts e componentes de layout que são necessários no shell inicial):

```tsx
import { Suspense, lazy } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { UserProvider } from "@/contexts/UserContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { DashboardLayout } from "@/components/premium/DashboardLayout";
import { FloatingOfflineTimer } from "@/components/FloatingOfflineTimer";

// Public pages
const LoginPage = lazy(() => import("./pages/LoginPage"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const AuthCallbackPage = lazy(() => import("./pages/AuthCallbackPage"));
const AuthSSOPage = lazy(() => import("./pages/AuthSSOPage"));
const LandingPage = lazy(() => import("./pages/LandingPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const OnboardingPage = lazy(() => import("./pages/OnboardingPage"));

// App pages
const HomePagePremium = lazy(() =>
  import("@/components/premium/home/HomePagePremium").then((m) => ({
    default: m.HomePagePremium,
  }))
);
const SimuladosPage = lazy(() => import("./pages/SimuladosPage"));
const SimuladoDetailPage = lazy(() => import("./pages/SimuladoDetailPage"));
const SimuladoExamPage = lazy(() => import("./pages/SimuladoExamPage"));
const ResultadoPage = lazy(() => import("./pages/ResultadoPage"));
const AnswerSheetPage = lazy(() => import("./pages/AnswerSheetPage"));
const CorrecaoPage = lazy(() => import("./pages/CorrecaoPage"));
const DesempenhoPage = lazy(() => import("./pages/DesempenhoPage"));
const RankingPage = lazy(() => import("./pages/RankingPage"));
const ComparativoPage = lazy(() => import("./pages/ComparativoPage"));
const CadernoErrosPage = lazy(() => import("./pages/CadernoErrosPage"));
const ConfiguracoesPage = lazy(() => import("./pages/ConfiguracoesPage"));

// Admin (completely isolated)
const AdminLoginPage = lazy(() => import("./admin/AdminLoginPage"));
const AdminGuard = lazy(() =>
  import("./admin/AdminGuard").then((m) => ({ default: m.AdminGuard }))
);
const AdminApp = lazy(() =>
  import("./admin/AdminApp").then((m) => ({ default: m.AdminApp }))
);
const AdminDashboard = lazy(() => import("./admin/pages/AdminDashboard"));
const AdminSimulados = lazy(() => import("./admin/pages/AdminSimulados"));
const AdminSimuladoForm = lazy(() => import("./admin/pages/AdminSimuladoForm"));
const AdminUploadQuestions = lazy(() => import("./admin/pages/AdminUploadQuestions"));

/** Fallback mínimo — sem spinner grande para não causar flash */
function PageShell() {
  return (
    <div
      className="min-h-screen bg-background"
      aria-hidden="true"
    />
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
    },
  },
});

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <UserProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <FloatingOfflineTimer />
              <Suspense fallback={<PageShell />}>
                <Routes>
                  {/* Public */}
                  <Route path="/landing" element={<LandingPage />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                  <Route path="/reset-password" element={<ResetPasswordPage />} />
                  <Route path="/auth/callback" element={<AuthCallbackPage />} />
                  <Route path="/auth/sso" element={<AuthSSOPage />} />

                  {/* Admin — isolated */}
                  <Route path="/admin/login" element={<AdminLoginPage />} />
                  <Route path="/admin" element={<AdminGuard />}>
                    <Route element={<AdminApp />}>
                      <Route index element={<AdminDashboard />} />
                      <Route path="simulados" element={<AdminSimulados />} />
                      <Route path="simulados/novo" element={<AdminSimuladoForm />} />
                      <Route path="simulados/:id" element={<AdminSimuladoForm />} />
                      <Route path="simulados/:id/questoes" element={<AdminUploadQuestions />} />
                    </Route>
                  </Route>

                  {/* Protected — premium shell */}
                  <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
                    <Route index element={<HomePagePremium />} />
                    <Route path="simulados" element={<SimuladosPage />} />
                    <Route path="simulados/:id/start" element={<SimuladoDetailPage />} />
                    <Route path="simulados/:id" element={<SimuladoDetailPage />} />
                    <Route path="simulados/:id/prova" element={<SimuladoExamPage />} />
                    <Route path="simulados/:id/resultado" element={<ResultadoPage />} />
                    <Route path="simulados/:id/gabarito" element={<AnswerSheetPage />} />
                    <Route path="simulados/:id/correcao" element={<CorrecaoPage />} />
                    <Route path="desempenho" element={<DesempenhoPage />} />
                    <Route path="ranking" element={<RankingPage />} />
                    <Route path="comparativo" element={<ComparativoPage />} />
                    <Route path="caderno-erros" element={<CadernoErrosPage />} />
                    <Route path="configuracoes" element={<ConfiguracoesPage />} />
                  </Route>
                  <Route
                    path="/onboarding"
                    element={
                      <ProtectedRoute skipOnboardingCheck>
                        <OnboardingPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </UserProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
```

**IMPORTANTE:** `AdminGuard` e `AdminApp` exportam named exports. O `.then((m) => ({ default: m.X }))` pattern é necessário para wrapping lazy. Verifique se os arquivos usam `export function` ou `export default`. Se usar `export default`, use `lazy(() => import(...))` diretamente sem o `.then()`.

Antes de escrever o arquivo, leia cada arquivo de admin para verificar se o export é default ou named:
```bash
head -5 src/admin/AdminGuard.tsx
head -5 src/admin/AdminApp.tsx
```

- [ ] **Step 3: Verificar se `ProtectedRoute` e `DashboardLayout` são usados como shell**

`DashboardLayout` é o layout persistente das rotas autenticadas. Deve permanecer como import estático pois é parte do shell. `ProtectedRoute` também. Confirme que estes NÃO foram convertidos para lazy (já estão corretos no template acima).

- [ ] **Step 4: Build e verificar chunks**

```bash
npx vite build 2>&1 | grep -E "chunk|kB|MB|assets/"
```

Expected output: Múltiplos chunks menores em vez de 1 chunk de 2MB. O chunk principal deve cair para <700KB (antes de manualChunks da Task 2).

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "perf: lazy-load all routes — split 2MB bundle into on-demand chunks"
```

---

## Task 2: Vite Build Config — Manual Chunks + Build Optimization

**Impacto esperado:** Melhor cache de vendors (libs não mudam, app code muda), chunks menores, melhor paralelismo de download.

**Files:**
- Modify: `vite.config.ts`

- [ ] **Step 1: Ler vite.config.ts atual**

```bash
cat vite.config.ts
```

- [ ] **Step 2: Adicionar build config com manualChunks**

Substituir o `export default defineConfig(...)` por:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    headers: {
      "X-Frame-Options": "DENY",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "geolocation=(), camera=(), microphone=()",
      "Content-Security-Policy": [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: blob: https:",
        "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
        "frame-ancestors 'none'",
      ].join("; "),
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Warn at 600KB instead of default 500KB (our chunks will be smaller now)
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // React ecosystem — changes rarely, long cache
          if (id.includes("node_modules/react/") || id.includes("node_modules/react-dom/")) {
            return "vendor-react";
          }
          // Router
          if (id.includes("node_modules/react-router")) {
            return "vendor-router";
          }
          // Framer Motion — large, changes independently
          if (id.includes("node_modules/framer-motion")) {
            return "vendor-motion";
          }
          // Recharts — only used on ComparativoPage, lazy-loaded
          if (id.includes("node_modules/recharts") || id.includes("node_modules/d3-") || id.includes("node_modules/victory-")) {
            return "vendor-charts";
          }
          // Supabase
          if (id.includes("node_modules/@supabase")) {
            return "vendor-supabase";
          }
          // Radix UI primitives — large collection
          if (id.includes("node_modules/@radix-ui")) {
            return "vendor-radix";
          }
          // TanStack Query
          if (id.includes("node_modules/@tanstack")) {
            return "vendor-query";
          }
          // Admin-specific heavy deps (xlsx, jszip) — only loaded when admin route is visited
          if (
            id.includes("node_modules/xlsx") ||
            id.includes("node_modules/jszip") ||
            id.includes("node_modules/exceljs")
          ) {
            return "vendor-admin-heavy";
          }
          // Other node_modules
          if (id.includes("node_modules/")) {
            return "vendor-misc";
          }
        },
      },
    },
  },
}));
```

- [ ] **Step 3: Build e verificar melhoria nos chunks**

```bash
npx vite build 2>&1 | grep -E "kB|MB|assets/" | sort -k2 -rn | head -20
```

Expected: `vendor-react`, `vendor-motion`, `vendor-supabase`, `vendor-radix` como chunks separados. Nenhum chunk acima de 600KB.

- [ ] **Step 4: Commit**

```bash
git add vite.config.ts
git commit -m "perf: add Vite manualChunks for vendor splitting and better caching"
```

---

## Task 3: Asset Cleanup — Delete Orphaned PNG + Fix Font Loading Strategy

**Impacto esperado:** -4.1MB do servidor, FCP mais rápido (font não bloqueia render), LCP melhor.

**Files:**
- Delete: `public/hero-student.png`
- Modify: `index.html`
- Modify: `src/index.css`

- [ ] **Step 1: Confirmar que hero-student.png não é usado**

```bash
grep -r "hero-student" src/ public/ index.html --include="*.tsx" --include="*.ts" --include="*.css" --include="*.html"
```

Expected: zero matches (arquivo é orphaned).

- [ ] **Step 2: Deletar arquivo não usado**

```bash
rm public/hero-student.png
```

- [ ] **Step 3: Verificar que `@import` de font está em index.css**

```bash
head -3 src/index.css
```

Expected: `@import url('https://fonts.googleapis.com/css2?...')`

- [ ] **Step 4: Remover @import da font do CSS**

No arquivo `src/index.css`, remover a linha:
```css
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800&display=swap');
```

Substituir por nada (linha vazia). A font será carregada via `<link>` no HTML (Step 5).

- [ ] **Step 5: Adicionar resource hints + font link ao index.html**

Ler o `index.html` atual e substituir o `<head>` por:

```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Simulados SanarFlix</title>
    <meta name="description" content="Simulados cronometrados no modelo ENAMED, ranking, correção por área e recursos PRO: ENAMED para sua residência.">
    <meta name="author" content="Sanar" />

    <link rel="icon" href="/icone.svg" type="image/svg+xml" />

    <!-- Resource hints: preconnect antes de qualquer fetch -->
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />

    <!-- Font: não-blocking, display=swap já incluído pelo Google -->
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800&display=swap"
      media="print"
      onload="this.media='all'"
    />
    <noscript>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800&display=swap"
      />
    </noscript>

    <!-- Preload críticos above-fold -->
    <link rel="preload" href="/logo.svg" as="image" type="image/svg+xml" />
    <link rel="preload" href="/icone.svg" as="image" type="image/svg+xml" />

    <meta property="og:type" content="website" />
    <meta property="og:title" content="Simulados SanarFlix" />
    <meta property="og:description" content="Simulados cronometrados no modelo ENAMED, ranking, correção por área e recursos PRO: ENAMED para sua residência.">
    <meta property="og:image" content="%VITE_SITE_URL%/logo.svg" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="Simulados SanarFlix" />
    <meta name="twitter:description" content="Simulados cronometrados no modelo ENAMED, ranking, correção por área e recursos PRO: ENAMED para sua residência.">
    <meta name="twitter:image" content="%VITE_SITE_URL%/logo.svg" />
  </head>

  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

**Nota:** O `media="print" onload="this.media='all'"` é o padrão de font-loading não-blocking. Funciona em todos os browsers modernos. O `<noscript>` é fallback para JS desabilitado.

- [ ] **Step 6: Verificar que a font ainda carrega no dev**

```bash
# Testar que a remoção do @import não quebrou nada
npx vite build 2>&1 | grep -i "error\|warning" | grep -v "ambiguous\|mistyped" | head -10
```

Expected: Sem errors relacionados à font.

- [ ] **Step 7: Commit**

```bash
git add index.html src/index.css
git rm public/hero-student.png
git commit -m "perf: non-blocking font loading + preconnect hints + delete orphaned 4.1MB hero PNG"
```

---

## Task 4: Eliminate Animated GPU Blur Orbs — Landing Page

**Impacto esperado:** Eliminar 3 framer-motion infinite loops em `blur-[80..100px]`. Para de forçar GPU compositing a cada frame na landing page. Reduz drasticamente CPU idle e melhora fluidez geral na landing.

**Strategy:** Trocar `motion.div` animate por `div` com CSS `animation`. Animações CSS de `opacity` num elemento `will-change: opacity` são compositor-only — sem layout, sem paint, sem JS a cada frame.

**Files:**
- Modify: `src/pages/LandingPage.tsx`

- [ ] **Step 1: Ler o componente atual dos orbs na LandingPage**

```bash
sed -n '1,80p' src/pages/LandingPage.tsx
```

- [ ] **Step 2: Substituir os 3 orbs framer-motion por divs CSS**

Localizar o bloco dentro de `LandingPage()`:

```tsx
{/* Orb 1 — top-left, wine-glow */}
<motion.div
  className="absolute top-[-5%] left-[-8%] w-[600px] h-[600px] rounded-full bg-[hsl(var(--wine-glow)/0.18)] blur-[100px]"
  animate={{ x: [0, 35, 0], y: [0, -25, 0] }}
  transition={{ duration: 14, ease: "easeInOut", repeat: Infinity }}
/>
{/* Orb 2 — top-right: main + leve accent-mid (variedade tonal) */}
<motion.div
  className="absolute top-[5%] right-[-10%] h-[500px] w-[500px] rounded-full blur-[90px]"
  style={{
    background:
      "radial-gradient(circle, hsl(var(--primary) / 0.14) 0%, hsl(var(--landing-accent-mid) / 0.06) 55%, transparent 70%)",
  }}
  animate={{ x: [0, -28, 0], y: [0, 20, 0] }}
  transition={{ duration: 18, ease: "easeInOut", repeat: Infinity }}
/>
{/* Orb 3 — bottom-center, wine */}
<motion.div
  className="absolute bottom-[0%] left-[30%] w-[400px] h-[400px] rounded-full bg-[hsl(var(--wine)/0.08)] blur-[80px]"
  animate={{ opacity: [0.5, 1, 0.5] }}
  transition={{ duration: 10, ease: "easeInOut", repeat: Infinity }}
/>
```

Substituir por (remove o import de `motion` se não for mais usado em LandingPage — mas `motion` ainda é importado lá então só remove os orbs):

```tsx
{/* Orb 1 — top-left, wine-glow — CSS animation, compositor-only */}
<div
  className="absolute top-[-5%] left-[-8%] w-[600px] h-[600px] rounded-full bg-[hsl(var(--wine-glow)/0.18)] blur-[100px] landing-orb-drift-a"
  aria-hidden
/>
{/* Orb 2 — top-right */}
<div
  className="absolute top-[5%] right-[-10%] h-[500px] w-[500px] rounded-full blur-[90px] landing-orb-drift-b"
  style={{
    background:
      "radial-gradient(circle, hsl(var(--primary) / 0.14) 0%, hsl(var(--landing-accent-mid) / 0.06) 55%, transparent 70%)",
  }}
  aria-hidden
/>
{/* Orb 3 — bottom-center, wine */}
<div
  className="absolute bottom-[0%] left-[30%] w-[400px] h-[400px] rounded-full bg-[hsl(var(--wine)/0.08)] blur-[80px] landing-orb-pulse"
  aria-hidden
/>
```

- [ ] **Step 3: Adicionar keyframes e classes de animação ao index.css**

No final da seção `@layer base` do `src/index.css` (antes do fechamento do `@layer base`), adicionar:

```css
/* Landing ambient orbs — CSS-only, compositor-friendly */
/* translate é compositor-only quando paired com will-change: transform */
@keyframes orb-drift-a {
  0%, 100% { transform: translate(0, 0); }
  50%       { transform: translate(35px, -25px); }
}
@keyframes orb-drift-b {
  0%, 100% { transform: translate(0, 0); }
  50%       { transform: translate(-28px, 20px); }
}
@keyframes orb-pulse-opacity {
  0%, 100% { opacity: 0.5; }
  50%       { opacity: 1; }
}
```

E dentro de `@layer utilities` (ou no final do arquivo, após as camadas do tailwind):

```css
.landing-orb-drift-a {
  will-change: transform;
  animation: orb-drift-a 14s ease-in-out infinite;
}
.landing-orb-drift-b {
  will-change: transform;
  animation: orb-drift-b 18s ease-in-out infinite;
}
.landing-orb-pulse {
  will-change: opacity;
  animation: orb-pulse-opacity 10s ease-in-out infinite;
}

@media (prefers-reduced-motion: reduce) {
  .landing-orb-drift-a,
  .landing-orb-drift-b,
  .landing-orb-pulse {
    animation: none;
  }
}
```

- [ ] **Step 4: Verificar que o LandingPage ainda importa motion (para outras animações)**

```bash
grep "from \"framer-motion\"\|from 'framer-motion'" src/pages/LandingPage.tsx
```

`motion` ainda é usado no `LandingPage` para o layout wrapper. O import deve permanecer.

- [ ] **Step 5: Commit**

```bash
git add src/pages/LandingPage.tsx src/index.css
git commit -m "perf: replace 3 framer-motion blur orbs with CSS-only animations on landing page"
```

---

## Task 5: Eliminate Animated GPU Blur Orbs — Auth Page

**Impacto esperado:** Eliminar 3 framer-motion infinite loops em `blur-[86..120px]` na BackgroundGlowLayer. A página de login é a mais crítica (primeiro acesso de usuários).

**Files:**
- Modify: `src/components/auth/BackgroundGlowLayer.tsx`
- Modify: `src/index.css` (adicionar keyframes de auth orbs)

- [ ] **Step 1: Ler BackgroundGlowLayer atual**

```bash
cat src/components/auth/BackgroundGlowLayer.tsx
```

- [ ] **Step 2: Substituir os 3 motion.div orbs por divs com CSS animation**

Reescrever `src/components/auth/BackgroundGlowLayer.tsx`:

```tsx
export function BackgroundGlowLayer() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-auth-base" />
      <div className="absolute inset-0 bg-[radial-gradient(92%_88%_at_0%_8%,hsl(var(--auth-accent-glow)/0.38),transparent_54%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(66%_54%_at_20%_26%,hsl(var(--primary)/0.22),transparent_62%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(90%_76%_at_82%_78%,hsl(var(--auth-accent-glow)/0.08),transparent_68%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(102deg,hsl(var(--auth-bg-soft))_0%,hsl(var(--auth-bg-base))_34%,hsl(var(--auth-bg-base))_100%)] opacity-95" />

      {/* Orb 1 — substituído para CSS animation */}
      <div className="absolute -left-36 top-[-6%] h-[32rem] w-[32rem] rounded-full bg-primary/24 blur-[120px] auth-orb-1" />
      {/* Orb 2 */}
      <div className="absolute -right-24 bottom-10 h-72 w-72 rounded-full bg-primary/8 blur-[110px] auth-orb-2" />
      {/* Orb 3 */}
      <div className="absolute left-[42%] top-[18%] h-44 w-44 rounded-full bg-[hsl(var(--auth-accent-glow)/0.05)] blur-[86px] auth-orb-3" />

      <div className="absolute inset-0 bg-[linear-gradient(180deg,hsl(var(--auth-text-primary)/0.025)_0%,hsl(var(--auth-text-primary)/0)_14%,hsl(var(--auth-bg-base)/0.78)_100%)]" />
    </div>
  );
}
```

**Nota:** Remover `import { motion, useReducedMotion } from "framer-motion";` do topo do arquivo pois não é mais necessário.

- [ ] **Step 3: Adicionar os keyframes de auth orbs ao index.css**

Após as classes `landing-orb-*` adicionadas na Task 4, adicionar:

```css
/* Auth background orbs — CSS-only */
@keyframes auth-orb-float-1 {
  0%, 100% { opacity: 0.55; transform: translate(0, 0); }
  50%       { opacity: 0.92; transform: translate(18px, -12px); }
}
@keyframes auth-orb-float-2 {
  0%, 100% { opacity: 0.45; transform: translate(0, 0); }
  50%       { opacity: 0.7; transform: translate(-14px, 8px); }
}
@keyframes auth-orb-breathe {
  0%, 100% { opacity: 0.14; transform: scale(1); }
  50%       { opacity: 0.3; transform: scale(1.06); }
}

.auth-orb-1 {
  will-change: transform, opacity;
  animation: auth-orb-float-1 9s ease-in-out infinite;
}
.auth-orb-2 {
  will-change: transform, opacity;
  animation: auth-orb-float-2 11s ease-in-out infinite;
}
.auth-orb-3 {
  will-change: transform, opacity;
  animation: auth-orb-breathe 10.5s ease-in-out infinite;
}

@media (prefers-reduced-motion: reduce) {
  .auth-orb-1,
  .auth-orb-2,
  .auth-orb-3 {
    animation: none;
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/auth/BackgroundGlowLayer.tsx src/index.css
git commit -m "perf: replace 3 framer-motion blur orbs with CSS-only animations on auth background"
```

---

## Task 6: Fix Auth Page Reveal Animation — Remove Expensive blur() Filter

**Impacto esperado:** A animação de entrada do card de login deixa de pintar um blur de 10px a cada frame. A reveal animation fica mais suave e mais rápida visualmente.

**Files:**
- Modify: `src/components/auth/motion.ts`

- [ ] **Step 1: Ler motion.ts atual**

```bash
cat src/components/auth/motion.ts
```

- [ ] **Step 2: Remover filter blur do authPageReveal**

Localizar:

```ts
export const authPageReveal: Variants = {
  hidden: { opacity: 0, y: 18, filter: "blur(10px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: AUTH_DURATION_SLOW, ease: AUTH_EASE_STANDARD },
  },
};
```

Substituir por (remove blur, mantém opacity + y para sensação premium):

```ts
export const authPageReveal: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: AUTH_DURATION_SLOW, ease: AUTH_EASE_STANDARD },
  },
};
```

**Por que:** `filter: blur()` força um full-layer repaint a cada frame da animação. É a propriedade mais cara para animar em CSS/framer. Opacity + translateY são compositor-only e rodam a 60fps sem impacto.

- [ ] **Step 3: Commit**

```bash
git add src/components/auth/motion.ts
git commit -m "perf: remove blur() filter from auth card reveal animation — opacity+y only"
```

---

## Task 7: Fix HomeHeroSection — Static Blur Element + Reduce glow-pulse Cost

**Impacto esperado:** O `blur-[80px] animate-glow-pulse` na HomeHeroSection é o primeiro elemento renderizado no dashboard após login. Remover a CSS animation de opacity num elemento com blur — mesmo sendo CSS, força repaint no compositor.

**Files:**
- Modify: `src/components/premium/home/HomeHeroSection.tsx`

- [ ] **Step 1: Ler HomeHeroSection atual**

```bash
sed -n '48,58p' src/components/premium/home/HomeHeroSection.tsx
```

- [ ] **Step 2: Remover animate-glow-pulse do elemento com blur**

Localizar a linha:
```tsx
<div className="pointer-events-none absolute -top-28 -right-16 h-72 w-72 rounded-full bg-[hsl(345,72%,48%)] blur-[80px] animate-glow-pulse" />
```

Substituir por (mantém o glow visual mas sem animation no elemento com blur):
```tsx
<div className="pointer-events-none absolute -top-28 -right-16 h-72 w-72 rounded-full bg-[hsl(345,72%,48%)] blur-[80px] opacity-[0.15]" />
```

**Nota:** A animação `glow-pulse` animava de `opacity: 0.12` a `opacity: 0.18` — variação mínima que o usuário mal percebia, mas causava repaint. Fixar em `opacity-[0.15]` preserva o visual sem custo.

- [ ] **Step 3: Commit**

```bash
git add src/components/premium/home/HomeHeroSection.tsx
git commit -m "perf: remove animated blur from HomeHeroSection glow — fix to static opacity"
```

---

## Task 8: Optimize LandingNavbar — CSS-Driven Backdrop-Filter

**Impacto esperado:** Remover framer-motion animando `backdropFilter` via JavaScript no scroll. Trocar por CSS transition com data-attribute — o browser gerencia a transição via CSS sem overhead de JS por frame.

**Files:**
- Modify: `src/components/landing/LandingNavbar.tsx`

- [ ] **Step 1: Ler a seção relevante do LandingNavbar**

```bash
sed -n '50,100p' src/components/landing/LandingNavbar.tsx
```

- [ ] **Step 2: Substituir motion.nav com animate backdropFilter por nav com CSS data-attr**

Localizar o `<motion.nav animate={{ ... backdropFilter ... }}>` e substituir por:

```tsx
<nav
  data-scrolled={scrolled ? "true" : undefined}
  className={cn(
    "w-full border border-transparent min-w-0 transition-[border-radius,background-color,border-color,box-shadow] duration-500",
    "ease-[cubic-bezier(0.32,0.72,0.2,1)]",
    "[&[data-scrolled]]:rounded-[20px]",
    "[&[data-scrolled]]:bg-[hsl(var(--card)/0.94)]",
    "[&[data-scrolled]]:backdrop-blur-2xl",
    "[&[data-scrolled]]:saturate-[1.15]",
    "[&[data-scrolled]]:border-border",
    "[&[data-scrolled]]:shadow-[0_0_0_1px_hsl(var(--border)),0_24px_60px_-12px_rgba(0,0,0,0.45),0_12px_24px_-8px_rgba(0,0,0,0.25)]",
    "bg-[hsl(var(--card)/0.04)]",
  )}
  style={{ boxSizing: "border-box" }}
>
```

**Também:** substituir `<motion.header` por `<header` no mesmo componente, com as classes de transição inline:

```tsx
<header
  className={cn(
    "fixed top-0 left-0 right-0 z-50 overflow-x-hidden box-border transition-[padding] duration-500 ease-[cubic-bezier(0.32,0.72,0.2,1)]",
    scrolled && "pt-5 px-4 sm:px-5 md:px-6 lg:px-8 xl:px-10 2xl:px-12"
  )}
>
```

**IMPORTANTE:** O `motion` import ainda pode ser necessário para `AnimatePresence` (mobile menu). Verifique antes de remover o import. Se `AnimatePresence` é usado no LandingNavbar, mantenha o import mas remova apenas o `motion.header` e `motion.nav`.

Leia o arquivo completo antes de editar:
```bash
wc -l src/components/landing/LandingNavbar.tsx && grep -n "motion\." src/components/landing/LandingNavbar.tsx | head -20
```

- [ ] **Step 3: Build sem errors**

```bash
npx vite build 2>&1 | grep -i "error" | grep -v "ambiguous\|mistyped\|VITE_SITE_URL"
```

Expected: Sem errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/landing/LandingNavbar.tsx
git commit -m "perf: replace framer-motion scroll-driven backdropFilter with CSS data-attr transition"
```

---

## Task 9: Dashboard Motion Timing — Faster Stagger + Reduced Duration

**Impacto esperado:** Dashboard home parece mais rápido e responsivo. Cards aparecem mais cedo sem sacrificar a sensação de fluidade.

**Files:**
- Modify: `src/components/premium/home/HomePagePremium.tsx`

- [ ] **Step 1: Ler as constantes de timing atuais**

```bash
grep -n "STAGGER\|DURATION\|EASE\|delay" src/components/premium/home/HomePagePremium.tsx | head -15
```

Expected output inclui:
```
const STAGGER_CHILDREN = 0.07;
const STAGGER_DELAY = 0.03;
const DURATION = 0.5;
```

- [ ] **Step 2: Reduzir durations e stagger para sensação mais premium**

Localizar:
```ts
const STAGGER_CHILDREN = 0.07;
const STAGGER_DELAY = 0.03;
const DURATION = 0.5;
const EASE = [0.25, 0.46, 0.45, 0.94] as const;
```

Substituir por:
```ts
const STAGGER_CHILDREN = 0.055;
const STAGGER_DELAY = 0.02;
const DURATION = 0.38;
const EASE = [0.22, 0.9, 0.35, 1.0] as const;
```

**Por que:** `DURATION = 0.5s` com `staggerChildren: 0.07` significa que o último de 7 cards começa a aparecer 0.49s depois do primeiro. Apps premium (Notion, Linear, Vercel) usam 30–40ms de stagger. O novo easing `[0.22, 0.9, 0.35, 1.0]` tem um arranque mais suave e saída mais rápida — sensação de "snap" premium.

- [ ] **Step 3: Commit**

```bash
git add src/components/premium/home/HomePagePremium.tsx
git commit -m "perf: tighten dashboard stagger timing — 0.5s → 0.38s, 70ms stagger → 55ms"
```

---

## Task 10: Optimize sanarflix-icon.png → Use Existing SVG

**Impacto esperado:** Reduzir 40KB de download de uma PNG para 0KB adicional (usando o SVG já disponível). A imagem escala perfeitamente em retina/HDPI.

**Context:** `SANARFLIX_MARK_SRC` aponta para `/sanarflix-icon.png` (40KB PNG 512×512). O ícone é usado em 3 locais: landing hero, login page, sidebar footer. O projeto já tem `/icone.svg` (2.5KB).

**Mas:** O `sanarflix-icon.png` pode ser visualmente diferente de `icone.svg`. Antes de trocar, verificar.

**Files:**
- Modify: `src/components/brand/BrandMark.tsx`

- [ ] **Step 1: Comparar os dois assets visualmente (analise os SVG paths)**

```bash
head -5 public/icone.svg
head -2 public/logo.svg
# Verificar se sanarflix-icon.png e icone.svg são o mesmo ícone
```

- [ ] **Step 2: Se icone.svg for o mesmo ícone que sanarflix-icon.png, atualizar BrandMark**

Localizar em `src/components/brand/BrandMark.tsx`:
```ts
export const SANARFLIX_MARK_SRC = "/sanarflix-icon.png";
```

Substituir por:
```ts
export const SANARFLIX_MARK_SRC = "/icone.svg";
```

**Se `icone.svg` for diferente (marca da plataforma ENAMED vs marca SanarFlix), NÃO trocar.** Nesse caso, criar um `sanarflix-icon.svg` a partir do PNG (conversão manual necessária fora deste plano).

- [ ] **Step 3: Verificar que imagem renderiza corretamente**

Checar nos arquivos que usam `SANARFLIX_MARK_SRC`:
```bash
grep -rn "SANARFLIX_MARK_SRC" src/ --include="*.tsx"
```

Abrir visualmente no browser para confirmar que o ícone está correto.

- [ ] **Step 4: Commit (apenas se a troca for válida)**

```bash
git add src/components/brand/BrandMark.tsx
git commit -m "perf: use SVG instead of 40KB PNG for SanarFlix brand icon"
```

---

## Task 11: Final Build Validation

- [ ] **Step 1: Build completo e analisar chunks finais**

```bash
npx vite build 2>&1 | grep -E "assets/|kB|MB" | sort -t'|' -k2 -rn
```

Expected results:
- Nenhum chunk acima de 600KB
- `vendor-react` ~150KB
- `vendor-motion` ~120KB
- `vendor-supabase` ~80KB
- `vendor-radix` ~200KB
- App chunks individuais de 10-80KB cada

- [ ] **Step 2: Comparar CSS size**

```bash
npx vite build 2>&1 | grep "\.css"
```

Expected: CSS deve manter ~226KB (35KB gzip) — não deve ter crescido significativamente.

- [ ] **Step 3: Verificar que não há errors de TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: Sem errors.

- [ ] **Step 4: Rodar testes**

```bash
bun test 2>&1 | tail -20
```

Expected: Todos os testes passando.

- [ ] **Step 5: Commit final de validação**

```bash
git add -A
git commit -m "perf: final validation — all chunks split, animations optimized, assets cleaned"
```

---

## Entregáveis Esperados

### Ganhos de Bundle
| Métrica | Antes | Depois (estimado) |
|---------|-------|-------------------|
| Bundle inicial | 2.0MB / 591KB gzip | ~400-500KB / 150-180KB gzip |
| Chunks | 1 único | 12-15 chunks separados |
| Primeiro download significativo | 2MB | ~200KB (vendor-react + vendor-router + app shell) |

### Ganhos de Performance Percebida
- **FCP**: Melhor (font não bloqueia render, Suspense shell é mínimo)
- **LCP**: Melhor (logo preloaded, less JS blocking)
- **INP**: Melhor (menos JS parse/execution na primeira interação)
- **CLS**: Mantido (nenhuma mudança de layout)
- **Fluidez landing**: Muito melhor (3 framer-motion infinite loops eliminados)
- **Fluidez auth**: Muito melhor (3 framer-motion infinite loops + blur filter animation eliminados)
- **Dashboard feel**: Mais premium (timing mais rápido e preciso)

### Sem Regressões Visuais
- Orbs mantêm posição e comportamento visual — apenas o engine muda de JS para CSS
- Navbar backdrop-blur mantém visual exato — apenas engine muda para CSS
- Auth card reveal mantém sensação premium — só remove blur caro
