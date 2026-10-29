/** Linhas do JSONL de performance e o evento que o renderer manda ao main (`--perf-log`). */

/** 'unfocused' = visível sem foco (atrás do jogo ou noutro monitor). */
export type WindowState = 'visible' | 'unfocused' | 'minimized' | 'tray'

export interface PerfContext {
  route: string
  inCall: boolean
  sharing: boolean
  watching: boolean
}

export interface LoafSummary {
  count: number
  maxMs: number
  totalMs: number
}

export interface PerfReport {
  kind: 'report'
  ctx: PerfContext
  fps: number | null
  loaf: LoafSummary | null
}

export interface PerfMark {
  kind: 'mark'
  name: 'usable'
}

export type PerfEvent = PerfReport | PerfMark

/** `cpu` é null na primeira amostra (CPU é a diferença entre duas leituras). */
export interface ProcStat {
  cpu: number | null
  memMB: number
}

export type ProcStats = Record<string, ProcStat>

export interface SampleLine {
  t: number
  kind: 'sample'
  ctx: PerfContext & { window: WindowState }
  procs: ProcStats
  fps: number | null
  loaf: LoafSummary | null
}

export interface StartupLine {
  kind: 'startup'
  appReadyMs: number | null
  readyToShowMs: number | null
  usableMs: number | null
}

const MAX_ROUTE = 200
// Segmentos fixos das rotas de app/router.tsx. Todo o resto (ids, código de convite de
// 8 letras/números, uma rota nova que ainda não entrou aqui) vira `:id`: errar para este
// lado só perde legibilidade, nunca deixa um identificador no arquivo.
const FIXED_SEGMENTS = new Set([
  '',
  'friends',
  'invites',
  'proposals',
  'changelog',
  'dm',
  'c',
  'servers',
  'channels',
  'login',
  'register',
  'forgot-password',
  'reset-password',
  'verify-email',
  'convite'
])

/** Troca tudo que não é segmento fixo por `:id`: o arquivo pode ser compartilhado sem dados pessoais. */
export function normalizeRoute(path: string): string {
  const clean = path.split(/[?#]/)[0]
  return clean
    .split('/')
    .map((segment) => (FIXED_SEGMENTS.has(segment) ? segment : ':id'))
    .join('/')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function nonNegative(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}

function parseContext(raw: unknown): PerfContext | null {
  if (!isRecord(raw) || typeof raw.route !== 'string') return null
  return {
    route: normalizeRoute(raw.route).slice(0, MAX_ROUTE),
    inCall: raw.inCall === true,
    sharing: raw.sharing === true,
    watching: raw.watching === true
  }
}

function parseLoaf(raw: unknown): LoafSummary | null {
  if (!isRecord(raw)) return null
  const count = nonNegative(raw.count)
  const maxMs = nonNegative(raw.maxMs)
  const totalMs = nonNegative(raw.totalMs)
  if (count === null || maxMs === null || totalMs === null) return null
  return { count, maxMs, totalMs }
}

/** Valida o que veio do renderer (processo menos confiável): formato errado vira null. */
export function parsePerfEvent(raw: unknown): PerfEvent | null {
  if (!isRecord(raw)) return null
  if (raw.kind === 'mark') return raw.name === 'usable' ? { kind: 'mark', name: 'usable' } : null
  if (raw.kind !== 'report') return null
  const ctx = parseContext(raw.ctx)
  if (!ctx) return null
  return { kind: 'report', ctx, fps: nonNegative(raw.fps), loaf: parseLoaf(raw.loaf) }
}
