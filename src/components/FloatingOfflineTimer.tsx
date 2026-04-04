/**
 * FloatingOfflineTimer
 *
 * Persistent countdown chip rendered at root layout level (App.tsx).
 * Visible only when there is an active offline_pending attempt.
 *
 * Color states:
 *   normal  → wine  (> 30 min)
 *   warning → amber (≤ 30 min)
 *   urgent  → red   (≤ 10 min)
 *
 * When timer hits zero: auto-navigates to /simulados/:slug/gabarito.
 */
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useOfflineAttempt } from '@/hooks/useOfflineAttempt';
import { logger } from '@/lib/logger';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatHms(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}h ${String(m).padStart(2, '0')}m`;
  }
  return `${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
}

function chipBg(remaining: number): string {
  if (remaining <= 600)  return '#dc2626';          // red ≤ 10 min
  if (remaining <= 1800) return '#d97706';          // amber ≤ 30 min
  return 'hsl(345, 65%, 28%)';                      // wine (brand dark)
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FloatingOfflineTimer() {
  const navigate = useNavigate();
  const { activeAttempt, remaining, isExpired } = useOfflineAttempt();
  const [open, setOpen] = useState(false);
  const navigatedRef = useRef(false);

  // Auto-navigate to gabarito when time expires
  useEffect(() => {
    if (isExpired && activeAttempt?.simulado_slug && !navigatedRef.current) {
      navigatedRef.current = true;
      logger.log('[FloatingOfflineTimer] Time up — navigating to gabarito');
      navigate(`/simulados/${activeAttempt.simulado_slug}/gabarito`);
    }
  }, [isExpired, activeAttempt, navigate]);

  if (!activeAttempt) return null;

  const bg = chipBg(remaining);

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-lg transition-opacity hover:opacity-90 active:opacity-80"
            style={{
              background: bg,
              border: '1px solid rgba(255,255,255,.15)',
            }}
          >
            <Timer className="h-4 w-4 shrink-0" />
            <span className="tabular-nums">
              Offline · {formatHms(remaining)}
            </span>
          </button>
        </PopoverTrigger>

        <PopoverContent align="end" sideOffset={8} className="w-64 p-4">
          <p className="text-body font-semibold text-foreground mb-0.5">
            Prova Offline
          </p>
          <p className="text-caption text-muted-foreground mb-3">
            Tempo restante:{' '}
            <span className="font-mono font-semibold text-foreground">
              {formatHms(remaining)}
            </span>
          </p>
          {activeAttempt.simulado_slug && (
            <Button
              size="sm"
              className="w-full"
              onClick={() => {
                setOpen(false);
                navigate(`/simulados/${activeAttempt.simulado_slug}/gabarito`);
              }}
            >
              Preencher gabarito
            </Button>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
