/**
 * Tema de gráficos admin (Recharts) alinhado a tokens CSS em `src/index.css`.
 * Usa `hsl(var(--token))` para respeitar `:root` e `.dark` automaticamente.
 *
 * Variáveis consumidas: `--border`, `--muted`, `--muted-foreground`, `--card`,
 * `--foreground`, `--primary`, `--success`.
 */
export function getAdminChartTheme() {
  return {
    gridStroke: 'hsl(var(--border))',
    axisTick: { fontSize: 9, fill: 'hsl(var(--muted-foreground))' },
    tooltip: {
      backgroundColor: 'hsl(var(--card))',
      border: '1px solid hsl(var(--border))',
      borderRadius: '8px',
      fontSize: '11px',
      color: 'hsl(var(--foreground))',
    },
    cursorFill: 'hsl(var(--muted) / 0.4)',
    legend: {
      wrapperStyle: {
        fontSize: '10px',
        paddingTop: '8px',
        color: 'hsl(var(--muted-foreground))',
      },
    },
  } as const
}

/** Cores de séries sugeridas (preenchimento de <Bar />) — tokens semânticos */
export const adminChartSeriesColors = {
  primary: 'hsl(var(--primary))',
  success: 'hsl(var(--success))',
  muted: 'hsl(var(--muted-foreground) / 0.45)',
  info: 'hsl(var(--info))',
} as const
