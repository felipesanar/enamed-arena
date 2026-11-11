type Result<T> = { data: T | null; error: unknown }
type AccessInput = {
  userId: string;
  simuladoId: string;
  force: boolean;
  now: number;
  hasCapability: () => Promise<Result<boolean>>;
  getSimulado: () => Promise<Result<{
    status: string; execution_window_start: string; execution_window_end: string;
  }>>;
  getAttempt: () => Promise<Result<{
    user_id: string; simulado_id: string; attempt_type: string;
  }>>;
}

// All database evidence comes from verified JWT/server queries, never user metadata.
export async function authorizeExamPdf(input: AccessInput): Promise<boolean> {
  if (!input.userId || !input.simuladoId) return false;
  try {
    const capability = await input.hasCapability();
    if (capability.error || typeof capability.data !== 'boolean') return false;
    if (capability.data === true) return true;
    if (input.force) return false;

    const simulado = await input.getSimulado();
    if (simulado.error || !simulado.data || simulado.data.status !== 'published') return false;
    // Block only BEFORE the window opens (questions must not leak early). After it
    // closes the simulado stays available as treino, so the PDF must keep working.
    const start = Date.parse(simulado.data.execution_window_start);
    if (!Number.isFinite(start) || !Number.isFinite(input.now) || input.now < start) return false;

    const attempt = await input.getAttempt();
    return !attempt.error && !!attempt.data &&
      attempt.data.user_id === input.userId &&
      attempt.data.simulado_id === input.simuladoId &&
      attempt.data.attempt_type === 'offline';
  } catch {
    return false;
  }
}
