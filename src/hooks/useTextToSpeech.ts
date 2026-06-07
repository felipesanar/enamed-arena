/**
 * useTextToSpeech
 *
 * Abstração sobre window.speechSynthesis para leitura em voz alta (TTS).
 * Locale pt-BR (prefere voz pt-BR se disponível no dispositivo).
 * Remove formatação markdown antes de falar.
 * Para a fala anterior ao iniciar nova; cancela no unmount.
 */

import { useState, useEffect, useRef, useCallback } from 'react';

/** Remove marcadores markdown para que o TTS leia texto limpo. */
function stripMarkdown(text: string): string {
  return text
    // Cabeçalhos
    .replace(/^#{1,6}\s+/gm, '')
    // Negrito e itálico (***text***, **text**, *text*, ___text___, __text__, _text_)
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
    .replace(/_{1,3}([^_]+)_{1,3}/g, '$1')
    // Código inline
    .replace(/`([^`]+)`/g, '$1')
    // Blocos de código
    .replace(/```[\s\S]*?```/g, '')
    // Links: [texto](url) → texto
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    // Imagens: ![alt](url) → ''
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    // Linhas horizontais
    .replace(/^[-*_]{3,}\s*$/gm, '')
    // Blockquotes
    .replace(/^>\s+/gm, '')
    // Listas: -, *, +, 1.
    .replace(/^[\s]*[-*+]\s+/gm, '')
    .replace(/^[\s]*\d+\.\s+/gm, '')
    // Espaços extras
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export interface UseTextToSpeechReturn {
  /** Lê o texto fornecido. Cancela fala anterior se houver. */
  speak: (text: string) => void;
  /** Para imediatamente qualquer fala em curso. */
  stop: () => void;
  /** true enquanto speechSynthesis está falando. */
  isSpeaking: boolean;
  /** false quando a Web Speech API não está disponível no browser. */
  isSupported: boolean;
}

export function useTextToSpeech(): UseTextToSpeechReturn {
  const isSupported =
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof window.SpeechSynthesisUtterance !== 'undefined';

  const [isSpeaking, setIsSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  /** Escolhe a melhor voz pt-BR disponível. */
  const pickVoice = useCallback((): SpeechSynthesisVoice | null => {
    if (!isSupported) return null;
    const voices = window.speechSynthesis.getVoices();
    // Preferência: pt-BR → pt → qualquer voz disponível (fallback silencioso)
    return (
      voices.find((v) => v.lang === 'pt-BR') ??
      voices.find((v) => v.lang.startsWith('pt')) ??
      null
    );
  }, [isSupported]);

  const stop = useCallback(() => {
    if (!isSupported) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, [isSupported]);

  const speak = useCallback(
    (text: string) => {
      if (!isSupported) return;

      // Cancela fala anterior
      window.speechSynthesis.cancel();

      const clean = stripMarkdown(text);
      if (!clean) return;

      const utterance = new window.SpeechSynthesisUtterance(clean);
      utterance.lang = 'pt-BR';
      utterance.rate = 1;
      utterance.pitch = 1;

      const voice = pickVoice();
      if (voice) {
        utterance.voice = voice;
      }

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    },
    [isSupported, pickVoice],
  );

  // Cancela fala ao desmontar o componente que usa o hook
  useEffect(() => {
    return () => {
      if (isSupported) {
        window.speechSynthesis.cancel();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Alguns browsers (Chrome) pausam o synth quando a aba perde foco — reativa se necessário
  useEffect(() => {
    if (!isSupported) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isSupported]);

  return { speak, stop, isSpeaking, isSupported };
}
