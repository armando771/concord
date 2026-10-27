import type { CSSProperties } from 'react'
import { pickInk, type Ink } from './profileInk'

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

/** Mesmo tema (compara já resolvido). */
export function sameTheme(a: ProfileTheme, b: ProfileTheme): boolean {
  return JSON.stringify(resolveProfileTheme(a)) === JSON.stringify(resolveProfileTheme(b))
}
