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

const FOUNDER_TEXT = 'Chegou nas primeiras semanas'
const DEV_TEXT = 'Dev do Salinha'
const DEV_ONLY = 'Só para os devs'
/** O nome da escolha de cada badge do segundo turno (categoria -> "Fez o L"). */
export const VOTE_NAME: Record<string, string> = {
  l: 'Fez o L',
  v22: 'Fez o 22',
  nulo: 'Votou Nulo'
}

function voteName(category: string | undefined): string {
  return VOTE_NAME[category ?? ''] ?? VOTE_NAME.l
}

function voteText(category: string | undefined): string {
  return `${voteName(category)} no segundo turno`
}
const BIRTHDAY_TEXT = 'Comemorou o aniversário no Salinha'

function birthdayText(value: number): string {
  return value > 0 ? 'Hoje é o seu aniversário!' : BIRTHDAY_TEXT
}

/** "#3 de 10 a chegar no nível 100" (a posição vem também para os outros). */
function rankText(value: number | undefined): string {
  return value ? `#${num(value)} de 10 a chegar no nível 100` : 'Um dos 10 primeiros no nível 100'
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
  espectador: 'assistindo lives',
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
  friends: (_, value) => plural(value, 'amigo', 'amigos'),
  bugs: (_, value) => (value === 1 ? '1 bug reportado' : `${num(value)} bugs reportados`),
  rank: (_, value) => rankText(value),
  songs: (_, value) => plural(value, 'música pedida', 'músicas pedidas'),
  sounds: (_, value) => plural(value, 'som tocado', 'sons tocados'),
  stickers: (_, value) => plural(value, 'figurinha ou GIF enviado', 'figurinhas e GIFs enviados'),
  days: (_, value) => `Recorde de ${plural(value, 'dia seguido', 'dias seguidos')}`,
  votes: (_, value) => plural(value, 'voto dado', 'votos dados'),
  birthday: (_, value) => birthdayText(value),
  firsts: (_, value) => `Primeira mensagem de ${plural(value, 'servidor', 'servidores')}`,
  founder: () => FOUNDER_TEXT,
  dev: () => DEV_TEXT,
  vote: (b) => voteText(b.category)
}

/** A estatística da linha "798 horas em call • Desbloqueado em … • RARO". */
export function statText(b: Badge): string {
  const value = b.value ?? 0
  return STAT_TEXT[b.unit]?.(b, value) ?? num(value)
}

/** Badges sem escada de números: no perfil dos outros, uma frase. */
const PUBLIC_FIXED_TEXT: Partial<Record<BadgeUnit, (b: Badge) => string>> = {
  founder: () => FOUNDER_TEXT,
  dev: () => DEV_TEXT,
  vote: (b) => voteText(b.category),
  rank: (b) => rankText(b.value),
  birthday: () => BIRTHDAY_TEXT
}

/** O que vem antes do número no perfil dos outros ("Primeira mensagem de 3+ servidores"). */
const PUBLIC_PREFIX: Partial<Record<BadgeUnit, string>> = {
  firsts: 'Primeira mensagem de '
}

/**
 * Estatística no perfil de outra pessoa: o limite do tier conquistado
 * ("2.000+ mensagens"), nunca o número exato.
 */
export function publicStatText(b: Badge): string {
  const fixed = PUBLIC_FIXED_TEXT[b.unit]
  if (fixed) return fixed(b)
  const reached = b.tiers[b.tier - 1]
  if (!reached) return ''
  const label = `${formatThreshold(b.unit, reached.threshold)}`
  if (b.unit === 'level') return `${label}+`
  const [n, ...rest] = label.split(' ')
  const suffix = b.unit === 'seconds' ? ` ${TIME_SUFFIX[b.category] ?? 'em call'}` : ''
  return `${PUBLIC_PREFIX[b.unit] ?? ''}${n}+ ${rest.join(' ')}${suffix}`
}

/** Rótulo de um degrau da escada, por unidade; unidade sem entrada mostra o número. */
const THRESHOLD_TEXT: Partial<Record<BadgeUnit, (threshold: number, category?: string) => string>> = {
  seconds: (t) => plural(Math.floor(t / HOUR), 'hora', 'horas'),
  // "6 meses", "1 ano", "10 anos".
  months: (t) => monthsText(t),
  messages: (t) => plural(t, 'mensagem', 'mensagens'),
  reactions: (t) => plural(t, 'reação', 'reações'),
  level: (t) => `Nível ${num(t)}`,
  people: (t) => plural(t, 'pessoa', 'pessoas'),
  servers: (t) => plural(t, 'servidor', 'servidores'),
  proposals: (t) => plural(t, 'proposta', 'propostas'),
  friends: (t) => plural(t, 'amigo', 'amigos'),
  bugs: (t) => plural(t, 'bug', 'bugs'),
  rank: () => 'Top 10',
  songs: (t) => plural(t, 'música', 'músicas'),
  sounds: (t) => plural(t, 'som', 'sons'),
  stickers: (t) => plural(t, 'figurinha ou GIF', 'figurinhas e GIFs'),
  days: (t) => plural(t, 'dia seguido', 'dias seguidos'),
  votes: (t) => plural(t, 'voto', 'votos'),
  birthday: () => 'No dia do aniversário',
  firsts: (t) => plural(t, 'servidor', 'servidores'),
  // Corte do backend: contas criadas antes de 01/11/2026.
  founder: () => 'Até 31/10/26',
  dev: () => DEV_ONLY,
  vote: (_, category) => voteName(category)
}

/** Rótulo de um degrau da escada: "1 hora", "3 meses", "2.000 mensagens". */
export function formatThreshold(unit: BadgeUnit, threshold: number, category?: string): string {
  return THRESHOLD_TEXT[unit]?.(threshold, category) ?? num(threshold)
}

function falta(n: number, one: string, many: string): string {
  return n === 1 ? `Falta 1 ${one}` : `Faltam ${num(n)} ${many}`
}

const DAY_MS = 24 * 60 * 60 * 1000

function secondsRemaining(left: number): string {
  if (left < HOUR) return `Faltam ${Math.max(1, Math.ceil(left / 60))} min`
  return falta(Math.ceil(left / HOUR), 'hora', 'horas')
}

/** Idade da conta conta pelo dia em que o próximo tier chega. */
function monthsRemaining(b: Badge, left: number, now: Date): string {
  if (!b.next_at) return falta(left, 'mês', 'meses')
  const days = Math.max(1, Math.ceil((new Date(b.next_at).getTime() - now.getTime()) / DAY_MS))
  if (days >= 60) return falta(Math.round(days / 30.44), 'mês', 'meses')
  return falta(days, 'dia', 'dias')
}

type RemainingFn = (b: Badge, left: number, now: Date) => string

/** Quanto falta, por unidade; unidade sem entrada não mostra nada. */
const REMAINING_TEXT: Partial<Record<BadgeUnit, RemainingFn>> = {
  seconds: (_, left) => secondsRemaining(left),
  months: monthsRemaining,
  messages: (_, left) => falta(left, 'mensagem', 'mensagens'),
  reactions: (_, left) => falta(left, 'reação', 'reações'),
  level: (_, left) => falta(left, 'nível', 'níveis'),
  people: (b) => `Uma call com ${plural(b.next_threshold ?? 0, 'pessoa', 'pessoas')}`,
  servers: (_, left) => falta(left, 'servidor', 'servidores'),
  proposals: (_, left) => falta(left, 'proposta', 'propostas'),
  friends: (_, left) => falta(left, 'amigo', 'amigos'),
  bugs: (_, left) => falta(left, 'bug', 'bugs'),
  songs: (_, left) => falta(left, 'música', 'músicas'),
  sounds: (_, left) => falta(left, 'som', 'sons'),
  stickers: (_, left) => falta(left, 'figurinha ou GIF', 'figurinhas e GIFs'),
  // O valor é o recorde, não a sequência atual: a meta é uma sequência nova.
  days: (b) => `Uma sequência de ${plural(b.next_threshold ?? 0, 'dia', 'dias')}`,
  votes: (_, left) => falta(left, 'voto', 'votos'),
  birthday: () => 'Chega no dia do seu aniversário',
  firsts: (_, left) => falta(left, 'servidor', 'servidores'),
  founder: () => 'Só para quem chegou nas primeiras semanas',
  dev: () => DEV_ONLY
}

/** "Faltam 20 horas", "Faltam 4 meses", "Tier máximo!". */
export function remainingText(b: Badge, now: Date = new Date()): string {
  if (b.next_threshold === undefined || b.next_threshold === null) return 'Tier máximo!'
  const left = Math.max(0, b.next_threshold - (b.value ?? 0))
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

/**
 * O que o modal de badges mostra, no próprio perfil e no dos outros: só os
 * conquistados. Categorias sem o tier 1 nem chegam da API.
 */
export function visibleBadges(badges: Badge[] | undefined): Badge[] {
  return earnedBadges(badges ?? [])
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
const CELEBRACAO_PROPRIA = new Set(['l', 'v22', 'nulo'])

/** Os desbloqueios que o aviso genérico mostra. */
export function unlocksComAviso(unlocks: BadgeUnlockEvent['unlocks']): BadgeUnlockEvent['unlocks'] {
  return unlocks.filter((u) => !CELEBRACAO_PROPRIA.has(u.category))
}

/** Quantos badges (categorias) o aviso de desbloqueio tem, não tiers. */
export function unlockCount(unlocks: BadgeUnlockEvent['unlocks']): number {
  return new Set(unlocks.map((u) => u.category)).size
}
