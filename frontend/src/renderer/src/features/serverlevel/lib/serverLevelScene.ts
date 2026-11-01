import type { CSSProperties } from 'react'
import { RAINBOW } from '../../levels/lib/levels'
import type { SoundName } from '../../call/lib/sounds'

/**
 * Animação de subida de nível do SERVIDOR: igual à das pessoas, mas bem
 * maior. Escala por faixas (como os marcos do perfil): cada faixa liga um
 * efeito novo e põe mais partículas, e os marcos redondos têm cena própria.
 *   1–4 base · 5–9 fogos · 10–19 tempestade de raios (e tremor) ·
 *   20–29 explosão cósmica · 30+ lendária (aurora, anéis, partículas em massa)
 *   marcos: 10 coroa de raios · 25/75… supernova · 50/150… eclipse · 100/200… big bang
 */
export const SERVER_BANDS = ['base', 'fogos', 'tempestade', 'cosmica', 'lendaria'] as const
export type ServerBand = (typeof SERVER_BANDS)[number]
export type ServerMilestone = 'coroa' | 'supernova' | 'eclipse' | 'bigbang'

export interface ServerSceneLayers {
  /** Foguetes subindo e estourando pela tela. */
  fireworks: boolean
  /** Raios das bordas até o centro, com clarão. */
  lightning: boolean
  /** Galáxia girando em volta do ícone. */
  galaxy: boolean
  /** Aurora no alto da tela. */
  aurora: boolean
}

export interface ServerScene {
  level: number
  band: ServerBand
  milestone: ServerMilestone | null
  /** Nome da cena (aparece só nos marcos). */
  title: string
  durationMs: number
  /** Quantas partículas a cena pode criar. */
  particles: number
  /** Tremida do overlay (px), nunca do app. */
  shake: number
  /** Anéis de energia em volta do ícone. */
  rings: number
  layers: ServerSceneLayers
  /** Cores das partículas e dos raios. */
  palette: string[]
  /** Cor principal (brilho, anel de progresso). */
  color: string
  sound: SoundName
}

interface BandInfo {
  title: string
  durationMs: number
  particles: number
  shake: number
  rings: number
  palette: string[]
  sound: SoundName
}

const BAND: Record<ServerBand, BandInfo> = {
  base: {
    title: 'Onda de energia',
    durationMs: 3200,
    particles: 90,
    shake: 0,
    rings: 1,
    palette: ['#a78bfa', '#60a5fa', '#ffffff'],
    sound: 'levelChimeRich'
  },
  fogos: {
    title: 'Fogos',
    durationMs: 3600,
    particles: 140,
    shake: 0,
    rings: 1,
    palette: ['#f59e0b', '#f472b6', '#a78bfa', '#ffffff', '#facc15'],
    sound: 'levelFanfare'
  },
  tempestade: {
    title: 'Tempestade de energia',
    durationMs: 4000,
    particles: 180,
    shake: 3,
    rings: 2,
    palette: ['#67e8f9', '#a5b4fc', '#ffffff', '#facc15', '#60a5fa'],
    sound: 'levelFanfare'
  },
  cosmica: {
    title: 'Explosão cósmica',
    durationMs: 4500,
    particles: 220,
    shake: 4,
    rings: 2,
    palette: ['#c084fc', '#f472b6', '#60a5fa', '#fde68a', '#ffffff', '#67e8f9'],
    sound: 'levelFanfare'
  },
  lendaria: {
    title: 'Lendária',
    durationMs: 5000,
    particles: 270,
    shake: 5,
    rings: 3,
    palette: [...RAINBOW, '#ffffff', '#fde68a'],
    sound: 'milestone-legendary'
  }
}

const MILESTONE_TITLE: Record<ServerMilestone, string> = {
  coroa: 'Coroa de raios',
  supernova: 'Supernova',
  eclipse: 'Eclipse',
  bigbang: 'Big Bang'
}

function bandFor(level: number): ServerBand {
  if (level >= 30) return 'lendaria'
  if (level >= 20) return 'cosmica'
  if (level >= 10) return 'tempestade'
  return level >= 5 ? 'fogos' : 'base'
}

function milestoneFor(level: number): ServerMilestone | null {
  if (level % 100 === 0) return 'bigbang'
  if (level % 50 === 0) return 'eclipse'
  if (level % 25 === 0) return 'supernova'
  return level === 10 ? 'coroa' : null
}

const LAYER_FROM: Record<keyof ServerSceneLayers, ServerBand> = {
  fireworks: 'fogos',
  lightning: 'tempestade',
  galaxy: 'cosmica',
  aurora: 'lendaria'
}

function layersFor(band: ServerBand): ServerSceneLayers {
  const at = SERVER_BANDS.indexOf(band)
  const on = (layer: keyof ServerSceneLayers): boolean =>
    at >= SERVER_BANDS.indexOf(LAYER_FROM[layer])
  return {
    fireworks: on('fireworks'),
    lightning: on('lightning'),
    galaxy: on('galaxy'),
    aurora: on('aurora')
  }
}

export function serverLevelScene(rawLevel: number): ServerScene {
  const level = Number.isFinite(rawLevel) ? Math.max(1, Math.floor(rawLevel)) : 1
  const band = bandFor(level)
  const info = BAND[band]
  const milestone = milestoneFor(level)
  // Dentro da faixa cresce um pouco a cada nível (até +30).
  const particles = info.particles + Math.min(30, level) + (milestone ? 50 : 0)
  return {
    level,
    band,
    milestone,
    title: milestone ? MILESTONE_TITLE[milestone] : info.title,
    durationMs: milestone ? 5000 : info.durationMs,
    particles,
    shake: milestone ? Math.min(7, info.shake + 2) : info.shake,
    rings: info.rings + (milestone ? 1 : 0),
    layers: layersFor(band),
    palette: info.palette,
    color: info.palette[0],
    sound: milestone ? 'milestone-legendary' : info.sound
  }
}

/** Selo "Nv. N" do servidor: um material por faixa. */
export interface ServerLevelBadgeLook {
  name: string
  className: string
  style: CSSProperties
  text: string
  /** Cores atrás do texto (o teste mede o contraste AA). */
  surface: string[]
}

const BADGES: { from: number; name: string; bg: [string, string]; text: string; extra?: string }[] =
  [
    {
      from: 30,
      name: 'Lendário',
      bg: ['#4c1d95', '#9d174d'],
      text: '#ffffff',
      extra: 'server-level-legendary'
    },
    { from: 20, name: 'Cristal', bg: ['#a5f3fc', '#22d3ee'], text: '#062a33' },
    { from: 10, name: 'Ouro', bg: ['#fde68a', '#d4a017'], text: '#1c1404' },
    { from: 5, name: 'Prata', bg: ['#e2e8f0', '#94a3b8'], text: '#0f172a' },
    { from: -Infinity, name: 'Bronze', bg: ['#a0612a', '#6b3a12'], text: '#ffffff' }
  ]

export function serverLevelBadge(level: number): ServerLevelBadgeLook {
  const badge = BADGES.find((b) => level >= b.from) ?? BADGES[BADGES.length - 1]
  return {
    name: badge.name,
    className: badge.extra ?? '',
    style: {
      color: badge.text,
      backgroundImage: `linear-gradient(135deg, ${badge.bg[0]}, ${badge.bg[1]})`
    },
    text: badge.text,
    surface: badge.bg
  }
}

/** Quantos números a contagem passa no máximo (do anterior até o novo). */
const MAX_ROLL = 12

/** Os números da contagem, do anterior (ou dos últimos 12) até o novo. */
export function rollNumbers(from: number, to: number): number[] {
  const start = Math.max(from, to - MAX_ROLL, 0)
  return Array.from({ length: Math.max(1, to - start + 1) }, (_, i) => Math.min(to, start + i))
}
