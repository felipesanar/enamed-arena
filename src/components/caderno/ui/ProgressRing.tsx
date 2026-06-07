import * as React from "react";
import { cn } from "@/lib/utils";

export interface ProgressRingProps extends React.SVGAttributes<SVGSVGElement> {
  /** Valor 0–100. */
  value: number;
  /** Tamanho do SVG em px (diâmetro). Default: 64. */
  size?: number;
  /** Espessura do traço. Default: 5. */
  strokeWidth?: number;
  /** Conteúdo central (ex: porcentagem). */
  children?: React.ReactNode;
  /** Cor de preenchimento. Default: gradiente wine. */
  color?: string;
}

/**
 * Anel de progresso circular com gradiente wine.
 * Suporta conteúdo central via `children`.
 */
export const ProgressRing = React.forwardRef<SVGSVGElement, ProgressRingProps>(
  (
    {
      value,
      size = 64,
      strokeWidth = 5,
      children,
      color,
      className,
      ...props
    },
    ref,
  ) => {
    const pct = Math.min(100, Math.max(0, value));
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (pct / 100) * circumference;
    const gradId = React.useId();

    return (
      <div className={cn("relative inline-flex items-center justify-center", className)}>
        <svg
          ref={ref}
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          role="progressbar"
          {...props}
        >
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={color ?? "#B0294A"} />
              <stop offset="100%" stopColor={color ? color : "#7A1A32"} />
            </linearGradient>
          </defs>
          {/* Trilha */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--c-border, #ECE5E3)"
            strokeWidth={strokeWidth}
          />
          {/* Preenchimento */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color ? color : `url(#${gradId})`}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{
              transition: `stroke-dashoffset var(--c-duration-slow, 320ms) var(--c-ease-standard, cubic-bezier(0.22,1,0.36,1))`,
            }}
          />
        </svg>
        {children && (
          <span className="absolute inset-0 flex items-center justify-center">
            {children}
          </span>
        )}
      </div>
    );
  },
);
ProgressRing.displayName = "ProgressRing";

export interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Valor 0–100. */
  value: number;
  /** Cor da barra. Default: gradiente wine. */
  color?: string;
  /** Label a11y. */
  label?: string;
}

/**
 * Barra de progresso horizontal com gradiente wine.
 */
export const ProgressBar = React.forwardRef<HTMLDivElement, ProgressBarProps>(
  ({ value, color, label, className, ...props }, ref) => {
    const pct = Math.min(100, Math.max(0, value));

    return (
      <div
        ref={ref}
        className={cn("h-2 w-full overflow-hidden rounded-full bg-[var(--c-surface-2)]", className)}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? `Progresso: ${pct}%`}
        {...props}
      >
        <div
          className="h-full rounded-full transition-all duration-[var(--c-duration-slow)] ease-[var(--c-ease-standard)]"
          style={{
            width: `${pct}%`,
            background: color ?? "linear-gradient(135deg, #B0294A, #7A1A32)",
          }}
        />
      </div>
    );
  },
);
ProgressBar.displayName = "ProgressBar";
