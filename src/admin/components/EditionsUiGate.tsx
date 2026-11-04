import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAppConfigState } from '@/hooks/useAppConfig';
import { AdminCapabilityGate } from '@/admin/components/AdminCapabilityGate';

export function EditionsUiGate({ children }: { children: ReactNode }) {
  const { enabled, isPending } = useAppConfigState('editions_ui');
  if (isPending) return <p role="status" aria-live="polite" className="p-6">Carregando configuração de edições…</p>;
  if (!enabled) return <Navigate to="/admin/simulados" replace />;
  return <AdminCapabilityGate capability="content.manage">{children}</AdminCapabilityGate>;
}
