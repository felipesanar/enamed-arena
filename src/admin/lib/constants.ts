/** Períodos padrão dos dashboards (dias) */
export const PERIOD_OPTIONS = [
  { value: 7,  label: '7 dias' },
  { value: 14, label: '14 dias' },
  { value: 30, label: '30 dias' },
  { value: 90, label: '90 dias' },
] as const

/**
 * Labels e classes (tokens admin) por segmento de usuário.
 * Labels espelham produção: 'Guest', 'Standard', 'PRO'.
 * (spec original sugeria 'Visitante', 'Aluno SanarFlix', 'Aluno PRO' — diverge de produção)
 */
export const SEGMENT_META: Record<string, { label: string; className: string }> = {
  guest:    { label: 'Guest',    className: 'bg-admin-raised text-admin-muted border-admin-line' },
  standard: { label: 'Standard', className: 'bg-admin-info/10 text-admin-info border-admin-info/30' },
  pro:      { label: 'PRO',      className: 'bg-admin-accent/10 text-admin-accent border-admin-accent/30' },
}

/**
 * Labels e classes por status de tentativa.
 * Labels espelham AdminTentativas (produção): 'Concluída', 'Expirada', 'Em andamento', 'Offline'.
 * (AdminUsuarioDetail usa variantes masculinas: 'Concluído', 'Expirado' — diverge entre páginas)
 */
export const ATTEMPT_STATUS_META: Record<string, { label: string; className: string }> = {
  in_progress:     { label: 'Em andamento', className: 'bg-admin-info/10 text-admin-info border-admin-info/30' },
  submitted:       { label: 'Concluída',    className: 'bg-admin-success/10 text-admin-success border-admin-success/30' },
  expired:         { label: 'Expirada',     className: 'bg-admin-warning/10 text-admin-warning border-admin-warning/30' },
  offline_pending: { label: 'Offline',      className: 'bg-admin-raised text-admin-muted border-admin-line' },
}

/** Labels por role do admin */
export const ROLE_META: Record<string, { label: string; description: string }> = {
  admin:          { label: 'Admin',              description: 'Acesso total, incluindo gestão de roles' },
  content_editor: { label: 'Editor de conteúdo', description: 'Simulados, questões e previews' },
  support:        { label: 'Suporte',            description: 'Usuários e tentativas' },
  analyst:        { label: 'Analista',           description: 'Dashboards e inteligência (leitura)' },
}
