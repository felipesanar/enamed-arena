/**
 * Tema de gráficos admin (Recharts) alinhado aos tokens `--admin-*` em `src/index.css`.
 * Usa `hsl(var(--token))` para respeitar light/dark automaticamente.
 */
export function getAdminChartTheme() {
  return {
    gridStroke: 'hsl(var(--admin-line))',
    axisTick: { fontSize: 9, fill: 'hsl(var(--admin-muted))' },
    tooltip: {
      backgroundColor: 'hsl(var(--admin-raised))',
      border: '1px solid hsl(var(--admin-line-strong))',
      borderRadius: '8px',
      fontSize: '11px',
      color: 'hsl(var(--admin-text))',
    },
    cursorFill: 'hsl(var(--admin-raised) / 0.6)',
    legend: {
      wrapperStyle: {
        fontSize: '10px',
        paddingTop: '8px',
        color: 'hsl(var(--admin-muted))',
      },
    },
  } as const
}

/** Cores de séries (ordem: wine, teal, âmbar, azul, neutro) */
export const adminChartSeriesColors = {
  primary: 'hsl(var(--admin-accent))',
  success: 'hsl(var(--admin-success))',
  warning: 'hsl(var(--admin-warning))',
  info: 'hsl(var(--admin-info))',
  muted: 'hsl(var(--admin-muted) / 0.45)',
} as const
