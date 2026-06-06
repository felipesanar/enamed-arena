/**
 * RevealPanel
 *
 * Prof. San card shown in phases 'revealed' and 'self_grade'.
 * Reuses the exact rendering logic from CadernoRevisaoPage (production).
 * Includes: avatar, AI review markdown, practice CTA, chat.
 */

import { useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import {
  Sparkles,
  Loader2,
  RefreshCw,
  ChevronRight,
  Zap,
  MessageCircle,
  Send,
  Volume2,
  VolumeX,
} from 'lucide-react';
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
    trackEvent('caderno_tts_played', {
      entry_id: entry.id,
      area: entry.area ?? '',
    });
    speak(reviewData.aiReviewMd);
  }

  // Stop TTS when the current entry/question changes
  useEffect(() => {
    stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.id]);

  // Focus chat textarea when chat opens
  useEffect(() => {
    if (chatOpen) {
      requestAnimationFrame(() => chatTextareaRef.current?.focus());
    }
  }, [chatOpen]);

  // Scroll chat to bottom on new messages
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const practice = reviewData.aiPractice;
  const topic = practice?.topic ?? entry.theme ?? entry.area ?? null;
  const count = practice?.suggestedCount ?? 5;

  return (
    <div
      className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[0.04] to-primary/[0.08] p-5 md:p-6"
      aria-live="polite"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="relative shrink-0">
            <div className="rounded-full bg-primary/[0.04] border-2 border-background shadow-sm overflow-hidden">
              <ProfSanorAvatar size={48} animated={generatingAi} />
            </div>
            <span
              className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-success border-2 border-background"
              aria-hidden
            />
          </div>
          <div>
            <h3 className="text-heading-3 font-bold text-primary tracking-tight">Prof. San</h3>
            <p className="text-caption text-muted-foreground mt-0.5">
              {generatingAi ? 'Prof. San pensando…' : 'Análise personalizada dessa questão.'}
            </p>
          </div>
        </div>

        {reviewData.aiReviewMd && (
          <div className="flex items-center gap-2 flex-wrap">
            {/* Botão TTS — oculto se Web Speech API não estiver disponível */}
            {ttsSupported && (
              <button
                type="button"
                onClick={handleTtsToggle}
                aria-label={isSpeaking ? 'Parar leitura em voz alta' : 'Ouvir análise em voz alta'}
                aria-pressed={isSpeaking}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[12px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  isSpeaking
                    ? 'border-primary/40 bg-primary/[0.08] text-primary'
                    : 'border-border bg-card text-foreground hover:bg-muted',
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

      {/* Skeleton while generating */}
      {!reviewData.aiReviewMd && generatingAi && (
        <div className="mt-5 space-y-3 motion-safe:animate-pulse">
          <div className="h-3 w-3/4 rounded bg-primary/10" />
          <div className="h-3 w-full rounded bg-primary/10" />
          <div className="h-3 w-5/6 rounded bg-primary/10" />
          <div className="h-3 w-2/3 rounded bg-primary/10" />
        </div>
      )}

      {/* Generate CTA when no AI and not generating */}
      {!reviewData.aiReviewMd && !generatingAi && (
        <div className="mt-5">
          <Button onClick={() => onGenerateAi(false)} className="!text-white">
            <Sparkles className="h-4 w-4 mr-2" aria-hidden />
            Gerar análise
          </Button>
        </div>
      )}

      {/* AI Markdown content */}
      {reviewData.aiReviewMd && (
        <>
          <div className="prose prose-sm max-w-none mt-5 text-foreground prose-headings:text-foreground prose-headings:font-semibold prose-h3:text-[15px] prose-h3:mt-4 prose-h3:mb-2 prose-p:text-body prose-p:text-muted-foreground prose-li:text-body prose-li:text-muted-foreground prose-strong:text-foreground">
            <ReactMarkdown>{reviewData.aiReviewMd}</ReactMarkdown>
          </div>

          {/* Practice CTA */}
          {topic && (
            <Link
              to={(() => {
                const params = new URLSearchParams();
                if (practice?.area ?? entry.area) params.set('area', practice?.area ?? entry.area ?? '');
                if (practice?.theme ?? entry.theme) params.set('theme', practice?.theme ?? entry.theme ?? '');
                if (practice?.topic) params.set('topic', practice.topic);
                return `/simulados?${params.toString()}`;
              })()}
              className="mt-5 inline-flex items-center gap-2 rounded-xl border border-primary/25 bg-primary/[0.04] px-4 py-2.5 text-[13px] font-semibold text-primary transition-all duration-200 hover:border-primary/45 hover:bg-primary/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 no-underline"
            >
              <Zap className="h-3.5 w-3.5" aria-hidden />
              Treinar <span className="font-extrabold tabular-nums">{count}</span>{' '}
              questões de <span className="font-extrabold">{topic}</span>
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          )}

          {/* Chat */}
          <div className="mt-5 border-t border-primary/10 pt-4">
            {!chatOpen ? (
              <button
                type="button"
                onClick={() => onChatOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2 text-[12px] font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <MessageCircle className="h-3.5 w-3.5 text-primary" aria-hidden />
                Tirar uma dúvida com o Prof. San
              </button>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-overline font-bold uppercase tracking-wider text-muted-foreground">
                    Conversa com o Prof. San
                  </p>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums',
                        (reviewData.chatCount ?? 0) >= CHAT_LIMIT
                          ? 'bg-destructive/10 text-destructive'
                          : (reviewData.chatCount ?? 0) >= CHAT_LIMIT - 2
                            ? 'bg-warning/10 text-warning'
                            : 'bg-muted text-muted-foreground',
                      )}
                      title="Perguntas usadas nesta questão"
                    >
                      {reviewData.chatCount ?? 0}/{CHAT_LIMIT}
                    </span>
                    <button
                      type="button"
                      onClick={() => onChatOpen(false)}
                      className="text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                    >
                      Fechar
                    </button>
                  </div>
                </div>

                {chatMessages.length === 0 && !chatLoading && (
                  <p className="text-caption text-muted-foreground italic">
                    Pergunte sobre essa questão ou sobre conteúdo de medicina relacionado. Você tem{' '}
                    <strong className="text-foreground">
                      {Math.max(0, CHAT_LIMIT - (reviewData.chatCount ?? 0))} pergunta
                      {CHAT_LIMIT - (reviewData.chatCount ?? 0) === 1 ? '' : 's'}
                    </strong>{' '}
                    nessa questão.
                  </p>
                )}

                <div
                  className="space-y-2 max-h-[320px] overflow-y-auto pr-1"
                  aria-live="polite"
                  aria-label="Conversa com Prof. San"
                >
                  {chatMessages.map((m, i) => (
                    <div
                      key={i}
                      className={cn(
                        'rounded-xl px-3 py-2 text-[13px] leading-relaxed',
                        m.role === 'user'
                          ? 'ml-6 bg-primary/[0.08] text-foreground'
                          : 'mr-6 border border-border bg-card text-foreground',
                      )}
                    >
                      {m.role === 'assistant' ? (
                        <div className="prose prose-sm max-w-none prose-p:my-1 prose-p:text-[13px] prose-strong:text-foreground prose-li:text-[13px]">
                          <ReactMarkdown>{m.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <p>{m.content}</p>
                      )}
                    </div>
                  ))}
                  {chatLoading && (
                    <div className="mr-6 rounded-xl border border-border bg-card px-3 py-2">
                      <div className="flex items-center gap-2 text-caption text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                        Prof. San pensando…
                      </div>
                    </div>
                  )}
                  <div ref={chatBottomRef} />
                </div>

                {(reviewData.chatCount ?? 0) >= CHAT_LIMIT ? (
                  <div className="rounded-xl border border-warning/30 bg-warning/[0.06] px-3 py-2.5 text-[12px] text-foreground">
                    <p className="font-semibold">Limite de perguntas atingido</p>
                    <p className="mt-0.5 text-muted-foreground">
                      Você já fez {CHAT_LIMIT} perguntas sobre essa questão. Quando dominar, pode
                      treinar mais com os simulados sugeridos.
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
                        // Esc closes chat
                        if (e.key === 'Escape') {
                          onChatOpen(false);
                        }
                      }}
                      rows={1}
                      maxLength={600}
                      placeholder="Pergunte sobre essa questão…"
                      disabled={chatLoading}
                      className="flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                    />
                    <Button
                      type="submit"
                      size="sm"
                      disabled={chatLoading || !chatInput.trim()}
                      className="!text-white"
                    >
                      <Send className="h-3.5 w-3.5" aria-hidden />
                      <span className="sr-only">Enviar</span>
                    </Button>
                  </form>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
