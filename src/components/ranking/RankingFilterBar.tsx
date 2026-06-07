import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Stethoscope, Building } from 'lucide-react';
import type { SegmentFilter, RankingComparisonSelection } from '@/services/rankingApi';

type SegmentOption = { key: SegmentFilter; label: string; icon: React.ElementType };

interface Props {
  rankingComparison: RankingComparisonSelection;
  segmentFilter: SegmentFilter;
  userSpecialty: string;
  userInstitutions: string[];
  visibleSegmentOptions: SegmentOption[];
  shimmeringPillId: string | null;
  surfaceBg: string;
  surfaceBorder: string;
  borderColor: string;
  filterLabel: string;
  text2: string;
  getPillStyle: (isActive: boolean, isPro?: boolean) => React.CSSProperties;
  triggerShimmer: (id: string) => void;
  handleSelectAllComparison: () => void;
  handleToggleSpecialtyComparison: () => void;
  handleToggleInstitutionComparison: () => void;
  handleSegmentFilterChange: (newValue: SegmentFilter) => void;
}

export function RankingFilterBar({
  rankingComparison,
  segmentFilter,
  userSpecialty,
  userInstitutions,
  visibleSegmentOptions,
  shimmeringPillId,
  surfaceBg,
  surfaceBorder,
  borderColor,
  filterLabel,
  text2,
  getPillStyle,
  triggerShimmer,
  handleSelectAllComparison,
  handleToggleSpecialtyComparison,
  handleToggleInstitutionComparison,
  handleSegmentFilterChange,
}: Props) {
  return (
    <div
      className="px-5 py-4 mb-4 rounded-[16px]"
      style={{ background: surfaceBg, border: surfaceBorder }}
    >
      <div className="flex flex-wrap items-center gap-2.5">

        {/* ─ Comparar group ─ */}
        <span
          className="shrink-0 whitespace-nowrap"
          style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: filterLabel }}
        >
          Comparar
        </span>

        {/* Todos comparison pill */}
        <motion.button
          type="button"
          onClick={() => {
            if (rankingComparison.bySpecialty || rankingComparison.byInstitution) triggerShimmer('comp-all');
            handleSelectAllComparison();
          }}
          aria-pressed={!rankingComparison.bySpecialty && !rankingComparison.byInstitution}
          aria-label="Todos os candidatos"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[0.82rem] font-medium"
          style={getPillStyle(!rankingComparison.bySpecialty && !rankingComparison.byInstitution)}
          data-shimmer={shimmeringPillId === 'comp-all' ? '1' : undefined}
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 400, damping: 15 }}
        >
          <motion.span
            className="inline-flex shrink-0"
            whileHover={{ scale: 1.15 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
          >
            <Users className="h-4 w-4" aria-hidden />
          </motion.span>
          Todos
        </motion.button>

        {/* Specialty pill — only when user has a configured specialty */}
        {userSpecialty && (
          <motion.button
            type="button"
            onClick={() => {
              if (!rankingComparison.bySpecialty) triggerShimmer('comp-specialty');
              handleToggleSpecialtyComparison();
            }}
            aria-pressed={rankingComparison.bySpecialty}
            aria-label={`Filtrar por especialidade: ${userSpecialty}`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[0.82rem] font-medium"
            style={getPillStyle(rankingComparison.bySpecialty)}
            data-shimmer={shimmeringPillId === 'comp-specialty' ? '1' : undefined}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
          >
            <motion.span
              className="inline-flex shrink-0"
              whileHover={{ scale: 1.15 }}
              transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            >
              <Stethoscope className="h-4 w-4" aria-hidden />
            </motion.span>
            {userSpecialty}
          </motion.button>
        )}

        {/* Institution pill — slides in when specialty filter is active */}
        <AnimatePresence>
          {rankingComparison.bySpecialty && userInstitutions.length > 0 && (
            <motion.button
              key="institution-pill"
              type="button"
              onClick={() => {
                if (!rankingComparison.byInstitution) triggerShimmer('comp-institution');
                handleToggleInstitutionComparison();
              }}
              aria-pressed={rankingComparison.byInstitution}
              aria-label={`Filtrar também por instituição: ${userInstitutions[0]}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[0.82rem] font-medium max-w-[14rem]"
              style={getPillStyle(rankingComparison.byInstitution)}
              data-shimmer={shimmeringPillId === 'comp-institution' ? '1' : undefined}
              initial={{ opacity: 0, x: -8, scale: 0.88 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -8, scale: 0.88 }}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 380, damping: 18 }}
            >
              <motion.span
                className="inline-flex shrink-0"
                whileHover={{ scale: 1.15 }}
                transition={{ type: 'spring', stiffness: 400, damping: 15 }}
              >
                <Building className="h-4 w-4" aria-hidden />
              </motion.span>
              <span className="truncate">{userInstitutions[0]}</span>
            </motion.button>
          )}
        </AnimatePresence>

        {/* Vertical divider */}
        <div
          className="shrink-0"
          style={{ width: '1px', height: '26px', background: borderColor, borderRadius: '1px' }}
          aria-hidden
        />

        {/* ─ Segmento group ─ */}
        <span
          className="shrink-0 whitespace-nowrap"
          style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: filterLabel }}
        >
          Segmento
        </span>

        {visibleSegmentOptions.map((f) => (
          <motion.button
            key={f.key}
            type="button"
            onClick={() => {
              if (segmentFilter !== f.key) triggerShimmer(`seg-${f.key}`);
              handleSegmentFilterChange(f.key);
            }}
            aria-pressed={segmentFilter === f.key}
            aria-label={f.label}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[0.82rem] font-medium"
            style={getPillStyle(segmentFilter === f.key, f.key === 'pro' && segmentFilter !== f.key)}
            data-shimmer={shimmeringPillId === `seg-${f.key}` ? '1' : undefined}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
          >
            <motion.span
              className="inline-flex shrink-0"
              whileHover={{ scale: 1.15 }}
              transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            >
              <f.icon className="h-4 w-4" aria-hidden />
            </motion.span>
            <span className="hidden sm:inline">{f.label}</span>
          </motion.button>
        ))}

      </div>

      {/* Active filter summary */}
      {rankingComparison.bySpecialty && (
        <p
          className="text-xs mt-2.5 leading-snug"
          style={{ color: filterLabel }}
        >
          <span style={{ color: '#7a1a32', marginRight: '4px' }}>●</span>
          {rankingComparison.byInstitution && userInstitutions[0] ? (
            <>
              Comparando com candidatos de{' '}
              <span style={{ color: text2 }}>{userSpecialty}</span>
              {' · '}
              <span style={{ color: text2 }}>{userInstitutions[0]}</span>
            </>
          ) : (
            <>
              Comparando com candidatos de{' '}
              <span style={{ color: text2 }}>{userSpecialty}</span>
              <span style={{ color: filterLabel }}> (todas as instituições)</span>
            </>
          )}
        </p>
      )}
    </div>
  );
}
