import React from 'react';

interface Props {
  position: number;
  isCurrentUser?: boolean;
  isDark: boolean;
}

export function PositionBadge({ position, isCurrentUser, isDark }: Props) {
  if (isCurrentUser) {
    return (
      <div
        className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
        style={{ background: 'rgba(255,150,170,0.15)', color: '#ff9ab0' }}
        aria-label={`${position}ª posição (você)`}
      >
        {position}
      </div>
    );
  }
  const medals: Record<number, { bg: string; color: string; label: string }> = {
    1: { bg: 'rgba(251,191,36,0.15)', color: '#fbbf24', label: '1º lugar' },
    2: { bg: 'rgba(156,163,175,0.15)', color: '#9ca3af', label: '2º lugar' },
    3: { bg: 'rgba(180,83,9,0.15)', color: '#d97706', label: '3º lugar' },
  };
  const medal = medals[position];
  return (
    <div
      className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
      style={
        medal
          ? { background: medal.bg, color: medal.color }
          : isDark
          ? { background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.45)' }
          : { background: 'rgba(0,0,0,0.07)', color: 'rgba(0,0,0,0.45)' }
      }
      aria-label={medal?.label}
    >
      {position}
    </div>
  );
}
