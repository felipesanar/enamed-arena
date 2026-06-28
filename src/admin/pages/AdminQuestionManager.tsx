import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ChevronRight,
  ChevronLeft,
  Trash2,
  ScanSearch,
  Database,
  FileText,
} from 'lucide-react'
import { AdminCapabilityGate } from '@/admin/components/AdminCapabilityGate'
import { AdminPageHeader } from '@/admin/components/ui/AdminPageHeader'
import { AdminEmptyState } from '@/admin/components/ui/AdminEmptyState'
import { AdminPanel } from '@/admin/components/ui/AdminPanel'
import { AdminConfirmDialog } from '@/admin/components/ui/AdminConfirmDialog'
import { VerifyFindingsPanel } from '@/admin/components/VerifyFindingsPanel'
import {
  useAdminSimuladoQuestions,
  useUpdateQuestion,
  useUpdateOption,
  useSetCorrectOption,
  useDeleteQuestion,
} from '@/admin/hooks/useAdminQuestionEditor'
import { useAdminSimuladoQuestionStats } from '@/admin/hooks/useAdminSimuladosAnalytics'
import { useAdminSimuladoList } from '@/admin/hooks/useAdminTentativas'
import type { AdminQuestionFull, SimuladoQuestionStat } from '@/admin/types'
import { adminApi } from '@/admin/services/adminApi'
import type { QuestionVerifyFinding, QuestionVerifyInput } from '@/admin/services/adminApi'
import { chunk } from '@/admin/lib/chunk'
import { downscaleImage } from '@/admin/utils/downscaleImage'
import { logger } from '@/lib/logger'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

// ─── Dificuldade (segmentado) ────────────────────────────────────────────────

const DIFFICULTY_OPTIONS = [
  { value: 'easy', label: 'Fácil' },
  { value: 'medium', label: 'Médio' },
  { value: 'hard', label: 'Difícil' },
] as const

function DifficultySegment({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const normalized = value === 'easy' || value === 'hard' ? value : 'medium'
  return (
    <div
      role="radiogroup"
      aria-label="Dificuldade"
      className="inline-flex w-full rounded-lg border border-admin-line bg-admin-raised p-[3px]"
    >
      {DIFFICULTY_OPTIONS.map((opt) => {
        const active = normalized === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              'flex-1 rounded-md px-2 py-1.5 text-xs motion-safe:transition-colors',
              'focus:outline-none focus-visible:ring-1 focus-visible:ring-admin-accent',
              active
                ? 'bg-admin-surface font-semibold text-admin-text shadow-sm shadow-black/[0.08]'
                : 'font-medium text-admin-muted hover:text-admin-text',
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

// ─── Card "Desempenho nesta questão" ─────────────────────────────────────────

function PerformanceCard({
  stat,
  loading,
}: {
  stat: SimuladoQuestionStat | undefined
  loading: boolean
}) {
  return (
    <AdminPanel className="p-[15px]">
      <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.06em] text-admin-faint">
        Desempenho nesta questão
      </div>

      {loading ? (
        <div className="space-y-2.5">
          <div className="h-3 w-2/3 animate-pulse rounded bg-admin-raised" />
          <div className="h-1.5 w-full animate-pulse rounded-full bg-admin-raised" />
          <div className="h-3 w-full animate-pulse rounded bg-admin-raised" />
        </div>
      ) : !stat || stat.total_responses === 0 ? (
        <p className="text-[11px] leading-relaxed text-admin-faint">
          Ainda não há respostas para esta questão. Os números aparecem quando alunos
          começarem a respondê-la.
        </p>
      ) : (
        <>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs text-admin-muted">Acertaram</span>
            <span className="font-mono text-[13px] font-bold tabular-nums text-admin-success">
              {Math.round(stat.correct_rate)}%
            </span>
          </div>
          <div className="mb-2.5 h-1.5 overflow-hidden rounded-full bg-admin-raised">
            <div
              className="h-full rounded-full bg-admin-success"
              style={{ width: `${Math.min(100, Math.max(0, stat.correct_rate))}%` }}
            />
          </div>
          {stat.most_common_wrong_label ? (
            <p className="text-[11px] leading-relaxed text-admin-faint">
              Entre quem errou, a maioria marcou a alternativa{' '}
              <span className="font-semibold text-admin-muted">
                {stat.most_common_wrong_label}
              </span>
              {stat.most_common_wrong_pct != null
                ? ` (${Math.round(stat.most_common_wrong_pct)}%)`
                : ''}
              . Pode valer revisar o enunciado.
            </p>
          ) : (
            <p className="text-[11px] leading-relaxed text-admin-faint">
              {stat.total_responses} resposta{stat.total_responses === 1 ? '' : 's'} até agora.
            </p>
          )}
        </>
      )}
    </AdminPanel>
  )
}

// ─── Barra de navegação entre questões ───────────────────────────────────────

interface QuestionNavBarProps {
  questions: AdminQuestionFull[]
  current: number
  /** Números de questão com algum achado da verificação por IA. */
  flaggedNumbers: Set<number>
  /** Pede navegação para o índice (o workspace aplica a guarda de alterações). */
  onSelect: (index: number) => void
}

function QuestionNavBar({ questions, current, flaggedNumbers, onSelect }: QuestionNavBarProps) {
  const total = questions.length
  const [jump, setJump] = useState('')

  const submitJump = () => {
    const n = Number.parseInt(jump, 10)
    if (!Number.isNaN(n) && n >= 1 && n <= total) {
      onSelect(n - 1)
    }
    setJump('')
  }

  return (
    <div className="flex items-start gap-4 border-b border-admin-line bg-admin-surface px-6 py-2.5">
      <nav
        aria-label="Navegar entre as questões"
        className="flex max-h-[84px] flex-1 flex-wrap gap-1 overflow-y-auto"
      >
        {questions.map((q, i) => {
          const active = i === current
          const flagged = flaggedNumbers.has(q.question_number)
          return (
            <button
              key={q.id}
              type="button"
              aria-current={active ? 'true' : undefined}
              aria-label={`Ir para a questão ${q.question_number}${flagged ? ', com achado da verificação' : ''}`}
              onClick={() => onSelect(i)}
              title={`Questão ${q.question_number}${flagged ? ' · tem achado da verificação' : ''}`}
              className={cn(
                'relative h-7 min-w-[28px] rounded-md px-1.5 font-mono text-[11px] tabular-nums',
                'motion-safe:transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-admin-accent',
                active
                  ? 'bg-admin-accent font-semibold text-admin-accent-contrast'
                  : 'bg-admin-raised text-admin-muted hover:bg-admin-line hover:text-admin-text',
              )}
            >
              {q.question_number}
              {flagged && (
                <span
                  aria-hidden
                  className={cn(
                    'absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full',
                    active ? 'bg-admin-accent-contrast' : 'bg-admin-warning',
                  )}
                />
              )}
            </button>
          )
        })}
      </nav>

      <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
        <Label htmlFor="q-jump" className="whitespace-nowrap text-[11px] text-admin-faint">
          Ir para
        </Label>
        <Input
          id="q-jump"
          value={jump}
          onChange={(e) => setJump(e.target.value.replace(/\D/g, ''))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              submitJump()
            }
          }}
          onBlur={() => setJump('')}
          inputMode="numeric"
          placeholder="Nº"
          aria-label="Ir para o número da questão"
          className="h-7 w-14 border-admin-line bg-admin-raised text-center text-[12.5px] text-admin-text"
        />
      </div>
    </div>
  )
}

// ─── Editor de uma questão (corpo de dois painéis) ───────────────────────────

interface QuestionEditorHandle {
  /** Persiste a questão atual. Retorna true se salvou, false se a validação barrou. */
  persist: () => Promise<boolean>
}

interface QuestionEditorProps {
  question: AdminQuestionFull
  simuladoId: string
  stat: SimuladoQuestionStat | undefined
  statsLoading: boolean
  /** Informa o workspace se há alterações não salvas / se está salvando. */
  onMetaChange: (meta: { isDirty: boolean; isSaving: boolean }) => void
  /** Chamado após excluir a questão (o workspace ajusta o índice). */
  onAfterDelete: () => void
}

const QuestionEditor = forwardRef<QuestionEditorHandle, QuestionEditorProps>(
  function QuestionEditor(
    { question, simuladoId, stat, statsLoading, onMetaChange, onAfterDelete },
    ref,
  ) {
    const upd = useUpdateQuestion(simuladoId)
    const updOpt = useUpdateOption(simuladoId)
    const setCorrect = useSetCorrectOption(simuladoId)
    const del = useDeleteQuestion(simuladoId)

    // O componente é remontado por `key={question.id}`, então o estado inicial
    // pode vir direto da questão — sem efeito de seed.
    const initialCorrectId = useMemo(
      () => question.options.find((o) => o.is_correct)?.id ?? '',
      [question.options],
    )
    const initialOptionTexts = useMemo(() => {
      const texts: Record<string, string> = {}
      question.options.forEach((o) => {
        texts[o.id] = o.text ?? ''
      })
      return texts
    }, [question.options])

    const [text, setText] = useState(question.text ?? '')
    const [area, setArea] = useState(question.area ?? '')
    const [theme, setTheme] = useState(question.theme ?? '')
    const [difficulty, setDifficulty] = useState(question.difficulty ?? 'medium')
    const [explanation, setExplanation] = useState(question.explanation ?? '')
    const [imageUrl, setImageUrl] = useState(question.image_url ?? '')
    const [explanationImageUrl, setExplanationImageUrl] = useState(
      question.explanation_image_url ?? '',
    )
    const [imageUrl2, setImageUrl2] = useState(question.image_url_2 ?? '')
    const [optionTexts, setOptionTexts] = useState<Record<string, string>>(initialOptionTexts)
    const [correctId, setCorrectId] = useState(initialCorrectId)
    const [confirmDelete, setConfirmDelete] = useState(false)

    const sortedOptions = useMemo(
      () => [...question.options].sort((a, b) => a.label.localeCompare(b.label)),
      [question.options],
    )
    const saving = upd.isPending || updOpt.isPending || setCorrect.isPending

    const isDirty = useMemo(() => {
      if (text !== (question.text ?? '')) return true
      if (area !== (question.area ?? '')) return true
      if (theme !== (question.theme ?? '')) return true
      if (difficulty !== (question.difficulty ?? 'medium')) return true
      if (explanation !== (question.explanation ?? '')) return true
      if (imageUrl !== (question.image_url ?? '')) return true
      if (imageUrl2 !== (question.image_url_2 ?? '')) return true
      if (explanationImageUrl !== (question.explanation_image_url ?? '')) return true
      if (correctId !== initialCorrectId) return true
      for (const opt of question.options) {
        if ((optionTexts[opt.id] ?? '') !== (opt.text ?? '')) return true
      }
      return false
    }, [
      text,
      area,
      theme,
      difficulty,
      explanation,
      imageUrl,
      imageUrl2,
      explanationImageUrl,
      correctId,
      optionTexts,
      question,
      initialCorrectId,
    ])

    // Empurra o estado de edição para o workspace orquestrar a navegação.
    useEffect(() => {
      onMetaChange({ isDirty, isSaving: saving })
    }, [isDirty, saving, onMetaChange])

    const persist = useCallback(async (): Promise<boolean> => {
      // Guarda de qualidade: não permitir enunciado ou alternativa em branco.
      if (!text.trim()) {
        toast({ title: 'O enunciado não pode ficar vazio.', variant: 'destructive' })
        return false
      }
      if (sortedOptions.some((opt) => !(optionTexts[opt.id] ?? '').trim())) {
        toast({ title: 'Nenhuma alternativa pode ficar em branco.', variant: 'destructive' })
        return false
      }
      try {
        await upd.mutateAsync({
          id: question.id,
          payload: {
            text,
            area,
            theme,
            difficulty,
            explanation: explanation || null,
            image_url: imageUrl || null,
            explanation_image_url: explanationImageUrl || null,
            image_url_2: imageUrl2 || null,
          },
        })
        // Só atualiza alternativas cujo texto mudou.
        for (const opt of sortedOptions) {
          const next = optionTexts[opt.id] ?? ''
          if (next !== (opt.text ?? '')) {
            await updOpt.mutateAsync({ optionId: opt.id, text: next })
          }
        }
        if (correctId && correctId !== initialCorrectId) {
          await setCorrect.mutateAsync({ questionId: question.id, optionId: correctId })
        }
        return true
      } catch {
        // Erros já viram toast pelos hooks.
        return false
      }
    }, [
      text,
      area,
      theme,
      difficulty,
      explanation,
      imageUrl,
      imageUrl2,
      explanationImageUrl,
      correctId,
      optionTexts,
      sortedOptions,
      question.id,
      initialCorrectId,
      upd,
      updOpt,
      setCorrect,
    ])

    useImperativeHandle(ref, () => ({ persist }), [persist])

    return (
      <>
        {/* Dois painéis */}
        <div className="grid gap-6 bg-admin-bg-outer p-6 lg:grid-cols-[1.5fr_1fr]">
          {/* Esquerda */}
          <div className="space-y-[18px]">
            <div className="flex gap-3">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="q-area" className="text-admin-muted">
                  Área
                </Label>
                <Input
                  id="q-area"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  className="border-admin-line bg-admin-surface text-admin-text"
                />
              </div>
              <div className="flex-1 space-y-1.5">
                <Label className="text-admin-muted">Dificuldade</Label>
                <DifficultySegment value={difficulty} onChange={setDifficulty} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="q-theme" className="text-admin-muted">
                Tema
              </Label>
              <Input
                id="q-theme"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                className="border-admin-line bg-admin-surface text-admin-text"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="q-text" className="text-admin-muted">
                Enunciado
              </Label>
              <Textarea
                id="q-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={5}
                className="border-admin-line bg-admin-surface text-admin-text"
              />
            </div>

            {/* Alternativas */}
            <div className="space-y-2">
              <Label className="text-admin-muted">
                Alternativas{' '}
                <span className="font-normal text-admin-faint">
                  · marque a correta no círculo
                </span>
              </Label>
              <div className="flex flex-col gap-2">
                {sortedOptions.map((opt) => {
                  const isCorrect = correctId === opt.id
                  return (
                    <label
                      key={opt.id}
                      className={cn(
                        'flex cursor-pointer items-center gap-2.5 rounded-[9px] bg-admin-surface px-3 py-2.5',
                        'motion-safe:transition-colors',
                        isCorrect
                          ? 'border-[1.5px] border-admin-success'
                          : 'border border-admin-line hover:border-admin-line-strong',
                      )}
                    >
                      <input
                        type="radio"
                        name="correct"
                        value={opt.id}
                        checked={isCorrect}
                        onChange={() => setCorrectId(opt.id)}
                        aria-label={`Marcar alternativa ${opt.label} como correta`}
                        className="h-4 w-4 shrink-0 accent-admin-success"
                      />
                      <span
                        className={cn(
                          'w-4 shrink-0 font-mono text-xs font-semibold',
                          isCorrect ? 'text-admin-success' : 'text-admin-faint',
                        )}
                      >
                        {opt.label}
                      </span>
                      <Input
                        value={optionTexts[opt.id] ?? ''}
                        onChange={(e) =>
                          setOptionTexts((prev) => ({ ...prev, [opt.id]: e.target.value }))
                        }
                        aria-label={`Texto da alternativa ${opt.label}`}
                        className={cn(
                          'h-7 border-0 bg-transparent px-0 text-[12.5px] shadow-none focus-visible:ring-0',
                          isCorrect ? 'font-medium text-admin-text' : 'text-admin-text',
                        )}
                      />
                      {isCorrect && (
                        <span className="shrink-0 rounded-full bg-admin-success/10 px-2 py-0.5 text-[10.5px] font-semibold text-admin-success">
                          Correta
                        </span>
                      )}
                    </label>
                  )
                })}
              </div>
            </div>

            {/* Imagens (opcionais) */}
            <details className="rounded-lg border border-admin-line bg-admin-surface px-3 py-2">
              <summary className="cursor-pointer text-xs font-medium text-admin-muted">
                Imagens (opcional)
              </summary>
              <div className="mt-3 space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="q-image" className="text-admin-muted">
                    URL da imagem do enunciado
                  </Label>
                  <Input
                    id="q-image"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://…"
                    className="border-admin-line bg-admin-raised text-admin-text"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="q-image-2" className="text-admin-muted">
                    URL da segunda imagem do enunciado
                  </Label>
                  <Input
                    id="q-image-2"
                    value={imageUrl2}
                    onChange={(e) => setImageUrl2(e.target.value)}
                    placeholder="https://…"
                    className="border-admin-line bg-admin-raised text-admin-text"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="q-exp-image" className="text-admin-muted">
                    URL da imagem do comentário
                  </Label>
                  <Input
                    id="q-exp-image"
                    value={explanationImageUrl}
                    onChange={(e) => setExplanationImageUrl(e.target.value)}
                    placeholder="https://…"
                    className="border-admin-line bg-admin-raised text-admin-text"
                  />
                </div>
              </div>
            </details>
          </div>

          {/* Direita */}
          <div className="space-y-[18px]">
            <div className="space-y-1.5">
              <Label
                htmlFor="q-explanation"
                className="text-[11px] font-bold uppercase tracking-[0.08em] text-admin-faint"
              >
                Comentário do gabarito
              </Label>
              <Textarea
                id="q-explanation"
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                rows={6}
                className="border-admin-line bg-admin-surface text-[12.5px] text-admin-muted"
              />
            </div>

            <PerformanceCard stat={stat} loading={statsLoading} />

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmDelete(true)}
              className="text-admin-destructive hover:bg-admin-destructive/10 hover:text-admin-destructive"
            >
              <Trash2 className="mr-1 h-4 w-4" /> Excluir questão
            </Button>

            <p className="text-[11px] leading-relaxed text-admin-faint">
              Salvar não recalcula tentativas que já foram finalizadas.
            </p>
          </div>
        </div>

        <AdminConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title="Excluir questão"
          description="Esta ação não pode ser desfeita. Se a questão já foi respondida, a exclusão é bloqueada."
          confirmLabel="Excluir"
          destructive
          loading={del.isPending}
          onConfirm={() =>
            del.mutate(question.id, {
              onSuccess: () => {
                setConfirmDelete(false)
                onAfterDelete()
              },
            })
          }
        />
      </>
    )
  },
)

// ─── Editor com lista de questões + verificação por IA ───────────────────────

interface QuestionWorkspaceProps {
  simuladoId: string
  /** Rótulo curto do simulado (mostrado no header). */
  simuladoLabel?: string
  /** Volta para o picker do banco; ausente em /simulados/:id/questoes/editar. */
  onBackToBank?: () => void
}

function QuestionWorkspace({ simuladoId, simuladoLabel, onBackToBank }: QuestionWorkspaceProps) {
  const { data: questions = [], isLoading, isError, refetch } = useAdminSimuladoQuestions(simuladoId)
  const { data: stats = [], isLoading: statsLoading } = useAdminSimuladoQuestionStats(simuladoId)
  const [current, setCurrent] = useState(0)
  const [findings, setFindings] = useState<QuestionVerifyFinding[]>([])
  const [verifying, setVerifying] = useState(false)
  const [verifyRan, setVerifyRan] = useState(false)

  // Orquestração de navegação com guarda de alterações.
  const editorRef = useRef<QuestionEditorHandle>(null)
  const [editorMeta, setEditorMeta] = useState({ isDirty: false, isSaving: false })
  const [pendingTarget, setPendingTarget] = useState<number | null>(null)

  const total = questions.length

  // Mantém o índice dentro dos limites quando a lista muda (ex.: após excluir).
  useEffect(() => {
    if (current > total - 1) {
      setCurrent(Math.max(0, total - 1))
    }
  }, [total, current])

  const statByNumber = useMemo(() => {
    const map = new Map<number, SimuladoQuestionStat>()
    stats.forEach((s) => map.set(s.question_number, s))
    return map
  }, [stats])

  const flaggedNumbers = useMemo(() => {
    const set = new Set<number>()
    findings.forEach((f) => set.add(f.question_number))
    return set
  }, [findings])

  const onMetaChange = useCallback((meta: { isDirty: boolean; isSaving: boolean }) => {
    setEditorMeta((prev) =>
      prev.isDirty === meta.isDirty && prev.isSaving === meta.isSaving ? prev : meta,
    )
  }, [])

  const go = useCallback(
    (target: number) => {
      setCurrent(Math.min(total - 1, Math.max(0, target)))
    },
    [total],
  )

  // Todos os gatilhos de navegação passam por aqui: aplica a guarda se houver
  // alterações não salvas.
  const requestNavigate = useCallback(
    (target: number) => {
      if (editorMeta.isSaving) return
      if (target < 0 || target > total - 1 || target === current) return
      if (editorMeta.isDirty) {
        setPendingTarget(target)
      } else {
        go(target)
      }
    },
    [total, current, editorMeta.isDirty, editorMeta.isSaving, go],
  )

  const handleSavePrimary = useCallback(async () => {
    const ok = await editorRef.current?.persist()
    if (ok && current < total - 1) {
      go(current + 1)
    }
  }, [current, total, go])

  // Ações do diálogo de guarda.
  const handleGuardSave = useCallback(async () => {
    const target = pendingTarget
    const ok = await editorRef.current?.persist()
    if (ok && target != null) {
      go(target)
    }
    // Se a validação barrou (ok === false), fica na questão para corrigir.
    setPendingTarget(null)
  }, [pendingTarget, go])

  const handleGuardDiscard = useCallback(() => {
    if (pendingTarget != null) {
      go(pendingTarget)
    }
    setPendingTarget(null)
  }, [pendingTarget, go])

  const runVerify = async () => {
    setVerifying(true)
    try {
      const fetchToBase64 = async (
        url: string,
      ): Promise<{ base64: string; mime: string } | null> => {
        try {
          const res = await fetch(url)
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          const mime = res.headers.get('content-type')?.split(';')[0]?.trim() || 'image/jpeg'
          const bytes = new Uint8Array(await res.arrayBuffer())
          let bin = ''
          const CH = 0x8000
          for (let i = 0; i < bytes.length; i += CH) {
            bin += String.fromCharCode.apply(
              null,
              bytes.subarray(i, i + CH) as unknown as number[],
            )
          }
          const base64 = btoa(bin)
          return { base64, mime }
        } catch (err) {
          logger.error('[AdminQuestionManager] Falha ao buscar imagem:', err)
          return null
        }
      }

      const inputs: QuestionVerifyInput[] = await Promise.all(
        questions.map(async (q) => {
          const imgs: QuestionVerifyInput['images'] = []
          const slots: Array<{
            url: string | null | undefined
            slot: 'enunciado' | 'enunciado2' | 'comentario'
          }> = [
            { url: q.image_url, slot: 'enunciado' },
            { url: q.image_url_2, slot: 'enunciado2' },
            { url: q.explanation_image_url, slot: 'comentario' },
          ]
          for (const { url, slot } of slots) {
            if (!url) continue
            const fetched = await fetchToBase64(url)
            if (!fetched) continue
            const d = await downscaleImage(fetched.base64, fetched.mime)
            imgs.push({ slot, mime: d.mime, base64: d.base64 })
          }
          return {
            question_number: q.question_number,
            enunciado_text: q.text ?? '',
            comentario_text: q.explanation ?? '',
            images: imgs,
          }
        }),
      )

      const batches = chunk(inputs, 7)
      const results: QuestionVerifyFinding[] = []
      const concurrency = 4
      let cursor = 0

      async function worker() {
        while (cursor < batches.length) {
          const my = cursor++
          const batch = batches[my]
          if (!batch) return
          const part = await adminApi.verifyQuestions(batch)
          results.push(...part)
        }
      }
      await Promise.all(
        Array.from({ length: Math.min(concurrency, batches.length || 1) }, worker),
      )

      setFindings(results)
      setVerifyRan(true)
    } catch {
      toast({ title: 'Erro ao verificar questões com a IA.', variant: 'destructive' })
    } finally {
      setVerifying(false)
    }
  }

  const question = questions[current]

  return (
    <div className="mx-auto max-w-[1100px] space-y-6">
      <AdminPageHeader
        title="Editar questões"
        subtitle={
          isLoading
            ? 'Carregando…'
            : `${simuladoLabel ? `${simuladoLabel} · ` : ''}${total} ${total === 1 ? 'questão' : 'questões'}`
        }
        actions={
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={runVerify}
              disabled={verifying || isLoading || total === 0}
              className="border-admin-line bg-transparent text-admin-muted hover:bg-admin-raised hover:text-admin-text"
            >
              <ScanSearch className="mr-1.5 h-4 w-4" />
              {verifying ? 'Verificando…' : 'Verificar com IA'}
            </Button>
            {onBackToBank ? (
              <button
                type="button"
                onClick={onBackToBank}
                className="text-xs text-admin-muted hover:text-admin-text motion-safe:transition-colors"
              >
                ← Trocar de simulado
              </button>
            ) : (
              <Link
                to="/admin/simulados"
                className="text-xs text-admin-muted hover:text-admin-text motion-safe:transition-colors"
              >
                ← Voltar aos simulados
              </Link>
            )}
          </div>
        }
      />

      {(verifyRan || verifying) && (
        <VerifyFindingsPanel findings={findings} loading={verifying} aiRan={verifyRan} />
      )}

      {isError ? (
        <AdminEmptyState
          tone="error"
          eyebrow="Erro"
          title="Não foi possível carregar as questões"
          description="Verifique a conexão e tente novamente."
          action={
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              Tentar de novo
            </Button>
          }
        />
      ) : isLoading ? (
        <AdminPanel flush className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-admin-line px-6 py-3">
            <div className="h-3 w-40 animate-pulse rounded bg-admin-raised" />
            <div className="h-8 w-44 animate-pulse rounded-md bg-admin-raised" />
          </div>
          <div className="grid gap-6 bg-admin-bg-outer p-6 lg:grid-cols-[1.5fr_1fr]">
            <div className="space-y-4">
              <div className="h-9 w-full animate-pulse rounded-md bg-admin-raised" />
              <div className="h-24 w-full animate-pulse rounded-md bg-admin-raised" />
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-11 w-full animate-pulse rounded-[9px] bg-admin-raised" />
                ))}
              </div>
            </div>
            <div className="space-y-4">
              <div className="h-32 w-full animate-pulse rounded-md bg-admin-raised" />
              <div className="h-24 w-full animate-pulse rounded-xl bg-admin-raised" />
            </div>
          </div>
        </AdminPanel>
      ) : total === 0 ? (
        <AdminEmptyState
          icon={FileText}
          title="Este simulado ainda não tem questões"
          description="Envie a planilha de questões primeiro. Depois você poderá editar cada uma aqui."
          action={
            <Button asChild size="sm">
              <Link to={`/admin/simulados/${simuladoId}/questoes`}>Enviar planilha</Link>
            </Button>
          }
        />
      ) : question ? (
        <AdminPanel flush className="overflow-hidden">
          {/* Topbar de navegação */}
          <div className="flex items-center justify-between gap-3 border-b border-admin-line px-6 py-3">
            <div className="flex items-center gap-2 text-[12.5px]">
              <span className="text-admin-faint">Banco de questões</span>
              <ChevronRight className="h-3 w-3 text-admin-faint" aria-hidden />
              <span className="font-semibold text-admin-text" aria-live="polite">
                Questão {current + 1} de {total}
              </span>
              {editorMeta.isDirty && (
                <span className="rounded-full bg-admin-warning/10 px-2 py-0.5 text-[10.5px] font-semibold text-admin-warning">
                  Não salvo
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => requestNavigate(current - 1)}
                disabled={current === 0 || editorMeta.isSaving}
                className="text-admin-muted hover:bg-admin-raised hover:text-admin-text"
              >
                <ChevronLeft className="mr-1 h-4 w-4" aria-hidden />
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => requestNavigate(current + 1)}
                disabled={current >= total - 1 || editorMeta.isSaving}
                className="border-admin-line bg-transparent text-admin-muted hover:bg-admin-raised hover:text-admin-text"
              >
                Próxima
                <ChevronRight className="ml-1 h-4 w-4" aria-hidden />
              </Button>
              <Button size="sm" onClick={handleSavePrimary} disabled={editorMeta.isSaving}>
                {editorMeta.isSaving
                  ? 'Salvando…'
                  : current >= total - 1
                    ? 'Salvar'
                    : 'Salvar e próxima'}
              </Button>
            </div>
          </div>

          {/* Barra de navegação entre questões */}
          <QuestionNavBar
            questions={questions}
            current={current}
            flaggedNumbers={flaggedNumbers}
            onSelect={requestNavigate}
          />

          <QuestionEditor
            key={question.id}
            ref={editorRef}
            question={question}
            simuladoId={simuladoId}
            stat={statByNumber.get(question.question_number)}
            statsLoading={statsLoading}
            onMetaChange={onMetaChange}
            onAfterDelete={() => {
              // A questão saiu: limpa o estado de edição (senão a guarda fica
              // presa em "sujo") e mantém o índice dentro do novo tamanho —
              // assim, ao excluir uma do meio, mostra a próxima em vez de recuar.
              setEditorMeta({ isDirty: false, isSaving: false })
              setCurrent((i) => Math.min(i, Math.max(0, total - 2)))
            }}
          />
        </AdminPanel>
      ) : null}

      {/* Guarda de alterações não salvas */}
      <Dialog
        open={pendingTarget != null}
        onOpenChange={(open) => {
          if (!open) setPendingTarget(null)
        }}
      >
        <DialogContent className="border-admin-line bg-admin-surface text-admin-text sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-admin-text">Alterações não salvas</DialogTitle>
            <DialogDescription className="text-admin-muted">
              Você fez alterações nesta questão que ainda não foram salvas. O que deseja fazer
              antes de continuar?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="ghost"
              onClick={() => setPendingTarget(null)}
              className="text-admin-muted hover:bg-admin-raised hover:text-admin-text"
            >
              Cancelar
            </Button>
            <Button
              variant="outline"
              onClick={handleGuardDiscard}
              disabled={editorMeta.isSaving}
              className="border-admin-line bg-transparent text-admin-muted hover:bg-admin-raised hover:text-admin-text"
            >
              Descartar e ir
            </Button>
            <Button onClick={handleGuardSave} disabled={editorMeta.isSaving}>
              {editorMeta.isSaving ? 'Salvando…' : 'Salvar e ir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Banco de questões: escolher simulado ────────────────────────────────────

function SimuladoPicker({ onPick }: { onPick: (id: string) => void }) {
  const { data: simulados = [], isLoading, isError, refetch } = useAdminSimuladoList()

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Banco de questões"
        subtitle="Escolha um simulado para navegar e editar suas questões"
      />

      {isError ? (
        <AdminEmptyState
          tone="error"
          eyebrow="Erro"
          title="Não foi possível carregar os simulados"
          description="Verifique a conexão e tente novamente."
          action={
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              Tentar de novo
            </Button>
          }
        />
      ) : isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-admin-raised" />
          ))}
        </div>
      ) : simulados.length === 0 ? (
        <AdminEmptyState
          icon={Database}
          title="Nenhum simulado cadastrado"
          description="Crie um simulado e envie suas questões para começar a editar."
          action={
            <Button asChild size="sm">
              <Link to="/admin/simulados/novo">Criar simulado</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {simulados.map((s: any) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onPick(s.id)}
              className="group text-left"
            >
              <AdminPanel hover className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold text-admin-text">{s.title}</p>
                  <p className="mt-0.5 text-xs text-admin-muted">
                    <span className="font-mono tabular-nums">Simulado {s.sequence_number}</span>
                    {typeof s.questions_count === 'number'
                      ? ` · ${s.questions_count} ${s.questions_count === 1 ? 'questão' : 'questões'}`
                      : ''}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-admin-faint group-hover:text-admin-text" aria-hidden />
              </AdminPanel>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Página ──────────────────────────────────────────────────────────────────

/**
 * Rota /admin/simulados/:id/questoes/editar → edita direto as questões do simulado.
 * Rota /admin/questoes (Banco de questões) → escolhe o simulado.
 * Rota /admin/questoes/:simuladoId → entra direto no editor (link compartilhável,
 *   suporta voltar/avançar do navegador).
 */
function AdminQuestionManagerContent() {
  // `id` vem de /admin/simulados/:id/questoes/editar.
  // `simuladoId` vem do deep-link do banco /admin/questoes/:simuladoId.
  const { id, simuladoId } = useParams<{ id: string; simuladoId: string }>()
  const navigate = useNavigate()

  // Entrada por simulado (edição direta): :id presente na URL.
  if (id) {
    return <QuestionWorkspace simuladoId={id} />
  }

  // Entrada pelo banco com simulado escolhido: URL persistente em /admin/questoes/:simuladoId.
  if (simuladoId) {
    return (
      <QuestionWorkspace
        simuladoId={simuladoId}
        onBackToBank={() => navigate('/admin/questoes')}
      />
    )
  }

  // Banco sem simulado escolhido: mostra o seletor. Ao escolher, navega para o
  // deep-link — assim a URL guarda a escolha e dá pra voltar/compartilhar.
  return <SimuladoPicker onPick={(pickedId) => navigate(`/admin/questoes/${pickedId}`)} />
}

export default function AdminQuestionManager() {
  return (
    <AdminCapabilityGate capability="content.manage">
      <AdminQuestionManagerContent />
    </AdminCapabilityGate>
  )
}
