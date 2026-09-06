/**
 * scripts/import-caderno-map.ts
 *
 * Importador do mapa de um caderno impresso do presencial (Vermelho / Azul)
 * para `presencial_caderno_items` — valida, escreve, verifica contra o
 * gabarito impresso e só então ativa. Ver o contrato congelado em
 * docs/superpowers/specs/2026-09-06-presencial-cadernos.md.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * COMO RODAR (pt-BR)
 * ─────────────────────────────────────────────────────────────────────────
 *
 * 1) Exporte as credenciais de SERVICE ROLE do projeto Supabase. NUNCA
 *    hardcode a chave neste arquivo — o script só lê de variável de ambiente.
 *
 *      # bash / zsh
 *      export SUPABASE_URL="https://<project-ref>.supabase.co"
 *      export SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"
 *
 *      # PowerShell
 *      $env:SUPABASE_URL = "https://<project-ref>.supabase.co"
 *      $env:SUPABASE_SERVICE_ROLE_KEY = "<service-role-key>"
 *
 * 2) Prepare o CSV do mapa. Cabeçalho obrigatório (resolve por nome da
 *    coluna, não por posição — mas normalmente vem nesta ordem):
 *
 *      caderno,posicao,questao_original,A,B,C,D
 *      v,1,1,A,B,C,D
 *      a,1,37,C,A,D,B
 *
 *    - `caderno`      código do caderno (bate com `presencial_cadernos.code`
 *                     daquele simulado — ex.: "v", "a"). Precisa já existir.
 *    - `posicao`      número IMPRESSO no caderno (1..N, sem buraco e sem
 *                     repetição dentro do mesmo caderno).
 *    - `questao_original` = `questions.question_number` da questão real.
 *    - `A,B,C,D`      para cada letra IMPRESSA (o nome da coluna), qual é a
 *                     letra ORIGINAL daquela alternativa na plataforma.
 *                     `A,B,C,D` = alternativas não embaralhadas.
 *
 * 3) Prepare um arquivo de texto por caderno com o gabarito que foi REALMENTE
 *    impresso, no formato `1:B,2:C,3:A,...` (mesma numeração impressa).
 *
 * 4) Rode primeiro em modo dry-run — valida e resolve tudo, mas não escreve,
 *    não verifica contra o banco e não ativa nada:
 *
 *      npx tsx scripts/import-caderno-map.ts \
 *        --csv ./mapa-s7.csv \
 *        --simulado-id 6be18ec8-db68-482d-9417-281d66d13ff1 \
 *        --key v=./gabarito-vermelho.txt \
 *        --key a=./gabarito-azul.txt \
 *        --dry-run
 *
 * 5) Confira a saída com calma. Se estiver tudo OK, rode de novo SEM
 *    --dry-run para escrever, verificar e ativar de verdade:
 *
 *      npx tsx scripts/import-caderno-map.ts \
 *        --csv ./mapa-s7.csv \
 *        --simulado-id 6be18ec8-db68-482d-9417-281d66d13ff1 \
 *        --key v=./gabarito-vermelho.txt \
 *        --key a=./gabarito-azul.txt
 *
 * ─────────────────────────────────────────────────────────────────────────
 * O QUE O SCRIPT GARANTE
 * ─────────────────────────────────────────────────────────────────────────
 *
 * - Valida o CSV INTEIRO antes de escrever qualquer coisa: linhas faltando,
 *   posição repetida ou com buraco, questão inexistente, letra inválida,
 *   mapa não bijetivo (as 4 letras de uma linha precisam ser A,B,C,D sem
 *   repetição), contagem de itens batendo com o total de questões do
 *   simulado.
 * - Resolve os ids reais (questão, alternativa, caderno) só depois de todo
 *   o CSV validar limpo.
 * - Escreve `presencial_caderno_items` linha a linha por caderno, tirando um
 *   retrato (snapshot) do que já existia antes — se qualquer etapa seguinte
 *   falhar (escrita de outro caderno do mesmo CSV, verificação, ativação),
 *   o script desfaz (restaura o retrato) TODOS os cadernos que ele mexeu
 *   nesta execução. Nada fica pela metade, nada é ativado.
 * - Só chama `activate_caderno` depois que TODOS os cadernos deste CSV
 *   passarem em `verify_caderno_map` contra a chave impressa correspondente.
 *
 * Limitação honesta: a escrita usa a API REST do Supabase (service role),
 * não uma conexão direta ao Postgres — não existe um único BEGIN/COMMIT
 * amarrando escrita+verificação+ativação num único statement de banco. O
 * "rollback" acima é feito pelo próprio script (restaura o snapshot anterior)
 * e cobre o caminho de falha que importa: nenhum caderno fica ativo, e
 * nenhum caderno fica com um mapa pior do que tinha antes de rodar.
 *
 * NUNCA rode isto contra produção sem o Felipe revisar o CSV e as chaves
 * impressas antes.
 */

import { readFileSync } from 'node:fs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// ───────────────────────────────────────────────────────────────────────
// Erros
// ───────────────────────────────────────────────────────────────────────

/** Erro de uso do CLI (argumento faltando/errado) — não é problema do CSV. */
class UsageError extends Error {}

/** Junta todos os problemas de validação encontrados no CSV inteiro. */
class ValidationError extends Error {
  constructor(public readonly problems: string[]) {
    super(`CSV inválido — ${problems.length} problema(s):\n  - ${problems.join('\n  - ')}`);
  }
}

// ───────────────────────────────────────────────────────────────────────
// CLI args
// ───────────────────────────────────────────────────────────────────────

interface CliArgs {
  csvPath: string;
  simuladoId: string;
  /** code do caderno (ex.: "v", "a") -> gabarito impresso "1:B,2:C,..." lido do arquivo. */
  keys: Map<string, string>;
  dryRun: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  let csvPath: string | null = null;
  let simuladoId: string | null = null;
  const keys = new Map<string, string>();
  let dryRun = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--csv') {
      csvPath = argv[++i] ?? null;
      continue;
    }
    if (arg === '--simulado-id') {
      simuladoId = argv[++i] ?? null;
      continue;
    }
    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }
    if (arg === '--key') {
      const raw = argv[++i];
      const eq = raw?.indexOf('=') ?? -1;
      if (!raw || eq <= 0) {
        throw new UsageError(`--key inválido: "${raw ?? ''}". Use --key <codigo>=<arquivo>.`);
      }
      const code = raw.slice(0, eq).trim().toLowerCase();
      const filePath = raw.slice(eq + 1).trim();
      let content: string;
      try {
        content = readFileSync(filePath, 'utf-8').trim();
      } catch (err) {
        throw new UsageError(`Não consegui ler o arquivo de chave "${filePath}" (caderno "${code}"): ${(err as Error).message}`);
      }
      if (!content) {
        throw new UsageError(`Arquivo de chave "${filePath}" (caderno "${code}") está vazio.`);
      }
      keys.set(code, content);
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    }
    throw new UsageError(`Argumento desconhecido: "${arg}". Rode com --help para ver o uso.`);
  }

  if (!csvPath) throw new UsageError('Faltou --csv <arquivo>.');
  if (!simuladoId) throw new UsageError('Faltou --simulado-id <uuid>.');
  if (keys.size === 0) throw new UsageError('Faltou pelo menos um --key <codigo>=<arquivo>.');

  return { csvPath, simuladoId, keys, dryRun };
}

function printUsage() {
  console.log(`
Uso:
  npx tsx scripts/import-caderno-map.ts \\
    --csv <arquivo.csv> \\
    --simulado-id <uuid> \\
    --key <codigo>=<arquivo-com-gabarito-impresso> \\
    [--key <codigo>=<arquivo> ...] \\
    [--dry-run]

Veja o cabeçalho deste arquivo para o formato do CSV e das chaves.
`);
}

// ───────────────────────────────────────────────────────────────────────
// CSV
// ───────────────────────────────────────────────────────────────────────

const REQUIRED_COLUMNS = ['caderno', 'posicao', 'questao_original', 'A', 'B', 'C', 'D'] as const;
const LETTERS = ['A', 'B', 'C', 'D'] as const;
type Letter = (typeof LETTERS)[number];

interface RawCsv {
  header: string[];
  rows: { lineNumber: number; cells: string[] }[];
}

function splitCsvLine(line: string): string[] {
  // Formato simples (sem vírgula dentro de campo) — suficiente para este CSV;
  // ainda assim tira aspas envolventes se alguém exportar de Excel com elas.
  return line.split(',').map(cell => cell.trim().replace(/^"(.*)"$/, '$1'));
}

function parseCsv(raw: string): RawCsv {
  const lines = raw.split(/\r\n|\n|\r/);
  const nonEmpty: { lineNumber: number; text: string }[] = [];
  lines.forEach((text, idx) => {
    if (text.trim().length > 0) nonEmpty.push({ lineNumber: idx + 1, text });
  });
  if (nonEmpty.length === 0) throw new ValidationError(['CSV vazio.']);

  const header = splitCsvLine(nonEmpty[0].text);
  const rows = nonEmpty.slice(1).map(({ lineNumber, text }) => ({ lineNumber, cells: splitCsvLine(text) }));
  return { header, rows };
}

interface MapRow {
  lineNumber: number;
  caderno: string;
  posicao: number;
  questaoOriginal: number;
  /** Para a letra IMPRESSA (chave), qual é a letra ORIGINAL da alternativa. */
  originalOf: Record<Letter, Letter>;
}

/** Valida o CSV inteiro (formato + regras por linha) e devolve as linhas já tipadas. */
function parseAndValidateCsv(raw: string): MapRow[] {
  const { header, rows } = parseCsv(raw);

  const colIndex = new Map<string, number>();
  header.forEach((name, i) => colIndex.set(name.trim().toLowerCase() === 'posicao' ? 'posicao' : name.trim(), i));
  // normaliza nomes (aceita "posição" com acento também)
  header.forEach((name, i) => {
    const norm = name.trim().toLowerCase();
    if (norm === 'posição' || norm === 'posicao') colIndex.set('posicao', i);
    if (norm === 'caderno') colIndex.set('caderno', i);
    if (norm === 'questao_original' || norm === 'questão_original') colIndex.set('questao_original', i);
    if (['a', 'b', 'c', 'd'].includes(norm)) colIndex.set(norm.toUpperCase(), i);
  });

  const missingColumns = REQUIRED_COLUMNS.filter(col => !colIndex.has(col));
  if (missingColumns.length > 0) {
    throw new ValidationError([`Cabeçalho sem a(s) coluna(s): ${missingColumns.join(', ')}. Cabeçalho lido: ${header.join(', ')}`]);
  }

  const problems: string[] = [];
  const parsedRows: MapRow[] = [];

  for (const { lineNumber, cells } of rows) {
    if (cells.length < header.length) {
      problems.push(`linha ${lineNumber}: tem ${cells.length} coluna(s), esperado ${header.length}.`);
      continue;
    }

    const cadernoRaw = cells[colIndex.get('caderno')!]?.trim().toLowerCase();
    if (!cadernoRaw) {
      problems.push(`linha ${lineNumber}: coluna "caderno" vazia.`);
      continue;
    }

    const posicaoRaw = cells[colIndex.get('posicao')!]?.trim();
    const posicao = Number(posicaoRaw);
    if (!posicaoRaw || !Number.isInteger(posicao) || posicao < 1) {
      problems.push(`linha ${lineNumber} (caderno ${cadernoRaw}): posição inválida "${posicaoRaw}" (precisa ser inteiro >= 1).`);
      continue;
    }

    const questaoRaw = cells[colIndex.get('questao_original')!]?.trim();
    const questaoOriginal = Number(questaoRaw);
    if (!questaoRaw || !Number.isInteger(questaoOriginal) || questaoOriginal < 1) {
      problems.push(`linha ${lineNumber} (caderno ${cadernoRaw}, posição ${posicaoRaw}): questao_original inválida "${questaoRaw}".`);
      continue;
    }

    const originalOf: Partial<Record<Letter, Letter>> = {};
    let letterProblem = false;
    for (const printed of LETTERS) {
      const value = cells[colIndex.get(printed)!]?.trim().toUpperCase();
      if (!value || !(LETTERS as readonly string[]).includes(value)) {
        problems.push(
          `linha ${lineNumber} (caderno ${cadernoRaw}, posição ${posicaoRaw}): coluna "${printed}" tem letra inválida "${value ?? ''}" (precisa ser A, B, C ou D).`,
        );
        letterProblem = true;
        continue;
      }
      originalOf[printed] = value as Letter;
    }
    if (letterProblem) continue;

    const distinctOriginals = new Set(Object.values(originalOf));
    if (distinctOriginals.size !== 4) {
      problems.push(
        `linha ${lineNumber} (caderno ${cadernoRaw}, posição ${posicaoRaw}): mapa não é bijetivo — as colunas A,B,C,D precisam apontar para A,B,C,D sem repetição (lidas: ${LETTERS.map(l => originalOf[l]).join(',')}).`,
      );
      continue;
    }

    parsedRows.push({
      lineNumber,
      caderno: cadernoRaw,
      posicao,
      questaoOriginal,
      originalOf: originalOf as Record<Letter, Letter>,
    });
  }

  // Validações por caderno: posição 1..N sem buraco/repetição, questão sem repetição.
  const byCaderno = new Map<string, MapRow[]>();
  for (const row of parsedRows) {
    const list = byCaderno.get(row.caderno) ?? [];
    list.push(row);
    byCaderno.set(row.caderno, list);
  }

  for (const [caderno, list] of byCaderno) {
    const positions = list.map(r => r.posicao).sort((a, b) => a - b);
    const seenPositions = new Set<number>();
    for (const p of positions) {
      if (seenPositions.has(p)) problems.push(`caderno ${caderno}: posição ${p} repetida.`);
      seenPositions.add(p);
    }
    const n = list.length;
    for (let p = 1; p <= n; p++) {
      if (!seenPositions.has(p)) problems.push(`caderno ${caderno}: falta a posição ${p} (o caderno tem ${n} linha(s) no CSV, esperado 1..${n} sem buraco).`);
    }

    const seenQuestoes = new Map<number, number[]>();
    for (const row of list) {
      const lines = seenQuestoes.get(row.questaoOriginal) ?? [];
      lines.push(row.lineNumber);
      seenQuestoes.set(row.questaoOriginal, lines);
    }
    for (const [questao, lines] of seenQuestoes) {
      if (lines.length > 1) problems.push(`caderno ${caderno}: questao_original ${questao} aparece repetida (linhas ${lines.join(', ')}).`);
    }
  }

  if (problems.length > 0) throw new ValidationError(problems);
  return parsedRows;
}

/** Sanidade do formato da chave impressa antes de gastar uma chamada de rede. */
function assertPrintedKeyFormat(code: string, key: string) {
  if (!/^\s*\d+\s*:\s*[A-Da-d]\s*(,\s*\d+\s*:\s*[A-Da-d]\s*)*$/.test(key)) {
    throw new UsageError(
      `Gabarito impresso do caderno "${code}" não bate com o formato esperado ("1:B,2:C,..."). Conteúdo lido: ${key.slice(0, 80)}${key.length > 80 ? '…' : ''}`,
    );
  }
}

// ───────────────────────────────────────────────────────────────────────
// Resolução de ids
// ───────────────────────────────────────────────────────────────────────

interface ResolvedItem {
  caderno_id: string;
  position: number;
  question_id: string;
  option_map: Record<Letter, string>;
}

interface ResolvedCaderno {
  code: string;
  cadernoId: string;
  items: ResolvedItem[];
}

async function resolveIds(
  supabase: SupabaseClient,
  simuladoId: string,
  rows: MapRow[],
  keys: Map<string, string>,
): Promise<ResolvedCaderno[]> {
  const problems: string[] = [];

  const usedCodes = new Set(rows.map(r => r.caderno));
  for (const code of usedCodes) {
    if (!keys.has(code)) problems.push(`faltou --key para o caderno "${code}" (o CSV usa esse código mas nenhuma chave impressa foi passada).`);
  }
  for (const code of keys.keys()) {
    if (!usedCodes.has(code)) problems.push(`--key "${code}" foi passado mas o CSV não tem nenhuma linha desse caderno.`);
  }

  const { data: questionRows, error: questionsErr } = await supabase
    .from('questions')
    .select('id, question_number')
    .eq('simulado_id', simuladoId);
  if (questionsErr) throw questionsErr;
  const questionsBySimulado = (questionRows ?? []) as { id: string; question_number: number }[];
  const questionIdByNumber = new Map(questionsBySimulado.map(q => [q.question_number, q.id]));
  const totalQuestionsInSimulado = questionsBySimulado.length;

  if (totalQuestionsInSimulado === 0) {
    problems.push(`o simulado ${simuladoId} não tem nenhuma questão cadastrada — confira o --simulado-id.`);
  }

  const { data: cadernoRows, error: cadernosErr } = await supabase
    .from('presencial_cadernos')
    .select('id, code')
    .eq('simulado_id', simuladoId);
  if (cadernosErr) throw cadernosErr;
  const cadernoIdByCode = new Map(((cadernoRows ?? []) as { id: string; code: string }[]).map(c => [c.code, c.id]));

  for (const code of usedCodes) {
    if (!cadernoIdByCode.has(code)) {
      problems.push(`caderno "${code}" não existe em presencial_cadernos para o simulado ${simuladoId} — crie o registro do caderno antes de importar o mapa.`);
    }
  }

  // Resolve question_id por linha; acumula ids únicos pra buscar as opções em lote.
  const questionIdsNeeded = new Set<string>();
  const rowsWithQuestionId: (MapRow & { questionId?: string })[] = rows.map(row => {
    const questionId = questionIdByNumber.get(row.questaoOriginal);
    if (!questionId) {
      problems.push(`caderno ${row.caderno}, posição ${row.posicao}: questao_original ${row.questaoOriginal} não existe no simulado ${simuladoId}.`);
      return row;
    }
    questionIdsNeeded.add(questionId);
    return { ...row, questionId };
  });

  // Contagem de itens por caderno precisa bater com o total de questões do simulado.
  const byCaderno = new Map<string, typeof rowsWithQuestionId>();
  for (const row of rowsWithQuestionId) {
    const list = byCaderno.get(row.caderno) ?? [];
    list.push(row);
    byCaderno.set(row.caderno, list);
  }
  for (const [code, list] of byCaderno) {
    if (totalQuestionsInSimulado > 0 && list.length !== totalQuestionsInSimulado) {
      problems.push(
        `caderno ${code}: tem ${list.length} item(ns) no CSV, mas o simulado tem ${totalQuestionsInSimulado} questão(ões) — precisam bater exatamente.`,
      );
    }
  }

  let optionsByQuestion = new Map<string, Map<Letter, string>>();
  if (questionIdsNeeded.size > 0) {
    const { data: optionRows, error: optionsErr } = await supabase
      .from('question_options')
      .select('id, question_id, label')
      .in('question_id', Array.from(questionIdsNeeded));
    if (optionsErr) throw optionsErr;
    for (const opt of (optionRows ?? []) as { id: string; question_id: string; label: string }[]) {
      const forQuestion = optionsByQuestion.get(opt.question_id) ?? new Map<Letter, string>();
      forQuestion.set(opt.label.toUpperCase() as Letter, opt.id);
      optionsByQuestion.set(opt.question_id, forQuestion);
    }
  }

  const resolvedByCaderno = new Map<string, ResolvedItem[]>();
  for (const row of rowsWithQuestionId) {
    if (!row.questionId) continue; // já reportado acima
    const options = optionsByQuestion.get(row.questionId);
    const optionMap: Partial<Record<Letter, string>> = {};
    let rowOk = true;
    for (const printed of LETTERS) {
      const originalLetter = row.originalOf[printed];
      const optionId = options?.get(originalLetter);
      if (!optionId) {
        problems.push(
          `caderno ${row.caderno}, posição ${row.posicao} (questão original ${row.questaoOriginal}): não achei a alternativa "${originalLetter}" — a questão pode ter menos de 4 alternativas cadastradas.`,
        );
        rowOk = false;
        continue;
      }
      optionMap[printed] = optionId;
    }
    if (!rowOk) continue;

    const cadernoId = cadernoIdByCode.get(row.caderno);
    if (!cadernoId) continue; // já reportado acima

    const list = resolvedByCaderno.get(row.caderno) ?? [];
    list.push({
      caderno_id: cadernoId,
      position: row.posicao,
      question_id: row.questionId,
      option_map: optionMap as Record<Letter, string>,
    });
    resolvedByCaderno.set(row.caderno, list);
  }

  if (problems.length > 0) throw new ValidationError(problems);

  return Array.from(resolvedByCaderno.entries()).map(([code, items]) => ({
    code,
    cadernoId: cadernoIdByCode.get(code)!,
    items: items.sort((a, b) => a.position - b.position),
  }));
}

// ───────────────────────────────────────────────────────────────────────
// Escrita + verificação + ativação
// ───────────────────────────────────────────────────────────────────────

interface ItemRow {
  caderno_id: string;
  position: number;
  question_id: string;
  option_map: Record<Letter, string>;
}

async function fetchExistingItems(supabase: SupabaseClient, cadernoId: string): Promise<ItemRow[]> {
  const { data, error } = await supabase
    .from('presencial_caderno_items')
    .select('caderno_id, position, question_id, option_map')
    .eq('caderno_id', cadernoId);
  if (error) throw error;
  return (data ?? []) as ItemRow[];
}

async function replaceCadernoItems(supabase: SupabaseClient, cadernoId: string, items: ItemRow[]) {
  const { error: deleteErr } = await supabase.from('presencial_caderno_items').delete().eq('caderno_id', cadernoId);
  if (deleteErr) throw deleteErr;
  if (items.length === 0) return;
  const { error: insertErr } = await supabase.from('presencial_caderno_items').insert(items);
  if (insertErr) throw insertErr;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  console.log(`\n=== Importador de mapa de caderno — simulado ${args.simuladoId} ===`);
  console.log(`CSV: ${args.csvPath}`);
  console.log(`Cadernos com chave impressa: ${Array.from(args.keys.keys()).join(', ')}`);
  console.log(args.dryRun ? 'Modo: DRY-RUN (nada será escrito)\n' : 'Modo: ESCRITA REAL\n');

  for (const [code, key] of args.keys) assertPrintedKeyFormat(code, key);

  const csvRaw = readFileSync(args.csvPath, 'utf-8');
  const rows = parseAndValidateCsv(csvRaw);
  console.log(`CSV validado: ${rows.length} linha(s) em ${new Set(rows.map(r => r.caderno)).size} caderno(s).`);

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new UsageError('Faltou SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY no ambiente. Veja o topo deste arquivo.');
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  const resolved = await resolveIds(supabase, args.simuladoId, rows, args.keys);
  console.log('Ids resolvidos com sucesso:');
  for (const c of resolved) console.log(`  - caderno ${c.code}: ${c.items.length} item(ns) prontos para escrita.`);

  if (args.dryRun) {
    console.log('\nDry-run: nada foi escrito, verify_caderno_map e activate_caderno NÃO rodaram.');
    console.log('Rode sem --dry-run para escrever, verificar e ativar de verdade.');
    return;
  }

  // Snapshot pra rollback: se qualquer coisa falhar depois de escrever, volta
  // exatamente para o que existia antes desta execução (por caderno).
  const snapshots = new Map<string, ItemRow[]>();
  const written: string[] = []; // cadernoIds já escritos nesta execução

  const rollback = async () => {
    console.error('\nRevertendo escrita — restaurando o que existia antes nesta execução...');
    for (const cadernoId of written) {
      try {
        await replaceCadernoItems(supabase, cadernoId, snapshots.get(cadernoId) ?? []);
      } catch (err) {
        console.error(`  FALHA ao restaurar o caderno ${cadernoId} — intervenção manual necessária: ${(err as Error).message}`);
      }
    }
    console.error('Reversão concluída (ou reportada acima). Nenhum caderno foi ativado.');
  };

  try {
    for (const c of resolved) {
      const before = await fetchExistingItems(supabase, c.cadernoId);
      snapshots.set(c.cadernoId, before);
      await replaceCadernoItems(supabase, c.cadernoId, c.items);
      written.push(c.cadernoId);
      console.log(`  - caderno ${c.code}: ${c.items.length} item(ns) escrito(s) (havia ${before.length} antes).`);
    }
  } catch (err) {
    console.error(`\nFalha ao escrever presencial_caderno_items: ${(err as Error).message}`);
    await rollback();
    process.exitCode = 1;
    return;
  }

  console.log('\nVerificando cada caderno contra o gabarito impresso...');
  // `problems` vem do backend (verify_caderno_map) como uma lista de strings já
  // formatadas e prontas para exibir (ex.: "Posição 2: gabarito impresso diz C,
  // mas o mapa do caderno produz D.") — não como objetos estruturados.
  const verifyResults: { code: string; cadernoId: string; ok: boolean; problems: string[] }[] = [];
  try {
    for (const c of resolved) {
      const key = args.keys.get(c.code)!;
      const { data, error } = await supabase.rpc('verify_caderno_map', { p_caderno_id: c.cadernoId, p_key: key });
      if (error) throw error;
      const result = (data ?? {}) as { ok?: boolean; problems?: string[]; derived_key?: string };
      const problems = result.problems ?? [];
      verifyResults.push({ code: c.code, cadernoId: c.cadernoId, ok: Boolean(result.ok), problems });
      console.log(`  - caderno ${c.code}: ${result.ok ? 'OK' : `FALHOU (${problems.length} divergência(s))`} — gabarito derivado: ${result.derived_key ?? '?'}`);
      if (!result.ok) {
        for (const p of problems) console.log(`      - ${p}`);
      }
    }
  } catch (err) {
    console.error(`\nFalha ao chamar verify_caderno_map: ${(err as Error).message}`);
    await rollback();
    process.exitCode = 1;
    return;
  }

  const anyFailed = verifyResults.some(r => !r.ok);
  if (anyFailed) {
    console.error('\nPelo menos um caderno não bateu com o gabarito impresso — abortando ANTES de ativar qualquer coisa.');
    await rollback();
    process.exitCode = 1;
    return;
  }

  console.log('\nTodos os cadernos bateram. Ativando...');
  const activationFailures: string[] = [];
  for (const c of resolved) {
    const key = args.keys.get(c.code)!;
    const { error } = await supabase.rpc('activate_caderno', { p_caderno_id: c.cadernoId, p_key: key });
    if (error) {
      activationFailures.push(`caderno ${c.code}: ${error.message}`);
      console.error(`  - caderno ${c.code}: FALHOU AO ATIVAR — ${error.message}`);
    } else {
      console.log(`  - caderno ${c.code}: ativado.`);
    }
  }

  if (activationFailures.length > 0) {
    console.error(
      '\nAtenção: a escrita e a verificação já tinham passado, e a ativação falhou para pelo menos um caderno.\n' +
      'Os itens já escritos NÃO foram revertidos (a verificação passou — o mapa está correto), mas o(s) caderno(s)\n' +
      'abaixo continuam is_active=false e precisam de intervenção manual (rodar de novo, ou investigar o erro):\n' +
      activationFailures.map(f => `  - ${f}`).join('\n'),
    );
    process.exitCode = 1;
    return;
  }

  console.log('\nImportação concluída: mapa escrito, verificado e caderno(s) ativado(s).');
}

main().catch(err => {
  if (err instanceof UsageError) {
    console.error(`\nErro de uso: ${err.message}`);
    printUsage();
  } else if (err instanceof ValidationError) {
    console.error(`\n${err.message}`);
  } else {
    console.error('\nErro inesperado:', err);
  }
  process.exitCode = 1;
});
