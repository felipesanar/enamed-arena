import React, { useState } from 'react';
import { ChevronDown, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RankingApprovalPanel, type ApprovalPanelState } from './RankingApprovalPanel';
import type { ApprovalEntry } from '@/lib/ranking-approval';

interface Props {
  state: ApprovalPanelState;
  entries: ApprovalEntry[];
  userScore: number | null;
  onOpenCutoffTable: () => void;
}

/**
 * Seção "Você passaria?" recolhida por padrão — a nota de corte é secundária
 * enquanto a cobertura de cortes é baixa. Preserva o RankingApprovalPanel inteiro.
 */
export function RankingCutoffSection(props: Props) {
  const [open, setOpen] = useState(false);
  const reached = props.entries.filter((e) => e.status === 'pass').length;
  const withCutoff = props.entries.filter((e) => e.cutoffGeneral != null).length;
  const summary =
    props.userScore != null && withCutoff > 0
      ? `${reached} de ${withCutoff} instituiç${withCutoff === 1 ? 'ão' : 'ões'} alcançada${reached === 1 ? '' : 's'}`
      : 'Compare sua nota com as notas de corte';

  return (
    <div className="rounded-2xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="cutoff-panel"
        className="flex w-full items-center gap-3 px-5 py-4 text-left"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent">
          <Target className="h-[18px] w-[18px] text-primary" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-body font-semibold text-foreground">Você passaria?</span>
          <span className="block truncate text-caption text-muted-foreground">{summary}</span>
        </span>
        <ChevronDown
          className={cn('h-5 w-5 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </button>
      {open && (
        <div id="cutoff-panel" className="px-1 pb-1">
          <RankingApprovalPanel {...props} />
        </div>
      )}
    </div>
  );
}
