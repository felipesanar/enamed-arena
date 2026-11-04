import { useEffect, useRef, useState } from 'react';

const thresholds = [300, 120, 60, 30, 10, 0];
function remaining(seconds: number) {
  if (seconds <= 0) return 'Tempo esgotado.';
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  const parts = [minutes ? `${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}` : '', rest ? `${rest} ${rest === 1 ? 'segundo' : 'segundos'}` : ''].filter(Boolean);
  return `Tempo restante: ${parts.join(' e ')}.`;
}

export function ExamTimerAnnouncement({ timeRemaining }: { timeRemaining: number }) {
  const previous = useRef<number | null>(null);
  const announced = useRef(new Set<number>());
  const [message, setMessage] = useState('');
  useEffect(() => {
    const current = Math.max(0, Math.floor(timeRemaining));
    if (!Number.isFinite(current)) return;
    if (previous.current === null) {
      setMessage(remaining(current));
      thresholds.filter(t => t >= current).forEach(t => announced.current.add(t));
    } else {
      const crossed = thresholds.filter(t => previous.current! > t && current <= t && !announced.current.has(t));
      crossed.forEach(t => announced.current.add(t));
      // A suspended tab may cross several thresholds: announce only the latest.
      if (crossed.length) setMessage(remaining(current));
    }
    previous.current = current;
  }, [timeRemaining]);
  return <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">{message}</span>;
}
