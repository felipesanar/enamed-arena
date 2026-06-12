import type { ReactNode } from 'react'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'

interface AdminConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: ReactNode
  confirmLabel?: string
  /** destrutivo pinta o botão de destructive */
  destructive?: boolean
  onConfirm: () => void
  loading?: boolean
}

export function AdminConfirmDialog({
  open, onOpenChange, title, description,
  confirmLabel = 'Confirmar', destructive = false, onConfirm, loading = false,
}: AdminConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-admin-surface border-admin-line text-admin-text">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-admin-text">{title}</AlertDialogTitle>
          <AlertDialogDescription className="text-admin-muted">{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="border-admin-line bg-transparent text-admin-muted hover:bg-admin-raised hover:text-admin-text">
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={loading}
            onClick={(e) => { e.preventDefault(); onConfirm() }}
            className={cn(
              destructive
                ? 'bg-admin-destructive text-white hover:bg-admin-destructive/90'
                : 'bg-admin-accent text-admin-accent-contrast hover:bg-admin-accent/90',
            )}
          >
            {loading ? 'Aguarde…' : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
