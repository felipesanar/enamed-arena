/**
 * RevealPanel — Fase 3: Prof. San + gabarito comentado.
 *
 * Redesign premium:
 * - Card glass com gradiente wine sutil.
 * - Avatar animado com pulse quando gerando.
 * - Botão TTS integrado ao header.
 * - Chat expandível com bubble design.
 * Preserva toda a integração com useActiveRecallSession.
 */

import { useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Sparkles,
  Loader2,
  RefreshCw,
  MessageCircle,
  Send,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ProfSanorAvatar } from '@/components/comparativo/ProfSanorAvatar';
import { cn } from '@/lib/utils';
import type { EntryReviewData, ChatTurn } from '@/hooks/useActiveRecallSession';
import type { RecallEntry } from '@/hooks/useActiveRecallSession';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';
import { trackEvent } from '@/lib/analytics';

const CHAT_LIMIT = 10;

interface RevealPanelProps {
  entry: RecallEntry;
  reviewData: EntryReviewData;
  generatingAi: boolean;
  chatOpen: boolean;
  chatMessages: ChatTurn[];
  chatInput: string;
  chatLoading: boolean;
  onGenerateAi: (force?: boolean) => Promise<void>;
  onChatOpen: (open: boolean) => void;
  onChatInputChange: (v: string) => void;
  onChatSend: () => Promise<void>;
}

export function RevealPanel({
  entry,
  reviewData,
  generatingAi,
  chatOpen,
  chatMessages,
  chatInput,
  chatLoading,
  onGenerateAi,
  onChatOpen,
  onChatInputChange,
  onChatSend,
}: RevealPanelProps) {
  const chatTextareaRef = useRef<HTMLTextAreaElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const { speak, stop, isSpeaking, isSupported: ttsSupported } = useTextToSpeech();

  function handleTtsToggle() {
    if (isSpeaking) {
      stop();
      return;
    }
    if (!reviewData.aiReviewMd) return;
    trackEvent('caderno_tts_played', { entry_id: entry.id, area: entry.area ?? '' });
    speak(reviewData.aiReviewMd);
  }

  useEffect(() => {
    stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.id]);

  useEffect(() => {
    if (chatOpen) {
      requestAnimationFrame(() => chatTextareaRef.current?.focus());
    }
  }, [chatOpen]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="overflow-hidden rounded-[var(--c-radius-card)] border border-[color-mix(in_srgb,var(--c-wine-500)_20%,transparent)] bg-gradient-to-br from-[color-mix(in_srgb,var(--c-wine-500)_4%,transparent)] to-[color-mix(in_srgb,var(--c-wine-500)_8%,transparent)] shadow-[var(--c-shadow-sm)]"
      aria-live="polite"
    >
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[color-mix(in_srgb,var(--c-wine-500)_10%,transparent)] px-5 py-4">
        {/* Avatar + identity */}
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <div
              className={cn(
                'overflow-hidden rounded-full border-2 border-[var(--c-surface)] shadow-sm',
                generatingAi && 'ring-2 ring-[color-mix(in_srgb,var(--c-wine-500)_30%,transparent)] ring-offset-2 ring-offset-transparent',
              )}
            >
              <ProfSanorAvatar size={44} animated={generatingAi} />
            </div>
            {/* Status dot */}
            <span
              className={cn(
                'absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[var(--c-surface)]',
                generatingAi ? 'animate-pulse bg-amber-400' : 'bg-emerald-400',
              )}
              aria-hidden
            />
          </div>
          <div>
            <p className="text-[14px] font-extrabold leading-none text-[var(--c-wine-500)] tracking-tight">
              Prof. San
            </p>
            <p className="mt-0.5 text-[11px] text-[var(--c-muted)]">
              {generatingAi ? 'Analisando sua resposta…' : 'Análise personalizada desta questão'}
            </p>
          </div>
        </div>

        {/* Actions */}
        {reviewData.aiReviewMd && (
          <div className="flex items-center gap-2 flex-wrap">
            {ttsSupported && (
              <button
                type="button"
                onClick={handleTtsToggle}
                aria-label={isSpeaking ? 'Parar leitura em voz alta' : 'Ouvir análise em voz alta'}
                aria-pressed={isSpeaking}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-[var(--c-radius-control)] border px-3 py-1.5 text-[12px] font-semibold',
                  'transition-all duration-150',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--c-wine-500)_50%,transparent)] focus-visible:ring-offset-2',
                  isSpeaking
                    ? 'border-[color-mix(in_srgb,var(--c-wine-500)_40%,transparent)] bg-[color-mix(in_srgb,var(--c-wine-500)_10%,transparent)] text-[var(--c-wine-500)]'
                    : 'border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-ink)] hover:border-[color-mix(in_srgb,var(--c-wine-500)_30%,transparent)] hover:bg-[color-mix(in_srgb,var(--c-wine-500)_4%,transparent)]',
                )}
              >
                {isSpeaking ? (
                  <VolumeX className="h-3.5 w-3.5" aria-hidden />
                ) : (
                  <Volume2 className="h-3.5 w-3.5" aria-hidden />
                )}
                {isSpeaking ? 'Parar' : 'Ouvir'}
              </button>
            )}

            <Button
              onClick={() => onGenerateAi(true)}
              disabled={generatingAi}
              variant="outline"
              size="sm"
              className="text-[12px]"
            >
              {generatingAi ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" aria-hidden />
                  Gerando…
                </>
              ) : (
                <>
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" aria-hidden />
                  Gerar de novo
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* ── Body ──────────────────────────────────────────────────────────────── */}
      <div className="px-5 py-5">
        {/* Skeleton while generating */}
        {!reviewData.aiReviewMd && generatingAi && (
          <div className="space-y-3 motion-safe:animate-pulse">
            <div className="h-3 w-3/4 rounded bg-[color-mix(in_srgb,var(--c-wine-500)_10%,transparent)]" />
            <div className="h-3 w-full rounded bg-[color-mix(in_srgb,var(--c-wine-500)_10%,transparent)]" />
            <div className="h-3 w-5/6 rounded bg-[color-mix(in_srgb,var(--c-wine-500)_10%,transparent)]" />
            <div className="h-3 w-2/3 rounded bg-[color-mix(in_srgb,var(--c-wine-500)_10%,transparent)]" />
            <div className="h-3 w-4/5 rounded bg-[color-mix(in_srgb,var(--c-wine-500)_10%,transparent)]" />
          </div>
        )}

        {/* Generate CTA */}
        {!reviewData.aiReviewMd && !generatingAi && (
          <Button
            onClick={() => onGenerateAi(false)}
            className="!text-white bg-[linear-gradient(135deg,var(--c-wine-500),var(--c-wine-700))] shadow-[0_4px_14px_-4px_rgba(176,41,74,0.45)] hover:opacity-90"
          >
            <Sparkles className="h-4 w-4 mr-2" aria-hidden />
            Gerar análise com Prof. San
          </Button>
        )}

        {/* AI Markdown */}
        {reviewData.aiReviewMd && (
          <>
            <div className="prose prose-sm max-w-none text-[var(--c-ink)] prose-headings:text-[var(--c-ink)] prose-headings:font-bold prose-h3:text-[14px] prose-h3:mt-4 prose-h3:mb-2 prose-p:text-body prose-p:text-[var(--c-muted)] prose-p:leading-relaxed prose-li:text-body prose-li:text-[var(--c-muted)] prose-strong:text-[var(--c-ink)] prose-strong:font-semibold">
              <ReactMarkdown>{reviewData.aiReviewMd}</ReactMarkdown>
            </div>

            {/* ── Chat ──────────────────────────────────────────────────────── */}
            <div className="mt-5 border-t border-[color-mix(in_srgb,var(--c-wine-500)_10%,transparent)] pt-4">
              {!chatOpen ? (
                <button
                  type="button"
                  onClick={() => onChatOpen(true)}
                  className="inline-flex items-center gap-2 rounded-[var(--c-radius-control)] border border-[var(--c-border)] bg-[var(--c-surface)] px-3.5 py-2 text-[12px] font-semibold text-[var(--c-ink)] transition-all duration-150 hover:border-[color-mix(in_srgb,var(--c-wine-500)_30%,transparent)] hover:bg-[color-mix(in_srgb,var(--c-wine-500)_4%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--c-wine-500)_50%,transparent)] focus-visible:ring-offset-2"
                >
                  <MessageCircle className="h-3.5 w-3.5 text-[var(--c-wine-500)]" aria-hidden />
                  Tirar uma dúvida com o Prof. San
                </button>
              ) : (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  transition={{ duration: 0.22 }}
                  className="space-y-3"
                >
                  {/* Chat header */}
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--c-muted)]">
                      Conversa com Prof. San
                    </p>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'rounded-[var(--c-radius-pill)] px-2 py-0.5 text-[10px] font-bold tabular-nums',
                          (reviewData.chatCount ?? 0) >= CHAT_LIMIT
                            ? 'bg-destructive/10 text-destructive'
                            : (reviewData.chatCount ?? 0) >= CHAT_LIMIT - 2
                            ? 'bg-amber-500/10 text-amber-600'
                            : 'bg-[var(--c-surface-2)] text-[var(--c-muted)]',
                        )}
                      >
                        {reviewData.chatCount ?? 0}/{CHAT_LIMIT}
                      </span>
                      <button
                        type="button"
                        onClick={() => onChatOpen(false)}
                        aria-label="Fechar chat"
                        className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--c-muted)] transition-colors hover:text-[var(--c-ink)]"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </div>
                  </div>

                  {chatMessages.length === 0 && !chatLoading && (
                    <p className="text-caption italic text-[var(--c-muted)]">
                      Pergunte sobre essa questão ou sobre conteúdo relacionado. Você tem{' '}
                      <strong className="text-[var(--c-ink)]">
                        {Math.max(0, CHAT_LIMIT - (reviewData.chatCount ?? 0))} pergunta
                        {CHAT_LIMIT - (reviewData.chatCount ?? 0) === 1 ? '' : 's'}
                      </strong>{' '}
                      restantes nessa questão.
                    </p>
                  )}

                  {/* Messages */}
                  <div
                    className="max-h-[320px] space-y-2 overflow-y-auto pr-1"
                    aria-live="polite"
                    aria-label="Conversa com Prof. San"
                  >
                    {chatMessages.map((m, i) => (
                      <div
                        key={i}
                        className={cn(
                          'rounded-[var(--c-radius-control)] px-3 py-2.5 text-[13px] leading-relaxed',
                          m.role === 'user'
                            ? 'ml-8 bg-[color-mix(in_srgb,var(--c-wine-500)_8%,transparent)] text-[var(--c-ink)]'
                            : 'mr-8 border border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-ink)]',
                        )}
                      >
                        {m.role === 'assistant' ? (
                          <div className="prose prose-sm max-w-none prose-p:my-1 prose-p:text-[13px] prose-strong:text-[var(--c-ink)] prose-li:text-[13px]">
                            <ReactMarkdown>{m.content}</ReactMarkdown>
                          </div>
                        ) : (
                          <p>{m.content}</p>
                        )}
                      </div>
                    ))}

                    {chatLoading && (
                      <div className="mr-8 rounded-[var(--c-radius-control)] border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-2.5">
                        <div className="flex items-center gap-2 text-caption text-[var(--c-muted)]">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                          Prof. San pensando…
                        </div>
                      </div>
                    )}
                    <div ref={chatBottomRef} />
                  </div>

                  {/* Limit reached */}
                  {(reviewData.chatCount ?? 0) >= CHAT_LIMIT ? (
                    <div className="rounded-[var(--c-radius-control)] border border-amber-400/30 bg-amber-500/[0.06] px-3.5 py-3 text-[12px]">
                      <p className="font-semibold text-[var(--c-ink)]">Limite de perguntas atingido</p>
                      <p className="mt-0.5 text-[var(--c-muted)]">
                        Você já fez {CHAT_LIMIT} perguntas sobre essa questão.
                      </p>
                    </div>
                  ) : (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        void onChatSend();
                      }}
                      className="flex items-end gap-2"
                    >
                      <textarea
                        ref={chatTextareaRef}
                        value={chatInput}
                        onChange={(e) => onChatInputChange(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            void onChatSend();
                          }
                          if (e.key === 'Escape') onChatOpen(false);
                        }}
                        rows={1}
                        maxLength={600}
                        placeholder="Pergunte sobre essa questão…"
                        disabled={chatLoading}
                        className="flex-1 resize-none rounded-[var(--c-radius-control)] border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-2 text-[13px] text-[var(--c-ink)] placeholder:text-[var(--c-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--c-wine-500)_40%,transparent)] disabled:opacity-50"
                      />
                      <Button
                        type="submit"
                        size="sm"
                        disabled={chatLoading || !chatInput.trim()}
                        className="!text-white bg-[linear-gradient(135deg,var(--c-wine-500),var(--c-wine-700))]"
                      >
                        <Send className="h-3.5 w-3.5" aria-hidden />
                        <span className="sr-only">Enviar</span>
                      </Button>
                    </form>
                  )}
                </motion.div>
              )}
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}
