// src/admin/components/ui/AdminTrendChart.tsx
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { cn } from '@/lib/utils'
import { useAdminChartTheme } from '@/admin/hooks/useAdminChartTheme'

interface ChartSeries {
  key: string
  color: string
  label?: string
}

interface BarSeries extends ChartSeries {
  label: string
}

type ChartType = 'bar' | 'line' | 'area'

interface AdminTrendChartProps {
  title: string
  data: any[]
  xKey: string
  type?: ChartType
  bars?: BarSeries[]
  lines?: ChartSeries[]
  areas?: ChartSeries[]
  height?: number
  isLoading?: boolean
  /** Dentro de `AdminPanel` — remove cartão duplicado */
  embedded?: boolean
}

export function AdminTrendChart({
  title,
  data,
  xKey,
  type = 'bar',
  bars = [],
  lines = [],
  areas = [],
  height = 120,
  isLoading,
  embedded,
}: AdminTrendChartProps) {
  const { chart, chartKey } = useAdminChartTheme()

  if (isLoading) {
    return (
      <div
        className={cn(
          'animate-pulse rounded-lg border border-admin-line p-3',
          embedded ? 'border-admin-line/60 bg-admin-raised/20' : 'bg-admin-surface',
        )}
      >
        <div className="h-3 bg-admin-raised rounded w-1/3 mb-3" />
        <div className="bg-admin-raised rounded" style={{ height }} />
      </div>
    )
  }

  const shell = cn(
    'rounded-lg border p-3',
    embedded ? 'border-admin-line/60 bg-admin-raised/15' : 'border-admin-line bg-admin-surface',
  )

  // Séries ativas conforme o tipo (para Legend / formatter compartilhados)
  const series: ChartSeries[] = type === 'line' ? lines : type === 'area' ? areas : bars
  const seriesLabel = (value: string) => series.find(s => s.key === value)?.label ?? value

  const sharedAxes = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke={chart.gridStroke} vertical={false} />
      <XAxis
        dataKey={xKey}
        tick={chart.axisTick}
        axisLine={false}
        tickLine={false}
        tickFormatter={(v: string) => (typeof v === 'string' && v.length > 5 ? v.slice(5) : v)}
      />
      <YAxis tick={chart.axisTick} axisLine={false} tickLine={false} />
      <Tooltip contentStyle={chart.tooltip} cursor={{ fill: chart.cursorFill }} />
      {series.length > 1 && (
        <Legend wrapperStyle={chart.legend.wrapperStyle} formatter={seriesLabel} />
      )}
    </>
  )

  const margin = { top: 4, right: 4, left: -20, bottom: 0 }

  return (
    <div key={chartKey} className={shell}>
      <p className="text-[11px] font-semibold text-admin-text mb-3">{title}</p>
      <ResponsiveContainer width="100%" height={height}>
        {type === 'line' ? (
          <LineChart data={data} margin={margin}>
            {sharedAxes}
            {lines.map(l => (
              <Line
                key={l.key}
                type="monotone"
                dataKey={l.key}
                stroke={l.color}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        ) : type === 'area' ? (
          <AreaChart data={data} margin={margin}>
            {sharedAxes}
            {areas.map(a => (
              <Area
                key={a.key}
                type="monotone"
                dataKey={a.key}
                stroke={a.color}
                fill={a.color}
                fillOpacity={0.15}
                strokeWidth={2}
              />
            ))}
          </AreaChart>
        ) : (
          <BarChart data={data} margin={margin}>
            {sharedAxes}
            {bars.map(b => (
              <Bar key={b.key} dataKey={b.key} fill={b.color} radius={[2, 2, 0, 0]} maxBarSize={32} />
            ))}
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  )
}
