import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Trash2, ScanSearch } from 'lucide-react'
import { AdminCapabilityGate } from '@/admin/components/AdminCapabilityGate'
import { AdminPageHeader } from '@/admin/components/ui/AdminPageHeader'
import { AdminEmptyState } from '@/admin/components/ui/AdminEmptyState'
import { AdminConfirmDialog } from '@/admin/components/ui/AdminConfirmDialog'
import { VerifyFindingsPanel } from '@/admin/components/VerifyFindingsPanel'
import {
  useAdminSimuladoQuestions,
  useUpdateQuestion,
  useUpdateOption,
  useSetCorrectOption,
  useDeleteQuestion,
} from '@/admin/hooks/useAdminQuestionEditor'
import type { AdminQuestionFull } from '@/admin/types'
import { adminApi } from '@/admin/services/adminApi'
import type { QuestionVerifyFinding, QuestionVerifyInput } from '@/admin/services/adminApi'
import { chunk } from '@/admin/lib/chunk'
import { downscaleImage } from '@/admin/utils/downscaleImage'
import { logger } from '@/lib/logger'
import { toast } from '@/hooks/use-toast'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

function truncate(text: string, max = 80): string {
  return text.length > max ? text.slice(0, max) + '…' : text
}

// ─── Dialog de edição ──────────────────────────────────────────────────────

interface QuestionEditDialogProps {
  question: AdminQuestionFull
  simuladoId: string
  onClose: () => void
}

function QuestionEditDialog({ question, simuladoId, onClose }: QuestionEditDialogProps) {
  const upd = useUpdateQuestion(simuladoId)
  const updOpt = useUpdateOption(simuladoId)
  const setCorrect = useSetCorrectOption(simuladoId)
  const del = useDeleteQuestion(simuladoId)

  const [text, setText] = useState('')
  const [area, setArea] = useState('')
  const [theme, setTheme] = useState('')
  const [difficulty, setDifficulty] = useState('medium')
  const [explanation, setExplanation] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [explanationImageUrl, setExplanationImageUrl] = useState('')
  const [imageUrl2, setImageUrl2] = useState('')
  const [optionTexts, setOptionTexts] = useState<Record<string, string>>({})
  const [correctId, setCorrectId] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Reinicializa o estado quando a questão muda
  useEffect(() => {
    setText(question.text ?? '')
    setArea(question.area ?? '')
    setTheme(question.theme ?? '')
    setDifficulty(question.difficulty ?? 'medium')
    setExplanation(question.explanation ?? '')
    setImageUrl(question.image_url ?? '')
    setExplanationImageUrl(question.explanation_image_url ?? '')
    setImageUrl2(question.image_url_2 ?? '')
    const texts: Record<string, string> = {}
    question.options.forEach((o) => { texts[o.id] = o.text ?? '' })
    setOptionTexts(texts)
    setCorrectId(question.options.find((o) => o.is_correct)?.id ?? '')
    setConfirmDelete(false)
  }, [question.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const sortedOptions = [...question.options].sort((a, b) => a.label.localeCompare(b.label))
  const originalCorrectId = question.options.find((o) => o.is_correct)?.id ?? ''
  const saving = upd.isPending || updOpt.isPending || setCorrect.isPending

  const handleSave = async () => {
    // Guarda de qualidade: não permitir enunciado ou alternativa em branco.
    if (!text.trim()) {
      toast({ title: 'O enunciado não pode ficar vazio.', variant: 'destructive' })
      return
    }
    if (sortedOptions.some((opt) => !(optionTexts[opt.id] ?? '').trim())) {
      toast({ title: 'Nenhuma alternativa pode ficar em branco.', variant: 'destructive' })
      return
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
      // Só atualiza alternativas cujo texto mudou
      for (const opt of sortedOptions) {
        const next = optionTexts[opt.id] ?? ''
        if (next !== (opt.text ?? '')) {
          await updOpt.mutateAsync({ optionId: opt.id, text: next })
        }
      }
      if (correctId && correctId !== originalCorrectId) {
        await setCorrect.mutateAsync({ questionId: question.id, optionId: correctId })
      }
      onClose()
    } catch {
      // Erros já viram toast pelos hooks; mantém o dialog aberto.
    }
  }

  return (
    <>
      <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
        <DialogContent className="bg-admin-surface border-admin-line text-admin-text max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-admin-text">
              Editar questão #{question.question_number}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="q-text" className="text-admin-muted">Enunciado</Label>
              <Textarea
                id="q-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={5}
                className="bg-admin-raised border-admin-line text-admin-text"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="q-area" className="text-admin-muted">Área</Label>
                <Input
                  id="q-area"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  className="bg-admin-raised border-admin-line text-admin-text"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="q-theme" className="text-admin-muted">Tema</Label>
                <Input
                  id="q-theme"
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  className="bg-admin-raised border-admin-line text-admin-text"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="q-difficulty" className="text-admin-muted">Dificuldade</Label>
              <select
                id="q-difficulty"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="w-full h-9 rounded-md bg-admin-raised border border-admin-line text-admin-text text-sm px-3 focus:outline-none focus:ring-1 focus:ring-admin-accent"
              >
                <option value="easy">Fácil</option>
                <option value="medium">Média</option>
                <option value="hard">Difícil</option>
              </select>
            </div>

            {/* Alternativas */}
            <div className="space-y-2">
              <Label className="text-admin-muted">Alternativas</Label>
              <div className="space-y-2">
                {sortedOptions.map((opt) => (
                  <div key={opt.id} className="flex items-center gap-2">
                    <label
                      className="flex items-center gap-1.5 shrink-0 cursor-pointer"
                      title="Marcar como correta"
                    >
                      <input
                        type="radio"
                        name="correct"
                        value={opt.id}
                        checked={correctId === opt.id}
                        onChange={() => setCorrectId(opt.id)}
                        aria-label={`Marcar alternativa ${opt.label} como correta`}
                        className="h-4 w-4 accent-admin-accent"
                      />
                      <span className="w-5 text-sm font-bold text-admin-muted">{opt.label}</span>
                    </label>
                    <Input
                      value={optionTexts[opt.id] ?? ''}
                      onChange={(e) =>
                        setOptionTexts((prev) => ({ ...prev, [opt.id]: e.target.value }))
                      }
                      aria-label={`Texto da alternativa ${opt.label}`}
                      className="bg-admin-raised border-admin-line text-admin-text"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="q-explanation" className="text-admin-muted">Explicação</Label>
              <Textarea
                id="q-explanation"
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                rows={4}
                className="bg-admin-raised border-admin-line text-admin-text"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="q-image" className="text-admin-muted">URL da imagem (enunciado)</Label>
              <Input
                id="q-image"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://…"
                className="bg-admin-raised border-admin-line text-admin-text"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="q-image-2" className="text-admin-muted">URL da imagem 2 (enunciado)</Label>
              <Input
                id="q-image-2"
                value={imageUrl2}
                onChange={(e) => setImageUrl2(e.target.value)}
                placeholder="https://…"
                className="bg-admin-raised border-admin-line text-admin-text"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="q-exp-image" className="text-admin-muted">URL da imagem (explicação)</Label>
              <Input
                id="q-exp-image"
                value={explanationImageUrl}
                onChange={(e) => setExplanationImageUrl(e.target.value)}
                placeholder="https://…"
                className="bg-admin-raised border-admin-line text-admin-text"
              />
            </div>

            <p className="text-xs text-admin-muted">
              Alterações não recalculam tentativas já finalizadas.
            </p>
          </div>

          <div className="flex items-center justify-between gap-2 pt-2">
            <Button
              variant="ghost"
              onClick={() => setConfirmDelete(true)}
              className="text-admin-destructive hover:bg-admin-destructive/10 hover:text-admin-destructive"
            >
              <Trash2 className="h-4 w-4 mr-1" /> Excluir
            </Button>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={onClose}
                className="border-admin-line bg-transparent text-admin-muted hover:bg-admin-raised hover:text-admin-text"
              >
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Salvando…' : 'Salvar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AdminConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Excluir questão"
        description="Esta ação é irreversível. Se a questão já foi respondida, a exclusão será bloqueada."
        confirmLabel="Excluir"
        destructive
        loading={del.isPending}
        onConfirm={() => del.mutate(question.id, { onSuccess: onClose })}
      />
    </>
  )
}

// ─── Página ────────────────────────────────────────────────────────────────

function AdminQuestionManagerContent() {
  const { id } = useParams<{ id: string }>()
  const { data: questions = [], isLoading, isError } = useAdminSimuladoQuestions(id!)
  const [editing, setEditing] = useState<AdminQuestionFull | null>(null)
  const [findings, setFindings] = useState<QuestionVerifyFinding[]>([])
  const [verifying, setVerifying] = useState(false)
  const [verifyRan, setVerifyRan] = useState(false)

  const runVerify = async () => {
    setVerifying(true)
    try {
      const fetchToBase64 = async (url: string): Promise<{ base64: string; mime: string } | null> => {
        try {
          const res = await fetch(url)
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          const mime = res.headers.get('content-type')?.split(';')[0]?.trim() || 'image/jpeg'
          const bytes = new Uint8Array(await res.arrayBuffer())
          let bin = ''
          const CH = 0x8000
          for (let i = 0; i < bytes.length; i += CH) {
            bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH) as unknown as number[])
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
          const slots: Array<{ url: string | null | undefined; slot: 'enunciado' | 'enunciado2' | 'comentario' }> = [
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
        })
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
      await Promise.all(Array.from({ length: Math.min(concurrency, batches.length || 1) }, worker))

      setFindings(results)
      setVerifyRan(true)
    } catch {
      toast({ title: 'Erro ao verificar questões com IA.', variant: 'destructive' })
    } finally {
      setVerifying(false)
    }
  }

  return (
    <div className="max-w-[1100px] space-y-6">
      <AdminPageHeader
        title="Editar questões"
        subtitle={isLoading ? 'Carregando…' : `${questions.length} questões`}
        actions={
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={runVerify}
              disabled={verifying || isLoading || questions.length === 0}
              className="border-admin-line bg-transparent text-admin-muted hover:bg-admin-raised hover:text-admin-text"
            >
              <ScanSearch className="h-4 w-4 mr-1.5" />
              {verifying ? 'Verificando…' : 'Verificar com IA'}
            </Button>
            <Link
              to="/admin/simulados"
              className="text-xs text-admin-muted hover:text-admin-text motion-safe:transition-colors"
            >
              ← Voltar aos simulados
            </Link>
          </div>
        }
      />

      {(verifyRan || verifying) && (
        <VerifyFindingsPanel findings={findings} loading={verifying} aiRan={verifyRan} />
      )}

      {isError ? (
        <p className="text-sm text-admin-destructive">
          Erro ao carregar as questões. Tente novamente.
        </p>
      ) : isLoading ? (
        <div className="bg-admin-surface border border-admin-line rounded-lg animate-pulse h-48" />
      ) : questions.length === 0 ? (
        <AdminEmptyState
          title="Nenhuma questão"
          description="Envie questões via planilha primeiro."
        />
      ) : (
        <div className="bg-admin-surface border border-admin-line rounded-lg overflow-hidden">
          <div
            className="grid border-b border-admin-line text-[9px] font-bold text-admin-faint uppercase tracking-wide"
            style={{ gridTemplateColumns: '40px 1fr 200px 80px 90px' }}
          >
            {['Nº', 'Enunciado', 'Área / Tema', 'Correta', 'Ação'].map((h) => (
              <div key={h} className="px-3 py-2">{h}</div>
            ))}
          </div>

          {questions.map((q) => {
            const correct = q.options.find((o) => o.is_correct)
            return (
              <div
                key={q.id}
                className="grid border-b border-admin-line/40 last:border-0 hover:bg-admin-raised/20 items-center"
                style={{ gridTemplateColumns: '40px 1fr 200px 80px 90px' }}
              >
                <div className="px-3 py-2.5 text-xs font-bold text-admin-muted">{q.question_number}</div>
                <div className="px-3 py-2.5 text-[11px] text-admin-text" title={q.text}>
                  {truncate(q.text)}
                </div>
                <div className="px-3 py-2.5 text-[11px] text-admin-muted truncate" title={`${q.area} / ${q.theme}`}>
                  <span className="text-admin-text">{q.area}</span>
                  {q.theme ? <span className="text-admin-faint"> · {q.theme}</span> : null}
                </div>
                <div className="px-3 py-2.5">
                  {correct ? (
                    <span className="text-[10px] font-bold bg-admin-success/10 text-admin-success border border-admin-success/30 px-1.5 py-0.5 rounded">
                      {correct.label}
                    </span>
                  ) : (
                    <span className="text-[10px] text-admin-faint">—</span>
                  )}
                </div>
                <div className="px-3 py-2.5">
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditing(q)}>
                    Editar
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {editing && (
        <QuestionEditDialog
          question={editing}
          simuladoId={id!}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

export default function AdminQuestionManager() {
  return (
    <AdminCapabilityGate capability="content.manage">
      <AdminQuestionManagerContent />
    </AdminCapabilityGate>
  )
}
