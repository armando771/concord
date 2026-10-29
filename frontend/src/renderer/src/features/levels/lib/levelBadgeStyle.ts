import type { CSSProperties } from 'react'
import { levelTier, LEGENDARY_TIER } from './levels'

/**
 * Visual do selo "Nv N". Quase todo nível usa o degradê da faixa (Bronze,
 * Prata…); alguns níveis têm um selo próprio, decidido pelo dono:
 * 13 vermelho com estrelinhas, 14 onça-pintada, 22 Brasil e 24 arco-íris do
 * orgulho. Vale em todo lugar onde o selo aparece (lista de membros, cartão,
 * ranking, prévia). As cores ficam aqui (o teste confere o contraste AA); o
 * movimento (cintilar, brilho) fica em components/levelSpecial.css.
 */
export type LevelBadgeVariant = 'faixa' | 'lendario' | 'estrelas' | 'onca' | 'brasil' | 'orgulho'

export interface LevelBadgeLook {
  variant: LevelBadgeVariant
  /** Classes do selo (cor do texto e animação). */
  className: string
  /** Fundo (degradê, estampa) e sombra do texto. */
  style: CSSProperties
  /** Cor do brilho em volta quando a pessoa sobe de nível. */
  glow: string
  /** Cor do texto. */
  text: string
  /** Cores que ficam logo atrás do texto (o teste mede o contraste contra cada uma). */
  surface: string[]
  /** O "Nv" fica mais apagado que o número (só no selo comum). */
  dimLabel: boolean
}

/** As 6 faixas da bandeira do orgulho, de cima para baixo. */
export const PRIDE_COLORS = ['#e40303', '#ff8c00', '#ffed00', '#008026', '#004dff', '#750787']

/** Contorno grosso em volta das letras: o texto se lê em cima de qualquer faixa. */
const halo = (color: string): string =>
  [
    `-1px -1px 0 ${color}`,
    `1px -1px 0 ${color}`,
    `-1px 1px 0 ${color}`,
    `1px 1px 0 ${color}`,
    `0 0 2px ${color}`
  ].join(', ')

const svg = (body: string, w: number, h: number): string =>
  `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'>${body}</svg>`
  )}")`

// 13: vermelho com estrelinhas brancas (as que piscam vêm do CSS).
const RED = '#c81e1e'
const RED_DARK = '#8f1414'
const RED_HALO = '#5c0d0d'
const STARS = [
  [12, 30],
  [30, 75],
  [52, 22],
  [70, 68],
  [88, 35],
  [40, 50]
]
  .map(([x, y]) => `radial-gradient(circle at ${x}% ${y}%, #ffffff 0 0.7px, transparent 1.2px)`)
  .join(', ')

// 14: onça-pintada — rosetas (anel escuro aberto com miolo ocre) no dourado.
const ONCA = '#f0b54a'
const ONCA_DARK = '#c98420'
const ONCA_HALO = '#f6c768'
const ONCA_INK = '#1c1206'
const ROSETTE = (x: number, y: number): string =>
  `<circle cx='${x}' cy='${y}' r='2.1' fill='#b06a14' stroke='#24160a' stroke-width='1.1' stroke-dasharray='3 1.3'/>`
const ROSETTES = svg(
  `${ROSETTE(4, 4)}${ROSETTE(12.5, 9)}<circle cx='11' cy='2' r='.8' fill='#24160a'/><circle cx='3' cy='10.4' r='.7' fill='#24160a'/>`,
  16,
  12
)

// 22: Brasil — verde escuro, losango amarelo e círculo azul por trás, texto amarelo.
const GREEN = '#006b33'
const GREEN_DARK = '#004d24'
const BRAZIL_YELLOW = '#ffdf00'
const GREEN_HALO = '#00230f'
const LOSANGO = svg(
  `<polygon points='20,2 38,10 20,18 2,10' fill='${BRAZIL_YELLOW}' fill-opacity='.14'/><circle cx='20' cy='10' r='4.5' fill='#002776' fill-opacity='.55'/>`,
  40,
  20
)

// 24: orgulho — as 6 faixas; o texto branco tem contorno escuro.
const PRIDE_HALO = '#1a1022'
const PRIDE_STRIPES = `linear-gradient(180deg, ${PRIDE_COLORS.map(
  (c, i) => `${c} ${((i * 100) / 6).toFixed(2)}% ${(((i + 1) * 100) / 6).toFixed(2)}%`
).join(', ')})`

type Special = Omit<LevelBadgeLook, 'dimLabel'>

const SPECIAL: Record<number, Special> = {
  13: {
    variant: 'estrelas',
    className: 'level-badge-special level-badge-estrelas',
    style: {
      color: '#ffffff',
      backgroundImage: `${STARS}, linear-gradient(135deg, ${RED}, ${RED_DARK})`,
      textShadow: halo(RED_HALO)
    },
    glow: '#ef4444',
    text: '#ffffff',
    surface: [RED, RED_DARK, RED_HALO]
  },
  14: {
    variant: 'onca',
    className: 'level-badge-special level-badge-onca',
    style: {
      color: ONCA_INK,
      backgroundImage: `${ROSETTES}, linear-gradient(135deg, ${ONCA}, ${ONCA_DARK})`,
      backgroundSize: '16px 12px, 100% 100%',
      textShadow: halo(ONCA_HALO)
    },
    glow: ONCA,
    text: ONCA_INK,
    surface: [ONCA, ONCA_DARK, ONCA_HALO]
  },
  22: {
    variant: 'brasil',
    className: 'level-badge-special level-badge-brasil',
    style: {
      color: BRAZIL_YELLOW,
      backgroundImage: `${LOSANGO}, linear-gradient(135deg, ${GREEN}, ${GREEN_DARK})`,
      backgroundSize: '100% 100%',
      boxShadow: `inset 0 0 0 1px ${BRAZIL_YELLOW}aa`,
      textShadow: halo(GREEN_HALO)
    },
    glow: BRAZIL_YELLOW,
    text: BRAZIL_YELLOW,
    surface: [GREEN, GREEN_DARK, GREEN_HALO]
  },
  24: {
    variant: 'orgulho',
    className: 'level-badge-special level-badge-orgulho',
    style: {
      color: '#ffffff',
      backgroundImage: PRIDE_STRIPES,
      textShadow: halo(PRIDE_HALO)
    },
    glow: '#c084fc',
    text: '#ffffff',
    surface: [PRIDE_HALO]
  }
}

/** Níveis com selo próprio (em ordem). */
export const SPECIAL_BADGE_LEVELS: readonly number[] = Object.keys(SPECIAL).map(Number)

export function levelBadgeStyle(level: number): LevelBadgeLook {
  const special = SPECIAL[level]
  if (special) return { ...special, dimLabel: false }
  const tier = levelTier(level)
  if (tier === LEGENDARY_TIER) {
    return {
      variant: 'lendario',
      className: 'level-legendary',
      style: { color: '#1a1022', boxShadow: `0 0 10px ${tier.accent}aa` },
      glow: tier.accent,
      text: '#1a1022',
      surface: [],
      dimLabel: true
    }
  }
  return {
    variant: 'faixa',
    className: '',
    style: {
      color: '#0b0b0f',
      backgroundImage: `linear-gradient(135deg, ${tier.color}, ${tier.accent})`
    },
    glow: tier.color,
    text: '#0b0b0f',
    surface: [],
    dimLabel: true
  }
}

/**
 * Sombra do selo: a do próprio visual (ex.: o friso amarelo do 22) mais o
 * brilho na cor do selo enquanto a pessoa sobe de nível. O lendário já
 * brilha sempre.
 */
export function badgeShadow(look: LevelBadgeLook, celebrating: boolean): string | undefined {
  const glow = celebrating && look.variant !== 'lendario' ? `0 0 14px ${look.glow}` : undefined
  const parts = [look.style.boxShadow, glow].filter(Boolean)
  return parts.length > 0 ? parts.join(', ') : undefined
}
