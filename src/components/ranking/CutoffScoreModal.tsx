import React, { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { fetchAllCutoffScores } from '@/services/rankingApi';

interface CutoffScoreModalProps {
  open: boolean;
  onClose: () => void;
  userSpecialty?: string;
}

export function CutoffScoreModal({ open, onClose, userSpecialty }: CutoffScoreModalProps) {
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['all-cutoff-scores'],
    queryFn: fetchAllCutoffScores,
    staleTime: Infinity,
    enabled: open,
  });

  // Focus the close button on open
  useEffect(() => {
    if (open) closeBtnRef.current?.focus();
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const normalizedSpecialty = userSpecialty?.toLowerCase() ?? '';
  const userRows = normalizedSpecialty
    ? rows.filter((r) => r.specialty_name.toLowerCase() === normalizedSpecialty)
    : [];
  const otherRows = normalizedSpecialty
    ? rows.filter((r) => r.specialty_name.toLowerCase() !== normalizedSpecialty)
    : rows;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backdropFilter: 'blur(8px)', background: 'rgba(0,0,0,0.6)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Notas de Corte ENAMED"
        className="w-full max-w-2xl max-h-[80vh] flex flex-col"
        style={{
          background: 'linear-gradient(145deg, #2a0e1a 0%, #1a0811 100%)',
          border: '1px solid rgba(255,150,170,0.12)',
          borderRadius: '20px',
          padding: '24px',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4 shrink-0">
          <h2 className="text-base font-bold text-white">Notas de Corte ENAMED</h2>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label="Fechar modal"
            className="h-8 w-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)' }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.12)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)';
            }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 -mx-1 px-1">
          {isLoading && (
            <p className="text-center py-8 text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Carregando...
            </p>
          )}
          {!isLoading && rows.length === 0 && (
            <p className="text-center py-8 text-sm" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Nenhuma nota de corte disponível.
            </p>
          )}
          {!isLoading && rows.length > 0 && (
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0" style={{ background: 'rgba(26,8,17,0.98)' }}>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <th
                    className="text-left py-2 px-3 font-bold uppercase tracking-widest"
                    style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)' }}
                  >
                    Instituição
                  </th>
                  <th
                    className="text-left py-2 px-3 font-bold uppercase tracking-widest"
                    style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)' }}
                  >
                    Especialidade
                  </th>
                  <th
                    className="text-right py-2 px-3 font-bold uppercase tracking-widest"
                    style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)' }}
                  >
                    Geral
                  </th>
                  <th
                    className="text-right py-2 px-3 font-bold uppercase tracking-widest"
                    style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)' }}
                  >
                    Cotas
                  </th>
                </tr>
              </thead>
              <tbody>
                {userRows.map((row, i) => (
                  <tr
                    key={`user-${row.institution_name}-${row.specialty_name}`}
                    style={{
                      background: 'rgba(122,26,50,0.2)',
                      borderBottom: '1px solid rgba(255,150,170,0.08)',
                    }}
                  >
                    <td className="py-2.5 px-3" style={{ color: 'rgba(255,255,255,0.7)' }}>
                      {row.institution_name}
                    </td>
                    <td className="py-2.5 px-3 font-semibold" style={{ color: '#ffcbd8' }}>
                      {row.specialty_name}
                    </td>
                    <td className="py-2.5 px-3 text-right font-semibold text-white">
                      {row.cutoff_score_general}%
                    </td>
                    <td className="py-2.5 px-3 text-right" style={{ color: 'rgba(255,255,255,0.5)' }}>
                      {row.cutoff_score_quota != null ? `${row.cutoff_score_quota}%` : '—'}
                    </td>
                  </tr>
                ))}
                {otherRows.map((row, i) => (
                  <tr
                    key={`other-${row.institution_name}-${row.specialty_name}`}
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                  >
                    <td className="py-2.5 px-3" style={{ color: 'rgba(255,255,255,0.5)' }}>
                      {row.institution_name}
                    </td>
                    <td className="py-2.5 px-3" style={{ color: 'rgba(255,255,255,0.5)' }}>
                      {row.specialty_name}
                    </td>
                    <td className="py-2.5 px-3 text-right" style={{ color: 'rgba(255,255,255,0.75)' }}>
                      {row.cutoff_score_general}%
                    </td>
                    <td className="py-2.5 px-3 text-right" style={{ color: 'rgba(255,255,255,0.35)' }}>
                      {row.cutoff_score_quota != null ? `${row.cutoff_score_quota}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
