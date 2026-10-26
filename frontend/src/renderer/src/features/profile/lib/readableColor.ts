// Cor de texto legível sobre o fundo escolhido no perfil. Cargos e faixas têm
// cor própria (cinza, prata...) e somem num fundo rosa ou claro; aqui ela é
// puxada para o texto do cartão até dar contraste. Cor que já lê fica como está.

import { composite, contrastRatio, parseColor } from '../../../shared/lib/contrast'
import { DARK_INK, LIGHT_INK, type Ink } from './profileTheme'

/** Mínimo de contraste (WCAG AA para texto pequeno). */
const MIN_RATIO = 4.5
const STEPS = 10

/** Véu que o cartão põe nos blocos de informação (--bg-input em profileTheme.css). */
const VEIL: Record<Ink, string> = {
  dark: 'rgb(255 255 255 / 0.45)',
  light: 'rgb(0 0 0 / 0.3)'
}

function hex(n: number): string {
  return Math.round(n).toString(16).padStart(2, '0')
}

/** `from` puxada `amount` (0–1) na direção de `to`; ambas já validadas. */
function towards(from: string, to: string, amount: number): string {
  const a = parseColor(from)
  const b = parseColor(to)
  if (!a || !b) return from
  const mix = (x: number, y: number): string => hex(x + (y - x) * amount)
  return `#${mix(a.r, b.r)}${mix(a.g, b.g)}${mix(a.b, b.b)}`
}

/** Pior contraste da cor no fundo (cada ponto do degradê, com o véu do bloco). */
function worstRatio(color: string, points: string[], ink: Ink): number {
  const veil = parseColor(VEIL[ink])
  return Math.min(
    ...points.map((point) => {
      const base = parseColor(point)
      const surface = veil && base ? composite(veil, base) : base
      if (!surface) return Infinity
      const css = `rgb(${surface.r} ${surface.g} ${surface.b})`
      return contrastRatio(color, css)
    })
  )
}

/**
 * `color` ou, se ela não tem contraste com o fundo do cartão, a mais próxima
 * dela que tem. `background` são as cores do fundo (uma ou duas do degradê);
 * vazio é perfil sem tema, que segue o tema do app e não é mexido aqui.
 */
export function readableColor(color: string, background: string[], ink: Ink): string {
  if (!parseColor(color)) return color
  const points = background.filter((c) => parseColor(c))
  if (points.length === 0) return color
  if (worstRatio(color, points, ink) >= MIN_RATIO) return color
  const target = ink === 'dark' ? DARK_INK : LIGHT_INK
  for (let i = 1; i <= STEPS; i++) {
    const candidate = towards(color, target, i / STEPS)
    if (worstRatio(candidate, points, ink) >= MIN_RATIO) return candidate
  }
  return target
}
