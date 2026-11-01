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
