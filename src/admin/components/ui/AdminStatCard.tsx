// src/admin/components/ui/AdminStatCard.tsx
import { Minus, TrendingDown, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AdminStatCardProps {
  label: string
  value: string | number
  delta?: number
  deltaLabel?: string
  accentBorder?: boolean
  isLoading?: boolean
  /** Quando true, delta positivo é tratado como ruim (vermelho) e negativo como bom
   *  (verde) — para métricas em que "subir é pior", como taxa de abandono. */
  invertDelta?: boolean
  /** Cor opcional do valor (ex.: 'accent' para Aluno PRO, 'success' para Novos). */
  valueTone?: 'default' | 'accent' | 'success' | 'warning' | 'info' | 'destructive'
}

const VALUE_TONE: Record<NonNullable<AdminStatCardProps['valueTone']>, string> = {
  default: 'text-admin-text',
  accent: 'text-admin-accent',
  success: 'text-admin-success',
  warning: 'text-admin-warning',
  info: 'text-admin-info',
  destructive: 'text-admin-destructive',
}

export function AdminStatCard({
  label,
  value,
  delta,
  deltaLabel,
  accentBorder,
  isLoading,
  invertDelta,
  valueTone = 'default',
}: AdminStatCardProps) {
  if (isLoading) {
    return (
      <div className="animate-pulse rounded-xl border border-admin-line/80 bg-admin-surface p-4 shadow-sm shadow-black/[0.03] dark:shadow-black/20">
        <div className="relative mb-3 h-2.5 w-2/3 overflow-hidden rounded bg-admin-raised">
          <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.4s_infinite] bg-gradient-to-r from-transparent via-admin-surface/70 to-transparent" />
        </div>
        <div className="relative mb-2 h-6 w-1/2 overflow-hidden rounded bg-admin-raised">
          <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.4s_infinite] bg-gradient-to-r from-transparent via-admin-surface/70 to-transparent" />
        </div>
        <div className="relative h-2.5 w-1/3 overflow-hidden rounded bg-admin-raised">
          <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.4s_infinite] bg-gradient-to-r from-transparent via-admin-surface/70 to-transparent" />
        </div>
      </div>
    )
  }

  const isUp = delta !== undefined && delta > 0
  const isDown = delta !== undefined && delta < 0
  // Direção visual (cor): por padrão subir = bom. invertDelta troca a semântica de cor,
  // mantendo a seta apontando para a direção real da variação.
  const isGood = invertDelta ? isDown : isUp
  const isBad = invertDelta ? isUp : isDown

  return (
    <div
      className={cn(
        'group rounded-xl border border-admin-line/80 bg-admin-surface p-4',
        'shadow-sm shadow-black/[0.04] dark:shadow-black/25',
        'transition-[border-color,box-shadow] duration-[160ms] ease-out motion-reduce:transition-none',
        'hover:border-admin-line-strong hover:shadow-[0_4px_16px_rgba(26,23,21,0.06)] dark:hover:shadow-black/40',
        accentBorder && 'border-l-[3px] border-l-admin-accent',
      )}
    >
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-admin-muted">{label}</p>
      <p
        className={cn(
          'mb-1.5 text-[1.4375rem] font-extrabold leading-none tabular-nums tracking-tight',
          VALUE_TONE[valueTone],
        )}
      >
        {value}
      </p>
      {delta !== undefined ? (
        <p
          className={cn(
            'flex items-center gap-1 text-caption',
            isGood && 'text-admin-success',
            isBad && 'text-admin-destructive',
            !isGood && !isBad && 'text-admin-muted',
          )}
        >
          {isUp && (
            <>
              <TrendingUp className="h-3 w-3 shrink-0" aria-hidden />
              <span>+{delta}</span>
            </>
          )}
          {isDown && (
            <>
              <TrendingDown className="h-3 w-3 shrink-0" aria-hidden />
              <span>−{Math.abs(delta)}</span>
            </>
          )}
          {!isUp && !isDown && (
            <>
              <Minus className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
              <span>{Math.abs(delta)}</span>
            </>
          )}
          {deltaLabel && <span className="font-normal text-admin-muted">{deltaLabel}</span>}
        </p>
      ) : null}
    </div>
  )
}
