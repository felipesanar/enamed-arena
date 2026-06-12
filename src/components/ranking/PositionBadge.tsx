import React from 'react';
import { cn } from '@/lib/utils';

interface Props {
  position: number;
  isCurrentUser?: boolean;
}

const medals: Record<number, { cls: string; label: string }> = {
  1: { cls: 'bg-warning/15 text-warning', label: '1º lugar' },
  2: { cls: 'bg-muted text-muted-foreground', label: '2º lugar' },
  3: { cls: 'bg-warning/10 text-warning/80', label: '3º lugar' },
};

export function PositionBadge({ position, isCurrentUser }: Props) {
  const medal = medals[position];
  return (
    <div
      className={cn(
        'h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
        isCurrentUser ? 'bg-primary/15 text-primary' : medal ? medal.cls : 'bg-muted text-muted-foreground',
      )}
      aria-label={isCurrentUser ? `${position}ª posição (você)` : medal?.label}
    >
      {position}
    </div>
  );
}
