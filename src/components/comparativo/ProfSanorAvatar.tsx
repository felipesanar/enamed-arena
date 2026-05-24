import { cn } from '@/lib/utils';

interface Props {
  size?: number;
  className?: string;
  /** Adiciona um halo animado em volta (estado "pensando" / hover) */
  animated?: boolean;
}

/**
 * Prof. Sanor — avatar circular ilustrado.
 * Rosto estilizado, óculos, expressão neutro-amigável.
 * SVG inline (sem dependência externa).
 */
export function ProfSanorAvatar({ size = 56, className, animated = false }: Props) {
  return (
    <div
      className={cn('relative inline-flex items-center justify-center shrink-0', className)}
      style={{ width: size, height: size }}
      aria-label="Prof. Sanor"
      role="img"
    >
      {animated && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 -m-1 rounded-full bg-primary/15 blur-md animate-pulse"
        />
      )}
      <svg
        viewBox="0 0 64 64"
        width={size}
        height={size}
        xmlns="http://www.w3.org/2000/svg"
        className="relative rounded-full drop-shadow-sm"
      >
        <defs>
          <linearGradient id="sanorBg" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FDF2F4" />
            <stop offset="100%" stopColor="#F9E3E8" />
          </linearGradient>
          <linearGradient id="sanorSkin" x1="0" y1="0" x2="0" y2="64" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#F5C6A5" />
            <stop offset="100%" stopColor="#E5B393" />
          </linearGradient>
          <linearGradient id="sanorHair" x1="0" y1="0" x2="0" y2="64" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#3a1f1a" />
            <stop offset="100%" stopColor="#2a1414" />
          </linearGradient>
          <linearGradient id="sanorCoat" x1="0" y1="40" x2="0" y2="64" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#f3f3f3" />
          </linearGradient>
        </defs>

        {/* Fundo circular suave */}
        <circle cx="32" cy="32" r="32" fill="url(#sanorBg)" />

        {/* Pescoço */}
        <rect x="27" y="40" width="10" height="8" rx="2" fill="url(#sanorSkin)" />

        {/* Jaleco branco (gola em V) */}
        <path
          d="M14 64 C 14 52, 22 48, 32 48 C 42 48, 50 52, 50 64 Z"
          fill="url(#sanorCoat)"
        />
        <path
          d="M28 48 L 32 56 L 36 48 Z"
          fill="url(#sanorSkin)"
        />
        {/* Botão estetoscópio */}
        <circle cx="40" cy="55" r="1.5" fill="#8B1538" />

        {/* Cabeça */}
        <ellipse cx="32" cy="28" rx="14" ry="15" fill="url(#sanorSkin)" />

        {/* Cabelo (corte clássico, lado) */}
        <path
          d="M19 24 Q 18 14, 32 12 Q 46 14, 45 24 Q 44 19, 38 18 Q 32 17, 26 18 Q 21 19, 19 24 Z"
          fill="url(#sanorHair)"
        />
        {/* Patilhas/franja sutil */}
        <path d="M19 24 Q 22 22, 25 22 Q 23 25, 22 28 Q 20 27, 19 24 Z" fill="url(#sanorHair)" />
        <path d="M45 24 Q 42 22, 39 22 Q 41 25, 42 28 Q 44 27, 45 24 Z" fill="url(#sanorHair)" />

        {/* Sobrancelhas */}
        <path d="M22 25 L 28 25" stroke="#2a1414" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M36 25 L 42 25" stroke="#2a1414" strokeWidth="1.4" strokeLinecap="round" />

        {/* Óculos */}
        <g stroke="#2a1414" strokeWidth="1.4" fill="none">
          <circle cx="25" cy="30" r="4" fill="rgba(255,255,255,0.4)" />
          <circle cx="39" cy="30" r="4" fill="rgba(255,255,255,0.4)" />
          <path d="M29 30 L 35 30" />
        </g>

        {/* Olhos (atrás dos óculos) */}
        <circle cx="25" cy="30" r="1.1" fill="#1a0a0e" />
        <circle cx="39" cy="30" r="1.1" fill="#1a0a0e" />

        {/* Bochechas levemente rosadas */}
        <circle cx="21" cy="34" r="2" fill="#E89098" opacity="0.5" />
        <circle cx="43" cy="34" r="2" fill="#E89098" opacity="0.5" />

        {/* Sorriso leve e calmo */}
        <path
          d="M28 37 Q 32 40, 36 37"
          stroke="#2a1414"
          strokeWidth="1.4"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    </div>
  );
}
