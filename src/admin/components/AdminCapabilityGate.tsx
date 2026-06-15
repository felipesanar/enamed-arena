import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ShieldOff } from 'lucide-react'
import { useAdminCan } from '@/admin/contexts/AdminAccessContext'
import { AdminEmptyState } from '@/admin/components/ui/AdminEmptyState'

export function AdminCapabilityGate({ capability, children }: { capability: string; children: ReactNode }) {
  const can = useAdminCan(capability)
  if (!can) {
    return (
      <AdminEmptyState
        icon={ShieldOff}
        title="Sem acesso a esta área"
        description="Seu perfil não tem permissão para esta seção do painel."
        action={<Link to="/admin" className="text-xs text-admin-accent underline">Voltar ao Dashboard</Link>}
      />
    )
  }
  return <>{children}</>
}
