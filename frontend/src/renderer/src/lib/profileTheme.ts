import type { CSSProperties } from 'react'

// Tema do cartão de perfil: borda, fundo do corpo (cor ou degradê em pé, como
// o tema de perfil do Nitro) e um efeito por cima. Os IDs são os do backend
// (internal/profiletheme); profileTheme.test.ts confere as listas.

export interface ProfileTheme {
  border: string
  border_colors: string[]
  background: string
  background_colors: string[]
  effect: string
}

export const DEFAULT_PROFILE_THEME: ProfileTheme = {
  border: 'none',
  border_colors: [],
  background: 'default',
  background_colors: [],
  effect: 'none'
}

/**
 * Fundo do cartão sem tema (recorta o avatar e a bolinha de status): o
 * --bg-floating do tema de cor do app (assets/theme.css).
 */
export const CARD_BG = 'var(--bg-floating)'

export const PROFILE_BORDERS = [
  { id: 'none', label: 'Nenhuma', colors: 0 },
  { id: 'solid', label: 'Cor sólida', colors: 1 },
  { id: 'neon', label: 'Neon', colors: 1 },
  { id: 'rainbow', label: 'Arco-íris', colors: 0 },
  { id: 'gradient', label: 'Degradê', colors: 2 }
] as const

export const PROFILE_BACKGROUNDS = [
  { id: 'default', label: 'Padrão', colors: 0 },
  { id: 'solid', label: 'Cor sólida', colors: 1 },
  { id: 'gradient', label: 'Degradê', colors: 2 }
] as const

export const PROFILE_EFFECTS = [
  { id: 'none', label: 'Nenhum' },
  { id: 'particles', label: 'Partículas' },
  { id: 'sparkles', label: 'Brilhos' },
  { id: 'snow', label: 'Neve' }
] as const

const COLOR = /^#[0-9a-f]{6}$/i
const BORDER_FALLBACK = ['#8b5cf6', '#ec4899']
const BACKGROUND_FALLBACK = ['#5865f2', '#1e1f22']

function cleanColors(raw: unknown, want: number): string[] | null {
  const list = Array.isArray(raw) ? raw : []
  const colors = list
    .filter((c): c is string => typeof c === 'string' && COLOR.test(c))
    .map((c) => c.toLowerCase())
  return colors.length === want && list.length === want ? colors : null
}

/**
 * Tema seguro para desenhar: cada parte inválida (ID desconhecido, cor fora do
 * formato, número de cores errado) volta ao padrão sozinha. Cor nunca vira CSS
 * sem passar por aqui.
 */
export function resolveProfileTheme(raw?: Partial<ProfileTheme> | null): ProfileTheme {
  const border = PROFILE_BORDERS.find((b) => b.id === raw?.border)
  const borderColors = border ? cleanColors(raw?.border_colors, border.colors) : null
  const background = PROFILE_BACKGROUNDS.find((b) => b.id === raw?.background)
  const backgroundColors = background
    ? cleanColors(raw?.background_colors, background.colors)
    : null
  const effect = PROFILE_EFFECTS.find((e) => e.id === raw?.effect)
  return {
    border: border && borderColors ? border.id : 'none',
    border_colors: border && borderColors ? borderColors : [],
    background: background && backgroundColors ? background.id : 'default',
    background_colors: background && backgroundColors ? backgroundColors : [],
    effect: effect?.id ?? 'none'
  }
}

/** Troca a borda mantendo as cores que servem e completando as que faltam. */
export function withBorder(theme: ProfileTheme, id: string): ProfileTheme {
  const def = PROFILE_BORDERS.find((b) => b.id === id)
  if (!def) return theme
  const colors = [...theme.border_colors, ...BORDER_FALLBACK.slice(theme.border_colors.length)]
  return { ...theme, border: id, border_colors: colors.slice(0, def.colors) }
}

/** Troca o fundo mantendo as cores que servem e completando as que faltam. */
export function withBackground(theme: ProfileTheme, id: string): ProfileTheme {
  const def = PROFILE_BACKGROUNDS.find((b) => b.id === id)
  if (!def) return theme
  const colors = [
    ...theme.background_colors,
    ...BACKGROUND_FALLBACK.slice(theme.background_colors.length)
  ]
  return { ...theme, background: id, background_colors: colors.slice(0, def.colors) }
}

// --- Contraste (WCAG 2.x) ---

function channel(v: number): number {
  const c = v / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Luminância relativa (0 = preto, 1 = branco). */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = rgb(hex)
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** Razão de contraste entre duas cores (1 a 21). */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

function mix(a: string, b: string): string {
  const ca = rgb(a)
  const cb = rgb(b)
  return `#${ca
    .map((v, i) =>
      Math.round((v + cb[i]) / 2)
        .toString(16)
        .padStart(2, '0')
    )
    .join('')}`
}

/** Texto claro e escuro do cartão (o claro é o do app). */
export const LIGHT_INK = '#ffffff'
export const DARK_INK = '#1e1f22'
export type Ink = 'light' | 'dark'

/**
 * Cor do texto que dá mais contraste em todo o fundo: no degradê conta o pior
 * ponto (as duas pontas e o meio). Empate fica com o claro, o do app.
 */
export function pickInk(background: string[]): Ink {
  const valid = background.filter((c) => COLOR.test(c))
  if (valid.length === 0) return 'light'
  const points = valid.length > 1 ? [...valid, mix(valid[0], valid[valid.length - 1])] : valid
  const worst = (ink: string): number => Math.min(...points.map((p) => contrastRatio(ink, p)))
  return worst(DARK_INK) > worst(LIGHT_INK) ? 'dark' : 'light'
}

export interface ProfileThemeLook {
  /** Classes do cartão (borda, texto escuro). */
  className: string
  /** Variáveis que o CSS lê (assets/profileTheme.css). */
  style: CSSProperties
  /** Cor do fundo logo abaixo do banner: o anel do avatar e o recorte do status. */
  surface: string
  ink: Ink
}

/** Como desenhar o cartão com o tema (já resolvido). */
export function profileThemeLook(theme: ProfileTheme): ProfileThemeLook {
  const bg = theme.background_colors
  const surface = bg[0] ?? CARD_BG
  // Sempre uma imagem: no "background" em camadas a cor só pode ir na última.
  const body =
    theme.background === 'gradient'
      ? `linear-gradient(180deg, ${bg[0]}, ${bg[1]})`
      : `linear-gradient(${surface}, ${surface})`
  const [b1, b2] = theme.border_colors
  const vars: Record<string, string> = { '--pt-bg': body }
  if (b1) vars['--pt-b1'] = b1
  if (b2) vars['--pt-b2'] = b2
  vars['--pt-fx'] = b1 ?? bg[1] ?? '#c4b5fd'
  // Sem fundo próprio o texto é o do tema do app; com fundo, o de mais contraste.
  const ink = bg.length ? pickInk(bg) : 'light'
  const inkClass = bg.length ? (ink === 'dark' ? 'pt-ink-dark' : 'pt-ink-light') : null
  const className = ['profile-frame', `pt-border-${theme.border}`, inkClass]
    .filter(Boolean)
    .join(' ')
  return { className, style: vars as CSSProperties, surface, ink }
}

// --- Efeitos (partículas, brilhos, neve) ---

export interface Particle {
  /** Posição em % do cartão. */
  left: number
  top: number
  /** Tamanho em px. */
  size: number
  /** Segundos. */
  delay: number
  duration: number
}

const PARTICLE_COUNT: Record<string, number> = { particles: 14, sparkles: 10, snow: 18 }

/**
 * Posições fixas (sempre as mesmas para o mesmo efeito): o desenho não muda a
 * cada render e o CSS só anima transform/opacity.
 */
export function effectParticles(effect: string): Particle[] {
  const count = PARTICLE_COUNT[effect] ?? 0
  let seed = effect.length * 7919 + 17
  const rand = (): number => {
    seed = (seed * 1103515245 + 12345) % 2147483648
    return seed / 2147483648
  }
  return Array.from({ length: count }, (_, i) => {
    const r = [rand(), rand(), rand(), rand()]
    return {
      // Espalha por faixas para não amontoar.
      left: Math.round(((i + r[0]) / count) * 1000) / 10,
      top: Math.round(r[1] * 1000) / 10,
      size: effect === 'sparkles' ? 8 + Math.round(r[2] * 6) : 2 + Math.round(r[2] * 3),
      delay: Math.round(r[3] * (effect === 'snow' ? 8 : 4) * 10) / 10,
      duration: effect === 'snow' ? 7 + Math.round(r[2] * 50) / 10 : 3 + Math.round(r[0] * 30) / 10
    }
  })
}

// --- Predefinições do editor ---

export const PROFILE_PRESETS: { id: string; label: string; theme: ProfileTheme }[] = [
  { id: 'default', label: 'Padrão', theme: DEFAULT_PROFILE_THEME },
  {
    id: 'midnight',
    label: 'Meia-noite',
    theme: {
      border: 'neon',
      border_colors: ['#8b5cf6'],
      background: 'gradient',
      background_colors: ['#1e1b4b', '#0b1020'],
      effect: 'sparkles'
    }
  },
  {
    id: 'wine',
    label: 'Vinho',
    theme: {
      border: 'none',
      border_colors: [],
      background: 'gradient',
      background_colors: ['#6b1d12', '#4b4f58'],
      effect: 'none'
    }
  },
  {
    id: 'amethyst',
    label: 'Ametista',
    theme: {
      border: 'gradient',
      border_colors: ['#a78bfa', '#57534e'],
      background: 'gradient',
      background_colors: ['#2e1065', '#57534e'],
      effect: 'none'
    }
  },
  {
    id: 'sakura',
    label: 'Sakura',
    theme: {
      border: 'solid',
      border_colors: ['#ec4899'],
      background: 'gradient',
      background_colors: ['#fce7f3', '#f9a8d4'],
      effect: 'particles'
    }
  },
  {
    id: 'ocean',
    label: 'Oceano',
    theme: {
      border: 'gradient',
      border_colors: ['#22d3ee', '#3b82f6'],
      background: 'gradient',
      background_colors: ['#0c4a6e', '#082f49'],
      effect: 'none'
    }
  },
  {
    id: 'ember',
    label: 'Brasa',
    theme: {
      border: 'neon',
      border_colors: ['#f97316'],
      background: 'gradient',
      background_colors: ['#7f1d1d', '#1c0a05'],
      effect: 'particles'
    }
  },
  {
    id: 'snowy',
    label: 'Noite de neve',
    theme: {
      border: 'solid',
      border_colors: ['#94a3b8'],
      background: 'gradient',
      background_colors: ['#1e293b', '#0f172a'],
      effect: 'snow'
    }
  },
  {
    id: 'party',
    label: 'Festa',
    theme: {
      border: 'rainbow',
      border_colors: [],
      background: 'default',
      background_colors: [],
      effect: 'sparkles'
    }
  }
]

/** Mesmo tema (compara já resolvido). */
export function sameTheme(a: ProfileTheme, b: ProfileTheme): boolean {
  return JSON.stringify(resolveProfileTheme(a)) === JSON.stringify(resolveProfileTheme(b))
}
