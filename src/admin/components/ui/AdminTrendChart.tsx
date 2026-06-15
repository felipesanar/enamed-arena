// src/admin/components/ui/AdminTrendChart.tsx
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { cn } from '@/lib/utils'
import { useAdminChartTheme } from '@/admin/hooks/useAdminChartTheme'

interface BarSeries {
  key: string
  color: string
  label: string
}

interface AdminTrendChartProps {
  title: string
  data: any[]
  xKey: string
  bars: BarSeries[]
  height?: number
  isLoading?: boolean
  /** Dentro de `AdminPanel` — remove cartão duplicado */
  embedded?: boolean
}

export function AdminTrendChart({
  title,
  data,
  xKey,
  bars,
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

  return (
    <div key={chartKey} className={shell}>
      <p className="text-[11px] font-semibold text-admin-text mb-3">{title}</p>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={chart.gridStroke} vertical={false} />
          <XAxis
            dataKey={xKey}
            tick={chart.axisTick}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: string) => v.slice(5)}
          />
          <YAxis tick={chart.axisTick} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={chart.tooltip} cursor={{ fill: chart.cursorFill }} />
          {bars.length > 1 && (
            <Legend
              wrapperStyle={chart.legend.wrapperStyle}
              formatter={(value) => bars.find(b => b.key === value)?.label ?? value}
            />
          )}
          {bars.map(b => (
            <Bar key={b.key} dataKey={b.key} fill={b.color} radius={[2, 2, 0, 0]} maxBarSize={32} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
