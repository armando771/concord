import type { Badge, BadgeRarity, BadgeUnit, BadgeUnlockEvent } from '../api/badges'

/**
 * Badges do perfil: textos e ordem. O catálogo (nomes, limites, raridade)
 * vem do backend (internal/badge/catalog.go); aqui só se formata.
 */

export interface RarityMeta {
  label: string
  /** Cor do texto/borda do selo. */
  color: string
  /** Fundo do selo. */
  bg: string
  rank: number
}

export const RARITY: Record<BadgeRarity, RarityMeta> = {
  comum: { label: 'Comum', color: '#b5bac1', bg: 'rgba(181,186,193,0.14)', rank: 0 },
  raro: { label: 'Raro', color: '#5ba8ff', bg: 'rgba(91,168,255,0.16)', rank: 1 },
  epico: { label: 'Épico', color: '#c38bff', bg: 'rgba(195,139,255,0.18)', rank: 2 },
  lendario: { label: 'Lendário', color: '#f7c948', bg: 'rgba(247,201,72,0.18)', rank: 3 }
}

export function rarityMeta(rarity: BadgeRarity | undefined): RarityMeta {
  return (rarity && RARITY[rarity]) || RARITY.comum
}

const HOUR = 3600

function num(n: number): string {
  return Math.floor(n).toLocaleString('pt-BR')
}

function plural(n: number, one: string, many: string): string {
  return `${num(n)} ${n === 1 ? one : many}`
}

/** "45 min", "1 hora", "798 horas". */
function hoursText(seconds: number): string {
  if (seconds < HOUR) return `${Math.floor(seconds / 60)} min`
  return plural(Math.floor(seconds / HOUR), 'hora', 'horas')
}

function monthsText(months: number): string {
  if (months < 1) return 'Menos de 1 mês'
  const years = Math.floor(months / 12)
  const rest = months % 12
  const y = years > 0 ? plural(years, 'ano', 'anos') : ''
  const m = rest > 0 ? plural(rest, 'mês', 'meses') : ''
  return y && m ? `${y} e ${m}` : y || m
}

/** Sufixo das categorias de tempo. */
const TIME_SUFFIX: Record<string, string> = {
  voz: 'em call',
  streamer: 'transmitindo',
  coruja: 'em call de madrugada',
  madrugador: 'em call de manhãzinha',
  maratona: 'seguidas numa call'
}

/** A estatística da linha "798 horas em call • Desbloqueado em … • RARO". */
export function statText(b: Badge): string {
  const value = b.value ?? 0
  switch (b.unit) {
    case 'seconds': {
      const suffix = TIME_SUFFIX[b.category] ?? 'em call'
      return `${hoursText(value)} ${suffix}`
    }
    case 'months':
      return `${monthsText(value)} de conta`
    case 'messages':
      return value === 1 ? '1 mensagem enviada' : `${num(value)} mensagens enviadas`
    case 'reactions':
      return plural(value, 'reação', 'reações')
    case 'level':
      return `Nível ${num(value)}`
    case 'people':
      return `Call com até ${plural(value, 'pessoa', 'pessoas')}`
    case 'servers':
      return `Dono de ${plural(value, 'servidor', 'servidores')}`
    case 'founder':
      return value > 0 ? 'Chegou nas primeiras semanas' : 'Chegou depois das primeiras semanas'
  }
  return num(value)
}

/**
 * Estatística no perfil de outra pessoa: o limite do tier conquistado
 * ("2.000+ mensagens"), nunca o número exato.
 */
export function publicStatText(b: Badge): string {
  if (b.unit === 'founder') return 'Chegou nas primeiras semanas'
  const reached = b.tiers[b.tier - 1]
  if (!reached) return ''
  const label = `${formatThreshold(b.unit, reached.threshold)}`
  if (b.unit === 'level') return `${label}+`
  const [n, ...rest] = label.split(' ')
  const suffix = b.unit === 'seconds' ? ` ${TIME_SUFFIX[b.category] ?? 'em call'}` : ''
  return `${n}+ ${rest.join(' ')}${suffix}`
}

/** Rótulo de um degrau da escada: "1 hora", "3 meses", "2.000 mensagens". */
export function formatThreshold(unit: BadgeUnit, threshold: number): string {
  switch (unit) {
    case 'seconds':
      return plural(Math.floor(threshold / HOUR), 'hora', 'horas')
    case 'months':
      return plural(threshold, 'mês', 'meses')
    case 'messages':
      return plural(threshold, 'mensagem', 'mensagens')
    case 'reactions':
      return plural(threshold, 'reação', 'reações')
    case 'level':
      return `Nível ${num(threshold)}`
    case 'people':
      return plural(threshold, 'pessoa', 'pessoas')
    case 'servers':
      return plural(threshold, 'servidor', 'servidores')
    case 'founder':
      // Corte do backend: contas criadas antes de 01/11/2026.
      return 'Até 31/10/26'
  }
  return num(threshold)
}

function falta(n: number, one: string, many: string): string {
  return n === 1 ? `Falta 1 ${one}` : `Faltam ${num(n)} ${many}`
}

const DAY_MS = 24 * 60 * 60 * 1000

/** "Faltam 20 horas", "Faltam 4 meses", "Tier máximo!". */
export function remainingText(b: Badge, now: Date = new Date()): string {
  if (b.next_threshold === undefined || b.next_threshold === null) return 'Tier máximo!'
  const left = Math.max(0, b.next_threshold - (b.value ?? 0))
  switch (b.unit) {
    case 'seconds':
      if (left < HOUR) return `Faltam ${Math.max(1, Math.ceil(left / 60))} min`
      return falta(Math.ceil(left / HOUR), 'hora', 'horas')
    case 'months': {
      if (!b.next_at) return falta(left, 'mês', 'meses')
      const days = Math.max(1, Math.ceil((new Date(b.next_at).getTime() - now.getTime()) / DAY_MS))
      if (days >= 60) return falta(Math.round(days / 30.44), 'mês', 'meses')
      return falta(days, 'dia', 'dias')
    }
    case 'messages':
      return falta(left, 'mensagem', 'mensagens')
    case 'reactions':
      return falta(left, 'reação', 'reações')
    case 'level':
      return falta(left, 'nível', 'níveis')
    case 'people':
      return `Uma call com ${plural(b.next_threshold, 'pessoa', 'pessoas')}`
    case 'servers':
      return falta(left, 'servidor', 'servidores')
    case 'founder':
      return 'Só para quem chegou nas primeiras semanas'
  }
  return ''
}

/** 0–100 para a barra de progresso. */
export function progressPercent(b: Badge): number {
  return Math.min(100, Math.max(0, Math.round((b.progress ?? 0) * 100)))
}

/** "29/07/26" (vazio sem data). */
export function formatUnlockDate(iso: string | undefined): string {
  if (!iso) return ''
  // Só o dia (perfil de outra pessoa): sem fuso, não pode virar o dia anterior.
  const dayOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (dayOnly) return `${dayOnly[3]}/${dayOnly[2]}/${dayOnly[1].slice(2)}`
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yy = String(d.getFullYear() % 100).padStart(2, '0')
  return `${dd}/${mm}/${yy}`
}

/** Conquistados, do mais raro para o mais comum (empate: ordem do catálogo). */
export function earnedBadges(badges: Badge[]): Badge[] {
  return badges
    .map((b, i) => ({ b, i }))
    .filter(({ b }) => b.tier > 0)
    .sort((x, y) => rarityMeta(y.b.rarity).rank - rarityMeta(x.b.rarity).rank || x.i - y.i)
    .map(({ b }) => b)
}

/** A fileira do cartão de perfil: até `max` ícones e o "+N" do resto. */
export function profileBadgeRow(badges: Badge[], max = 6): { shown: Badge[]; overflow: number } {
  const earned = earnedBadges(badges)
  return { shown: earned.slice(0, max), overflow: Math.max(0, earned.length - max) }
}

/** "Seus badges" e "Disponíveis para desbloquear". */
export function splitBadges(badges: Badge[]): { earned: Badge[]; available: Badge[] } {
  return {
    earned: earnedBadges(badges),
    available: badges.filter((b) => b.tier === 0 && b.obtainable === true)
  }
}

/** Quantos badges (categorias) o aviso de desbloqueio tem, não tiers. */
export function unlockCount(unlocks: BadgeUnlockEvent['unlocks']): number {
  return new Set(unlocks.map((u) => u.category)).size
}
