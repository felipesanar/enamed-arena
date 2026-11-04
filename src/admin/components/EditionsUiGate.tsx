import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAppConfig } from '@/hooks/useAppConfig';
import { AdminCapabilityGate } from '@/admin/components/AdminCapabilityGate';

export function EditionsUiGate({ children }: { children: ReactNode }) {
  const enabled = useAppConfig('editions_ui');
  if (!enabled) return <Navigate to="/admin/simulados" replace />;
  return <AdminCapabilityGate capability="content.manage">{children}</AdminCapabilityGate>;
}
