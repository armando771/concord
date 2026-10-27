import { NAME_EFFECTS, NAME_FONTS, defaultColorsFor, type NameStyle } from './nameStyle'

// Escolhas do editor de estilo do nome (fonte, efeito, cores).

/** Troca o efeito mantendo as cores que ainda servem e completando as que faltam. */
export function withEffect(style: NameStyle, effectId: string): NameStyle {
  const def = NAME_EFFECTS.find((e) => e.id === effectId)
  if (!def) return style
  const kept = style.colors.slice(0, def.maxColors)
  const fill = defaultColorsFor(effectId).slice(kept.length)
  return { ...style, effect: effectId, colors: [...kept, ...fill] }
}

/** Cores do "Surpreenda-me": vivas, que leem bem no fundo escuro e no claro. */
const SURPRISE_COLORS = [
  '#5865f2', '#eb459e', '#57f287', '#fee75c', '#ed4245', '#00b0f4',
  '#f47fff', '#ff8a3d', '#9b59b6', '#1abc9c', '#e91e63', '#ffd166'
]

const pick = <T>(list: readonly T[], rand: () => number): T =>
  list[Math.min(list.length - 1, Math.floor(rand() * list.length))]

function rollNameStyle(rand: () => number): NameStyle {
  const effect = pick(NAME_EFFECTS, rand)
  return {
    font: pick(NAME_FONTS, rand).id,
    effect: effect.id,
    colors: Array.from({ length: effect.maxColors }, () => pick(SURPRISE_COLORS, rand))
  }
}

const sameStyle = (a: NameStyle, b: NameStyle): boolean =>
  a.font === b.font && a.effect === b.effect && a.colors.join() === b.colors.join()

/**
 * "Surpreenda-me": fonte, efeito e cores sorteados entre os que o backend
 * aceita. Se sair igual ao atual, troca a fonte pela vizinha.
 */
export function surpriseNameStyle(current: NameStyle, rand: () => number = Math.random): NameStyle {
  const next = rollNameStyle(rand)
  if (!sameStyle(next, current)) return next
  const i = NAME_FONTS.findIndex((f) => f.id === next.font)
  return { ...next, font: NAME_FONTS[(i + 1) % NAME_FONTS.length].id }
}
