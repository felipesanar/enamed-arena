import { Check, ChevronDown } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

type Segment = 'guest' | 'standard' | 'pro'

interface SegmentOption {
  value: Segment
  /** Cor do bullet (token admin). */
  dotClass: string
  label: string
  description: string
}

const SEGMENT_OPTIONS: SegmentOption[] = [
  { value: 'guest',    dotClass: 'bg-admin-faint',   label: 'Visitante',       description: 'Só conteúdo gratuito' },
  { value: 'standard', dotClass: 'bg-admin-info',    label: 'Aluno SanarFlix', description: 'Acesso pela assinatura' },
  { value: 'pro',      dotClass: 'bg-admin-accent',  label: 'Aluno PRO',       description: 'Acesso completo' },
]

interface AdminSegmentPopoverProps {
  value: Segment
  onChange: (segment: Segment) => void
  /** Desabilita a troca enquanto a mutação roda. */
  disabled?: boolean
}

/**
 * Botão que abre um popover para escolher o segmento do usuário.
 * Cada opção tem bullet colorido, nome e descrição; a opção atual fica
 * destacada (fundo accent suave + check). Usado na aba "Acesso e perfil".
 */
export function AdminSegmentPopover({ value, onChange, disabled }: AdminSegmentPopoverProps) {
  const current = SEGMENT_OPTIONS.find(o => o.value === value) ?? SEGMENT_OPTIONS[0]

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label="Escolher segmento"
          className={cn(
            'inline-flex items-center gap-2 rounded-md border border-admin-line-strong bg-admin-surface',
            'px-3 py-2 text-[13px] font-semibold text-admin-text',
            'transition-colors hover:bg-admin-raised',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admin-accent/20 focus-visible:border-admin-accent',
            'disabled:opacity-50 disabled:pointer-events-none',
          )}
        >
          <span className={cn('h-2 w-2 shrink-0 rounded-full', current.dotClass)} aria-hidden />
          {current.label}
          <ChevronDown className="h-3.5 w-3.5 text-admin-muted" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-60 rounded-xl border-admin-line bg-admin-surface p-1.5 text-admin-text shadow-[0_12px_32px_rgba(26,23,21,0.16)] dark:shadow-black/50"
      >
        <p className="px-2.5 py-2 text-[10px] font-bold uppercase tracking-[0.06em] text-admin-faint">
          Escolher segmento
        </p>
        <div className="flex flex-col">
          {SEGMENT_OPTIONS.map(option => {
            const active = option.value === value
            return (
              <button
                key={option.value}
                type="button"
                disabled={disabled}
                onClick={() => onChange(option.value)}
                className={cn(
                  'flex items-start gap-2.5 rounded-lg px-2.5 py-2.5 text-left',
                  'transition-colors disabled:pointer-events-none disabled:opacity-50',
                  active
                    ? 'border border-admin-accent/20 bg-admin-accent/10'
                    : 'border border-transparent hover:bg-admin-raised',
                )}
              >
                <span className={cn('mt-1 h-2 w-2 shrink-0 rounded-full', option.dotClass)} aria-hidden />
                <span className="flex-1 min-w-0">
                  <span className={cn('block text-[13px] font-semibold', active ? 'text-admin-accent' : 'text-admin-text')}>
                    {option.label}
                  </span>
                  <span className="block text-[11px] text-admin-muted">
                    {option.description}{active ? ' · atual' : ''}
                  </span>
                </span>
                {active && <Check className="mt-0.5 h-4 w-4 shrink-0 text-admin-accent" aria-hidden />}
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
