import { levelPercent } from '../../levels/lib/levels'

// Nível do servidor (backend internal/serverlevel, ADR 0016): sobe só com o
// que as pessoas fazem nele.

export interface ServerLevelProgress {
  server_id: string
  level: number
  xp: number
  xp_into_level: number
  xp_for_next: number
}

export interface SourceXP {
  source: string
  xp: number
}

export interface ServerLevelDetail extends ServerLevelProgress {
  week: SourceXP[]
}

/** Nome de cada fonte de XP no detalhamento. */
export const SOURCE_LABEL: Record<string, string> = {
  membros: 'Membros novos',
  mensagens: 'Mensagens',
  figurinhas: 'Figurinhas enviadas',
  sons: 'Sons da mesa de áudio',
  voz: 'Tempo em call',
  live: 'Lives transmitidas',
  espectador: 'Lives assistidas',
  presenca: 'Call cheia'
}

export interface WeekRow {
  source: string
  label: string
  xp: number
  /** Parte do total da semana, 0–100. */
  percent: number
}

/** Fontes da semana, da que mais rendeu para a que menos (as zeradas no fim). */
export function weekBreakdown(week: SourceXP[]): { rows: WeekRow[]; total: number } {
  const total = week.reduce((sum, s) => sum + Math.max(0, s.xp), 0)
  const rows = week
    .map((s) => ({
      source: s.source,
      label: SOURCE_LABEL[s.source] ?? s.source,
      xp: Math.max(0, s.xp),
      percent: total > 0 ? Math.round((Math.max(0, s.xp) / total) * 100) : 0
    }))
    .sort((a, b) => b.xp - a.xp)
  return { rows, total }
}

/** Barra de progresso do nível, 0–100. */
export function serverLevelPercent(p: ServerLevelProgress): number {
  return levelPercent(p.xp_into_level, p.xp_for_next)
}

/** "1.234" (milhar com ponto). */
export function formatXP(xp: number): string {
  return Math.max(0, Math.floor(xp)).toLocaleString('pt-BR')
}

/** Aviso de subida de nível (toast). */
export function levelUpMessage(serverName: string | undefined, level: number): string {
  return `${serverName ?? 'O servidor'} subiu para o nível ${level}!`
}

function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

/** Payload do "server:level:update" (ou null se veio torto). */
export function parseProgress(payload: unknown): ServerLevelProgress | null {
  const p = payload as Partial<ServerLevelProgress> | null
  if (!p || typeof p.server_id !== 'string') return null
  if (!isNum(p.level) || !isNum(p.xp) || !isNum(p.xp_into_level) || !isNum(p.xp_for_next))
    return null
  return {
    server_id: p.server_id,
    level: p.level,
    xp: p.xp,
    xp_into_level: p.xp_into_level,
    xp_for_next: p.xp_for_next
  }
}

/** Payload do "server:level:up" (ou null se veio torto). */
export function parseLevelUp(payload: unknown): { serverId: string; level: number } | null {
  const p = payload as { server_id?: unknown; level?: unknown } | null
  if (!p || typeof p.server_id !== 'string' || !isNum(p.level)) return null
  return { serverId: p.server_id, level: p.level }
}
