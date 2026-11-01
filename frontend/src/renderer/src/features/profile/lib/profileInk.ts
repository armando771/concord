// Contraste (WCAG 2.x) e a cor do texto do cartão de perfil sobre o fundo
// escolhido no tema.

const COLOR = /^#[0-9a-f]{6}$/i

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
