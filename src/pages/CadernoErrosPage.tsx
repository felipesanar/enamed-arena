import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  Zap,
  Check,
  Trash2,
  ExternalLink,
  Flame,
  Sparkles,
  RotateCcw,
  ChevronDown,
} from 'lucide-react';

import { trackEvent } from '@/lib/analytics';
import { logger } from '@/lib/logger';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

import { PageTransition, StaggerContainer, StaggerItem } from '@/components/premium/PageTransition';
import { PageHeader } from '@/components/PageHeader';
import { ProGate } from '@/components/ProGate';
import { EmptyState } from '@/components/EmptyState';
import { SkeletonCard } from '@/components/SkeletonCard';

import { useUser } from '@/contexts/UserContext';
import { useAuth } from '@/contexts/AuthContext';
import { simuladosApi } from '@/services/simuladosApi';
import { SEGMENT_ACCESS } from '@/types';
import { getReasonMeta, type DbReason } from '@/lib/errorNotebookReasons';

/* ──────────────────────────────────────────────────────────────────────────
 * Types
 * ────────────────────────────────────────────────────────────────────────── */

interface NotebookEntry {
  id: string;
  questionId: string | null;
  simuladoId: string | null;
  simuladoTitle: string | null;
  area: string | null;
  theme: string | null;
  questionNumber: number | null;
  reason: string;
  learningNote: string | null;
  wasCorrect: boolean;
  addedAt: string;
  resolvedAt: string | null;
}

type TypeFilter = 'all' | DbReason;

/* ──────────────────────────────────────────────────────────────────────────
 * Helpers
 * ────────────────────────────────────────────────────────────────────────── */

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function calcStreak(entries: NotebookEntry[]): number {
  const dates = new Set(
    entries
      .filter((e) => e.resolvedAt)
      .map((e) => new Date(e.resolvedAt!).toISOString().split('T')[0]),
  );
  if (!dates.size) return 0;
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    if (dates.has(d.toISOString().split('T')[0])) streak++;
    else break;
  }
  return streak;
}

function pluralize(n: number, singular: string, plural: string) {
  return n === 1 ? singular : plural;
}

/* ──────────────────────────────────────────────────────────────────────────
 * CheckButton — pequeno, acessível, usando tokens do sistema
 * ────────────────────────────────────────────────────────────────────────── */

function CheckButton({
  done,
  onToggle,
  label,
}: {
  done: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      aria-pressed={done}
      className={cn(
        'group/check inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] border transition-all duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        done
          ? 'border-success/40 bg-success/15 text-success'
          : 'border-border bg-muted/50 text-muted-foreground hover:border-success/40 hover:bg-success/10 hover:text-success',
      )}
    >
      <Check className="h-3.5 w-3.5" strokeWidth={2.75} aria-hidden />
    </button>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Queue row — padrão content card premium
 * ────────────────────────────────────────────────────────────────────────── */

function QueueRow({
  entry,
  onRemove,
  onToggleResolved,
}: {
  entry: NotebookEntry;
  onRemove: (id: string) => void;
  onToggleResolved: (id: string, resolved: boolean) => void;
}) {
  const meta = getReasonMeta(entry.reason);
  const resolved = !!entry.resolvedAt;
  const title = `Q${entry.questionNumber ?? '?'} · ${entry.area ?? '—'}${
    entry.theme ? ` — ${entry.theme}` : ''
  }`;

  return (
    <div
      className={cn(
        'group relative flex items-stretch gap-3 rounded-xl border bg-card px-3 py-2.5 transition-all duration-200',
        'border-border hover:border-primary/25 hover:shadow-[0_8px_20px_-14px_hsl(345_65%_30%/0.25)]',
        resolved && 'opacity-60',
      )}
    >
      {/* Accent bar */}
      <div
        aria-hidden
        className="w-[3px] shrink-0 self-stretch rounded-full"
        style={{ background: meta.colorBase }}
      />

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
        <div
          className={cn(
            'truncate text-[13px] font-semibold tracking-[-0.005em] text-foreground',
            resolved && 'line-through decoration-muted-foreground/60',
          )}
        >
          {title}
        </div>
        <div className="truncate text-[11px] text-muted-foreground">
          {resolved && entry.resolvedAt
            ? `Resolvida em ${fmtDate(entry.resolvedAt)}`
            : `${entry.simuladoTitle ?? 'Simulado'} · ${fmtDate(entry.addedAt)}`}
        </div>
      </div>

      {/* Type chip */}
      <span
        className="hidden shrink-0 items-center self-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide sm:inline-flex"
        style={{
          background: meta.colorBg,
          color: meta.colorText,
          borderColor: meta.colorBorder,
        }}
      >
        {meta.badge}
      </span>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1.5 self-center">
        <CheckButton
          done={resolved}
          onToggle={() => onToggleResolved(entry.id, !resolved)}
          label={`Marcar questão ${entry.questionNumber ?? ''} como ${
            resolved ? 'pendente' : 'resolvida'
          }`}
        />
        <button
          type="button"
          onClick={() => onRemove(entry.id)}
          title="Remover do caderno"
          aria-label={`Remover questão ${entry.questionNumber ?? ''} do caderno`}
          className="inline-flex h-7 w-7 items-center justify-center rounded-[8px] text-muted-foreground/70 transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * NextUpCard — "Próxima para revisar" (card premium claro com acento wine)
 * ────────────────────────────────────────────────────────────────────────── */

function NextUpCard({
  entry,
  onRemove,
  onToggleResolved,
}: {
  entry: NotebookEntry;
  onRemove: (id: string) => void;
  onToggleResolved: (id: string, resolved: boolean) => void;
}) {
  const meta = getReasonMeta(entry.reason);

  return (
    <div className="premium-card-hero relative overflow-hidden rounded-[20px] p-5 md:p-6">
      {/* Left accent bar — wine gradient */}
      <div
        aria-hidden
        className="absolute inset-y-0 left-0 w-[3px] bg-gradient-to-b from-primary to-wine-hover"
      />
      {/* Subtle wine glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/[0.05] blur-2xl"
      />

      <div className="relative">
        {/* Top row: title + type chip */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-bold tracking-[-0.01em] text-foreground md:text-[16px]">
              Q{entry.questionNumber ?? '?'} · {entry.area ?? '—'}
              {entry.theme ? ` — ${entry.theme}` : ''}
            </p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              {entry.simuladoTitle ?? 'Simulado'} · {fmtDate(entry.addedAt)}
            </p>
          </div>
          <span
            className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide"
            style={{
              background: meta.colorBg,
              color: meta.colorText,
              borderColor: meta.colorBorder,
            }}
          >
            <span
              aria-hidden
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: meta.colorBase }}
            />
            {meta.badge}
          </span>
        </div>

        {/* Learning note */}
        {entry.learningNote && (
          <div className="mt-4 rounded-xl border border-border/60 bg-muted/40 p-3">
            <p className="text-overline font-semibold uppercase text-muted-foreground">
              Sua anotação
            </p>
            <p className="mt-1 text-[13px] italic leading-relaxed text-foreground/90">
              {entry.learningNote}
            </p>
          </div>
        )}

        {/* Review strategy */}
        {meta.strategy && (
          <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-primary/15 bg-primary/[0.04] p-3">
            <div className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Sparkles className="h-3 w-3 text-primary" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-overline font-semibold uppercase text-primary">
                Como revisar
              </p>
              <p className="mt-0.5 text-[13px] font-medium leading-snug text-foreground">
                {meta.strategy}
              </p>
            </div>
          </div>
        )}

        {/* Footer actions */}
        <div className="mt-5 flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onToggleResolved(entry.id, true)}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground shadow-[0_4px_14px_-4px_hsl(345_65%_30%/0.4)] transition-all duration-200 hover:bg-wine-hover hover:shadow-[0_6px_18px_-4px_hsl(345_65%_30%/0.5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.99] sm:flex-none"
            >
              <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden />
              Marcar como resolvida
            </button>
            <button
              type="button"
              onClick={() => onRemove(entry.id)}
              title="Remover do caderno"
              aria-label="Remover do caderno"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground/70 transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </button>
          </div>

          {entry.simuladoId && entry.questionNumber && (
            <Link
              to={`/simulados/${entry.simuladoId}/correcao?q=${entry.questionNumber}`}
              className="inline-flex items-center justify-center gap-1.5 text-[12px] font-semibold text-muted-foreground transition-colors hover:text-primary no-underline"
            >
              Ver questão completa
              <ExternalLink className="h-3 w-3" aria-hidden />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * HeroStatusCard — bloco dark premium, idioma da HomeHeroPerformanceCard
 * ────────────────────────────────────────────────────────────────────────── */

function HeroStatusCard({
  pending,
  resolved,
  total,
  specialties,
  streak,
  prefersReducedMotion,
}: {
  pending: number;
  resolved: number;
  total: number;
  specialties: number;
  streak: number;
  prefersReducedMotion: boolean;
}) {
  const progressPct = total === 0 ? 0 : Math.round((resolved / total) * 100);

  return (
    <div className="relative overflow-hidden rounded-[22px] border border-white/[0.07] bg-[linear-gradient(148deg,#0C1220_0%,#11192A_38%,#2E0C1E_72%,#3F1028_100%)] p-4 md:p-6 shadow-[0_20px_40px_-20px_rgba(10,14,26,0.85),0_8px_20px_-12px_rgba(60,12,32,0.45)]">
      {/* Atmospheric layers */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-14 -top-14 h-48 w-48 rounded-full bg-[rgba(232,56,98,0.16)] blur-[60px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-10 -bottom-10 h-40 w-40 rounded-full bg-[rgba(12,18,32,0.55)] blur-[40px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_18%_12%,rgba(255,255,255,0.08)_0%,transparent_55%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent"
      />

      <div className="relative z-10">
        {/* Top row: eyebrow + title + streak */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[rgba(249,168,212,0.9)]">
              Revisão ativa
            </p>
            <p className="mt-1 text-[18px] font-bold leading-tight tracking-[-0.015em] text-white md:text-[20px]">
              Seu progresso no Caderno
            </p>
            <p className="mt-1 text-[12px] text-white/55">
              {total > 0
                ? `${total} ${pluralize(total, 'questão salva', 'questões salvas')} · ${pending} ${pluralize(pending, 'pendente', 'pendentes')}`
                : 'Sem questões salvas ainda.'}
            </p>
          </div>

          {streak > 0 && (
            <div className="flex shrink-0 items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.04] px-3 py-2">
              <Flame className="h-4 w-4 text-orange-400" aria-hidden />
              <div className="text-right">
                <div className="text-[15px] font-extrabold leading-none tracking-[-0.02em] text-orange-300 tabular-nums">
                  {streak}
                </div>
                <div className="text-[9px] font-medium uppercase tracking-wide text-white/45">
                  dias
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Progress bar — protagonista visual */}
        <div className="mt-5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] font-medium text-white/60">
              {resolved} de {total} {pluralize(total, 'resolvida', 'resolvidas')}
            </span>
            <span className="text-[13px] font-bold tabular-nums text-white">
              {progressPct}%
            </span>
          </div>
          <div
            className="mt-1.5 h-[5px] overflow-hidden rounded-full bg-white/[0.08]"
            role="progressbar"
            aria-valuenow={resolved}
            aria-valuemax={total}
            aria-label={`${resolved} de ${total} questões resolvidas`}
          >
            <motion.div
              className="h-full rounded-full bg-[linear-gradient(90deg,#8E1F3D_0%,#E83862_100%)]"
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{
                duration: prefersReducedMotion ? 0 : 0.8,
                ease: 'easeOut',
                delay: prefersReducedMotion ? 0 : 0.15,
              }}
            />
          </div>
        </div>

        {/* Stats inline — grid 2×2 em mobile, linha em desktop */}
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 md:gap-3">
          <StatPill label="Pendentes" value={pending} tone="warning" />
          <StatPill label="Resolvidas" value={resolved} tone="success" />
          <StatPill
            label={pluralize(specialties, 'Especialidade', 'Especialidades')}
            value={specialties}
            tone="neutral"
            className="col-span-2 sm:col-span-1"
          />
        </div>
      </div>
    </div>
  );
}

function StatPill({
  label,
  value,
  tone,
  className,
}: {
  label: string;
  value: number;
  tone: 'warning' | 'success' | 'neutral';
  className?: string;
}) {
  const colors = {
    warning: 'text-orange-300',
    success: 'text-emerald-300',
    neutral: 'text-white',
  };

  return (
    <div
      className={cn(
        'flex items-baseline justify-between gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2',
        className,
      )}
    >
      <span className="text-[10px] font-medium uppercase tracking-wide text-white/50">
        {label}
      </span>
      <span
        className={cn(
          'text-[18px] font-extrabold leading-none tracking-[-0.02em] tabular-nums',
          colors[tone],
        )}
      >
        {value}
      </span>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * FilterBar — chips segmented, acessível, tokens
 * ────────────────────────────────────────────────────────────────────────── */

function FilterBar({
  entries,
  typeOptions,
  specialties,
  typeFilter,
  specFilter,
  onTypeChange,
  onSpecChange,
}: {
  entries: NotebookEntry[];
  typeOptions: DbReason[];
  specialties: string[];
  typeFilter: TypeFilter;
  specFilter: string | null;
  onTypeChange: (t: TypeFilter) => void;
  onSpecChange: (s: string | null) => void;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      {/* Type chips */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none]">
        <span className="shrink-0 text-overline font-bold uppercase tracking-wider text-muted-foreground">
          Tipo
        </span>
        <div
          role="radiogroup"
          aria-label="Filtrar por tipo de erro"
          className="flex items-center gap-1.5"
        >
          <FilterChip
            label="Todos"
            count={entries.length}
            active={typeFilter === 'all'}
            onClick={() => onTypeChange('all')}
          />
          {typeOptions.map((type) => {
            const meta = getReasonMeta(type);
            const count = entries.filter((e) => e.reason === type).length;
            return (
              <FilterChip
                key={type}
                label={meta.badge}
                count={count}
                active={typeFilter === type}
                dotColor={meta.colorBase}
                activeColors={{
                  bg: meta.colorBg,
                  text: meta.colorText,
                  border: meta.colorBorder,
                }}
                onClick={() => onTypeChange(typeFilter === type ? 'all' : type)}
              />
            );
          })}
        </div>
      </div>

      {/* Specialty chips (only when multiple) */}
      {specialties.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none]">
          <span className="shrink-0 text-overline font-bold uppercase tracking-wider text-muted-foreground">
            Área
          </span>
          <div
            role="radiogroup"
            aria-label="Filtrar por especialidade"
            className="flex items-center gap-1.5"
          >
            <FilterChip
              label="Todas"
              active={!specFilter}
              onClick={() => onSpecChange(null)}
              variant="subtle"
            />
            {specialties.map((s) => (
              <FilterChip
                key={s}
                label={s}
                active={specFilter === s}
                onClick={() => onSpecChange(specFilter === s ? null : s)}
                variant="subtle"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FilterChip({
  label,
  count,
  active,
  dotColor,
  activeColors,
  variant = 'default',
  onClick,
}: {
  label: string;
  count?: number;
  active: boolean;
  dotColor?: string;
  activeColors?: { bg: string; text: string; border: string };
  variant?: 'default' | 'subtle';
  onClick: () => void;
}) {
  const isDefault = variant === 'default';

  // Active default: usa cor do tipo quando fornecida, senão wine primary
  const activeStyle =
    active && isDefault && activeColors
      ? {
          background: activeColors.bg,
          color: activeColors.text,
          borderColor: activeColors.border,
        }
      : undefined;

  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      style={activeStyle}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-all duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        // Active states
        active && isDefault && !activeColors && 'border-primary bg-primary text-primary-foreground shadow-[0_2px_8px_-2px_hsl(345_65%_30%/0.3)]',
        active && !isDefault && 'border-primary/30 bg-primary/10 text-primary',
        // Inactive
        !active && 'border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground',
      )}
    >
      {dotColor && (
        <span
          aria-hidden
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: dotColor }}
        />
      )}
      {label}
      {typeof count === 'number' && (
        <span
          className={cn(
            'text-[10px] font-bold tabular-nums',
            active ? 'opacity-80' : 'opacity-60',
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * ZeroPendingCard — tudo resolvido, momento de expressão contido
 * ────────────────────────────────────────────────────────────────────────── */

function ZeroPendingCard({
  resolvedCount,
  streak,
  onShowResolved,
}: {
  resolvedCount: number;
  streak: number;
  onShowResolved: () => void;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-success/20 bg-gradient-to-br from-success/[0.06] via-card to-card p-8 text-center shadow-[0_12px_32px_-20px_hsl(152_60%_36%/0.3)]">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-success/[0.08] blur-3xl"
      />
      <div className="relative">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border-2 border-success/30 bg-success/10">
          <Check className="h-7 w-7 text-success" strokeWidth={2.5} aria-hidden />
        </div>
        <h3 className="text-heading-2 text-foreground">Caderno zerado 🎯</h3>
        <p className="mx-auto mt-2 max-w-sm text-body-sm leading-relaxed text-muted-foreground">
          Você revisou e resolveu todas as questões. Esse é o nível que separa aprovados de reprovados.
        </p>

        <div className="mt-5 flex items-center justify-center gap-8">
          <div className="text-center">
            <div className="text-[28px] font-extrabold leading-none tracking-[-0.03em] text-success tabular-nums">
              {resolvedCount}
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              {pluralize(resolvedCount, 'resolvida', 'resolvidas')}
            </div>
          </div>
          {streak > 0 && (
            <div className="text-center">
              <div className="inline-flex items-baseline gap-1 text-[28px] font-extrabold leading-none tracking-[-0.03em] text-orange-500 tabular-nums">
                <Flame className="h-6 w-6" aria-hidden />
                {streak}
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                {pluralize(streak, 'dia de streak', 'dias de streak')}
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onShowResolved}
          className="mt-6 inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2 text-[12px] font-semibold text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          Ver questões resolvidas
        </button>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Loading / Empty skeletons
 * ────────────────────────────────────────────────────────────────────────── */

function CadernoSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <SkeletonCard className="h-[200px] rounded-[22px]" />
      <div className="flex gap-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-8 w-20 rounded-full bg-muted/60" />
        ))}
      </div>
      <SkeletonCard className="h-[220px] rounded-[20px]" />
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <SkeletonCard key={i} className="h-[60px] rounded-xl" />
        ))}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * CadernoContent
 * ────────────────────────────────────────────────────────────────────────── */

function CadernoContent({ userId }: { userId: string }) {
  const prefersReducedMotion = useReducedMotion();
  const { profile } = useUser();
  const [entries, setEntries] = useState<NotebookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [specFilter, setSpecFilter] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);

  const errosTracked = useRef(false);

  const fetchEntries = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setLoadError(false);
    try {
      const data = await simuladosApi.getErrorNotebook(userId);
      setEntries(
        data.map((row) => ({
          id: row.id,
          questionId: row.question_id,
          simuladoId: row.simulado_id,
          simuladoTitle: row.simulado_title || null,
          area: row.area,
          theme: row.theme,
          questionNumber: row.question_number || null,
          reason: row.reason,
          learningNote: row.learning_text,
          wasCorrect: row.was_correct,
          addedAt: row.created_at,
          resolvedAt: row.resolved_at || null,
        })),
      );
    } catch (err) {
      logger.error('[CadernoErrosPage] Error loading:', err);
      setLoadError(true);
      toast({
        title: 'Não foi possível carregar o caderno',
        description: 'Verifique sua conexão e tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const specialties = useMemo(
    () => Array.from(new Set(entries.map((e) => e.area).filter(Boolean) as string[])).sort(),
    [entries],
  );

  const filtered = useMemo(() => {
    let data = entries;
    if (typeFilter !== 'all') data = data.filter((e) => e.reason === typeFilter);
    if (specFilter) data = data.filter((e) => e.area === specFilter);
    return [...data].sort(
      (a, b) => new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime(),
    );
  }, [entries, typeFilter, specFilter]);

  const pending = useMemo(() => filtered.filter((e) => !e.resolvedAt), [filtered]);
  const resolved = useMemo(() => filtered.filter((e) => !!e.resolvedAt), [filtered]);
  const streak = useMemo(() => calcStreak(entries), [entries]);
  const heroEntry = pending[0] ?? null;

  const totalPending = entries.filter((e) => !e.resolvedAt).length;
  const totalResolved = entries.filter((e) => !!e.resolvedAt).length;
  const allResolved = entries.length > 0 && totalPending === 0;

  const typeOptions = useMemo(
    () => Array.from(new Set(entries.map((e) => e.reason as DbReason))),
    [entries],
  );

  // Analytics
  useEffect(() => {
    if (loading || errosTracked.current) return;
    errosTracked.current = true;
    trackEvent('caderno_erros_viewed', {
      total_errors: entries.length,
      segment: profile?.segment ?? 'guest',
    });
  }, [loading, entries.length, profile?.segment]);

  const prevFiltersRef = useRef<{ type: TypeFilter; spec: string | null } | null>(null);
  useEffect(() => {
    if (loading) return;
    if (!prevFiltersRef.current) {
      prevFiltersRef.current = { type: typeFilter, spec: specFilter };
      return;
    }
    const prev = prevFiltersRef.current;
    const ft =
      prev.type !== typeFilter
        ? 'reason'
        : prev.spec !== specFilter
          ? 'specialty'
          : null;
    if (ft) {
      trackEvent('caderno_erros_filtered', {
        filter_type: ft,
        result_count: filtered.length,
      });
      prevFiltersRef.current = { type: typeFilter, spec: specFilter };
    }
  }, [typeFilter, specFilter, loading, filtered.length]);

  const handleRemove = async (id: string) => {
    const confirmed = window.confirm(
      'Tem certeza que deseja remover este item do caderno? Essa ação não pode ser desfeita.',
    );
    if (!confirmed) return;

    const previousEntries = entries;
    setEntries((prev) => prev.filter((e) => e.id !== id));
    try {
      await simuladosApi.deleteErrorNotebookEntry(id, userId);
      toast({ title: 'Item removido do caderno' });
    } catch (err) {
      logger.error('[CadernoErrosPage] Error removing:', err);
      setEntries(previousEntries);
      toast({
        title: 'Não foi possível remover',
        description: 'Tente novamente em instantes.',
        variant: 'destructive',
      });
    }
  };

  const handleToggleResolved = async (id: string, resolvedNow: boolean) => {
    const previousEntries = entries;
    setEntries((prev) =>
      prev.map((e) =>
        e.id === id
          ? { ...e, resolvedAt: resolvedNow ? new Date().toISOString() : null }
          : e,
      ),
    );
    try {
      await simuladosApi.toggleResolvedEntry(id, userId, resolvedNow);
      toast({ title: resolvedNow ? 'Marcado como resolvido' : 'Reaberto' });
    } catch (err) {
      logger.error('[CadernoErrosPage] Error toggling:', err);
      setEntries(previousEntries);
      toast({
        title: 'Não foi possível atualizar',
        description: 'Tente novamente em instantes.',
        variant: 'destructive',
      });
    }
  };

  /* ── Loading ── */
  if (loading) {
    return <CadernoSkeleton />;
  }

  /* ── Load error ── */
  if (loadError && entries.length === 0) {
    return (
      <EmptyState
        variant="error"
        title="Não foi possível carregar o Caderno"
        description="Houve um problema de conexão com o servidor. Verifique sua internet e tente novamente."
        onRetry={fetchEntries}
      />
    );
  }

  /* ── Empty (never added anything) ── */
  if (entries.length === 0) {
    return (
      <div className="mx-auto max-w-xl rounded-3xl border-2 border-dashed border-primary/25 bg-primary/[0.04] p-10 text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent">
          <BookOpen className="h-7 w-7 text-primary" aria-hidden />
        </div>
        <h3 className="text-heading-2 text-foreground">Seu Caderno está vazio</h3>
        <p className="mx-auto mt-2 max-w-md text-body text-muted-foreground leading-relaxed">
          Na correção do simulado, toque em <strong className="font-semibold text-foreground">"Salvar no Caderno"</strong>{' '}
          para adicionar questões que quer dominar.
        </p>
        <Link
          to="/simulados"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-body-sm font-semibold text-primary-foreground shadow-[0_4px_14px_-4px_hsl(345_65%_30%/0.4)] transition-all duration-200 hover:bg-wine-hover hover:shadow-[0_6px_18px_-4px_hsl(345_65%_30%/0.5)] no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.99]"
        >
          <Zap className="h-4 w-4" aria-hidden />
          Ver simulados disponíveis
        </Link>
      </div>
    );
  }

  /* ── Main layout ── */
  return (
    <StaggerContainer className="space-y-5 md:space-y-6">
      {/* Hero status */}
      <StaggerItem>
        <HeroStatusCard
          pending={totalPending}
          resolved={totalResolved}
          total={entries.length}
          specialties={specialties.length}
          streak={streak}
          prefersReducedMotion={!!prefersReducedMotion}
        />
      </StaggerItem>

      {/* Filters */}
      <StaggerItem>
        <FilterBar
          entries={entries}
          typeOptions={typeOptions}
          specialties={specialties}
          typeFilter={typeFilter}
          specFilter={specFilter}
          onTypeChange={setTypeFilter}
          onSpecChange={setSpecFilter}
        />
      </StaggerItem>

      {/* Body */}
      {allResolved && (
        <StaggerItem>
          <ZeroPendingCard
            resolvedCount={totalResolved}
            streak={streak}
            onShowResolved={() => setShowResolved(true)}
          />
        </StaggerItem>
      )}

      {!allResolved && filtered.length === 0 && (
        <StaggerItem>
          <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-12 text-center">
            <p className="text-body-sm text-muted-foreground">
              Nenhuma questão corresponde aos filtros selecionados.
            </p>
            <button
              type="button"
              onClick={() => {
                setTypeFilter('all');
                setSpecFilter(null);
              }}
              className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-semibold text-primary hover:text-wine-hover focus-visible:outline-none focus-visible:underline"
            >
              Limpar filtros
            </button>
          </div>
        </StaggerItem>
      )}

      {!allResolved && filtered.length > 0 && heroEntry && (
        <StaggerItem>
          <div>
            <div className="mb-2.5 flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-primary" aria-hidden />
              <span className="text-overline font-bold uppercase tracking-wider text-muted-foreground">
                Próxima para revisar
              </span>
            </div>
            <NextUpCard
              entry={heroEntry}
              onRemove={handleRemove}
              onToggleResolved={handleToggleResolved}
            />
          </div>
        </StaggerItem>
      )}

      {!allResolved && pending.length > 1 && (
        <StaggerItem>
          <div>
            <div className="mb-2.5 flex items-center justify-between">
              <span className="text-overline font-bold uppercase tracking-wider text-muted-foreground">
                Na fila
              </span>
              <span className="text-caption text-muted-foreground">
                {pending.length - 1} {pluralize(pending.length - 1, 'restante', 'restantes')}
              </span>
            </div>
            <motion.div
              className="flex flex-col gap-2"
              initial="hidden"
              animate="visible"
              variants={{
                visible: {
                  transition: { staggerChildren: prefersReducedMotion ? 0 : 0.04 },
                },
                hidden: {},
              }}
            >
              {pending.slice(1).map((entry) => (
                <motion.div
                  key={entry.id}
                  variants={{
                    hidden: prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 6 },
                    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
                  }}
                >
                  <QueueRow
                    entry={entry}
                    onRemove={handleRemove}
                    onToggleResolved={handleToggleResolved}
                  />
                </motion.div>
              ))}
            </motion.div>
          </div>
        </StaggerItem>
      )}

      {/* Resolved section — collapsible */}
      {resolved.length > 0 && (
        <StaggerItem>
          <div>
            {!showResolved ? (
              <button
                type="button"
                onClick={() => setShowResolved(true)}
                className="inline-flex items-center gap-1.5 text-caption font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:underline"
              >
                Ver {resolved.length} {pluralize(resolved.length, 'questão resolvida', 'questões resolvidas')}
                <ChevronDown className="h-3.5 w-3.5" aria-hidden />
              </button>
            ) : (
              <AnimatePresence>
                <motion.div
                  initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="mb-2.5 flex items-center justify-between">
                    <span className="text-overline font-bold uppercase tracking-wider text-muted-foreground">
                      Resolvidas
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowResolved(false)}
                      className="text-caption text-muted-foreground transition-colors hover:text-foreground"
                    >
                      Ocultar
                    </button>
                  </div>
                  <div className="flex flex-col gap-2">
                    {resolved.map((entry) => (
                      <QueueRow
                        key={entry.id}
                        entry={entry}
                        onRemove={handleRemove}
                        onToggleResolved={handleToggleResolved}
                      />
                    ))}
                  </div>
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        </StaggerItem>
      )}
    </StaggerContainer>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Page export
 * ────────────────────────────────────────────────────────────────────────── */

export default function CadernoErrosPage() {
  const { profile } = useUser();
  const { user } = useAuth();
  const segment = profile?.segment ?? 'guest';
  const hasAccess = SEGMENT_ACCESS[segment].cadernoErros;

  return (
    <PageTransition>
      <PageHeader
        title="Caderno de Erros"
        subtitle="Sua ferramenta de revisão ativa para dominar o que importa."
        subtitlePlacement="inline-end"
        badge="PRO: ENAMED Exclusivo"
      />

      {!hasAccess ? (
        <ProGate
          icon={BookOpen}
          feature="Caderno de Erros"
          description="Salve questões com motivo e anotação de aprendizado. Organize sua revisão por área e tipo de erro para estudar de forma estratégica."
          requiredSegment="pro"
          currentSegment={segment}
          benefits={[
            'Salvar questões direto da correção com motivo (errou, sem certeza)',
            'Anotação de aprendizado por questão',
            'Filtrar e revisar por área, tipo de erro e especialidade',
          ]}
        />
      ) : (
        <CadernoContent userId={user?.id || ''} />
      )}
    </PageTransition>
  );
}
