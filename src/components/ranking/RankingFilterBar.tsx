import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Stethoscope, Building } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SegmentFilter, RankingComparisonSelection } from '@/services/rankingApi';

type SegmentOption = { key: SegmentFilter; label: string; icon: React.ElementType };

interface Props {
  rankingComparison: RankingComparisonSelection;
  segmentFilter: SegmentFilter;
  userSpecialty: string;
  userInstitutions: string[];
  visibleSegmentOptions: SegmentOption[];
  onSelectAllComparison: () => void;
  onToggleSpecialtyComparison: () => void;
  onToggleInstitutionComparison: () => void;
  onSegmentFilterChange: (f: SegmentFilter) => void;
}

const pillBase =
  'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-caption font-medium transition-colors';
const pillOn = 'bg-primary text-white shadow-sm';
const pillOff = 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground border border-border';

export function RankingFilterBar({
  rankingComparison,
  segmentFilter,
  userSpecialty,
  userInstitutions,
  visibleSegmentOptions,
  onSelectAllComparison,
  onToggleSpecialtyComparison,
  onToggleInstitutionComparison,
  onSegmentFilterChange,
}: Props) {
  const allActive = !rankingComparison.bySpecialty && !rankingComparison.byInstitution;

  return (
    <div className="rounded-2xl border border-border bg-card px-5 py-4 mb-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="text-micro-label uppercase tracking-wider font-bold text-muted-foreground shrink-0">
          Comparar
        </span>

        <motion.button
          type="button"
          onClick={onSelectAllComparison}
          aria-pressed={allActive}
          aria-label="Todos os candidatos"
          className={cn(pillBase, allActive ? pillOn : pillOff)}
          whileTap={{ scale: 0.95 }}
        >
          <Users className="h-4 w-4" aria-hidden />
          Todos
        </motion.button>

        {userSpecialty && (
          <motion.button
            type="button"
            onClick={onToggleSpecialtyComparison}
            aria-pressed={rankingComparison.bySpecialty}
            aria-label={`Filtrar por especialidade: ${userSpecialty}`}
            className={cn(pillBase, rankingComparison.bySpecialty ? pillOn : pillOff)}
            whileTap={{ scale: 0.95 }}
          >
            <Stethoscope className="h-4 w-4" aria-hidden />
            {userSpecialty}
          </motion.button>
        )}

        <AnimatePresence>
          {rankingComparison.bySpecialty && userInstitutions.length > 0 && (
            <motion.button
              key="institution-pill"
              type="button"
              onClick={onToggleInstitutionComparison}
              aria-pressed={rankingComparison.byInstitution}
              aria-label={`Filtrar também por instituição: ${userInstitutions[0]}`}
              className={cn(pillBase, 'max-w-[14rem]', rankingComparison.byInstitution ? pillOn : pillOff)}
              initial={{ opacity: 0, x: -8, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -8, scale: 0.9 }}
              whileTap={{ scale: 0.95 }}
            >
              <Building className="h-4 w-4 shrink-0" aria-hidden />
              <span className="truncate">{userInstitutions[0]}</span>
            </motion.button>
          )}
        </AnimatePresence>

        <div className="h-6 w-px bg-border shrink-0" aria-hidden />

        <span className="text-micro-label uppercase tracking-wider font-bold text-muted-foreground shrink-0">
          Segmento
        </span>

        {visibleSegmentOptions.map((f) => (
          <motion.button
            key={f.key}
            type="button"
            onClick={() => onSegmentFilterChange(f.key)}
            aria-pressed={segmentFilter === f.key}
            aria-label={f.label}
            className={cn(pillBase, segmentFilter === f.key ? pillOn : pillOff)}
            whileTap={{ scale: 0.95 }}
          >
            <f.icon className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">{f.label}</span>
          </motion.button>
        ))}
      </div>

      {rankingComparison.bySpecialty && (
        <p className="text-caption text-muted-foreground mt-2.5 leading-snug">
          <span className="text-primary mr-1">●</span>
          Comparando com candidatos de <span className="text-foreground">{userSpecialty}</span>
          {rankingComparison.byInstitution && userInstitutions[0] ? (
            <> · <span className="text-foreground">{userInstitutions[0]}</span></>
          ) : (
            <span> (todas as instituições)</span>
          )}
        </p>
      )}
    </div>
  );
}
