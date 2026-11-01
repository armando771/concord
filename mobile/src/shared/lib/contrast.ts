// Contraste de cores pela fórmula do WCAG 2 (luminância relativa). Puro: usado
// no teste que garante AA em todos os temas (ver lib/themes.ts).

export interface Rgba {
  /** 0–255 (pode ter fração depois de compor). */
  r: number
  g: number
  b: number
  /** 0–1 */
  a: number
}

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i
const RGB = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+)(%?))?\s*\)$/i

/** `#rgb`, `#rrggbb`, `#rrggbbaa`, `rgb()`/`rgba()` → cor; outra coisa → null. */
export function parseColor(value: string): Rgba | null {
  const text = value.trim()
  const hex = HEX.exec(text)
  if (hex) {
    let digits = hex[1]
    if (digits.length <= 4) digits = [...digits].map((d) => d + d).join('')
    const n = (i: number): number => parseInt(digits.slice(i, i + 2), 16)
    return { r: n(0), g: n(2), b: n(4), a: digits.length === 8 ? n(6) / 255 : 1 }
  }
  const rgb = RGB.exec(text)
  if (rgb) {
    const alpha = rgb[4] === undefined ? 1 : Number(rgb[4]) / (rgb[5] ? 100 : 1)
    return { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]), a: alpha }
  }
  return null
}

/** `top` por cima de `bottom` (que precisa ser opaco). */
export function composite(top: Rgba, bottom: Rgba): Rgba {
  const mix = (t: number, b: number): number => t * top.a + b * (1 - top.a)
  return { r: mix(top.r, bottom.r), g: mix(top.g, bottom.g), b: mix(top.b, bottom.b), a: 1 }
}

function channel(value: number): number {
  const c = value / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

export function relativeLuminance(color: Rgba): number {
  return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b)
}

function mustParse(value: string): Rgba {
  const color = parseColor(value)
  if (!color) throw new Error(`Cor inválida: ${value}`)
  return color
}

/**
 * Razão de contraste (1–21) entre texto e fundo. Fundo translúcido é composto
 * sobre `base` (preto se não vier); texto translúcido, sobre o fundo.
 */
export function contrastRatio(text: string, background: string, base = '#000000'): number {
  let bg = mustParse(background)
  if (bg.a < 1) bg = composite(bg, mustParse(base))
  let fg = mustParse(text)
  if (fg.a < 1) fg = composite(fg, bg)
  const [hi, lo] = [relativeLuminance(fg), relativeLuminance(bg)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
