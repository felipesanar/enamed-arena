import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Typewriter compartilhado do Prof. San.
 * API imperativa: `write(text)` anima; `write(text, { animate: false })` mostra
 * direto (restauração de cache); `skip()` completa na hora (clique na bolha).
 */
export function useTypewriter(initial: string | null = null, charsPerTick = 4, tickMs = 24) {
  const [display, setDisplay] = useState<string | null>(initial);
  const targetRef = useRef<string | null>(initial);
  const timerRef = useRef<number | null>(null);

  const clear = useCallback(() => {
    if (timerRef.current != null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => clear, [clear]);

  const write = useCallback(
    (text: string | null, opts?: { animate?: boolean }) => {
      clear();
      targetRef.current = text;
      if (!text || opts?.animate === false) {
        setDisplay(text);
        return;
      }
      let cursor = 0;
      setDisplay('');
      timerRef.current = window.setInterval(() => {
        cursor = Math.min(cursor + charsPerTick, text.length);
        setDisplay(text.slice(0, cursor));
        if (cursor >= text.length) clear();
      }, tickMs);
    },
    [charsPerTick, tickMs, clear],
  );

  const skip = useCallback(() => {
    clear();
    setDisplay(targetRef.current);
  }, [clear]);

  return { display, write, skip };
}
