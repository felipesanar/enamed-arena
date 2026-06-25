import { useEffect, useId, useState, type ReactNode } from 'react'
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
  /**
   * Quando informado, ativa a confirmação por digitação: a ação só habilita
   * depois que a pessoa digitar exatamente esta palavra (ex.: "EXCLUIR").
   */
  confirmText?: string
  /** Rótulo acima do campo de digitação. Tem um padrão sensato se omitido. */
  confirmTextLabel?: ReactNode
}

export function AdminConfirmDialog({
  open, onOpenChange, title, description,
  confirmLabel = 'Confirmar', destructive = false, onConfirm, loading = false,
  confirmText, confirmTextLabel,
}: AdminConfirmDialogProps) {
  const inputId = useId()
  const [typed, setTyped] = useState('')

  const requiresTyping = Boolean(confirmText)
  const matches = !requiresTyping || typed === confirmText

  // Limpa o campo sempre que o diálogo abre ou fecha, para não vazar entre usos.
  useEffect(() => {
    if (!open) setTyped('')
  }, [open])

  const disabled = loading || !matches

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-admin-surface border-admin-line text-admin-text rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-admin-text">{title}</AlertDialogTitle>
          <AlertDialogDescription className="text-admin-muted">{description}</AlertDialogDescription>
        </AlertDialogHeader>

        {requiresTyping && (
          <div className="space-y-1.5">
            <label htmlFor={inputId} className="block text-[12px] text-admin-muted">
              {confirmTextLabel ?? (
                <>
                  Para confirmar, digite{' '}
                  <span className="font-bold text-admin-text">{confirmText}</span> abaixo.
                </>
              )}
            </label>
            <input
              id={inputId}
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              aria-label={typeof confirmText === 'string' ? `Digite ${confirmText} para confirmar` : undefined}
              placeholder={confirmText}
              className={cn(
                'w-full rounded-md border-[1.5px] border-admin-destructive bg-admin-surface',
                'px-3 py-2 text-[13px] text-admin-text placeholder:text-admin-faint',
                'outline-none focus-visible:ring-2 focus-visible:ring-admin-destructive/30',
              )}
            />
          </div>
        )}

        <AlertDialogFooter className="bg-admin-bg -mx-6 -mb-6 px-6 py-4 mt-2 border-t border-admin-line-subtle rounded-b-2xl">
          <AlertDialogCancel className="border-admin-line bg-admin-surface text-admin-text hover:bg-admin-raised">
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={disabled}
            onClick={(e) => { e.preventDefault(); onConfirm() }}
            className={cn(
              'disabled:opacity-50 disabled:pointer-events-none',
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
