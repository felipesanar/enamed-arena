import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from 'next-themes'
import { User, FileText, Clock } from 'lucide-react'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import {
  Command, CommandEmpty, CommandGroup, CommandInput,
  CommandItem, CommandList, CommandSeparator,
} from '@/components/ui/command'
import { useAdminAccess } from '@/admin/contexts/AdminAccessContext'
import { getAvailableCommands, type AdminCommand } from '@/admin/lib/commandRegistry'
import { useAdminQuickSearch } from '@/admin/hooks/useAdminQuickSearch'
import { logger } from '@/lib/logger'

const RECENTS_KEY = 'admin.recents'
const MAX_RECENTS = 5

interface RecentEntry { route: string; label: string }

function readRecents(): RecentEntry[] {
  try {
    return JSON.parse(localStorage.getItem(RECENTS_KEY) ?? '[]') as RecentEntry[]
  } catch { return [] }
}

export function pushRecent(entry: RecentEntry) {
  try {
    const list = [entry, ...readRecents().filter(r => r.route !== entry.route)].slice(0, MAX_RECENTS)
    localStorage.setItem(RECENTS_KEY, JSON.stringify(list))
  } catch { /* noop */ }
}

interface AdminCommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AdminCommandPalette({ open, onOpenChange }: AdminCommandPaletteProps) {
  const navigate = useNavigate()
  const { setTheme, resolvedTheme } = useTheme()
  const { capabilities } = useAdminAccess()
  const [query, setQuery] = useState('')
  const { results, isFetching, isError } = useAdminQuickSearch(query)
  const commands = getAvailableCommands(capabilities)
  const recents = readRecents()

  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  const runCommand = useCallback((cmd: AdminCommand) => {
    onOpenChange(false)
    if (cmd.actionId === 'toggle-theme') {
      setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
      return
    }
    if (cmd.actionId === 'toggle-sidebar') {
      document.dispatchEvent(new CustomEvent('admin:toggle-sidebar'))
      return
    }
    if (cmd.route) {
      pushRecent({ route: cmd.route, label: cmd.label })
      navigate(cmd.route)
    }
  }, [navigate, onOpenChange, resolvedTheme, setTheme])

  const goToEntity = useCallback((kind: string, id: string, title: string) => {
    onOpenChange(false)
    const route = kind === 'user' ? `/admin/usuarios/${id}` : `/admin/simulados/${id}`
    pushRecent({ route, label: title })
    navigate(route)
  }, [navigate, onOpenChange])

  if (isError) logger.error('[AdminCommandPalette] Erro na busca de entidades')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        className="overflow-hidden p-0 shadow-lg border-admin-line bg-admin-surface text-admin-text"
      >
        <VisuallyHidden><DialogTitle>Paleta de comandos</DialogTitle></VisuallyHidden>
        <Command
          className="bg-transparent text-admin-text [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-admin-muted [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]]:border-admin-line [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-2.5"
        >
          <CommandInput
            placeholder="Buscar página, usuário, simulado ou ação…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList className="max-h-[360px]">
            <CommandEmpty className="py-6 text-center text-sm text-admin-muted">
              {isFetching ? 'Buscando…' : isError ? 'Erro na busca — tente de novo.' : 'Nada encontrado.'}
            </CommandEmpty>

            {query.length === 0 && recents.length > 0 && (
              <>
                <CommandGroup heading="Recentes">
                  {recents.map(r => (
                    <CommandItem key={r.route} value={`recent ${r.label}`} onSelect={() => {
                      onOpenChange(false); navigate(r.route)
                    }}>
                      <Clock className="mr-2 h-3.5 w-3.5 text-admin-faint" aria-hidden />
                      {r.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
                <CommandSeparator className="bg-admin-line" />
              </>
            )}

            <CommandGroup heading="Navegação">
              {commands.filter(c => c.group === 'Navegação').map(cmd => (
                <CommandItem
                  key={cmd.id}
                  value={`${cmd.label} ${cmd.keywords.join(' ')}`}
                  onSelect={() => runCommand(cmd)}
                >
                  <cmd.icon className="mr-2 h-3.5 w-3.5 text-admin-muted" aria-hidden />
                  {cmd.label}
                </CommandItem>
              ))}
            </CommandGroup>

            {results.length > 0 && (
              <>
                <CommandSeparator className="bg-admin-line" />
                <CommandGroup heading="Resultados">
                  {results.map(r => (
                    <CommandItem
                      key={`${r.kind}-${r.id}`}
                      value={`${r.kind} ${r.title} ${r.subtitle ?? ''}`}
                      onSelect={() => goToEntity(r.kind, r.id, r.title)}
                    >
                      {r.kind === 'user'
                        ? <User className="mr-2 h-3.5 w-3.5 text-admin-info" aria-hidden />
                        : <FileText className="mr-2 h-3.5 w-3.5 text-admin-accent" aria-hidden />}
                      <span className="truncate">{r.title}</span>
                      {r.subtitle && <span className="ml-2 text-xs text-admin-faint truncate">{r.subtitle}</span>}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}

            <CommandSeparator className="bg-admin-line" />
            <CommandGroup heading="Ações">
              {commands.filter(c => c.group === 'Ações').map(cmd => (
                <CommandItem
                  key={cmd.id}
                  value={`${cmd.label} ${cmd.keywords.join(' ')}`}
                  onSelect={() => runCommand(cmd)}
                >
                  <cmd.icon className="mr-2 h-3.5 w-3.5 text-admin-muted" aria-hidden />
                  {cmd.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
