import type { CSSProperties } from 'react'

// Estilo do nome de exibição. Os IDs são os do backend (internal/namestyle);
// nameStyle.test.ts confere as duas listas. As fontes são equivalentes livres
// (OFL) das do Discord, empacotadas em assets/nameFonts.css.

export interface NameStyle {
  font: string
  effect: string
  colors: string[]
}

export const DEFAULT_NAME_STYLE: NameStyle = { font: 'default', effect: 'solid', colors: [] }

export const NAME_FONTS = [
  { id: 'default', label: 'Padrão', family: '' },
  { id: 'tempo', label: 'Tempo', family: "'Bitter', serif" },
  { id: 'sakura', label: 'Sakura', family: "'Pacifico', cursive" },
  { id: 'jellybean', label: 'Jellybean', family: "'Chango', sans-serif" },
  { id: 'modern', label: 'Moderna', family: "'Montserrat', sans-serif" },
  { id: 'medieval', label: 'Medieval', family: "'Cinzel Decorative', serif" },
  { id: 'bit8', label: '8Bit', family: "'Press Start 2P', monospace" },
  { id: 'vampyre', label: 'Vampiro', family: "'Grenze Gotisch', serif" },
  { id: 'handwritten', label: 'Manuscrita', family: "'Caveat', cursive" },
  { id: 'slab', label: 'Slab', family: "'Zilla Slab', serif" },
  { id: 'condensed', label: 'Condensada', family: "'Oswald', sans-serif" },
  { id: 'mono', label: 'Monoespaçada', family: "'JetBrains Mono', monospace" },
  { id: 'retro', label: 'Retrô', family: "'Bungee', sans-serif" },
  { id: 'pixel', label: 'Pixel', family: "'Silkscreen', monospace" },
  { id: 'terminal', label: 'Terminal', family: "'VT323', monospace" },
  { id: 'script', label: 'Cursiva', family: "'Dancing Script', cursive" },
  { id: 'elegant', label: 'Elegante', family: "'Great Vibes', cursive" },
  { id: 'gothic', label: 'Gótica', family: "'UnifrakturMaguntia', serif" },
  { id: 'space', label: 'Espacial', family: "'Space Mono', monospace" },
  { id: 'rounded', label: 'Arredondada', family: "'Fredoka', sans-serif" },
  { id: 'soft', label: 'Suave', family: "'Comfortaa', sans-serif" },
  { id: 'marquee', label: 'Letreiro', family: "'Lobster', cursive" },
  { id: 'arcade', label: 'Fliperama', family: "'Righteous', sans-serif" },
  { id: 'disco', label: 'Disco', family: "'Monoton', sans-serif" },
  { id: 'cartoon', label: 'Gibi', family: "'Bangers', sans-serif" },
  { id: 'scifi', label: 'Sci-fi', family: "'Orbitron', sans-serif" },
  { id: 'horror', label: 'Terror', family: "'Creepster', cursive" }
] as const

export const NAME_EFFECTS = [
  { id: 'solid', label: 'Sólido', minColors: 0, maxColors: 1 },
  { id: 'gradient', label: 'Degradê', minColors: 2, maxColors: 2 },
  { id: 'neon', label: 'Neon', minColors: 1, maxColors: 1 },
  { id: 'toon', label: 'Toon', minColors: 1, maxColors: 1 },
  { id: 'pop', label: 'Pop', minColors: 1, maxColors: 1 },
  { id: 'rainbow', label: 'Arco-íris', minColors: 0, maxColors: 0 },
  { id: 'pulse', label: 'Pulso', minColors: 0, maxColors: 1 },
  { id: 'flow', label: 'Degradê animado', minColors: 2, maxColors: 2 },
  { id: 'glow', label: 'Neon pulsante', minColors: 1, maxColors: 1 },
  { id: 'glitch', label: 'Glitch', minColors: 0, maxColors: 1 },
  { id: 'fire', label: 'Fogo', minColors: 0, maxColors: 0 },
  { id: 'wave', label: 'Onda', minColors: 0, maxColors: 1 },
  { id: 'shimmer', label: 'Cintilante', minColors: 0, maxColors: 1 },
  { id: 'sparkle', label: 'Brilhos', minColors: 0, maxColors: 1 },
  { id: 'typewriter', label: 'Digitando', minColors: 0, maxColors: 1 },
  { id: 'chrome', label: 'Cromado', minColors: 0, maxColors: 0 },
  { id: 'shadow3d', label: 'Sombra 3D', minColors: 2, maxColors: 2 }
] as const

const COLOR = /^#[0-9a-f]{6}$/i
const FALLBACK_COLORS = ['#5865f2', '#eb459e']

export function defaultColorsFor(effectId: string): string[] {
  const effect = NAME_EFFECTS.find((e) => e.id === effectId)
  return FALLBACK_COLORS.slice(0, effect?.minColors ?? 0)
}

/** Estilo seguro para desenhar: ID desconhecido vira o padrão, cor inválida some. */
export function resolveNameStyle(raw?: Partial<NameStyle> | null): NameStyle {
  const font = NAME_FONTS.some((f) => f.id === raw?.font) ? (raw!.font as string) : 'default'
  const effectDef = NAME_EFFECTS.find((e) => e.id === raw?.effect)
  const colors = (Array.isArray(raw?.colors) ? raw.colors : [])
    .filter((c): c is string => typeof c === 'string' && COLOR.test(c))
    .map((c) => c.toLowerCase())
    .slice(0, effectDef?.maxColors ?? 1)
  if (!effectDef || colors.length < effectDef.minColors) {
    return { font, effect: 'solid', colors: colors.slice(0, 1) }
  }
  return { font, effect: effectDef.id, colors }
}

/** Estilo inline com as variáveis CSS que os efeitos leem (--name-c1...). */
type NameCss = CSSProperties & Record<`--name-${string}`, string | number>

export interface NameStyleCss {
  className: string
  style: NameCss
  /** O efeito desenha uma cópia do texto (::before/::after com attr(data-text)). */
  copy?: boolean
  /** O efeito anima letra por letra (cada uma num span). */
  letters?: boolean
}

/** Letras de verdade (emoji com tom de pele e acento combinado contam como uma). */
export function nameGraphemes(text: string): string[] {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    return Array.from(seg.segment(text), (s) => s.segment)
  }
  return Array.from(text)
}

const clipText = (css: NameCss): void => {
  css.WebkitBackgroundClip = 'text'
  css.backgroundClip = 'text'
  css.color = 'transparent'
}

/**
 * Classe (animação) e estilo inline de um nome. O padrão não muda nada. Tudo
 * é CSS (assets/nameStyle.css): nenhum efeito roda JS por quadro, e todos
 * param com prefers-reduced-motion.
 */
export function nameStyleCss(style: NameStyle): NameStyleCss {
  const family = NAME_FONTS.find((f) => f.id === style.font)?.family
  const css: NameCss = family ? { fontFamily: family } : {}
  const [a, b] = style.colors
  let className = ''
  let copy = false
  let letters = false
  switch (style.effect) {
    case 'solid':
      if (a) css.color = a
      break
    case 'gradient':
      css.backgroundImage = `linear-gradient(90deg, ${a}, ${b})`
      css.WebkitBackgroundClip = 'text'
      css.backgroundClip = 'text'
      css.color = 'transparent'
      break
    case 'neon':
      css.color = '#fff'
      css.textShadow = `0 0 4px ${a}, 0 0 10px ${a}, 0 0 18px ${a}`
      break
    case 'toon':
      css.color = a
      // Contorno claro: o app é escuro, um contorno preto sumiria no fundo.
      css.textShadow = '-1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff'
      break
    case 'pop':
      css.color = '#fff'
      css.textShadow = `2px 2px 0 ${a}`
      break
    case 'rainbow':
      className = 'name-rainbow'
      break
    case 'pulse':
      className = 'name-pulse'
      if (a) css.color = a
      break
    case 'flow':
      className = 'name-flow'
      css.backgroundImage = `linear-gradient(90deg, ${a}, ${b}, ${a})`
      clipText(css)
      break
    case 'glow':
      className = 'name-glow'
      copy = true
      css.color = '#fff'
      css['--name-c1'] = a
      break
    case 'glitch':
      className = 'name-glitch'
      copy = true
      if (a) css.color = a
      break
    case 'fire':
      className = 'name-fire'
      break
    case 'wave':
      className = 'name-wave'
      letters = true
      if (a) css.color = a
      break
    case 'shimmer': {
      const base = a ?? '#c9cdfb'
      className = 'name-shimmer'
      css.backgroundImage = `linear-gradient(110deg, ${base} 35%, #ffffff 50%, ${base} 65%)`
      clipText(css)
      break
    }
    case 'sparkle':
      className = 'name-sparkle'
      if (a) css.color = a
      break
    case 'typewriter':
      className = 'name-typewriter'
      if (a) css.color = a
      break
    case 'chrome':
      className = 'name-chrome'
      break
    case 'shadow3d':
      css.color = a
      css.textShadow = [1, 2, 3].map((n) => `${n}px ${n}px 0 ${b}`).join(', ')
      break
  }
  return { className, style: css, ...(copy ? { copy } : {}), ...(letters ? { letters } : {}) }
}
