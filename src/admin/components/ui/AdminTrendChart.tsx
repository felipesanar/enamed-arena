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

interface BarSeries {
  key: string
  color: string
  label: string
}

interface AdminTrendChartProps {
  title: string
  data: Record<string, unknown>[] | readonly Record<string, unknown>[]
  xKey: string
  bars: BarSeries[]
  height?: number
  isLoading?: boolean
}

export function AdminTrendChart({
  title,
  data,
  xKey,
  bars,
  height = 120,
  isLoading,
}: AdminTrendChartProps) {
  if (isLoading) {
    return (
      <div className="bg-card rounded-lg border border-border p-3 animate-pulse">
        <div className="h-3 bg-muted rounded w-1/3 mb-3" />
        <div className="bg-muted rounded" style={{ height }} />
      </div>
    )
  }

  return (
    <div className="bg-card rounded-lg border border-border p-3">
      <p className="text-[11px] font-semibold text-foreground mb-3">{title}</p>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis
            dataKey={xKey}
            tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: string) => v.slice(5)}
          />
          <YAxis
            tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '6px',
              fontSize: '11px',
              color: 'hsl(var(--foreground))',
            }}
            cursor={{ fill: 'hsl(var(--muted))' }}
          />
          {bars.length > 1 && (
            <Legend
              wrapperStyle={{ fontSize: '10px', paddingTop: '8px' }}
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
