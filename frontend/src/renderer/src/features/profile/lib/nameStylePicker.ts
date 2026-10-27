import { NAME_EFFECTS, defaultColorsFor, type NameStyle } from './nameStyle'

// Escolhas do editor de estilo do nome (fonte, efeito, cores).

/** Troca o efeito mantendo as cores que ainda servem e completando as que faltam. */
export function withEffect(style: NameStyle, effectId: string): NameStyle {
  const def = NAME_EFFECTS.find((e) => e.id === effectId)
  if (!def) return style
  const kept = style.colors.slice(0, def.maxColors)
  const fill = defaultColorsFor(effectId).slice(kept.length)
  return { ...style, effect: effectId, colors: [...kept, ...fill] }
}
