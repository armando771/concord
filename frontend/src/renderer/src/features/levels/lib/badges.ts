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
  lendario: { label: 'Lendário', color: '#f7c948', bg: 'rgba(247,201,72,0.18)', rank: 3 },
  // Holográfico: a cor é a base; o selo, o nome e a arte ganham o efeito
  // (main.css, .mythic-*).
  mitico: { label: 'Mítico', color: '#ff7ae6', bg: 'rgba(255,122,230,0.16)', rank: 4 }
}

export function rarityMeta(rarity: BadgeRarity | undefined): RarityMeta {
  return (rarity && RARITY[rarity]) || RARITY.comum
}

/**
 * "Locutor (Tempo em call)"; quando o tier tem o nome do badge (Pioneiro,
 * Fundador), só o nome, sem repetir.
 */
export function badgeLabel(b: Pick<Badge, 'name' | 'tier_name'>): string {
  return !b.tier_name || b.tier_name === b.name ? b.name : `${b.tier_name} (${b.name})`
}

/** Mítico ganha o efeito holográfico (aura, brilho e partículas). */
export function isMythic(rarity: BadgeRarity | undefined): boolean {
  return rarity === 'mitico'
}

export interface HoloPointer {
  /** Posição do brilho, 0–100 (%). */
  mx: number
  my: number
  /** Inclinação em graus: o lado do mouse afunda. */
  rx: number
  ry: number
}

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n))
const round2 = (n: number): number => Math.round(n * 100) / 100 + 0

/** Brilho e inclinação da arte mítica seguindo o mouse dentro de `rect`. */
export function holoPointer(
  x: number,
  y: number,
  rect: { left: number; top: number; width: number; height: number },
  maxTilt = 12
): HoloPointer {
  const px = rect.width > 0 ? clamp01((x - rect.left) / rect.width) : 0.5
  const py = rect.height > 0 ? clamp01((y - rect.top) / rect.height) : 0.5
  return {
    mx: round2(px * 100),
    my: round2(py * 100),
    rx: round2((0.5 - py) * 2 * maxTilt),
    ry: round2((px - 0.5) * 2 * maxTilt)
  }
}

const HOUR = 3600

const DEV_TEXT = 'Dev do Salinha'
const DEV_ONLY = 'Só para os devs'
const VOTE_TEXT = 'Fez o L no segundo turno'
const BIRTHDAY_TEXT = 'Comemorou o aniversário no Salinha'

function birthdayText(b: Badge, value: number): string {
  if (value > 0) return 'Hoje é o seu aniversário!'
  return b.tier > 0 ? BIRTHDAY_TEXT : 'Ganho no dia do seu aniversário'
}

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
  maratona: 'seguidas numa call',
  camera: 'com a câmera ligada'
}

/** O texto da estatística de cada unidade; unidade sem entrada mostra o número. */
const STAT_TEXT: Partial<Record<BadgeUnit, (b: Badge, value: number) => string>> = {
  seconds: (b, value) => `${hoursText(value)} ${TIME_SUFFIX[b.category] ?? 'em call'}`,
  months: (_, value) => `${monthsText(value)} de conta`,
  messages: (_, value) => (value === 1 ? '1 mensagem enviada' : `${num(value)} mensagens enviadas`),
  reactions: (_, value) => plural(value, 'reação', 'reações'),
  level: (_, value) => `Nível ${num(value)}`,
  people: (_, value) => `Call com até ${plural(value, 'pessoa', 'pessoas')}`,
  servers: (_, value) => `Dono de ${plural(value, 'servidor', 'servidores')}`,
  proposals: (_, value) => (value === 1 ? '1 proposta criada' : `${num(value)} propostas criadas`),
  songs: (_, value) => plural(value, 'música pedida', 'músicas pedidas'),
  sounds: (_, value) => plural(value, 'som tocado', 'sons tocados'),
  stickers: (_, value) => plural(value, 'figurinha ou GIF enviado', 'figurinhas e GIFs enviados'),
  votes: (_, value) => plural(value, 'voto dado', 'votos dados'),
  birthday: birthdayText,
  days: (_, value) => `Recorde de ${plural(value, 'dia seguido', 'dias seguidos')}`,
  founder: (_, value) =>
    value > 0 ? 'Chegou nas primeiras semanas' : 'Chegou depois das primeiras semanas',
  dev: () => DEV_TEXT,
  vote: () => VOTE_TEXT
}

/** A estatística da linha "798 horas em call • Desbloqueado em … • RARO". */
export function statText(b: Badge): string {
  const value = b.value ?? 0
  return STAT_TEXT[b.unit]?.(b, value) ?? num(value)
}

/** Badges de um tier só: no perfil dos outros, uma frase, sem número. */
const PUBLIC_FIXED_TEXT: Partial<Record<BadgeUnit, string>> = {
  founder: 'Chegou nas primeiras semanas',
  dev: DEV_TEXT,
  vote: VOTE_TEXT,
  birthday: BIRTHDAY_TEXT
}

/**
 * Estatística no perfil de outra pessoa: o limite do tier conquistado
 * ("2.000+ mensagens"), nunca o número exato.
 */
export function publicStatText(b: Badge): string {
  const fixed = PUBLIC_FIXED_TEXT[b.unit]
  if (fixed) return fixed
  const reached = b.tiers[b.tier - 1]
  if (!reached) return ''
  const label = `${formatThreshold(b.unit, reached.threshold)}`
  if (b.unit === 'level') return `${label}+`
  const [n, ...rest] = label.split(' ')
  const suffix = b.unit === 'seconds' ? ` ${TIME_SUFFIX[b.category] ?? 'em call'}` : ''
  return `${n}+ ${rest.join(' ')}${suffix}`
}

/** Unidades que são só uma contagem: [singular, plural]. */
const COUNT_NOUN: Partial<Record<BadgeUnit, [string, string]>> = {
  messages: ['mensagem', 'mensagens'],
  reactions: ['reação', 'reações'],
  servers: ['servidor', 'servidores'],
  proposals: ['proposta', 'propostas'],
  songs: ['música', 'músicas'],
  sounds: ['som', 'sons'],
  stickers: ['figurinha ou GIF', 'figurinhas e GIFs'],
  votes: ['voto', 'votos']
}

/** O rótulo do limite das unidades que não são só uma contagem. */
const THRESHOLD_TEXT: Partial<Record<BadgeUnit, (threshold: number) => string>> = {
  seconds: (t) => plural(Math.floor(t / HOUR), 'hora', 'horas'),
  months: (t) => plural(t, 'mês', 'meses'),
  level: (t) => `Nível ${num(t)}`,
  people: (t) => plural(t, 'pessoa', 'pessoas'),
  days: (t) => plural(t, 'dia seguido', 'dias seguidos'),
  // Corte do backend: contas criadas antes de 01/11/2026.
  founder: () => 'Até 31/10/26',
  dev: () => DEV_ONLY,
  vote: () => 'Fez o L',
  birthday: () => 'No dia do aniversário'
}

/** Rótulo de um degrau da escada: "1 hora", "3 meses", "2.000 mensagens". */
export function formatThreshold(unit: BadgeUnit, threshold: number): string {
  const noun = COUNT_NOUN[unit]
  if (noun) return plural(threshold, noun[0], noun[1])
  return THRESHOLD_TEXT[unit]?.(threshold) ?? num(threshold)
}

function falta(n: number, one: string, many: string): string {
  return n === 1 ? `Falta 1 ${one}` : `Faltam ${num(n)} ${many}`
}

const DAY_MS = 24 * 60 * 60 * 1000

function hoursRemaining(left: number): string {
  if (left < HOUR) return `Faltam ${Math.max(1, Math.ceil(left / 60))} min`
  return falta(Math.ceil(left / HOUR), 'hora', 'horas')
}

function monthsRemaining(b: Badge, left: number, now: Date): string {
  if (!b.next_at) return falta(left, 'mês', 'meses')
  const days = Math.max(1, Math.ceil((new Date(b.next_at).getTime() - now.getTime()) / DAY_MS))
  if (days >= 60) return falta(Math.round(days / 30.44), 'mês', 'meses')
  return falta(days, 'dia', 'dias')
}

/** O "falta quanto" das unidades que não são só uma contagem. */
const REMAINING_TEXT: Partial<Record<BadgeUnit, (b: Badge, left: number, now: Date) => string>> = {
  seconds: (_, left) => hoursRemaining(left),
  months: monthsRemaining,
  level: (_, left) => falta(left, 'nível', 'níveis'),
  people: (b) => `Uma call com ${plural(b.next_threshold ?? 0, 'pessoa', 'pessoas')}`,
  days: (b) => `Uma sequência de ${plural(b.next_threshold ?? 0, 'dia', 'dias')}`,
  founder: () => 'Só para quem chegou nas primeiras semanas',
  dev: () => DEV_ONLY,
  birthday: () => 'Chega no dia do seu aniversário'
}

/** "Faltam 20 horas", "Faltam 4 meses", "Tier máximo!". */
export function remainingText(b: Badge, now: Date = new Date()): string {
  if (b.next_threshold === undefined || b.next_threshold === null) return 'Tier máximo!'
  const left = Math.max(0, b.next_threshold - (b.value ?? 0))
  const noun = COUNT_NOUN[b.unit]
  if (noun) return falta(left, noun[0], noun[1])
  return REMAINING_TEXT[b.unit]?.(b, left, now) ?? ''
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

/**
 * O que o modal de badges mostra: no próprio perfil, os ganhos e os que dá
 * para desbloquear; no dos outros, só os ganhos.
 */
export function visibleBadges(
  badges: Badge[] | undefined,
  isMe: boolean
): { earned: Badge[]; available: Badge[]; visible: Badge[] } {
  const { earned, available } = splitBadges(badges ?? [])
  return { earned, available, visible: isMe ? [...earned, ...available] : earned }
}

/**
 * O badge aberto no detalhe: o clicado (só vale para esta abertura do modal),
 * senão o pedido ao abrir, senão o primeiro.
 */
export function selectedBadge<T extends { category?: string }>(
  visible: Badge[],
  target: T,
  picked: { target: T; category: string } | null
): Badge | undefined {
  const wanted = picked?.target === target ? picked.category : target.category
  return visible.find((b) => b.category === wanted) ?? visible[0]
}

/** Badges que têm celebração própria na tela e ficam de fora do aviso genérico. */
const CELEBRACAO_PROPRIA = new Set(['l'])

/** Os desbloqueios que o aviso genérico mostra. */
export function unlocksComAviso(unlocks: BadgeUnlockEvent['unlocks']): BadgeUnlockEvent['unlocks'] {
  return unlocks.filter((u) => !CELEBRACAO_PROPRIA.has(u.category))
}

/** Quantos badges (categorias) o aviso de desbloqueio tem, não tiers. */
export function unlockCount(unlocks: BadgeUnlockEvent['unlocks']): number {
  return new Set(unlocks.map((u) => u.category)).size
}
