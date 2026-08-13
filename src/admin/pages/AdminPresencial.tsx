// src/admin/pages/AdminPresencial.tsx
import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import {
  QrCode, Printer, Plus, Pencil, UserSearch, ArrowLeftRight,
  Search, ShieldOff,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { AdminPageHeader } from '@/admin/components/ui/AdminPageHeader'
import { AdminPanel } from '@/admin/components/ui/AdminPanel'
import { AdminSectionHeader } from '@/admin/components/ui/AdminSectionHeader'
import { AdminEmptyState } from '@/admin/components/ui/AdminEmptyState'
import { AdminConfirmDialog } from '@/admin/components/ui/AdminConfirmDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { useAdminCan } from '@/admin/contexts/AdminAccessContext'
import { useDebounce } from '@/hooks/useDebounce'
import { localInputToUtcISO, utcISOToLocalInput } from '@/admin/lib/timezone'
import {
  useAdminPresencialSessions, useAdminPresencialSessionUpsert,
  useAdminPresencialQueue, useAdminPresencialLink, useAdminPresencialReassign,
  useAdminAccountEmailSearch, useAdminAccountAttempts,
} from '@/admin/hooks/useAdminPresencial'
import { useAdminSimuladoList } from '@/admin/hooks/useAdminTentativas'
import type { PresencialSessionRow, PresencialQueueRow, UserListRow, UserAttemptRow } from '@/admin/types'

const PRESENCIAL_BASE_URL = 'https://simulados.sanar.com.br/presencial'

const IDENTIFICATION_LABEL: Record<string, string> = {
  email_direct: 'E-mail direto',
  name_suggestion: 'Sugestão por nome',
  new_account: 'Conta nova',
  unlinked: 'Seguiu sem conta',
}

const inputCls = 'bg-admin-bg border-admin-line-strong text-admin-text placeholder:text-admin-faint'

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso))
}

function fmtShort(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso))
}

// ────────────────────────────────────────────────────────────────────────
// Página
// ────────────────────────────────────────────────────────────────────────

export default function AdminPresencial() {
  const canSessions = useAdminCan('content.manage')
  const canQueue = useAdminCan('attempts.manage')

  if (!canSessions && !canQueue) {
    return (
      <AdminEmptyState
        icon={ShieldOff}
        title="Sem acesso a esta área"
        description="Seu perfil não tem permissão para a aplicação presencial."
      />
    )
  }

  return (
    <div className="space-y-8 max-w-[1400px]">
      <AdminPageHeader
        title="Aplicação presencial"
        subtitle="Salas com QR para o dia da prova e a fila de quem não teve a identidade fechada automaticamente."
      />

      {/* CSS de impressão: some com tudo da tela e mostra só o painel de impressão,
          independente da estrutura do shell admin (sidebar/topbar) em volta. */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #presencial-print-sheet, #presencial-print-sheet * { visibility: visible; }
          #presencial-print-sheet {
            position: absolute !important;
            top: 0; left: 0; right: 0;
            transform: none !important;
            width: 100% !important;
            max-width: 100% !important;
            box-shadow: none !important;
            border: none !important;
          }
        }
      `}</style>

      {canSessions && <SessionsSection />}
      {canQueue && <QueueSection />}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────
// Sessões
// ────────────────────────────────────────────────────────────────────────

type SessionFormState = {
  id: string | null
  simulado_id: string
  code: string
  label: string
  opens_at: string
  closes_at: string
  is_active: boolean
}

const EMPTY_SESSION_FORM: SessionFormState = {
  id: null, simulado_id: '', code: '', label: '', opens_at: '', closes_at: '', is_active: true,
}

const SESSION_GRID = '1.6fr 1fr 1fr 1.3fr 90px 130px 170px'

function SessionsSection() {
  const { data: sessions, isLoading, isError } = useAdminPresencialSessions()
  const [formSession, setFormSession] = useState<PresencialSessionRow | 'new' | null>(null)
  const [printSession, setPrintSession] = useState<PresencialSessionRow | null>(null)

  return (
    <section className="space-y-3">
      <AdminSectionHeader
        title="Sessões (salas)"
        actions={
          <Button size="sm" onClick={() => setFormSession('new')}>
            <Plus className="h-4 w-4" aria-hidden />
            Nova sessão
          </Button>
        }
      />

      {isError ? (
        <AdminPanel>
          <AdminEmptyState tone="error" icon={QrCode} eyebrow="Erro" title="Não foi possível carregar as sessões" />
        </AdminPanel>
      ) : (
        <AdminPanel flush className="overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[900px]">
              <div
                className="grid text-[9px] font-bold text-admin-faint uppercase tracking-wide border-b border-admin-line"
                style={{ gridTemplateColumns: SESSION_GRID }}
              >
                {['Simulado', 'Código', 'Label', 'Janela', 'Ativa', 'Submissões', 'Ações'].map((h, i) => (
                  <div key={h} className={cn('px-4 py-2', i === 6 && 'text-right')}>{h}</div>
                ))}
              </div>

              {isLoading ? (
                [0, 1, 2].map(i => (
                  <div key={i} className="grid items-center border-b border-admin-line/40 last:border-0" style={{ gridTemplateColumns: SESSION_GRID }}>
                    {[0, 1, 2, 3, 4, 5, 6].map(c => (
                      <div key={c} className="px-4 py-3">
                        <div className="relative h-3 w-20 overflow-hidden rounded bg-admin-raised">
                          <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.4s_infinite] bg-gradient-to-r from-transparent via-admin-surface/70 to-transparent" />
                        </div>
                      </div>
                    ))}
                  </div>
                ))
              ) : (sessions ?? []).length === 0 ? (
                <AdminEmptyState
                  icon={QrCode}
                  eyebrow="Vazio"
                  title="Nenhuma sessão presencial ainda"
                  description="Crie uma sessão para gerar o QR da sala."
                />
              ) : (
                (sessions ?? []).map(s => (
                  <div
                    key={s.id}
                    className="grid items-center border-b border-admin-line/40 last:border-0 hover:bg-admin-raised/30 transition-colors"
                    style={{ gridTemplateColumns: SESSION_GRID }}
                  >
                    <div className="px-4 py-3 text-[11px] text-admin-text truncate" title={s.simulado_title}>
                      {s.simulado_title}
                    </div>
                    <div className="px-4 py-3 text-[11px] font-mono text-admin-muted truncate">{s.code}</div>
                    <div className="px-4 py-3 text-[11px] text-admin-text truncate">{s.label}</div>
                    <div className="px-4 py-3 text-[10.5px] text-admin-muted tabular-nums">
                      {fmtShort(s.opens_at)} – {fmtShort(s.closes_at)}
                    </div>
                    <div className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10.5px] font-semibold',
                          s.is_active
                            ? 'bg-admin-success/10 text-admin-success border-admin-success/30'
                            : 'bg-admin-raised text-admin-muted border-admin-line',
                        )}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
                        {s.is_active ? 'Ativa' : 'Inativa'}
                      </span>
                    </div>
                    <div className="px-4 py-3 text-[11px] text-admin-text tabular-nums">
                      {s.linked_count}/{s.submissions_count}
                      <span className="block text-[9.5px] text-admin-faint">vinculadas</span>
                    </div>
                    <div className="px-4 py-3 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        title="Imprimir QR"
                        aria-label={`Imprimir QR da sala ${s.label}`}
                        onClick={() => setPrintSession(s)}
                        className="w-7 h-7 rounded-md flex items-center justify-center text-admin-muted hover:text-admin-accent hover:bg-admin-accent/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admin-accent/40"
                      >
                        <Printer className="h-4 w-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        title="Editar sessão"
                        aria-label={`Editar sessão ${s.label}`}
                        onClick={() => setFormSession(s)}
                        className="w-7 h-7 rounded-md flex items-center justify-center text-admin-muted hover:text-admin-accent hover:bg-admin-accent/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admin-accent/40"
                      >
                        <Pencil className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </AdminPanel>
      )}

      <SessionFormDialog
        open={formSession !== null}
        session={formSession === 'new' ? null : formSession}
        onOpenChange={open => { if (!open) setFormSession(null) }}
      />
      <SessionPrintDialog
        session={printSession}
        onOpenChange={open => { if (!open) setPrintSession(null) }}
      />
    </section>
  )
}

function SessionFormDialog({
  open, session, onOpenChange,
}: {
  open: boolean
  session: PresencialSessionRow | null
  onOpenChange: (open: boolean) => void
}) {
  const { data: simulados } = useAdminSimuladoList()
  const upsert = useAdminPresencialSessionUpsert()
  const [form, setForm] = useState<SessionFormState>(EMPTY_SESSION_FORM)
  const [codeError, setCodeError] = useState<string | null>(null)
  const isEdit = !!session

  useEffect(() => {
    if (!open) return
    setCodeError(null)
    if (session) {
      setForm({
        id: session.id,
        simulado_id: session.simulado_id,
        code: session.code,
        label: session.label,
        opens_at: utcISOToLocalInput(session.opens_at),
        closes_at: utcISOToLocalInput(session.closes_at),
        is_active: session.is_active,
      })
    } else {
      setForm(EMPTY_SESSION_FORM)
    }
  }, [open, session])

  const set = <K extends keyof SessionFormState>(k: K, v: SessionFormState[K]) =>
    setForm(prev => ({ ...prev, [k]: v }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const code = form.code.trim().toLowerCase()
    if (!/^[a-z0-9-]{3,32}$/.test(code)) {
      setCodeError('Use só letras minúsculas, números e hífen (3 a 32 caracteres).')
      return
    }
    setCodeError(null)

    if (!form.opens_at || !form.closes_at) return
    if (localInputToUtcISO(form.closes_at) <= localInputToUtcISO(form.opens_at)) {
      setCodeError(null)
      return
    }

    upsert.mutate(
      {
        id: form.id,
        simulado_id: form.simulado_id,
        code,
        label: form.label.trim(),
        opens_at: localInputToUtcISO(form.opens_at),
        closes_at: localInputToUtcISO(form.closes_at),
        is_active: form.is_active,
      },
      { onSuccess: () => onOpenChange(false) },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-admin-surface border-admin-line text-admin-text sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-admin-text">{isEdit ? 'Editar sessão' : 'Nova sessão'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Simulado</Label>
            <select
              required
              value={form.simulado_id}
              onChange={e => set('simulado_id', e.target.value)}
              className="w-full bg-admin-bg border border-admin-line-strong rounded-md px-3 py-2 text-sm text-admin-text focus:outline-none focus-visible:ring-2 focus-visible:ring-admin-accent/30 focus-visible:border-admin-accent"
            >
              <option value="" disabled>Selecione o simulado</option>
              {(simulados ?? []).map((s: any) => (
                <option key={s.id} value={s.id}>#{s.sequence_number} — {s.title}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Código (na URL)</Label>
              <Input
                required
                className={cn(inputCls, 'font-mono')}
                value={form.code}
                onChange={e => set('code', e.target.value)}
                placeholder="sala-a"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Label (o que aparece na sala)</Label>
              <Input
                required
                className={inputCls}
                value={form.label}
                onChange={e => set('label', e.target.value)}
                placeholder="Sala A — Bloco 2"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Abre em <span className="font-normal text-admin-muted">(Brasília)</span></Label>
              <Input
                required
                type="datetime-local"
                className={cn(inputCls, 'font-mono')}
                value={form.opens_at}
                onChange={e => set('opens_at', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Fecha em <span className="font-normal text-admin-muted">(Brasília)</span></Label>
              <Input
                required
                type="datetime-local"
                className={cn(inputCls, 'font-mono')}
                value={form.closes_at}
                onChange={e => set('closes_at', e.target.value)}
              />
            </div>
          </div>

          {codeError && <p className="text-xs text-admin-destructive">{codeError}</p>}
          {form.opens_at && form.closes_at && localInputToUtcISO(form.closes_at) <= localInputToUtcISO(form.opens_at) && (
            <p className="text-xs text-admin-destructive">O fechamento precisa ser depois da abertura.</p>
          )}

          <div className="flex items-center justify-between rounded-lg border border-admin-line px-3 py-2.5">
            <div>
              <p className="text-xs font-semibold text-admin-text">Sessão ativa</p>
              <p className="text-[11px] text-admin-muted">Sessões inativas não aceitam novo check-in pelo QR.</p>
            </div>
            <Switch checked={form.is_active} onCheckedChange={v => set('is_active', v)} />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" className="border-admin-line bg-transparent text-admin-muted hover:bg-admin-raised hover:text-admin-text" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={upsert.isPending}>
              {upsert.isPending ? 'Salvando…' : isEdit ? 'Salvar alterações' : 'Criar sessão'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function SessionPrintDialog({
  session, onOpenChange,
}: {
  session: PresencialSessionRow | null
  onOpenChange: (open: boolean) => void
}) {
  if (!session) return null
  const url = `${PRESENCIAL_BASE_URL}/${session.code}`

  return (
    <Dialog open={!!session} onOpenChange={onOpenChange}>
      <DialogContent
        id="presencial-print-sheet"
        className="bg-admin-surface border-admin-line text-admin-text sm:max-w-md"
      >
        <DialogHeader className="print:hidden">
          <DialogTitle className="text-admin-text">Imprimir QR da sala</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-5 py-2 text-center">
          <div>
            <p className="text-lg font-extrabold text-admin-text">{session.label}</p>
            <p className="text-xs text-admin-muted mt-1">
              {fmtDateTime(session.opens_at)} até {fmtDateTime(session.closes_at)}
            </p>
          </div>

          <div className="rounded-xl border border-admin-line bg-white p-4">
            <QRCodeSVG value={url} size={240} level="M" />
          </div>

          <div>
            <p className="text-[11px] uppercase tracking-wide text-admin-faint font-bold mb-1">
              Não conseguiu ler o QR? Digite o endereço:
            </p>
            <p className="text-base font-mono font-bold text-admin-text break-all">{url}</p>
          </div>
        </div>

        <DialogFooter className="print:hidden">
          <Button type="button" variant="outline" className="border-admin-line bg-transparent text-admin-muted hover:bg-admin-raised hover:text-admin-text" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button type="button" onClick={() => window.print()}>
            <Printer className="h-4 w-4" aria-hidden />
            Imprimir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ────────────────────────────────────────────────────────────────────────
// Fila de identidade
// ────────────────────────────────────────────────────────────────────────

const QUEUE_GRID = '1.6fr 1.1fr 1fr 90px 110px 1.3fr 210px'

type ConfirmLink = {
  submissionId: string
  declaredName: string
  declaredEmail: string
  targetUserId: string
  targetEmail: string
  targetName: string | null
} | null

function QueueSection() {
  const [status, setStatus] = useState<'unlinked' | 'all'>('unlinked')
  const { data: rows, isLoading, isError } = useAdminPresencialQueue(status)
  const linkMutation = useAdminPresencialLink()

  const [confirmLink, setConfirmLink] = useState<ConfirmLink>(null)
  const [chooseAccountFor, setChooseAccountFor] = useState<PresencialQueueRow | null>(null)
  const [reassignOpen, setReassignOpen] = useState(false)

  const handleConfirmLink = () => {
    if (!confirmLink) return
    linkMutation.mutate(
      { submissionId: confirmLink.submissionId, userId: confirmLink.targetUserId },
      { onSuccess: () => setConfirmLink(null) },
    )
  }

  return (
    <section className="space-y-3">
      <AdminSectionHeader
        title="Fila de identidade"
        actions={
          <>
            <div role="tablist" aria-label="Filtrar fila" className="inline-flex rounded-lg border border-admin-line bg-admin-raised p-0.5">
              {(['unlinked', 'all'] as const).map(opt => (
                <button
                  key={opt}
                  role="tab"
                  aria-selected={status === opt}
                  onClick={() => setStatus(opt)}
                  className={cn(
                    'rounded-md px-3 py-1 text-xs font-semibold transition-colors',
                    status === opt ? 'bg-admin-surface text-admin-text shadow-sm' : 'text-admin-muted hover:text-admin-text',
                  )}
                >
                  {opt === 'unlinked' ? 'Pendentes' : 'Todas'}
                </button>
              ))}
            </div>
            <Button size="sm" variant="outline" className="border-admin-line bg-transparent text-admin-text hover:bg-admin-raised" onClick={() => setReassignOpen(true)}>
              <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden />
              Reatribuir tentativa
            </Button>
          </>
        }
      />

      <p className="text-[12px] text-admin-muted -mt-2">
        Submissões cuja identificação não fechou sozinha no dia da prova. Cada ação abaixo reescreve nota de aluno —
        confira nome, e-mail e a conta de destino antes de confirmar.
      </p>

      {isError ? (
        <AdminPanel>
          <AdminEmptyState tone="error" icon={UserSearch} eyebrow="Erro" title="Não foi possível carregar a fila" />
        </AdminPanel>
      ) : (
        <AdminPanel flush className="overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[1100px]">
              <div
                className="grid text-[9px] font-bold text-admin-faint uppercase tracking-wide border-b border-admin-line"
                style={{ gridTemplateColumns: QUEUE_GRID }}
              >
                {['Declarado', 'Identificação', 'Sala / hora', 'Nota', 'IP', 'Conta sugerida', 'Ações'].map((h, i) => (
                  <div key={h} className={cn('px-4 py-2', i === 6 && 'text-right')}>{h}</div>
                ))}
              </div>

              {isLoading ? (
                [0, 1, 2].map(i => (
                  <div key={i} className="grid items-center border-b border-admin-line/40 last:border-0" style={{ gridTemplateColumns: QUEUE_GRID }}>
                    {[0, 1, 2, 3, 4, 5, 6].map(c => (
                      <div key={c} className="px-4 py-3">
                        <div className="relative h-3 w-20 overflow-hidden rounded bg-admin-raised">
                          <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.4s_infinite] bg-gradient-to-r from-transparent via-admin-surface/70 to-transparent" />
                        </div>
                      </div>
                    ))}
                  </div>
                ))
              ) : (rows ?? []).length === 0 ? (
                <AdminEmptyState
                  icon={UserSearch}
                  eyebrow="Vazio"
                  title={status === 'unlinked' ? 'Nenhuma submissão pendente' : 'Nenhuma submissão encontrada'}
                  description="A fila fica vazia quando a identificação automática funciona no dia da prova."
                />
              ) : (
                (rows ?? []).map(row => (
                  <div
                    key={row.submission_id}
                    className="grid items-start border-b border-admin-line/40 last:border-0 hover:bg-admin-raised/30 transition-colors"
                    style={{ gridTemplateColumns: QUEUE_GRID }}
                  >
                    <div className="px-4 py-3 min-w-0">
                      <p className="text-xs font-medium text-admin-text truncate">{row.declared_name}</p>
                      <p className="text-[10px] text-admin-muted truncate">{row.declared_email}</p>
                    </div>
                    <div className="px-4 py-3 text-[11px] text-admin-muted">
                      {IDENTIFICATION_LABEL[row.identification_path] ?? row.identification_path}
                    </div>
                    <div className="px-4 py-3 text-[10.5px] text-admin-muted">
                      <p className="truncate">{row.session_label}</p>
                      <p className="tabular-nums text-admin-faint">{fmtShort(row.created_at)}</p>
                    </div>
                    <div className="px-4 py-3 text-xs font-semibold text-admin-text tabular-nums">
                      {row.score_percentage != null ? `${Number(row.score_percentage).toFixed(0)}%` : '—'}
                    </div>
                    <div className="px-4 py-3 text-[10px] font-mono text-admin-faint truncate" title={row.ip_hash ?? undefined}>
                      {row.ip_hash ? row.ip_hash.slice(0, 10) : '—'}
                    </div>
                    <div className="px-4 py-3 min-w-0">
                      {row.suggested_user_id ? (
                        <>
                          <p className="text-[11px] text-admin-text truncate">{row.suggested_name ?? '—'}</p>
                          <p className="text-[10px] text-admin-muted truncate">{row.suggested_email}</p>
                        </>
                      ) : (
                        <span className="text-[11px] text-admin-faint">Sem sugestão</span>
                      )}
                    </div>
                    <div className="px-4 py-3 flex flex-col items-end gap-1.5">
                      {row.suggested_user_id && (
                        <button
                          type="button"
                          onClick={() => setConfirmLink({
                            submissionId: row.submission_id,
                            declaredName: row.declared_name,
                            declaredEmail: row.declared_email,
                            targetUserId: row.suggested_user_id!,
                            targetEmail: row.suggested_email!,
                            targetName: row.suggested_name,
                          })}
                          className="w-full rounded-md border border-admin-accent/30 bg-admin-accent/10 px-2.5 py-1 text-[11px] font-semibold text-admin-accent hover:bg-admin-accent/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admin-accent/40"
                        >
                          Vincular a esta conta
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setChooseAccountFor(row)}
                        className="w-full rounded-md border border-admin-line-strong bg-admin-surface px-2.5 py-1 text-[11px] font-semibold text-admin-text hover:bg-admin-raised transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admin-accent/40"
                      >
                        Escolher outra conta
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </AdminPanel>
      )}

      <AdminConfirmDialog
        open={!!confirmLink}
        onOpenChange={open => { if (!open) setConfirmLink(null) }}
        title="Vincular esta submissão?"
        description={confirmLink && (
          <span className="block space-y-2 text-left">
            <span className="block">
              <strong className="text-admin-text">Declarado na sala:</strong>{' '}
              {confirmLink.declaredName} — {confirmLink.declaredEmail}
            </span>
            <span className="block">
              <strong className="text-admin-text">Vai entrar na conta:</strong>{' '}
              {confirmLink.targetName ?? '—'} — {confirmLink.targetEmail}
            </span>
            <span className="block text-admin-muted">
              A nota passa a valer para essa conta, do jeito que valeria se a identificação tivesse fechado sozinha na hora da prova.
            </span>
          </span>
        )}
        confirmLabel="Vincular"
        loading={linkMutation.isPending}
        onConfirm={handleConfirmLink}
      />

      <ChooseAccountDialog
        row={chooseAccountFor}
        onOpenChange={open => { if (!open) setChooseAccountFor(null) }}
        onChosen={(row, account) => {
          setChooseAccountFor(null)
          setConfirmLink({
            submissionId: row.submission_id,
            declaredName: row.declared_name,
            declaredEmail: row.declared_email,
            targetUserId: account.user_id,
            targetEmail: account.email,
            targetName: account.full_name,
          })
        }}
      />

      <ReassignDialog open={reassignOpen} onOpenChange={setReassignOpen} />
    </section>
  )
}

function EmailSearchField({
  value, onChange, onPick, excludeUserId,
}: {
  value: string
  onChange: (v: string) => void
  onPick: (account: UserListRow) => void
  excludeUserId?: string
}) {
  const debounced = useDebounce(value, 300)
  const { data: results, isFetching } = useAdminAccountEmailSearch(debounced)
  const filtered = (results ?? []).filter(r => r.user_id !== excludeUserId)

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-admin-faint" aria-hidden />
        <Input
          className={cn(inputCls, 'pl-9')}
          placeholder="Buscar por e-mail…"
          value={value}
          onChange={e => onChange(e.target.value)}
        />
      </div>
      {value.trim().length >= 3 && (
        <div className="rounded-lg border border-admin-line divide-y divide-admin-line/60 max-h-52 overflow-y-auto">
          {isFetching ? (
            <p className="px-3 py-2.5 text-xs text-admin-muted">Buscando…</p>
          ) : filtered.length === 0 ? (
            <p className="px-3 py-2.5 text-xs text-admin-muted">Nenhuma conta encontrada para este e-mail.</p>
          ) : (
            filtered.map(account => (
              <button
                key={account.user_id}
                type="button"
                onClick={() => onPick(account)}
                className="w-full text-left px-3 py-2 hover:bg-admin-raised transition-colors"
              >
                <p className="text-xs font-medium text-admin-text truncate">{account.full_name ?? '—'}</p>
                <p className="text-[10.5px] text-admin-muted truncate">{account.email}</p>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

function ChooseAccountDialog({
  row, onOpenChange, onChosen,
}: {
  row: PresencialQueueRow | null
  onOpenChange: (open: boolean) => void
  onChosen: (row: PresencialQueueRow, account: UserListRow) => void
}) {
  const [email, setEmail] = useState('')

  useEffect(() => { if (!row) setEmail('') }, [row])

  return (
    <Dialog open={!!row} onOpenChange={onOpenChange}>
      <DialogContent className="bg-admin-surface border-admin-line text-admin-text sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-admin-text">Escolher outra conta</DialogTitle>
        </DialogHeader>
        {row && (
          <div className="space-y-4">
            <div className="rounded-lg border border-admin-line bg-admin-bg/40 px-3 py-2 text-xs">
              <p className="text-admin-muted">Declarado na sala:</p>
              <p className="font-medium text-admin-text">{row.declared_name} — {row.declared_email}</p>
            </div>
            <EmailSearchField
              value={email}
              onChange={setEmail}
              onPick={account => onChosen(row, account)}
            />
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" className="border-admin-line bg-transparent text-admin-muted hover:bg-admin-raised hover:text-admin-text" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ────────────────────────────────────────────────────────────────────────
// Reatribuir tentativa entre contas
//
// admin_presencial_reassign move qualquer attempt para outra conta — não é
// uma ação por linha da fila (submissões `unlinked` ainda não têm attempt;
// o attempt só nasce quando a submissão é vinculada). Por isso é uma
// ferramenta independente: busca a conta de origem, escolhe a tentativa
// errada, busca a conta de destino, confirma.
// ────────────────────────────────────────────────────────────────────────

function ReassignDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [fromEmail, setFromEmail] = useState('')
  const [fromAccount, setFromAccount] = useState<UserListRow | null>(null)
  const [attempt, setAttempt] = useState<UserAttemptRow | null>(null)
  const [toEmail, setToEmail] = useState('')
  const [toAccount, setToAccount] = useState<UserListRow | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const { data: attempts, isFetching: loadingAttempts } = useAdminAccountAttempts(fromAccount?.user_id ?? null)
  const reassign = useAdminPresencialReassign()

  useEffect(() => {
    if (!open) {
      setFromEmail(''); setFromAccount(null); setAttempt(null)
      setToEmail(''); setToAccount(null); setConfirmOpen(false)
    }
  }, [open])

  const handleConfirm = () => {
    if (!attempt || !toAccount) return
    reassign.mutate(
      { attemptId: attempt.attempt_id, toUserId: toAccount.user_id },
      { onSuccess: () => { setConfirmOpen(false); onOpenChange(false) } },
    )
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-admin-surface border-admin-line text-admin-text sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-admin-text">Reatribuir tentativa entre contas</DialogTitle>
          </DialogHeader>

          <p className="text-[12px] text-admin-muted -mt-2">
            Use quando uma nota já vinculada foi presa à conta errada. Mova a tentativa da conta de origem para a de destino.
          </p>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>1. Conta de origem (onde a tentativa está hoje)</Label>
              {fromAccount ? (
                <div className="flex items-center justify-between rounded-lg border border-admin-line px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-admin-text truncate">{fromAccount.full_name ?? '—'}</p>
                    <p className="text-[10.5px] text-admin-muted truncate">{fromAccount.email}</p>
                  </div>
                  <button type="button" className="text-[11px] text-admin-accent underline shrink-0" onClick={() => { setFromAccount(null); setAttempt(null) }}>
                    Trocar
                  </button>
                </div>
              ) : (
                <EmailSearchField value={fromEmail} onChange={setFromEmail} onPick={setFromAccount} />
              )}
            </div>

            {fromAccount && (
              <div className="space-y-2">
                <Label>2. Tentativa a mover</Label>
                {loadingAttempts ? (
                  <p className="text-xs text-admin-muted">Carregando tentativas…</p>
                ) : (attempts ?? []).length === 0 ? (
                  <p className="text-xs text-admin-muted">Esta conta não tem tentativas.</p>
                ) : (
                  <div className="rounded-lg border border-admin-line divide-y divide-admin-line/60 max-h-40 overflow-y-auto">
                    {(attempts ?? []).map(a => (
                      <button
                        key={a.attempt_id}
                        type="button"
                        onClick={() => setAttempt(a)}
                        className={cn(
                          'w-full text-left px-3 py-2 hover:bg-admin-raised transition-colors',
                          attempt?.attempt_id === a.attempt_id && 'bg-admin-accent/10',
                        )}
                      >
                        <p className="text-xs font-medium text-admin-text truncate">
                          #{a.sequence_number} — {a.simulado_title}
                        </p>
                        <p className="text-[10.5px] text-admin-muted truncate">
                          {fmtShort(a.created_at)} · {a.status}
                          {a.score_percentage != null ? ` · ${a.score_percentage.toFixed(0)}%` : ''}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {attempt && (
              <div className="space-y-2">
                <Label>3. Conta de destino (para onde a tentativa vai)</Label>
                {toAccount ? (
                  <div className="flex items-center justify-between rounded-lg border border-admin-line px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-admin-text truncate">{toAccount.full_name ?? '—'}</p>
                      <p className="text-[10.5px] text-admin-muted truncate">{toAccount.email}</p>
                    </div>
                    <button type="button" className="text-[11px] text-admin-accent underline shrink-0" onClick={() => setToAccount(null)}>
                      Trocar
                    </button>
                  </div>
                ) : (
                  <EmailSearchField value={toEmail} onChange={setToEmail} onPick={setToAccount} excludeUserId={fromAccount?.user_id} />
                )}
              </div>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" className="border-admin-line bg-transparent text-admin-muted hover:bg-admin-raised hover:text-admin-text" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="button" disabled={!attempt || !toAccount} onClick={() => setConfirmOpen(true)}>
              Continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AdminConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Reatribuir esta tentativa?"
        description={attempt && toAccount && fromAccount && (
          <span className="block space-y-2 text-left">
            <span className="block">
              <strong className="text-admin-text">Tentativa:</strong> #{attempt.sequence_number} — {attempt.simulado_title} ({fmtShort(attempt.created_at)})
            </span>
            <span className="block">
              <strong className="text-admin-text">De:</strong> {fromAccount.full_name ?? '—'} — {fromAccount.email}
            </span>
            <span className="block">
              <strong className="text-admin-text">Para:</strong> {toAccount.full_name ?? '—'} — {toAccount.email}
            </span>
            <span className="block text-admin-muted">
              A nota sai do histórico e do ranking da conta de origem e passa a valer para a conta de destino.
            </span>
          </span>
        )}
        confirmLabel="Reatribuir"
        destructive
        loading={reassign.isPending}
        onConfirm={handleConfirm}
      />
    </>
  )
}
