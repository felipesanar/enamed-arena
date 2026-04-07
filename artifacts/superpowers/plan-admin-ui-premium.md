### Goal
Implementar, de forma incremental, a evolução visual da Central Admin descrita em `artifacts/superpowers/brainstorm.md`: tema claro/escuro funcional, gráficos alinhados ao design system, kit leve de superfícies/métricas, substituição de Unicode/emoji por Lucide, microinterações acessíveis — sem regredir layout, organização nem performance.

### Assumptions
- Tokens `:root` / `.dark` em `src/index.css` já existem; hoje **não há** `ThemeProvider` nem `next-themes` no `package.json` — é necessário introduzir um mecanismo de toggle persistente (recomendado: `next-themes`, padrão shadcn).
- Admin usa **Recharts** direto em `AdminTrendChart.tsx`; existe `src/components/ui/chart.tsx` (ChartContainer) no app, mas o admin ainda não o utiliza — podemos ou centralizar tema num módulo admin ou migrar gradualmente para `ChartContainer`.
- Testes em `src/admin/__tests__/*.test.tsx` dependem de texto/roles: mudanças de cópia ou estrutura exigem ajuste explícito dos testes.

### Plan

1. **Dependência e provider de tema (app-wide)**
   - Files: `package.json`, `src/App.tsx` (e opcionalmente `src/main.tsx` se preferir montar o provider ali)
   - Change: adicionar `next-themes`; envolver a árvore interna do router (ou `QueryClientProvider` + filhos) com `ThemeProvider` (`attribute="class"`, `defaultTheme="light"`, `storageKey` dedicado, `enableSystem={true}` opcional).
   - Verify: `npm install` (após edição do package); `npm run build`; smoke manual: alternar tema e confirmar classe `dark` em `<html>`.

2. **Toggle de tema na shell admin**
   - Files: `src/admin/components/AdminTopbar.tsx`
   - Change: botão ícone (Sol/Lua) com `useTheme` do `next-themes`; `aria-label` claro; posicionar junto aos controles existentes; respeitar foco visível.
   - Verify: `npm run lint`; smoke: `/admin` com toggle e persistência após refresh.

3. **Módulo `adminChartTheme` + hook de tema**
   - Files: novo `src/admin/lib/adminChartTheme.ts` (e, se útil, `src/admin/hooks/useAdminChartTheme.ts`)
   - Change: exportar objeto/função que devolve cores para Recharts (eixos, grid, tooltip, cursor) usando valores compatíveis com SVG — preferir `hsl(var(--foreground))` etc. ou leitura via `getComputedStyle` num elemento de referência quando necessário; documentar no arquivo quais variáveis são consumidas.
   - Verify: `npm run test -- src/admin` (baseline); importação sem erro em build (`npm run build`).

4. **Refino `AdminTrendChart` com tema**
   - Files: `src/admin/components/ui/AdminTrendChart.tsx`
   - Change: aplicar cores do passo 3 em `CartesianGrid`, `XAxis`, `YAxis`, `Tooltip`, `Legend`, `Bar`; eliminar cores literais frágeis; manter API do componente estável.
   - Verify: `npm run test -- src/admin/__tests__` (ajustar se algum teste quebrar); revisão manual claro/escuro.

5. **Refino `AdminFunnelChart` (contraste + ícone)**
   - Files: `src/admin/components/ui/AdminFunnelChart.tsx`
   - Change: segmentos e tipografia legíveis em `.dark` (evitar assumir sempre fundo claro); substituir prefixo `⚠` por `AlertTriangle` (Lucide) + texto; setas `›` podem virar ícone chevron ou manter se aprovado visualmente.
   - Verify: `npm run test -- src/admin/__tests__/AdminFunnelChart.test.tsx`; contraste visual em ambos os temas.

6. **Kit mínimo: `AdminPanel` / envoltório de chart**
   - Files: novo `src/admin/components/ui/AdminPanel.tsx` (opcional `AdminChartCard.tsx` se fizer sentido)
   - Change: superfície padrão (borda suave, sombra leve, `rounded-xl`, cabeçalho opcional) com transição `transition-colors` / `duration-200`; sem Framer em listas longas.
   - Verify: `npm run lint`; uso piloto em **uma** página antes de espalhar (próximo passo).

7. **`AdminStatCard` premium + ícones de delta**
   - Files: `src/admin/components/ui/AdminStatCard.tsx`, `src/admin/__tests__/AdminStatCard.test.tsx`
   - Change: trocar ▲▼― por `TrendingUp` / `TrendingDown` / `Minus` (Lucide); alinhar tipografia aos tokens (`text-caption`, etc.); opcionalmente compor com `AdminPanel`.
   - Verify: `npm run test -- src/admin/__tests__/AdminStatCard.test.tsx`.

8. **Shell: `AdminRail`, `AdminFlyout`, `AdminApp`**
   - Files: `src/admin/components/AdminRail.tsx`, `src/admin/components/AdminFlyout.tsx`, `src/admin/AdminApp.tsx`
   - Change: estados hover/active/focus consistentes; transições curtas; garantir que o flyout respeite `prefers-reduced-motion` (via `motion-safe:` ou condicional).
   - Verify: `npm run lint`; smoke manual de navegação entre grupos.

9. **Fase páginas — onda 1 (alto impacto)**
   - Files: `src/admin/pages/AdminDashboard.tsx`, `src/admin/pages/AdminAnalytics.tsx`, `src/admin/pages/AdminMarketing.tsx`, `src/admin/pages/AdminProduto.tsx` (+ testes correspondentes se existirem)
   - Change: adotar `AdminPanel`/padrões de chart; alinhar headers com `AdminSectionHeader`; remover emojis residuais; espaçamento e hierarquia consistentes.
   - Verify: `npm run test -- src/admin`; `npm run lint`.

10. **Fase páginas — onda 2**
    - Files: `src/admin/pages/AdminTentativas.tsx`, `src/admin/pages/AdminUsuarios.tsx`, `src/admin/pages/AdminUsuarioDetail.tsx`, `src/admin/pages/AdminSimulados.tsx`, `src/admin/pages/AdminSimuladoAnalytics.tsx`, `src/admin/pages/AdminSimuladoForm.tsx`, `src/admin/pages/AdminUploadQuestions.tsx`
    - Change: mesmo padrão visual; tabelas (`AdminDataTable`) com hover/foco premium sem peso excessivo.
    - Verify: `npm run test -- src/admin`; `npm run lint`.

11. **Stubs + login admin**
    - Files: `src/admin/pages/stubs/_AdminStub.tsx` e stubs individuais se necessário, `src/admin/AdminLoginPage.tsx`
    - Change: alinhar aparência ao shell premium (ilustração/ícone Lucide, tipografia); stubs coerentes entre si.
    - Verify: `npm run test -- src/admin`; smoke `/admin/login`.

12. **`AdminDataTable`, `AdminLivePanel`, `AdminSectionHeader`**
    - Files: `src/admin/components/ui/AdminDataTable.tsx`, `src/admin/components/ui/AdminLivePanel.tsx`, `src/admin/components/ui/AdminSectionHeader.tsx`
    - Change: densidade, divisores, estados vazios/loading alinhados ao kit; evitar animação em cada linha.
    - Verify: testes que referenciem esses componentes; `npm run lint`.

13. **Varredura de emoji/ASCII decorativo em `src/admin`**
    - Files: resultado de busca (ex.: `rg "[\u{1F300}-\u{1F9FF}]|▲|▼|⚠"` em `src/admin`)
    - Change: substituir por Lucide ou texto neutro; manter significado semântico (avisos → `AlertTriangle` + cor `destructive`).
    - Verify: `npm run test -- src/admin`.

14. **Documentação de padrões admin**
    - Files: novo `artifacts/superpowers/admin-ui-design-notes.md` (ou seção no spec em `docs/superpowers/specs/` se o time preferir docs formais)
    - Change: listar tokens usados, padrão de chart, regras de motion e dark mode.
    - Verify: arquivo presente e revisado.

### Risks & mitigations
| Risco | Mitigação |
|--------|-----------|
| Tema global altera percepção de landing/premium inesperadamente | `defaultTheme="light"`; opcionalmente restringir toggle só ao admin na primeira entrega (menos ideal) — preferir tema global com QA nas rotas principais. |
| Recharts ignora `hsl(var(...))` em alguns nós | Testar no browser; fallback com cores resolvidas via `getComputedStyle`. |
| Regressão em testes RTL | Atualizar queries para `getByRole`/`aria-label`; não remover rótulos acessíveis. |
| Bundle maior (`next-themes`) | Dependência pequena; aceitável frente ao ganho de UX. |

### Rollback plan
- Commits atômicos por fase (tema → charts → kit → páginas); revert do último commit da fase que introduzir regressão.
- Se o tema global gerar incidente: remover `ThemeProvider` e toggle, mantendo melhorias puramente visuais em componentes admin.

### Próximo passo (Superpowers)
Após sua aprovação deste plano, executar **`/superpowers-execute-plan`** (ou autorizar explicitamente implementação sem o comando) para começar pelo passo 1.
